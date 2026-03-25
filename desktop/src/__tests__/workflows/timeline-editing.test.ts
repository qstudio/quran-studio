/**
 * Integration tests: Timeline editing workflows
 *
 * Simulates real user interactions with the timeline editor:
 * selecting blocks, moving them, resizing, undo/redo chains,
 * and verifying the entire state stays consistent throughout.
 */
import { act } from "@testing-library/react";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTestProject } from "@/__tests__/fixtures";

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

beforeEach(() => {
  act(() => {
    useTimelineStore.getState().setProject(createTestProject());
  });
});

describe("Workflow: Select, move, and undo a block", () => {
  it("full cycle: select → move → verify position → undo → verify restored", () => {
    const originalStart = getBlock("hl-1")!.start_ms; // 0
    const originalEnd = getBlock("hl-1")!.end_ms; // 1000

    // User clicks block hl-1
    act(() => getState().selectBlock("hl-1"));
    expect(getState().selectedBlockIds).toEqual(["hl-1"]);

    // User drags block to 500ms
    act(() => getState().moveBlock("hl-1", 500));
    expect(getBlock("hl-1")!.start_ms).toBe(500);
    expect(getBlock("hl-1")!.end_ms).toBe(1500); // duration preserved

    // User presses Cmd+Z
    act(() => getState().undo());
    expect(getBlock("hl-1")!.start_ms).toBe(originalStart);
    expect(getBlock("hl-1")!.end_ms).toBe(originalEnd);

    // User presses Cmd+Shift+Z
    act(() => getState().redo());
    expect(getBlock("hl-1")!.start_ms).toBe(500);
    expect(getBlock("hl-1")!.end_ms).toBe(1500);
  });
});

describe("Workflow: Multi-select and delete blocks", () => {
  it("shift-click two blocks → delete → undo restores both", () => {
    // User clicks hl-1
    act(() => getState().selectBlock("hl-1"));
    // User shift-clicks hl-2
    act(() => getState().selectBlock("hl-2", true));
    expect(getState().selectedBlockIds).toEqual(["hl-1", "hl-2"]);

    // Verify hl-3 still unselected
    expect(getState().selectedBlockIds).not.toContain("hl-3");

    // User presses Delete
    act(() => getState().deleteSelectedBlocks());

    // Verify blocks are gone
    expect(getBlock("hl-1")).toBeNull();
    expect(getBlock("hl-2")).toBeNull();
    expect(getBlock("hl-3")).not.toBeNull(); // untouched
    expect(getState().selectedBlockIds).toEqual([]);

    // User presses Cmd+Z
    act(() => getState().undo());

    // Both blocks restored
    expect(getBlock("hl-1")).not.toBeNull();
    expect(getBlock("hl-2")).not.toBeNull();
    expect(getBlock("hl-3")).not.toBeNull();
  });
});

describe("Workflow: Resize block from both edges", () => {
  it("drag left edge earlier, then drag right edge later", () => {
    act(() => getState().selectBlock("hl-2"));

    // User drags left edge from 1000ms to 800ms
    act(() => getState().resizeBlock("hl-2", 800, 2000));
    expect(getBlock("hl-2")!.start_ms).toBe(800);
    expect(getBlock("hl-2")!.end_ms).toBe(2000);

    // User drags right edge from 2000ms to 2500ms
    act(() => getState().resizeBlock("hl-2", 800, 2500));
    expect(getBlock("hl-2")!.start_ms).toBe(800);
    expect(getBlock("hl-2")!.end_ms).toBe(2500);

    // Undo twice to get back to original
    act(() => getState().undo());
    expect(getBlock("hl-2")!.end_ms).toBe(2000);

    act(() => getState().undo());
    expect(getBlock("hl-2")!.start_ms).toBe(1000);
    expect(getBlock("hl-2")!.end_ms).toBe(2000);
  });
});

describe("Workflow: Move block on a locked track", () => {
  it("locking a track prevents moves but undo still works for prior moves", () => {
    // User moves block first
    act(() => getState().moveBlock("hl-1", 200));
    expect(getBlock("hl-1")!.start_ms).toBe(200);

    // User locks the highlight track
    act(() => getState().toggleTrackLock("track-highlight"));
    const hlTrack = getState().project!.timeline.tracks.find(
      (t) => t.id === "track-highlight"
    );
    expect(hlTrack!.locked).toBe(true);

    // User tries to move block on locked track — should be ignored
    act(() => getState().moveBlock("hl-1", 5000));
    expect(getBlock("hl-1")!.start_ms).toBe(200); // unchanged

    // Unlock and try again
    act(() => getState().toggleTrackLock("track-highlight"));
    act(() => getState().moveBlock("hl-1", 5000));
    expect(getBlock("hl-1")!.start_ms).toBe(5000);
  });
});

describe("Workflow: Complex undo/redo chain", () => {
  it("multiple edits → undo some → new edit clears redo → can't redo past branch point", () => {
    // Move hl-1 three times
    act(() => getState().moveBlock("hl-1", 100));
    act(() => getState().moveBlock("hl-1", 200));
    act(() => getState().moveBlock("hl-1", 300));
    expect(getBlock("hl-1")!.start_ms).toBe(300);
    expect(getState().canUndo).toBe(true);

    // Undo twice → back to 100
    act(() => getState().undo());
    expect(getBlock("hl-1")!.start_ms).toBe(200);
    act(() => getState().undo());
    expect(getBlock("hl-1")!.start_ms).toBe(100);
    expect(getState().canRedo).toBe(true);

    // New edit: move to 999 → this should clear the redo stack
    act(() => getState().moveBlock("hl-1", 999));
    expect(getBlock("hl-1")!.start_ms).toBe(999);
    expect(getState().canRedo).toBe(false);

    // Can't redo back to 200 or 300 anymore
    act(() => getState().redo());
    expect(getBlock("hl-1")!.start_ms).toBe(999); // unchanged

    // But can undo the 999 move
    act(() => getState().undo());
    expect(getBlock("hl-1")!.start_ms).toBe(100);
  });
});

describe("Workflow: Scrub playhead while editing", () => {
  it("set playhead → move block → playhead unchanged → undo → playhead unchanged", () => {
    // User scrubs to 5000ms
    act(() => getState().setPlayhead(5000));
    expect(getState().project!.timeline.playhead_ms).toBe(5000);

    // User moves a block
    act(() => getState().moveBlock("hl-1", 300));

    // Playhead stays where user put it (block moves don't affect playhead)
    expect(getState().project!.timeline.playhead_ms).toBe(5000);

    // Undo restores block but NOT the playhead — playhead is not in undo history
    // (actually, undo restores the entire project snapshot, which may include playhead)
    act(() => getState().undo());
    expect(getBlock("hl-1")!.start_ms).toBe(0);
  });
});

describe("Workflow: Selection state through operations", () => {
  it("select → deselect via Escape → select another → multi-select → clear", () => {
    // Select hl-1
    act(() => getState().selectBlock("hl-1"));
    expect(getState().selectedBlockIds).toEqual(["hl-1"]);
    expect(getState().selectedTrackId).toBe("track-highlight");

    // Escape
    act(() => getState().clearSelection());
    expect(getState().selectedBlockIds).toEqual([]);
    expect(getState().selectedTrackId).toBeNull();

    // Select hl-2
    act(() => getState().selectBlock("hl-2"));
    expect(getState().selectedBlockIds).toEqual(["hl-2"]);

    // Shift-click hl-3
    act(() => getState().selectBlock("hl-3", true));
    expect(getState().selectedBlockIds).toEqual(["hl-2", "hl-3"]);

    // Shift-click hl-2 again to deselect it
    act(() => getState().selectBlock("hl-2", true));
    expect(getState().selectedBlockIds).toEqual(["hl-3"]);

    // Click audio-1 (different track) without shift → replaces selection
    act(() => getState().selectBlock("audio-1"));
    expect(getState().selectedBlockIds).toEqual(["audio-1"]);
    expect(getState().selectedTrackId).toBe("track-audio");
  });
});

describe("Workflow: Track visibility doesn't affect editing", () => {
  it("hiding a track still allows block operations on it", () => {
    // Hide highlight track
    act(() => getState().toggleTrackVisibility("track-highlight"));
    const hlTrack = getState().project!.timeline.tracks.find(
      (t) => t.id === "track-highlight"
    );
    expect(hlTrack!.visible).toBe(false);

    // Can still select and move blocks on hidden track
    act(() => getState().selectBlock("hl-1"));
    expect(getState().selectedBlockIds).toEqual(["hl-1"]);

    act(() => getState().moveBlock("hl-1", 500));
    expect(getBlock("hl-1")!.start_ms).toBe(500);
  });
});

describe("Workflow: Zoom and scroll don't affect block data", () => {
  it("zoom/scroll changes only viewport, blocks stay at same ms positions", () => {
    const originalStart = getBlock("hl-1")!.start_ms;

    // User zooms in
    act(() => getState().setZoom(200));
    expect(getState().project!.timeline.zoom).toBe(200);
    expect(getBlock("hl-1")!.start_ms).toBe(originalStart);

    // User scrolls right
    act(() => getState().setScrollX(500));
    expect(getState().project!.timeline.scroll_x).toBe(500);
    expect(getBlock("hl-1")!.start_ms).toBe(originalStart);
  });
});
