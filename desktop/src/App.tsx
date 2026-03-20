import { useEffect } from "react";
import TimelineEditor from "./components/Timeline/TimelineEditor";
import { useTimelineStore } from "./stores/timelineStore";
import type { Project } from "./types/project";

function createDemoProject(): Project {
  return {
    id: "demo-project",
    name: "Al-Baqarah Recitation",
    mode: "mushaf",
    surah: 2,
    ayah_start: 1,
    ayah_end: 5,
    reciter_id: "mishari_rashid",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    timeline: {
      duration_ms: 300000,
      tracks: [
        {
          id: "track-audio",
          name: "Audio",
          track_type: "audio",
          locked: false,
          visible: true,
          blocks: [
            {
              id: "block-audio-1",
              start_ms: 0,
              end_ms: 300000,
              data: {
                type: "audio",
                reciter_id: "mishari_rashid",
                surah: 2,
                audio_path: null,
              },
            },
          ],
        },
        {
          id: "track-mushaf",
          name: "Mushaf Pages",
          track_type: "mushaf_page",
          locked: false,
          visible: true,
          blocks: [
            {
              id: "block-page-1",
              start_ms: 0,
              end_ms: 60000,
              data: {
                type: "mushaf_page",
                page: 2,
                image_path: "mushaf/page_002.png",
              },
            },
            {
              id: "block-page-2",
              start_ms: 60000,
              end_ms: 120000,
              data: {
                type: "mushaf_page",
                page: 3,
                image_path: "mushaf/page_003.png",
              },
            },
            {
              id: "block-page-3",
              start_ms: 120000,
              end_ms: 180000,
              data: {
                type: "mushaf_page",
                page: 4,
                image_path: "mushaf/page_004.png",
              },
            },
            {
              id: "block-page-4",
              start_ms: 180000,
              end_ms: 240000,
              data: {
                type: "mushaf_page",
                page: 5,
                image_path: "mushaf/page_005.png",
              },
            },
            {
              id: "block-page-5",
              start_ms: 240000,
              end_ms: 300000,
              data: {
                type: "mushaf_page",
                page: 6,
                image_path: "mushaf/page_006.png",
              },
            },
          ],
        },
        {
          id: "track-highlight",
          name: "Highlights",
          track_type: "highlight",
          locked: false,
          visible: true,
          blocks: generateDemoHighlights(150, 300000),
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
      video_codec: "libx264",
      audio_codec: "aac",
      crf: 18,
      output_format: "mp4",
      output_path: null,
    },
  };
}

function generateDemoHighlights(
  count: number,
  totalDuration: number
): import("./types/project").Block[] {
  const blocks: import("./types/project").Block[] = [];
  const avgDuration = totalDuration / count;
  let currentMs = 0;

  for (let i = 0; i < count; i++) {
    const duration = avgDuration * (0.5 + Math.random());
    blocks.push({
      id: `block-highlight-${i}`,
      start_ms: Math.round(currentMs),
      end_ms: Math.round(currentMs + duration),
      data: {
        type: "highlight",
        surah: 2,
        ayah: Math.floor(i / 10) + 1,
        word_position: (i % 10) + 1,
        page: 2 + Math.floor(i / 30),
        x: 100,
        y: 100 + (i % 20) * 30,
        width: 80,
        height: 25,
        text_uthmani: "",
        style: {
          highlight_type: "golden_glow",
          color: "#FFD700",
          opacity: 0.45,
          border_radius: 4,
          padding: 4,
        },
      },
    });
    currentMs += duration;
  }
  return blocks;
}

export default function App() {
  const setProject = useTimelineStore((s) => s.setProject);

  useEffect(() => {
    setProject(createDemoProject());
  }, [setProject]);

  return (
    <div className="h-full w-full flex flex-col bg-bg-root">
      <header className="h-10 flex items-center px-4 border-b border-border-default bg-bg-surface shrink-0">
        <span className="text-sm font-medium text-text-primary">Quran Studio</span>
        <span className="ml-3 text-xs text-text-tertiary">Timeline Editor</span>
      </header>
      <main className="flex-1 min-h-0">
        <TimelineEditor />
      </main>
    </div>
  );
}
