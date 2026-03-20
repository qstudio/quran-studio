use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;

use crate::error::{CoreError, Result};
use crate::preview::{fractional_to_pixel, prepare_page_image, WordBBox};
use crate::project::{BlockData, ExportSettings, Project, TrackType};

/// Export video using FFmpeg filter chain approach.
/// Pre-generates highlight overlay PNGs for each word,
/// then builds an FFmpeg command with overlay filters.
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
    let audio_info = project.timeline.tracks.iter().find_map(|track| {
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
    });

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
        .map_err(|e| CoreError::Image(e))?;

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
            .map_err(|e| CoreError::Image(e))?;

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
    if audio_info.is_some() {
        // Audio would be added here when audio file path is available
    }

    // Output settings
    cmd.args(["-t", &format!("{:.3}", duration_s)]);
    apply_codec_settings(&mut cmd, settings);
    cmd.args(["-progress", "pipe:1"]);
    cmd.arg(output_path);

    run_ffmpeg_with_progress(cmd, duration_s, progress, cancel)?;

    Ok(())
}

/// Export multi-page video: render per-page segments, concat.
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
        "-c", "copy",
    ]);

    // Add audio if available
    if audio_info.is_some() {
        // Audio would be muxed here
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
