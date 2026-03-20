use std::path::Path;

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

use crate::error::{CoreError, Result};

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
