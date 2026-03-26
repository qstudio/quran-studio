# Web Version Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an Axum (Rust) HTTP server that serves the same React frontend as the desktop app, making Quran Studio accessible via any web browser.

**Architecture:** The `core/` library is already platform-agnostic — the web server wraps it with HTTP handlers instead of Tauri IPC. The React frontend detects whether it's running in Tauri or web mode and uses `fetch()` instead of `invoke()`. The Axum server serves the built SPA as static files and exposes a REST API at `/api/`.

**Tech Stack:** Axum 0.7 (Rust), tower-http (CORS, static files), same React frontend, same `core/` library

---

## Endpoint Mapping

| Tauri Command | HTTP Endpoint | Method |
|---------------|---------------|--------|
| `list_projects` | `/api/projects` | GET |
| `create_project` | `/api/projects` | POST |
| `load_project` | `/api/projects/:id` | GET |
| `save_project` | `/api/projects/:id` | PUT |
| `delete_project` | `/api/projects/:id` | DELETE |
| `duplicate_project` | `/api/projects/:id/duplicate` | POST |
| `list_reciters` | `/api/reciters` | GET |
| `list_surahs` | `/api/surahs` | GET |
| `get_surah_pages` | `/api/surahs/:num/pages` | GET |
| `get_audio_file` | `/api/audio/:reciter/:surah` | GET |
| `get_mushaf_page` | `/api/mushaf/:page` | GET |
| `get_preview_frame` | `/api/projects/:id/preview` | GET |
| `get_audio_waveform` | `/api/audio/:reciter/:surah/waveform` | GET |
| `export_video` | `/api/projects/:id/export` | POST |
| `get_export_progress` | `/api/export/progress` | GET |
| `cancel_export` | `/api/export/cancel` | POST |
| `get_alignment_progress` | `/api/alignment/progress` | GET |
| `cancel_alignment` | `/api/alignment/cancel` | POST |
| `check_whisper_model` | `/api/alignment/model` | GET |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `web/Cargo.toml` | **Create** — Axum server crate |
| `web/src/main.rs` | **Create** — Server entry point, router, static file serving |
| `web/src/handlers.rs` | **Create** — HTTP handler functions wrapping core library |
| `web/src/state.rs` | **Create** — AppState (same shape as Tauri, with Arc wrapping) |
| `Cargo.toml` (root) | **Modify** — add `web` to workspace members, add `axum`/`tower-http` deps |
| `desktop/src/hooks/useTauri.ts` | **Modify** — add HTTP mode detection + `fetch()` adapter |
| `desktop/vite.config.ts` | **Modify** — add proxy for `/api` in dev mode |

---

### Task 1: Scaffold `web/` crate with Axum server

**Files:**
- Create: `web/Cargo.toml`
- Create: `web/src/main.rs`
- Create: `web/src/state.rs`
- Modify: `Cargo.toml` (root workspace)

Add `web` to workspace members. Create the Axum server with AppState, data dir discovery (reuse same logic as Tauri), and a health check endpoint at `GET /api/health`.

**Dependencies:**
```toml
axum = "0.7"
tokio = { version = "1", features = ["full"] }
tower-http = { version = "0.6", features = ["cors", "fs"] }
serde_json = "1"
quran-studio-core = { path = "../core" }
rusqlite = { version = "0.31", features = ["bundled"] }
```

**Verify:** `cargo check -p quran-studio-web`

### Task 2: Implement core API handlers (projects, reciters, surahs)

**Files:**
- Create: `web/src/handlers.rs`
- Modify: `web/src/main.rs` (register routes)

Implement these handlers wrapping core library calls:
- `GET /api/projects` → `quran_studio_core::project::list_projects()`
- `POST /api/projects` → `build_*_project()` dispatched by mode
- `GET /api/projects/:id` → `load_project()`
- `PUT /api/projects/:id` → `save_project()`
- `DELETE /api/projects/:id` → `delete_project()`
- `POST /api/projects/:id/duplicate` → `duplicate_project()`
- `GET /api/reciters` → `list_reciters()`
- `GET /api/surahs` → `list_surahs()`
- `GET /api/surahs/:num/pages` → `get_pages_for_surah()`

Pattern: use `tokio::task::spawn_blocking` for SQLite calls (same as Tauri).

**Verify:** `cargo check -p quran-studio-web`

### Task 3: Implement media handlers (audio, mushaf, preview, waveform)

**Files:**
- Modify: `web/src/handlers.rs`
- Modify: `web/src/main.rs`

Binary response handlers:
- `GET /api/audio/:reciter/:surah` → returns MP3 bytes with `Content-Type: audio/mpeg`
- `GET /api/mushaf/:page?style=madani` → returns PNG bytes with `Content-Type: image/png`
- `GET /api/projects/:id/preview?at=1234` → returns preview frame PNG
- `GET /api/audio/:reciter/:surah/waveform` → returns `Vec<f32>` as JSON

Use `axum::response::Response` with appropriate content-type headers for binary responses.

### Task 4: Implement export and alignment progress handlers

**Files:**
- Modify: `web/src/handlers.rs`
- Modify: `web/src/main.rs`

- `POST /api/projects/:id/export` → spawn FFmpeg export, return immediately
- `GET /api/export/progress` → read AtomicU32
- `POST /api/export/cancel` → set AtomicBool
- `GET /api/alignment/progress` → read AtomicU32
- `POST /api/alignment/cancel` → set AtomicBool
- `GET /api/alignment/model` → check whisper model exists

### Task 5: Static file serving + SPA fallback

**Files:**
- Modify: `web/src/main.rs`

Serve the built React SPA from `desktop/dist/` (or a configurable path):
```rust
.fallback_service(
    ServeDir::new(&static_dir)
        .fallback(ServeFile::new(static_dir.join("index.html")))
)
```

The SPA fallback ensures that browser-refreshing on any route serves `index.html`, letting React Router handle client-side navigation.

**Verify:** `cargo run -p quran-studio-web` serves the SPA at `http://localhost:3000`

### Task 6: Adapt frontend for dual-mode (Tauri + HTTP)

**Files:**
- Modify: `desktop/src/hooks/useTauri.ts`
- Modify: `desktop/vite.config.ts`

In `useTauri.ts`, replace the throw-on-non-Tauri pattern with HTTP fallback:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || "";

async function httpInvoke<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${endpoint}`, options);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  return resp.json();
}
```

Update each API function to try Tauri first, then HTTP:
```typescript
async function listProjects(): Promise<ProjectSummary[]> {
  if (isTauri()) return tauriInvoke("list_projects");
  return httpInvoke("/api/projects");
}
```

For binary responses (audio, images), fetch as blob and create object URLs.

In `vite.config.ts`, add a dev proxy so the React dev server forwards `/api` to the Axum server:
```typescript
server: {
  proxy: { "/api": "http://localhost:3000" }
}
```

### Task 7: CORS and security

**Files:**
- Modify: `web/src/main.rs`

Add CORS middleware for development:
```rust
use tower_http::cors::{CorsLayer, Any};

let cors = CorsLayer::new()
    .allow_origin(Any)
    .allow_methods(Any)
    .allow_headers(Any);
```

In production, restrict to the actual origin.

### Task 8: Tests

**Rust tests:**
- Health check endpoint returns 200
- `GET /api/surahs` returns 114 surahs
- `GET /api/reciters` returns non-empty list
- `POST /api/projects` creates a mushaf project and returns valid JSON
- `GET /api/projects/:id` loads a saved project
- `GET /api/mushaf/1` returns PNG bytes

**Frontend tests (Vitest):**
- `useTauri.ts` HTTP mode: `listProjects()` calls `/api/projects`
- `useTauri.ts` correctly detects Tauri vs HTTP mode

**E2E (Playwright against Axum server):**
- App loads at `http://localhost:3000`
- Can create a project and enter editor
- Timeline renders

**Verify:** All existing tests still pass + new web tests pass

---

## Verification

1. `cargo check --workspace` — all 3 crates compile
2. `cargo test -p quran-studio-core` — existing tests pass
3. `cd desktop && npm run build` — SPA builds to `dist/`
4. `cargo run -p quran-studio-web` — server starts at :3000
5. Open `http://localhost:3000` — app loads, can create project, timeline works
6. `cd desktop && npm test` — existing Vitest passes
7. `cd desktop && npx playwright test` — E2E passes against web server
