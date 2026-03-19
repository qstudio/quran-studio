# Quran Studio - Technical Specification

**Author**: Ahmed Nasr
**Date**: March 2026
**Status**: Draft
**Based on**: Quran Studio PRD v2

---

## MVP Roadmap

This spec is organized by MVP phase. Each phase is self-contained with its own architecture decisions, implementation details, and ship criteria. Phase 0 (POC) is complete -- the core pipeline works. We start at Phase 1.

---

# Phase 1: Mushaf Mode + Timeline Editor (Desktop)

**Goal**: Ship a Tauri desktop app with a visual timeline editor and Mushaf Mode working end-to-end. Pre-aligned reciters only. Mac first.

## P1: What We're Building

A native desktop app that looks and feels like a video editor (think iMovie/CapCut), but purpose-built for Quran:

1. Open the app, see your project library
2. New Project -> Mushaf Mode -> pick reciter -> pick surah
3. AI populates the timeline: audio waveform, mushaf pages, highlight overlay, all synced
4. Press spacebar. Preview plays above the timeline with word-by-word highlighting.
5. Adjust highlight style, color, timing on the timeline. Or don't -- defaults are good.
6. Hit Export. Get an MP4.

## P1: Tech Stack

```
Tauri 2.0
├── Frontend: React + TypeScript + Vite
│   ├── Timeline editor (custom component)
│   │   ├── Audio waveform renderer (WaveSurfer.js or custom canvas)
│   │   ├── Track lanes (mushaf pages, highlight overlay)
│   │   ├── Playhead with scrubbing
│   │   ├── Block placement and interaction
│   │   └── Zoom controls
│   ├── Preview panel (HTML5 Canvas compositing)
│   ├── Inspector panel (context-sensitive sidebar)
│   ├── Project library (home screen)
│   └── Reciter/surah browser
│
├── Backend: Rust
│   ├── quran-data     # SQLite: text, translations, coordinates
│   ├── alignment      # load pre-computed timestamp files
│   ├── project        # timeline state, save/load, AI builder
│   ├── preview        # frame-at-timestamp generator
│   └── renderer       # FFmpeg export pipeline
│
└── Bundled Data
    ├── mushaf/        # 604 page images (Madani mushaf)
    ├── db/            # quran.sqlite (text + coordinates + translations)
    ├── alignments/    # pre-computed word timestamps per reciter per surah
    └── ffmpeg         # bundled ffmpeg binary
```

## P1: Timeline Architecture

### Timeline Data Model

```typescript
interface Project {
  id: string;
  name: string;
  mode: "mushaf" | "reel" | "longform" | "caption";
  createdAt: string;
  updatedAt: string;
  timeline: Timeline;
  exportSettings: ExportSettings;
}

interface Timeline {
  duration_ms: number;           // total project duration
  tracks: Track[];
  playhead_ms: number;           // current playhead position
  zoom: number;                  // pixels per second
  scroll_x: number;              // horizontal scroll offset
}

interface Track {
  id: string;
  type: "audio" | "mushaf_page" | "highlight" | "text" | "translation" | "background" | "card";
  label: string;
  locked: boolean;
  visible: boolean;
  blocks: Block[];
}

interface Block {
  id: string;
  start_ms: number;
  end_ms: number;
  // Type-specific data:
  data: AudioBlockData | MushafPageBlockData | HighlightBlockData | TextBlockData;
}

// Mushaf Mode blocks:
interface MushafPageBlockData {
  type: "mushaf_page";
  page_number: number;           // 1-604
  image_path: string;
  transition_in: "cut" | "crossfade";
  transition_duration_ms: number;
}

interface HighlightBlockData {
  type: "highlight";
  // One highlight block per word
  surah: number;
  ayah: number;
  word_position: number;
  x: number;
  y: number;
  width: number;
  height: number;
  style: HighlightStyle;
}

interface HighlightStyle {
  type: "golden_glow" | "blue_box" | "underline";
  color: string;                 // hex
  opacity: number;               // 0.0 - 1.0
  padding: number;               // pixels around word bounds
}

interface AudioBlockData {
  type: "audio";
  audio_path: string;
  waveform: Float32Array;        // pre-computed waveform peaks
}

interface ExportSettings {
  format: "mp4";
  codec: "h264";
  resolution: "720p" | "1080p" | "4k";
  aspect_ratio: "9:16" | "16:9" | "1:1";
  fps: 30;
}
```

### Timeline Component Architecture

```
TimelineEditor (React component)
├── TimelineToolbar
│   ├── PlayControls (play/pause, skip forward/back)
│   ├── ZoomSlider
│   └── TimeDisplay (current position / total duration)
│
├── TimelineCanvas (HTML5 Canvas, handles all rendering)
│   ├── TrackHeaders (left sidebar: track labels, lock/visibility toggles)
│   ├── TrackLanes
│   │   ├── AudioTrack (waveform rendering)
│   │   ├── MushafPageTrack (page thumbnails as blocks)
│   │   ├── HighlightTrack (word highlight blocks, tiny, dense)
│   │   └── TranslationTrack (optional, text blocks)
│   ├── Playhead (red vertical line, draggable)
│   ├── TimeRuler (top: timestamps in mm:ss format)
│   └── AyahMarkers (vertical lines at ayah boundaries, labeled)
│
└── TimelineInteraction (event handlers)
    ├── Scrubbing (click/drag on ruler or playhead)
    ├── Block selection (click on block)
    ├── Block resize (drag block edges)
    ├── Block move (drag block body)
    ├── Zoom (scroll wheel / pinch)
    └── Pan (shift+scroll or middle mouse)
```

### Why Canvas over DOM?

Timelines with hundreds of blocks (one per word for a full surah -- Al-Baqarah has 6,236 words) need canvas rendering. DOM-based timelines hit performance walls around 500-1000 elements. Canvas can render 10,000+ blocks at 60fps.

### Preview Panel

The preview sits above the timeline. It's a Canvas element that composites the current frame:

```typescript
// Preview rendering (runs every frame during playback, on scrub)
function renderPreviewFrame(timestamp_ms: number, project: Project): void {
  const canvas = previewCanvasRef.current;
  const ctx = canvas.getContext("2d");

  // 1. Find which mushaf page is active at this timestamp
  const pageBlock = findActiveBlock(project.timeline.tracks, "mushaf_page", timestamp_ms);

  // 2. Draw the mushaf page
  ctx.drawImage(pageBlock.image, 0, 0, canvas.width, canvas.height);

  // 3. Find which word is highlighted at this timestamp
  const highlightBlock = findActiveBlock(project.timeline.tracks, "highlight", timestamp_ms);

  // 4. Draw the highlight overlay
  if (highlightBlock) {
    drawHighlight(ctx, highlightBlock.data, project.timeline.highlightStyle);
  }

  // 5. Draw translation bar if enabled
  const translationBlock = findActiveBlock(project.timeline.tracks, "translation", timestamp_ms);
  if (translationBlock) {
    drawTranslationBar(ctx, translationBlock.data);
  }
}
```

This is lightweight compositing -- no FFmpeg involved. Just canvas drawing. Fast enough for 30fps+ real-time preview.

### Inspector Panel

Context-sensitive sidebar. Changes based on what's selected:

| Selection | Inspector Shows |
|---|---|
| Nothing | Project settings: reciter, surah range, export settings |
| Mushaf page block | Page number, transition type, transition duration |
| Highlight block (or multiple) | Style type, color picker, opacity slider, padding |
| Translation block | Language selector, translator selector, font, size, position |
| Audio track | Volume (future: EQ) |

## P1: AI Project Builder

When the user creates a new Mushaf Mode project, the backend builds the entire timeline automatically:

```rust
fn build_mushaf_project(reciter: &str, surah: u16, ayah_range: (u16, u16)) -> Project {
    // 1. Load pre-computed alignment for this reciter + surah
    let alignment = load_alignment(reciter, surah);

    // 2. Filter to requested ayah range
    let words = alignment.words_in_range(ayah_range);

    // 3. Determine which mushaf pages are needed
    let pages = get_pages_for_words(&words);

    // 4. Build audio track
    let audio_track = Track {
        type_: "audio",
        blocks: vec![AudioBlock {
            start_ms: words.first().start_ms,
            end_ms: words.last().end_ms,
            audio_path: get_reciter_audio_path(reciter, surah),
            waveform: compute_waveform(audio_path),
        }],
    };

    // 5. Build mushaf page track (one block per page)
    let page_track = Track {
        type_: "mushaf_page",
        blocks: pages.iter().map(|page| {
            let first_word_on_page = words.iter().find(|w| w.page == page.number).unwrap();
            let last_word_on_page = words.iter().rev().find(|w| w.page == page.number).unwrap();
            MushafPageBlock {
                start_ms: first_word_on_page.start_ms,
                end_ms: last_word_on_page.end_ms,
                page_number: page.number,
                image_path: format!("mushaf/page_{:03}.png", page.number),
                transition_in: "crossfade",
                transition_duration_ms: 500,
            }
        }).collect(),
    };

    // 6. Build highlight track (one block per word)
    let highlight_track = Track {
        type_: "highlight",
        blocks: words.iter().map(|word| {
            HighlightBlock {
                start_ms: word.start_ms,
                end_ms: word.end_ms,
                surah: word.surah,
                ayah: word.ayah,
                word_position: word.word_position,
                x: word.x,
                y: word.y,
                width: word.width,
                height: word.height,
                style: default_highlight_style(),
            }
        }).collect(),
    };

    // 7. Assemble project
    Project {
        timeline: Timeline {
            duration_ms: words.last().end_ms - words.first().start_ms,
            tracks: vec![audio_track, page_track, highlight_track],
            playhead_ms: 0,
            zoom: default_zoom_for_duration(duration_ms),
            scroll_x: 0,
        },
        export_settings: default_export_settings(),
    }
}
```

## P1: Tauri IPC Commands

```rust
// Project management
#[tauri::command]
fn list_projects() -> Vec<ProjectSummary>

#[tauri::command]
fn create_project(mode: &str, reciter_id: &str, surah: u16, ayah_start: u16, ayah_end: u16) -> Project

#[tauri::command]
fn load_project(id: &str) -> Project

#[tauri::command]
fn save_project(project: Project) -> Result<(), String>

#[tauri::command]
fn delete_project(id: &str) -> Result<(), String>

#[tauri::command]
fn duplicate_project(id: &str) -> Project

// Data
#[tauri::command]
fn list_reciters() -> Vec<Reciter>

#[tauri::command]
fn list_surahs() -> Vec<Surah>

#[tauri::command]
fn get_surah_pages(surah: u16) -> Vec<u16>

// Preview
#[tauri::command]
fn get_preview_frame(project_id: &str, timestamp_ms: u64) -> Vec<u8>  // PNG bytes

#[tauri::command]
fn get_audio_waveform(reciter_id: &str, surah: u16) -> Vec<f32>  // peaks

// Export
#[tauri::command]
async fn export_video(project_id: &str, settings: ExportSettings) -> Result<String, String>

#[tauri::command]
fn get_export_progress() -> f32  // 0.0 - 1.0

#[tauri::command]
fn cancel_export() -> Result<(), String>
```

## P1: Data Schema

### quran.sqlite

```sql
CREATE TABLE words (
    id INTEGER PRIMARY KEY,
    surah INTEGER NOT NULL,
    ayah INTEGER NOT NULL,
    word_position INTEGER NOT NULL,
    text_uthmani TEXT NOT NULL,
    text_simple TEXT NOT NULL,
    page INTEGER NOT NULL,
    line INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL
);

CREATE TABLE translations (
    id INTEGER PRIMARY KEY,
    surah INTEGER NOT NULL,
    ayah INTEGER NOT NULL,
    language TEXT NOT NULL,
    translator TEXT NOT NULL,
    text TEXT NOT NULL
);

CREATE TABLE reciters (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    style TEXT,
    available_surahs TEXT NOT NULL  -- JSON array
);

CREATE TABLE alignments (
    id INTEGER PRIMARY KEY,
    reciter_id TEXT NOT NULL,
    surah INTEGER NOT NULL,
    ayah INTEGER NOT NULL,
    word_position INTEGER NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    FOREIGN KEY (reciter_id) REFERENCES reciters(id)
);

CREATE INDEX idx_alignments_lookup ON alignments(reciter_id, surah, ayah);
CREATE INDEX idx_words_lookup ON words(surah, ayah, word_position);
CREATE INDEX idx_words_page ON words(page);
```

## P1: FFmpeg Export Pipeline

### Strategy: Filter chain (not frame-by-frame)

```bash
# For each word, pre-generate a highlight overlay PNG (transparent background)
# Then use FFmpeg overlay filters with timed enable expressions

ffmpeg -loop 1 -i mushaf_page.png \
       -i highlight_word_1.png \
       -i highlight_word_2.png \
       ... \
       -i recitation_audio.mp3 \
       -filter_complex "
         [0:v][1:v]overlay=x=X1:y=Y1:enable='between(t,S1,E1)'[v1];
         [v1][2:v]overlay=x=X2:y=Y2:enable='between(t,S2,E2)'[v2];
         ...
       " \
       -map "[vout]" -map "N:a" \
       -c:v libx264 -preset fast -crf 18 \
       -c:a aac -b:a 192k \
       output.mp4
```

### Page Transitions
Multi-page surahs: render each page segment as intermediate, concat with crossfade via `xfade` filter.

### Aspect Ratio
- 9:16: Mushaf page centered vertically, letterboxed if needed, translation bar at bottom
- 16:9: Mushaf page centered horizontally, decorative borders on sides
- FFmpeg `scale` + `pad` filters handle this

## P1: Highlight Styles

```rust
enum HighlightStyle {
    GoldenGlow,   // semi-transparent gold rectangle with feathered edges
    BlueBox,      // blue outlined rectangle, sharp corners
    Underline,    // colored line beneath the word
}
```

Each style is rendered as a transparent PNG overlay per word. Pre-generated during project build and cached.

## P1: Bundle Size

| Component | Size |
|---|---|
| Mushaf page images (604 pages, compressed PNG) | ~300 MB |
| quran.sqlite (text + coords + translations + alignments) | ~50 MB |
| FFmpeg binary | ~80 MB |
| App binary (Tauri + Rust) | ~20 MB |
| **Ship size (no audio)** | **~450 MB** |

Reciter audio is downloaded on-demand:
- Each reciter: ~500 MB (114 surahs, 128kbps)
- First-run: downloads default reciter (Mishary)
- Subsequent reciters downloaded when selected

## P1: UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  Quran Studio               [Settings]  [Export]        │
├──────────────────────┬──────────────────────────────────┤
│                      │                                  │
│                      │       Preview Panel              │
│                      │   ┌──────────────────────┐       │
│   Inspector          │   │                      │       │
│   Panel              │   │  [Mushaf page with   │       │
│                      │   │   word highlight]     │       │
│   Style: Golden Glow │   │                      │       │
│   Color: [■ #FFD700] │   │                      │       │
│   Opacity: ████░ 0.6 │   └──────────────────────┘       │
│   Padding: 4px       │   [◀] [▶] [⏸] 01:23 / 04:56    │
│                      │   Aspect: [9:16] [16:9] [1:1]   │
│   Reciter: Mishary   │                                  │
│   Surah: Al-Baqarah  │──────────────────────────────────│
│   Ayah: 255-257      │  Timeline                        │
│                      │  00:00    00:30    01:00   01:30 │
│                      │  ├─────────┼─────────┼─────────┤ │
│                      │  Audio: ▃▅▇▆▃▁▃▅▇▅▃▁▃▅▇▆▃▁▃▅▇ │
│                      │  Pages: [P50      ][P51        ] │
│                      │  Hilite: [][][][][][][][][][][]  │
│                      │  ▲ playhead                      │
│                      │  [Zoom: ────●──────]             │
└──────────────────────┴──────────────────────────────────┘
```

## P1: Ship Criteria

- [ ] App launches on macOS (Apple Silicon + Intel)
- [ ] Project library: create, open, save, delete, duplicate projects
- [ ] Timeline editor: multi-track, scrubbing, zoom, playhead, ayah markers
- [ ] Preview panel: real-time compositing at 30fps+ during playback and scrub
- [ ] Can select from 5 reciters
- [ ] Can select any surah (1-114) and ayah range
- [ ] Highlight style and color customizable via inspector
- [ ] Page transitions work for multi-page surahs
- [ ] Export produces valid MP4 in 9:16 and 16:9
- [ ] Export completes in < 3x realtime
- [ ] Undo/redo works
- [ ] No crashes on happy path

---

# Phase 2: All Modes, Desktop + Web

**Goal**: Add Caption, Reel, and Long-form modes. Launch web version. Support custom audio upload.

## P2: New Mode Implementations

### Caption Mode - Timeline Layout

```
Tracks:
  Video:       [Source video footage                              ]
  Audio:       [Recitation audio ▃▅▇▆▃▁▃▅▇▅▃▁▃▅▇▆▃▁▃▅▇        ]
  Arabic:      [بسم الله][الرحمن][الرحيم][الحمد لله رب العالمين  ]
  Translation: [In the name...][The Most...][Lord of...           ]
```

Subtitle blocks snap to ayah boundaries. User can drag edges to adjust timing. Double-click a block to edit text. Style all subtitles via inspector (font, size, color, position, background box).

Export: FFmpeg `ass` filter to burn subtitles into source video.

### Reel Mode - Timeline Layout

```
Tracks:
  Background:  [Nature video or image loop                       ]
  Audio:       [Recitation audio ▃▅▇▆▃▁▃▅▇▅▃                   ]
  Arabic:      [Ayah 1 text  ][Ayah 2 text  ][Ayah 3 text      ]
  WordHighlight: [][][][]      [][][][][][]    [][][][][]
  Translation: [English 1    ][English 2     ][English 3        ]
```

One ayah displayed at a time, large centered typography. Background underneath. Word-by-word karaoke highlight within each ayah. Transition animations between ayat.

Export: FFmpeg `drawtext` filter with `enable` expressions for each text block.

### Long-form Mode - Timeline Layout

```
Tracks:
  Background:  [Background image/video                                         ]
  Audio:       [Full surah recitation ▃▅▇▆▃▁▃▅▇▅▃▁▃▅▇▆▃▁▃▅▇▅▃▁▃▅▇         ]
  Cards:       [Surah Title][Bismillah]                [Surah End Card        ]
  Arabic:      [Ayah 1][Ayah 2][Ayah 3]...[Ayah 286                          ]
  Translation: [Trans 1][Trans 2][Trans 3]...[Trans 286                       ]
  AyahNumbers: [1]      [2]     [3]        [286]
```

Same as reel but horizontal, with surah title/bismillah cards, ayah number indicators, and chapter markers for multi-surah.

## P2: Custom Audio Upload

### Architecture: Where ML runs

**Desktop**: Bundle `whisper.cpp` compiled as Rust library via FFI.
```rust
fn align_custom_audio(audio_path: &str, surah: u16) -> Vec<WordTimestamp> {
    let model = WhisperModel::load("models/whisper-base-ar.bin");
    let result = model.transcribe(audio_path, Language::Arabic);
    match_to_quran_text(result, surah)
}
```

**Web**: Server-side. Upload audio, server runs alignment, returns timestamps.

Model size: ~150 MB for base (bundled with app on desktop).

### Alignment-to-Timeline Flow

1. User uploads audio + selects surah
2. Backend runs forced alignment (whisper.cpp or server)
3. Backend returns `Vec<WordTimestamp>` (same format as pre-computed)
4. AI Project Builder creates timeline (same code path as pre-aligned)
5. Timeline opens -- user can adjust any misaligned words by dragging blocks

## P2: Web Architecture

```
┌─────────────┐     ┌──────────────────────┐
│   Browser    │────▶│    Axum Server        │
│  (React SPA) │◀────│                      │
│  Same UI as  │     │  Same Rust core      │
│  desktop     │     │  as desktop           │
└─────────────┘     │                      │
                    │  Whisper worker       │
                    │  FFmpeg workers (x3)  │
                    │  Temp object storage  │
                    └──────────────────────┘
```

### Web API

```
POST /api/projects                    # create project
GET  /api/projects                    # list projects
GET  /api/projects/:id                # load project
PUT  /api/projects/:id                # save project
DELETE /api/projects/:id              # delete project

POST /api/align                       # upload audio, get timestamps
  Body: multipart (audio file + surah number)
  Response: { alignment: WordTimestamp[] }

POST /api/export                      # trigger render
  Body: { project_id, settings }
  Response: { job_id }

GET  /api/export/:job_id/status       # poll render progress
  Response: { progress: 0.0-1.0, status }

GET  /api/export/:job_id/download     # download rendered MP4

GET  /api/reciters
GET  /api/surahs
GET  /api/translations/:lang
```

### Web Deployment
- Single VPS: Hetzner 4-core/8GB (~$20/month)
- Max 3 concurrent FFmpeg renders (CPU-bound)
- Temp video storage: local disk, auto-delete after 24h
- Frontend: static hosting (Cloudflare Pages)

## P2: Additional Frontend Features

### Background Picker (Reel/Long-form)
- 20 built-in backgrounds (nature, abstract, solid, gradient)
- Custom image/video upload
- Solid color picker
- Background added as a track block -- can be swapped per section

### Translation Picker
- 10 languages: English, French, Urdu, Turkish, Indonesian, Malay, Spanish, German, Bengali, Russian
- Multiple translators per language
- Translation track shows selected translation synced to Arabic

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Space | Play/pause |
| J / K / L | Reverse / pause / forward |
| Arrow left/right | Nudge playhead by 1 frame |
| Cmd+Z / Ctrl+Z | Undo |
| Cmd+Shift+Z | Redo |
| Cmd+S | Save project |
| Cmd+E | Export |
| +/- | Zoom in/out timeline |
| Delete | Remove selected block |

## P2: Ship Criteria

- [ ] All 4 modes working on desktop (Mac + Windows)
- [ ] Each mode has appropriate track layout and inspector options
- [ ] Web version deployed and functional
- [ ] Custom audio upload with ML alignment
- [ ] 20+ reciters
- [ ] 10 translation languages
- [ ] Background library for Reel/Long-form
- [ ] Windows support
- [ ] Keyboard shortcuts
- [ ] Batch export (split surah into individual reels)

---

# Phase 3: Mobile + Polish

**Goal**: iOS and Android apps with touch-optimized timeline. Server-side rendering for mobile. iMovie-level polish.

## P3: Mobile Timeline

The desktop timeline needs adaptation for touch:

### Touch Interactions

| Gesture | Action |
|---|---|
| Tap | Select block / set playhead |
| Long press | Context menu (delete, split, properties) |
| Drag | Move block or playhead |
| Drag block edge | Resize block timing |
| Pinch | Zoom timeline |
| Two-finger pan | Scroll timeline |
| Swipe up on track header | Expand track |

### Layout Adaptation

On phone screens (< 768px):
- Inspector panel becomes a bottom sheet (slides up when block is selected)
- Preview panel is always visible at top (compact)
- Timeline takes the middle section
- Track headers collapse to icons
- Zoom defaults to ayah-level (not word-level) to reduce clutter

On tablets:
- Same layout as desktop, slightly more compact

### Recording Mode

```rust
#[tauri::command]
fn start_recording() -> Result<(), String>

#[tauri::command]
fn stop_recording() -> Result<String, String>  // returns audio file path
```

Flow: User taps record -> selects surah -> recites -> stops -> audio uploaded to server for alignment -> timeline populated.

## P3: Server Infrastructure

```
Cloudflare CDN
    |
API Server (Axum, 1x 4-core)
    |
Worker Pool (FFmpeg, 2-4x 4-core, auto-scale on queue depth)
    |
Object Store (Cloudflare R2 or S3, auto-expire 24h)
```

Estimated cost: $60-100/month for 1,000 renders/day.

## P3: iOS/Android Specifics

### iOS
- Tauri 2.0 -> WKWebView + Rust static library
- Permissions: `NSMicrophoneUsageDescription`, `NSPhotoLibraryAddUsageDescription`
- Share sheet integration for exporting videos
- App Store: standard review, no 4.7 concerns (it's a video editor)

### Android
- Tauri 2.0 -> Android WebView + Rust shared library (.so)
- Permissions: `RECORD_AUDIO`, `WRITE_EXTERNAL_STORAGE`
- Share intent for exporting

## P3: Polish Checklist

- [ ] Onboarding flow (first-run: show how timeline works, 3 screens max)
- [ ] Arabic UI localization
- [ ] Dark mode (default and only mode)
- [ ] Haptic feedback on mobile (block selection, playhead snap)
- [ ] Share sheet integration
- [ ] Crash reporting (Sentry)
- [ ] Privacy-respecting analytics (opt-in)
- [ ] App icons and splash screens
- [ ] 40+ reciters
- [ ] Smooth 60fps timeline scrolling on all platforms
- [ ] Loading states and skeleton UI (no blank screens)
- [ ] Empty states (no projects yet, no reciter downloaded)

## P3: Ship Criteria

- [ ] iOS on App Store, Android on Play Store
- [ ] Touch timeline works well (pinch zoom, drag blocks, scrub)
- [ ] Recording mode functional
- [ ] Server handles 1,000 renders/day
- [ ] Arabic + English UI
- [ ] Onboarding complete
- [ ] 40+ reciters available
- [ ] No "web wrapper" feel -- native-feeling interactions

---

# Phase 4: Community + Scale (Ongoing)

## Community Features
- Community reciter alignment packs (standard JSON format, submit via PR)
- Additional mushaf styles (IndoPak, tajweed color-coded)
- Translation corrections via GitHub
- Plugin system for custom renderers/effects

## Scale Features
- YouTube/TikTok/Instagram direct posting
- Word-level timestamp fine-tuning on timeline
- Tajweed color highlighting in Mushaf Mode
- Offline mode for mobile (pre-download reciters)
- CDN for reciter audio
- Auto-scaling render workers
- Public API for programmatic video generation

## Governance
- Open-source contributions via GitHub PRs
- Islamic advisory board for content accuracy
- Community moderators for reciter pack quality
- Transparent roadmap

---

# Appendix A: Repo Structure

```
quran-studio/
├── core/                   # Rust core library
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── alignment/      # forced alignment + pre-computed loader
│       ├── quran_data/     # SQLite access
│       ├── project/        # timeline state, AI builder, save/load
│       ├── preview/        # frame-at-timestamp for real-time preview
│       └── renderer/       # FFmpeg export pipeline
│           ├── mod.rs
│           ├── mushaf.rs
│           ├── reel.rs
│           ├── longform.rs
│           └── caption.rs
│
├── desktop/                # Tauri desktop app
│   ├── src-tauri/
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   └── commands.rs
│   │   └── tauri.conf.json
│   └── src/                # React frontend
│       ├── App.tsx
│       ├── components/
│       │   ├── Timeline/
│       │   │   ├── TimelineEditor.tsx
│       │   │   ├── TimelineCanvas.tsx   # canvas-based track rendering
│       │   │   ├── AudioTrack.tsx
│       │   │   ├── Playhead.tsx
│       │   │   ├── TimeRuler.tsx
│       │   │   └── BlockInteraction.tsx
│       │   ├── Preview/
│       │   │   ├── PreviewPanel.tsx
│       │   │   └── PreviewCanvas.tsx    # real-time compositing
│       │   ├── Inspector/
│       │   │   ├── InspectorPanel.tsx
│       │   │   ├── HighlightInspector.tsx
│       │   │   ├── TextInspector.tsx
│       │   │   └── ProjectInspector.tsx
│       │   ├── ProjectLibrary/
│       │   │   └── ProjectLibrary.tsx
│       │   └── ReciterBrowser/
│       │       └── ReciterBrowser.tsx
│       ├── hooks/
│       │   ├── useTimeline.ts          # timeline state management
│       │   ├── usePlayback.ts          # audio playback + sync
│       │   ├── useProject.ts           # project CRUD
│       │   └── usePreview.ts           # preview rendering loop
│       └── stores/
│           └── projectStore.ts         # Zustand project state
│
├── mobile/                  # Tauri mobile
│   ├── src-tauri/
│   └── src/                 # shared React frontend (responsive)
│
├── web/                     # Web server
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── routes/
│       ├── workers/
│       └── storage/
│
├── data/
│   ├── mushaf/              # 604 page images (git-lfs)
│   ├── db/                  # quran.sqlite
│   ├── alignments/          # pre-computed JSON per reciter
│   └── scripts/             # data ingestion scripts
│
├── README.md
├── LICENSE                  # MIT
├── CONTRIBUTING.md
└── .github/workflows/
```

# Appendix B: Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Core language | Rust | Performance, cross-platform, bundles into Tauri |
| App framework | Tauri 2.0 | Desktop + mobile from one codebase |
| Frontend | React + TypeScript | Largest ecosystem, most contributors |
| Timeline rendering | HTML5 Canvas | DOM can't handle 1000+ blocks at 60fps |
| Preview rendering | HTML5 Canvas compositing | Lightweight, no FFmpeg needed for preview |
| State management | Zustand | Simple, performant, fits timeline use case |
| Database | SQLite (embedded) | No server dependency, fast reads |
| Video export | FFmpeg (bundled binary) | Industry standard, filter chain approach |
| Forced alignment (pre-computed) | Quran.com API + batch processing | One-time cost, instant project creation |
| Forced alignment (custom) | whisper.cpp (desktop) / server (web/mobile) | On-device for desktop, server for mobile |
| Mushaf images | King Fahd Complex / Quran.com | Standard Madani mushaf |
| Word coordinates | quran/quran.com-images repo | MIT licensed |
| Hosting | Hetzner VPS + Cloudflare | Cost-effective |
| Reciter audio | On-demand download | Keeps initial bundle small |

# Appendix C: External Dependencies

| Dependency | Version | License | Used For |
|---|---|---|---|
| Tauri | 2.x | MIT/Apache-2.0 | App framework |
| React | 18.x | MIT | Frontend |
| Zustand | 4.x | MIT | State management |
| FFmpeg | 6.x | LGPL-2.1 | Video rendering |
| whisper.cpp | latest | MIT | Custom audio alignment |
| SQLite | 3.x | Public domain | Data storage |
| Axum | 0.7.x | MIT | Web server |
| WaveSurfer.js | 7.x | BSD-3 | Audio waveform (if used) |
