mod state;

use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;

use axum::extract::{Query, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Json, Response};
use axum::routing::{get, post};
use axum::Router;
use rusqlite::Connection;
use serde::Deserialize;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

use quran_studio_core::project::{
    ExportSettings, Project, ProjectMode,
};

use crate::state::AppState;

type AppStateExt = State<Arc<AppState>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn internal_error(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

fn parse_mode(mode: &str) -> Result<ProjectMode, (StatusCode, String)> {
    match mode {
        "mushaf" => Ok(ProjectMode::Mushaf),
        "caption" => Ok(ProjectMode::Caption),
        "reel" => Ok(ProjectMode::Reel),
        "long_form" => Ok(ProjectMode::LongForm),
        _ => Err((StatusCode::BAD_REQUEST, format!("Unknown mode: {}", mode))),
    }
}

// ---------------------------------------------------------------------------
// Data directory discovery (same logic as Tauri)
// ---------------------------------------------------------------------------

fn find_data_dir() -> PathBuf {
    // Check env var first
    if let Ok(dir) = std::env::var("QURAN_STUDIO_DATA_DIR") {
        let p = PathBuf::from(dir);
        if p.join("db/quran.sqlite").exists() {
            return p;
        }
    }

    // Check relative paths (for dev mode)
    let candidates = [
        PathBuf::from("data"),
        PathBuf::from("../data"),
    ];

    for candidate in &candidates {
        if candidate.join("db/quran.sqlite").exists() {
            eprintln!("[web] Using data dir: {:?}", candidate);
            return candidate.clone();
        }
    }

    // Fallback
    eprintln!("[web] WARNING: data directory not found, using ./data");
    PathBuf::from("data")
}

fn open_db(data_dir: &Path) -> Connection {
    let db_path = data_dir.join("db/quran.sqlite");
    if db_path.exists() {
        let conn = Connection::open(&db_path).expect("Failed to open database");
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .expect("Failed to set PRAGMA");
        conn
    } else {
        std::fs::create_dir_all(data_dir.join("db")).expect("Failed to create db dir");
        let conn = Connection::open(&db_path).expect("Failed to create database");
        quran_studio_core::quran_data::init_db(&conn).expect("Failed to init schema");
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .expect("Failed to set PRAGMA");
        conn
    }
}

// ---------------------------------------------------------------------------
// Handlers: Health
// ---------------------------------------------------------------------------

async fn health() -> &'static str {
    "ok"
}

// ---------------------------------------------------------------------------
// Handlers: Projects
// ---------------------------------------------------------------------------

async fn list_projects(state: AppStateExt) -> Result<Json<Vec<quran_studio_core::project::ProjectSummary>>, (StatusCode, String)> {
    let projects_dir = state.projects_dir.clone();
    let result = tokio::task::spawn_blocking(move || {
        quran_studio_core::project::list_projects(&projects_dir)
    })
    .await
    .map_err(internal_error)?
    .map_err(internal_error)?;
    Ok(Json(result))
}

#[derive(Deserialize)]
struct CreateProjectRequest {
    mode: String,
    #[serde(rename = "reciterId")]
    reciter_id: String,
    surah: u16,
    #[serde(rename = "ayahStart")]
    ayah_start: u16,
    #[serde(rename = "ayahEnd")]
    ayah_end: u16,
    #[serde(rename = "audioPath")]
    audio_path: Option<String>,
}

async fn create_project(
    state: AppStateExt,
    Json(body): Json<CreateProjectRequest>,
) -> Result<Json<Project>, (StatusCode, String)> {
    let data_dir = state.data_dir.clone();
    let projects_dir = state.projects_dir.clone();
    let mode = body.mode.clone();
    let reciter_id = body.reciter_id.clone();
    let surah = body.surah;
    let ayah_start = body.ayah_start;
    let ayah_end = body.ayah_end;
    let audio_path = body.audio_path.clone();
    let alignment_progress = state.alignment_progress.clone();

    let result = tokio::task::spawn_blocking(move || {
        let db_path = data_dir.join("db/quran.sqlite");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        let mode_enum = parse_mode(&mode).map_err(|e| e.1)?;

        let mut project = if let Some(ref path) = audio_path {
            let model_path = quran_studio_core::whisper::ensure_model(&data_dir, |_, _| {})
                .map_err(|e| e.to_string())?;
            let progress = alignment_progress.clone();
            let timestamps = quran_studio_core::whisper::align_custom_audio(
                &conn, &model_path, Path::new(path), surah, ayah_start, ayah_end,
                move |pct| { progress.store(pct, Ordering::Relaxed); },
            )
            .map_err(|e| e.to_string())?;
            quran_studio_core::project::build_project_custom_audio(
                &conn, mode_enum, path, timestamps, surah, ayah_start, ayah_end,
            )
            .map_err(|e| e.to_string())?
        } else {
            match mode_enum {
                ProjectMode::Mushaf => quran_studio_core::project::build_mushaf_project(&conn, &reciter_id, surah, ayah_start, ayah_end, Some(&data_dir)),
                ProjectMode::Caption => quran_studio_core::project::build_caption_project(&conn, &reciter_id, surah, ayah_start, ayah_end, Some(&data_dir)),
                ProjectMode::Reel => quran_studio_core::project::build_reel_project(&conn, &reciter_id, surah, ayah_start, ayah_end, Some(&data_dir)),
                ProjectMode::LongForm => quran_studio_core::project::build_longform_project(&conn, &reciter_id, surah, ayah_start, ayah_end, Some(&data_dir)),
            }
            .map_err(|e| e.to_string())?
        };

        let path = quran_studio_core::project::project_path(&projects_dir, &project.id);
        quran_studio_core::project::save_project(&path, &mut project).map_err(|e| e.to_string())?;
        Ok::<_, String>(project)
    })
    .await
    .map_err(internal_error)?
    .map_err(internal_error)?;

    Ok(Json(result))
}

async fn load_project(
    state: AppStateExt,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<Project>, (StatusCode, String)> {
    let path = quran_studio_core::project::project_path(&state.projects_dir, &id);
    let project = tokio::task::spawn_blocking(move || {
        quran_studio_core::project::load_project(&path)
    })
    .await
    .map_err(internal_error)?
    .map_err(internal_error)?;
    Ok(Json(project))
}

async fn save_project(
    state: AppStateExt,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(mut project): Json<Project>,
) -> Result<StatusCode, (StatusCode, String)> {
    let path = quran_studio_core::project::project_path(&state.projects_dir, &id);
    tokio::task::spawn_blocking(move || {
        quran_studio_core::project::save_project(&path, &mut project)
    })
    .await
    .map_err(internal_error)?
    .map_err(internal_error)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_project(
    state: AppStateExt,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let path = quran_studio_core::project::project_path(&state.projects_dir, &id);
    tokio::task::spawn_blocking(move || {
        quran_studio_core::project::delete_project(&path)
    })
    .await
    .map_err(internal_error)?
    .map_err(internal_error)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn duplicate_project(
    state: AppStateExt,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<Project>, (StatusCode, String)> {
    let source = quran_studio_core::project::project_path(&state.projects_dir, &id);
    let projects_dir = state.projects_dir.clone();
    let project = tokio::task::spawn_blocking(move || {
        quran_studio_core::project::duplicate_project(&source, &projects_dir)
    })
    .await
    .map_err(internal_error)?
    .map_err(internal_error)?;
    Ok(Json(project))
}

// ---------------------------------------------------------------------------
// Handlers: Quran Data
// ---------------------------------------------------------------------------

async fn list_reciters(state: AppStateExt) -> Result<Json<Vec<quran_studio_core::quran_data::Reciter>>, (StatusCode, String)> {
    let db = state.db.lock().map_err(internal_error)?;
    let reciters = quran_studio_core::quran_data::list_reciters(&db).map_err(internal_error)?;
    Ok(Json(reciters))
}

async fn list_surahs() -> Json<Vec<quran_studio_core::quran_data::Surah>> {
    Json(quran_studio_core::quran_data::list_surahs())
}

async fn get_surah_pages(
    state: AppStateExt,
    axum::extract::Path(surah): axum::extract::Path<u16>,
) -> Result<Json<Vec<u16>>, (StatusCode, String)> {
    let db = state.db.lock().map_err(internal_error)?;
    let pages = quran_studio_core::quran_data::get_pages_for_surah(&db, surah).map_err(internal_error)?;
    Ok(Json(pages))
}

// ---------------------------------------------------------------------------
// Handlers: Media
// ---------------------------------------------------------------------------

async fn get_audio_file(
    state: AppStateExt,
    axum::extract::Path((reciter_id, surah)): axum::extract::Path<(String, u16)>,
) -> Result<Response, (StatusCode, String)> {
    let audio_path = state.data_dir.join(format!("audio/{}/{:03}.mp3", reciter_id, surah));

    // Download on demand if not present
    if !audio_path.exists() {
        let path = audio_path.clone();
        let rid = reciter_id.clone();
        tokio::task::spawn_blocking(move || {
            if let Some(qdc_id) = quran_studio_core::audio::reciter_qdc_id(&rid) {
                quran_studio_core::audio::download_audio(qdc_id, surah, &path)
            } else {
                Err(quran_studio_core::CoreError::NotFound(format!("No QDC mapping for {}", rid)))
            }
        })
        .await
        .map_err(internal_error)?
        .map_err(internal_error)?;
    }

    let bytes = tokio::fs::read(&audio_path).await.map_err(internal_error)?;
    Ok(([(header::CONTENT_TYPE, "audio/mpeg")], bytes).into_response())
}

#[derive(Deserialize)]
struct MushafQuery {
    style: Option<String>,
}

async fn get_mushaf_page(
    state: AppStateExt,
    axum::extract::Path(page): axum::extract::Path<u16>,
    Query(query): Query<MushafQuery>,
) -> Result<Response, (StatusCode, String)> {
    let style = query.style.unwrap_or_else(|| "madani".to_string());
    let dirs = [
        state.data_dir.join(format!("mushaf_images_{}", style)),
        state.mushaf_dir.clone(),
    ];

    for dir in &dirs {
        let path = dir.join(format!("page_{:03}.png", page));
        if path.exists() {
            let bytes = tokio::fs::read(&path).await.map_err(internal_error)?;
            return Ok(([(header::CONTENT_TYPE, "image/png")], bytes).into_response());
        }
    }

    Err((StatusCode::NOT_FOUND, format!("Page {} not found", page)))
}

#[derive(Deserialize)]
struct PreviewQuery {
    at: Option<i64>,
}

async fn get_preview_frame(
    state: AppStateExt,
    axum::extract::Path(id): axum::extract::Path<String>,
    Query(query): Query<PreviewQuery>,
) -> Result<Response, (StatusCode, String)> {
    let projects_dir = state.projects_dir.clone();
    let mushaf_dir = state.mushaf_dir.clone();
    let timestamp_ms = query.at.unwrap_or(0).max(0) as u64;

    let bytes = tokio::task::spawn_blocking(move || {
        let path = quran_studio_core::project::project_path(&projects_dir, &id);
        let project = quran_studio_core::project::load_project(&path)?;
        quran_studio_core::preview::render_preview_frame(&project, timestamp_ms, &mushaf_dir)
    })
    .await
    .map_err(internal_error)?
    .map_err(internal_error)?;

    Ok(([(header::CONTENT_TYPE, "image/png")], bytes).into_response())
}

async fn get_audio_waveform(
    state: AppStateExt,
    axum::extract::Path((reciter_id, surah)): axum::extract::Path<(String, u16)>,
) -> Result<Json<Vec<f32>>, (StatusCode, String)> {
    let audio_path = state.data_dir.join(format!("audio/{}/{:03}.mp3", reciter_id, surah));
    if !audio_path.exists() {
        return Err((StatusCode::NOT_FOUND, "Audio not found".to_string()));
    }

    let peaks = tokio::task::spawn_blocking(move || {
        quran_studio_core::audio::compute_waveform(&audio_path, 200)
    })
    .await
    .map_err(internal_error)?
    .map_err(internal_error)?;

    Ok(Json(peaks))
}

// ---------------------------------------------------------------------------
// Handlers: Export
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct ExportRequest {
    settings: ExportSettings,
}

async fn export_video(
    state: AppStateExt,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<ExportRequest>,
) -> Result<Json<String>, (StatusCode, String)> {
    let projects_dir = state.projects_dir.clone();
    let mushaf_dir = state.mushaf_dir.clone();
    let progress = state.export_progress.clone();
    let cancel = state.export_cancel.clone();

    progress.store(0, Ordering::Relaxed);
    cancel.store(false, Ordering::Relaxed);

    let output_dir = state.data_dir.join("exports");

    let result = tokio::task::spawn_blocking(move || {
        let path = quran_studio_core::project::project_path(&projects_dir, &id);
        let project = quran_studio_core::project::load_project(&path).map_err(|e| e.to_string())?;
        quran_studio_core::renderer::export_video(
            &project, &body.settings, &mushaf_dir, "ffmpeg", progress, cancel, &output_dir,
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(internal_error)?
    .map_err(internal_error)?;

    Ok(Json(result.display().to_string()))
}

async fn get_export_progress(state: AppStateExt) -> Json<f32> {
    Json(state.export_progress.load(Ordering::Relaxed) as f32)
}

async fn cancel_export(state: AppStateExt) -> StatusCode {
    state.export_cancel.store(true, Ordering::Relaxed);
    StatusCode::NO_CONTENT
}

// ---------------------------------------------------------------------------
// Handlers: Alignment
// ---------------------------------------------------------------------------

async fn get_alignment_progress(state: AppStateExt) -> Json<u32> {
    Json(state.alignment_progress.load(Ordering::Relaxed))
}

async fn cancel_alignment(state: AppStateExt) -> StatusCode {
    state.alignment_cancel.store(true, Ordering::Relaxed);
    StatusCode::NO_CONTENT
}

async fn check_whisper_model(state: AppStateExt) -> Json<bool> {
    Json(quran_studio_core::whisper::model_exists(&state.data_dir))
}

// ---------------------------------------------------------------------------
// Router & main
// ---------------------------------------------------------------------------

fn api_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/health", get(health))
        // Projects
        .route("/projects", get(list_projects).post(create_project))
        .route("/projects/{id}", get(load_project).put(save_project).delete(delete_project))
        .route("/projects/{id}/duplicate", post(duplicate_project))
        .route("/projects/{id}/preview", get(get_preview_frame))
        .route("/projects/{id}/export", post(export_video))
        // Quran data
        .route("/reciters", get(list_reciters))
        .route("/surahs", get(list_surahs))
        .route("/surahs/{num}/pages", get(get_surah_pages))
        // Media
        .route("/audio/{reciter}/{surah}", get(get_audio_file))
        .route("/audio/{reciter}/{surah}/waveform", get(get_audio_waveform))
        .route("/mushaf/{page}", get(get_mushaf_page))
        // Export
        .route("/export/progress", get(get_export_progress))
        .route("/export/cancel", post(cancel_export))
        // Alignment
        .route("/alignment/progress", get(get_alignment_progress))
        .route("/alignment/cancel", post(cancel_alignment))
        .route("/alignment/model", get(check_whisper_model))
}

#[tokio::main]
async fn main() {
    let data_dir = find_data_dir();
    let db = open_db(&data_dir);

    // Static dir: check for built SPA
    let static_dir = std::env::var("QURAN_STUDIO_STATIC_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            // Try relative paths
            for candidate in &["desktop/dist", "../desktop/dist", "dist"] {
                let p = PathBuf::from(candidate);
                if p.join("index.html").exists() {
                    return p;
                }
            }
            PathBuf::from("desktop/dist")
        });

    let state = Arc::new(AppState::new(db, data_dir));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .nest("/api", api_router())
        .layer(cors)
        .fallback_service(
            ServeDir::new(&static_dir)
                .fallback(ServeFile::new(static_dir.join("index.html"))),
        )
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);
    eprintln!("[web] Starting server at http://{}", addr);
    eprintln!("[web] Static files from: {:?}", static_dir);

    let listener = tokio::net::TcpListener::bind(&addr).await.expect("Failed to bind");
    axum::serve(listener, app).await.expect("Server error");
}
