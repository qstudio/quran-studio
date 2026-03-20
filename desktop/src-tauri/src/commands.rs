use std::sync::atomic::Ordering;

use tauri::State;

use quran_studio_core::project::{
    ExportSettings, Project, ProjectSummary,
};
use quran_studio_core::quran_data::{Reciter, Surah};

use crate::state::AppState;

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> Result<Vec<ProjectSummary>, String> {
    quran_studio_core::project::list_projects(&state.projects_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_project(
    state: State<'_, AppState>,
    mode: String,
    reciter_id: String,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
) -> Result<Project, String> {
    // Clone what we need so we can move into the blocking task
    let data_dir = state.data_dir.clone();
    let projects_dir = state.projects_dir.clone();

    // Lock DB briefly to get what we need, but the heavy work (download/trim)
    // happens inside build_mushaf_project which we run on a blocking thread.
    let db_path = data_dir.join("db/quran.sqlite");

    let result = tokio::task::spawn_blocking(move || {
        // Open a dedicated connection for this blocking task so we don't hold
        // the shared Mutex across an await point.
        let conn = rusqlite::Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        let mut project = match mode.as_str() {
            "mushaf" => {
                quran_studio_core::project::build_mushaf_project(
                    &conn,
                    &reciter_id,
                    surah,
                    ayah_start,
                    ayah_end,
                    Some(&data_dir),
                )
                .map_err(|e| e.to_string())?
            }
            _ => return Err(format!("Unknown project mode: {}", mode)),
        };

        let path = quran_studio_core::project::project_path(&projects_dir, &project.id);
        quran_studio_core::project::save_project(&path, &mut project)
            .map_err(|e| e.to_string())?;

        Ok(project)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(result)
}

#[tauri::command]
pub fn load_project(state: State<'_, AppState>, id: String) -> Result<Project, String> {
    let path = quran_studio_core::project::project_path(&state.projects_dir, &id);
    quran_studio_core::project::load_project(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_project(state: State<'_, AppState>, mut project: Project) -> Result<(), String> {
    let path = quran_studio_core::project::project_path(&state.projects_dir, &project.id);
    quran_studio_core::project::save_project(&path, &mut project)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_project(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let path = quran_studio_core::project::project_path(&state.projects_dir, &id);
    quran_studio_core::project::delete_project(&path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn duplicate_project(state: State<'_, AppState>, id: String) -> Result<Project, String> {
    let source_path = quran_studio_core::project::project_path(&state.projects_dir, &id);
    quran_studio_core::project::duplicate_project(&source_path, &state.projects_dir)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_reciters(state: State<'_, AppState>) -> Result<Vec<Reciter>, String> {
    let db = state.db.lock().map_err(|e| format!("Lock error: {}", e))?;
    quran_studio_core::quran_data::list_reciters(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_surahs() -> Result<Vec<Surah>, String> {
    Ok(quran_studio_core::quran_data::list_surahs())
}

#[tauri::command]
pub fn get_surah_pages(state: State<'_, AppState>, surah: u16) -> Result<Vec<u16>, String> {
    let db = state.db.lock().map_err(|e| format!("Lock error: {}", e))?;
    quran_studio_core::quran_data::get_pages_for_surah(&db, surah).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_audio_file(state: State<'_, AppState>, reciter_id: String, surah: u16) -> Result<Vec<u8>, String> {
    let audio_path = state.data_dir.join(format!("audio/{}/{:03}.mp3", reciter_id, surah));

    // Download on demand if not present
    if !audio_path.exists() {
        if let Some(qdc_id) = quran_studio_core::audio::reciter_qdc_id(&reciter_id) {
            quran_studio_core::audio::download_audio(qdc_id, surah, &audio_path)
                .map_err(|e| format!("Failed to download audio: {}", e))?;
        } else {
            return Err(format!(
                "Audio file not found and no QDC mapping for reciter '{}': {}",
                reciter_id,
                audio_path.display()
            ));
        }
    }

    std::fs::read(&audio_path).map_err(|e| format!("Failed to read audio file: {}", e))
}

#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    std::fs::read(p).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn get_mushaf_page(state: State<'_, AppState>, page: u16, style: Option<String>) -> Result<Vec<u8>, String> {
    let style = style.unwrap_or_else(|| "madani".to_string());

    // Try style-specific directory first, then fall back to default mushaf_images
    let dirs_to_try = [
        state.data_dir.join(format!("mushaf_images_{}", style)),
        state.mushaf_dir.clone(), // default: mushaf_images
    ];

    for dir in &dirs_to_try {
        let image_path = dir.join(format!("page_{:03}.png", page));
        if image_path.exists() {
            return std::fs::read(&image_path)
                .map_err(|e| format!("Failed to read image: {}", e));
        }
    }

    Err(format!(
        "Mushaf page image not found for page {} style '{}'",
        page, style
    ))
}

#[tauri::command]
pub fn get_preview_frame(
    state: State<'_, AppState>,
    project_id: String,
    timestamp_ms: i64,
) -> Result<Vec<u8>, String> {
    let path = quran_studio_core::project::project_path(&state.projects_dir, &project_id);
    let project =
        quran_studio_core::project::load_project(&path)
            .map_err(|e| e.to_string())?;

    let timestamp_ms_u64 = timestamp_ms.max(0) as u64;
    quran_studio_core::preview::render_preview_frame(&project, timestamp_ms_u64, &state.mushaf_dir)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_audio_waveform(
    state: State<'_, AppState>,
    reciter_id: String,
    surah: u16,
) -> Result<Vec<f32>, String> {
    // Construct audio file path from reciter_id and surah
    let audio_dir = state.data_dir.join("audio");
    let audio_path = audio_dir.join(format!("{}/{:03}.mp3", reciter_id, surah));

    if !audio_path.exists() {
        return Err(format!(
            "Audio file not found: {}",
            audio_path.display()
        ));
    }

    quran_studio_core::audio::compute_waveform(&audio_path, 200).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_video(
    state: State<'_, AppState>,
    project_id: String,
    settings: ExportSettings,
) -> Result<String, String> {
    let path = quran_studio_core::project::project_path(&state.projects_dir, &project_id);
    let project =
        quran_studio_core::project::load_project(&path)
            .map_err(|e| e.to_string())?;

    let progress = state.export_progress.clone();
    let cancel = state.export_cancel.clone();
    let mushaf_dir = state.mushaf_dir.clone();
    let output_dir = state
        .projects_dir
        .parent()
        .unwrap_or(&state.projects_dir)
        .join("exports");

    // Reset progress and cancel flag
    progress.store(0, Ordering::Relaxed);
    cancel.store(false, Ordering::Relaxed);

    let result = tokio::task::spawn_blocking(move || {
        quran_studio_core::renderer::export_video(
            &project,
            &settings,
            &mushaf_dir,
            "ffmpeg",
            progress,
            cancel,
            &output_dir,
        )
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| e.to_string())?;

    Ok(result.display().to_string())
}

#[tauri::command]
pub fn get_audio_file_path(
    state: State<'_, AppState>,
    reciter_id: String,
    surah: u16,
) -> Result<String, String> {
    let audio_path = state
        .data_dir
        .join(format!("audio/{}/{:03}.mp3", reciter_id, surah));

    // Download on demand if not present
    if !audio_path.exists() {
        if let Some(qdc_id) = quran_studio_core::audio::reciter_qdc_id(&reciter_id) {
            quran_studio_core::audio::download_audio(qdc_id, surah, &audio_path)
                .map_err(|e| format!("Failed to download audio: {}", e))?;
        } else {
            return Err(format!(
                "Audio file not found and no QDC mapping for reciter '{}': {}",
                reciter_id,
                audio_path.display()
            ));
        }
    }

    Ok(audio_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn get_mushaf_page_path(
    state: State<'_, AppState>,
    page: u16,
    style: Option<String>,
) -> Result<String, String> {
    let style = style.unwrap_or_else(|| "madani".to_string());

    let dirs_to_try = [
        state.data_dir.join(format!("mushaf_images_{}", style)),
        state.mushaf_dir.clone(),
    ];

    for dir in &dirs_to_try {
        let image_path = dir.join(format!("page_{:03}.png", page));
        if image_path.exists() {
            return Ok(image_path.to_string_lossy().into_owned());
        }
    }

    Err(format!(
        "Mushaf page image not found for page {} style '{}'",
        page, style
    ))
}

#[tauri::command]
pub fn get_export_progress(state: State<'_, AppState>) -> f32 {
    state.export_progress.load(Ordering::Relaxed) as f32
}

#[tauri::command]
pub fn cancel_export(state: State<'_, AppState>) -> Result<(), String> {
    state.export_cancel.store(true, Ordering::Relaxed);
    Ok(())
}
