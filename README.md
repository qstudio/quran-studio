# Quran Studio

An open-source, AI-powered video editor for Quran recitation content. Create beautiful word-by-word highlighted recitation videos with the actual Madani mushaf pages.

## Features

- **Mushaf Mode** — Word-by-word highlighting on actual Madani mushaf pages (604 pages), synchronized with reciter audio
- **AI Project Builder** — Automatically generates complete timelines from surah/ayah selection with pre-computed word-level alignments
- **Canvas Timeline Editor** — Professional-grade timeline with drag, resize, snap, zoom, undo/redo (inspired by Final Cut Pro)
- **Live Preview** — Real-time mushaf page compositing with highlight overlays
- **FFmpeg Export** — Filter-chain-based video export with progress tracking and cancellation
- **10 Reciters** — Pre-aligned audio from Mishary, Sudais, Shuraim, Shatri, Husary, and more
- **5 Translation Languages** — English, French, Urdu, Turkish, Indonesian

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 18+
- [FFmpeg](https://ffmpeg.org/) (for video export)
- Python 3.8+ (only if regenerating the data pipeline)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-username/quran-studio.git
cd quran-studio

# Install frontend dependencies
cd desktop && npm install && cd ..

# Run the desktop app (dev mode)
cargo tauri dev
```

The app opens at 1400x900. The bundled SQLite database and mushaf images in `data/` are used automatically.

### Build for Production

```bash
cargo tauri build
```

### Data Pipeline (optional)

The repo includes pre-built data. To regenerate from scratch:

```bash
pip install -r data/scripts/requirements.txt
python data/scripts/run_pipeline.py
```

See `data/scripts/run_pipeline.py --help` for step selection and filtering options.

## Architecture

```
desktop/src/          React 18 + TypeScript + Vite (Zustand, shadcn/ui, Canvas timeline)
desktop/src-tauri/    Tauri 2.0 Rust backend (IPC commands, app state)
core/                 Rust core library (alignment, preview, project, renderer, audio)
data/                 SQLite database, mushaf images, audio files, Python pipeline
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2.0 |
| Frontend | React 18, TypeScript, Vite, Zustand, shadcn/ui, Tailwind CSS |
| Core engine | Rust (rusqlite, image, symphonia, imageproc) |
| Video export | FFmpeg (filter chains) |
| Database | SQLite (77,430 words, word-level alignments) |

## Development Commands

```bash
cargo tauri dev                          # Full desktop app with hot reload
cd desktop && npm run dev                # Frontend only (port 1420)
cd desktop && npm run typecheck          # TypeScript type check
cargo test -p quran-studio-core          # Rust core tests
cargo clippy                             # Rust linting
```

## Roadmap

1. **Phase 1** (current): Mushaf Mode desktop app (macOS)
2. **Phase 2**: Caption, Reel, Long-form modes + web version + custom audio
3. **Phase 3**: Mobile (iOS/Android) with touch-optimized timeline
4. **Phase 4**: Community contributions, plugins

## Data Sources

| Data | Source | License |
|------|--------|---------|
| Quran text (Uthmani) | [Tanzil.net](http://tanzil.net) | Open (non-commercial) |
| Mushaf images | King Fahd Complex | Open for Islamic use |
| Word coordinates | [Quran.com](https://quran.com) | MIT |
| Audio | [EveryAyah.com](https://everyayah.com) | Open |
| ASR model | Tarteel AI whisper-base-ar | Apache 2.0 |

## License

[Apache 2.0](LICENSE)
