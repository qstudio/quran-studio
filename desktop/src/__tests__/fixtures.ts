import type { Project, Block, Track } from "@/types/project";

/** Create a minimal mock project for testing */
export function createTestProject(overrides?: Partial<Project>): Project {
  const highlightBlocks: Block[] = [
    {
      id: "hl-1",
      start_ms: 0,
      end_ms: 1000,
      data: {
        type: "highlight",
        surah: 1,
        ayah: 1,
        word_position: 1,
        page: 1,
        x: 50000,
        y: 20000,
        width: 10000,
        height: 5000,
        text_uthmani: "بِسْمِ",
        style: {
          highlight_type: "golden_glow",
          color: "#D4A944",
          opacity: 0.6,
          border_radius: 4,
          padding: 4,
        },
      },
    },
    {
      id: "hl-2",
      start_ms: 1000,
      end_ms: 2000,
      data: {
        type: "highlight",
        surah: 1,
        ayah: 1,
        word_position: 2,
        page: 1,
        x: 35000,
        y: 20000,
        width: 8000,
        height: 5000,
        text_uthmani: "ٱللَّهِ",
        style: {
          highlight_type: "golden_glow",
          color: "#D4A944",
          opacity: 0.6,
          border_radius: 4,
          padding: 4,
        },
      },
    },
    {
      id: "hl-3",
      start_ms: 2000,
      end_ms: 3000,
      data: {
        type: "highlight",
        surah: 1,
        ayah: 1,
        word_position: 3,
        page: 1,
        x: 20000,
        y: 20000,
        width: 12000,
        height: 5000,
        text_uthmani: "ٱلرَّحْمَـٰنِ",
        style: {
          highlight_type: "golden_glow",
          color: "#D4A944",
          opacity: 0.6,
          border_radius: 4,
          padding: 4,
        },
      },
    },
  ];

  const tracks: Track[] = [
    {
      id: "track-audio",
      name: "Audio",
      track_type: "audio",
      blocks: [
        {
          id: "audio-1",
          start_ms: 0,
          end_ms: 10000,
          data: {
            type: "audio",
            reciter_id: "mishary",
            surah: 1,
            audio_path: null,
          },
        },
      ],
      visible: true,
      locked: false,
    },
    {
      id: "track-mushaf",
      name: "Mushaf Pages",
      track_type: "mushaf_page",
      blocks: [
        {
          id: "page-1",
          start_ms: 0,
          end_ms: 10000,
          data: {
            type: "mushaf_page",
            page: 1,
            image_path: "mushaf/page_001.png",
          },
        },
      ],
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
  ];

  return {
    id: "test-project-1",
    name: "Al-Fatihah - Ayahs 1-7",
    mode: "mushaf",
    surah: 1,
    ayah_start: 1,
    ayah_end: 7,
    reciter_id: "mishary",
    timeline: {
      duration_ms: 10000,
      tracks,
      playhead_ms: 0,
      zoom: 50,
      scroll_x: 0,
    },
    export_settings: {
      width: 1080,
      height: 1920,
      fps: 30,
      video_codec: "libx264",
      audio_codec: "aac",
      crf: 18,
      output_format: "mp4",
      output_path: null,
    },
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}
