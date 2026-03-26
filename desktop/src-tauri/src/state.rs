use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32};
use std::sync::{Arc, Mutex};

use rusqlite::Connection;

/// Shared application state managed by Tauri.
pub struct AppState {
    /// SQLite database connection (thread-safe via Mutex).
    pub db: Mutex<Connection>,
    /// Directory where project JSON files are stored.
    pub projects_dir: PathBuf,
    /// Directory where mushaf page images are stored.
    pub mushaf_dir: PathBuf,
    /// Root data directory (contains audio/, mushaf_images/, db/, etc.)
    pub data_dir: PathBuf,
    /// Export progress (0-100).
    pub export_progress: Arc<AtomicU32>,
    /// Export cancellation flag.
    pub export_cancel: Arc<AtomicBool>,
    /// Alignment progress (0-100).
    pub alignment_progress: Arc<AtomicU32>,
    /// Alignment cancellation flag.
    pub alignment_cancel: Arc<AtomicBool>,
}

impl AppState {
    pub fn new(db: Connection, data_dir: PathBuf) -> Self {
        let projects_dir = data_dir.join("projects");
        let mushaf_dir = data_dir.join("mushaf_images");

        // Ensure directories exist
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
