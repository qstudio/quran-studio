use quran_studio_core::alignment;
use quran_studio_core::preview::{
    self, fractional_to_pixel, merge_bboxes, PagePlacement, WordBBox,
};
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

// ---------------------------------------------------------------------------
// Quran data tests
// ---------------------------------------------------------------------------

#[test]
fn test_list_surahs() {
    let surahs = quran_data::list_surahs();
    assert_eq!(surahs.len(), 114, "Should have 114 surahs");
    assert_eq!(surahs[0].name_english, "Al-Fatihah");
    assert_eq!(surahs[0].total_ayahs, 7);
    assert_eq!(surahs[113].name_english, "An-Nas");
}

#[test]
fn test_surahs_sequential_numbering() {
    let surahs = quran_data::list_surahs();
    for (i, surah) in surahs.iter().enumerate() {
        assert_eq!(
            surah.number,
            (i + 1) as u16,
            "Surah numbering should be sequential"
        );
        assert!(surah.total_ayahs > 0, "Each surah should have at least 1 ayah");
    }
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
fn test_reciters_have_available_surahs() {
    let conn = open_db();
    let reciters = quran_data::list_reciters(&conn).expect("Failed to list reciters");
    for reciter in &reciters {
        assert!(
            !reciter.available_surahs.is_empty(),
            "Reciter {} should have available surahs",
            reciter.id
        );
    }
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
fn test_get_words_single_ayah() {
    let conn = open_db();
    let words =
        quran_data::get_words(&conn, 1, 1, 1).expect("Failed to get words for ayah 1");
    assert!(!words.is_empty(), "Should have words for a single ayah");
    for word in &words {
        assert_eq!(word.ayah, 1, "All words should be from ayah 1");
        assert_eq!(word.surah, 1);
    }
}

#[test]
fn test_get_words_has_coordinates() {
    let conn = open_db();
    let words = quran_data::get_words(&conn, 1, 1, 7).expect("Failed to get words");
    for word in &words {
        // Coordinates are stored as fractional * 100,000
        assert!(word.width > 0, "Word width should be positive");
        assert!(word.height > 0, "Word height should be positive");
    }
}

#[test]
fn test_get_words_empty_range() {
    let conn = open_db();
    // Ayah 999 doesn't exist in any surah
    let words =
        quran_data::get_words(&conn, 1, 999, 999).expect("Should not error on empty range");
    assert!(words.is_empty(), "Should return empty for non-existent ayah");
}

#[test]
fn test_get_translations() {
    let conn = open_db();
    let translations = quran_data::get_translations(&conn, 1, 1, 7, "en")
        .expect("Failed to get translations");
    assert!(
        !translations.is_empty(),
        "Should have English translations for Al-Fatiha"
    );
    for t in &translations {
        assert_eq!(t.language, "en");
        assert!(!t.text.is_empty(), "Translation text should not be empty");
    }
}

#[test]
fn test_get_pages_for_surah() {
    let conn = open_db();
    let pages = quran_data::get_pages_for_surah(&conn, 1).expect("Failed to get pages");
    assert!(!pages.is_empty(), "Al-Fatiha should have page(s)");
    assert!(pages.contains(&1), "Al-Fatiha should be on page 1");
}

// ---------------------------------------------------------------------------
// Alignment tests
// ---------------------------------------------------------------------------

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
fn test_alignment_end_after_start() {
    let conn = open_db();
    let aligned =
        alignment::load_alignment(&conn, "mishary", 1, 1, 7).expect("Failed to load alignment");
    for word in &aligned {
        assert!(
            word.end_ms >= word.start_ms,
            "end_ms ({}) should be >= start_ms ({})",
            word.end_ms,
            word.start_ms
        );
    }
}

#[test]
fn test_alignment_has_word_data() {
    let conn = open_db();
    let aligned =
        alignment::load_alignment(&conn, "mishary", 1, 1, 7).expect("Failed to load alignment");
    for word in &aligned {
        assert!(word.surah > 0, "surah should be positive");
        assert!(word.ayah > 0, "ayah should be positive");
        assert!(word.word_position > 0, "word_position should be positive");
        assert!(word.page > 0, "page should be positive");
    }
}

#[test]
fn test_alignment_nonexistent_reciter() {
    let conn = open_db();
    let aligned = alignment::load_alignment(&conn, "nonexistent_reciter", 1, 1, 7)
        .expect("Should not error");
    assert!(
        aligned.is_empty(),
        "Non-existent reciter should return empty alignment"
    );
}

// ---------------------------------------------------------------------------
// Project builder tests
// ---------------------------------------------------------------------------

#[test]
fn test_build_mushaf_project() {
    let conn = open_db();
    let project = project::build_mushaf_project(&conn, "mishary", 1, 1, 7, None)
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
}

#[test]
fn test_build_mushaf_project_partial_ayahs() {
    let conn = open_db();
    let project = project::build_mushaf_project(&conn, "mishary", 1, 3, 5, None)
        .expect("Failed to build partial project");

    assert_eq!(project.ayah_start, 3);
    assert_eq!(project.ayah_end, 5);

    // Highlight blocks should only have ayahs 3-5
    let highlight_track = &project.timeline.tracks[2];
    for block in &highlight_track.blocks {
        if let project::BlockData::Highlight(ref data) = block.data {
            assert!(
                data.ayah >= 3 && data.ayah <= 5,
                "Highlight ayah {} should be in range 3-5",
                data.ayah
            );
        }
    }

    // Timeline should start at 0 (offset applied)
    let first_highlight = &highlight_track.blocks[0];
    assert!(
        first_highlight.start_ms < 2000,
        "First highlight should start near 0 after offset adjustment"
    );
}

#[test]
fn test_build_mushaf_project_nonexistent_reciter() {
    let conn = open_db();
    let result = project::build_mushaf_project(&conn, "nonexistent", 1, 1, 7, None);
    assert!(result.is_err(), "Should fail for non-existent reciter");
}

#[test]
fn test_project_name_formatting() {
    let conn = open_db();
    let project = project::build_mushaf_project(&conn, "mishary", 1, 1, 7, None)
        .expect("Failed to build project");
    assert!(
        project.name.contains("Al-Fatihah"),
        "Project name should contain surah name, got: {}",
        project.name
    );
}

// ---------------------------------------------------------------------------
// Project I/O tests
// ---------------------------------------------------------------------------

#[test]
fn test_project_save_load_delete() {
    let conn = open_db();
    let mut project = project::build_mushaf_project(&conn, "mishary", 1, 1, 7, None)
        .expect("Failed to build project");

    let tmp_dir = std::env::temp_dir().join("quran_studio_test_save_load");
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

#[test]
fn test_project_duplicate() {
    let conn = open_db();
    let mut project = project::build_mushaf_project(&conn, "mishary", 1, 1, 7, None)
        .expect("Failed to build project");

    let tmp_dir = std::env::temp_dir().join("quran_studio_test_duplicate");
    std::fs::create_dir_all(&tmp_dir).unwrap();
    let project_path = project::project_path(&tmp_dir, &project.id);

    project::save_project(&project_path, &mut project).expect("Failed to save project");

    let duplicated =
        project::duplicate_project(&project_path, &tmp_dir).expect("Failed to duplicate project");

    assert_ne!(duplicated.id, project.id, "Duplicate should have new ID");
    assert!(
        duplicated.name.contains("(Copy)"),
        "Duplicate name should contain (Copy)"
    );
    assert_eq!(duplicated.surah, project.surah);
    assert_eq!(
        duplicated.timeline.tracks.len(),
        project.timeline.tracks.len()
    );

    // Both files should exist
    let dup_path = project::project_path(&tmp_dir, &duplicated.id);
    assert!(dup_path.exists(), "Duplicate file should exist");
    assert!(project_path.exists(), "Original file should still exist");

    // Cleanup
    let _ = std::fs::remove_dir_all(&tmp_dir);
}

#[test]
fn test_project_serialization_roundtrip() {
    let conn = open_db();
    let project = project::build_mushaf_project(&conn, "mishary", 1, 1, 7, None)
        .expect("Failed to build project");

    let json = serde_json::to_string_pretty(&project).expect("Failed to serialize project");
    assert!(json.len() > 100, "JSON should be substantial");

    let parsed: project::Project =
        serde_json::from_str(&json).expect("Failed to deserialize project");
    assert_eq!(parsed.id, project.id);
    assert_eq!(parsed.timeline.duration_ms, project.timeline.duration_ms);
    assert_eq!(
        parsed.timeline.tracks.len(),
        project.timeline.tracks.len()
    );
}

#[test]
fn test_list_projects_empty_dir() {
    let tmp_dir = std::env::temp_dir().join("quran_studio_test_empty");
    std::fs::create_dir_all(&tmp_dir).unwrap();

    // Remove any stale files
    for entry in std::fs::read_dir(&tmp_dir).unwrap() {
        let _ = std::fs::remove_file(entry.unwrap().path());
    }

    let summaries = project::list_projects(&tmp_dir).expect("Failed to list projects");
    assert!(summaries.is_empty(), "Empty dir should have no projects");

    let _ = std::fs::remove_dir_all(&tmp_dir);
}

#[test]
fn test_list_projects_nonexistent_dir() {
    let tmp_dir = std::env::temp_dir().join("quran_studio_test_nonexistent_xyzzy");
    let _ = std::fs::remove_dir_all(&tmp_dir); // Ensure it doesn't exist
    let summaries = project::list_projects(&tmp_dir).expect("Should not error");
    assert!(
        summaries.is_empty(),
        "Non-existent dir should return empty list"
    );
}

#[test]
fn test_delete_nonexistent_project() {
    let result = project::delete_project(Path::new("/tmp/nonexistent_project.json"));
    assert!(result.is_err(), "Deleting non-existent file should error");
}

#[test]
fn test_export_settings_default() {
    let settings = project::ExportSettings::default();
    assert_eq!(settings.width, 1080);
    assert_eq!(settings.height, 1920);
    assert_eq!(settings.fps, 30);
    assert_eq!(settings.video_codec, "libx264");
    assert_eq!(settings.audio_codec, "aac");
}

// ---------------------------------------------------------------------------
// Preview helper tests (unit-level, no images needed)
// ---------------------------------------------------------------------------

#[test]
fn test_fractional_to_pixel() {
    let placement = PagePlacement {
        offset_x: 100,
        offset_y: 200,
        scaled_w: 800,
        scaled_h: 1600,
    };

    let bbox = fractional_to_pixel(0.1, 0.2, 0.3, 0.05, &placement);
    assert_eq!(bbox.x, 100 + (0.1 * 800.0) as i32);
    assert_eq!(bbox.y, 200 + (0.2 * 1600.0) as i32);
    assert_eq!(bbox.width, (0.3 * 800.0) as i32);
    assert_eq!(bbox.height, (0.05 * 1600.0) as i32);
}

#[test]
fn test_fractional_to_pixel_zero() {
    let placement = PagePlacement {
        offset_x: 50,
        offset_y: 50,
        scaled_w: 1000,
        scaled_h: 1800,
    };

    let bbox = fractional_to_pixel(0.0, 0.0, 0.0, 0.0, &placement);
    assert_eq!(bbox.x, 50);
    assert_eq!(bbox.y, 50);
    assert_eq!(bbox.width, 0);
    assert_eq!(bbox.height, 0);
}

#[test]
fn test_merge_bboxes_empty() {
    let merged = merge_bboxes(&[]);
    assert!(merged.is_empty());
}

#[test]
fn test_merge_bboxes_single() {
    let bboxes = vec![WordBBox {
        x: 100,
        y: 200,
        width: 50,
        height: 30,
    }];
    let merged = merge_bboxes(&bboxes);
    assert_eq!(merged.len(), 1);
    assert_eq!(merged[0].x, 100);
    assert_eq!(merged[0].width, 50);
}

#[test]
fn test_merge_bboxes_same_line() {
    // Two words on the same line (same y center within 20px grid)
    let bboxes = vec![
        WordBBox {
            x: 100,
            y: 200,
            width: 50,
            height: 30,
        },
        WordBBox {
            x: 160,
            y: 200,
            width: 40,
            height: 30,
        },
    ];
    let merged = merge_bboxes(&bboxes);
    assert_eq!(merged.len(), 1, "Same-line words should merge");
    assert_eq!(merged[0].x, 100);
    assert_eq!(merged[0].width, 100); // 160 + 40 - 100
}

#[test]
fn test_merge_bboxes_different_lines() {
    // Two words on different lines (different y center grid)
    let bboxes = vec![
        WordBBox {
            x: 100,
            y: 200,
            width: 50,
            height: 30,
        },
        WordBBox {
            x: 100,
            y: 600,
            width: 50,
            height: 30,
        },
    ];
    let merged = merge_bboxes(&bboxes);
    assert_eq!(merged.len(), 2, "Different-line words should not merge");
}

#[test]
fn test_prepare_page_image_no_page() {
    let tmp = std::env::temp_dir();
    let (frame, placement) =
        preview::prepare_page_image(None, &tmp).expect("Should handle None page");
    assert_eq!(frame.width(), preview::VIDEO_WIDTH);
    assert_eq!(frame.height(), preview::VIDEO_HEIGHT);
    assert_eq!(placement.offset_x, 0);
}

// ---------------------------------------------------------------------------
// Audio helper tests
// ---------------------------------------------------------------------------

#[test]
fn test_reciter_qdc_id_mapping() {
    use quran_studio_core::audio::reciter_qdc_id;
    assert_eq!(reciter_qdc_id("mishary"), Some(7));
    assert_eq!(reciter_qdc_id("sudais"), Some(3));
    assert_eq!(reciter_qdc_id("husary"), Some(6));
    assert_eq!(reciter_qdc_id("nonexistent"), None);
}

#[test]
fn test_compute_waveform_zero_peaks() {
    use quran_studio_core::audio::compute_waveform;
    // Requesting 0 peaks should return empty
    let result = compute_waveform(Path::new("/nonexistent"), 0);
    assert!(result.is_ok());
    assert!(result.unwrap().is_empty());
}
