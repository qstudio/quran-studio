mod commands;
mod state;

use rusqlite::Connection;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

            let db_path = app_data_dir.join("quran_studio.db");
            let db =
                Connection::open(&db_path).expect("Failed to open database");

            // Initialize database schema
            quran_studio_core::quran_data::init_db(&db)
                .expect("Failed to initialize database");

            // Enable WAL mode for better concurrent read performance
            db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
                .expect("Failed to set PRAGMA");

            let state = AppState::new(db, app_data_dir);
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
            commands::list_reciters,
            commands::list_surahs,
            commands::get_surah_pages,
            commands::get_preview_frame,
            commands::get_audio_waveform,
            commands::export_video,
            commands::get_export_progress,
            commands::cancel_export,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
