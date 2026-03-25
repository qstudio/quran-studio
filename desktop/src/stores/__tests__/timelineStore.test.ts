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
    expect(project).not.toBeNull();
    expect(project!.id).toBe("test-project-1");
  });

  it("clones the project (no reference sharing)", () => {
    const original = createTestProject();
    act(() => {
      useTimelineStore.getState().setProject(original);
    });
    const { project } = useTimelineStore.getState();
    expect(project).not.toBe(original);
  });

  it("resets canUndo and canRedo", () => {
    // First make some changes to build history
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", 500);
    });
    expect(useTimelineStore.getState().canUndo).toBe(true);

    // setProject should reset
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });
    expect(useTimelineStore.getState().canUndo).toBe(false);
    expect(useTimelineStore.getState().canRedo).toBe(false);
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
    expect(project!.timeline.playhead_ms).toBe(0);
    expect(project!.timeline.zoom).toBe(50);
    expect(project!.timeline.scroll_x).toBe(0);
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
    expect(useTimelineStore.getState().project!.timeline.playhead_ms).toBe(
      5000
    );
  });

  it("clamps playhead to 0 when negative", () => {
    act(() => {
      useTimelineStore.getState().setPlayhead(-100);
    });
    expect(useTimelineStore.getState().project!.timeline.playhead_ms).toBe(0);
  });

  it("clamps playhead to duration_ms when exceeding", () => {
    act(() => {
      useTimelineStore.getState().setPlayhead(99999);
    });
    expect(useTimelineStore.getState().project!.timeline.playhead_ms).toBe(
      10000
    );
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
    expect(useTimelineStore.getState().project!.timeline.zoom).toBe(100);
  });

  it("clamps zoom to minimum of 1", () => {
    act(() => {
      useTimelineStore.getState().setZoom(-10);
    });
    expect(useTimelineStore.getState().project!.timeline.zoom).toBe(1);
  });

  it("clamps zoom to maximum of 500", () => {
    act(() => {
      useTimelineStore.getState().setZoom(999);
    });
    expect(useTimelineStore.getState().project!.timeline.zoom).toBe(500);
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
    expect(useTimelineStore.getState().project!.timeline.scroll_x).toBe(200);
  });

  it("clamps scroll_x to minimum of 0", () => {
    act(() => {
      useTimelineStore.getState().setScrollX(-50);
    });
    expect(useTimelineStore.getState().project!.timeline.scroll_x).toBe(0);
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
    expect(useTimelineStore.getState().selectedBlockIds).toEqual(["hl-1"]);
    expect(useTimelineStore.getState().selectedTrackId).toBe(
      "track-highlight"
    );

    act(() => {
      useTimelineStore.getState().selectBlock("hl-2");
    });
    expect(useTimelineStore.getState().selectedBlockIds).toEqual(["hl-2"]);
  });

  it("multi select adds to selection", () => {
    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    act(() => {
      useTimelineStore.getState().selectBlock("hl-2", true);
    });
    expect(useTimelineStore.getState().selectedBlockIds).toEqual([
      "hl-1",
      "hl-2",
    ]);
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
    expect(useTimelineStore.getState().selectedBlockIds).toEqual(["hl-2"]);
  });

  it("returns early for invalid blockId", () => {
    act(() => {
      useTimelineStore.getState().selectBlock("nonexistent");
    });
    expect(useTimelineStore.getState().selectedBlockIds).toEqual([]);
    expect(useTimelineStore.getState().selectedTrackId).toBeNull();
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
    expect(useTimelineStore.getState().selectedBlockIds.length).toBe(1);

    act(() => {
      useTimelineStore.getState().clearSelection();
    });
    expect(useTimelineStore.getState().selectedBlockIds).toEqual([]);
    expect(useTimelineStore.getState().selectedTrackId).toBeNull();
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
    expect(block.start_ms).toBe(500);
    expect(block.end_ms).toBe(1500); // original duration was 1000
  });

  it("clamps start to 0 when negative", () => {
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", -200);
    });
    const block = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1")!;
    expect(block.start_ms).toBe(0);
    expect(block.end_ms).toBe(1000);
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
    expect(block.start_ms).toBe(0); // unchanged
  });

  it("pushes history (enables undo)", () => {
    expect(useTimelineStore.getState().canUndo).toBe(false);
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", 500);
    });
    expect(useTimelineStore.getState().canUndo).toBe(true);
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
    expect(block.start_ms).toBe(100);
    expect(block.end_ms).toBe(2000);
  });

  it("enforces minimum duration of 10ms", () => {
    act(() => {
      useTimelineStore.getState().resizeBlock("hl-1", 1000, 1005);
    });
    const block = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1")!;
    expect(block.start_ms).toBe(1000);
    expect(block.end_ms).toBe(1010); // minimum 10ms from start
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
    expect(block.start_ms).toBe(0); // unchanged
    expect(block.end_ms).toBe(1000);
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
    expect(highlightTrack.blocks.find((b) => b.id === "hl-1")).toBeUndefined();
    expect(highlightTrack.blocks.length).toBe(2);
  });

  it("clears selection after deletion", () => {
    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    act(() => {
      useTimelineStore.getState().deleteSelectedBlocks();
    });
    expect(useTimelineStore.getState().selectedBlockIds).toEqual([]);
    expect(useTimelineStore.getState().selectedTrackId).toBeNull();
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
    expect(highlightTrack.blocks.length).toBe(3); // unchanged
  });

  it("is a no-op when nothing is selected", () => {
    act(() => {
      useTimelineStore.getState().deleteSelectedBlocks();
    });
    // canUndo should still be false (no history pushed)
    expect(useTimelineStore.getState().canUndo).toBe(false);
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

    expect(getTrack().locked).toBe(false);
    act(() => {
      useTimelineStore.getState().toggleTrackLock("track-audio");
    });
    expect(getTrack().locked).toBe(true);
    act(() => {
      useTimelineStore.getState().toggleTrackLock("track-audio");
    });
    expect(getTrack().locked).toBe(false);
  });
});

describe("toggleTrackVisibility", () => {
  it("toggles visibility on a track", () => {
    const getTrack = () =>
      useTimelineStore
        .getState()
        .project!.timeline.tracks.find((t) => t.id === "track-mushaf")!;

    expect(getTrack().visible).toBe(true);
    act(() => {
      useTimelineStore.getState().toggleTrackVisibility("track-mushaf");
    });
    expect(getTrack().visible).toBe(false);
    act(() => {
      useTimelineStore.getState().toggleTrackVisibility("track-mushaf");
    });
    expect(getTrack().visible).toBe(true);
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
    expect(useTimelineStore.getState().isPlaying).toBe(true);
  });

  it("pause sets isPlaying to false", () => {
    act(() => {
      useTimelineStore.getState().play();
    });
    act(() => {
      useTimelineStore.getState().pause();
    });
    expect(useTimelineStore.getState().isPlaying).toBe(false);
  });

  it("togglePlayback flips isPlaying", () => {
    expect(useTimelineStore.getState().isPlaying).toBe(false);
    act(() => {
      useTimelineStore.getState().togglePlayback();
    });
    expect(useTimelineStore.getState().isPlaying).toBe(true);
    act(() => {
      useTimelineStore.getState().togglePlayback();
    });
    expect(useTimelineStore.getState().isPlaying).toBe(false);
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
    expect(movedBlock.start_ms).toBe(5000);

    act(() => {
      useTimelineStore.getState().undo();
    });
    const revertedBlock = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1")!;
    expect(revertedBlock.start_ms).toBe(0);
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
    expect(block.start_ms).toBe(5000);
  });

  it("full cycle: move -> undo -> redo -> undo", () => {
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", 3000);
    });
    expect(useTimelineStore.getState().canUndo).toBe(true);
    expect(useTimelineStore.getState().canRedo).toBe(false);

    act(() => {
      useTimelineStore.getState().undo();
    });
    expect(useTimelineStore.getState().canUndo).toBe(false);
    expect(useTimelineStore.getState().canRedo).toBe(true);

    act(() => {
      useTimelineStore.getState().redo();
    });
    expect(useTimelineStore.getState().canUndo).toBe(true);
    expect(useTimelineStore.getState().canRedo).toBe(false);

    act(() => {
      useTimelineStore.getState().undo();
    });
    expect(useTimelineStore.getState().canUndo).toBe(false);
    expect(useTimelineStore.getState().canRedo).toBe(true);
  });

  it("redo is cleared when a new action is performed after undo", () => {
    act(() => {
      useTimelineStore.getState().moveBlock("hl-1", 1000);
    });
    act(() => {
      useTimelineStore.getState().undo();
    });
    expect(useTimelineStore.getState().canRedo).toBe(true);

    // New action should clear redo
    act(() => {
      useTimelineStore.getState().moveBlock("hl-2", 5000);
    });
    expect(useTimelineStore.getState().canRedo).toBe(false);
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
      expect(useTimelineStore.getState().canUndo).toBe(true);
      act(() => {
        useTimelineStore.getState().undo();
      });
    }

    // 51st undo should not be possible
    expect(useTimelineStore.getState().canUndo).toBe(false);
  });
});
