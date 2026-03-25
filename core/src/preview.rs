use std::collections::HashMap;
use std::path::Path;

use image::{Rgba, RgbaImage};
use imageproc::drawing::{draw_filled_rect_mut, draw_line_segment_mut};
use imageproc::rect::Rect;

use crate::error::{CoreError, Result};
use crate::project::{BlockData, HighlightBlockData, HighlightStyle, HighlightType, Project, TrackType};

// Video constants matching rollingquran's config.py
pub const VIDEO_WIDTH: u32 = 1080;
pub const VIDEO_HEIGHT: u32 = 1920;
pub const VIDEO_FPS: u32 = 30;
pub const BACKGROUND_COLOR: [u8; 3] = [245, 239, 227]; // Cream/beige
const PAGE_PADDING: u32 = 40;

// Highlight padding matching rollingquran's highlight.py
const PAD_X: i32 = 10;
const PAD_Y: i32 = 6;

/// Placement info for a mushaf page image within the video frame.
#[derive(Debug, Clone)]
pub struct PagePlacement {
    pub offset_x: u32,
    pub offset_y: u32,
    pub scaled_w: u32,
    pub scaled_h: u32,
}

/// Pixel bounding box for a word on the video frame.
#[derive(Debug, Clone)]
pub struct WordBBox {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// Render a single preview frame at a given timestamp.
/// Returns PNG-encoded bytes.
pub fn render_preview_frame(
    project: &Project,
    timestamp_ms: u64,
    mushaf_dir: &Path,
) -> Result<Vec<u8>> {
    // Find the active mushaf page at this timestamp
    let active_page = find_active_page(project, timestamp_ms);

    // Find active highlights at this timestamp
    let active_highlights = find_active_highlights(project, timestamp_ms);

    // Prepare the page image
    let (frame, placement) = prepare_page_image(active_page, mushaf_dir)?;

    // Apply highlights
    let frame = if !active_highlights.is_empty() {
        let mut frame = frame;
        let word_bboxes: Vec<WordBBox> = active_highlights
            .iter()
            .map(|h| fractional_to_pixel(
                h.x as f64 / 100_000.0,
                h.y as f64 / 100_000.0,
                h.width as f64 / 100_000.0,
                h.height as f64 / 100_000.0,
                &placement,
            ))
            .collect();

        let merged = merge_bboxes(&word_bboxes);

        let style = active_highlights
            .first()
            .map(|h| &h.style)
            .cloned()
            .unwrap_or_default();

        for bbox in &merged {
            draw_highlight(&mut frame, bbox, &style);
        }

        frame
    } else {
        frame
    };

    // Encode to PNG
    let mut png_bytes = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_bytes);
    let encoder = image::codecs::png::PngEncoder::new(&mut cursor);
    image::ImageEncoder::write_image(
        encoder,
        frame.as_raw(),
        frame.width(),
        frame.height(),
        image::ExtendedColorType::Rgba8,
    )?;

    Ok(png_bytes)
}

/// Prepare a mushaf page image fitted into the video frame.
/// Ported from rollingquran's renderer.py _prepare_page_image().
pub fn prepare_page_image(
    page_num: Option<u16>,
    mushaf_dir: &Path,
) -> Result<(RgbaImage, PagePlacement)> {
    let mut frame = RgbaImage::from_pixel(
        VIDEO_WIDTH,
        VIDEO_HEIGHT,
        Rgba([
            BACKGROUND_COLOR[0],
            BACKGROUND_COLOR[1],
            BACKGROUND_COLOR[2],
            255,
        ]),
    );

    let default_placement = PagePlacement {
        offset_x: 0,
        offset_y: 0,
        scaled_w: VIDEO_WIDTH,
        scaled_h: VIDEO_HEIGHT,
    };

    let page_num = match page_num {
        Some(p) => p,
        None => return Ok((frame, default_placement)),
    };

    // Try loading the page image with different naming patterns
    let page_path = find_page_file(mushaf_dir, page_num);
    let page_path = match page_path {
        Some(p) => p,
        None => return Ok((frame, default_placement)),
    };

    let page_img = image::open(&page_path)
        .map_err(CoreError::Image)?
        .to_rgba8();

    let orig_w = page_img.width();
    let orig_h = page_img.height();

    let available_w = VIDEO_WIDTH - 2 * PAGE_PADDING;
    let available_h = VIDEO_HEIGHT - 2 * PAGE_PADDING;

    let scale_w = available_w as f64 / orig_w as f64;
    let scale_h = available_h as f64 / orig_h as f64;
    let scale = scale_w.min(scale_h);

    let new_w = (orig_w as f64 * scale) as u32;
    let new_h = (orig_h as f64 * scale) as u32;

    let resized = image::imageops::resize(
        &page_img,
        new_w,
        new_h,
        image::imageops::FilterType::Lanczos3,
    );

    let offset_x = (VIDEO_WIDTH - new_w) / 2;
    let offset_y = (VIDEO_HEIGHT - new_h) / 2;

    image::imageops::overlay(&mut frame, &resized, offset_x as i64, offset_y as i64);

    Ok((
        frame,
        PagePlacement {
            offset_x,
            offset_y,
            scaled_w: new_w,
            scaled_h: new_h,
        },
    ))
}

/// Convert fractional coordinates to pixel coordinates in the video frame.
/// Ported from rollingquran's renderer.py _fractional_to_pixel().
pub fn fractional_to_pixel(
    frac_x: f64,
    frac_y: f64,
    frac_w: f64,
    frac_h: f64,
    placement: &PagePlacement,
) -> WordBBox {
    WordBBox {
        x: (placement.offset_x as f64 + frac_x * placement.scaled_w as f64) as i32,
        y: (placement.offset_y as f64 + frac_y * placement.scaled_h as f64) as i32,
        width: (frac_w * placement.scaled_w as f64) as i32,
        height: (frac_h * placement.scaled_h as f64) as i32,
    }
}

/// Merge word bounding boxes into line-level boxes.
/// Ported from rollingquran's renderer.py _merge_bboxes().
/// Groups words by Y center (same line) and merges each group.
pub fn merge_bboxes(bboxes: &[WordBBox]) -> Vec<WordBBox> {
    if bboxes.is_empty() {
        return Vec::new();
    }
    if bboxes.len() == 1 {
        return bboxes.to_vec();
    }

    // Group by Y center, snapped to 20px grid
    let mut lines: HashMap<i32, Vec<&WordBBox>> = HashMap::new();
    for b in bboxes {
        let y_center = b.y + b.height / 2;
        let line_key = y_center / 20;
        lines.entry(line_key).or_default().push(b);
    }

    let mut merged = Vec::new();
    for line_bboxes in lines.values() {
        let min_x = line_bboxes.iter().map(|b| b.x).min().unwrap();
        let min_y = line_bboxes.iter().map(|b| b.y).min().unwrap();
        let max_x = line_bboxes.iter().map(|b| b.x + b.width).max().unwrap();
        let max_y = line_bboxes.iter().map(|b| b.y + b.height).max().unwrap();

        merged.push(WordBBox {
            x: min_x,
            y: min_y,
            width: max_x - min_x,
            height: max_y - min_y,
        });
    }

    merged
}

/// Draw a highlight overlay on the frame.
/// Ported from rollingquran's highlight.py.
fn draw_highlight(frame: &mut RgbaImage, bbox: &WordBBox, style: &HighlightStyle) {
    match style.highlight_type {
        HighlightType::GoldenGlow => draw_golden_glow(frame, bbox, style),
        HighlightType::BlueBox => draw_blue_box(frame, bbox, style),
        HighlightType::Underline => draw_underline(frame, bbox, style),
    }
}

/// Parse a hex color string (#RRGGBB) to RGB tuple.
fn parse_hex_color(hex: &str) -> (u8, u8, u8) {
    let hex = hex.trim_start_matches('#');
    if hex.len() >= 6 {
        let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(255);
        let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(215);
        let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
        (r, g, b)
    } else {
        (255, 215, 0) // Default gold
    }
}

/// Golden glow highlight: semi-transparent gold rounded rectangle.
/// Ported from rollingquran's highlight.py _draw_golden_glow().
fn draw_golden_glow(frame: &mut RgbaImage, bbox: &WordBBox, style: &HighlightStyle) {
    let (r, g, b) = parse_hex_color(&style.color);
    let alpha = (style.opacity * 255.0) as u8;

    let x1 = (bbox.x - PAD_X).max(0);
    let y1 = (bbox.y - PAD_Y).max(0);
    let w = (bbox.width + 2 * PAD_X) as u32;
    let h = (bbox.height + 2 * PAD_Y) as u32;

    // Clamp to frame bounds
    let x1 = x1.min(frame.width() as i32 - 1).max(0);
    let y1 = y1.min(frame.height() as i32 - 1).max(0);
    let w = w.min(frame.width() - x1 as u32);
    let h = h.min(frame.height() - y1 as u32);

    if w == 0 || h == 0 {
        return;
    }

    // Draw filled rectangle with alpha blending
    let fill_color = Rgba([r, g, b, alpha]);
    draw_filled_rect_mut(
        frame,
        Rect::at(x1, y1).of_size(w, h),
        fill_color,
    );

    // Draw outline (slightly darker)
    let outline_r = r.saturating_sub(40);
    let outline_g = g.saturating_sub(50);
    let outline_color = Rgba([outline_r, outline_g, b, 220]);
    let border_width = 3i32;

    // Top and bottom borders
    for dy in 0..border_width {
        let top_y = y1 + dy;
        let bot_y = y1 + h as i32 - 1 - dy;
        if top_y >= 0 && (top_y as u32) < frame.height() {
            for px in x1..(x1 + w as i32).min(frame.width() as i32) {
                if px >= 0 {
                    blend_pixel(frame, px as u32, top_y as u32, outline_color);
                }
            }
        }
        if bot_y >= 0 && (bot_y as u32) < frame.height() && bot_y != top_y {
            for px in x1..(x1 + w as i32).min(frame.width() as i32) {
                if px >= 0 {
                    blend_pixel(frame, px as u32, bot_y as u32, outline_color);
                }
            }
        }
    }

    // Left and right borders
    for dx in 0..border_width {
        let left_x = x1 + dx;
        let right_x = x1 + w as i32 - 1 - dx;
        if left_x >= 0 && (left_x as u32) < frame.width() {
            for py in y1..(y1 + h as i32).min(frame.height() as i32) {
                if py >= 0 {
                    blend_pixel(frame, left_x as u32, py as u32, outline_color);
                }
            }
        }
        if right_x >= 0 && (right_x as u32) < frame.width() && right_x != left_x {
            for py in y1..(y1 + h as i32).min(frame.height() as i32) {
                if py >= 0 {
                    blend_pixel(frame, right_x as u32, py as u32, outline_color);
                }
            }
        }
    }
}

/// Blue box highlight: semi-transparent blue rectangle with outline.
/// Ported from rollingquran's highlight.py _draw_blue_box().
fn draw_blue_box(frame: &mut RgbaImage, bbox: &WordBBox, style: &HighlightStyle) {
    let (r, g, b) = parse_hex_color(&style.color);
    let alpha = (style.opacity * 255.0).min(255.0) as u8;

    let x1 = (bbox.x - PAD_X).max(0);
    let y1 = (bbox.y - PAD_Y).max(0);
    let w = (bbox.width + 2 * PAD_X) as u32;
    let h = (bbox.height + 2 * PAD_Y) as u32;

    let x1 = x1.min(frame.width() as i32 - 1).max(0);
    let y1 = y1.min(frame.height() as i32 - 1).max(0);
    let w = w.min(frame.width() - x1 as u32);
    let h = h.min(frame.height() - y1 as u32);

    if w == 0 || h == 0 {
        return;
    }

    let fill_color = Rgba([r, g, b, alpha]);
    draw_filled_rect_mut(
        frame,
        Rect::at(x1, y1).of_size(w, h),
        fill_color,
    );

    // Outline
    let outline_r = r.saturating_sub(35);
    let outline_g = g.saturating_sub(35);
    let outline_b = b.saturating_sub(25);
    let outline_color = Rgba([outline_r, outline_g, outline_b, 230]);
    let border_width = 3i32;

    for dy in 0..border_width {
        let top_y = y1 + dy;
        let bot_y = y1 + h as i32 - 1 - dy;
        for px in x1..(x1 + w as i32).min(frame.width() as i32) {
            if px >= 0 {
                if top_y >= 0 && (top_y as u32) < frame.height() {
                    blend_pixel(frame, px as u32, top_y as u32, outline_color);
                }
                if bot_y >= 0 && (bot_y as u32) < frame.height() && bot_y != top_y {
                    blend_pixel(frame, px as u32, bot_y as u32, outline_color);
                }
            }
        }
    }
    for dx in 0..border_width {
        let left_x = x1 + dx;
        let right_x = x1 + w as i32 - 1 - dx;
        for py in y1..(y1 + h as i32).min(frame.height() as i32) {
            if py >= 0 {
                if left_x >= 0 && (left_x as u32) < frame.width() {
                    blend_pixel(frame, left_x as u32, py as u32, outline_color);
                }
                if right_x >= 0 && (right_x as u32) < frame.width() && right_x != left_x {
                    blend_pixel(frame, right_x as u32, py as u32, outline_color);
                }
            }
        }
    }
}

/// Underline highlight: colored line below text.
/// Ported from rollingquran's highlight.py _draw_underline().
fn draw_underline(frame: &mut RgbaImage, bbox: &WordBBox, style: &HighlightStyle) {
    let (r, g, b) = parse_hex_color(&style.color);
    let alpha = (style.opacity * 255.0).min(255.0) as u8;
    let color = Rgba([r, g, b, alpha.max(230)]);

    let x1 = (bbox.x - PAD_X).max(0) as f32;
    let x2 = (bbox.x + bbox.width + PAD_X).min(frame.width() as i32 - 1) as f32;
    let base_y = (bbox.y + bbox.height + 4).min(frame.height() as i32 - 1);

    // Draw 5 lines for thickness (matching Python's width=5)
    for dy in -2..=2 {
        let y = (base_y + dy).max(0).min(frame.height() as i32 - 1) as f32;
        draw_line_segment_mut(frame, (x1, y), (x2, y), color);
    }
}

/// Alpha-blend a pixel onto the frame.
fn blend_pixel(frame: &mut RgbaImage, x: u32, y: u32, color: Rgba<u8>) {
    if x >= frame.width() || y >= frame.height() {
        return;
    }
    let existing = frame.get_pixel(x, y);
    let alpha = color[3] as f64 / 255.0;
    let inv_alpha = 1.0 - alpha;

    let r = (color[0] as f64 * alpha + existing[0] as f64 * inv_alpha) as u8;
    let g = (color[1] as f64 * alpha + existing[1] as f64 * inv_alpha) as u8;
    let b = (color[2] as f64 * alpha + existing[2] as f64 * inv_alpha) as u8;
    let a = (color[3] as f64 + existing[3] as f64 * inv_alpha).min(255.0) as u8;

    frame.put_pixel(x, y, Rgba([r, g, b, a]));
}

/// Find the mushaf page file with various naming patterns.
fn find_page_file(mushaf_dir: &Path, page_num: u16) -> Option<std::path::PathBuf> {
    let patterns = [
        format!("page{:03}.png", page_num),
        format!("page{}.png", page_num),
        format!("page{:03}.jpg", page_num),
        format!("page{}.jpg", page_num),
        format!("{:03}.png", page_num),
        format!("{}.png", page_num),
    ];

    for pattern in &patterns {
        let candidate = mushaf_dir.join(pattern);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

/// Find the active mushaf page at a given timestamp.
fn find_active_page(project: &Project, timestamp_ms: u64) -> Option<u16> {
    for track in &project.timeline.tracks {
        if track.track_type == TrackType::MushafPage {
            for block in &track.blocks {
                if timestamp_ms >= block.start_ms && timestamp_ms < block.end_ms {
                    if let BlockData::MushafPage(ref data) = block.data {
                        return Some(data.page);
                    }
                }
            }
            // If past end, use last block
            if let Some(last) = track.blocks.last() {
                if timestamp_ms >= last.end_ms {
                    if let BlockData::MushafPage(ref data) = last.data {
                        return Some(data.page);
                    }
                }
            }
        }
    }
    None
}

/// Find active highlight blocks at a given timestamp.
fn find_active_highlights(project: &Project, timestamp_ms: u64) -> Vec<HighlightBlockData> {
    let mut highlights = Vec::new();

    for track in &project.timeline.tracks {
        if track.track_type != TrackType::Highlight || !track.visible {
            continue;
        }

        // Binary search for the active block
        let idx = track
            .blocks
            .binary_search_by(|b| {
                if timestamp_ms < b.start_ms {
                    std::cmp::Ordering::Greater
                } else if timestamp_ms >= b.end_ms {
                    std::cmp::Ordering::Less
                } else {
                    std::cmp::Ordering::Equal
                }
            });

        match idx {
            Ok(i) => {
                if let BlockData::Highlight(ref data) = track.blocks[i].data {
                    highlights.push(data.clone());
                }
                // Look for adjacent blocks with same time range (ayah-level grouping)
                let ref_block = &track.blocks[i];
                for j in (i + 1)..track.blocks.len() {
                    if track.blocks[j].start_ms == ref_block.start_ms
                        && track.blocks[j].end_ms == ref_block.end_ms
                    {
                        if let BlockData::Highlight(ref data) = track.blocks[j].data {
                            highlights.push(data.clone());
                        }
                    } else {
                        break;
                    }
                }
                for j in (0..i).rev() {
                    if track.blocks[j].start_ms == ref_block.start_ms
                        && track.blocks[j].end_ms == ref_block.end_ms
                    {
                        if let BlockData::Highlight(ref data) = track.blocks[j].data {
                            highlights.insert(0, data.clone());
                        }
                    } else {
                        break;
                    }
                }
            }
            Err(_) => {
                // Check if we're in a gap close to the next word (< 500ms)
                // Mirror the rollingquran behavior
                let search_idx = track
                    .blocks
                    .partition_point(|b| b.start_ms <= timestamp_ms);
                if search_idx > 0 {
                    let prev = &track.blocks[search_idx - 1];
                    if timestamp_ms <= prev.end_ms + 500 {
                        if let BlockData::Highlight(ref data) = prev.data {
                            highlights.push(data.clone());
                        }
                    }
                }
            }
        }
    }

    highlights
}

/// Prepare all page images needed for a project, returning a cache.
pub fn prepare_page_cache(
    project: &Project,
    mushaf_dir: &Path,
) -> Result<HashMap<u16, (RgbaImage, PagePlacement)>> {
    let mut cache = HashMap::new();
    let mut pages_needed: Vec<u16> = Vec::new();

    for track in &project.timeline.tracks {
        if track.track_type == TrackType::MushafPage {
            for block in &track.blocks {
                if let BlockData::MushafPage(ref data) = block.data {
                    if !pages_needed.contains(&data.page) {
                        pages_needed.push(data.page);
                    }
                }
            }
        }
    }

    for page in pages_needed {
        let (img, placement) = prepare_page_image(Some(page), mushaf_dir)?;
        cache.insert(page, (img, placement));
    }

    Ok(cache)
}
