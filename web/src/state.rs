use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32};
use std::sync::{Arc, Mutex};

use rusqlite::Connection;

/// Shared application state for the Axum web server.
/// Same shape as the Tauri AppState.
pub struct AppState {
    pub db: Mutex<Connection>,
    pub projects_dir: PathBuf,
    pub mushaf_dir: PathBuf,
    pub data_dir: PathBuf,
    pub export_progress: Arc<AtomicU32>,
    pub export_cancel: Arc<AtomicBool>,
    pub alignment_progress: Arc<AtomicU32>,
    pub alignment_cancel: Arc<AtomicBool>,
}

impl AppState {
    pub fn new(db: Connection, data_dir: PathBuf) -> Self {
        let projects_dir = data_dir.join("projects");
        let mushaf_dir = data_dir.join("mushaf_images");

        let _ = std::fs::create_dir_all(&projects_dir);
        let _ = std::fs::create_dir_all(&mushaf_dir);

        Self {
            db: Mutex::new(db),
            projects_dir,
            mushaf_dir,
            data_dir,
            export_progress: Arc::new(AtomicU32::new(0)),
            export_cancel: Arc::new(AtomicBool::new(false)),
            alignment_progress: Arc::new(AtomicU32::new(0)),
            alignment_cancel: Arc::new(AtomicBool::new(false)),
        }
    }
}
