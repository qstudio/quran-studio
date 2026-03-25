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

// ---------------------------------------------------------------------------
// Preview module tests (additional)
// ---------------------------------------------------------------------------

#[test]
fn test_prepare_page_image_with_real_image() {
    let data_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("data");
    let mushaf_dir = data_dir.join("mushaf_images");
    // Try common naming patterns
    let page_exists = ["page001.png", "page1.png", "001.png", "1.png"]
        .iter()
        .any(|name| mushaf_dir.join(name).exists());
    if !page_exists {
        eprintln!(
            "Skipping test_prepare_page_image_with_real_image: no mushaf images found at {:?}",
            mushaf_dir
        );
        return;
    }
    let (frame, placement) =
        preview::prepare_page_image(Some(1), &mushaf_dir).expect("Failed to prepare page image");
    assert_eq!(
        frame.width(),
        preview::VIDEO_WIDTH,
        "Frame width should be {} but got {}",
        preview::VIDEO_WIDTH,
        frame.width()
    );
    assert_eq!(
        frame.height(),
        preview::VIDEO_HEIGHT,
        "Frame height should be {} but got {}",
        preview::VIDEO_HEIGHT,
        frame.height()
    );
    assert!(
        placement.scaled_w > 0,
        "Scaled width should be positive, got {}",
        placement.scaled_w
    );
    assert!(
        placement.scaled_h > 0,
        "Scaled height should be positive, got {}",
        placement.scaled_h
    );
}

#[test]
fn test_merge_bboxes_many_words_same_line() {
    // Five words all on the same line (same y center within 20px grid)
    let bboxes = vec![
        WordBBox { x: 100, y: 200, width: 40, height: 30 },
        WordBBox { x: 150, y: 202, width: 35, height: 30 },
        WordBBox { x: 195, y: 198, width: 50, height: 30 },
        WordBBox { x: 255, y: 201, width: 30, height: 30 },
        WordBBox { x: 295, y: 199, width: 45, height: 30 },
    ];
    let merged = merge_bboxes(&bboxes);
    assert_eq!(
        merged.len(),
        1,
        "Five words on the same line should merge to 1 bbox, got {}",
        merged.len()
    );
    assert_eq!(
        merged[0].x, 100,
        "Merged bbox x should be the leftmost x (100), got {}",
        merged[0].x
    );
    // Rightmost extent: 295 + 45 = 340, so width = 340 - 100 = 240
    assert_eq!(
        merged[0].width, 240,
        "Merged bbox width should be 240 (340 - 100), got {}",
        merged[0].width
    );
}

#[test]
fn test_merge_bboxes_three_lines() {
    // Words on 3 different lines (y centers far apart)
    let bboxes = vec![
        WordBBox { x: 100, y: 100, width: 50, height: 30 },
        WordBBox { x: 160, y: 102, width: 40, height: 30 },
        WordBBox { x: 100, y: 400, width: 50, height: 30 },
        WordBBox { x: 160, y: 401, width: 40, height: 30 },
        WordBBox { x: 100, y: 700, width: 50, height: 30 },
    ];
    let merged = merge_bboxes(&bboxes);
    assert_eq!(
        merged.len(),
        3,
        "Words on 3 different lines should produce 3 merged bboxes, got {}",
        merged.len()
    );
}

#[test]
fn test_fractional_to_pixel_full_range() {
    let placement = PagePlacement {
        offset_x: 50,
        offset_y: 100,
        scaled_w: 1000,
        scaled_h: 1800,
    };

    let bbox = fractional_to_pixel(1.0, 1.0, 0.0, 0.0, &placement);
    assert_eq!(
        bbox.x,
        50 + 1000,
        "At frac_x=1.0, pixel x should be offset_x + scaled_w = {}, got {}",
        50 + 1000,
        bbox.x
    );
    assert_eq!(
        bbox.y,
        100 + 1800,
        "At frac_y=1.0, pixel y should be offset_y + scaled_h = {}, got {}",
        100 + 1800,
        bbox.y
    );
    assert_eq!(
        bbox.width, 0,
        "At frac_w=0.0, width should be 0, got {}",
        bbox.width
    );
    assert_eq!(
        bbox.height, 0,
        "At frac_h=0.0, height should be 0, got {}",
        bbox.height
    );
}

// ---------------------------------------------------------------------------
// Audio module tests (additional)
// ---------------------------------------------------------------------------

#[test]
fn test_reciter_qdc_id_all_reciters() {
    use quran_studio_core::audio::reciter_qdc_id;

    let reciters = [
        ("mishary", 7),
        ("sudais", 3),
        ("shuraim", 10),
        ("shatri", 4),
        ("husary", 6),
        ("abdulbaset", 2),
        ("abdulbaset_mujawwad", 1),
        ("hani", 5),
        ("minshawi", 9),
        ("dossari", 97),
    ];

    for (name, expected_id) in &reciters {
        let result = reciter_qdc_id(name);
        assert!(
            result.is_some(),
            "Reciter '{}' should have a QDC ID mapping but got None",
            name
        );
        assert_eq!(
            result.unwrap(),
            *expected_id,
            "Reciter '{}' should map to QDC ID {}, got {:?}",
            name,
            expected_id,
            result
        );
    }
}

#[test]
fn test_compute_waveform_with_real_audio() {
    use quran_studio_core::audio::compute_waveform;

    let data_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("data");
    let audio_path = data_dir.join("audio/mishary/001.mp3");
    if !audio_path.exists() {
        eprintln!(
            "Skipping test_compute_waveform_with_real_audio: audio file not found at {:?}",
            audio_path
        );
        return;
    }

    let peaks = compute_waveform(&audio_path, 100).expect("Failed to compute waveform");
    assert_eq!(
        peaks.len(),
        100,
        "Should return exactly 100 peaks, got {}",
        peaks.len()
    );

    for (i, &val) in peaks.iter().enumerate() {
        assert!(
            val >= 0.0 && val <= 1.0,
            "Peak {} should be between 0.0 and 1.0, got {}",
            i,
            val
        );
    }

    let non_zero_count = peaks.iter().filter(|&&v| v > 0.0).count();
    assert!(
        non_zero_count > 0,
        "Waveform should have at least some non-zero peaks, but all {} peaks were zero",
        peaks.len()
    );
}

#[test]
fn test_get_audio_duration_with_real_audio() {
    use quran_studio_core::audio::get_audio_duration_ms;

    let data_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("data");
    let audio_path = data_dir.join("audio/mishary/001.mp3");
    if !audio_path.exists() {
        eprintln!(
            "Skipping test_get_audio_duration_with_real_audio: audio file not found at {:?}",
            audio_path
        );
        return;
    }

    let duration = get_audio_duration_ms(&audio_path).expect("Failed to get audio duration");
    assert!(
        duration > 0,
        "Audio duration should be positive, got {} ms",
        duration
    );
    // Al-Fatiha recitation is typically 30-120 seconds
    assert!(
        duration > 10_000 && duration < 300_000,
        "Al-Fatiha audio duration should be between 10s and 300s, got {} ms",
        duration
    );
}

// ---------------------------------------------------------------------------
// Error module tests
// ---------------------------------------------------------------------------

#[test]
fn test_error_serialization() {
    use quran_studio_core::CoreError;

    let not_found = CoreError::NotFound("test item missing".to_string());
    let json = serde_json::to_string(&not_found).expect("Failed to serialize NotFound error");
    assert!(
        json.contains("Not found"),
        "Serialized NotFound error should contain 'Not found', got: {}",
        json
    );
    assert!(
        json.contains("test item missing"),
        "Serialized NotFound error should contain the message, got: {}",
        json
    );

    let invalid = CoreError::InvalidInput("bad value".to_string());
    let json = serde_json::to_string(&invalid).expect("Failed to serialize InvalidInput error");
    assert!(
        json.contains("Invalid input"),
        "Serialized InvalidInput error should contain 'Invalid input', got: {}",
        json
    );
    assert!(
        json.contains("bad value"),
        "Serialized InvalidInput error should contain the message, got: {}",
        json
    );

    let cancelled = CoreError::ExportCancelled;
    let json =
        serde_json::to_string(&cancelled).expect("Failed to serialize ExportCancelled error");
    assert!(
        json.contains("Export cancelled"),
        "Serialized ExportCancelled error should contain 'Export cancelled', got: {}",
        json
    );
}

// ---------------------------------------------------------------------------
// Project module tests (additional)
// ---------------------------------------------------------------------------

#[test]
fn test_build_mushaf_project_different_surahs() {
    let conn = open_db();

    // Surah 112 (Al-Ikhlas) - 4 ayahs
    let project_112 = project::build_mushaf_project(&conn, "mishary", 112, 1, 4, None)
        .expect("Failed to build project for surah 112");
    assert_eq!(
        project_112.surah, 112,
        "Project surah should be 112, got {}",
        project_112.surah
    );
    assert_eq!(
        project_112.timeline.tracks.len(),
        3,
        "Surah 112 project should have 3 tracks, got {}",
        project_112.timeline.tracks.len()
    );
    let highlight_track_112 = &project_112.timeline.tracks[2];
    assert!(
        !highlight_track_112.blocks.is_empty(),
        "Surah 112 should have highlight blocks"
    );

    // Surah 114 (An-Nas) - 6 ayahs
    let project_114 = project::build_mushaf_project(&conn, "mishary", 114, 1, 6, None)
        .expect("Failed to build project for surah 114");
    assert_eq!(
        project_114.surah, 114,
        "Project surah should be 114, got {}",
        project_114.surah
    );
    assert_eq!(
        project_114.timeline.tracks.len(),
        3,
        "Surah 114 project should have 3 tracks, got {}",
        project_114.timeline.tracks.len()
    );
    let highlight_track_114 = &project_114.timeline.tracks[2];
    assert!(
        !highlight_track_114.blocks.is_empty(),
        "Surah 114 should have highlight blocks"
    );

    // Surah 114 has more ayahs so should have more or equal highlight blocks
    assert!(
        highlight_track_114.blocks.len() >= highlight_track_112.blocks.len(),
        "Surah 114 (6 ayahs) should have >= highlight blocks than surah 112 (4 ayahs): {} vs {}",
        highlight_track_114.blocks.len(),
        highlight_track_112.blocks.len()
    );
}

#[test]
fn test_project_default_export_settings() {
    let conn = open_db();
    let project = project::build_mushaf_project(&conn, "mishary", 1, 1, 7, None)
        .expect("Failed to build project");

    assert_eq!(
        project.export_settings.width, 1080,
        "Default export width should be 1080, got {}",
        project.export_settings.width
    );
    assert_eq!(
        project.export_settings.height, 1920,
        "Default export height should be 1920, got {}",
        project.export_settings.height
    );
    assert_eq!(
        project.export_settings.fps, 30,
        "Default export fps should be 30, got {}",
        project.export_settings.fps
    );
    assert_eq!(
        project.export_settings.video_codec, "libx264",
        "Default video codec should be 'libx264', got '{}'",
        project.export_settings.video_codec
    );
}

#[test]
fn test_project_save_updates_timestamp() {
    let conn = open_db();
    let mut project = project::build_mushaf_project(&conn, "mishary", 1, 1, 7, None)
        .expect("Failed to build project");

    let tmp_dir = std::env::temp_dir().join("quran_studio_test_timestamp");
    std::fs::create_dir_all(&tmp_dir).unwrap();
    let project_path = project::project_path(&tmp_dir, &project.id);

    // First save
    project::save_project(&project_path, &mut project).expect("Failed to save project (first)");
    let first_updated_at = project.updated_at;

    // Brief pause to ensure timestamp differs
    std::thread::sleep(std::time::Duration::from_millis(50));

    // Second save
    project::save_project(&project_path, &mut project).expect("Failed to save project (second)");
    let second_updated_at = project.updated_at;

    assert!(
        second_updated_at > first_updated_at,
        "Second save updated_at ({:?}) should be after first save updated_at ({:?})",
        second_updated_at,
        first_updated_at
    );

    // Cleanup
    let _ = std::fs::remove_dir_all(&tmp_dir);
}

// ---------------------------------------------------------------------------
// New mode builder tests
// ---------------------------------------------------------------------------

#[test]
fn test_project_modes_serialize() {
    let modes = vec![
        (project::ProjectMode::Mushaf, "\"mushaf\""),
        (project::ProjectMode::Caption, "\"caption\""),
        (project::ProjectMode::Reel, "\"reel\""),
        (project::ProjectMode::LongForm, "\"long_form\""),
    ];
    for (mode, expected_json) in &modes {
        let json = serde_json::to_string(mode)
            .unwrap_or_else(|_| panic!("Failed to serialize {:?}", mode));
        assert_eq!(
            &json, expected_json,
            "ProjectMode::{:?} should serialize to {}, got {}",
            mode, expected_json, json
        );
    }
}

#[test]
fn test_new_block_data_serialization() {
    let text_block = project::BlockData::TextArabic(project::TextBlockData {
        text: "بسم الله".to_string(),
        surah: 1,
        ayah: 1,
        language: "ar".to_string(),
        font_size: 48,
        color: "#FFFFFF".to_string(),
        position: project::TextPosition::Center,
        background: None,
    });
    let json = serde_json::to_string(&text_block).expect("Failed to serialize TextArabic");
    assert!(json.contains("\"type\":\"text_arabic\""),
        "TextArabic block should have type discriminator, got: {}", json);

    let bg_block = project::BlockData::Background(project::BackgroundBlockData {
        image_path: None,
        color: Some("#000000".to_string()),
    });
    let json = serde_json::to_string(&bg_block).expect("Failed to serialize Background");
    assert!(json.contains("\"type\":\"background\""),
        "Background block should have type discriminator, got: {}", json);

    let card_block = project::BlockData::Card(project::CardBlockData {
        card_type: project::CardType::SurahTitle,
        text: "Al-Fatihah".to_string(),
        background_color: "#000000".to_string(),
        text_color: "#FFFFFF".to_string(),
    });
    let json = serde_json::to_string(&card_block).expect("Failed to serialize Card");
    assert!(json.contains("\"type\":\"card\""),
        "Card block should have type discriminator, got: {}", json);
}

#[test]
fn test_build_caption_project() {
    let conn = open_db();
    let project = project::build_caption_project(&conn, "mishary", 1, 1, 7, None)
        .expect("Failed to build caption project");

    assert_eq!(project.mode, project::ProjectMode::Caption,
        "Project mode should be Caption");
    assert_eq!(project.timeline.tracks.len(), 3,
        "Caption project should have 3 tracks, got {}", project.timeline.tracks.len());

    assert_eq!(project.timeline.tracks[0].track_type, project::TrackType::Audio,
        "Track 0 should be Audio");
    assert_eq!(project.timeline.tracks[1].track_type, project::TrackType::TextArabic,
        "Track 1 should be TextArabic");
    assert_eq!(project.timeline.tracks[2].track_type, project::TrackType::TextTranslation,
        "Track 2 should be TextTranslation");

    let arabic_track = &project.timeline.tracks[1];
    assert_eq!(arabic_track.blocks.len(), 7,
        "Arabic text track should have 7 blocks (one per ayah), got {}", arabic_track.blocks.len());

    // Most blocks should have non-empty text (some words may have empty text_uthmani)
    let non_empty_count = arabic_track.blocks.iter().filter(|block| {
        if let project::BlockData::TextArabic(ref data) = block.data {
            !data.text.is_empty()
        } else {
            false
        }
    }).count();
    assert!(non_empty_count >= 5,
        "At least 5 of 7 Arabic text blocks should have text, got {}", non_empty_count);

    assert!(project.timeline.duration_ms > 0, "Duration should be positive");

    let json = serde_json::to_string_pretty(&project).expect("Failed to serialize");
    let _parsed: project::Project = serde_json::from_str(&json).expect("Failed to deserialize");
}

#[test]
fn test_build_reel_project() {
    let conn = open_db();
    let project = project::build_reel_project(&conn, "mishary", 1, 1, 7, None)
        .expect("Failed to build reel project");

    assert_eq!(project.mode, project::ProjectMode::Reel,
        "Project mode should be Reel");
    assert_eq!(project.timeline.tracks.len(), 5,
        "Reel project should have 5 tracks, got {}", project.timeline.tracks.len());

    assert_eq!(project.timeline.tracks[0].track_type, project::TrackType::Background);
    assert_eq!(project.timeline.tracks[1].track_type, project::TrackType::Audio);
    assert_eq!(project.timeline.tracks[2].track_type, project::TrackType::TextArabic);
    assert_eq!(project.timeline.tracks[3].track_type, project::TrackType::Highlight);
    assert_eq!(project.timeline.tracks[4].track_type, project::TrackType::TextTranslation);

    assert!(project.timeline.tracks[3].blocks.len() >= 25,
        "Highlight track should have ~29 word blocks, got {}",
        project.timeline.tracks[3].blocks.len());

    assert_eq!(project.export_settings.width, 1080);
    assert_eq!(project.export_settings.height, 1920);

    let json = serde_json::to_string_pretty(&project).expect("Failed to serialize");
    let _parsed: project::Project = serde_json::from_str(&json).expect("Failed to deserialize");
}

#[test]
fn test_build_longform_project() {
    let conn = open_db();
    let project = project::build_longform_project(&conn, "mishary", 1, 1, 7, None)
        .expect("Failed to build longform project");

    assert_eq!(project.mode, project::ProjectMode::LongForm,
        "Project mode should be LongForm");
    assert_eq!(project.timeline.tracks.len(), 6,
        "LongForm project should have 6 tracks, got {}", project.timeline.tracks.len());

    assert_eq!(project.timeline.tracks[5].track_type, project::TrackType::Card);

    let card_track = &project.timeline.tracks[5];
    assert!(card_track.blocks.len() >= 1,
        "Card track should have at least a surah title card");

    if let project::BlockData::Card(ref data) = card_track.blocks[0].data {
        assert!(data.text.contains("Al-Fatihah"),
            "Card text should contain surah name, got: {}", data.text);
    } else {
        panic!("Expected Card block data");
    }

    assert_eq!(project.export_settings.width, 1920);
    assert_eq!(project.export_settings.height, 1080);

    let json = serde_json::to_string_pretty(&project).expect("Failed to serialize");
    let _parsed: project::Project = serde_json::from_str(&json).expect("Failed to deserialize");
}

#[test]
fn test_longform_no_bismillah_for_tawbah() {
    let conn = open_db();
    let project = project::build_longform_project(&conn, "mishary", 9, 1, 5, None)
        .expect("Failed to build longform project for At-Tawbah");

    let card_track = &project.timeline.tracks[5];
    for block in &card_track.blocks {
        if let project::BlockData::Card(ref data) = block.data {
            assert_ne!(data.card_type, project::CardType::Bismillah,
                "At-Tawbah (surah 9) should NOT have a Bismillah card");
        }
    }
}
