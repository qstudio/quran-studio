# Quran Studio - Product Requirements Document

**Author**: Ahmed Nasr
**Date**: March 2026
**Status**: Draft
**License**: Open Source (sadaqah jariyah)

---

## 1. Overview

### 1.1 What is Quran Studio?
Quran Studio is an open-source, AI-powered video editor purpose-built for Quran recitation content. Think iMovie, but every feature is designed around Quranic audio: the timeline understands ayat, the text layer knows Uthmani script, and the alignment engine syncs words to audio automatically.

Users provide audio (their own recitation or a popular reciter), and the editor generates a project with synchronized Arabic text, translations, and mushaf page highlighting -- ready to tweak on a visual timeline or export immediately.

### 1.2 Mission
Make it effortless for anyone to create beautiful Quran content for social media, education, and da'wah. Free, open source, for the sake of Allah.

### 1.3 One-liner
The video editor built for Quran. Drop in a recitation, get a timeline-ready project with word-perfect sync. Caption, reel, long-form, or mushaf -- edit visually, export instantly.

---

## 2. Problem Statement

### 2.1 The Pain
Quran recitation videos are among the most viewed Islamic content online. Top channels get 50M-500M views per video. But creating these videos is painful:

- **Manual sync is tedious**: Editors align audio to text frame-by-frame in Premiere/CapCut. A 10-minute surah video takes hours.
- **Mushaf videos are nearly impossible manually**: Word-by-word highlighting on actual mushaf pages requires keyframing every single word. Almost nobody does it because it's too labor-intensive.
- **Existing tools are limited**: Current apps (Asaloun, NurMontage) are Android-only, template-based, and lack AI-powered alignment. QuranCaption is desktop-only with complex setup requirements.
- **No cross-platform solution exists**: Nothing works across desktop, web, and mobile.
- **Translations are an afterthought**: Adding synchronized translations in multiple languages requires even more manual work.
- **No editor understands Quran structure**: General video editors have no concept of ayat, surahs, or recitation pacing. Every edit is manual.

### 2.2 Who Feels This Pain

| User Segment | Pain Level | Size |
|---|---|---|
| Quran YouTube/TikTok creators | Extreme -- spend hours per video | Tens of thousands |
| Mosque social media managers | High -- need weekly content, no editing skills | Hundreds of thousands |
| Islamic educators/teachers | Medium -- want teaching material with visual aids | Hundreds of thousands |
| Quran students | Medium -- want to see their recitation on mushaf | Millions |
| Casual Muslims sharing ayat | Low -- want quick beautiful shares | Tens of millions |

### 2.3 Current Alternatives

| Tool | What it does | What it lacks |
|---|---|---|
| QuranCaption | AI subtitle generation, desktop | Desktop-only, complex setup, no mushaf mode, no visual editor |
| Asaloun | Android Quran video editor | No AI, no web/iOS/desktop, template-based, no timeline |
| NurMontage | Android Quran reel maker | No AI, no web/iOS/desktop, basic |
| CapCut/Premiere | General video editing | Manual everything, no Quran-specific features |
| Quran.com web player | Word highlighting in browser | Not a video, can't export |

---

## 3. Solution

### 3.1 The Editor

Quran Studio is a **project-based video editor** with a Quran-aware timeline. When you create a new project:

1. **Pick a mode** (Caption, Reel, Long-form, or Mushaf)
2. **Add your audio** (upload, record, or pick a reciter)
3. **AI builds the project** -- alignment, text layers, styling, all placed on the timeline automatically
4. **The timeline opens** with everything ready. Playback syncs audio to visuals in real-time.
5. **Edit or export** -- adjust anything on the timeline, or export immediately if the defaults look good.

The timeline is the core interface. Not a settings form. Not a wizard. An actual visual editor where you see your audio waveform, your text blocks, your mushaf pages, and your style layers -- all laid out in time.

### 3.2 Four Modes

**Mode 1: Caption Mode**
- Input: Existing video + recitation audio (uploaded or from library)
- Output: Source video with synchronized Arabic/translation subtitles burned in
- Timeline: Video track (source footage) + subtitle tracks (Arabic, translation) on top
- Use case: Creator has nature footage or lecture clip and wants Quran captions overlaid

**Mode 2: Reel Mode (Short-form)**
- Input: Audio file (upload, record, or select from reciter library)
- Output: Vertical (9:16) video with styled Arabic text on customizable backgrounds
- Timeline: Background track + audio track + text blocks (one per ayah) with word-level highlights
- Use case: Quick social media reels -- one ayah or a few ayat, punchy, shareable

**Mode 3: Long-form Video Mode**
- Input: Audio file (upload, record, or select from reciter library)
- Output: Horizontal (16:9) or vertical video with styled Arabic text on backgrounds
- Timeline: Same as Reel but with surah title cards, bismillah cards, and transitions between ayat
- Use case: Full surah or extended recitation videos for YouTube channels

**Mode 4: Mushaf Mode**
- Input: Audio file (upload, record, or select from reciter library)
- Output: Video of actual Madani mushaf pages with word-by-word highlighting synced to recitation
- Timeline: Mushaf page track (pages auto-placed at correct timestamps) + highlight overlay track + optional translation bar
- Use case: The classic "scrolling mushaf" YouTube/reel format, fully automated
- Comparable to: Nothing. This does not exist anywhere.

### 3.3 Mode Comparison Matrix

| | Caption | Reel | Long-form | Mushaf |
|---|---|---|---|---|
| **Primary input** | Existing video + audio | Audio | Audio | Audio |
| **Visual style** | User's footage + subtitle overlay | Styled text on backgrounds | Styled text on backgrounds | Actual mushaf pages |
| **Timeline tracks** | Video, Arabic subs, translation subs | Background, audio, text blocks | Background, audio, text blocks, cards | Mushaf pages, highlight, translation bar |
| **Text display** | Subtitles (bottom/top) | One ayah at a time, centered | Ayah-by-ayah with transitions | Word-by-word on mushaf page |
| **Translation** | Subtitle track below Arabic | Below ayah text | Below ayah text | Optional bar at bottom |
| **Typical duration** | Any | 15s-90s | 5min-60min+ | Any |
| **Typical format** | 9:16 or 16:9 (matches source) | 9:16 (vertical) | 16:9 (horizontal) | 9:16 or 16:9 |
| **Target platform** | Any | TikTok, Reels, Shorts | YouTube | YouTube, Reels |
| **Unique value** | Add Quran to any footage | Instant beautiful reels | Full surah, professional quality | Word-level mushaf sync (only tool that does this) |

### 3.4 UX Philosophy: Instant Timeline, Full Control

**The iMovie Principle**: When you import a clip into iMovie, it doesn't ask you 15 questions. It drops everything onto the timeline with sensible defaults. You can export immediately or edit for hours. Quran Studio works the same way.

**Project creation flow:**
1. New Project -> pick mode -> add audio/video
2. AI processes (alignment, surah detection, styling) -- takes seconds for pre-aligned reciters
3. **Timeline opens, fully populated**. Audio waveform on the bottom. Visual layers above. Playhead ready.
4. Press spacebar to preview. Everything syncs.
5. Happy? Hit Export. Want changes? Drag, click, adjust -- it's all right there.

**Key principle**: The AI-generated timeline must be good enough that 80% of users export without editing. The editor exists for the 20% who want control. But the editor IS the interface -- there's no separate "simple mode" that hides the timeline.

**The timeline adapts to the mode:**
- **Caption**: Subtitle blocks snap to ayah boundaries. Drag to adjust timing. Double-click to edit text.
- **Reel**: Text blocks are large, one per ayah. Background layer underneath. Drag to reorder, resize, restyle.
- **Long-form**: Same as reel, plus transition markers between ayat, surah card blocks at boundaries.
- **Mushaf**: Page images as blocks on the timeline. Highlight overlay as a separate track. Word boundaries visible as tick marks on the audio waveform.

### 3.5 Timeline Editor Features

**Tracks:**
- Audio track (waveform visualization, recitation audio)
- Visual track (mushaf pages, backgrounds, or source video depending on mode)
- Arabic text track (ayah blocks or subtitle segments)
- Translation track (synced to Arabic text)
- Overlay track (highlights, decorative elements)
- Card track (bismillah, surah title, transition cards)

**Timeline interactions:**
- **Scrub**: Drag playhead, preview updates in real-time
- **Zoom**: Pinch/scroll to zoom into word-level precision or zoom out for surah-level overview
- **Snap**: Text blocks snap to ayah/word boundaries from alignment data
- **Split**: Split an ayah block at any point (creates a cut)
- **Adjust timing**: Drag the edges of any text/highlight block to adjust start/end
- **Restyle**: Click any block, sidebar shows style options for that element
- **Reorder**: Drag text blocks to reorder (useful for reel mode)
- **Add**: Insert custom text blocks, cards, pauses, transitions from a toolbar

**Preview panel:**
- Real-time preview above the timeline
- Shows exactly what the export will look like at the current playhead position
- Play/pause/scrub controls
- Aspect ratio toggle (preview in 9:16, 16:9, or 1:1)

**Inspector panel (sidebar):**
- Context-sensitive -- shows properties of whatever's selected
- Text block selected: font, size, color, glow, shadow, alignment, animation
- Background selected: image/video/color, opacity, blur
- Mushaf page selected: highlight style, highlight color, zoom level
- Translation selected: language, translator, font, position
- Nothing selected: project-wide settings (resolution, format, reciter, surah range)

### 3.6 Multi-Surah Handling

When a user uploads audio containing more than one surah:

1. **Auto-detection**: The forced alignment engine identifies surah boundaries (detecting bismillah between surahs, or silence gaps)
2. **Chapter markers**: Timeline shows chapter markers at surah boundaries
3. **User choice**:
   - **Single project**: Keep everything on one timeline with surah transition cards between surahs
   - **Split projects**: One click to split into separate projects (one per surah)
   - **Select range**: Drag to select a portion of the timeline, export just that section
4. **Playlist export** (long-form): Export as single video with chapter timestamps for YouTube description

### 3.7 Clip and Trim

Built into the timeline, not a separate tool:

- **Audio trimming**: Select a region on the audio waveform, right-click -> "Trim to selection" or set in/out points
- **Video trimming** (Caption mode): Same interaction on the video track
- **Ayah range selection**: Click first ayah, shift-click last ayah -- everything outside grays out, one click to trim
- **Smart split**: Right-click -> "Split into reels" -- AI suggests natural break points (end of ayah, ruku boundaries, silence gaps). Each segment becomes its own project in the project library.
- **Batch export**: Select multiple segments, export all at once

### 3.8 Shared Core Pipeline

All four modes share the same backend:

```
Audio/Video Input
    |
    v
[Forced Alignment Engine]
    |-- Auto-detect surah(s) and ayah range
    |-- Multi-surah boundary detection
    |-- Word-level timestamps
    |
    v
[Project Builder]
    |-- Creates timeline with mode-appropriate tracks
    |-- Places text/mushaf/subtitle blocks at correct timestamps
    |-- Applies default styling per mode
    |
    v
[Timeline Editor] <-> [Preview Engine]
    |-- Real-time preview of current playhead
    |-- Non-destructive editing
    |-- All changes stored as project state
    |
    v
[Rendering Engine]
    |-- FFmpeg pipeline
    |-- Mode 1: Subtitle burn-in on source video
    |-- Mode 2: Text-on-background, vertical
    |-- Mode 3: Text-on-background, horizontal + cards
    |-- Mode 4: Mushaf pages + word highlight overlay
    |
    v
MP4 Output (9:16, 16:9, 1:1)
```

### 3.9 Input Methods

1. **Upload audio**: MP3, M4A, WAV, OGG
2. **Record**: Built-in recorder (mobile/desktop)
3. **Select reciter**: Pre-aligned library of 40+ popular reciters (Mishary, Husary, Sudais, Maher al-Muaiqly, etc.)
4. **YouTube link**: Paste URL, extract audio (Mode 1 can also extract video)
5. **Upload video**: For Mode 1 (caption overlay)
6. **Drag and drop**: Drop audio/video files directly onto the app window

### 3.10 Project Library

Like iMovie's project library:
- All projects listed on the home screen with thumbnails
- Recently opened projects at the top
- Search and filter by mode, reciter, surah
- Duplicate project (create a copy to experiment with different styles)
- Delete / archive projects
- Projects stored locally (desktop) or in account (web/mobile)

---

## 4. Functional Requirements

### 4.1 Forced Alignment Engine

| ID | Requirement | Priority |
|---|---|---|
| FA-1 | Accept audio input and produce word-level timestamps | P0 |
| FA-2 | Identify surah and ayah range from recitation automatically | P0 |
| FA-3 | Handle popular reciters with pre-computed alignments | P0 |
| FA-4 | Handle custom/user recitations via ML-based alignment | P0 |
| FA-5 | Detect silence, basmala, isti'adha segments | P1 |
| FA-6 | Handle mid-ayah cuts (partial recitations) | P1 |
| FA-7 | Support tajweed-aware alignment (elongations, stops) | P2 |
| FA-8 | Alignment accuracy: 90%+ words within 200ms of true position | P0 |

### 4.2 Timeline Editor

| ID | Requirement | Priority |
|---|---|---|
| TE-1 | Multi-track timeline with audio waveform visualization | P0 |
| TE-2 | Real-time preview synced to playhead position | P0 |
| TE-3 | Scrub, zoom, and navigate the timeline | P0 |
| TE-4 | Snap blocks to ayah/word boundaries | P0 |
| TE-5 | Drag to adjust block timing (start/end) | P0 |
| TE-6 | Context-sensitive inspector panel (style, properties) | P0 |
| TE-7 | Split/merge text blocks | P1 |
| TE-8 | Insert custom elements (text, cards, transitions) | P1 |
| TE-9 | Keyboard shortcuts (spacebar play, J/K/L scrub, arrow nudge) | P1 |
| TE-10 | Undo/redo (Cmd+Z / Ctrl+Z) | P0 |
| TE-11 | Non-destructive editing (revert to AI defaults at any point) | P0 |
| TE-12 | Drag-and-drop reorder of blocks within a track | P1 |

### 4.3 Quran Data Layer

| ID | Requirement | Priority |
|---|---|---|
| QD-1 | Full Quran text (Uthmani script) for all 6236 ayat | P0 |
| QD-2 | Translations in 20+ languages (at minimum: English, French, Urdu, Turkish, Bahasa, Spanish) | P0 |
| QD-3 | Mushaf page images (Madani, 604 pages) | P0 |
| QD-4 | Word-to-coordinate mapping for mushaf pages (x, y, width, height per word) | P0 |
| QD-5 | Pre-computed alignments for 40+ popular reciters | P1 |
| QD-6 | Tafsir snippets (optional overlay) | P3 |
| QD-7 | Additional mushaf styles (IndoPak, color-coded tajweed) | P2 |

### 4.4 Mode 1: Caption Mode

| ID | Requirement | Priority |
|---|---|---|
| C-1 | Import existing video file as a track on the timeline | P0 |
| C-2 | Auto-detect or manually select ayah range | P0 |
| C-3 | Generate synchronized Arabic subtitle track on timeline | P0 |
| C-4 | Generate synchronized translation subtitle track | P0 |
| C-5 | Configurable subtitle styling via inspector (font, size, color, position, background) | P1 |
| C-6 | Burn subtitles into video (hardcoded) on export | P0 |
| C-7 | Export as SRT/VTT (soft subtitles) | P2 |

### 4.5 Mode 2: Reel Mode

| ID | Requirement | Priority |
|---|---|---|
| R-1 | Background track with library (nature, abstract, solid colors, gradients) | P0 |
| R-2 | Upload custom background image/video to background track | P1 |
| R-3 | Arabic text blocks on timeline, one per ayah, synchronized to audio | P0 |
| R-4 | Translation text blocks below Arabic, synchronized | P0 |
| R-5 | Configurable text styling via inspector (font, size, color, glow, shadow) | P1 |
| R-6 | Word-by-word highlight within each ayah (karaoke-style) | P1 |
| R-7 | Transition animations between ayat (fade, slide, none) | P2 |
| R-8 | Export in 9:16 (Reels/TikTok), 16:9 (YouTube), 1:1 (Instagram) | P0 |
| R-9 | Surah name/bismillah header card block | P1 |

### 4.6 Mode 4: Mushaf Mode

| ID | Requirement | Priority |
|---|---|---|
| M-1 | Mushaf page images placed on timeline at correct timestamps | P0 |
| M-2 | Word-by-word highlight overlay track synced to audio | P0 |
| M-3 | Smooth highlight movement (not jarring frame-by-frame jumps) | P0 |
| M-4 | Page transition when recitation moves to next page | P0 |
| M-5 | Configurable highlight style via inspector (golden glow, blue box, underline, circle) | P1 |
| M-6 | Configurable highlight color | P1 |
| M-7 | Optional translation bar track at bottom of screen | P1 |
| M-8 | Decorative frame/border options | P2 |
| M-9 | Zoom to current line (optional) | P2 |
| M-10 | Export in 9:16 and 16:9 | P0 |

### 4.7 Export and Sharing

| ID | Requirement | Priority |
|---|---|---|
| E-1 | Export as MP4 (H.264) | P0 |
| E-2 | Configurable resolution (720p, 1080p, 4K) | P1 |
| E-3 | Configurable aspect ratio (9:16, 16:9, 1:1) | P0 |
| E-4 | Share directly to clipboard/system share sheet | P1 |
| E-5 | Batch export (multiple segments or split surahs) | P2 |
| E-6 | Project save/load (resume editing later) | P0 |
| E-7 | Export progress with cancel option | P0 |

### 4.8 Reciter Library

| ID | Requirement | Priority |
|---|---|---|
| RL-1 | Pre-loaded library of 10+ popular reciters with pre-computed alignments | P0 |
| RL-2 | Expand to 40+ reciters | P1 |
| RL-3 | Per-reciter ayah-range selection (which surahs are available) | P0 |
| RL-4 | Audio quality: minimum 128kbps | P0 |
| RL-5 | Community-contributed reciter packs | P3 |

### 4.9 Project Library

| ID | Requirement | Priority |
|---|---|---|
| PL-1 | Home screen showing all projects with thumbnails | P0 |
| PL-2 | Create new project (mode selection + audio input) | P0 |
| PL-3 | Open, duplicate, delete projects | P0 |
| PL-4 | Search/filter projects by mode, reciter, surah | P1 |
| PL-5 | Recently opened projects sorted to top | P0 |
| PL-6 | Project auto-save | P1 |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement | Target |
|---|---|---|
| NF-1 | Forced alignment processing time | <30 seconds for 5-minute recitation |
| NF-2 | Timeline preview: real-time playback without dropped frames | P0 |
| NF-3 | Video rendering time (desktop) | <2x realtime (5-min video in <10 min) |
| NF-4 | Video rendering time (server/cloud) | <1x realtime |
| NF-5 | App startup time | <3 seconds |
| NF-6 | Pre-aligned reciter project generation (audio to populated timeline) | <5 seconds |
| NF-7 | Timeline scrubbing latency | <100ms to update preview |

### 5.2 Privacy

| ID | Requirement | Priority |
|---|---|---|
| NF-8 | All processing can happen locally (desktop) | P0 |
| NF-9 | No user data collected without consent | P0 |
| NF-10 | No account required for basic usage | P0 |
| NF-11 | Server-side rendering (web/mobile) does not store user audio after processing | P0 |

### 5.3 Accessibility

| ID | Requirement | Priority |
|---|---|---|
| NF-12 | RTL language support throughout UI | P0 |
| NF-13 | UI available in English and Arabic | P0 |
| NF-14 | UI available in French, Urdu, Turkish, Bahasa | P2 |
| NF-15 | Works offline after initial setup (desktop) | P1 |

### 5.4 Islamic Compliance

| ID | Requirement | Priority |
|---|---|---|
| NF-16 | Quran text sourced only from verified sources (Tanzil.net, King Fahd Complex) | P0 |
| NF-17 | No modification of mushaf layout or text | P0 |
| NF-18 | Translations clearly labeled as translations, not Quran | P0 |
| NF-19 | App handles mushaf content with proper adab | P0 |
| NF-20 | Scholar review for any edge cases in digital mushaf presentation | P1 |

---

## 6. Platform Strategy

### 6.1 Target Platforms

| Platform | Framework | Rendering | ML Inference | Priority |
|---|---|---|---|---|
| Desktop (Mac/Win/Linux) | Tauri 2.0 (Rust + React) | Local FFmpeg | Local (Whisper) | P0 |
| Web | React + server backend | Server-side FFmpeg | Server-side | P0 |
| iOS | Tauri 2.0 mobile | ffmpeg-kit or server | CoreML or server | P1 |
| Android | Tauri 2.0 mobile | ffmpeg-kit or server | ONNX Runtime or server | P1 |

### 6.2 Architecture

```
+------------------------------------------+
|           Frontend (React)               |
|                                          |
|  +-- Project Library (home screen)       |
|  +-- Timeline Editor                     |
|  |   - Multi-track timeline              |
|  |   - Audio waveform renderer           |
|  |   - Block placement/interaction       |
|  |   - Playhead + scrubbing              |
|  +-- Preview Panel                       |
|  |   - Real-time preview renderer        |
|  |   - Canvas-based compositing          |
|  +-- Inspector Panel                     |
|  |   - Context-sensitive property editor |
|  +-- Reciter/Surah Browser              |
|  +-- Export Dialog                       |
+------------------------------------------+
              |  Tauri Bridge  |
+------------------------------------------+
|           Rust Backend Core              |
|                                          |
|  +-- Forced Alignment Engine             |
|  |   - Whisper (local or server)         |
|  |   - Pre-computed alignment loader     |
|  |                                       |
|  +-- Project Engine                      |
|  |   - Timeline state management         |
|  |   - Project save/load (JSON)          |
|  |   - AI project builder (auto-layout)  |
|  |                                       |
|  +-- Preview Engine                      |
|  |   - Frame-at-timestamp generator      |
|  |   - Lightweight compositing for       |
|  |     real-time preview                 |
|  |                                       |
|  +-- Quran Data Service                  |
|  |   - Text database (SQLite)            |
|  |   - Translation database              |
|  |   - Mushaf coordinates                |
|  |   - Reciter audio index               |
|  |                                       |
|  +-- Rendering Engine                    |
|      - FFmpeg pipeline (final export)    |
|      - Mode 1: Subtitle burn-in          |
|      - Mode 2: Text-on-background        |
|      - Mode 3: Long-form + cards         |
|      - Mode 4: Mushaf highlight overlay  |
+------------------------------------------+
              |
+------------------------------------------+
|           Data Layer                     |
|  - Tanzil.net Quran text                 |
|  - Quran.com word coordinates            |
|  - King Fahd mushaf page images          |
|  - EveryAyah / QuranicAudio recitations  |
|  - Quran.com translation API             |
+------------------------------------------+
```

### 6.3 Mobile Strategy
On mobile, heavy rendering happens server-side. The mobile app provides:
- Full timeline editor (touch-optimized: pinch to zoom, drag to scrub)
- Recording interface
- Reciter selection and ayah range picker
- Real-time preview (lightweight compositing, not full FFmpeg render)
- Triggers server-side render, delivers download link
- Light edits on-device

Desktop does everything locally. Web uses server for everything. Mobile is hybrid.

---

## 7. Data Sources

| Data | Source | License | Notes |
|---|---|---|---|
| Quran text (Uthmani) | Tanzil.net | Open (non-commercial) | Need to verify if open-source project qualifies |
| Mushaf page images | King Fahd Complex | Open for Islamic use | Contact for commercial terms |
| Word coordinates | Quran.com repos (quran/quran.com-images) | MIT | Glyph bounds per word per page |
| Pre-aligned audio | EveryAyah.com, QuranicAudio.com | Open | Per-ayah audio for 100+ reciters |
| Word-level timestamps | Quran.com API (recitations endpoint) | Open | ~40 reciters with word timing |
| ASR model | Tarteel AI whisper-base-ar-quran | Apache 2.0 | Fine-tuned Whisper for Quranic Arabic |
| Translations | Quran.com API | Varies by translator | 50+ languages available |
| Forced alignment | Aeneas (Python) | AGPL-3.0 | Arabic support confirmed |

---

## 8. Development Phases

### Phase 1: Mushaf Mode - Desktop
**Goal**: Ship the unique differentiator first. Mushaf Mode on a visual timeline editor.

- Tauri desktop app (Mac first)
- Project library (home screen)
- Timeline editor with audio waveform + mushaf page track + highlight overlay track
- Inspector panel for highlight style/color
- Real-time preview panel
- Mushaf Mode fully working (select reciter, select surah/ayah range, preview, export)
- 5 pre-aligned reciters
- 3 highlight styles
- Export as MP4 (9:16 and 16:9)
- Project save/load

**Ship to**: GitHub release, share on Muslim tech Twitter/Reddit/Discord.

**Success criteria**: A user can go from "open app" to "exported mushaf video" in under 2 minutes. The timeline editor is usable and the preview is smooth.

### Phase 2: All Modes, Desktop + Web
**Goal**: Complete the product vision with all four modes and a web version.

- Add Caption Mode, Reel Mode, and Long-form Mode to the timeline editor
- Each mode has its own track layout and inspector options
- Web version with server-side rendering (same React frontend, Axum backend)
- Custom audio upload with ML-based alignment (whisper.cpp on desktop, server on web)
- 20+ reciters in library
- Translation overlay support (10 languages)
- Background library for Reel/Long-form modes (20+ built-in backgrounds)
- Windows support
- Batch export (split into individual reel videos)
- Keyboard shortcuts

**Ship to**: ProductHunt launch, Islamic tech communities, mosque networks.

**Success criteria**: All four modes work. Web version is accessible. Custom audio alignment is accurate enough to be useful.

### Phase 3: Mobile + Polish
**Goal**: Reach the majority audience on mobile. Polish everything to iMovie-level quality.

- iOS and Android via Tauri 2.0
- Touch-optimized timeline (pinch to zoom, drag to scrub, tap to select)
- Server-side rendering for mobile users
- Recording mode (recite directly into the app)
- Expanded reciter library (40+)
- Onboarding flow (first-run tutorial)
- Arabic UI localization
- App icons, splash screens, app store assets
- Performance polish (smooth scrolling, instant preview updates)
- Batch generation

**Ship to**: App Store, Play Store.

**Success criteria**: Mobile app feels native, not like a wrapped web view. Timeline editing works well on touch. Server rendering is fast enough.

### Phase 4: Community + Scale (ongoing)
- Community-contributed reciter packs
- Additional mushaf styles (IndoPak, tajweed color-coded)
- Tajweed highlighting in Mushaf Mode
- YouTube/TikTok/Instagram direct posting API
- Manual timestamp fine-tuning on timeline (word-level dragging)
- Offline mode for mobile
- Performance optimization
- Plugin system for custom renderers/effects

---

## 9. Success Metrics

### Usage Metrics
| Metric | Month 1 | Month 3 | Month 6 | Year 1 |
|---|---|---|---|---|
| GitHub stars | 500 | 2,000 | 5,000 | 10,000 |
| Desktop downloads | 2,000 | 10,000 | 30,000 | 100,000 |
| Web monthly active users | 1,000 | 5,000 | 20,000 | 50,000 |
| Mobile downloads | - | - | 20,000 | 100,000 |
| Videos generated (total) | 5,000 | 50,000 | 200,000 | 1,000,000 |

### Quality Metrics
| Metric | Target |
|---|---|
| Forced alignment accuracy (word within 200ms) | >90% |
| User-reported sync issues per 100 videos | <5 |
| Average generation time (5-min video, desktop) | <5 min |
| Timeline preview framerate | 30fps+ |
| App crash rate | <0.5% |

### Community Metrics
| Metric | Target |
|---|---|
| GitHub contributors | 20+ by Year 1 |
| Translations contributed | 30+ languages by Year 1 |
| Community reciter packs | 10+ by Year 1 |

---

## 10. Monetization (Sustainability)

This is a free, open-source project. Revenue is not a goal, but sustainability is.

**Funding sources:**
- GitHub Sponsors
- LaunchGood campaigns (Islamic crowdfunding)
- Buy Me a Coffee / Ko-fi
- Mosque/organization sponsorships
- Optional "Quran Studio Cloud" for server-side rendering at scale (pay-what-you-want or freemium for heavy users)
- Grant funding from Islamic foundations (e.g., Qatar Foundation, Islamic Development Bank)

**Cost structure:**
- Server costs for web rendering (primary expense)
- CDN for reciter audio library
- Domain, hosting
- Apple Developer Account ($99/year)
- Google Play Developer Account ($25 one-time)

**Break-even estimate**: ~$200-500/month for moderate usage. Achievable with 50-100 GitHub sponsors at $5-10/month.

---

## 11. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Timeline editor is too complex for casual users | High | Medium | Instant defaults must be export-ready. Editor is there but not required. Consider a "Quick Export" button that bypasses the timeline entirely. |
| Real-time preview is too slow | High | Medium | Preview engine uses lightweight compositing (canvas), not FFmpeg. Only final export uses FFmpeg. Pre-render frames for scrubbing. |
| Forced alignment accuracy insufficient for custom recitations | High | Medium | Fall back to ayah-level (not word-level) for low-confidence alignments. Manual correction on timeline. |
| King Fahd mushaf images have restrictive license | High | Low | Their images are widely used in Islamic apps. Contact directly to confirm terms. Fallback: generate mushaf pages from Quran font files. |
| Tauri 2.0 mobile has showstopper bugs | Medium | Medium | Desktop + web first. If Tauri mobile fails, build native iOS (SwiftUI) and Android (Kotlin) separately. |
| Server costs explode with usage | Medium | Medium | Keep desktop/local rendering as primary. Server only for web/mobile. Rate limit. Seek sponsorship. |
| QuranCaption adds mushaf mode | Medium | Low | Our advantage: visual timeline editor, cross-platform, mobile. QuranCaption is desktop-only with complex setup. |
| Apple rejects iOS app | Medium | Low | Tauri app is just a WKWebView wrapper. If rejected, distribute via web app / TestFlight. |
| Community doesn't adopt | Medium | Medium | Ship Mushaf Mode first (unique, attention-grabbing). Market on Muslim tech Twitter, Reddit, YouTube. Get one big Quran channel to use it. |
| Scholar concerns about digital mushaf highlighting | Low | Low | Highlighting for reading/following along is universally accepted. Consult scholars proactively. |

---

## 12. Open Questions

1. **Tanzil.net license**: Their text is "free for non-commercial use." Does an open-source project with optional donations qualify? Need legal clarity.
2. **Quran.com word coordinates**: Are the glyph bounds in their repo complete for all 604 pages? Need to audit.
3. **Aeneas AGPL license**: If we use Aeneas for forced alignment, AGPL requires open-sourcing the entire project. This is fine since we're open source, but worth noting.
4. **Whisper fine-tuning**: Do we need to fine-tune our own Whisper model for better Quranic alignment, or is Tarteel's model sufficient?
5. **Video hosting**: Should we offer hosting for generated videos, or keep it export-only to avoid storage costs and content moderation burden?
6. **Timeline on mobile**: How well does a multi-track timeline work on a phone screen? May need a simplified mobile layout.

---

## 13. Development Progression Framework

```
PRD (this document)
 |
 v
Technical Spec
 - Architecture decisions locked
 - Timeline editor component design
 - Preview engine design
 - Data pipeline design
 - API contracts between frontend and backend
 - FFmpeg rendering pipeline specification
 - Forced alignment approach finalized
 |
 v
Phase 1: Mushaf Mode + Timeline Editor (desktop)
 - Ship the differentiator on one platform
 - Validate that the timeline UX works
 - Get real user feedback
 |
 v
Phase 2: All Modes + Web
 - Complete product vision
 - ProductHunt launch
 - Community building begins
 |
 v
Phase 3: Mobile + Polish
 - iOS + Android
 - Touch-optimized timeline
 - iMovie-level polish
 |
 v
Phase 4: Community + Scale
 - Contributions, translations, reciter packs
 - Ongoing maintenance and improvement
```

Each phase has clear success criteria and a proceed decision point. Don't move to Phase 2 until Phase 1 users validate that the timeline editor works and people actually want this.
