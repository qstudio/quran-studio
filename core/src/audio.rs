use std::fs;
use std::io::Read;
use std::path::Path;
use std::process::Command;

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

use crate::error::{CoreError, Result};

// ---------------------------------------------------------------------------
// QDC reciter ID mapping
// ---------------------------------------------------------------------------

/// Map a string reciter ID (as stored in our SQLite DB) to the numeric QDC API
/// reciter ID.  The mapping is derived from `data/scripts/reciters.json`.
pub fn reciter_qdc_id(reciter_id: &str) -> Option<u32> {
    match reciter_id {
        "mishary" => Some(7),
        "sudais" => Some(3),
        "shuraim" => Some(10),
        "shatri" => Some(4),
        "husary" => Some(6),
        "abdulbaset" => Some(2),
        "abdulbaset_mujawwad" => Some(1),
        "hani" => Some(5),
        "minshawi" => Some(9),
        "dossari" => Some(97),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Audio download
// ---------------------------------------------------------------------------

const QDC_API_BASE: &str = "https://api.qurancdn.com/api/qdc";

/// Download a surah's audio file for the given reciter from the QDC API.
///
/// 1. Calls the QDC API to get the audio URL.
/// 2. Downloads the audio from that URL.
/// 3. Saves it to `output_path`.
pub fn download_audio(reciter_qdc_id: u32, surah: u16, output_path: &Path) -> Result<()> {
    // Step 1: get audio URL from QDC API
    let api_url = format!(
        "{}/audio/reciters/{}/audio_files?chapter={}",
        QDC_API_BASE, reciter_qdc_id, surah
    );

    let resp = ureq::get(&api_url)
        .call()
        .map_err(|e| CoreError::Http(format!("QDC API request failed: {}", e)))?;

    let body_str = resp
        .into_string()
        .map_err(|e| CoreError::Http(format!("Failed to read QDC API response: {}", e)))?;

    let body: serde_json::Value = serde_json::from_str(&body_str)
        .map_err(|e| CoreError::Http(format!("Failed to parse QDC API response: {}", e)))?;

    let audio_url = body["audio_files"]
        .as_array()
        .and_then(|files| files.first())
        .and_then(|f| f["audio_url"].as_str())
        .ok_or_else(|| {
            CoreError::Http(format!(
                "No audio URL found for QDC reciter {}, surah {}",
                reciter_qdc_id, surah
            ))
        })?
        .to_string();

    // Step 2: download the actual audio file
    let audio_resp = ureq::get(&audio_url)
        .call()
        .map_err(|e| CoreError::Http(format!("Audio download failed: {}", e)))?;

    // Step 3: save to output_path
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut bytes = Vec::new();
    audio_resp
        .into_reader()
        .read_to_end(&mut bytes)
        .map_err(|e| CoreError::Http(format!("Failed to read audio response: {}", e)))?;

    fs::write(output_path, &bytes)?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Audio trimming
// ---------------------------------------------------------------------------

/// Trim an audio file to a time range using ffmpeg.
///
/// Runs: `ffmpeg -y -i input -ss {start_s} -t {duration_s} -c:a libmp3lame -q:a 2 output`
pub fn trim_audio(input: &Path, start_ms: u64, end_ms: u64, output: &Path) -> Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }

    let start_s = start_ms as f64 / 1000.0;
    let duration_s = (end_ms - start_ms) as f64 / 1000.0;

    let result = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            input.to_str().unwrap_or_default(),
            "-ss",
            &format!("{:.3}", start_s),
            "-t",
            &format!("{:.3}", duration_s),
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            output.to_str().unwrap_or_default(),
        ])
        .output()
        .map_err(|e| CoreError::Ffmpeg(format!("Failed to run ffmpeg for audio trim: {}", e)))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(CoreError::Ffmpeg(format!(
            "ffmpeg audio trim failed: {}",
            stderr
        )));
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Waveform computation
// ---------------------------------------------------------------------------

/// Compute a waveform from an audio file, returning amplitude peaks.
/// Uses symphonia to decode the audio and downsamples to the requested
/// number of peaks for UI visualization.
pub fn compute_waveform(audio_path: &Path, num_peaks: usize) -> Result<Vec<f32>> {
    if num_peaks == 0 {
        return Ok(Vec::new());
    }

    let file = std::fs::File::open(audio_path)?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = audio_path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| CoreError::Audio(format!("Failed to probe audio: {}", e)))?;

    let mut format = probed.format;

    let track = format
        .default_track()
        .ok_or_else(|| CoreError::Audio("No audio track found".to_string()))?;

    let track_id = track.id;
    let _sample_rate = track
        .codec_params
        .sample_rate
        .ok_or_else(|| CoreError::Audio("Unknown sample rate".to_string()))?;
    let channels = track
        .codec_params
        .channels
        .map(|c| c.count())
        .unwrap_or(1);

    let decoder_opts = DecoderOptions::default();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &decoder_opts)
        .map_err(|e| CoreError::Audio(format!("Failed to create decoder: {}", e)))?;

    // Decode all samples
    let mut all_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(symphonia::core::errors::Error::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(symphonia::core::errors::Error::ResetRequired) => {
                break;
            }
            Err(e) => {
                return Err(CoreError::Audio(format!(
                    "Failed to read packet: {}",
                    e
                )));
            }
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(e) => {
                return Err(CoreError::Audio(format!(
                    "Failed to decode packet: {}",
                    e
                )));
            }
        };

        let spec = *decoded.spec();
        let num_frames = decoded.capacity();

        let mut sample_buf = SampleBuffer::<f32>::new(num_frames as u64, spec);
        sample_buf.copy_interleaved_ref(decoded);

        let samples = sample_buf.samples();

        // Mix to mono if multi-channel
        if channels > 1 {
            for chunk in samples.chunks(channels) {
                let sum: f32 = chunk.iter().sum();
                all_samples.push(sum / channels as f32);
            }
        } else {
            all_samples.extend_from_slice(samples);
        }
    }

    if all_samples.is_empty() {
        return Ok(vec![0.0; num_peaks]);
    }

    // Downsample to requested number of peaks
    let samples_per_peak = all_samples.len() / num_peaks;
    if samples_per_peak == 0 {
        // Fewer samples than peaks requested
        let mut peaks = all_samples.iter().map(|s| s.abs()).collect::<Vec<_>>();
        peaks.resize(num_peaks, 0.0);
        return Ok(peaks);
    }

    let mut peaks = Vec::with_capacity(num_peaks);
    for i in 0..num_peaks {
        let start = i * samples_per_peak;
        let end = ((i + 1) * samples_per_peak).min(all_samples.len());
        let chunk = &all_samples[start..end];

        // Peak = max absolute value in chunk
        let peak = chunk.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
        peaks.push(peak);
    }

    // Normalize to 0.0-1.0
    let max_peak = peaks.iter().cloned().fold(0.0f32, f32::max);
    if max_peak > 0.0 {
        for p in &mut peaks {
            *p /= max_peak;
        }
    }

    Ok(peaks)
}

/// Get audio duration in milliseconds using symphonia.
pub fn get_audio_duration_ms(audio_path: &Path) -> Result<i64> {
    let file = std::fs::File::open(audio_path)?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = audio_path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| CoreError::Audio(format!("Failed to probe audio: {}", e)))?;

    let format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| CoreError::Audio("No audio track found".to_string()))?;

    let sample_rate = track
        .codec_params
        .sample_rate
        .ok_or_else(|| CoreError::Audio("Unknown sample rate".to_string()))?;

    let n_frames = track
        .codec_params
        .n_frames
        .ok_or_else(|| CoreError::Audio("Unknown duration".to_string()))?;

    let duration_ms = (n_frames as f64 / sample_rate as f64 * 1000.0) as i64;
    Ok(duration_ms)
}
