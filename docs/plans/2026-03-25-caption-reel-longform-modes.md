# Caption, Reel, and Long-form Modes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three new video editing modes (Caption, Reel, Long-form) alongside the existing Mushaf mode, each with its own project builder, preview renderer, and export pipeline.

**Architecture:** All modes share the same alignment engine, timeline editor, and project save/load infrastructure. Each mode defines its own track layout, block data types, preview renderer, and FFmpeg export pipeline. The Rust core dispatches on `ProjectMode` to select the right builder/renderer/exporter. The frontend dispatches on `project.mode` to select the right preview component and inspector panel.

**Tech Stack:** Rust (core), React/TypeScript (frontend), Tauri 2.0 (IPC), FFmpeg (export), Vitest + Playwright (tests)

---

## Track Layouts by Mode

```
MUSHAF:     [Audio] [MushafPages] [Highlights]
CAPTION:    [Video] [Audio] [ArabicText] [Translation]
REEL:       [Background] [Audio] [ArabicText] [Highlights] [Translation]
LONGFORM:   [Background] [Audio] [ArabicText] [Highlights] [Translation] [Cards]
```

## Mode Dimensions
- **Mushaf**: 1080×1920 (9:16)
- **Caption**: Matches source video dimensions
- **Reel**: 1080×1920 (9:16)
- **Long-form**: 1920×1080 (16:9)

---

### Task 1: Extend Rust Data Model — Enums and Block Types

**Files:**
- Modify: `core/src/project.rs`

**Step 1: Write failing test for new ProjectMode variants**

Add to `core/tests/integration_test.rs`:

```rust
#[test]
fn test_project_modes_serialize() {
    use quran_studio_core::project::ProjectMode;

    let modes = vec![
        (ProjectMode::Mushaf, "\"mushaf\""),
        (ProjectMode::Caption, "\"caption\""),
        (ProjectMode::Reel, "\"reel\""),
        (ProjectMode::LongForm, "\"long_form\""),
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
```

**Step 2:** Run `cargo test -p quran-studio-core test_project_modes_serialize` — expect FAIL (variants don't exist)

**Step 3: Add new enums and block data types**

In `core/src/project.rs`, expand `ProjectMode`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectMode {
    Mushaf,
    Caption,
    Reel,
    LongForm,
}
```

Add new `TrackType` variants:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TrackType {
    Audio,
    MushafPage,
    Highlight,
    Video,
    TextArabic,
    TextTranslation,
    Background,
    Card,
}
```

Add new block data structs:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoBlockData {
    pub video_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextPosition {
    Top,
    Center,
    Bottom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextBackground {
    pub color: String,
    pub opacity: f32,
    pub padding: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextBlockData {
    pub text: String,
    pub surah: u16,
    pub ayah: u16,
    pub language: String,
    pub font_size: u32,
    pub color: String,
    pub position: TextPosition,
    pub background: Option<TextBackground>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundBlockData {
    pub image_path: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardType {
    SurahTitle,
    Bismillah,
    AyahEnd,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardBlockData {
    pub card_type: CardType,
    pub text: String,
    pub background_color: String,
    pub text_color: String,
}
```

Expand `BlockData` enum:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BlockData {
    Audio(AudioBlockData),
    MushafPage(MushafPageBlockData),
    Highlight(HighlightBlockData),
    Video(VideoBlockData),
    TextArabic(TextBlockData),
    TextTranslation(TextBlockData),
    Background(BackgroundBlockData),
    Card(CardBlockData),
}
```

**Step 4:** Run `cargo test -p quran-studio-core` — expect all 46 tests PASS (existing tests unchanged, new test passes)

**Step 5:** Commit: `feat: add Caption/Reel/LongForm mode enums and block data types`

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `desktop/src/types/project.ts`

**Step 1: Write failing test for new types**

Add to `desktop/src/types/__tests__/project.test.ts`:

```typescript
describe("mode types", () => {
  it("all block data types have a type discriminator", () => {
    const textBlock: TextBlockData = {
      type: "text_arabic",
      text: "بسم الله",
      surah: 1,
      ayah: 1,
      language: "ar",
      font_size: 48,
      color: "#FFFFFF",
      position: "center",
    };
    expect(textBlock.type, "TextBlockData should have type discriminator").toBe("text_arabic");

    const bgBlock: BackgroundBlockData = {
      type: "background",
      color: "#000000",
    };
    expect(bgBlock.type, "BackgroundBlockData should have type discriminator").toBe("background");

    const cardBlock: CardBlockData = {
      type: "card",
      card_type: "surah_title",
      text: "Al-Fatihah",
      background_color: "#000000",
      text_color: "#FFFFFF",
    };
    expect(cardBlock.type, "CardBlockData should have type discriminator").toBe("card");

    const videoBlock: VideoBlockData = {
      type: "video",
      video_path: "/path/to/video.mp4",
    };
    expect(videoBlock.type, "VideoBlockData should have type discriminator").toBe("video");
  });
});
```

**Step 2:** Run `cd desktop && npm test -- --run src/types/__tests__/project.test.ts` — expect FAIL (types don't exist)

**Step 3: Add TypeScript types**

In `desktop/src/types/project.ts`:

```typescript
export type ProjectMode = "mushaf" | "caption" | "reel" | "long_form";

export type TrackType = "audio" | "mushaf_page" | "highlight" | "video" | "text_arabic" | "text_translation" | "background" | "card";

export type TextPosition = "top" | "center" | "bottom";

export type CardType = "surah_title" | "bismillah" | "ayah_end";

export interface TextBackground {
  color: string;
  opacity: number;
  padding: number;
}

export interface VideoBlockData {
  type: "video";
  video_path: string;
}

export interface TextBlockData {
  type: "text_arabic" | "text_translation";
  text: string;
  surah: number;
  ayah: number;
  language: string;
  font_size: number;
  color: string;
  position: TextPosition;
  background?: TextBackground;
}

export interface BackgroundBlockData {
  type: "background";
  image_path?: string;
  color?: string;
}

export interface CardBlockData {
  type: "card";
  card_type: CardType;
  text: string;
  background_color: string;
  text_color: string;
}

export type BlockData =
  | AudioBlockData
  | MushafPageBlockData
  | HighlightBlockData
  | VideoBlockData
  | TextBlockData
  | BackgroundBlockData
  | CardBlockData;
```

**Step 4:** Run `cd desktop && npm test` — expect all PASS

**Step 5:** Commit: `feat: add TypeScript types for Caption/Reel/LongForm block data`

---

### Task 3: Caption Mode Project Builder (Rust)

**Files:**
- Modify: `core/src/project.rs`
- Test: `core/tests/integration_test.rs`

**Step 1: Write failing test**

```rust
#[test]
fn test_build_caption_project() {
    let conn = open_db();
    let project = project::build_caption_project(&conn, "mishary", 1, 1, 7, None)
        .expect("Failed to build caption project");

    assert_eq!(project.mode, project::ProjectMode::Caption,
        "Project mode should be Caption");
    assert_eq!(project.timeline.tracks.len(), 3,
        "Caption project should have 3 tracks (audio, text_arabic, text_translation)");

    let audio = &project.timeline.tracks[0];
    assert_eq!(audio.track_type, project::TrackType::Audio,
        "First track should be Audio");

    let arabic = &project.timeline.tracks[1];
    assert_eq!(arabic.track_type, project::TrackType::TextArabic,
        "Second track should be TextArabic");
    assert!(!arabic.blocks.is_empty(),
        "Arabic text track should have blocks (one per ayah)");

    let translation = &project.timeline.tracks[2];
    assert_eq!(translation.track_type, project::TrackType::TextTranslation,
        "Third track should be TextTranslation");

    assert!(project.timeline.duration_ms > 0,
        "Duration should be positive");
}
```

**Step 2:** Run test — expect FAIL

**Step 3: Implement `build_caption_project`**

In `core/src/project.rs`:

```rust
/// Build a Caption-mode project. Generates:
/// 1. Audio track (full recitation)
/// 2. Arabic text track (one block per ayah, timed to alignment)
/// 3. Translation text track (one block per ayah, same timing)
pub fn build_caption_project(
    conn: &Connection,
    reciter_id: &str,
    surah: u16,
    ayah_start: u16,
    ayah_end: u16,
    data_dir: Option<&Path>,
) -> Result<Project, CoreError> {
    let timestamps = load_alignment(conn, reciter_id, surah, ayah_start, ayah_end)?;
    if timestamps.is_empty() {
        return Err(CoreError::NotFound(format!(
            "No alignment data for reciter '{}', surah {}, ayahs {}-{}",
            reciter_id, surah, ayah_start, ayah_end
        )));
    }

    // Offset for partial ranges
    let surah_info_list = quran_data::list_surahs();
    let total_ayahs = surah_info_list.get((surah as usize).wrapping_sub(1))
        .map(|s| s.total_ayahs).unwrap_or(0);
    let is_partial = ayah_start > 1 || ayah_end < total_ayahs;
    let offset_ms = if is_partial { timestamps[0].start_ms } else { 0 };

    let mut timestamps = timestamps;
    if offset_ms > 0 {
        for t in &mut timestamps {
            t.start_ms = t.start_ms.saturating_sub(offset_ms);
            t.end_ms = t.end_ms.saturating_sub(offset_ms);
        }
    }

    let total_duration_ms = timestamps.iter().map(|t| t.end_ms).max().unwrap_or(0);

    // Audio track
    let audio_path = resolve_audio_path(conn, reciter_id, surah, is_partial, offset_ms, total_duration_ms, data_dir)?;
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
                audio_path,
            }),
        }],
        visible: true,
        locked: false,
    };

    // Arabic text track (one block per ayah)
    let arabic_blocks = build_ayah_text_blocks(&timestamps, surah, "ar");
    let arabic_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Arabic Text".to_string(),
        track_type: TrackType::TextArabic,
        blocks: arabic_blocks,
        visible: true,
        locked: false,
    };

    // Translation track
    let translations = quran_data::get_translations(conn, surah, ayah_start, ayah_end, "en").unwrap_or_default();
    let translation_blocks = build_translation_blocks(&timestamps, &translations, surah);
    let translation_track = Track {
        id: Uuid::new_v4().to_string(),
        name: "Translation".to_string(),
        track_type: TrackType::TextTranslation,
        blocks: translation_blocks,
        visible: true,
        locked: false,
    };

    let name = build_project_name(surah, ayah_start, ayah_end);
    let now = Utc::now();
    Ok(Project {
        id: Uuid::new_v4().to_string(),
        name,
        mode: ProjectMode::Caption,
        surah, ayah_start, ayah_end,
        reciter_id: reciter_id.to_string(),
        timeline: Timeline { duration_ms: total_duration_ms, tracks: vec![audio_track, arabic_track, translation_track] },
        export_settings: ExportSettings { width: 1080, height: 1920, ..ExportSettings::default() },
        created_at: now,
        updated_at: now,
    })
}
```

Also extract shared helpers: `resolve_audio_path`, `build_ayah_text_blocks`, `build_translation_blocks`, `build_project_name` — these are reused by Reel and LongForm builders.

**Step 4:** Run `cargo test -p quran-studio-core` — expect PASS

**Step 5:** Commit: `feat: add Caption mode project builder`

---

### Task 4: Reel Mode Project Builder (Rust)

**Files:**
- Modify: `core/src/project.rs`
- Test: `core/tests/integration_test.rs`

**Step 1: Write failing test**

```rust
#[test]
fn test_build_reel_project() {
    let conn = open_db();
    let project = project::build_reel_project(&conn, "mishary", 1, 1, 7, None)
        .expect("Failed to build reel project");

    assert_eq!(project.mode, project::ProjectMode::Reel,
        "Project mode should be Reel");

    // Reel has: Background, Audio, ArabicText, Highlights, Translation
    assert_eq!(project.timeline.tracks.len(), 5,
        "Reel project should have 5 tracks");
    assert_eq!(project.timeline.tracks[0].track_type, project::TrackType::Background);
    assert_eq!(project.timeline.tracks[1].track_type, project::TrackType::Audio);
    assert_eq!(project.timeline.tracks[2].track_type, project::TrackType::TextArabic);
    assert_eq!(project.timeline.tracks[3].track_type, project::TrackType::Highlight);
    assert_eq!(project.timeline.tracks[4].track_type, project::TrackType::TextTranslation);

    // Default export: 9:16 vertical
    assert_eq!(project.export_settings.width, 1080);
    assert_eq!(project.export_settings.height, 1920);
}
```

**Step 2:** Run test — FAIL

**Step 3: Implement `build_reel_project`**

Similar to Caption but adds Background track (solid color default) and Highlight track (word-level karaoke). Uses the shared `build_ayah_text_blocks` and `build_translation_blocks` helpers.

**Step 4:** Run tests — PASS

**Step 5:** Commit: `feat: add Reel mode project builder`

---

### Task 5: Long-form Mode Project Builder (Rust)

**Files:**
- Modify: `core/src/project.rs`
- Test: `core/tests/integration_test.rs`

**Step 1: Write failing test**

```rust
#[test]
fn test_build_longform_project() {
    let conn = open_db();
    let project = project::build_longform_project(&conn, "mishary", 1, 1, 7, None)
        .expect("Failed to build longform project");

    assert_eq!(project.mode, project::ProjectMode::LongForm,
        "Project mode should be LongForm");

    // LongForm: Background, Audio, ArabicText, Highlights, Translation, Cards
    assert_eq!(project.timeline.tracks.len(), 6,
        "LongForm project should have 6 tracks");
    assert_eq!(project.timeline.tracks[5].track_type, project::TrackType::Card);

    // Cards should include surah title
    let card_track = &project.timeline.tracks[5];
    assert!(!card_track.blocks.is_empty(), "Card track should have at least a surah title card");

    // Default export: 16:9 horizontal
    assert_eq!(project.export_settings.width, 1920);
    assert_eq!(project.export_settings.height, 1080);
}
```

**Step 2:** Run test — FAIL

**Step 3: Implement `build_longform_project`**

Same as Reel but: 16:9 orientation, adds Card track with surah title + bismillah blocks at the start.

**Step 4:** Run tests — PASS

**Step 5:** Commit: `feat: add LongForm mode project builder`

---

### Task 6: Update Tauri Commands and Frontend Hooks

**Files:**
- Modify: `desktop/src-tauri/src/commands.rs`
- Modify: `desktop/src/hooks/useTauri.ts`

**Step 1: Update `create_project` Tauri command**

Dispatch on mode string to call the right builder:

```rust
let project = match mode.as_str() {
    "mushaf" => project::build_mushaf_project(&conn, &reciter_id, surah, ayah_start, ayah_end, Some(&data_dir)),
    "caption" => project::build_caption_project(&conn, &reciter_id, surah, ayah_start, ayah_end, Some(&data_dir)),
    "reel" => project::build_reel_project(&conn, &reciter_id, surah, ayah_start, ayah_end, Some(&data_dir)),
    "long_form" => project::build_longform_project(&conn, &reciter_id, surah, ayah_start, ayah_end, Some(&data_dir)),
    _ => return Err(format!("Unknown project mode: {}", mode).into()),
};
```

**Step 2: Update useTauri.ts mock**

Update `createMockProject` to handle all modes, generating mode-appropriate tracks.

**Step 3:** Run `cargo check --workspace && cd desktop && npm test` — PASS

**Step 4:** Commit: `feat: wire new modes through Tauri IPC and mock data`

---

### Task 7: Enable Mode Selection in NewProjectDialog

**Files:**
- Modify: `desktop/src/components/ProjectLibrary/NewProjectDialog.tsx`

**Step 1: Remove `disabled` from mode buttons**

Change `disabled` to only disable if mode is not implemented:
```tsx
<ToggleGroupItem value="caption" className="flex-1 text-xs">Caption</ToggleGroupItem>
<ToggleGroupItem value="reel" className="flex-1 text-xs">Reel</ToggleGroupItem>
<ToggleGroupItem value="longform" className="flex-1 text-xs">Long-form</ToggleGroupItem>
<ToggleGroupItem value="mushaf" className="flex-1 text-xs">Mushaf</ToggleGroupItem>
```

**Step 2: Run E2E test for mode selection**

Add to `e2e/project-creation.spec.ts`:
```typescript
test("can select Caption mode and create project", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /New/ }).click();
  await page.getByText("Caption").click();
  // Continue with reciter/surah selection...
});
```

**Step 3:** Commit: `feat: enable Caption/Reel/LongForm mode selection in UI`

---

### Task 8: Mode-Aware Preview Renderer (Frontend)

**Files:**
- Modify: `desktop/src/components/Preview/PreviewPanel.tsx`

**Step 1: Add mode dispatch**

```tsx
switch (project.mode) {
  case "mushaf":
    return renderMushafPreview(/* existing logic */);
  case "caption":
    return renderCaptionPreview(project, playheadMs, ctx, width, height);
  case "reel":
    return renderReelPreview(project, playheadMs, ctx, width, height);
  case "long_form":
    return renderLongFormPreview(project, playheadMs, ctx, width, height);
}
```

**Step 2: Implement caption preview**

Renders dark background + centered Arabic text for the active ayah + translation below. Active word highlighted with color change.

**Step 3: Implement reel preview**

Renders background color/image + large centered Arabic ayah text + word-level karaoke highlight (active word in accent color) + smaller translation below.

**Step 4: Implement longform preview**

Same as reel but 16:9 aspect ratio, includes ayah number on the side.

**Step 5:** Run `npm test && npx playwright test` — PASS

**Step 6:** Commit: `feat: add mode-aware preview rendering for Caption/Reel/LongForm`

---

### Task 9: Mode-Aware Inspector Panel

**Files:**
- Modify: `desktop/src/components/Inspector/InspectorPanel.tsx`

**Step 1: Add mode-specific inspector sections**

- **Caption**: Text style (font size, color, position, background box), translation toggle
- **Reel**: Background settings, text style, karaoke highlight color, transition between ayahs
- **LongForm**: Same as Reel + card style settings

Reuse existing inspector sections where possible (Highlight section works for all modes that have word-level highlights).

**Step 2:** Run tests — PASS

**Step 3:** Commit: `feat: add mode-specific inspector panels`

---

### Task 10: Mode-Aware Export Pipeline (Rust)

**Files:**
- Modify: `core/src/renderer.rs`

**Step 1: Write test for caption export structure**

```rust
#[test]
fn test_caption_export_builds_valid_command() {
    // Test that export_video dispatches to the right mode handler
    // (We can't run FFmpeg in CI, but we can verify command construction)
}
```

**Step 2: Add mode dispatch to `export_video`**

```rust
pub fn export_video(...) -> Result<PathBuf> {
    match project.mode {
        ProjectMode::Mushaf => export_mushaf_video(/* existing */),
        ProjectMode::Caption => export_caption_video(project, settings, ffmpeg_path, output_dir, progress, cancel),
        ProjectMode::Reel => export_reel_video(project, settings, ffmpeg_path, output_dir, progress, cancel),
        ProjectMode::LongForm => export_longform_video(project, settings, ffmpeg_path, output_dir, progress, cancel),
    }
}
```

**Step 3: Implement caption export**

FFmpeg `drawtext` filter chain: one `drawtext` per ayah block with `enable='between(t,start,end)'`.

**Step 4: Implement reel export**

Background image loop + `drawtext` filters for Arabic text + translation, word-level highlight via `drawbox` with enable expressions.

**Step 5: Implement longform export**

Same as reel but 16:9, adds card segments via concat.

**Step 6:** Run `cargo test && cargo clippy` — PASS

**Step 7:** Commit: `feat: add Caption/Reel/LongForm FFmpeg export pipelines`

---

### Task 11: Integration Tests and E2E Verification

**Files:**
- Modify: `core/tests/integration_test.rs`
- Modify: `desktop/src/__tests__/workflows/`
- Modify: `desktop/e2e/`

**Step 1: Add Rust integration tests for all 3 builders**

Verify each builder produces correct track layouts, block counts, timing, and serialization.

**Step 2: Add Vitest workflow tests**

Test mode-specific store behavior: opening Caption/Reel/LongForm projects, verifying track types render correctly in the store.

**Step 3: Add E2E tests**

Test creating projects in each mode via the UI dialog and verifying the editor renders correctly.

**Step 4:** Run full CI: `cargo test && npm test && npx playwright test` — ALL PASS

**Step 5:** Commit: `test: comprehensive tests for Caption/Reel/LongForm modes`

---

## Execution Order

Tasks 1-2 are foundational (types). Tasks 3-5 are parallel (one per mode). Task 6 wires them through. Tasks 7-9 are frontend (can parallelize). Task 10 is export. Task 11 is verification.

```
[1: Data Model] → [2: TS Types] → [3,4,5: Builders (parallel)] → [6: IPC] → [7,8,9: Frontend (parallel)] → [10: Export] → [11: Tests]
```

Estimated: ~10 tasks, each 5-15 minutes of implementation.
