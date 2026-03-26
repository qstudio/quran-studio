/**
 * Integration tests: Custom audio workflows
 */
import { act } from "@testing-library/react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useAppStore } from "@/stores/appStore";
import type { Project } from "@/types/project";

function createCustomAudioProject(mode: "mushaf" | "caption" | "reel" | "long_form" = "mushaf"): Project {
  // Similar to the mock but with custom audio fields
  return {
    id: "test-custom-1",
    name: "Al-Fatihah (Custom Audio)",
    mode,
    surah: 1, ayah_start: 1, ayah_end: 7,
    reciter_id: "custom",
    timeline: {
      duration_ms: 10000,
      tracks: [
        { id: "track-audio", name: "Audio", track_type: "audio", blocks: [
          { id: "audio-1", start_ms: 0, end_ms: 10000, data: { type: "audio", reciter_id: "custom", surah: 1, audio_path: "/path/to/my-recitation.mp3" } }
        ], visible: true, locked: false },
        { id: "track-mushaf", name: "Mushaf Pages", track_type: "mushaf_page", blocks: [
          { id: "page-1", start_ms: 0, end_ms: 10000, data: { type: "mushaf_page", page: 1, image_path: "mushaf/page_001.png" } }
        ], visible: true, locked: false },
        { id: "track-highlight", name: "Highlights", track_type: "highlight", blocks: [
          { id: "hl-1", start_ms: 0, end_ms: 1500, data: { type: "highlight", surah: 1, ayah: 1, word_position: 1, page: 1, x: 50000, y: 20000, width: 10000, height: 5000, text_uthmani: "بِسْمِ", style: { highlight_type: "golden_glow", color: "#D4A944", opacity: 0.6, border_radius: 4, padding: 4 } } },
          { id: "hl-2", start_ms: 1500, end_ms: 3000, data: { type: "highlight", surah: 1, ayah: 1, word_position: 2, page: 1, x: 35000, y: 20000, width: 8000, height: 5000, text_uthmani: "ٱللَّهِ", style: { highlight_type: "golden_glow", color: "#D4A944", opacity: 0.6, border_radius: 4, padding: 4 } } },
        ], visible: true, locked: false },
      ],
      playhead_ms: 0, zoom: 50, scroll_x: 0,
    },
    export_settings: { width: 1080, height: 1920, fps: 30, video_codec: "libx264", audio_codec: "aac", crf: 18, output_format: "mp4", output_path: null },
    created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z",
  };
}

describe("Custom audio project workflows", () => {
  it("custom audio project loads with reciter_id='custom'", () => {
    const project = createCustomAudioProject();
    act(() => useTimelineStore.getState().setProject(project));

    const state = useTimelineStore.getState();
    expect(state.project!.reciter_id, "Custom audio project should have reciter_id 'custom'").toBe("custom");
  });

  it("custom audio project has audio_path set in audio block", () => {
    const project = createCustomAudioProject();
    act(() => useTimelineStore.getState().setProject(project));

    const audioBlock = useTimelineStore.getState().project!.timeline.tracks[0].blocks[0];
    expect(audioBlock.data.type, "First track first block should be audio").toBe("audio");
    if (audioBlock.data.type === "audio") {
      expect(audioBlock.data.audio_path, "Audio block should have custom audio path").toBe("/path/to/my-recitation.mp3");
      expect(audioBlock.data.reciter_id, "Audio block reciter_id should be 'custom'").toBe("custom");
    }
  });

  it("editing operations work the same on custom audio projects", () => {
    const project = createCustomAudioProject();
    act(() => useTimelineStore.getState().setProject(project));

    // Select and move a highlight block
    act(() => useTimelineStore.getState().selectBlock("hl-1"));
    act(() => useTimelineStore.getState().moveBlock("hl-1", 500));

    const moved = useTimelineStore.getState().project!.timeline.tracks[2].blocks[0];
    expect(moved.start_ms, "Block should move to 500ms on custom audio project").toBe(500);

    // Undo works
    act(() => useTimelineStore.getState().undo());
    const restored = useTimelineStore.getState().project!.timeline.tracks[2].blocks[0];
    expect(restored.start_ms, "Undo should restore block to 0ms").toBe(0);
  });

  it("switching from custom audio project to reciter project resets state", () => {
    const customProject = createCustomAudioProject();
    act(() => useAppStore.getState().openProject(customProject));
    expect(useTimelineStore.getState().project!.reciter_id, "Should be custom").toBe("custom");

    // Switch to a normal project
    const normalProject = createCustomAudioProject();
    normalProject.id = "normal-1";
    normalProject.reciter_id = "mishary";
    act(() => useAppStore.getState().openProject(normalProject));

    expect(useTimelineStore.getState().project!.reciter_id, "Should switch to mishary").toBe("mishary");
    expect(useTimelineStore.getState().canUndo, "Undo history should reset on project switch").toBe(false);
  });
});

describe("Mock createProject with audioPath", () => {
  it("createProject with audioPath sets reciter_id to custom", async () => {
    const { useProjects } = await import("@/hooks/useTauri");
    const { createProject } = useProjects();

    const project = await createProject({
      mode: "mushaf",
      reciterId: "custom",
      surah: 1,
      ayahStart: 1,
      ayahEnd: 7,
      audioPath: "/path/to/audio.mp3",
    });

    expect(project.reciter_id, "Mock project with audioPath should have reciter_id 'custom'").toBe("custom");
  });

  it("createProject without audioPath uses reciterId as-is", async () => {
    const { useProjects } = await import("@/hooks/useTauri");
    const { createProject } = useProjects();

    const project = await createProject({
      mode: "mushaf",
      reciterId: "mishary",
      surah: 1,
      ayahStart: 1,
      ayahEnd: 7,
    });

    expect(project.reciter_id, "Mock project without audioPath should keep original reciterId").not.toBe("custom");
  });
});
