mod commands;
mod state;

use rusqlite::Connection;
use state::AppState;
use tauri::Manager;

/// Find the data directory.
/// In dev mode, look relative to CARGO_MANIFEST_DIR; otherwise use app_data_dir.
fn find_data_dir(app_data_dir: &std::path::Path) -> std::path::PathBuf {
    let dev_candidates = [
        // Relative to the project root (cargo runs from workspace root)
        std::path::PathBuf::from("data"),
        // Relative to manifest dir (desktop/src-tauri -> repo root)
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join("data"),
    ];

    for candidate in &dev_candidates {
        let db_path = candidate.join("db/quran.sqlite");
        if db_path.exists() {
            eprintln!("[quran-studio] Using data dir: {:?}", candidate);
            return candidate.clone();
        }
    }

    // Fall back to app data dir
    eprintln!("[quran-studio] Using data dir (fallback): {:?}", app_data_dir);
    app_data_dir.to_path_buf()
}

/// Find the quran.sqlite database.
/// Priority: 1) data/db/quran.sqlite relative to the project root (dev mode)
///           2) app data dir copy
///           3) create empty DB with schema
fn find_or_create_db(data_dir: &std::path::Path, app_data_dir: &std::path::Path) -> Connection {
    let db_path = data_dir.join("db/quran.sqlite");
    if db_path.exists() {
        eprintln!("[quran-studio] Using database: {:?}", db_path);
        let db = Connection::open(&db_path).expect("Failed to open database");
        db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .expect("Failed to set PRAGMA");
        return db;
    }

    // Fall back to app data dir
    std::fs::create_dir_all(app_data_dir).expect("Failed to create app data directory");
    let fallback_db_path = app_data_dir.join("quran_studio.db");
    eprintln!("[quran-studio] Using database: {:?}", fallback_db_path);
    let db = Connection::open(&fallback_db_path).expect("Failed to open database");

    // Initialize schema if empty
    quran_studio_core::quran_data::init_db(&db).expect("Failed to initialize database");
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .expect("Failed to set PRAGMA");

    db
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let data_dir = find_data_dir(&app_data_dir);
            let db = find_or_create_db(&data_dir, &app_data_dir);

            let state = AppState::new(db, data_dir);
            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_projects,
            commands::create_project,
            commands::load_project,
            commands::save_project,
            commands::delete_project,
            commands::duplicate_project,
            commands::read_file_bytes,
            commands::list_reciters,
            commands::list_surahs,
            commands::get_surah_pages,
            commands::get_audio_file,
            commands::get_audio_file_path,
            commands::get_mushaf_page,
            commands::get_mushaf_page_path,
            commands::get_preview_frame,
            commands::get_audio_waveform,
            commands::export_video,
            commands::get_export_progress,
            commands::cancel_export,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
