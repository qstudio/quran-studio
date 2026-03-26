use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::alignment::load_alignment;
use crate::audio;
use crate::quran_data;
use crate::CoreError;

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub mode: ProjectMode,
    pub surah: u16,
    pub ayah_start: u16,
    pub ayah_end: u16,
    pub reciter_id: String,
    pub timeline: Timeline,
    pub export_settings: ExportSettings,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProjectMode {
    Mushaf,
    Caption,
    Reel,
    LongForm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timeline {
    pub duration_ms: u64,
    pub tracks: Vec<Track>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub name: String,
    pub track_type: TrackType,
    pub blocks: Vec<Block>,
    pub visible: bool,
    pub locked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TrackType {
    Audio,
    MushafPage,
    Highlight,
    Video,
    TextArabic,
    TextTranslation,
    Background,
    Card,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub id: String,
    pub start_ms: u64,
    pub end_ms: u64,
    pub data: BlockData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BlockData {
    Audio(AudioBlockData),
    MushafPage(MushafPageBlockData),
    Highlight(HighlightBlockData),
    Video(VideoBlockData),
    TextArabic(TextBlockData),
    TextTranslation(TextBlockData),
    Background(BackgroundBlockData),
    Card(CardBlockData),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioBlockData {
    pub reciter_id: String,
    pub surah: u16,
    pub audio_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MushafPageBlockData {
    pub page: u16,
    /// Path relative to data dir: "mushaf/page_XXX.png"
    pub image_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightBlockData {
    pub surah: u16,
    pub ayah: u16,
    pub word_position: u16,
    pub page: u16,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub text_uthmani: String,
    pub style: HighlightStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoBlockData {
    pub video_path: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextPosition {
    Top,
    Center,
    Bottom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextBackground {
    pub color: String,
    pub opacity: f32,
    pub padding: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextBlockData {
    pub text: String,
    pub surah: u16,
    pub ayah: u16,
    pub language: String,
    pub font_size: u32,
    pub color: String,
    pub position: TextPosition,
    pub background: Option<TextBackground>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundBlockData {
    pub image_path: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardType {
    SurahTitle,
    Bismillah,
    AyahEnd,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardBlockData {
    pub card_type: CardType,
    pub text: String,
    pub background_color: String,
    pub text_color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightStyle {
    pub highlight_type: HighlightType,
    pub color: String,
    pub opacity: f32,
    pub border_radius: u32,
    pub padding: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HighlightType {
    GoldenGlow,
    BlueBox,
    Underline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSettings {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub video_codec: String,
    pub audio_codec: String,
    pub crf: u32,
    pub output_format: String,
    pub output_path: Option<String>,
}

impl Default for ExportSettings {
    fn default() -> Self {
        Self {
            width: 1080,
            height: 1920,
            fps: 30,
            video_codec: "libx264".to_string(),
            audio_codec: "aac".to_string(),
            crf: 18,
            output_format: "mp4".to_string(),
            output_path: None,
        }
    }
}

impl Default for HighlightStyle {
    fn default() -> Self {
        Self {
            highlight_type: HighlightType::GoldenGlow,
            color: "#FFD700".to_string(),
            opacity: 0.45,
            border_radius: 4,
            padding: 4,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub mode: ProjectMode,
    pub surah: u16,
    pub reciter_id: String,
    pub duration_ms: u64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// AI project builder
// ---------------------------------------------------------------------------

/// Automatically build a complete Mushaf-mode project from the given parameters.
/// This is the "AI builder" that populates the entire timeline with:
///   1. An audio track spanning the full recitation
///   2. Mushaf page blocks for each page covered by the ayah range
///   3. Per-word highlight blocks from the alignment data
pub fn build_mushaf_project(
    conn: &Connection,
    reciter_id: &str,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
    data_dir: Option<&Path>,
) -> Result<Project, CoreError> {
    // Load alignment data (timing + word coordinates)
    let mut timestamps = load_alignment(conn, reciter_id, surah, ayah_start, ayah_end)?;

    if timestamps.is_empty() {
        return Err(CoreError::NotFound(format!(
            "No alignment data found for reciter '{}', surah {}, ayahs {}-{}",
            reciter_id, surah, ayah_start, ayah_end
        )));
    }

    // Determine if this is a partial ayah range (not the full surah)
    let surah_info_list = quran_data::list_surahs();
    let total_ayahs = surah_info_list
        .get((surah as usize).wrapping_sub(1))
        .map(|s| s.total_ayahs)
        .unwrap_or(0);
    let is_partial = ayah_start > 1 || ayah_end < total_ayahs;

    // Calculate timestamp offset for partial ranges
    let offset_ms = if is_partial {
        timestamps[0].start_ms
    } else {
        0
    };

    // Adjust all timestamps by subtracting the offset so the timeline starts at 0
    if offset_ms > 0 {
        for t in &mut timestamps {
            t.start_ms = t.start_ms.saturating_sub(offset_ms);
            t.end_ms = t.end_ms.saturating_sub(offset_ms);
        }
    }

    // Determine total duration from adjusted alignment data
    let total_duration_ms = timestamps
        .iter()
        .map(|t| t.end_ms)
        .max()
        .unwrap_or(0);

    // Collect distinct pages in order
    let pages: Vec<u16> = {
        let mut set = BTreeSet::new();
        for t in &timestamps {
            set.insert(t.page);
        }
        set.into_iter().collect()
    };

    // Resolve audio file path: download if not present, trim if partial range
    let audio_path: Option<String> = if let Some(dir) = data_dir {
        let full_audio_path = dir.join(format!("audio/{}/{:03}.mp3", reciter_id, surah));

        // Download audio if it does not exist
        if !full_audio_path.exists() {
            if let Some(qdc_id) = audio::reciter_qdc_id(reciter_id) {
                audio::download_audio(qdc_id, surah, &full_audio_path)?;
            }
        }

        if full_audio_path.exists() {
            if is_partial && offset_ms > 0 {
                // Trim audio to the ayah range
                let project_id = Uuid::new_v4().to_string();
                let projects_dir = dir.join("projects");
                fs::create_dir_all(&projects_dir)?;
                let trimmed_path =
                    projects_dir.join(format!("audio_{}.mp3", project_id));

                let trim_start = offset_ms;
                let trim_end = offset_ms + total_duration_ms;
                audio::trim_audio(&full_audio_path, trim_start, trim_end, &trimmed_path)?;

                Some(trimmed_path.to_string_lossy().into_owned())
            } else {
                Some(full_audio_path.to_string_lossy().into_owned())
            }
        } else {
            None
        }
    } else {
        None
    };

    // Build audio track
    let audio_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Audio".to_string(),
        track_type: TrackType::Audio,
        blocks: vec![Block {
            id: Uuid::new_v4().to_string(),
            start_ms: 0,
            end_ms: total_duration_ms,
            data: BlockData::Audio(AudioBlockData {
                reciter_id: reciter_id.to_string(),
                surah,
                audio_path,
            }),
        }],
        visible: true,
        locked: false,
    };

    // Build mushaf page blocks. Each page block spans from the first word on
    // that page to the last word on that page (based on alignment timing).
    let mut page_blocks = Vec::new();
    for &page in &pages {
        let page_timestamps: Vec<_> = timestamps.iter().filter(|t| t.page == page).collect();
        if page_timestamps.is_empty() {
            continue;
        }
        let page_start = page_timestamps.iter().map(|t| t.start_ms).min().unwrap();
        let page_end = page_timestamps.iter().map(|t| t.end_ms).max().unwrap();

        page_blocks.push(Block {
            id: Uuid::new_v4().to_string(),
            start_ms: page_start,
            end_ms: page_end,
            data: BlockData::MushafPage(MushafPageBlockData {
                page,
                image_path: format!("mushaf/page_{:03}.png", page),
            }),
        });
    }

    let page_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Mushaf Pages".to_string(),
        track_type: TrackType::MushafPage,
        blocks: page_blocks,
        visible: true,
        locked: false,
    };

    // Build highlight blocks (one per word)
    let highlight_blocks: Vec<Block> = timestamps
        .iter()
        .map(|t| Block {
            id: Uuid::new_v4().to_string(),
            start_ms: t.start_ms,
            end_ms: t.end_ms,
            data: BlockData::Highlight(HighlightBlockData {
                surah: t.surah,
                ayah: t.ayah,
                word_position: t.word_position,
                page: t.page,
                x: t.x,
                y: t.y,
                width: t.width,
                height: t.height,
                text_uthmani: t.text_uthmani.clone(),
                style: HighlightStyle::default(),
            }),
        })
        .collect();

    let highlight_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Highlights".to_string(),
        track_type: TrackType::Highlight,
        blocks: highlight_blocks,
        visible: true,
        locked: false,
    };

    let surahs = quran_data::list_surahs();
    let surah_info = surahs
        .get((surah as usize).wrapping_sub(1))
        .map(|s| s.name_english.clone())
        .unwrap_or_else(|| format!("Surah {}", surah));

    let name = if ayah_start == ayah_end {
        format!("{} - Ayah {}", surah_info, ayah_start)
    } else {
        format!("{} - Ayahs {}-{}", surah_info, ayah_start, ayah_end)
    };

    let now = Utc::now();
    let project = Project {
        id: Uuid::new_v4().to_string(),
        name,
        mode: ProjectMode::Mushaf,
        surah,
        ayah_start,
        ayah_end,
        reciter_id: reciter_id.to_string(),
        timeline: Timeline {
            duration_ms: total_duration_ms,
            tracks: vec![audio_track, page_track, highlight_track],
        },
        export_settings: ExportSettings::default(),
        created_at: now,
        updated_at: now,
    };

    Ok(project)
}

// ---------------------------------------------------------------------------
// Shared helpers for project builders
// ---------------------------------------------------------------------------

use crate::alignment::WordTimestamp;

/// Load alignment data and apply offset for partial ayah ranges.
fn load_and_offset_timestamps(
    conn: &Connection,
    reciter_id: &str,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
) -> Result<(Vec<WordTimestamp>, u64), CoreError> {
    let mut timestamps = load_alignment(conn, reciter_id, surah, ayah_start, ayah_end)?;
    if timestamps.is_empty() {
        return Err(CoreError::NotFound(format!(
            "No alignment data found for reciter '{}', surah {}, ayahs {}-{}",
            reciter_id, surah, ayah_start, ayah_end
        )));
    }

    let surah_info_list = quran_data::list_surahs();
    let total_ayahs = surah_info_list
        .get((surah as usize).wrapping_sub(1))
        .map(|s| s.total_ayahs)
        .unwrap_or(0);
    let is_partial = ayah_start > 1 || ayah_end < total_ayahs;
    let offset_ms = if is_partial { timestamps[0].start_ms } else { 0 };

    if offset_ms > 0 {
        for t in &mut timestamps {
            t.start_ms = t.start_ms.saturating_sub(offset_ms);
            t.end_ms = t.end_ms.saturating_sub(offset_ms);
        }
    }

    let total_duration_ms = timestamps.iter().map(|t| t.end_ms).max().unwrap_or(0);
    Ok((timestamps, total_duration_ms))
}

/// Build a project name from surah and ayah range.
fn build_project_name(surah: u16, ayah_start: u16, ayah_end: u16) -> String {
    let surahs = quran_data::list_surahs();
    let surah_name = surahs
        .get((surah as usize).wrapping_sub(1))
        .map(|s| s.name_english.clone())
        .unwrap_or_else(|| format!("Surah {}", surah));

    if ayah_start == ayah_end {
        format!("{} - Ayah {}", surah_name, ayah_start)
    } else {
        format!("{} - Ayahs {}-{}", surah_name, ayah_start, ayah_end)
    }
}

/// Build an audio track block.
fn build_audio_track(reciter_id: &str, surah: u16, audio_path: Option<String>, duration_ms: u64) -> Track {
    Track {
        id: Uuid::new_v4().to_string(),
        name: "Audio".to_string(),
        track_type: TrackType::Audio,
        blocks: vec![Block {
            id: Uuid::new_v4().to_string(),
            start_ms: 0,
            end_ms: duration_ms,
            data: BlockData::Audio(AudioBlockData {
                reciter_id: reciter_id.to_string(),
                surah,
                audio_path,
            }),
        }],
        visible: true,
        locked: false,
    }
}

/// Resolve audio file path: download if missing, trim if partial range.
fn resolve_audio_path(
    reciter_id: &str,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
    total_duration_ms: u64,
    offset_ms: u64,
    data_dir: Option<&Path>,
) -> Result<Option<String>, CoreError> {
    let Some(dir) = data_dir else { return Ok(None) };

    let full_audio_path = dir.join(format!("audio/{}/{:03}.mp3", reciter_id, surah));

    if !full_audio_path.exists() {
        if let Some(qdc_id) = audio::reciter_qdc_id(reciter_id) {
            audio::download_audio(qdc_id, surah, &full_audio_path)?;
        }
    }

    if !full_audio_path.exists() {
        return Ok(None);
    }

    let surah_info_list = quran_data::list_surahs();
    let total_ayahs = surah_info_list
        .get((surah as usize).wrapping_sub(1))
        .map(|s| s.total_ayahs)
        .unwrap_or(0);
    let is_partial = ayah_start > 1 || ayah_end < total_ayahs;

    if is_partial && offset_ms > 0 {
        let project_id = Uuid::new_v4().to_string();
        let projects_dir = dir.join("projects");
        fs::create_dir_all(&projects_dir)?;
        let trimmed_path = projects_dir.join(format!("audio_{}.mp3", project_id));
        audio::trim_audio(&full_audio_path, offset_ms, offset_ms + total_duration_ms, &trimmed_path)?;
        Ok(Some(trimmed_path.to_string_lossy().into_owned()))
    } else {
        Ok(Some(full_audio_path.to_string_lossy().into_owned()))
    }
}

/// Build Arabic text blocks (one per ayah) from alignment timestamps.
fn build_ayah_text_blocks(timestamps: &[WordTimestamp], surah: u16, language: &str, position: TextPosition) -> Vec<Block> {
    let mut blocks = Vec::new();
    let mut current_ayah: Option<u16> = None;
    let mut ayah_start_ms = 0u64;
    let mut ayah_text = String::new();

    for t in timestamps {
        if current_ayah != Some(t.ayah) {
            // Flush previous ayah
            if let Some(ayah) = current_ayah {
                let end_ms = t.start_ms;
                blocks.push(Block {
                    id: Uuid::new_v4().to_string(),
                    start_ms: ayah_start_ms,
                    end_ms,
                    data: BlockData::TextArabic(TextBlockData {
                        text: ayah_text.trim().to_string(),
                        surah,
                        ayah,
                        language: language.to_string(),
                        font_size: 48,
                        color: "#FFFFFF".to_string(),
                        position: position.clone(),
                        background: None,
                    }),
                });
                ayah_text.clear();
            }
            current_ayah = Some(t.ayah);
            ayah_start_ms = t.start_ms;
        }
        if !ayah_text.is_empty() {
            ayah_text.push(' ');
        }
        ayah_text.push_str(&t.text_uthmani);
    }

    // Flush last ayah
    if let Some(ayah) = current_ayah {
        let end_ms = timestamps.last().map(|t| t.end_ms).unwrap_or(ayah_start_ms);
        blocks.push(Block {
            id: Uuid::new_v4().to_string(),
            start_ms: ayah_start_ms,
            end_ms,
            data: BlockData::TextArabic(TextBlockData {
                text: ayah_text.trim().to_string(),
                surah,
                ayah,
                language: language.to_string(),
                font_size: 48,
                color: "#FFFFFF".to_string(),
                position: position.clone(),
                background: None,
            }),
        });
    }

    blocks
}

/// Build translation text blocks from translation data, synced to Arabic ayah timing.
fn build_translation_blocks(
    arabic_blocks: &[Block],
    conn: &Connection,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
) -> Vec<Block> {
    let translations = quran_data::get_translations(conn, surah, ayah_start, ayah_end, "en")
        .unwrap_or_default();

    arabic_blocks
        .iter()
        .filter_map(|ab| {
            let ayah = match &ab.data {
                BlockData::TextArabic(d) => d.ayah,
                _ => return None,
            };
            let text = translations
                .iter()
                .find(|t| t.ayah == ayah)
                .map(|t| t.text.clone())
                .unwrap_or_default();
            if text.is_empty() {
                return None;
            }
            Some(Block {
                id: Uuid::new_v4().to_string(),
                start_ms: ab.start_ms,
                end_ms: ab.end_ms,
                data: BlockData::TextTranslation(TextBlockData {
                    text,
                    surah,
                    ayah,
                    language: "en".to_string(),
                    font_size: 24,
                    color: "#A0A0A0".to_string(),
                    position: TextPosition::Bottom,
                    background: None,
                }),
            })
        })
        .collect()
}

/// Build highlight blocks (one per word) from timestamps — reused by Reel and LongForm.
fn build_highlight_blocks(timestamps: &[WordTimestamp]) -> Vec<Block> {
    timestamps
        .iter()
        .map(|t| Block {
            id: Uuid::new_v4().to_string(),
            start_ms: t.start_ms,
            end_ms: t.end_ms,
            data: BlockData::Highlight(HighlightBlockData {
                surah: t.surah,
                ayah: t.ayah,
                word_position: t.word_position,
                page: t.page,
                x: t.x,
                y: t.y,
                width: t.width,
                height: t.height,
                text_uthmani: t.text_uthmani.clone(),
                style: HighlightStyle::default(),
            }),
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Caption mode builder
// ---------------------------------------------------------------------------

/// Build a Caption-mode project (subtitle overlay):
///   1. Audio track
///   2. Arabic text track (one block per ayah)
///   3. Translation text track (one block per ayah)
pub fn build_caption_project(
    conn: &Connection,
    reciter_id: &str,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
    data_dir: Option<&Path>,
) -> Result<Project, CoreError> {
    let (timestamps, total_duration_ms) =
        load_and_offset_timestamps(conn, reciter_id, surah, ayah_start, ayah_end)?;
    let offset_ms = if timestamps[0].start_ms == 0 { 0 } else { timestamps[0].start_ms };

    let audio_path = resolve_audio_path(reciter_id, surah, ayah_start, ayah_end, total_duration_ms, offset_ms, data_dir)?;
    let audio_track = build_audio_track(reciter_id, surah, audio_path, total_duration_ms);

    let arabic_blocks = build_ayah_text_blocks(&timestamps, surah, "ar", TextPosition::Bottom);
    let arabic_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Arabic Text".to_string(),
        track_type: TrackType::TextArabic,
        blocks: arabic_blocks.clone(),
        visible: true,
        locked: false,
    };

    let translation_blocks = build_translation_blocks(&arabic_blocks, conn, surah, ayah_start, ayah_end);
    let translation_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Translation".to_string(),
        track_type: TrackType::TextTranslation,
        blocks: translation_blocks,
        visible: true,
        locked: false,
    };

    let name = build_project_name(surah, ayah_start, ayah_end);
    let now = Utc::now();
    Ok(Project {
        id: Uuid::new_v4().to_string(),
        name,
        mode: ProjectMode::Caption,
        surah,
        ayah_start,
        ayah_end,
        reciter_id: reciter_id.to_string(),
        timeline: Timeline {
            duration_ms: total_duration_ms,
            tracks: vec![audio_track, arabic_track, translation_track],
        },
        export_settings: ExportSettings::default(),
        created_at: now,
        updated_at: now,
    })
}

// ---------------------------------------------------------------------------
// Reel mode builder
// ---------------------------------------------------------------------------

/// Build a Reel-mode project (9:16 vertical, one ayah at a time):
///   1. Background track
///   2. Audio track
///   3. Arabic text track (one block per ayah, centered)
///   4. Highlight track (word-level karaoke)
///   5. Translation track
pub fn build_reel_project(
    conn: &Connection,
    reciter_id: &str,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
    data_dir: Option<&Path>,
) -> Result<Project, CoreError> {
    let (timestamps, total_duration_ms) =
        load_and_offset_timestamps(conn, reciter_id, surah, ayah_start, ayah_end)?;
    let offset_ms = if timestamps[0].start_ms == 0 { 0 } else { timestamps[0].start_ms };

    let background_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Background".to_string(),
        track_type: TrackType::Background,
        blocks: vec![Block {
            id: Uuid::new_v4().to_string(),
            start_ms: 0,
            end_ms: total_duration_ms,
            data: BlockData::Background(BackgroundBlockData {
                image_path: None,
                color: Some("#0A0A0A".to_string()),
            }),
        }],
        visible: true,
        locked: false,
    };

    let audio_path = resolve_audio_path(reciter_id, surah, ayah_start, ayah_end, total_duration_ms, offset_ms, data_dir)?;
    let audio_track = build_audio_track(reciter_id, surah, audio_path, total_duration_ms);

    let arabic_blocks = build_ayah_text_blocks(&timestamps, surah, "ar", TextPosition::Center);
    let arabic_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Arabic Text".to_string(),
        track_type: TrackType::TextArabic,
        blocks: arabic_blocks.clone(),
        visible: true,
        locked: false,
    };

    let highlight_blocks = build_highlight_blocks(&timestamps);
    let highlight_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Highlights".to_string(),
        track_type: TrackType::Highlight,
        blocks: highlight_blocks,
        visible: true,
        locked: false,
    };

    let translation_blocks = build_translation_blocks(&arabic_blocks, conn, surah, ayah_start, ayah_end);
    let translation_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Translation".to_string(),
        track_type: TrackType::TextTranslation,
        blocks: translation_blocks,
        visible: true,
        locked: false,
    };

    let name = build_project_name(surah, ayah_start, ayah_end);
    let now = Utc::now();
    Ok(Project {
        id: Uuid::new_v4().to_string(),
        name,
        mode: ProjectMode::Reel,
        surah,
        ayah_start,
        ayah_end,
        reciter_id: reciter_id.to_string(),
        timeline: Timeline {
            duration_ms: total_duration_ms,
            tracks: vec![background_track, audio_track, arabic_track, highlight_track, translation_track],
        },
        export_settings: ExportSettings { width: 1080, height: 1920, ..ExportSettings::default() },
        created_at: now,
        updated_at: now,
    })
}

// ---------------------------------------------------------------------------
// LongForm mode builder
// ---------------------------------------------------------------------------

/// Build a LongForm-mode project (16:9 horizontal):
///   1. Background track
///   2. Audio track
///   3. Arabic text track
///   4. Highlight track (word-level karaoke)
///   5. Translation track
///   6. Card track (surah title + bismillah)
pub fn build_longform_project(
    conn: &Connection,
    reciter_id: &str,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
    data_dir: Option<&Path>,
) -> Result<Project, CoreError> {
    let (timestamps, total_duration_ms) =
        load_and_offset_timestamps(conn, reciter_id, surah, ayah_start, ayah_end)?;
    let offset_ms = if timestamps[0].start_ms == 0 { 0 } else { timestamps[0].start_ms };

    let background_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Background".to_string(),
        track_type: TrackType::Background,
        blocks: vec![Block {
            id: Uuid::new_v4().to_string(),
            start_ms: 0,
            end_ms: total_duration_ms,
            data: BlockData::Background(BackgroundBlockData {
                image_path: None,
                color: Some("#0A0A0A".to_string()),
            }),
        }],
        visible: true,
        locked: false,
    };

    let audio_path = resolve_audio_path(reciter_id, surah, ayah_start, ayah_end, total_duration_ms, offset_ms, data_dir)?;
    let audio_track = build_audio_track(reciter_id, surah, audio_path, total_duration_ms);

    let arabic_blocks = build_ayah_text_blocks(&timestamps, surah, "ar", TextPosition::Center);
    let arabic_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Arabic Text".to_string(),
        track_type: TrackType::TextArabic,
        blocks: arabic_blocks.clone(),
        visible: true,
        locked: false,
    };

    let highlight_blocks = build_highlight_blocks(&timestamps);
    let highlight_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Highlights".to_string(),
        track_type: TrackType::Highlight,
        blocks: highlight_blocks,
        visible: true,
        locked: false,
    };

    let translation_blocks = build_translation_blocks(&arabic_blocks, conn, surah, ayah_start, ayah_end);
    let translation_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Translation".to_string(),
        track_type: TrackType::TextTranslation,
        blocks: translation_blocks,
        visible: true,
        locked: false,
    };

    // Card track: surah title at start
    let surahs = quran_data::list_surahs();
    let surah_name = surahs
        .get((surah as usize).wrapping_sub(1))
        .map(|s| format!("{} - {}", s.name_english, s.name_arabic))
        .unwrap_or_else(|| format!("Surah {}", surah));

    let card_duration = 3000u64; // 3 seconds for title card
    let mut card_blocks = vec![Block {
        id: Uuid::new_v4().to_string(),
        start_ms: 0,
        end_ms: card_duration.min(total_duration_ms),
        data: BlockData::Card(CardBlockData {
            card_type: CardType::SurahTitle,
            text: surah_name,
            background_color: "#000000".to_string(),
            text_color: "#FFFFFF".to_string(),
        }),
    }];

    // Bismillah card (for all surahs except At-Tawbah)
    if surah != 9 {
        card_blocks.push(Block {
            id: Uuid::new_v4().to_string(),
            start_ms: 0,
            end_ms: card_duration.min(total_duration_ms),
            data: BlockData::Card(CardBlockData {
                card_type: CardType::Bismillah,
                text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ".to_string(),
                background_color: "#000000".to_string(),
                text_color: "#D4A944".to_string(),
            }),
        });
    }

    let card_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Cards".to_string(),
        track_type: TrackType::Card,
        blocks: card_blocks,
        visible: true,
        locked: false,
    };

    let name = build_project_name(surah, ayah_start, ayah_end);
    let now = Utc::now();
    Ok(Project {
        id: Uuid::new_v4().to_string(),
        name,
        mode: ProjectMode::LongForm,
        surah,
        ayah_start,
        ayah_end,
        reciter_id: reciter_id.to_string(),
        timeline: Timeline {
            duration_ms: total_duration_ms,
            tracks: vec![background_track, audio_track, arabic_track, highlight_track, translation_track, card_track],
        },
        export_settings: ExportSettings { width: 1920, height: 1080, ..ExportSettings::default() },
        created_at: now,
        updated_at: now,
    })
}

// ---------------------------------------------------------------------------
// Custom audio project builder
// ---------------------------------------------------------------------------

/// Build a project from custom audio with pre-computed timestamps.
/// Used when timestamps come from Whisper instead of the DB.
/// Unlike the standard builders, this does NOT call `load_alignment` or
/// `resolve_audio_path` — the caller provides both directly.
pub fn build_project_custom_audio(
    conn: &Connection,
    mode: ProjectMode,
    audio_path: &str,
    mut timestamps: Vec<crate::alignment::WordTimestamp>,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
) -> Result<Project, CoreError> {
    if timestamps.is_empty() {
        return Err(CoreError::NotFound(format!(
            "No timestamps provided for surah {}, ayahs {}-{}",
            surah, ayah_start, ayah_end
        )));
    }

    // Apply the same offset logic as load_and_offset_timestamps
    let surah_info_list = quran_data::list_surahs();
    let total_ayahs = surah_info_list
        .get((surah as usize).wrapping_sub(1))
        .map(|s| s.total_ayahs)
        .unwrap_or(0);
    let is_partial = ayah_start > 1 || ayah_end < total_ayahs;
    let offset_ms = if is_partial { timestamps[0].start_ms } else { 0 };

    if offset_ms > 0 {
        for t in &mut timestamps {
            t.start_ms = t.start_ms.saturating_sub(offset_ms);
            t.end_ms = t.end_ms.saturating_sub(offset_ms);
        }
    }

    let total_duration_ms = timestamps.iter().map(|t| t.end_ms).max().unwrap_or(0);

    // Build common tracks
    let audio_track = build_audio_track("custom", surah, Some(audio_path.to_string()), total_duration_ms);
    let name = build_project_name(surah, ayah_start, ayah_end);
    let now = Utc::now();

    let (tracks, project_mode, export_settings) = match mode {
        ProjectMode::Mushaf => {
            // Mushaf: [Audio, MushafPages, Highlights]
            let pages: Vec<u16> = {
                let mut set = BTreeSet::new();
                for t in &timestamps {
                    set.insert(t.page);
                }
                set.into_iter().collect()
            };

            let mut page_blocks = Vec::new();
            for &page in &pages {
                let page_timestamps: Vec<_> = timestamps.iter().filter(|t| t.page == page).collect();
                if page_timestamps.is_empty() {
                    continue;
                }
                let page_start = page_timestamps.iter().map(|t| t.start_ms).min().unwrap();
                let page_end = page_timestamps.iter().map(|t| t.end_ms).max().unwrap();
                page_blocks.push(Block {
                    id: Uuid::new_v4().to_string(),
                    start_ms: page_start,
                    end_ms: page_end,
                    data: BlockData::MushafPage(MushafPageBlockData {
                        page,
                        image_path: format!("mushaf/page_{:03}.png", page),
                    }),
                });
            }

            let page_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Mushaf Pages".to_string(),
                track_type: TrackType::MushafPage,
                blocks: page_blocks,
                visible: true,
                locked: false,
            };

            let highlight_blocks = build_highlight_blocks(&timestamps);
            let highlight_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Highlights".to_string(),
                track_type: TrackType::Highlight,
                blocks: highlight_blocks,
                visible: true,
                locked: false,
            };

            (
                vec![audio_track, page_track, highlight_track],
                ProjectMode::Mushaf,
                ExportSettings::default(),
            )
        }
        ProjectMode::Caption => {
            // Caption: [Audio, TextArabic, TextTranslation]
            let arabic_blocks = build_ayah_text_blocks(&timestamps, surah, "ar", TextPosition::Bottom);
            let arabic_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Arabic Text".to_string(),
                track_type: TrackType::TextArabic,
                blocks: arabic_blocks.clone(),
                visible: true,
                locked: false,
            };

            let translation_blocks = build_translation_blocks(&arabic_blocks, conn, surah, ayah_start, ayah_end);
            let translation_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Translation".to_string(),
                track_type: TrackType::TextTranslation,
                blocks: translation_blocks,
                visible: true,
                locked: false,
            };

            (
                vec![audio_track, arabic_track, translation_track],
                ProjectMode::Caption,
                ExportSettings::default(),
            )
        }
        ProjectMode::Reel => {
            // Reel: [Background, Audio, TextArabic, Highlights, TextTranslation]
            let background_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Background".to_string(),
                track_type: TrackType::Background,
                blocks: vec![Block {
                    id: Uuid::new_v4().to_string(),
                    start_ms: 0,
                    end_ms: total_duration_ms,
                    data: BlockData::Background(BackgroundBlockData {
                        image_path: None,
                        color: Some("#0A0A0A".to_string()),
                    }),
                }],
                visible: true,
                locked: false,
            };

            let arabic_blocks = build_ayah_text_blocks(&timestamps, surah, "ar", TextPosition::Center);
            let arabic_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Arabic Text".to_string(),
                track_type: TrackType::TextArabic,
                blocks: arabic_blocks.clone(),
                visible: true,
                locked: false,
            };

            let highlight_blocks = build_highlight_blocks(&timestamps);
            let highlight_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Highlights".to_string(),
                track_type: TrackType::Highlight,
                blocks: highlight_blocks,
                visible: true,
                locked: false,
            };

            let translation_blocks = build_translation_blocks(&arabic_blocks, conn, surah, ayah_start, ayah_end);
            let translation_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Translation".to_string(),
                track_type: TrackType::TextTranslation,
                blocks: translation_blocks,
                visible: true,
                locked: false,
            };

            (
                vec![background_track, audio_track, arabic_track, highlight_track, translation_track],
                ProjectMode::Reel,
                ExportSettings { width: 1080, height: 1920, ..ExportSettings::default() },
            )
        }
        ProjectMode::LongForm => {
            // LongForm: [Background, Audio, TextArabic, Highlights, TextTranslation, Cards]
            let background_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Background".to_string(),
                track_type: TrackType::Background,
                blocks: vec![Block {
                    id: Uuid::new_v4().to_string(),
                    start_ms: 0,
                    end_ms: total_duration_ms,
                    data: BlockData::Background(BackgroundBlockData {
                        image_path: None,
                        color: Some("#0A0A0A".to_string()),
                    }),
                }],
                visible: true,
                locked: false,
            };

            let arabic_blocks = build_ayah_text_blocks(&timestamps, surah, "ar", TextPosition::Center);
            let arabic_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Arabic Text".to_string(),
                track_type: TrackType::TextArabic,
                blocks: arabic_blocks.clone(),
                visible: true,
                locked: false,
            };

            let highlight_blocks = build_highlight_blocks(&timestamps);
            let highlight_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Highlights".to_string(),
                track_type: TrackType::Highlight,
                blocks: highlight_blocks,
                visible: true,
                locked: false,
            };

            let translation_blocks = build_translation_blocks(&arabic_blocks, conn, surah, ayah_start, ayah_end);
            let translation_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Translation".to_string(),
                track_type: TrackType::TextTranslation,
                blocks: translation_blocks,
                visible: true,
                locked: false,
            };

            // Card track
            let surahs = quran_data::list_surahs();
            let surah_name = surahs
                .get((surah as usize).wrapping_sub(1))
                .map(|s| format!("{} - {}", s.name_english, s.name_arabic))
                .unwrap_or_else(|| format!("Surah {}", surah));

            let card_duration = 3000u64;
            let mut card_blocks = vec![Block {
                id: Uuid::new_v4().to_string(),
                start_ms: 0,
                end_ms: card_duration.min(total_duration_ms),
                data: BlockData::Card(CardBlockData {
                    card_type: CardType::SurahTitle,
                    text: surah_name,
                    background_color: "#000000".to_string(),
                    text_color: "#FFFFFF".to_string(),
                }),
            }];

            if surah != 9 {
                card_blocks.push(Block {
                    id: Uuid::new_v4().to_string(),
                    start_ms: 0,
                    end_ms: card_duration.min(total_duration_ms),
                    data: BlockData::Card(CardBlockData {
                        card_type: CardType::Bismillah,
                        text: "\u{0628}\u{0650}\u{0633}\u{0652}\u{0645}\u{0650} \u{0671}\u{0644}\u{0644}\u{0651}\u{064e}\u{0647}\u{0650} \u{0671}\u{0644}\u{0631}\u{0651}\u{064e}\u{062d}\u{0652}\u{0645}\u{064e}\u{0640}\u{0670}\u{0646}\u{0650} \u{0671}\u{0644}\u{0631}\u{0651}\u{064e}\u{062d}\u{0650}\u{064a}\u{0645}\u{0650}".to_string(),
                        background_color: "#000000".to_string(),
                        text_color: "#D4A944".to_string(),
                    }),
                });
            }

            let card_track = Track {
                id: Uuid::new_v4().to_string(),
                name: "Cards".to_string(),
                track_type: TrackType::Card,
                blocks: card_blocks,
                visible: true,
                locked: false,
            };

            (
                vec![background_track, audio_track, arabic_track, highlight_track, translation_track, card_track],
                ProjectMode::LongForm,
                ExportSettings { width: 1920, height: 1080, ..ExportSettings::default() },
            )
        }
    };

    Ok(Project {
        id: Uuid::new_v4().to_string(),
        name,
        mode: project_mode,
        surah,
        ayah_start,
        ayah_end,
        reciter_id: "custom".to_string(),
        timeline: Timeline {
            duration_ms: total_duration_ms,
            tracks,
        },
        export_settings,
        created_at: now,
        updated_at: now,
    })
}

// ---------------------------------------------------------------------------
// Project I/O
// ---------------------------------------------------------------------------

/// Save a project as JSON to the given file path.
pub fn save_project(path: &Path, project: &mut Project) -> Result<(), CoreError> {
    project.updated_at = Utc::now();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(project)?;
    fs::write(path, json)?;
    Ok(())
}

/// Load a project from a JSON file.
pub fn load_project(path: &Path) -> Result<Project, CoreError> {
    let json = fs::read_to_string(path)?;
    let project: Project = serde_json::from_str(&json)?;
    Ok(project)
}

/// List all project summary files in a directory.
pub fn list_projects(projects_dir: &Path) -> Result<Vec<ProjectSummary>, CoreError> {
    let mut summaries = Vec::new();

    if !projects_dir.exists() {
        return Ok(summaries);
    }

    for entry in fs::read_dir(projects_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            match load_project(&path) {
                Ok(p) => {
                    summaries.push(ProjectSummary {
                        id: p.id,
                        name: p.name,
                        mode: p.mode,
                        surah: p.surah,
                        reciter_id: p.reciter_id,
                        duration_ms: p.timeline.duration_ms,
                        created_at: p.created_at,
                        updated_at: p.updated_at,
                    });
                }
                Err(_) => {
                    // Skip files that can't be parsed as projects
                    continue;
                }
            }
        }
    }

    summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(summaries)
}

/// Delete a project file.
pub fn delete_project(path: &Path) -> Result<(), CoreError> {
    if !path.exists() {
        return Err(CoreError::NotFound(format!(
            "Project file not found: {}",
            path.display()
        )));
    }
    fs::remove_file(path)?;
    Ok(())
}

/// Duplicate a project: loads it, assigns a new ID and name, saves as a new file.
pub fn duplicate_project(source_path: &Path, projects_dir: &Path) -> Result<Project, CoreError> {
    let original = load_project(source_path)?;

    let now = Utc::now();
    let new_id = Uuid::new_v4().to_string();
    let mut duplicated = Project {
        id: new_id.clone(),
        name: format!("{} (Copy)", original.name),
        created_at: now,
        updated_at: now,
        ..original
    };

    let new_path = projects_dir.join(format!("{}.json", new_id));
    save_project(&new_path, &mut duplicated)?;

    Ok(duplicated)
}

/// Get the project file path for a given project ID within a projects directory.
pub fn project_path(projects_dir: &Path, id: &str) -> PathBuf {
    projects_dir.join(format!("{}.json", id))
}
