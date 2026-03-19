# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quran Studio is an open-source, AI-powered video editor for Quran recitation content. It supports four editing modes: Caption (subtitle overlay on video), Reel (vertical short-form), Long-form (horizontal YouTube), and Mushaf (word-by-word highlighting on actual Madani mushaf pages). The Mushaf mode is the flagship differentiator — no other tool does this.

**Status**: Pre-implementation (specification phase). The repo contains PRD, technical spec, and design system docs but no source code yet.

## Tech Stack

- **Desktop**: Tauri 2.0 (Rust backend + React frontend)
- **Web**: Axum (Rust) server + React SPA
- **Frontend**: React 18, TypeScript, Vite, Zustand (state), shadcn/ui (components), Tailwind CSS
- **Core**: Rust (alignment engine, project state, preview, FFmpeg rendering)
- **Database**: SQLite (embedded Quran data)
- **Video Export**: FFmpeg (bundled)
- **Audio Alignment**: Whisper.cpp (desktop), server-side (web/mobile)
- **License**: Apache 2.0

## Architecture

```
Frontend (React + TypeScript)
  ↕ Tauri Bridge (desktop) / HTTP API (web)
Rust Backend Core
  - Forced Alignment Engine (Whisper.cpp, word-level timestamps)
  - Project Engine (timeline state as JSON, non-destructive)
  - Preview Engine (Canvas compositing, 30fps target)
  - Quran Data Service (SQLite)
  - Rendering Engine (FFmpeg filter chains)
  ↕
Data Layer (Quran text from Tanzil.net, mushaf images, word coordinates, pre-aligned reciters)
```

**Timeline**: Canvas-based rendering (not DOM) for performance with 1000+ blocks. Data model: Timeline → Tracks → Blocks with type-specific data.

**Export**: FFmpeg filter chains (not frame-by-frame). Pre-generated highlight overlays as PNGs for mushaf mode.

**Frontend layout**: 3-panel — Inspector (280px left) | Preview (center) | Timeline (bottom).

## Planned Directory Structure

```
core/              # Rust core library (alignment, quran_data, project, preview, renderer)
desktop/src-tauri/ # Tauri command handlers
desktop/src/       # React frontend (components, hooks, stores)
mobile/            # Tauri mobile (iOS/Android)
web/               # Axum server + React SPA
data/              # mushaf images (604 pages, git-lfs), quran.sqlite, pre-computed alignments
docs/              # Documentation
```

## Design System

- **Aesthetic**: Minimal, editorial, professional (Final Cut Pro + Linear). NOT decorative or "Islamic green/gold".
- **Dark mode primary**. Background: pure black (#000000) to subtle grays. Accent: white for actions, red for playhead only.
- **Fonts**: Inter (UI), Amiri Quran (Arabic/Quranic text), JetBrains Mono (timestamps/technical)
- **Components**: shadcn/ui + Radix UI + Lucide icons

## Key Specification Documents

- `quran-studio-prd.md` — Product requirements, features, success metrics
- `quran-studio-spec.md` — Technical architecture, data models, API design
- `quran-studio-design.md` — Design system, UI guidelines, component specs

## Performance Targets

- Alignment: <30s for 5-min audio
- Timeline preview: 30fps+
- Export: <2x realtime
- App startup: <3s
- Scrub latency: <100ms

## Development Phases

1. Mushaf Mode desktop app (Mac first) with visual timeline editor
2. All 4 modes on desktop + web version + custom audio
3. Mobile (iOS/Android) with touch-optimized timeline
4. Community contributions, plugins, scale

## Data Sources

| Data | Source | License |
|------|--------|---------|
| Quran text (Uthmani) | Tanzil.net | Open (non-commercial) |
| Mushaf images | King Fahd Complex | Open for Islamic use |
| Word coordinates | Quran.com | MIT |
| ASR model | Tarteel AI whisper-base-ar | Apache 2.0 |

## Agent Team

When asked to "spin up the team" or "run the agents", spawn these 4 agents in parallel using worktree isolation. Each agent owns its directory and should not touch files outside its scope.

### Agent 1: Core Engine (Rust)
**Scope**: `core/`, `desktop/src-tauri/`
- Cargo workspace setup (root `Cargo.toml`, `core/` lib crate, `desktop/src-tauri/` Tauri app)
- `core/src/quran_data.rs` — SQLite access (words, translations, reciters, surahs, pages)
- `core/src/alignment.rs` — Load pre-computed word timestamps, join with coordinates
- `core/src/project.rs` — Project/Timeline/Track/Block data model (serde JSON), AI project builder (`build_mushaf_project`), save/load/list/delete/duplicate
- `core/src/preview.rs` — Render preview frame at timestamp (image crate compositing: mushaf page + highlight overlay → PNG bytes)
- `core/src/renderer.rs` — FFmpeg export pipeline (filter chain with overlay+enable expressions, page transitions via xfade, aspect ratio via scale+pad, progress parsing)
- `core/src/audio.rs` — Waveform peak extraction (symphonia or hound)
- `core/migrations/001_initial.sql` — Full schema
- `desktop/src-tauri/` — Tauri 2.0 app with `#[tauri::command]` handlers wrapping core functions, AppState with db/projects_dir/export state
- **Deps**: rusqlite (bundled), serde, serde_json, tauri v2, image, uuid, chrono, thiserror

### Agent 2: Timeline Editor (React/Canvas)
**Scope**: `desktop/src/components/Timeline/`, `desktop/src/stores/timelineStore.ts`, `desktop/src/hooks/usePlayback.ts`, `desktop/src/hooks/useKeyboardShortcuts.ts`, `desktop/src/types/`
- Vite + React + TypeScript project init (`desktop/src/`): package.json, vite.config.ts, tsconfig.json, tailwind.config.ts (with design system CSS vars), index.html, main.tsx, index.css
- `src/types/project.ts` — Shared TypeScript types (Project, Timeline, Track, Block, all block data types, ExportSettings)
- `src/stores/timelineStore.ts` — Zustand store: project state, selection, playback, zoom/scroll, block move/resize, undo/redo (50-state history stack)
- `src/components/Timeline/TimelineEditor.tsx` — Main wrapper (toolbar + canvas + zoom control)
- `src/components/Timeline/TimelineCanvas.tsx` — HTML5 Canvas renderer (devicePixelRatio aware, frustum culling). Renders: time ruler, track headers (120px), track lanes (32px each), audio waveform, mushaf/highlight/text blocks, playhead (red line + triangle), ayah markers, selection overlay
- `src/components/Timeline/TimelineInteraction.ts` — Mouse/touch handlers: click ruler (set playhead), drag ruler/playhead (scrub), click block (select), shift+click (multi-select), drag block (move + snap), drag edge (resize), scroll wheel (zoom), shift+scroll (pan), hit testing
- `src/components/Timeline/TimelineToolbar.tsx` — Play/pause, skip, time display (JetBrains Mono)
- `src/components/Timeline/ZoomControl.tsx` — Slider + buttons
- `src/components/Timeline/WaveformRenderer.ts` — Render peaks as vertical bars, brighter under playhead
- `src/hooks/usePlayback.ts` — rAF loop advancing playhead, audio element sync
- `src/hooks/useKeyboardShortcuts.ts` — Space, J/K/L, arrows, Cmd+Z, +/-, Delete
- **No Tauri imports** in timeline code — pure React/Canvas. Communicates via Zustand store only.

### Agent 3: App Shell + Inspector + UX (React/Tauri)
**Scope**: `desktop/src/components/` (except `Timeline/`), `desktop/src/stores/appStore.ts`, `desktop/src/hooks/useTauri.ts`, `desktop/src/components/ui/`
- shadcn/ui component setup in `src/components/ui/` (Button, Dialog, Select, Slider, Command, Sheet, Tabs, ScrollArea, ToggleGroup, Tooltip, Progress, Badge, Skeleton, Toast, ContextMenu, AlertDialog, Accordion, etc.) with design system theme
- `src/components/Layout/AppShell.tsx` — 3-panel layout: Inspector (280px, collapsible Cmd+I) | Preview (center) | Timeline (bottom, 200px default, resizable divider). Imports `TimelineEditor` from Agent 2.
- `src/components/Layout/TitleBar.tsx` — "Quran Studio", Cmd+K trigger, Export button
- `src/components/Preview/PreviewPanel.tsx` — Canvas compositing (mushaf page + highlight at playhead position), aspect ratio letterboxing
- `src/components/Preview/TransportControls.tsx` — Play/pause, skip, time display, aspect ratio toggle
- `src/components/Inspector/InspectorPanel.tsx` — Context-sensitive: reads `selectedBlockIds` from timeline store → renders ProjectInspector / MushafPageInspector / HighlightInspector / TranslationInspector
- `src/components/ProjectLibrary/ProjectLibrary.tsx` — Home screen grid, search, "+ New" button, empty state
- `src/components/ProjectLibrary/ProjectCard.tsx` — Thumbnail, title, mode badge, timestamp, right-click menu
- `src/components/ProjectLibrary/NewProjectDialog.tsx` — Mode toggle (Mushaf only for P1), reciter select, surah select, ayah range inputs, Create triggers Tauri command
- `src/components/ReciterBrowser/ReciterBrowser.tsx` — Scrollable reciter list with search
- `src/components/CommandPalette/CommandPalette.tsx` — Cmd+K using shadcn Command
- `src/stores/appStore.ts` — view (library/editor), inspectorVisible, openProject/closeProject
- `src/hooks/useTauri.ts` — React hooks wrapping `@tauri-apps/api/core` invoke: useProjects, useReciters, useSurahs, useExport, usePreview, useAudioWaveform
- **Imports from Agent 2**: `timelineStore`, `TimelineEditor`

### Agent 4: Data Pipeline (Python)
**Scope**: `data/`
- `data/scripts/requirements.txt` — requests, Pillow, tqdm
- `data/scripts/reciters.json` — Registry for 5 initial reciters (Mishary, Sudais, Shuraim, Shatri, Hussary) with Quran.com recitation IDs and EveryAyah subfolder names
- `data/scripts/fetch_word_coordinates.py` — Quran.com API v4, all 114 surahs, extract word text + page + line (coordinates x/y/w/h may not be in API — use placeholders and log gap)
- `data/scripts/fetch_mushaf_images.py` — Download 604 Madani mushaf PNGs, validate, resume-capable
- `data/scripts/fetch_alignments.py` — Quran.com timing endpoints for 5 reciters, word-level timestamps, per-surah JSON
- `data/scripts/fetch_audio.py` — EveryAyah per-surah MP3s, `--reciter` flag, optional
- `data/scripts/fetch_translations.py` — 5 languages (EN/FR/UR/TR/ID) from Quran.com
- `data/scripts/build_database.py` — Reads intermediate JSON → builds `data/db/quran.sqlite` with full schema + indexes
- `data/scripts/validate_data.py` — Completeness checks (77,430 words, 604 pages, alignment coverage, monotonic timestamps)
- `data/scripts/run_pipeline.py` — Master script, runs all steps in order, `--step`, `--skip-images`, `--skip-audio`, `--reciter` flags
- `data/.gitignore` — Ignore mushaf/, audio/, intermediate/, db/
- All scripts: 1 req/sec rate limit, 3 retries with backoff, tqdm progress, resume-capable

### Interface Contract (Agent 2 ↔ Agent 3)

Agent 3 imports from Agent 2. The contract is the Zustand store shape:

```typescript
// Agent 2 exports from src/stores/timelineStore.ts
interface TimelineState {
  project: Project | null;
  selectedBlockIds: string[];
  selectedTrackId: string | null;
  isPlaying: boolean;
  setProject: (project: Project) => void;
  setPlayhead: (ms: number) => void;
  setZoom: (zoom: number) => void;
  setScrollX: (x: number) => void;
  selectBlock: (blockId: string, multi?: boolean) => void;
  clearSelection: () => void;
  moveBlock: (blockId: string, newStartMs: number) => void;
  resizeBlock: (blockId: string, newStartMs: number, newEndMs: number) => void;
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
```

Agent 2 also exports `<TimelineEditor />` from `src/components/Timeline/TimelineEditor.tsx` — Agent 3 renders it in the AppShell.

Shared types live in `src/types/project.ts` (owned by Agent 2, imported by Agent 3).

### Interface Contract (Agent 1 ↔ Agent 3)

The Tauri IPC commands defined by Agent 1 are consumed by Agent 3's `useTauri.ts` hooks via `invoke()`. The command signatures:

```
list_projects() -> Vec<ProjectSummary>
create_project(mode, reciter_id, surah, ayah_start, ayah_end) -> Project
load_project(id) -> Project
save_project(project) -> Result<()>
delete_project(id) -> Result<()>
duplicate_project(id) -> Project
list_reciters() -> Vec<Reciter>
list_surahs() -> Vec<Surah>
get_surah_pages(surah) -> Vec<u16>
get_preview_frame(project_id, timestamp_ms) -> Vec<u8>
get_audio_waveform(reciter_id, surah) -> Vec<f32>
export_video(project_id, settings) -> Result<String>
get_export_progress() -> f32
cancel_export() -> Result<()>
```

### Interface Contract (Agent 4 → Agent 1)

Agent 4 produces `data/db/quran.sqlite` with the schema Agent 1's `quran_data.rs` reads from. Same tables, same indexes, same column names.
