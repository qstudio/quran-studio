use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::alignment::load_alignment;
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectMode {
    Mushaf,
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
) -> Result<Project, CoreError> {
    // Load alignment data (timing + word coordinates)
    let timestamps = load_alignment(conn, reciter_id, surah, ayah_start, ayah_end)?;

    if timestamps.is_empty() {
        return Err(CoreError::NotFound(format!(
            "No alignment data found for reciter '{}', surah {}, ayahs {}-{}",
            reciter_id, surah, ayah_start, ayah_end
        )));
    }

    // Determine total duration from alignment data
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
                audio_path: None,
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
