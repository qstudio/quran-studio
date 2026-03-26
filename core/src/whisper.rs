use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;

use rusqlite::Connection;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::alignment::WordTimestamp;
use crate::error::{CoreError, Result};
use crate::quran_data;
use crate::text_utils::{normalize_arabic, similarity};

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/// A single word segment from Whisper transcription.
#[derive(Debug, Clone)]
pub struct WhisperSegment {
    pub text: String,
    pub start_ms: u64,
    pub end_ms: u64,
}

/// Silence region detected in audio.
#[derive(Debug, Clone)]
#[allow(dead_code)]
struct Silence {
    start_ms: u64,
    end_ms: u64,
    duration_ms: u64,
    midpoint_ms: u64,
}

// ---------------------------------------------------------------------------
// Model management
// ---------------------------------------------------------------------------

const MODEL_FILENAME: &str = "ggml-base.bin";
const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";

/// Get the expected path for the Whisper model.
pub fn model_path(data_dir: &Path) -> PathBuf {
    data_dir.join("models").join(MODEL_FILENAME)
}

/// Check if the Whisper model is downloaded.
pub fn model_exists(data_dir: &Path) -> bool {
    let path = model_path(data_dir);
    path.exists() && path.metadata().map(|m| m.len() > 1_000_000).unwrap_or(false)
}

/// Download the Whisper model if not present.
pub fn ensure_model(
    data_dir: &Path,
    progress_cb: impl Fn(u64, u64),
) -> Result<PathBuf> {
    let path = model_path(data_dir);
    if path.exists() && path.metadata().map(|m| m.len() > 1_000_000).unwrap_or(false) {
        return Ok(path);
    }

    let models_dir = data_dir.join("models");
    fs::create_dir_all(&models_dir)?;

    let resp = ureq::get(MODEL_URL)
        .call()
        .map_err(|e| CoreError::Http(format!("Failed to download Whisper model: {}", e)))?;

    let total_bytes = resp
        .header("Content-Length")
        .and_then(|h| h.parse::<u64>().ok())
        .unwrap_or(0);

    let mut reader = resp.into_reader();
    let mut file = fs::File::create(&path)?;
    let mut downloaded: u64 = 0;
    let mut buf = vec![0u8; 64 * 1024];

    loop {
        let n = reader
            .read(&mut buf)
            .map_err(|e| CoreError::Http(format!("Download read error: {}", e)))?;
        if n == 0 {
            break;
        }
        std::io::Write::write_all(&mut file, &buf[..n])?;
        downloaded += n as u64;
        progress_cb(downloaded, total_bytes);
    }

    Ok(path)
}

// ---------------------------------------------------------------------------
// Silence detection (ported from rollingquran)
// ---------------------------------------------------------------------------

/// Detect silence regions in audio using FFmpeg silencedetect filter.
/// Uses the same parameters as rollingquran: noise=-20dB, duration=0.2s.
fn detect_silences(audio_path: &Path) -> Result<Vec<Silence>> {
    let result = Command::new("ffmpeg")
        .args([
            "-i", audio_path.to_str().unwrap_or_default(),
            "-af", "silencedetect=noise=-20dB:d=0.2",
            "-f", "null", "-",
        ])
        .output()
        .map_err(|e| CoreError::Audio(format!("Failed to run ffmpeg silencedetect: {}", e)))?;

    let stderr = String::from_utf8_lossy(&result.stderr);
    let mut silences = Vec::new();

    // Parse "silence_end: 1.234 | silence_duration: 0.567" lines
    for line in stderr.lines() {
        if let Some(rest) = line.strip_prefix("[silencedetect @") {
            if let Some(rest) = rest.split("silence_end: ").nth(1) {
                let parts: Vec<&str> = rest.split(" | silence_duration: ").collect();
                if parts.len() == 2 {
                    if let (Ok(end_s), Ok(dur_s)) = (
                        parts[0].trim().parse::<f64>(),
                        parts[1].trim().parse::<f64>(),
                    ) {
                        let start_s = end_s - dur_s;
                        silences.push(Silence {
                            start_ms: (start_s * 1000.0) as u64,
                            end_ms: (end_s * 1000.0) as u64,
                            duration_ms: (dur_s * 1000.0) as u64,
                            midpoint_ms: ((start_s + end_s) / 2.0 * 1000.0) as u64,
                        });
                    }
                }
            }
        }
    }

    Ok(silences)
}

/// Find recitation boundaries by skipping intro silence, Basmala, and outro.
/// Ported from rollingquran's _find_recitation_bounds().
fn find_recitation_bounds(silences: &[Silence], total_ms: u64, surah: u16) -> (u64, u64) {
    let mut recitation_start = 0u64;
    let mut recitation_end = total_ms;

    // Step 1: Find intro silence end
    for s in silences {
        if (s.start_ms < 10000 && s.duration_ms > 500)
            || (s.start_ms < 5000 && s.duration_ms > 200)
        {
            recitation_start = s.end_ms;
            break;
        }
    }

    // Step 2: Skip Basmala (for all chapters except Al-Fatihah and At-Tawbah)
    let has_basmala = surah != 1 && surah != 9;
    if has_basmala {
        let basmala_pauses: Vec<&Silence> = silences
            .iter()
            .filter(|s| s.start_ms > recitation_start && s.start_ms < recitation_start + 8000)
            .collect();

        if !basmala_pauses.is_empty() {
            let biggest = basmala_pauses.iter().max_by_key(|s| s.duration_ms).unwrap();
            let segment_before = biggest.start_ms.saturating_sub(recitation_start);
            if segment_before < 6000 {
                recitation_start = biggest.end_ms;
            }
        }
    }

    // Step 3: Find outro start (silence > 1s after 70% of audio)
    let threshold = (total_ms as f64 * 0.7) as u64;
    for s in silences.iter().rev() {
        if s.duration_ms > 1000 && s.start_ms > threshold {
            recitation_end = s.start_ms;
            break;
        }
    }

    (recitation_start, recitation_end)
}

/// Get audio duration in milliseconds using ffprobe.
fn get_audio_duration_ffprobe(audio_path: &Path) -> Result<u64> {
    let result = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            audio_path.to_str().unwrap_or_default(),
        ])
        .output()
        .map_err(|e| CoreError::Audio(format!("Failed to run ffprobe: {}", e)))?;

    let stdout = String::from_utf8_lossy(&result.stdout);
    let duration_s: f64 = stdout
        .trim()
        .parse()
        .map_err(|_| CoreError::Audio(format!("Failed to parse duration: {}", stdout.trim())))?;

    Ok((duration_s * 1000.0) as u64)
}

// ---------------------------------------------------------------------------
// Audio preprocessing
// ---------------------------------------------------------------------------

/// Convert audio to 16kHz mono WAV for Whisper using FFmpeg.
fn preprocess_audio(input_path: &Path) -> Result<PathBuf> {
    let output_path = std::env::temp_dir().join(format!(
        "whisper_input_{}.wav",
        uuid::Uuid::new_v4()
    ));

    let result = Command::new("ffmpeg")
        .args([
            "-y", "-i", input_path.to_str().unwrap_or_default(),
            "-ar", "16000", "-ac", "1", "-f", "wav",
            output_path.to_str().unwrap_or_default(),
        ])
        .output()
        .map_err(|e| CoreError::Audio(format!("Failed to run ffmpeg for audio preprocessing: {}", e)))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(CoreError::Audio(format!("Audio preprocessing failed: {}", stderr)));
    }

    Ok(output_path)
}

/// Load 16kHz mono WAV samples as f32 for Whisper.
fn load_wav_samples(wav_path: &Path) -> Result<Vec<f32>> {
    let mut file = fs::File::open(wav_path)?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf)?;

    if buf.len() < 44 {
        return Err(CoreError::Audio("WAV file too short".to_string()));
    }
    if &buf[0..4] != b"RIFF" || &buf[8..12] != b"WAVE" {
        return Err(CoreError::Audio("Invalid WAV file".to_string()));
    }

    // Find data chunk
    let mut pos = 12;
    while pos + 8 < buf.len() {
        let chunk_id = &buf[pos..pos + 4];
        let chunk_size = u32::from_le_bytes([buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]]) as usize;

        if chunk_id == b"data" {
            let data_start = pos + 8;
            let data_end = (data_start + chunk_size).min(buf.len());
            let data = &buf[data_start..data_end];

            let samples: Vec<f32> = data
                .chunks_exact(2)
                .map(|chunk| {
                    let sample = i16::from_le_bytes([chunk[0], chunk[1]]);
                    sample as f32 / 32768.0
                })
                .collect();

            return Ok(samples);
        }

        pos += 8 + chunk_size;
        if chunk_size % 2 == 1 {
            pos += 1;
        }
    }

    Err(CoreError::Audio("No data chunk found in WAV file".to_string()))
}

// ---------------------------------------------------------------------------
// Whisper transcription
// ---------------------------------------------------------------------------

/// Transcribe audio file using Whisper, returning word-level segments.
pub fn transcribe(
    model_path: &Path,
    audio_path: &Path,
    progress_cb: impl Fn(u32),
) -> Result<Vec<WhisperSegment>> {
    progress_cb(5);

    let wav_path = preprocess_audio(audio_path)?;
    progress_cb(15);

    let samples = load_wav_samples(&wav_path)?;
    progress_cb(20);

    let _ = fs::remove_file(&wav_path);

    let ctx = WhisperContext::new_with_params(
        model_path.to_str().unwrap_or_default(),
        WhisperContextParameters::default(),
    )
    .map_err(|e| CoreError::Audio(format!("Failed to load Whisper model: {}", e)))?;

    let mut state = ctx.create_state()
        .map_err(|e| CoreError::Audio(format!("Failed to create Whisper state: {}", e)))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("ar"));
    params.set_token_timestamps(true);
    params.set_max_len(1);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    progress_cb(25);

    state
        .full(params, &samples)
        .map_err(|e| CoreError::Audio(format!("Whisper transcription failed: {}", e)))?;

    progress_cb(80);

    let n_segments = state.full_n_segments();
    let mut segments = Vec::new();
    for i in 0..n_segments {
        if let Some(seg) = state.get_segment(i) {
            let text = seg.to_str_lossy().map(|s| s.to_string()).unwrap_or_default();
            let start_ms = (seg.start_timestamp() as u64) * 10;
            let end_ms = (seg.end_timestamp() as u64) * 10;

            let trimmed = text.trim().to_string();
            if !trimmed.is_empty() {
                segments.push(WhisperSegment { text: trimmed, start_ms, end_ms });
            }
        }
    }

    progress_cb(90);
    Ok(segments)
}

// ---------------------------------------------------------------------------
// Forced alignment (combines our word-level matching with rollingquran robustness)
// ---------------------------------------------------------------------------

/// Match Whisper segments to known Quranic words.
///
/// Strategy (matching rollingquran's approach with word-level enhancement):
/// 1. Count expected words per ayah from DB
/// 2. If Whisper detected >= 50% of expected words, use sequential word distribution
///    (assign first N Whisper words → ayah 1, next M → ayah 2, etc.)
/// 3. If < 50%, fall back to silence-based ayah segmentation
/// 4. Within each ayah, distribute timing across words evenly
pub fn align_to_quran(
    conn: &Connection,
    segments: &[WhisperSegment],
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
) -> Result<Vec<WordTimestamp>> {
    let db_words = quran_data::get_words(conn, surah, ayah_start, ayah_end)?;
    if db_words.is_empty() {
        return Err(CoreError::NotFound(format!(
            "No words found for surah {}, ayahs {}-{}", surah, ayah_start, ayah_end
        )));
    }

    if segments.is_empty() {
        return Ok(interpolate_even(&db_words, 0));
    }

    let total_expected = db_words.len();

    // Group DB words by ayah
    let mut ayah_word_counts: Vec<(u16, usize)> = Vec::new();
    let mut current_ayah: Option<u16> = None;
    let mut count = 0usize;
    for w in &db_words {
        if current_ayah == Some(w.ayah) {
            count += 1;
        } else {
            if let Some(ayah) = current_ayah {
                ayah_word_counts.push((ayah, count));
            }
            current_ayah = Some(w.ayah);
            count = 1;
        }
    }
    if let Some(ayah) = current_ayah {
        ayah_word_counts.push((ayah, count));
    }

    // Decide strategy: Whisper word distribution vs fallback
    let whisper_word_count = segments.len();
    let use_whisper = whisper_word_count >= total_expected / 2;

    // Build ayah time ranges
    let ayah_ranges: Vec<(u64, u64)> = if use_whisper {
        // Sequential word distribution (rollingquran approach)
        distribute_whisper_words_to_ayahs(segments, &ayah_word_counts)
    } else {
        // Fallback: even distribution across total time
        let total_start = segments.first().map(|s| s.start_ms).unwrap_or(0);
        let total_end = segments.last().map(|s| s.end_ms).unwrap_or(total_expected as u64 * 500);
        let num_ayahs = ayah_word_counts.len();
        even_ayah_ranges(total_start, total_end, num_ayahs)
    };

    // Build word-level timestamps: within each ayah, distribute timing evenly across words
    let mut result = Vec::with_capacity(db_words.len());
    let mut word_idx = 0;

    for (ayah_idx, (_ayah_num, word_count)) in ayah_word_counts.iter().enumerate() {
        let (ayah_start_ms, ayah_end_ms) = if ayah_idx < ayah_ranges.len() {
            ayah_ranges[ayah_idx]
        } else {
            // Past end of ranges — estimate
            let prev_end = ayah_ranges.last().map(|r| r.1).unwrap_or(0);
            (prev_end, prev_end + 3000)
        };

        let ayah_duration = ayah_end_ms.saturating_sub(ayah_start_ms);

        for wi in 0..*word_count {
            if word_idx >= db_words.len() {
                break;
            }
            let word = &db_words[word_idx];

            // Distribute time evenly across words in this ayah
            let word_start = ayah_start_ms + (wi as u64 * ayah_duration) / (*word_count as u64).max(1);
            let word_end = ayah_start_ms + ((wi as u64 + 1) * ayah_duration) / (*word_count as u64).max(1);

            result.push(WordTimestamp {
                surah: word.surah,
                ayah: word.ayah,
                word_position: word.word_position,
                start_ms: word_start,
                end_ms: word_end,
                page: word.page,
                x: word.x,
                y: word.y,
                width: word.width,
                height: word.height,
                text_uthmani: word.text_uthmani.clone(),
            });

            word_idx += 1;
        }
    }

    // If Whisper had good word-level data AND the match is strong,
    // try to refine individual word timestamps using text similarity
    if use_whisper && whisper_word_count >= (total_expected * 3) / 4 {
        refine_word_timestamps(&mut result, segments);
    }

    Ok(result)
}

/// Sequential word distribution: assign Whisper words to ayahs based on expected word counts.
/// Ported from rollingquran's _distribute_whisper_words_to_ayahs().
fn distribute_whisper_words_to_ayahs(
    segments: &[WhisperSegment],
    ayah_word_counts: &[(u16, usize)],
) -> Vec<(u64, u64)> {
    let mut ranges = Vec::new();
    let mut seg_idx = 0;

    for (_ayah, expected_count) in ayah_word_counts {
        if *expected_count == 0 {
            let prev_end = ranges.last().map(|r: &(u64, u64)| r.1).unwrap_or(0);
            ranges.push((prev_end, prev_end));
            continue;
        }

        let ayah_start = if seg_idx < segments.len() {
            segments[seg_idx].start_ms
        } else {
            ranges.last().map(|r: &(u64, u64)| r.1).unwrap_or(0)
        };

        let end_idx = (seg_idx + expected_count - 1).min(segments.len().saturating_sub(1));
        let ayah_end = if end_idx < segments.len() {
            segments[end_idx].end_ms
        } else {
            ayah_start + 3000 // Fallback: 3 seconds
        };

        ranges.push((ayah_start, ayah_end));
        seg_idx += expected_count;
    }

    ranges
}

/// Create evenly spaced ayah ranges (fallback when Whisper fails).
fn even_ayah_ranges(start_ms: u64, end_ms: u64, num_ayahs: usize) -> Vec<(u64, u64)> {
    if num_ayahs == 0 {
        return Vec::new();
    }
    let duration = end_ms.saturating_sub(start_ms);
    (0..num_ayahs)
        .map(|i| {
            let s = start_ms + (i as u64 * duration) / num_ayahs as u64;
            let e = start_ms + ((i as u64 + 1) * duration) / num_ayahs as u64;
            (s, e)
        })
        .collect()
}

/// Refine word-level timestamps using text similarity when Whisper output is strong.
/// Tries to match individual Whisper segments to specific words for more precise timing.
fn refine_word_timestamps(timestamps: &mut [WordTimestamp], segments: &[WhisperSegment]) {
    let seg_normalized: Vec<String> = segments.iter().map(|s| normalize_arabic(&s.text)).collect();
    let mut seg_idx = 0;

    for ts in timestamps.iter_mut() {
        let word_norm = normalize_arabic(&ts.text_uthmani);
        if word_norm.is_empty() {
            continue;
        }

        // Search forward in a small window
        let search_end = (seg_idx + 3).min(segments.len());
        let mut best_score = 0.0f64;
        let mut best_si = None;

        for (offset, seg_norm) in seg_normalized[seg_idx..search_end].iter().enumerate() {
            let score = similarity(&word_norm, seg_norm);
            if score > best_score {
                best_score = score;
                best_si = Some(seg_idx + offset);
            }
        }

        // Only override if the match is strong (>= 0.5 similarity)
        if best_score >= 0.5 {
            if let Some(si) = best_si {
                ts.start_ms = segments[si].start_ms;
                ts.end_ms = segments[si].end_ms;
                seg_idx = si + 1;
            }
        }
    }
}

/// Interpolate evenly spaced timestamps when no Whisper segments are available.
fn interpolate_even(words: &[quran_data::Word], total_duration_ms: u64) -> Vec<WordTimestamp> {
    let n = words.len() as u64;
    let duration = if total_duration_ms > 0 { total_duration_ms } else { n * 500 };

    words
        .iter()
        .enumerate()
        .map(|(i, word)| {
            let start_ms = (i as u64 * duration) / n;
            let end_ms = ((i as u64 + 1) * duration) / n;
            WordTimestamp {
                surah: word.surah, ayah: word.ayah, word_position: word.word_position,
                start_ms, end_ms,
                page: word.page, x: word.x, y: word.y, width: word.width, height: word.height,
                text_uthmani: word.text_uthmani.clone(),
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// High-level API
// ---------------------------------------------------------------------------

/// Transcribe + align custom audio in one call.
/// Includes silence detection and recitation boundary detection from rollingquran.
pub fn align_custom_audio(
    conn: &Connection,
    whisper_model: &Path,
    audio_path: &Path,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
    progress_cb: impl Fn(u32),
) -> Result<Vec<WordTimestamp>> {
    progress_cb(2);

    // Step 1: Detect silences (rollingquran approach)
    let _silences = detect_silences(audio_path).unwrap_or_default();
    let _total_ms = get_audio_duration_ffprobe(audio_path).unwrap_or(0);
    progress_cb(5);

    // Step 2: Transcribe with Whisper
    let mut segments = transcribe(whisper_model, audio_path, &progress_cb)?;
    progress_cb(90);

    // Step 3: Filter segments to recitation bounds if we have silence data
    if !_silences.is_empty() && _total_ms > 0 {
        let (rec_start, rec_end) = find_recitation_bounds(&_silences, _total_ms, surah);
        segments.retain(|s| s.start_ms + 500 >= rec_start && s.end_ms <= rec_end + 500);

        // Offset timestamps so recitation starts at 0
        if rec_start > 0 {
            for s in &mut segments {
                s.start_ms = s.start_ms.saturating_sub(rec_start);
                s.end_ms = s.end_ms.saturating_sub(rec_start);
            }
        }
    }

    // Step 4: Align to Quranic text
    let timestamps = align_to_quran(conn, &segments, surah, ayah_start, ayah_end)?;
    progress_cb(100);

    Ok(timestamps)
}
