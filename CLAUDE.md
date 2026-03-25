# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quran Studio is an open-source, AI-powered video editor for Quran recitation content. Four editing modes: Caption, Reel, Long-form, and Mushaf (word-by-word highlighting on Madani mushaf pages — the flagship feature). Currently in Phase 1: Mushaf Mode desktop app (Mac first).

**License**: Apache 2.0

## Build & Dev Commands

### Desktop App (Tauri + React)
```bash
# Full desktop app (Rust backend + React frontend)
cargo tauri dev                    # Dev mode with hot reload (from project root or desktop/src-tauri)
cargo tauri build                  # Production bundle (macOS/Windows/Linux)

# Frontend only (React dev server on port 1420)
cd desktop && npm run dev          # Standalone dev server (no Tauri IPC)
cd desktop && npm run build        # TypeScript compile + Vite bundle → desktop/dist/
cd desktop && npm run typecheck    # Type checking only
cd desktop && npm run lint         # ESLint
```

### Rust Core
```bash
cargo build                        # Build workspace (core + Tauri backend)
cargo build -p quran-studio-core   # Build core library only
cargo test -p quran-studio-core    # Run core tests
cargo check                        # Fast type check
```

### Data Pipeline (Python)
```bash
pip install -r data/scripts/requirements.txt
python data/scripts/run_pipeline.py                          # Full pipeline (all 8 steps)
python data/scripts/run_pipeline.py --step fetch_alignments  # Single step
python data/scripts/run_pipeline.py --skip-images --skip-audio  # Skip large downloads
python data/scripts/run_pipeline.py --reciter mishary --surah 1  # Single reciter/surah
```

## Architecture

```
┌─ desktop/src/ ──────────────── React 18 + TypeScript + Vite ──────────────┐
│  stores/         Zustand (timelineStore, appStore, playheadSync)          │
│  components/     AppShell (3-panel), Timeline (Canvas), Inspector,       │
│                  Preview, ProjectLibrary, CommandPalette, ui/ (shadcn)    │
│  hooks/          useTauri (IPC wrappers), usePlayback, useKeyboardShortcuts│
│  types/          project.ts (shared type definitions for all layers)      │
└──────────────── Tauri Bridge (invoke) ────────────────────────────────────┘
                           ↕
┌─ desktop/src-tauri/ ──── Tauri 2.0 Rust Backend ─────────────────────────┐
│  commands.rs     #[tauri::command] handlers (async, spawn_blocking)       │
│  state.rs        AppState: Mutex<Connection>, projects_dir, export state │
│  lib.rs          App setup, data directory detection                      │
└──────────────── imports core/ ────────────────────────────────────────────┘
                           ↕
┌─ core/ ─────────────────── Rust Core Library ────────────────────────────┐
│  quran_data.rs   SQLite access (words, translations, reciters, surahs)   │
│  alignment.rs    Load pre-computed word timestamps, join with coordinates │
│  project.rs      Project/Timeline/Track/Block model (serde JSON)         │
│  preview.rs      Frame compositing (image crate: mushaf page + highlight)│
│  renderer.rs     FFmpeg export (filter chains, progress parsing)         │
│  audio.rs        Waveform peak extraction (symphonia), audio fetching    │
│  error.rs        CoreError enum (thiserror)                              │
└──────────────────────────────────────────────────────────────────────────┘
                           ↕
┌─ data/ ──────────────────── Data Layer ──────────────────────────────────┐
│  db/quran.sqlite          56MB database (77,430 words + alignments)      │
│  mushaf_images/           604 Madani mushaf page PNGs (+ tajweed variant)│
│  audio/                   Per-surah MP3s for 10 reciters                 │
│  intermediate/            Pre-computed JSON (coordinates, alignments)     │
│  scripts/                 Python pipeline (8 steps, run_pipeline.py)     │
└──────────────────────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

- **Canvas-based timeline** (not DOM) for performance with 1000+ blocks. Rendering in `TimelineCanvas.tsx` with devicePixelRatio awareness and frustum culling.
- **FFmpeg filter chains** for export (not frame-by-frame). Pre-generated highlight overlays as PNGs for mushaf mode.
- **Zustand stores** are the communication layer between Timeline (Agent 2) and App Shell (Agent 3). Timeline code has **no Tauri imports** — pure React/Canvas.
- **Tauri commands** use `tokio::task::spawn_blocking` for database operations. State shared via `AppState` with `Mutex<Connection>`.
- **Data directory detection**: Dev mode searches project root for `data/`; production uses `app_data_dir`.
- **Coordinate encoding**: Word coordinates stored as integers (fractional × 100,000) in SQLite for precision.

## Tech Stack

- **Desktop**: Tauri 2.0 (Rust backend + React frontend)
- **Frontend**: React 18, TypeScript 5.6, Vite 6, Zustand 4.5, shadcn/ui (24 components), Tailwind 3.4
- **Core**: Rust — rusqlite (bundled), serde, image, imageproc, symphonia, ureq, thiserror
- **Database**: SQLite with WAL mode
- **Fonts**: Inter (UI), Amiri Quran (Arabic), JetBrains Mono (timestamps)

## Design System

- Dark mode primary. Background: pure black (#000000) to subtle grays. Accent: white for actions, red for playhead only.
- Aesthetic: Minimal, editorial, professional (Final Cut Pro + Linear). NOT decorative or "Islamic green/gold".
- CSS design tokens defined in `desktop/src/index.css`, referenced in `desktop/tailwind.config.ts`.
- 3-panel layout: Inspector (280px left, collapsible Cmd+I) | Preview (center) | Timeline (bottom, 200px, resizable).

## Specification Documents

- `quran-studio-prd.md` — Product requirements, features, success metrics
- `quran-studio-spec.md` — Technical architecture, data models, API design
- `quran-studio-design.md` — Design system, UI guidelines, component specs

## Data Sources

| Data | Source | License |
|------|--------|---------|
| Quran text (Uthmani) | Tanzil.net | Open (non-commercial) |
| Mushaf images | King Fahd Complex | Open for Islamic use |
| Word coordinates | Quran.com | MIT |
| ASR model | Tarteel AI whisper-base-ar | Apache 2.0 |
| Audio | EveryAyah.com | Open |

## Tauri IPC Commands

Commands defined in `desktop/src-tauri/src/commands.rs`, consumed by `desktop/src/hooks/useTauri.ts`:

```
list_projects, create_project, load_project, save_project, delete_project, duplicate_project
list_reciters, list_surahs, get_surah_pages
get_preview_frame, get_audio_waveform
export_video, get_export_progress, cancel_export
```

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
- `src/types/project.ts` — Shared TypeScript types (Project, Timeline, Track, Block, all block data types, ExportSettings)
- `src/stores/timelineStore.ts` — Zustand store: project state, selection, playback, zoom/scroll, block move/resize, undo/redo (50-state history stack)
- `src/components/Timeline/TimelineCanvas.tsx` — HTML5 Canvas renderer (devicePixelRatio aware, frustum culling)
- `src/components/Timeline/TimelineInteraction.ts` — Mouse/touch handlers: click, drag, scrub, snap, zoom, pan, hit testing
- `src/hooks/usePlayback.ts` — rAF loop advancing playhead, audio element sync
- `src/hooks/useKeyboardShortcuts.ts` — Space, J/K/L, arrows, Cmd+Z, +/-, Delete
- **No Tauri imports** in timeline code — pure React/Canvas. Communicates via Zustand store only.

### Agent 3: App Shell + Inspector + UX (React/Tauri)
**Scope**: `desktop/src/components/` (except `Timeline/`), `desktop/src/stores/appStore.ts`, `desktop/src/hooks/useTauri.ts`, `desktop/src/components/ui/`
- `src/components/Layout/AppShell.tsx` — 3-panel layout
- `src/components/Inspector/InspectorPanel.tsx` — Context-sensitive: reads `selectedBlockIds` from timeline store
- `src/components/ProjectLibrary/` — Home screen, new project dialog
- `src/components/CommandPalette/` — Cmd+K using shadcn Command
- `src/hooks/useTauri.ts` — React hooks wrapping `@tauri-apps/api/core` invoke
- **Imports from Agent 2**: `timelineStore`, `TimelineEditor`, types from `src/types/project.ts`

### Agent 4: Data Pipeline (Python)
**Scope**: `data/`
- `data/scripts/run_pipeline.py` — Master script, 8 steps in order
- `data/scripts/reciters.json` — 10 reciters with Quran.com recitation IDs and EveryAyah subfolder names
- `data/scripts/build_database.py` — Reads intermediate JSON → builds `data/db/quran.sqlite`
- `data/scripts/validate_data.py` — Completeness checks (77,430 words, 604 pages, alignment coverage)
- All scripts: 1 req/sec rate limit, 3 retries with backoff, tqdm progress, resume-capable

### Interface Contracts

**Agent 2 ↔ Agent 3**: Zustand store shape in `timelineStore.ts` + `<TimelineEditor />` component. Shared types in `src/types/project.ts` (owned by Agent 2).

**Agent 1 ↔ Agent 3**: Tauri IPC commands (see list above) consumed by `useTauri.ts` hooks via `invoke()`.

**Agent 4 → Agent 1**: `data/db/quran.sqlite` schema matches what `core/src/quran_data.rs` reads. Same tables, indexes, column names.

## Performance Targets

- Alignment: <30s for 5-min audio
- Timeline preview: 30fps+
- Export: <2x realtime
- App startup: <3s
- Scrub latency: <100ms
