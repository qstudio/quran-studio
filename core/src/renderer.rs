use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;

use crate::error::{CoreError, Result};
use crate::preview::{fractional_to_pixel, prepare_page_image, WordBBox};
use crate::project::{
    BlockData, CardType, ExportSettings, Project, ProjectMode, TextPosition, TrackType,
};

/// Export video using FFmpeg filter chain approach.
/// Dispatches to mode-specific export pipelines based on the project mode.
///
/// - **Mushaf**: Pre-generates highlight overlay PNGs, builds overlay filters.
/// - **Caption**: `drawtext` filters for Arabic subtitles over a solid background.
/// - **Reel**: Vertical (9:16) `drawtext` for Arabic + translation.
/// - **LongForm**: Horizontal (16:9) `drawtext` with optional title card.
pub fn export_video(
    project: &Project,
    settings: &ExportSettings,
    mushaf_dir: &Path,
    ffmpeg_path: &str,
    progress: Arc<AtomicU32>,
    cancel: Arc<AtomicBool>,
    output_dir: &Path,
) -> Result<PathBuf> {
    std::fs::create_dir_all(output_dir)?;

    match project.mode {
        ProjectMode::Mushaf => export_mushaf_video(
            project,
            settings,
            mushaf_dir,
            ffmpeg_path,
            progress,
            cancel,
            output_dir,
        ),
        ProjectMode::Caption => export_caption_video(
            project,
            settings,
            ffmpeg_path,
            output_dir,
            progress,
            cancel,
        ),
        ProjectMode::Reel => export_reel_video(
            project,
            settings,
            ffmpeg_path,
            output_dir,
            progress,
            cancel,
        ),
        ProjectMode::LongForm => export_longform_video(
            project,
            settings,
            ffmpeg_path,
            output_dir,
            progress,
            cancel,
        ),
    }
}

/// Mushaf mode export — the original pipeline with highlight overlays.
fn export_mushaf_video(
    project: &Project,
    settings: &ExportSettings,
    mushaf_dir: &Path,
    ffmpeg_path: &str,
    progress: Arc<AtomicU32>,
    cancel: Arc<AtomicBool>,
    output_dir: &Path,
) -> Result<PathBuf> {
    let output_path = output_dir.join(format!("{}.{}", project.id, settings.output_format));

    // Collect all pages and their time ranges
    let mut page_segments: Vec<PageSegment> = Vec::new();
    for track in &project.timeline.tracks {
        if track.track_type == TrackType::MushafPage {
            for block in &track.blocks {
                if let BlockData::MushafPage(ref data) = block.data {
                    page_segments.push(PageSegment {
                        page: data.page,
                        start_ms: block.start_ms,
                        end_ms: block.end_ms,
                    });
                }
            }
        }
    }

    if page_segments.is_empty() {
        return Err(CoreError::InvalidInput(
            "No mushaf pages in project".to_string(),
        ));
    }

    // Collect highlight data
    let mut highlights: Vec<HighlightOverlay> = Vec::new();
    for track in &project.timeline.tracks {
        if track.track_type == TrackType::Highlight && track.visible {
            for block in &track.blocks {
                if let BlockData::Highlight(ref data) = block.data {
                    highlights.push(HighlightOverlay {
                        page: data.page,
                        start_ms: block.start_ms,
                        end_ms: block.end_ms,
                        x: data.x as f64 / 100_000.0,
                        y: data.y as f64 / 100_000.0,
                        width: data.width as f64 / 100_000.0,
                        height: data.height as f64 / 100_000.0,
                    });
                }
            }
        }
    }

    // Find audio block
    let audio_info = find_audio_info(project);

    // Create temp directory for intermediate files
    let temp_dir = output_dir.join(format!(".tmp_{}", project.id));
    std::fs::create_dir_all(&temp_dir)?;

    let result = if page_segments.len() == 1 {
        export_single_page(
            &page_segments[0],
            &highlights,
            &audio_info,
            settings,
            mushaf_dir,
            ffmpeg_path,
            &temp_dir,
            &output_path,
            progress.clone(),
            cancel.clone(),
        )
    } else {
        export_multi_page(
            &page_segments,
            &highlights,
            &audio_info,
            settings,
            mushaf_dir,
            ffmpeg_path,
            &temp_dir,
            &output_path,
            progress.clone(),
            cancel.clone(),
        )
    };

    // Cleanup temp directory
    let _ = std::fs::remove_dir_all(&temp_dir);

    result?;
    Ok(output_path)
}

#[derive(Debug, Clone)]
struct PageSegment {
    page: u16,
    start_ms: u64,
    end_ms: u64,
}

#[derive(Debug, Clone)]
struct HighlightOverlay {
    page: u16,
    start_ms: u64,
    end_ms: u64,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

/// Export a single-page video using FFmpeg overlay filters.
#[allow(clippy::too_many_arguments)]
fn export_single_page(
    segment: &PageSegment,
    highlights: &[HighlightOverlay],
    audio_info: &Option<crate::project::AudioBlockData>,
    settings: &ExportSettings,
    mushaf_dir: &Path,
    ffmpeg_path: &str,
    temp_dir: &Path,
    output_path: &Path,
    progress: Arc<AtomicU32>,
    cancel: Arc<AtomicBool>,
) -> Result<()> {
    // Prepare page image
    let (page_img, placement) = prepare_page_image(Some(segment.page), mushaf_dir)?;

    // Save base page image
    let base_path = temp_dir.join("base.png");
    page_img
        .save(&base_path)
        .map_err(CoreError::Image)?;

    // Generate highlight overlay images
    let page_highlights: Vec<&HighlightOverlay> = highlights
        .iter()
        .filter(|h| h.page == segment.page)
        .collect();

    let mut overlay_paths: Vec<(PathBuf, f64, f64, i32, i32)> = Vec::new();
    for (i, h) in page_highlights.iter().enumerate() {
        if cancel.load(Ordering::Relaxed) {
            return Err(CoreError::ExportCancelled);
        }

        let bbox = fractional_to_pixel(h.x, h.y, h.width, h.height, &placement);
        let overlay = generate_highlight_overlay_png(&bbox, 10, 6);
        let overlay_path = temp_dir.join(format!("hl_{}.png", i));
        overlay
            .save(&overlay_path)
            .map_err(CoreError::Image)?;

        let start_s = h.start_ms as f64 / 1000.0;
        let end_s = h.end_ms as f64 / 1000.0;
        let draw_x = (bbox.x - 10).max(0);
        let draw_y = (bbox.y - 6).max(0);

        overlay_paths.push((overlay_path, start_s, end_s, draw_x, draw_y));
    }

    // Build FFmpeg command
    let duration_s = (segment.end_ms - segment.start_ms) as f64 / 1000.0;

    let mut cmd = Command::new(ffmpeg_path);
    cmd.arg("-y");

    // Input: base image as loop
    cmd.args(["-loop", "1", "-i", base_path.to_str().unwrap()]);

    // Input: overlay images
    for (path, _, _, _, _) in &overlay_paths {
        cmd.args(["-i", path.to_str().unwrap()]);
    }

    // Build filter complex
    let mut filter_parts: Vec<String> = Vec::new();
    let mut current_stream = "[0:v]".to_string();

    // Apply aspect ratio scaling
    let (out_w, out_h) = get_output_resolution(settings);
    filter_parts.push(format!(
        "{}scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:color=F5EFE3[scaled]",
        current_stream, out_w, out_h, out_w, out_h
    ));
    current_stream = "[scaled]".to_string();

    // Apply overlay filters for each highlight
    for (i, (_, start_s, end_s, x, y)) in overlay_paths.iter().enumerate() {
        let input_idx = i + 1;
        let out_label = format!("[ov{}]", i);
        filter_parts.push(format!(
            "{}[{}:v]overlay=x={}:y={}:enable='between(t,{:.3},{:.3})'{}",
            current_stream,
            input_idx,
            x,
            y,
            start_s,
            end_s,
            out_label
        ));
        current_stream = out_label;
    }

    if !filter_parts.is_empty() {
        let filter = filter_parts.join(";");
        cmd.args(["-filter_complex", &filter]);
    }

    // Map the final video stream
    if !overlay_paths.is_empty() {
        cmd.args(["-map", &current_stream]);
    }

    // Audio input if available
    let has_audio = if let Some(ref info) = audio_info {
        if let Some(ref apath) = info.audio_path {
            let p = std::path::Path::new(apath);
            if p.exists() {
                cmd.args(["-i", apath]);
                true
            } else {
                false
            }
        } else {
            false
        }
    } else {
        false
    };

    // Map the audio stream if present
    if has_audio {
        let audio_input_idx = 1 + overlay_paths.len();
        cmd.args(["-map", &format!("{}:a", audio_input_idx)]);
    }

    // Output settings
    if has_audio {
        cmd.arg("-shortest");
    }
    cmd.args(["-t", &format!("{:.3}", duration_s)]);
    apply_codec_settings(&mut cmd, settings);
    cmd.args(["-progress", "pipe:1"]);
    cmd.arg(output_path);

    run_ffmpeg_with_progress(cmd, duration_s, progress, cancel)?;

    Ok(())
}

/// Export multi-page video: render per-page segments, concat.
#[allow(clippy::too_many_arguments)]
fn export_multi_page(
    segments: &[PageSegment],
    highlights: &[HighlightOverlay],
    audio_info: &Option<crate::project::AudioBlockData>,
    settings: &ExportSettings,
    mushaf_dir: &Path,
    ffmpeg_path: &str,
    temp_dir: &Path,
    output_path: &Path,
    progress: Arc<AtomicU32>,
    cancel: Arc<AtomicBool>,
) -> Result<()> {
    let total_segments = segments.len();
    let mut segment_paths: Vec<PathBuf> = Vec::new();

    for (seg_idx, segment) in segments.iter().enumerate() {
        if cancel.load(Ordering::Relaxed) {
            return Err(CoreError::ExportCancelled);
        }

        let seg_output = temp_dir.join(format!("seg_{}.mp4", seg_idx));

        let seg_highlights: Vec<HighlightOverlay> = highlights
            .iter()
            .filter(|h| {
                h.page == segment.page && h.start_ms >= segment.start_ms && h.start_ms < segment.end_ms
            })
            .cloned()
            .collect();

        // Adjust timing to be relative to segment start
        let adjusted_highlights: Vec<HighlightOverlay> = seg_highlights
            .iter()
            .map(|h| HighlightOverlay {
                start_ms: h.start_ms - segment.start_ms,
                end_ms: (h.end_ms - segment.start_ms).min(segment.end_ms - segment.start_ms),
                ..*h
            })
            .collect();

        let adjusted_segment = PageSegment {
            start_ms: 0,
            end_ms: segment.end_ms - segment.start_ms,
            ..*segment
        };

        let seg_progress = Arc::new(AtomicU32::new(0));
        export_single_page(
            &adjusted_segment,
            &adjusted_highlights,
            &None,
            settings,
            mushaf_dir,
            ffmpeg_path,
            &temp_dir.join(format!("seg_{}_tmp", seg_idx)),
            &seg_output,
            seg_progress,
            cancel.clone(),
        )?;

        segment_paths.push(seg_output);

        let overall_pct = ((seg_idx + 1) as f64 / total_segments as f64 * 80.0) as u32;
        progress.store(overall_pct, Ordering::Relaxed);
    }

    // Concat segments
    let concat_list = temp_dir.join("concat.txt");
    let concat_content: String = segment_paths
        .iter()
        .map(|p| format!("file '{}'", p.display()))
        .collect::<Vec<_>>()
        .join("\n");
    std::fs::write(&concat_list, concat_content)?;

    let mut cmd = Command::new(ffmpeg_path);
    cmd.args([
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_list.to_str().unwrap(),
    ]);

    // Add audio if available
    let has_audio = if let Some(ref info) = audio_info {
        if let Some(ref apath) = info.audio_path {
            let p = std::path::Path::new(apath);
            if p.exists() {
                cmd.args(["-i", apath]);
                cmd.args(["-c:v", "copy", "-c:a", "aac", "-b:a", "128k"]);
                cmd.arg("-shortest");
                true
            } else {
                false
            }
        } else {
            false
        }
    } else {
        false
    };

    if !has_audio {
        cmd.args(["-c", "copy"]);
    }

    cmd.arg(output_path);

    let total_duration_s: f64 = segments.iter().map(|s| (s.end_ms - s.start_ms) as f64 / 1000.0).sum();
    run_ffmpeg_with_progress(cmd, total_duration_s, progress.clone(), cancel)?;

    progress.store(100, Ordering::Relaxed);
    Ok(())
}

/// Generate a highlight overlay PNG for a single word.
fn generate_highlight_overlay_png(bbox: &WordBBox, pad_x: i32, pad_y: i32) -> image::RgbaImage {
    let w = (bbox.width + 2 * pad_x) as u32;
    let h = (bbox.height + 2 * pad_y) as u32;

    let mut overlay = image::RgbaImage::from_pixel(w, h, image::Rgba([0, 0, 0, 0]));

    // Golden glow fill
    let fill = image::Rgba([255, 215, 0, 140]);
    imageproc::drawing::draw_filled_rect_mut(
        &mut overlay,
        imageproc::rect::Rect::at(0, 0).of_size(w, h),
        fill,
    );

    // Border
    let border = image::Rgba([215, 165, 0, 220]);
    for bw in 0..3u32 {
        // Top
        for x in 0..w {
            if bw < h {
                overlay.put_pixel(x, bw, border);
            }
        }
        // Bottom
        for x in 0..w {
            if h > bw {
                overlay.put_pixel(x, h - 1 - bw, border);
            }
        }
        // Left
        for y in 0..h {
            if bw < w {
                overlay.put_pixel(bw, y, border);
            }
        }
        // Right
        for y in 0..h {
            if w > bw {
                overlay.put_pixel(w - 1 - bw, y, border);
            }
        }
    }

    overlay
}

// ---------------------------------------------------------------------------
// Caption / Reel / LongForm export pipelines
// ---------------------------------------------------------------------------

/// Collected text block for drawtext-based export modes.
struct DrawTextBlock {
    text: String,
    start_s: f64,
    end_s: f64,
    font_size: u32,
    color: String,
    position: TextPosition,
    is_arabic: bool,
}

/// Collected card block for title/bismillah cards.
struct DrawCardBlock {
    text: String,
    start_s: f64,
    end_s: f64,
    background_color: String,
    text_color: String,
    card_type: CardType,
}

/// Find the audio block info from a project's timeline.
fn find_audio_info(project: &Project) -> Option<crate::project::AudioBlockData> {
    project.timeline.tracks.iter().find_map(|track| {
        if track.track_type == TrackType::Audio {
            track.blocks.first().and_then(|block| {
                if let BlockData::Audio(ref data) = block.data {
                    Some(data.clone())
                } else {
                    None
                }
            })
        } else {
            None
        }
    })
}

/// Collect all text blocks (Arabic + translation) from the project timeline.
fn collect_text_blocks(project: &Project) -> Vec<DrawTextBlock> {
    let mut blocks = Vec::new();
    for track in &project.timeline.tracks {
        if !track.visible {
            continue;
        }
        let is_arabic = track.track_type == TrackType::TextArabic;
        let is_translation = track.track_type == TrackType::TextTranslation;
        if !is_arabic && !is_translation {
            continue;
        }
        for block in &track.blocks {
            match &block.data {
                BlockData::TextArabic(ref data) | BlockData::TextTranslation(ref data) => {
                    blocks.push(DrawTextBlock {
                        text: data.text.clone(),
                        start_s: block.start_ms as f64 / 1000.0,
                        end_s: block.end_ms as f64 / 1000.0,
                        font_size: data.font_size,
                        color: data.color.clone(),
                        position: data.position.clone(),
                        is_arabic,
                    });
                }
                _ => {}
            }
        }
    }
    blocks
}

/// Collect card blocks from the timeline.
fn collect_card_blocks(project: &Project) -> Vec<DrawCardBlock> {
    let mut cards = Vec::new();
    for track in &project.timeline.tracks {
        if !track.visible || track.track_type != TrackType::Card {
            continue;
        }
        for block in &track.blocks {
            if let BlockData::Card(ref data) = block.data {
                cards.push(DrawCardBlock {
                    text: data.text.clone(),
                    start_s: block.start_ms as f64 / 1000.0,
                    end_s: block.end_ms as f64 / 1000.0,
                    background_color: data.background_color.clone(),
                    text_color: data.text_color.clone(),
                    card_type: data.card_type.clone(),
                });
            }
        }
    }
    cards
}

/// Resolve the background color from the project's background track, or a default.
fn resolve_background_color(project: &Project, default: &str) -> String {
    for track in &project.timeline.tracks {
        if track.track_type == TrackType::Background {
            if let Some(block) = track.blocks.first() {
                if let BlockData::Background(ref data) = block.data {
                    if let Some(ref color) = data.color {
                        return color.clone();
                    }
                }
            }
        }
    }
    default.to_string()
}

/// Escape text for FFmpeg drawtext filter.
/// FFmpeg drawtext requires escaping of `'`, `:`, `\`, and `[`/`]` within text.
fn ffmpeg_escape_text(text: &str) -> String {
    text.replace('\\', "\\\\\\\\")
        .replace('\'', "'\\''")
        .replace(':', "\\:")
        .replace('[', "\\[")
        .replace(']', "\\]")
}

/// Convert a TextPosition into a y-expression for FFmpeg drawtext.
fn position_to_y_expr(position: &TextPosition, is_arabic: bool) -> String {
    match position {
        TextPosition::Top => {
            if is_arabic {
                "h*0.15".to_string()
            } else {
                "h*0.22".to_string()
            }
        }
        TextPosition::Center => {
            if is_arabic {
                "(h-th)/2".to_string()
            } else {
                "(h+th)/2+20".to_string()
            }
        }
        TextPosition::Bottom => {
            if is_arabic {
                "h*0.70".to_string()
            } else {
                "h*0.78".to_string()
            }
        }
    }
}

/// Build the drawtext filter chain for a list of text blocks.
fn build_drawtext_filters(
    text_blocks: &[DrawTextBlock],
    font_path: &str,
) -> Vec<String> {
    let mut filters = Vec::new();
    for tb in text_blocks {
        let escaped = ffmpeg_escape_text(&tb.text);
        let y_expr = position_to_y_expr(&tb.position, tb.is_arabic);
        let filter = format!(
            "drawtext=text='{}':fontfile={}:fontsize={}:fontcolor={}:x=(w-tw)/2:y={}:enable='between(t,{:.3},{:.3})'",
            escaped,
            font_path,
            tb.font_size,
            tb.color,
            y_expr,
            tb.start_s,
            tb.end_s,
        );
        filters.push(filter);
    }
    filters
}

/// Build drawtext filters for card blocks (surah title, bismillah, etc.).
fn build_card_drawtext_filters(
    cards: &[DrawCardBlock],
    font_path: &str,
) -> Vec<String> {
    let mut filters = Vec::new();
    for card in cards {
        let escaped = ffmpeg_escape_text(&card.text);
        let font_size = match card.card_type {
            CardType::SurahTitle => 64,
            CardType::Bismillah => 48,
            CardType::AyahEnd => 36,
        };
        // Draw a semi-transparent box behind the card text
        let filter = format!(
            "drawtext=text='{}':fontfile={}:fontsize={}:fontcolor={}:x=(w-tw)/2:y=(h-th)/2:box=1:boxcolor={}@0.8:boxborderw=20:enable='between(t,{:.3},{:.3})'",
            escaped,
            font_path,
            font_size,
            card.text_color,
            card.background_color,
            card.start_s,
            card.end_s,
        );
        filters.push(filter);
    }
    filters
}

/// Add audio input and mapping to an FFmpeg command.
/// Returns `true` if audio was added.
fn add_audio_to_cmd(
    cmd: &mut Command,
    audio_info: &Option<crate::project::AudioBlockData>,
    audio_input_idx: usize,
) -> bool {
    if let Some(ref info) = audio_info {
        if let Some(ref apath) = info.audio_path {
            let p = std::path::Path::new(apath);
            if p.exists() {
                cmd.args(["-i", apath]);
                cmd.args(["-map", &format!("{}:a", audio_input_idx)]);
                return true;
            }
        }
    }
    false
}

/// Caption mode export: Arabic subtitles + optional translation over a solid background.
#[allow(clippy::too_many_arguments)]
fn export_caption_video(
    project: &Project,
    settings: &ExportSettings,
    ffmpeg_path: &str,
    output_dir: &Path,
    progress: Arc<AtomicU32>,
    cancel: Arc<AtomicBool>,
) -> Result<PathBuf> {
    let output_path = output_dir.join(format!("{}.{}", project.id, settings.output_format));
    let (out_w, out_h) = get_output_resolution(settings);
    let duration_s = project.timeline.duration_ms as f64 / 1000.0;
    let bg_color = resolve_background_color(project, "0x0A0A0A");
    let audio_info = find_audio_info(project);
    let text_blocks = collect_text_blocks(project);

    if text_blocks.is_empty() {
        return Err(CoreError::InvalidInput(
            "No text blocks in project for Caption export".to_string(),
        ));
    }

    // Default font path — Amiri for Arabic, fallback for translation
    let font_path = "/usr/share/fonts/truetype/amiri/Amiri-Regular.ttf";

    let mut cmd = Command::new(ffmpeg_path);
    cmd.arg("-y");

    // Color background as video source
    cmd.args([
        "-f", "lavfi",
        "-i",
        &format!("color=c={}:s={}x{}:r={}", bg_color, out_w, out_h, settings.fps),
    ]);

    // Build filter complex with drawtext chain
    let drawtext_filters = build_drawtext_filters(&text_blocks, font_path);
    if !drawtext_filters.is_empty() {
        let filter_chain = format!("[0:v]{}", drawtext_filters.join(","));
        cmd.args(["-filter_complex", &filter_chain]);
    }

    // Audio
    let has_audio = add_audio_to_cmd(&mut cmd, &audio_info, 1);

    // Output settings
    cmd.args(["-t", &format!("{:.3}", duration_s)]);
    if has_audio {
        cmd.arg("-shortest");
    }
    apply_codec_settings(&mut cmd, settings);
    cmd.args(["-progress", "pipe:1"]);
    cmd.arg(&output_path);

    run_ffmpeg_with_progress(cmd, duration_s, progress, cancel)?;

    Ok(output_path)
}

/// Reel mode export (9:16 vertical): Large centered Arabic text + smaller translation.
#[allow(clippy::too_many_arguments)]
fn export_reel_video(
    project: &Project,
    settings: &ExportSettings,
    ffmpeg_path: &str,
    output_dir: &Path,
    progress: Arc<AtomicU32>,
    cancel: Arc<AtomicBool>,
) -> Result<PathBuf> {
    let output_path = output_dir.join(format!("{}.{}", project.id, settings.output_format));
    let (out_w, out_h) = get_output_resolution(settings);
    let duration_s = project.timeline.duration_ms as f64 / 1000.0;
    let bg_color = resolve_background_color(project, "0x0A0A0A");
    let audio_info = find_audio_info(project);
    let text_blocks = collect_text_blocks(project);

    if text_blocks.is_empty() {
        return Err(CoreError::InvalidInput(
            "No text blocks in project for Reel export".to_string(),
        ));
    }

    let font_path = "/usr/share/fonts/truetype/amiri/Amiri-Regular.ttf";

    let mut cmd = Command::new(ffmpeg_path);
    cmd.arg("-y");

    // Color background — vertical 9:16
    cmd.args([
        "-f", "lavfi",
        "-i",
        &format!("color=c={}:s={}x{}:r={}", bg_color, out_w, out_h, settings.fps),
    ]);

    // Build drawtext filters — Reel uses larger Arabic text centered
    let mut filters: Vec<String> = Vec::new();
    for tb in &text_blocks {
        let escaped = ffmpeg_escape_text(&tb.text);
        let (font_size, y_expr) = if tb.is_arabic {
            // Large centered Arabic
            (tb.font_size.max(56), "(h-th)/2".to_string())
        } else {
            // Smaller translation below center
            (tb.font_size.min(32), "(h+th)/2+40".to_string())
        };
        filters.push(format!(
            "drawtext=text='{}':fontfile={}:fontsize={}:fontcolor={}:x=(w-tw)/2:y={}:enable='between(t,{:.3},{:.3})'",
            escaped,
            font_path,
            font_size,
            tb.color,
            y_expr,
            tb.start_s,
            tb.end_s,
        ));
    }

    if !filters.is_empty() {
        let filter_chain = format!("[0:v]{}", filters.join(","));
        cmd.args(["-filter_complex", &filter_chain]);
    }

    let has_audio = add_audio_to_cmd(&mut cmd, &audio_info, 1);

    cmd.args(["-t", &format!("{:.3}", duration_s)]);
    if has_audio {
        cmd.arg("-shortest");
    }
    apply_codec_settings(&mut cmd, settings);
    cmd.args(["-progress", "pipe:1"]);
    cmd.arg(&output_path);

    run_ffmpeg_with_progress(cmd, duration_s, progress, cancel)?;

    Ok(output_path)
}

/// LongForm mode export (16:9 horizontal): Title card + Arabic + translation text.
#[allow(clippy::too_many_arguments)]
fn export_longform_video(
    project: &Project,
    settings: &ExportSettings,
    ffmpeg_path: &str,
    output_dir: &Path,
    progress: Arc<AtomicU32>,
    cancel: Arc<AtomicBool>,
) -> Result<PathBuf> {
    let output_path = output_dir.join(format!("{}.{}", project.id, settings.output_format));
    let (out_w, out_h) = get_output_resolution(settings);
    let duration_s = project.timeline.duration_ms as f64 / 1000.0;
    let bg_color = resolve_background_color(project, "0x0A0A0A");
    let audio_info = find_audio_info(project);
    let text_blocks = collect_text_blocks(project);
    let card_blocks = collect_card_blocks(project);

    if text_blocks.is_empty() && card_blocks.is_empty() {
        return Err(CoreError::InvalidInput(
            "No text or card blocks in project for LongForm export".to_string(),
        ));
    }

    let font_path = "/usr/share/fonts/truetype/amiri/Amiri-Regular.ttf";

    let mut cmd = Command::new(ffmpeg_path);
    cmd.arg("-y");

    // Color background — horizontal 16:9
    cmd.args([
        "-f", "lavfi",
        "-i",
        &format!("color=c={}:s={}x{}:r={}", bg_color, out_w, out_h, settings.fps),
    ]);

    // Build combined filter chain: card drawtext + text drawtext
    let mut all_filters: Vec<String> = Vec::new();

    // Card filters first (e.g. surah title at the start)
    all_filters.extend(build_card_drawtext_filters(&card_blocks, font_path));

    // Text filters
    all_filters.extend(build_drawtext_filters(&text_blocks, font_path));

    if !all_filters.is_empty() {
        let filter_chain = format!("[0:v]{}", all_filters.join(","));
        cmd.args(["-filter_complex", &filter_chain]);
    }

    let has_audio = add_audio_to_cmd(&mut cmd, &audio_info, 1);

    cmd.args(["-t", &format!("{:.3}", duration_s)]);
    if has_audio {
        cmd.arg("-shortest");
    }
    apply_codec_settings(&mut cmd, settings);
    cmd.args(["-progress", "pipe:1"]);
    cmd.arg(&output_path);

    run_ffmpeg_with_progress(cmd, duration_s, progress, cancel)?;

    Ok(output_path)
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

fn get_output_resolution(settings: &ExportSettings) -> (u32, u32) {
    (settings.width, settings.height)
}

fn apply_codec_settings(cmd: &mut Command, settings: &ExportSettings) {
    cmd.args(["-c:v", &settings.video_codec, "-preset", "fast", "-crf", &settings.crf.to_string()]);

    cmd.args([
        "-c:a", &settings.audio_codec,
        "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        "-r", &settings.fps.to_string(),
    ]);
}

fn run_ffmpeg_with_progress(
    mut cmd: Command,
    total_duration_s: f64,
    progress: Arc<AtomicU32>,
    cancel: Arc<AtomicBool>,
) -> Result<()> {
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        CoreError::Ffmpeg(format!("Failed to start ffmpeg: {}", e))
    })?;

    // Parse progress from stdout (ffmpeg -progress pipe:1)
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if cancel.load(Ordering::Relaxed) {
                let _ = child.kill();
                return Err(CoreError::ExportCancelled);
            }

            if let Ok(line) = line {
                if let Some(time_str) = line.strip_prefix("out_time_ms=") {
                    if let Ok(time_us) = time_str.trim().parse::<i64>() {
                        let time_s = time_us as f64 / 1_000_000.0;
                        let pct = ((time_s / total_duration_s) * 95.0).min(95.0) as u32;
                        progress.store(pct, Ordering::Relaxed);
                    }
                }
            }
        }
    }

    let output = child.wait_with_output().map_err(|e| {
        CoreError::Ffmpeg(format!("ffmpeg process error: {}", e))
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let tail: String = stderr.chars().rev().take(500).collect::<String>().chars().rev().collect();
        return Err(CoreError::Ffmpeg(format!(
            "ffmpeg exited with code {:?}: {}",
            output.status.code(),
            tail
        )));
    }

    Ok(())
}
