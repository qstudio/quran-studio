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
      reciter_id: params.reciterId,
      surah: params.surah,
      audio_path: null,
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

  const now = new Date().toISOString();
  const projectName = surahInfo
    ? `${surahInfo.name_english} ${params.ayahStart}-${params.ayahEnd}`
    : `Surah ${params.surah}`;

  return {
    id: `proj-${Date.now()}`,
    name: projectName,
    mode: "mushaf",
    surah: params.surah,
    ayah_start: params.ayahStart,
    ayah_end: params.ayahEnd,
    reciter_id: params.reciterId,
    timeline: {
      duration_ms: totalDurationMs,
      tracks: [
        {
          id: "track-audio",
          name: reciterInfo?.name_en ?? "Audio",
          track_type: "audio",
          blocks: [audioBlock],
          visible: true,
          locked: false,
        },
        {
          id: "track-mushaf",
          name: "Mushaf Pages",
          track_type: "mushaf_page",
          blocks: mushafBlocks,
          visible: true,
          locked: false,
        },
        {
          id: "track-highlight",
          name: "Highlights",
          track_type: "highlight",
          blocks: highlightBlocks,
          visible: true,
          locked: false,
        },
      ],
      playhead_ms: 0,
      zoom: 50,
      scroll_x: 0,
    },
    export_settings: {
      width: 1080,
      height: 1920,
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
    return [];
  }
}

async function createProject(params: {
  mode: string;
  reciterId: string;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
}): Promise<Project> {
  try {
    return await tauriInvoke<Project>("create_project", params);
  } catch {
    // Fallback to mock data when not in Tauri
    return createMockProject(params);
  }
}

async function loadProject(id: string): Promise<Project> {
  return tauriInvoke<Project>("load_project", { id });
}

async function saveProject(project: Project): Promise<void> {
  return tauriInvoke<void>("save_project", { project });
}

async function deleteProject(id: string): Promise<void> {
  return tauriInvoke<void>("delete_project", { id });
}

async function duplicateProject(id: string): Promise<Project> {
  return tauriInvoke<Project>("duplicate_project", { id });
}

async function listReciters(): Promise<Reciter[]> {
  try {
    return await tauriInvoke<Reciter[]>("list_reciters");
  } catch {
    return MOCK_RECITERS;
  }
}

async function listSurahs(): Promise<Surah[]> {
  try {
    return await tauriInvoke<Surah[]>("list_surahs");
  } catch {
    return MOCK_SURAHS;
  }
}

async function getSurahPages(surah: number): Promise<number[]> {
  try {
    return await tauriInvoke<number[]>("get_surah_pages", { surah });
  } catch {
    return [1, 2, 3];
  }
}

async function getPreviewFrame(projectId: string, timestampMs: number): Promise<number[]> {
  return tauriInvoke<number[]>("get_preview_frame", { projectId, timestampMs });
}

async function exportVideo(projectId: string, settings: ExportSettings): Promise<string> {
  return tauriInvoke<string>("export_video", { projectId, settings });
}

async function getExportProgress(): Promise<number> {
  return tauriInvoke<number>("get_export_progress");
}

async function cancelExport(): Promise<void> {
  return tauriInvoke<void>("cancel_export");
}

async function getAudioWaveform(reciterId: string, surah: number): Promise<number[]> {
  return tauriInvoke<number[]>("get_audio_waveform", { reciterId, surah });
}

async function getMushafPage(page: number): Promise<number[]> {
  return tauriInvoke<number[]>("get_mushaf_page", { page });
}

async function getMushafPagePath(page: number): Promise<string> {
  return tauriInvoke<string>("get_mushaf_page_path", { page });
}

async function getAudioFile(reciterId: string, surah: number): Promise<number[]> {
  return tauriInvoke<number[]>("get_audio_file", { reciterId, surah });
}

async function getAudioFilePath(reciterId: string, surah: number): Promise<string> {
  return tauriInvoke<string>("get_audio_file_path", { reciterId, surah });
}

async function readFileBytes(path: string): Promise<number[]> {
  return tauriInvoke<number[]>("read_file_bytes", { path });
}

async function convertToAssetUrl(filePath: string): Promise<string> {
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  return convertFileSrc(filePath);
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
