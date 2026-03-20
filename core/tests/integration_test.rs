use quran_studio_core::alignment;
use quran_studio_core::project;
use quran_studio_core::quran_data;
use rusqlite::Connection;
use std::path::Path;

fn open_db() -> Connection {
    let db_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("data/db/quran.sqlite");
    if !db_path.exists() {
        panic!(
            "Test database not found at {:?}. Run `python3 data/scripts/build_database.py` first.",
            db_path
        );
    }
    Connection::open(&db_path).expect("Failed to open test database")
}

#[test]
fn test_list_surahs() {
    let surahs = quran_data::list_surahs();
    assert_eq!(surahs.len(), 114, "Should have 114 surahs");
    assert_eq!(surahs[0].name_english, "Al-Fatihah");
    assert_eq!(surahs[0].total_ayahs, 7);
    assert_eq!(surahs[113].name_english, "An-Nas");
}

#[test]
fn test_list_reciters() {
    let conn = open_db();
    let reciters = quran_data::list_reciters(&conn).expect("Failed to list reciters");
    assert!(reciters.len() >= 5, "Should have at least 5 reciters");

    let mishary = reciters.iter().find(|r| r.id == "mishary");
    assert!(mishary.is_some(), "Mishary should be in reciters");
    let mishary = mishary.unwrap();
    assert_eq!(mishary.name_en, "Mishari Rashid al-Afasy");
}

#[test]
fn test_get_words_fatiha() {
    let conn = open_db();
    let words = quran_data::get_words(&conn, 1, 1, 7).expect("Failed to get words for Al-Fatiha");
    assert!(!words.is_empty(), "Al-Fatiha should have words");
    // Al-Fatiha has ~29 words
    assert!(
        words.len() >= 25 && words.len() <= 35,
        "Al-Fatiha word count {} should be around 29",
        words.len()
    );
    // First word should be on page 1
    assert_eq!(words[0].page, 1);
    assert_eq!(words[0].surah, 1);
    assert_eq!(words[0].ayah, 1);
}

#[test]
fn test_load_alignment_fatiha() {
    let conn = open_db();
    let aligned =
        alignment::load_alignment(&conn, "mishary", 1, 1, 7).expect("Failed to load alignment");
    assert!(!aligned.is_empty(), "Should have alignment data");
    assert!(
        aligned.len() >= 25,
        "Al-Fatiha alignment should have ~29 words, got {}",
        aligned.len()
    );

    // Timestamps should be monotonically non-decreasing
    for window in aligned.windows(2) {
        assert!(
            window[1].start_ms >= window[0].start_ms,
            "Timestamps should be non-decreasing: {} >= {}",
            window[1].start_ms,
            window[0].start_ms
        );
    }

    // First word should start near 0
    assert!(
        aligned[0].start_ms < 5000,
        "First word should start within 5 seconds"
    );
}

#[test]
fn test_build_mushaf_project() {
    let conn = open_db();
    let project = project::build_mushaf_project(&conn, "mishary", 1, 1, 7)
        .expect("Failed to build mushaf project");

    assert_eq!(project.surah, 1);
    assert_eq!(project.ayah_start, 1);
    assert_eq!(project.ayah_end, 7);

    // Should have 3 tracks: audio, mushaf_page, highlight
    assert_eq!(project.timeline.tracks.len(), 3, "Should have 3 tracks");

    let audio_track = &project.timeline.tracks[0];
    assert_eq!(
        audio_track.track_type,
        project::TrackType::Audio,
        "First track should be audio"
    );
    assert_eq!(audio_track.blocks.len(), 1, "Audio track should have 1 block");

    let page_track = &project.timeline.tracks[1];
    assert_eq!(
        page_track.track_type,
        project::TrackType::MushafPage,
        "Second track should be mushaf_page"
    );
    assert!(
        !page_track.blocks.is_empty(),
        "Should have at least 1 page block"
    );

    let highlight_track = &project.timeline.tracks[2];
    assert_eq!(
        highlight_track.track_type,
        project::TrackType::Highlight,
        "Third track should be highlight"
    );
    assert!(
        highlight_track.blocks.len() >= 25,
        "Should have ~29 highlight blocks (one per word), got {}",
        highlight_track.blocks.len()
    );

    // Duration should be positive
    assert!(
        project.timeline.duration_ms > 0,
        "Duration should be positive"
    );

    // Project should serialize to JSON cleanly
    let json = serde_json::to_string_pretty(&project).expect("Failed to serialize project");
    assert!(json.len() > 100, "JSON should be substantial");

    // And deserialize back
    let parsed: project::Project =
        serde_json::from_str(&json).expect("Failed to deserialize project");
    assert_eq!(parsed.id, project.id);
}

#[test]
fn test_project_save_load_delete() {
    let conn = open_db();
    let mut project = project::build_mushaf_project(&conn, "mishary", 1, 1, 7)
        .expect("Failed to build project");

    let tmp_dir = std::env::temp_dir().join("quran_studio_test");
    std::fs::create_dir_all(&tmp_dir).unwrap();
    let project_path = project::project_path(&tmp_dir, &project.id);

    // Save
    project::save_project(&project_path, &mut project).expect("Failed to save project");
    assert!(project_path.exists(), "Project file should exist");

    // Load
    let loaded = project::load_project(&project_path).expect("Failed to load project");
    assert_eq!(loaded.id, project.id);
    assert_eq!(loaded.name, project.name);
    assert_eq!(loaded.timeline.tracks.len(), 3);

    // List
    let summaries = project::list_projects(&tmp_dir).expect("Failed to list projects");
    assert!(
        summaries.iter().any(|s| s.id == project.id),
        "Project should appear in list"
    );

    // Delete
    project::delete_project(&project_path).expect("Failed to delete project");
    assert!(!project_path.exists(), "Project file should be deleted");

    // Cleanup
    let _ = std::fs::remove_dir_all(&tmp_dir);
}
