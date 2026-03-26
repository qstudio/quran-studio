import type {
  Project,
  ProjectSummary,
  Reciter,
  Surah,
  ExportSettings,
} from "@/types/project";

// Check if we're running inside Tauri
function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
}

// API base URL for HTTP mode (empty string = same origin)
const API_BASE = import.meta.env.VITE_API_URL || "";

// HTTP adapter for web mode — calls the Axum REST API
async function httpFetch<T>(
  endpoint: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const resp = await fetch(`${API_BASE}${endpoint}`, {
    method: options?.method || "GET",
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<T>;
}

// Fetch binary data as a byte array (for audio, images)
async function httpFetchBytes(endpoint: string): Promise<number[]> {
  const resp = await fetch(`${API_BASE}${endpoint}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const buf = await resp.arrayBuffer();
  return Array.from(new Uint8Array(buf));
}

// Dynamic import for Tauri's invoke — only works inside the Tauri shell
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error("Not running in Tauri");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// ─── Mock Data ─────────────────────────────────────────────────────

const MOCK_RECITERS: Reciter[] = [
  { id: "mishari_alafasy", name_en: "Mishari Rashid al-Afasy", name_ar: "مشاري راشد العفاسي", style: "Murattal", available_surahs: Array.from({ length: 114 }, (_, i) => i + 1) },
  { id: "abdul_basit", name_en: "Abdul Basit Abdul Samad", name_ar: "عبد الباسط عبد الصمد", style: "Mujawwad", available_surahs: Array.from({ length: 114 }, (_, i) => i + 1) },
  { id: "sudais", name_en: "Abdur-Rahman As-Sudais", name_ar: "عبدالرحمن السديس", style: "Murattal", available_surahs: Array.from({ length: 114 }, (_, i) => i + 1) },
  { id: "maher_al_muaiqly", name_en: "Maher Al Muaiqly", name_ar: "ماهر المعيقلي", style: "Murattal", available_surahs: Array.from({ length: 114 }, (_, i) => i + 1) },
  { id: "husary", name_en: "Mahmoud Khalil Al-Husary", name_ar: "محمود خليل الحصري", style: "Murattal", available_surahs: Array.from({ length: 114 }, (_, i) => i + 1) },
];

const MOCK_SURAHS: Surah[] = [
  { number: 1, name_arabic: "الفاتحة", name_english: "Al-Fatihah", total_ayahs: 7 },
  { number: 2, name_arabic: "البقرة", name_english: "Al-Baqarah", total_ayahs: 286 },
  { number: 3, name_arabic: "آل عمران", name_english: "Ali 'Imran", total_ayahs: 200 },
  { number: 36, name_arabic: "يس", name_english: "Ya-Sin", total_ayahs: 83 },
  { number: 55, name_arabic: "الرحمن", name_english: "Ar-Rahman", total_ayahs: 78 },
  { number: 56, name_arabic: "الواقعة", name_english: "Al-Waqi'ah", total_ayahs: 96 },
  { number: 67, name_arabic: "الملك", name_english: "Al-Mulk", total_ayahs: 30 },
  { number: 112, name_arabic: "الإخلاص", name_english: "Al-Ikhlas", total_ayahs: 4 },
  { number: 113, name_arabic: "الفلق", name_english: "Al-Falaq", total_ayahs: 5 },
  { number: 114, name_arabic: "الناس", name_english: "An-Nas", total_ayahs: 6 },
];

function createMockProject(params: {
  mode: string;
  reciterId: string;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  audioPath?: string;
}): Project {
  const surahInfo = MOCK_SURAHS.find((s) => s.number === params.surah);
  const reciterInfo = MOCK_RECITERS.find((r) => r.id === params.reciterId);

  const totalAyahs = (params.ayahEnd - params.ayahStart) + 1;
  const avgAyahDurationMs = 5000;
  const totalDurationMs = totalAyahs * avgAyahDurationMs;

  // Build audio track
  const audioBlock = {
    id: "block-audio-1",
    start_ms: 0,
    end_ms: totalDurationMs,
    data: {
      type: "audio" as const,
      reciter_id: params.audioPath ? "custom" : params.reciterId,
      surah: params.surah,
      audio_path: params.audioPath ?? null,
    },
  };

  // Build mushaf page blocks (mock: one page per ~10 ayahs)
  const mushafBlocks = [];
  const ayahsPerPage = 10;
  const pageCount = Math.max(1, Math.ceil(totalAyahs / ayahsPerPage));
  for (let i = 0; i < pageCount; i++) {
    mushafBlocks.push({
      id: `block-page-${i}`,
      start_ms: Math.round((i / pageCount) * totalDurationMs),
      end_ms: Math.round(((i + 1) / pageCount) * totalDurationMs),
      data: {
        type: "mushaf_page" as const,
        page: 1 + i,
        image_path: `/mock/page_${1 + i}.png`,
      },
    });
  }

  // Build highlight blocks (one per ayah, subdivided into ~3 words each)
  const highlightBlocks = [];
  let blockIdx = 0;
  for (let ayah = params.ayahStart; ayah <= params.ayahEnd; ayah++) {
    const ayahIdx = ayah - params.ayahStart;
    const ayahStartMs = Math.round((ayahIdx / totalAyahs) * totalDurationMs);
    const ayahEndMs = Math.round(((ayahIdx + 1) / totalAyahs) * totalDurationMs);
    const wordsPerAyah = 3;

    for (let w = 0; w < wordsPerAyah; w++) {
      const wordStartMs = ayahStartMs + Math.round((w / wordsPerAyah) * (ayahEndMs - ayahStartMs));
      const wordEndMs = ayahStartMs + Math.round(((w + 1) / wordsPerAyah) * (ayahEndMs - ayahStartMs));
      highlightBlocks.push({
        id: `block-hl-${blockIdx++}`,
        start_ms: wordStartMs,
        end_ms: wordEndMs,
        data: {
          type: "highlight" as const,
          surah: params.surah,
          ayah,
          word_position: w + 1,
          page: 1 + Math.floor(ayahIdx / ayahsPerPage),
          x: 100 + w * 80,
          y: 200 + (ayahIdx % 15) * 30,
          width: 70,
          height: 25,
          text_uthmani: `word_${w + 1}`,
          style: {
            highlight_type: "golden_glow" as const,
            color: "#D4A944",
            opacity: 0.6,
            border_radius: 4,
            padding: 4,
          },
        },
      });
    }
  }

  // Build text blocks (for Caption/Reel/LongForm)
  const arabicTextBlocks = [];
  for (let ayah = params.ayahStart; ayah <= params.ayahEnd; ayah++) {
    const ayahIdx = ayah - params.ayahStart;
    const ayahStartMs = Math.round((ayahIdx / totalAyahs) * totalDurationMs);
    const ayahEndMs = Math.round(((ayahIdx + 1) / totalAyahs) * totalDurationMs);
    arabicTextBlocks.push({
      id: `block-text-${ayah}`,
      start_ms: ayahStartMs,
      end_ms: ayahEndMs,
      data: {
        type: "text_arabic" as const,
        text: `Ayah ${ayah} text`,
        surah: params.surah,
        ayah,
        language: "ar",
        font_size: 48,
        color: "#FFFFFF",
        position: "center" as const,
      },
    });
  }

  const translationBlocks = arabicTextBlocks.map((ab) => ({
    ...ab,
    id: ab.id.replace("text-", "trans-"),
    data: {
      ...ab.data,
      type: "text_translation" as const,
      text: `Translation for ayah ${ab.data.ayah}`,
      language: "en",
      font_size: 24,
      color: "#A0A0A0",
      position: "bottom" as const,
    },
  }));

  // Build mode-specific track layout
  const mode = params.mode as "mushaf" | "caption" | "reel" | "long_form";

  let tracks;
  let exportWidth = 1080;
  let exportHeight = 1920;

  switch (mode) {
    case "caption":
      tracks = [
        { id: "track-audio", name: reciterInfo?.name_en ?? "Audio", track_type: "audio" as const, blocks: [audioBlock], visible: true, locked: false },
        { id: "track-arabic", name: "Arabic Text", track_type: "text_arabic" as const, blocks: arabicTextBlocks, visible: true, locked: false },
        { id: "track-translation", name: "Translation", track_type: "text_translation" as const, blocks: translationBlocks, visible: true, locked: false },
      ];
      break;
    case "reel":
      tracks = [
        { id: "track-bg", name: "Background", track_type: "background" as const, blocks: [{ id: "block-bg-1", start_ms: 0, end_ms: totalDurationMs, data: { type: "background" as const, color: "#0A0A0A" } }], visible: true, locked: false },
        { id: "track-audio", name: reciterInfo?.name_en ?? "Audio", track_type: "audio" as const, blocks: [audioBlock], visible: true, locked: false },
        { id: "track-arabic", name: "Arabic Text", track_type: "text_arabic" as const, blocks: arabicTextBlocks, visible: true, locked: false },
        { id: "track-highlight", name: "Highlights", track_type: "highlight" as const, blocks: highlightBlocks, visible: true, locked: false },
        { id: "track-translation", name: "Translation", track_type: "text_translation" as const, blocks: translationBlocks, visible: true, locked: false },
      ];
      break;
    case "long_form":
      tracks = [
        { id: "track-bg", name: "Background", track_type: "background" as const, blocks: [{ id: "block-bg-1", start_ms: 0, end_ms: totalDurationMs, data: { type: "background" as const, color: "#0A0A0A" } }], visible: true, locked: false },
        { id: "track-audio", name: reciterInfo?.name_en ?? "Audio", track_type: "audio" as const, blocks: [audioBlock], visible: true, locked: false },
        { id: "track-arabic", name: "Arabic Text", track_type: "text_arabic" as const, blocks: arabicTextBlocks, visible: true, locked: false },
        { id: "track-highlight", name: "Highlights", track_type: "highlight" as const, blocks: highlightBlocks, visible: true, locked: false },
        { id: "track-translation", name: "Translation", track_type: "text_translation" as const, blocks: translationBlocks, visible: true, locked: false },
        { id: "track-cards", name: "Cards", track_type: "card" as const, blocks: [{ id: "block-card-1", start_ms: 0, end_ms: 3000, data: { type: "card" as const, card_type: "surah_title" as const, text: surahInfo?.name_english ?? "Surah", background_color: "#000000", text_color: "#FFFFFF" } }], visible: true, locked: false },
      ];
      exportWidth = 1920;
      exportHeight = 1080;
      break;
    default: // mushaf
      tracks = [
        { id: "track-audio", name: reciterInfo?.name_en ?? "Audio", track_type: "audio" as const, blocks: [audioBlock], visible: true, locked: false },
        { id: "track-mushaf", name: "Mushaf Pages", track_type: "mushaf_page" as const, blocks: mushafBlocks, visible: true, locked: false },
        { id: "track-highlight", name: "Highlights", track_type: "highlight" as const, blocks: highlightBlocks, visible: true, locked: false },
      ];
      break;
  }

  const now = new Date().toISOString();
  const projectName = surahInfo
    ? `${surahInfo.name_english} ${params.ayahStart}-${params.ayahEnd}`
    : `Surah ${params.surah}`;

  return {
    id: `proj-${Date.now()}`,
    name: projectName,
    mode,
    surah: params.surah,
    ayah_start: params.ayahStart,
    ayah_end: params.ayahEnd,
    reciter_id: params.audioPath ? "custom" : params.reciterId,
    timeline: {
      duration_ms: totalDurationMs,
      tracks,
      playhead_ms: 0,
      zoom: 50,
      scroll_x: 0,
    },
    export_settings: {
      width: exportWidth,
      height: exportHeight,
      fps: 30,
      video_codec: "h264",
      audio_codec: "aac",
      crf: 23,
      output_format: "mp4",
      output_path: null,
    },
    created_at: now,
    updated_at: now,
  };
}

// ─── Stable API functions (module-level, not re-created per render) ───

async function listProjects(): Promise<ProjectSummary[]> {
  try {
    return await tauriInvoke<ProjectSummary[]>("list_projects");
  } catch {
    try {
      return await httpFetch<ProjectSummary[]>("/api/projects");
    } catch {
      return [];
    }
  }
}

async function createProject(params: {
  mode: string;
  reciterId: string;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  audioPath?: string;
}): Promise<Project> {
  try {
    return await tauriInvoke<Project>("create_project", params);
  } catch {
    try {
      return await httpFetch<Project>("/api/projects", { method: "POST", body: params });
    } catch {
      return createMockProject(params);
    }
  }
}

async function loadProject(id: string): Promise<Project> {
  if (isTauri()) return tauriInvoke<Project>("load_project", { id });
  return httpFetch<Project>(`/api/projects/${id}`);
}

async function saveProject(project: Project): Promise<void> {
  if (isTauri()) return tauriInvoke<void>("save_project", { project });
  await httpFetch<void>(`/api/projects/${project.id}`, { method: "PUT", body: project });
}

async function deleteProject(id: string): Promise<void> {
  if (isTauri()) return tauriInvoke<void>("delete_project", { id });
  await httpFetch<void>(`/api/projects/${id}`, { method: "DELETE" });
}

async function duplicateProject(id: string): Promise<Project> {
  if (isTauri()) return tauriInvoke<Project>("duplicate_project", { id });
  return httpFetch<Project>(`/api/projects/${id}/duplicate`, { method: "POST" });
}

async function listReciters(): Promise<Reciter[]> {
  try {
    return await tauriInvoke<Reciter[]>("list_reciters");
  } catch {
    try {
      return await httpFetch<Reciter[]>("/api/reciters");
    } catch {
      return MOCK_RECITERS;
    }
  }
}

async function listSurahs(): Promise<Surah[]> {
  try {
    return await tauriInvoke<Surah[]>("list_surahs");
  } catch {
    try {
      return await httpFetch<Surah[]>("/api/surahs");
    } catch {
      return MOCK_SURAHS;
    }
  }
}

async function getSurahPages(surah: number): Promise<number[]> {
  try {
    return await tauriInvoke<number[]>("get_surah_pages", { surah });
  } catch {
    try {
      return await httpFetch<number[]>(`/api/surahs/${surah}/pages`);
    } catch {
      return [1, 2, 3];
    }
  }
}

async function getPreviewFrame(projectId: string, timestampMs: number): Promise<number[]> {
  if (isTauri()) return tauriInvoke<number[]>("get_preview_frame", { projectId, timestampMs });
  return httpFetchBytes(`/api/projects/${projectId}/preview?at=${timestampMs}`);
}

async function exportVideo(projectId: string, settings: ExportSettings): Promise<string> {
  if (isTauri()) return tauriInvoke<string>("export_video", { projectId, settings });
  return httpFetch<string>(`/api/projects/${projectId}/export`, { method: "POST", body: { settings } });
}

async function getExportProgress(): Promise<number> {
  if (isTauri()) return tauriInvoke<number>("get_export_progress");
  return httpFetch<number>("/api/export/progress");
}

async function cancelExport(): Promise<void> {
  if (isTauri()) return tauriInvoke<void>("cancel_export");
  await httpFetch<void>("/api/export/cancel", { method: "POST" });
}

async function getAudioWaveform(reciterId: string, surah: number): Promise<number[]> {
  if (isTauri()) return tauriInvoke<number[]>("get_audio_waveform", { reciterId, surah });
  return httpFetch<number[]>(`/api/audio/${reciterId}/${surah}/waveform`);
}

async function getMushafPage(page: number, style?: string): Promise<number[]> {
  if (isTauri()) return tauriInvoke<number[]>("get_mushaf_page", { page, style });
  const query = style ? `?style=${style}` : "";
  return httpFetchBytes(`/api/mushaf/${page}${query}`);
}

async function getMushafPagePath(page: number, style?: string): Promise<string> {
  if (isTauri()) return tauriInvoke<string>("get_mushaf_page_path", { page, style });
  const query = style ? `?style=${style}` : "";
  return `${API_BASE}/api/mushaf/${page}${query}`;
}

async function getAudioFile(reciterId: string, surah: number): Promise<number[]> {
  if (isTauri()) return tauriInvoke<number[]>("get_audio_file", { reciterId, surah });
  return httpFetchBytes(`/api/audio/${reciterId}/${surah}`);
}

async function getAudioFilePath(reciterId: string, surah: number): Promise<string> {
  if (isTauri()) return tauriInvoke<string>("get_audio_file_path", { reciterId, surah });
  return `${API_BASE}/api/audio/${reciterId}/${surah}`;
}

async function readFileBytes(path: string): Promise<number[]> {
  return tauriInvoke<number[]>("read_file_bytes", { path });
}

async function convertToAssetUrl(filePath: string): Promise<string> {
  if (isTauri()) {
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    return convertFileSrc(filePath);
  }
  // In web mode, the path is already a URL or we serve it via API
  return filePath;
}

async function getAlignmentProgress(): Promise<number> {
  if (isTauri()) return tauriInvoke<number>("get_alignment_progress");
  return httpFetch<number>("/api/alignment/progress");
}

async function cancelAlignment(): Promise<void> {
  if (isTauri()) return tauriInvoke<void>("cancel_alignment");
  await httpFetch<void>("/api/alignment/cancel", { method: "POST" });
}

async function checkWhisperModel(): Promise<boolean> {
  try {
    if (isTauri()) return await tauriInvoke<boolean>("check_whisper_model");
    return await httpFetch<boolean>("/api/alignment/model");
  } catch {
    return false;
  }
}

// ─── Hooks (return stable references) ──────────────────────────────

const projectsApi = {
  listProjects,
  createProject,
  loadProject,
  saveProject,
  deleteProject,
  duplicateProject,
};

const recitersApi = {
  listReciters,
};

const surahsApi = {
  listSurahs,
  getSurahPages,
};

const exportApi = {
  exportVideo,
  getExportProgress,
  cancelExport,
};

const mushafApi = {
  getMushafPage,
  getMushafPagePath,
  convertToAssetUrl,
};

const audioApi = {
  getAudioFile,
  getAudioFilePath,
  readFileBytes,
  convertToAssetUrl,
};

const previewApi = {
  getPreviewFrame,
};

const waveformApi = {
  getAudioWaveform,
};

export function useProjects() {
  return projectsApi;
}

export function useReciters() {
  return recitersApi;
}

export function useSurahs() {
  return surahsApi;
}

export function useExport() {
  return exportApi;
}

export function useMushaf() {
  return mushafApi;
}

export function useAudioFile() {
  return audioApi;
}

export function usePreview() {
  return previewApi;
}

export { isTauri };

export function useAudioWaveform() {
  return waveformApi;
}

const alignmentApi = {
  getAlignmentProgress,
  cancelAlignment,
  checkWhisperModel,
};

export function useAlignment() {
  return alignmentApi;
}
