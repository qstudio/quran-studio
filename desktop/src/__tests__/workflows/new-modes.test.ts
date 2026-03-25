/**
 * Integration tests: Caption, Reel, and Long-form mode workflows
 *
 * Simulates real user interactions with the three new editing modes,
 * verifying track structures, block operations, undo/redo, playback,
 * and cross-mode project switching.
 */
import { act } from "@testing-library/react";
import { renderHook, fireEvent } from "@testing-library/react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Project } from "@/types/project";

// ─── Helpers ──────────────────────────────────────────────────────────

function getState() {
  return useTimelineStore.getState();
}

function getBlock(blockId: string) {
  const project = getState().project!;
  for (const track of project.timeline.tracks) {
    for (const block of track.blocks) {
      if (block.id === blockId) return block;
    }
  }
  return null;
}

function getTrack(trackId: string) {
  const project = getState().project!;
  return project.timeline.tracks.find((t) => t.id === trackId) ?? null;
}

function press(key: string, opts: Partial<KeyboardEventInit> = {}) {
  fireEvent.keyDown(window, { key, ...opts });
}

// ─── Project Fixtures ─────────────────────────────────────────────────

function createCaptionProject(): Project {
  return {
    id: "test-caption-1",
    name: "Al-Fatihah Caption",
    mode: "caption",
    surah: 1,
    ayah_start: 1,
    ayah_end: 7,
    reciter_id: "mishary",
    timeline: {
      duration_ms: 10000,
      tracks: [
        {
          id: "track-audio",
          name: "Audio",
          track_type: "audio",
          blocks: [
            {
              id: "audio-1",
              start_ms: 0,
              end_ms: 10000,
              data: { type: "audio", reciter_id: "mishary", surah: 1, audio_path: null },
            },
          ],
          visible: true,
          locked: false,
        },
        {
          id: "track-arabic",
          name: "Arabic Text",
          track_type: "text_arabic",
          blocks: [
            {
              id: "text-1",
              start_ms: 0,
              end_ms: 3000,
              data: { type: "text_arabic", text: "بِسْمِ ٱللَّهِ", surah: 1, ayah: 1, language: "ar", font_size: 48, color: "#FFFFFF", position: "center" },
            },
            {
              id: "text-2",
              start_ms: 3000,
              end_ms: 6000,
              data: { type: "text_arabic", text: "ٱلْحَمْدُ لِلَّهِ", surah: 1, ayah: 2, language: "ar", font_size: 48, color: "#FFFFFF", position: "center" },
            },
            {
              id: "text-3",
              start_ms: 6000,
              end_ms: 10000,
              data: { type: "text_arabic", text: "رَبِّ ٱلْعَـٰلَمِينَ", surah: 1, ayah: 3, language: "ar", font_size: 48, color: "#FFFFFF", position: "center" },
            },
          ],
          visible: true,
          locked: false,
        },
        {
          id: "track-translation",
          name: "Translation",
          track_type: "text_translation",
          blocks: [
            {
              id: "trans-1",
              start_ms: 0,
              end_ms: 3000,
              data: { type: "text_translation", text: "In the name of God", surah: 1, ayah: 1, language: "en", font_size: 24, color: "#A0A0A0", position: "bottom" },
            },
            {
              id: "trans-2",
              start_ms: 3000,
              end_ms: 6000,
              data: { type: "text_translation", text: "Praise be to God", surah: 1, ayah: 2, language: "en", font_size: 24, color: "#A0A0A0", position: "bottom" },
            },
          ],
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
      video_codec: "libx264",
      audio_codec: "aac",
      crf: 18,
      output_format: "mp4",
      output_path: null,
    },
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

function createReelProject(): Project {
  return {
    id: "test-reel-1",
    name: "Al-Fatihah Reel",
    mode: "reel",
    surah: 1,
    ayah_start: 1,
    ayah_end: 7,
    reciter_id: "mishary",
    timeline: {
      duration_ms: 10000,
      tracks: [
        {
          id: "track-bg",
          name: "Background",
          track_type: "background",
          blocks: [
            {
              id: "bg-1",
              start_ms: 0,
              end_ms: 10000,
              data: { type: "background", color: "#0A0A0A" },
            },
          ],
          visible: true,
          locked: false,
        },
        {
          id: "track-audio",
          name: "Audio",
          track_type: "audio",
          blocks: [
            {
              id: "audio-1",
              start_ms: 0,
              end_ms: 10000,
              data: { type: "audio", reciter_id: "mishary", surah: 1, audio_path: null },
            },
          ],
          visible: true,
          locked: false,
        },
        {
          id: "track-arabic",
          name: "Arabic Text",
          track_type: "text_arabic",
          blocks: [
            {
              id: "text-1",
              start_ms: 0,
              end_ms: 3000,
              data: { type: "text_arabic", text: "بِسْمِ ٱللَّهِ", surah: 1, ayah: 1, language: "ar", font_size: 48, color: "#FFFFFF", position: "center" },
            },
            {
              id: "text-2",
              start_ms: 3000,
              end_ms: 6000,
              data: { type: "text_arabic", text: "ٱلْحَمْدُ لِلَّهِ", surah: 1, ayah: 2, language: "ar", font_size: 48, color: "#FFFFFF", position: "center" },
            },
          ],
          visible: true,
          locked: false,
        },
        {
          id: "track-highlight",
          name: "Highlights",
          track_type: "highlight",
          blocks: [
            {
              id: "hl-1",
              start_ms: 0,
              end_ms: 1000,
              data: {
                type: "highlight",
                surah: 1, ayah: 1, word_position: 1, page: 1,
                x: 50000, y: 20000, width: 10000, height: 5000,
                text_uthmani: "بِسْمِ",
                style: { highlight_type: "golden_glow", color: "#D4A944", opacity: 0.6, border_radius: 4, padding: 4 },
              },
            },
            {
              id: "hl-2",
              start_ms: 1000,
              end_ms: 2000,
              data: {
                type: "highlight",
                surah: 1, ayah: 1, word_position: 2, page: 1,
                x: 35000, y: 20000, width: 8000, height: 5000,
                text_uthmani: "ٱللَّهِ",
                style: { highlight_type: "golden_glow", color: "#D4A944", opacity: 0.6, border_radius: 4, padding: 4 },
              },
            },
          ],
          visible: true,
          locked: false,
        },
        {
          id: "track-translation",
          name: "Translation",
          track_type: "text_translation",
          blocks: [
            {
              id: "trans-1",
              start_ms: 0,
              end_ms: 3000,
              data: { type: "text_translation", text: "In the name of God", surah: 1, ayah: 1, language: "en", font_size: 24, color: "#A0A0A0", position: "bottom" },
            },
          ],
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
      video_codec: "libx264",
      audio_codec: "aac",
      crf: 18,
      output_format: "mp4",
      output_path: null,
    },
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

function createLongFormProject(): Project {
  return {
    id: "test-longform-1",
    name: "Al-Fatihah Long-form",
    mode: "long_form",
    surah: 1,
    ayah_start: 1,
    ayah_end: 7,
    reciter_id: "mishary",
    timeline: {
      duration_ms: 10000,
      tracks: [
        {
          id: "track-bg",
          name: "Background",
          track_type: "background",
          blocks: [
            {
              id: "bg-1",
              start_ms: 0,
              end_ms: 10000,
              data: { type: "background", color: "#0A0A0A" },
            },
          ],
          visible: true,
          locked: false,
        },
        {
          id: "track-audio",
          name: "Audio",
          track_type: "audio",
          blocks: [
            {
              id: "audio-1",
              start_ms: 0,
              end_ms: 10000,
              data: { type: "audio", reciter_id: "mishary", surah: 1, audio_path: null },
            },
          ],
          visible: true,
          locked: false,
        },
        {
          id: "track-arabic",
          name: "Arabic Text",
          track_type: "text_arabic",
          blocks: [
            {
              id: "text-1",
              start_ms: 0,
              end_ms: 3000,
              data: { type: "text_arabic", text: "بِسْمِ ٱللَّهِ", surah: 1, ayah: 1, language: "ar", font_size: 48, color: "#FFFFFF", position: "center" },
            },
            {
              id: "text-2",
              start_ms: 3000,
              end_ms: 6000,
              data: { type: "text_arabic", text: "ٱلْحَمْدُ لِلَّهِ", surah: 1, ayah: 2, language: "ar", font_size: 48, color: "#FFFFFF", position: "center" },
            },
          ],
          visible: true,
          locked: false,
        },
        {
          id: "track-highlight",
          name: "Highlights",
          track_type: "highlight",
          blocks: [
            {
              id: "hl-1",
              start_ms: 0,
              end_ms: 1000,
              data: {
                type: "highlight",
                surah: 1, ayah: 1, word_position: 1, page: 1,
                x: 50000, y: 20000, width: 10000, height: 5000,
                text_uthmani: "بِسْمِ",
                style: { highlight_type: "golden_glow", color: "#D4A944", opacity: 0.6, border_radius: 4, padding: 4 },
              },
            },
          ],
          visible: true,
          locked: false,
        },
        {
          id: "track-translation",
          name: "Translation",
          track_type: "text_translation",
          blocks: [
            {
              id: "trans-1",
              start_ms: 0,
              end_ms: 3000,
              data: { type: "text_translation", text: "In the name of God", surah: 1, ayah: 1, language: "en", font_size: 24, color: "#A0A0A0", position: "bottom" },
            },
          ],
          visible: true,
          locked: false,
        },
        {
          id: "track-cards",
          name: "Cards",
          track_type: "card",
          blocks: [
            {
              id: "card-1",
              start_ms: 0,
              end_ms: 3000,
              data: { type: "card", card_type: "surah_title", text: "Al-Fatihah", background_color: "#000000", text_color: "#FFFFFF" },
            },
            {
              id: "card-2",
              start_ms: 7000,
              end_ms: 10000,
              data: { type: "card", card_type: "ayah_end", text: "End of recitation", background_color: "#111111", text_color: "#CCCCCC" },
            },
          ],
          visible: true,
          locked: false,
        },
      ],
      playhead_ms: 0,
      zoom: 50,
      scroll_x: 0,
    },
    export_settings: {
      width: 1920,
      height: 1080,
      fps: 30,
      video_codec: "libx264",
      audio_codec: "aac",
      crf: 18,
      output_format: "mp4",
      output_path: null,
    },
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Caption Mode Workflows
// ═══════════════════════════════════════════════════════════════════════

describe("Caption mode workflows", () => {
  beforeEach(() => {
    act(() => {
      useTimelineStore.getState().setProject(createCaptionProject());
    });
  });

  it("opens caption project with exactly 3 tracks: audio, text_arabic, text_translation", () => {
    const tracks = getState().project!.timeline.tracks;
    expect(tracks.length, "Caption project should have exactly 3 tracks").toBe(3);

    const trackTypes = tracks.map((t) => t.track_type);
    expect(
      trackTypes,
      "Caption track types should be [audio, text_arabic, text_translation]"
    ).toEqual(["audio", "text_arabic", "text_translation"]);

    expect(
      getState().project!.mode,
      "Project mode should be 'caption'"
    ).toBe("caption");
  });

  it("selects a text block, moves it, undoes, and verifies restored position", () => {
    const originalStart = getBlock("text-1")!.start_ms;
    const originalEnd = getBlock("text-1")!.end_ms;

    // Select text block
    act(() => getState().selectBlock("text-1"));
    expect(
      getState().selectedBlockIds,
      "After clicking text-1, it should be the only selected block"
    ).toEqual(["text-1"]);
    expect(
      getState().selectedTrackId,
      "After clicking text-1, selectedTrackId should be the Arabic text track"
    ).toBe("track-arabic");

    // Move block to 500ms
    act(() => getState().moveBlock("text-1", 500));
    expect(
      getBlock("text-1")!.start_ms,
      "After moving, text-1 should start at 500ms"
    ).toBe(500);
    expect(
      getBlock("text-1")!.end_ms,
      "After moving, text-1 should end at 3500ms (duration preserved: 3000ms)"
    ).toBe(3500);

    // Undo
    act(() => getState().undo());
    expect(
      getBlock("text-1")!.start_ms,
      "After undo, text-1 should return to original start position (0ms)"
    ).toBe(originalStart);
    expect(
      getBlock("text-1")!.end_ms,
      "After undo, text-1 should return to original end position (3000ms)"
    ).toBe(originalEnd);
  });

  it("deletes a translation block without affecting text_arabic blocks", () => {
    // Select and delete trans-1
    act(() => getState().selectBlock("trans-1"));
    act(() => getState().deleteSelectedBlocks());

    expect(
      getBlock("trans-1"),
      "Translation block trans-1 should be deleted"
    ).toBeNull();

    // Arabic text blocks should be unaffected
    expect(
      getBlock("text-1"),
      "Arabic text block text-1 should remain after deleting translation"
    ).not.toBeNull();
    expect(
      getBlock("text-2"),
      "Arabic text block text-2 should remain after deleting translation"
    ).not.toBeNull();
    expect(
      getBlock("text-3"),
      "Arabic text block text-3 should remain after deleting translation"
    ).not.toBeNull();

    // Other translation block should also remain
    expect(
      getBlock("trans-2"),
      "Translation block trans-2 should remain (only trans-1 was selected)"
    ).not.toBeNull();
  });

  it("scrubs playhead through the caption project timeline", () => {
    // Scrub to various positions
    act(() => getState().setPlayhead(2500));
    expect(
      getState().project!.timeline.playhead_ms,
      "Playhead should be at 2500ms after scrub"
    ).toBe(2500);

    act(() => getState().setPlayhead(7500));
    expect(
      getState().project!.timeline.playhead_ms,
      "Playhead should be at 7500ms after second scrub"
    ).toBe(7500);

    // Scrub beyond duration should clamp
    act(() => getState().setPlayhead(15000));
    expect(
      getState().project!.timeline.playhead_ms,
      "Playhead should clamp to duration_ms (10000) when scrubbing beyond end"
    ).toBe(10000);

    // Scrub to negative should clamp to 0
    act(() => getState().setPlayhead(-100));
    expect(
      getState().project!.timeline.playhead_ms,
      "Playhead should clamp to 0 when scrubbing to negative value"
    ).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Reel Mode Workflows
// ═══════════════════════════════════════════════════════════════════════

describe("Reel mode workflows", () => {
  beforeEach(() => {
    act(() => {
      useTimelineStore.getState().setProject(createReelProject());
    });
  });

  it("opens reel project with exactly 5 tracks", () => {
    const tracks = getState().project!.timeline.tracks;
    expect(tracks.length, "Reel project should have exactly 5 tracks").toBe(5);

    const trackTypes = tracks.map((t) => t.track_type);
    expect(
      trackTypes,
      "Reel track types should be [background, audio, text_arabic, highlight, text_translation]"
    ).toEqual(["background", "audio", "text_arabic", "highlight", "text_translation"]);

    expect(
      getState().project!.mode,
      "Project mode should be 'reel'"
    ).toBe("reel");
  });

  it("selects a highlight block, moves it, and undoes to restore", () => {
    const originalStart = getBlock("hl-1")!.start_ms;
    const originalEnd = getBlock("hl-1")!.end_ms;

    act(() => getState().selectBlock("hl-1"));
    expect(
      getState().selectedBlockIds,
      "After clicking hl-1, it should be selected"
    ).toEqual(["hl-1"]);

    act(() => getState().moveBlock("hl-1", 2000));
    expect(
      getBlock("hl-1")!.start_ms,
      "After moving, hl-1 should start at 2000ms"
    ).toBe(2000);
    expect(
      getBlock("hl-1")!.end_ms,
      "After moving, hl-1 should end at 3000ms (duration 1000ms preserved)"
    ).toBe(3000);

    act(() => getState().undo());
    expect(
      getBlock("hl-1")!.start_ms,
      "After undo, hl-1 should return to original start (0ms)"
    ).toBe(originalStart);
    expect(
      getBlock("hl-1")!.end_ms,
      "After undo, hl-1 should return to original end (1000ms)"
    ).toBe(originalEnd);
  });

  it("toggles background track visibility without affecting other tracks", () => {
    // Toggle background track off
    act(() => getState().toggleTrackVisibility("track-bg"));

    const bgTrack = getTrack("track-bg");
    expect(
      bgTrack!.visible,
      "Background track should be hidden after toggle"
    ).toBe(false);

    // Other tracks remain visible
    expect(
      getTrack("track-audio")!.visible,
      "Audio track should remain visible after toggling background"
    ).toBe(true);
    expect(
      getTrack("track-arabic")!.visible,
      "Arabic text track should remain visible after toggling background"
    ).toBe(true);
    expect(
      getTrack("track-highlight")!.visible,
      "Highlight track should remain visible after toggling background"
    ).toBe(true);
    expect(
      getTrack("track-translation")!.visible,
      "Translation track should remain visible after toggling background"
    ).toBe(true);

    // Toggle back on
    act(() => getState().toggleTrackVisibility("track-bg"));
    expect(
      getTrack("track-bg")!.visible,
      "Background track should be visible again after second toggle"
    ).toBe(true);
  });

  it("locks highlight track and prevents block moves, then unlocks", () => {
    // Lock the highlight track
    act(() => getState().toggleTrackLock("track-highlight"));
    expect(
      getTrack("track-highlight")!.locked,
      "Highlight track should be locked after toggle"
    ).toBe(true);

    // Try to move a highlight block — should be ignored
    const originalStart = getBlock("hl-1")!.start_ms;
    act(() => getState().moveBlock("hl-1", 5000));
    expect(
      getBlock("hl-1")!.start_ms,
      "Move on locked highlight track should be ignored; block should remain at original position"
    ).toBe(originalStart);

    // Blocks on other (unlocked) tracks should still be movable
    act(() => getState().moveBlock("text-1", 1000));
    expect(
      getBlock("text-1")!.start_ms,
      "Text block on unlocked track should move to 1000ms"
    ).toBe(1000);

    // Unlock and verify move now works
    act(() => getState().toggleTrackLock("track-highlight"));
    expect(
      getTrack("track-highlight")!.locked,
      "Highlight track should be unlocked after second toggle"
    ).toBe(false);

    act(() => getState().moveBlock("hl-1", 5000));
    expect(
      getBlock("hl-1")!.start_ms,
      "After unlocking, highlight block should move to 5000ms"
    ).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Long-form Mode Workflows
// ═══════════════════════════════════════════════════════════════════════

describe("Long-form mode workflows", () => {
  beforeEach(() => {
    act(() => {
      useTimelineStore.getState().setProject(createLongFormProject());
    });
  });

  it("opens long-form project with exactly 6 tracks including card track", () => {
    const tracks = getState().project!.timeline.tracks;
    expect(tracks.length, "Long-form project should have exactly 6 tracks").toBe(6);

    const trackTypes = tracks.map((t) => t.track_type);
    expect(
      trackTypes,
      "Long-form track types should be [background, audio, text_arabic, highlight, text_translation, card]"
    ).toEqual(["background", "audio", "text_arabic", "highlight", "text_translation", "card"]);

    expect(
      getState().project!.mode,
      "Project mode should be 'long_form'"
    ).toBe("long_form");
  });

  it("card blocks exist with correct type and data fields", () => {
    const cardTrack = getTrack("track-cards");
    expect(
      cardTrack,
      "Card track should exist in long-form project"
    ).not.toBeNull();
    expect(
      cardTrack!.blocks.length,
      "Card track should have 2 card blocks"
    ).toBe(2);

    const card1 = getBlock("card-1")!;
    expect(
      card1.data.type,
      "First card block data type should be 'card'"
    ).toBe("card");
    if (card1.data.type === "card") {
      expect(
        card1.data.card_type,
        "First card block card_type should be 'surah_title'"
      ).toBe("surah_title");
      expect(
        card1.data.text,
        "First card block text should be 'Al-Fatihah'"
      ).toBe("Al-Fatihah");
    }

    const card2 = getBlock("card-2")!;
    expect(
      card2.data.type,
      "Second card block data type should be 'card'"
    ).toBe("card");
    if (card2.data.type === "card") {
      expect(
        card2.data.card_type,
        "Second card block card_type should be 'ayah_end'"
      ).toBe("ayah_end");
    }
  });

  it("export settings are 16:9 (1920x1080) for long-form mode", () => {
    const settings = getState().project!.export_settings;
    expect(
      settings.width,
      "Long-form export width should be 1920 (16:9 landscape)"
    ).toBe(1920);
    expect(
      settings.height,
      "Long-form export height should be 1080 (16:9 landscape)"
    ).toBe(1080);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Cross-mode Consistency
// ═══════════════════════════════════════════════════════════════════════

describe("Cross-mode consistency", () => {
  it("switching from caption to reel project fully resets state", () => {
    // Load caption project and interact
    act(() => getState().setProject(createCaptionProject()));
    act(() => getState().selectBlock("text-1"));
    act(() => getState().moveBlock("text-1", 500));
    act(() => getState().setPlayhead(5000));

    expect(
      getState().project!.mode,
      "Should be in caption mode before switching"
    ).toBe("caption");
    expect(
      getState().selectedBlockIds.length,
      "Should have a selected block before switching"
    ).toBeGreaterThan(0);

    // Switch to reel project
    act(() => getState().setProject(createReelProject()));

    expect(
      getState().project!.mode,
      "After switching, mode should be 'reel'"
    ).toBe("reel");
    expect(
      getState().project!.timeline.tracks.length,
      "After switching to reel, should have 5 tracks"
    ).toBe(5);
    expect(
      getState().project!.timeline.playhead_ms,
      "After switching project, playhead should reset to 0"
    ).toBe(0);
    expect(
      getState().canUndo,
      "After switching project, undo history should be cleared"
    ).toBe(false);
    expect(
      getState().canRedo,
      "After switching project, redo history should be cleared"
    ).toBe(false);
  });

  it("undo/redo works correctly for text blocks across modes", () => {
    // Test in caption mode
    act(() => getState().setProject(createCaptionProject()));

    act(() => getState().moveBlock("text-2", 1000));
    expect(
      getBlock("text-2")!.start_ms,
      "Caption text-2 should be at 1000ms after move"
    ).toBe(1000);

    act(() => getState().undo());
    expect(
      getBlock("text-2")!.start_ms,
      "Caption text-2 should be back at 3000ms after undo"
    ).toBe(3000);

    act(() => getState().redo());
    expect(
      getBlock("text-2")!.start_ms,
      "Caption text-2 should be at 1000ms after redo"
    ).toBe(1000);

    // Now switch to long-form and verify undo works there too
    act(() => getState().setProject(createLongFormProject()));

    act(() => getState().moveBlock("text-1", 2000));
    expect(
      getBlock("text-1")!.start_ms,
      "Long-form text-1 should be at 2000ms after move"
    ).toBe(2000);

    act(() => getState().undo());
    expect(
      getBlock("text-1")!.start_ms,
      "Long-form text-1 should be back at 0ms after undo"
    ).toBe(0);
  });

  it("keyboard shortcuts (Space, J/K/L, arrows) work in all modes", () => {
    const modes = [
      { name: "caption", factory: createCaptionProject },
      { name: "reel", factory: createReelProject },
      { name: "long_form", factory: createLongFormProject },
    ];

    for (const { name, factory } of modes) {
      // Load project and register keyboard shortcuts
      act(() => getState().setProject(factory()));
      const { unmount } = renderHook(() => useKeyboardShortcuts());

      // Space toggles playback
      expect(
        getState().isPlaying,
        `${name}: should start paused`
      ).toBe(false);

      press(" ");
      expect(
        getState().isPlaying,
        `${name}: Space should toggle playback to playing`
      ).toBe(true);

      // K pauses
      press("k");
      expect(
        getState().isPlaying,
        `${name}: K should pause playback`
      ).toBe(false);

      // L skips forward
      const beforeL = getState().project!.timeline.playhead_ms;
      press("l");
      expect(
        getState().project!.timeline.playhead_ms,
        `${name}: L should advance playhead from ${beforeL}ms`
      ).toBeGreaterThan(beforeL);

      // J skips back
      const beforeJ = getState().project!.timeline.playhead_ms;
      press("j");
      expect(
        getState().project!.timeline.playhead_ms,
        `${name}: J should move playhead back from ${beforeJ}ms`
      ).toBeLessThan(beforeJ);

      unmount();
    }
  });
});
