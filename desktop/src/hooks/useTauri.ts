import { invoke } from "@tauri-apps/api/core";
import type {
  Project,
  ProjectSummary,
  Reciter,
  Surah,
  ExportSettings,
} from "@/types/project";

export function useProjects() {
  return {
    listProjects: () => invoke<ProjectSummary[]>("list_projects"),
    createProject: (params: {
      mode: string;
      reciterId: string;
      surah: number;
      ayahStart: number;
      ayahEnd: number;
    }) => invoke<Project>("create_project", params),
    loadProject: (id: string) => invoke<Project>("load_project", { id }),
    saveProject: (project: Project) =>
      invoke<void>("save_project", { project }),
    deleteProject: (id: string) => invoke<void>("delete_project", { id }),
    duplicateProject: (id: string) =>
      invoke<Project>("duplicate_project", { id }),
  };
}

export function useReciters() {
  return {
    listReciters: () => invoke<Reciter[]>("list_reciters"),
  };
}

export function useSurahs() {
  return {
    listSurahs: () => invoke<Surah[]>("list_surahs"),
    getSurahPages: (surah: number) =>
      invoke<number[]>("get_surah_pages", { surah }),
  };
}

export function useExport() {
  return {
    exportVideo: (projectId: string, settings: ExportSettings) =>
      invoke<string>("export_video", { projectId, settings }),
    getExportProgress: () => invoke<number>("get_export_progress"),
    cancelExport: () => invoke<void>("cancel_export"),
  };
}

export function usePreview() {
  return {
    getPreviewFrame: (projectId: string, timestampMs: number) =>
      invoke<number[]>("get_preview_frame", { projectId, timestampMs }),
  };
}

export function useAudioWaveform() {
  return {
    getAudioWaveform: (reciterId: string, surah: number) =>
      invoke<number[]>("get_audio_waveform", { reciterId, surah }),
  };
}
