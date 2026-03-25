import { act } from "@testing-library/react";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTestProject } from "@/__tests__/fixtures";

// Reset store before each test (also resets module-level undo/redo stacks)
beforeEach(() => {
  act(() => {
    useTimelineStore.getState().setProject(createTestProject());
    useTimelineStore.getState().clearSelection();
    useTimelineStore.getState().pause();
  });
});

// ---------------------------------------------------------------------------
// setProject
// ---------------------------------------------------------------------------
describe("setProject", () => {
  it("sets the project in state", () => {
    const { project } = useTimelineStore.getState();
    expect(project, "Project should not be null after setProject").not.toBeNull();
    expect(project!.id, "Project ID should match the test project ID").toBe("test-project-1");
  });

  it("clones the project (no reference sharing)", () => {
    const original = createTestProject();
    act(() => {
      useTimelineStore.getState().setProject(original);
    });
    const { project } = useTimelineStore.getState();
    expect(project, "Stored project should be a different object reference than the original (deep clone)").not.toBe(original);
  });

  it("resets canUndo and canRedo", () => {
    // First make some changes to build history
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", 500);
    });
    expect(useTimelineStore.getState().canUndo, "canUndo should be true after a moveBlock action").toBe(true);

    // setProject should reset
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });
    expect(useTimelineStore.getState().canUndo, "canUndo should be false after setProject resets history").toBe(false);
    expect(useTimelineStore.getState().canRedo, "canRedo should be false after setProject resets history").toBe(false);
  });

  it("defaults playhead_ms, zoom, scroll_x when not set", () => {
    const proj = createTestProject();
    // Simulate backend not providing UI-only fields
    delete (proj.timeline as Record<string, unknown>).playhead_ms;
    delete (proj.timeline as Record<string, unknown>).zoom;
    delete (proj.timeline as Record<string, unknown>).scroll_x;

    act(() => {
      useTimelineStore.getState().setProject(proj);
    });
    const { project } = useTimelineStore.getState();
    expect(project!.timeline.playhead_ms, "playhead_ms should default to 0 when missing from project data").toBe(0);
    expect(project!.timeline.zoom, "zoom should default to 50 when missing from project data").toBe(50);
    expect(project!.timeline.scroll_x, "scroll_x should default to 0 when missing from project data").toBe(0);
  });
});

// ---------------------------------------------------------------------------
// setPlayhead
// ---------------------------------------------------------------------------
describe("setPlayhead", () => {
  it("sets playhead to a valid value", () => {
    act(() => {
      useTimelineStore.getState().setPlayhead(5000);
    });
    expect(useTimelineStore.getState().project!.timeline.playhead_ms,
      "Playhead should be set to 5000ms").toBe(5000);
  });

  it("clamps playhead to 0 when negative", () => {
    act(() => {
      useTimelineStore.getState().setPlayhead(-100);
    });
    expect(useTimelineStore.getState().project!.timeline.playhead_ms,
      "Playhead should clamp to 0 when set to negative value -100").toBe(0);
  });

  it("clamps playhead to duration_ms when exceeding", () => {
    act(() => {
      useTimelineStore.getState().setPlayhead(99999);
    });
    expect(useTimelineStore.getState().project!.timeline.playhead_ms,
      "Playhead should clamp to duration (10000ms) when set to 99999").toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// setZoom
// ---------------------------------------------------------------------------
describe("setZoom", () => {
  it("sets zoom to a valid value", () => {
    act(() => {
      useTimelineStore.getState().setZoom(100);
    });
    expect(useTimelineStore.getState().project!.timeline.zoom,
      "Zoom should be set to 100").toBe(100);
  });

  it("clamps zoom to minimum of 1", () => {
    act(() => {
      useTimelineStore.getState().setZoom(-10);
    });
    expect(useTimelineStore.getState().project!.timeline.zoom,
      "Zoom should clamp to minimum value 1 when set to -10").toBe(1);
  });

  it("clamps zoom to maximum of 500", () => {
    act(() => {
      useTimelineStore.getState().setZoom(999);
    });
    expect(useTimelineStore.getState().project!.timeline.zoom,
      "Zoom should clamp to maximum value 500 when set to 999").toBe(500);
  });
});

// ---------------------------------------------------------------------------
// setScrollX
// ---------------------------------------------------------------------------
describe("setScrollX", () => {
  it("sets scroll_x to a valid value", () => {
    act(() => {
      useTimelineStore.getState().setScrollX(200);
    });
    expect(useTimelineStore.getState().project!.timeline.scroll_x,
      "scroll_x should be set to 200").toBe(200);
  });

  it("clamps scroll_x to minimum of 0", () => {
    act(() => {
      useTimelineStore.getState().setScrollX(-50);
    });
    expect(useTimelineStore.getState().project!.timeline.scroll_x,
      "scroll_x should clamp to 0 when set to -50").toBe(0);
  });
});

// ---------------------------------------------------------------------------
// selectBlock
// ---------------------------------------------------------------------------
describe("selectBlock", () => {
  it("single select replaces selection", () => {
    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    expect(useTimelineStore.getState().selectedBlockIds,
      "Selecting hl-1 should set selectedBlockIds to ['hl-1']").toEqual(["hl-1"]);
    expect(useTimelineStore.getState().selectedTrackId,
      "Selecting hl-1 should set selectedTrackId to its parent track").toBe("track-highlight");

    act(() => {
      useTimelineStore.getState().selectBlock("hl-2");
    });
    expect(useTimelineStore.getState().selectedBlockIds,
      "Single-selecting hl-2 should replace previous selection with ['hl-2']").toEqual(["hl-2"]);
  });

  it("multi select adds to selection", () => {
    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    act(() => {
      useTimelineStore.getState().selectBlock("hl-2", true);
    });
    expect(useTimelineStore.getState().selectedBlockIds,
      "Multi-selecting hl-2 after hl-1 should result in both being selected").toEqual(["hl-1", "hl-2"]);
  });

  it("multi select toggles off already-selected block", () => {
    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    act(() => {
      useTimelineStore.getState().selectBlock("hl-2", true);
    });
    act(() => {
      useTimelineStore.getState().selectBlock("hl-1", true);
    });
    expect(useTimelineStore.getState().selectedBlockIds,
      "Multi-selecting already-selected hl-1 should toggle it off, leaving only hl-2").toEqual(["hl-2"]);
  });

  it("returns early for invalid blockId", () => {
    act(() => {
      useTimelineStore.getState().selectBlock("nonexistent");
    });
    expect(useTimelineStore.getState().selectedBlockIds,
      "Selecting a nonexistent block should leave selection empty").toEqual([]);
    expect(useTimelineStore.getState().selectedTrackId,
      "Selecting a nonexistent block should leave selectedTrackId as null").toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clearSelection
// ---------------------------------------------------------------------------
describe("clearSelection", () => {
  it("empties selectedBlockIds and selectedTrackId", () => {
    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    expect(useTimelineStore.getState().selectedBlockIds.length,
      "Should have 1 selected block before clearing").toBe(1);

    act(() => {
      useTimelineStore.getState().clearSelection();
    });
    expect(useTimelineStore.getState().selectedBlockIds,
      "selectedBlockIds should be empty after clearSelection").toEqual([]);
    expect(useTimelineStore.getState().selectedTrackId,
      "selectedTrackId should be null after clearSelection").toBeNull();
  });
});

// ---------------------------------------------------------------------------
// moveBlock
// ---------------------------------------------------------------------------
describe("moveBlock", () => {
  it("moves a block to a new start position preserving duration", () => {
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", 500);
    });
    const block = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1")!;
    expect(block.start_ms, "Block hl-1 start should move to 500ms").toBe(500);
    expect(block.end_ms, "Block hl-1 end should be 1500ms (original 1000ms duration preserved)").toBe(1500); // original duration was 1000
  });

  it("clamps start to 0 when negative", () => {
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", -200);
    });
    const block = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1")!;
    expect(block.start_ms, "Block start should clamp to 0 when moved to -200ms").toBe(0);
    expect(block.end_ms, "Block end should be 1000ms when start is clamped to 0").toBe(1000);
  });

  it("does not move blocks on a locked track", () => {
    act(() => {
      useTimelineStore.getState().toggleTrackLock("track-highlight");
    });
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", 5000);
    });
    const block = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1")!;
    expect(block.start_ms, "Block on locked track should not move (should remain at 0)").toBe(0); // unchanged
  });

  it("pushes history (enables undo)", () => {
    expect(useTimelineStore.getState().canUndo, "canUndo should be false before any edits").toBe(false);
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", 500);
    });
    expect(useTimelineStore.getState().canUndo, "canUndo should be true after moveBlock").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resizeBlock
// ---------------------------------------------------------------------------
describe("resizeBlock", () => {
  it("resizes a block to new start and end", () => {
    act(() => {
      useTimelineStore.getState().resizeBlock("hl-1", 100, 2000);
    });
    const block = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1")!;
    expect(block.start_ms, "Block hl-1 start should resize to 100ms").toBe(100);
    expect(block.end_ms, "Block hl-1 end should resize to 2000ms").toBe(2000);
  });

  it("enforces minimum duration of 10ms", () => {
    act(() => {
      useTimelineStore.getState().resizeBlock("hl-1", 1000, 1005);
    });
    const block = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1")!;
    expect(block.start_ms, "Block start should be 1000ms when minimum duration is enforced").toBe(1000);
    expect(block.end_ms, "Block end should be 1010ms (start + minimum 10ms duration) instead of 1005ms").toBe(1010); // minimum 10ms from start
  });

  it("does not resize blocks on a locked track", () => {
    act(() => {
      useTimelineStore.getState().toggleTrackLock("track-highlight");
    });
    act(() => {
      useTimelineStore.getState().resizeBlock("hl-1", 500, 5000);
    });
    const block = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1")!;
    expect(block.start_ms, "Block on locked track should not resize (start should remain at 0)").toBe(0); // unchanged
    expect(block.end_ms, "Block on locked track should not resize (end should remain at 1000)").toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// deleteSelectedBlocks
// ---------------------------------------------------------------------------
describe("deleteSelectedBlocks", () => {
  it("deletes selected blocks from unlocked tracks", () => {
    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    act(() => {
      useTimelineStore.getState().deleteSelectedBlocks();
    });
    const highlightTrack = useTimelineStore
      .getState()
      .project!.timeline.tracks.find((t) => t.id === "track-highlight")!;
    expect(highlightTrack.blocks.find((b) => b.id === "hl-1"),
      "Block hl-1 should be deleted from the highlight track").toBeUndefined();
    expect(highlightTrack.blocks.length,
      "Highlight track should have 2 blocks remaining after deleting hl-1").toBe(2);
  });

  it("clears selection after deletion", () => {
    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    act(() => {
      useTimelineStore.getState().deleteSelectedBlocks();
    });
    expect(useTimelineStore.getState().selectedBlockIds,
      "Selection should be cleared after deleting blocks").toEqual([]);
    expect(useTimelineStore.getState().selectedTrackId,
      "selectedTrackId should be null after deleting blocks").toBeNull();
  });

  it("skips blocks on locked tracks", () => {
    act(() => {
      useTimelineStore.getState().toggleTrackLock("track-highlight");
    });
    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    act(() => {
      useTimelineStore.getState().deleteSelectedBlocks();
    });
    const highlightTrack = useTimelineStore
      .getState()
      .project!.timeline.tracks.find((t) => t.id === "track-highlight")!;
    expect(highlightTrack.blocks.length,
      "All 3 blocks should remain on locked track after delete attempt").toBe(3); // unchanged
  });

  it("is a no-op when nothing is selected", () => {
    act(() => {
      useTimelineStore.getState().deleteSelectedBlocks();
    });
    // canUndo should still be false (no history pushed)
    expect(useTimelineStore.getState().canUndo,
      "canUndo should remain false when deleteSelectedBlocks is called with no selection").toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toggleTrackLock / toggleTrackVisibility
// ---------------------------------------------------------------------------
describe("toggleTrackLock", () => {
  it("toggles lock on a track", () => {
    const getTrack = () =>
      useTimelineStore
        .getState()
        .project!.timeline.tracks.find((t) => t.id === "track-audio")!;

    expect(getTrack().locked, "Audio track should start unlocked").toBe(false);
    act(() => {
      useTimelineStore.getState().toggleTrackLock("track-audio");
    });
    expect(getTrack().locked, "Audio track should be locked after first toggle").toBe(true);
    act(() => {
      useTimelineStore.getState().toggleTrackLock("track-audio");
    });
    expect(getTrack().locked, "Audio track should be unlocked after second toggle").toBe(false);
  });
});

describe("toggleTrackVisibility", () => {
  it("toggles visibility on a track", () => {
    const getTrack = () =>
      useTimelineStore
        .getState()
        .project!.timeline.tracks.find((t) => t.id === "track-mushaf")!;

    expect(getTrack().visible, "Mushaf track should start visible").toBe(true);
    act(() => {
      useTimelineStore.getState().toggleTrackVisibility("track-mushaf");
    });
    expect(getTrack().visible, "Mushaf track should be hidden after first toggle").toBe(false);
    act(() => {
      useTimelineStore.getState().toggleTrackVisibility("track-mushaf");
    });
    expect(getTrack().visible, "Mushaf track should be visible again after second toggle").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// play / pause / togglePlayback
// ---------------------------------------------------------------------------
describe("playback controls", () => {
  it("play sets isPlaying to true", () => {
    act(() => {
      useTimelineStore.getState().play();
    });
    expect(useTimelineStore.getState().isPlaying, "isPlaying should be true after calling play()").toBe(true);
  });

  it("pause sets isPlaying to false", () => {
    act(() => {
      useTimelineStore.getState().play();
    });
    act(() => {
      useTimelineStore.getState().pause();
    });
    expect(useTimelineStore.getState().isPlaying, "isPlaying should be false after calling pause()").toBe(false);
  });

  it("togglePlayback flips isPlaying", () => {
    expect(useTimelineStore.getState().isPlaying, "isPlaying should start as false").toBe(false);
    act(() => {
      useTimelineStore.getState().togglePlayback();
    });
    expect(useTimelineStore.getState().isPlaying, "isPlaying should be true after first togglePlayback").toBe(true);
    act(() => {
      useTimelineStore.getState().togglePlayback();
    });
    expect(useTimelineStore.getState().isPlaying, "isPlaying should be false after second togglePlayback").toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Undo / Redo
// ---------------------------------------------------------------------------
describe("undo/redo", () => {
  it("undo reverts a moveBlock", () => {
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", 5000);
    });
    const movedBlock = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1")!;
    expect(movedBlock.start_ms, "Block hl-1 should be at 5000ms after move").toBe(5000);

    act(() => {
      useTimelineStore.getState().undo();
    });
    const revertedBlock = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1")!;
    expect(revertedBlock.start_ms, "After undo, block hl-1 should return to original position 0ms").toBe(0);
  });

  it("redo re-applies after undo", () => {
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", 5000);
    });
    act(() => {
      useTimelineStore.getState().undo();
    });
    act(() => {
      useTimelineStore.getState().redo();
    });
    const block = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1")!;
    expect(block.start_ms, "After redo, block hl-1 should be back at 5000ms").toBe(5000);
  });

  it("full cycle: move -> undo -> redo -> undo", () => {
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", 3000);
    });
    expect(useTimelineStore.getState().canUndo, "canUndo should be true after move").toBe(true);
    expect(useTimelineStore.getState().canRedo, "canRedo should be false right after a new action").toBe(false);

    act(() => {
      useTimelineStore.getState().undo();
    });
    expect(useTimelineStore.getState().canUndo, "canUndo should be false after undoing the only action").toBe(false);
    expect(useTimelineStore.getState().canRedo, "canRedo should be true after undo").toBe(true);

    act(() => {
      useTimelineStore.getState().redo();
    });
    expect(useTimelineStore.getState().canUndo, "canUndo should be true after redo").toBe(true);
    expect(useTimelineStore.getState().canRedo, "canRedo should be false after redo (nothing more to redo)").toBe(false);

    act(() => {
      useTimelineStore.getState().undo();
    });
    expect(useTimelineStore.getState().canUndo, "canUndo should be false after final undo").toBe(false);
    expect(useTimelineStore.getState().canRedo, "canRedo should be true after final undo").toBe(true);
  });

  it("redo is cleared when a new action is performed after undo", () => {
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", 1000);
    });
    act(() => {
      useTimelineStore.getState().undo();
    });
    expect(useTimelineStore.getState().canRedo, "canRedo should be true after undoing a move").toBe(true);

    // New action should clear redo
    act(() => {
      useTimelineStore.getState().moveBlock("hl-2", 5000);
    });
    expect(useTimelineStore.getState().canRedo, "canRedo should be false after a new action clears the redo stack").toBe(false);
  });

  it("history is limited to 50 entries", () => {
    // Push 51 moves
    for (let i = 1; i <= 51; i++) {
      act(() => {
        useTimelineStore.getState().moveBlock("hl-1", i * 10);
      });
    }

    // Should be able to undo 50 times
    for (let i = 0; i < 50; i++) {
      expect(useTimelineStore.getState().canUndo, `canUndo should be true at undo step ${i + 1} of 50`).toBe(true);
      act(() => {
        useTimelineStore.getState().undo();
      });
    }

    // 51st undo should not be possible
    expect(useTimelineStore.getState().canUndo, "canUndo should be false after exhausting all 50 undo slots").toBe(false);
  });
});
