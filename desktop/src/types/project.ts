// Types matching Rust serde output from core/src/project.rs and core/src/quran_data.rs

// --- From quran_data.rs ---

export interface Reciter {
  id: string;
  name_en: string;
  name_ar: string;
  style: string | null;
  available_surahs: number[];
}

export interface Surah {
  number: number;
  name_arabic: string;
  name_english: string;
  total_ayahs: number;
}

// --- From project.rs ---

export type ProjectMode = "mushaf";

export type TrackType = "audio" | "mushaf_page" | "highlight";

export type HighlightType = "golden_glow" | "blue_box" | "underline";

export interface HighlightStyle {
  highlight_type: HighlightType;
  color: string;
  opacity: number;
  border_radius: number;
  padding: number;
}

export interface AudioBlockData {
  type: "audio";
  reciter_id: string;
  surah: number;
  audio_path: string | null;
}

export interface MushafPageBlockData {
  type: "mushaf_page";
  page: number;
  image_path: string;
}

export interface HighlightBlockData {
  type: "highlight";
  surah: number;
  ayah: number;
  word_position: number;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text_uthmani: string;
  style: HighlightStyle;
}

export type BlockData = AudioBlockData | MushafPageBlockData | HighlightBlockData;

export interface Block {
  id: string;
  start_ms: number;
  end_ms: number;
  data: BlockData;
}

export interface Track {
  id: string;
  name: string;
  track_type: TrackType;
  blocks: Block[];
  visible: boolean;
  locked: boolean;
}

export interface Timeline {
  duration_ms: number;
  tracks: Track[];
  // UI-only fields (not from Rust, used by the frontend store)
  playhead_ms: number;
  zoom: number;
  scroll_x: number;
}

export interface ExportSettings {
  width: number;
  height: number;
  fps: number;
  video_codec: string;
  audio_codec: string;
  crf: number;
  output_format: string;
  output_path: string | null;
}

export interface Project {
  id: string;
  name: string;
  mode: ProjectMode;
  surah: number;
  ayah_start: number;
  ayah_end: number;
  reciter_id: string;
  timeline: Timeline;
  export_settings: ExportSettings;
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  mode: ProjectMode;
  surah: number;
  reciter_id: string;
  duration_ms: number;
  created_at: string;
  updated_at: string;
}

/** Utility: Get block duration in ms */
export function blockDuration(block: Block): number {
  return block.end_ms - block.start_ms;
}

/** Utility: Check if two blocks overlap */
export function blocksOverlap(a: Block, b: Block): boolean {
  return a.start_ms < b.end_ms && b.start_ms < a.end_ms;
}

/** Utility: Check if a time falls within a block */
export function timeInBlock(ms: number, block: Block): boolean {
  return ms >= block.start_ms && ms < block.end_ms;
}
