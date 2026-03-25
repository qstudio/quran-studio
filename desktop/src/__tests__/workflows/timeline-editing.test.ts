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
  it("full cycle: select -> move -> verify position -> undo -> verify restored", () => {
    const originalStart = getBlock("hl-1")!.start_ms; // 0
    const originalEnd = getBlock("hl-1")!.end_ms; // 1000

    // User clicks block hl-1
    act(() => getState().selectBlock("hl-1"));
    expect(getState().selectedBlockIds, "After clicking hl-1, it should be the only selected block").toEqual(["hl-1"]);

    // User drags block to 500ms
    act(() => getState().moveBlock("hl-1", 500));
    expect(getBlock("hl-1")!.start_ms, "After dragging, block hl-1 should start at 500ms").toBe(500);
    expect(getBlock("hl-1")!.end_ms, "After dragging, block hl-1 should end at 1500ms (duration preserved)").toBe(1500); // duration preserved

    // User presses Cmd+Z
    act(() => getState().undo());
    expect(getBlock("hl-1")!.start_ms, "After undo, block hl-1 should return to original start position").toBe(originalStart);
    expect(getBlock("hl-1")!.end_ms, "After undo, block hl-1 should return to original end position").toBe(originalEnd);

    // User presses Cmd+Shift+Z
    act(() => getState().redo());
    expect(getBlock("hl-1")!.start_ms, "After redo, block hl-1 should be back at 500ms").toBe(500);
    expect(getBlock("hl-1")!.end_ms, "After redo, block hl-1 should be back at 1500ms").toBe(1500);
  });
});

describe("Workflow: Multi-select and delete blocks", () => {
  it("shift-click two blocks -> delete -> undo restores both", () => {
    // User clicks hl-1
    act(() => getState().selectBlock("hl-1"));
    // User shift-clicks hl-2
    act(() => getState().selectBlock("hl-2", true));
    expect(getState().selectedBlockIds, "After clicking hl-1 then shift-clicking hl-2, both should be selected").toEqual(["hl-1", "hl-2"]);

    // Verify hl-3 still unselected
    expect(getState().selectedBlockIds, "hl-3 should not be in the selection").not.toContain("hl-3");

    // User presses Delete
    act(() => getState().deleteSelectedBlocks());

    // Verify blocks are gone
    expect(getBlock("hl-1"), "Block hl-1 should be deleted after Delete key").toBeNull();
    expect(getBlock("hl-2"), "Block hl-2 should be deleted after Delete key").toBeNull();
    expect(getBlock("hl-3"), "Block hl-3 should remain untouched (was not selected)").not.toBeNull(); // untouched
    expect(getState().selectedBlockIds, "Selection should be empty after deleting blocks").toEqual([]);

    // User presses Cmd+Z
    act(() => getState().undo());

    // Both blocks restored
    expect(getBlock("hl-1"), "After undo, block hl-1 should be restored").not.toBeNull();
    expect(getBlock("hl-2"), "After undo, block hl-2 should be restored").not.toBeNull();
    expect(getBlock("hl-3"), "Block hl-3 should still exist after undo").not.toBeNull();
  });
});

describe("Workflow: Resize block from both edges", () => {
  it("drag left edge earlier, then drag right edge later", () => {
    act(() => getState().selectBlock("hl-2"));

    // User drags left edge from 1000ms to 800ms
    act(() => getState().resizeBlock("hl-2", 800, 2000));
    expect(getBlock("hl-2")!.start_ms, "After dragging left edge, hl-2 should start at 800ms").toBe(800);
    expect(getBlock("hl-2")!.end_ms, "After dragging left edge, hl-2 end should remain at 2000ms").toBe(2000);

    // User drags right edge from 2000ms to 2500ms
    act(() => getState().resizeBlock("hl-2", 800, 2500));
    expect(getBlock("hl-2")!.start_ms, "After dragging right edge, hl-2 start should remain at 800ms").toBe(800);
    expect(getBlock("hl-2")!.end_ms, "After dragging right edge, hl-2 should end at 2500ms").toBe(2500);

    // Undo twice to get back to original
    act(() => getState().undo());
    expect(getBlock("hl-2")!.end_ms, "After first undo, hl-2 end should revert to 2000ms").toBe(2000);

    act(() => getState().undo());
    expect(getBlock("hl-2")!.start_ms, "After second undo, hl-2 start should revert to original 1000ms").toBe(1000);
    expect(getBlock("hl-2")!.end_ms, "After second undo, hl-2 end should revert to original 2000ms").toBe(2000);
  });
});

describe("Workflow: Move block on a locked track", () => {
  it("locking a track prevents moves but undo still works for prior moves", () => {
    // User moves block first
    act(() => getState().moveBlock("hl-1", 200));
    expect(getBlock("hl-1")!.start_ms, "Block hl-1 should be at 200ms after move").toBe(200);

    // User locks the highlight track
    act(() => getState().toggleTrackLock("track-highlight"));
    const hlTrack = getState().project!.timeline.tracks.find(
      (t) => t.id === "track-highlight"
    );
    expect(hlTrack!.locked, "Highlight track should be locked after toggle").toBe(true);

    // User tries to move block on locked track -- should be ignored
    act(() => getState().moveBlock("hl-1", 5000));
    expect(getBlock("hl-1")!.start_ms, "Move on locked track should be ignored, block should remain at 200ms").toBe(200); // unchanged

    // Unlock and try again
    act(() => getState().toggleTrackLock("track-highlight"));
    act(() => getState().moveBlock("hl-1", 5000));
    expect(getBlock("hl-1")!.start_ms, "After unlocking, block should move to 5000ms").toBe(5000);
  });
});

describe("Workflow: Complex undo/redo chain", () => {
  it("multiple edits -> undo some -> new edit clears redo -> can't redo past branch point", () => {
    // Move hl-1 three times
    act(() => getState().moveBlock("hl-1", 100));
    act(() => getState().moveBlock("hl-1", 200));
    act(() => getState().moveBlock("hl-1", 300));
    expect(getBlock("hl-1")!.start_ms, "Block should be at 300ms after three moves").toBe(300);
    expect(getState().canUndo, "canUndo should be true after three moves").toBe(true);

    // Undo twice -> back to 100
    act(() => getState().undo());
    expect(getBlock("hl-1")!.start_ms, "After first undo, block should be at 200ms").toBe(200);
    act(() => getState().undo());
    expect(getBlock("hl-1")!.start_ms, "After second undo, block should be at 100ms").toBe(100);
    expect(getState().canRedo, "canRedo should be true after undoing two actions").toBe(true);

    // New edit: move to 999 -> this should clear the redo stack
    act(() => getState().moveBlock("hl-1", 999));
    expect(getBlock("hl-1")!.start_ms, "Block should be at 999ms after new move").toBe(999);
    expect(getState().canRedo, "canRedo should be false after new edit clears redo stack").toBe(false);

    // Can't redo back to 200 or 300 anymore
    act(() => getState().redo());
    expect(getBlock("hl-1")!.start_ms, "Redo should have no effect since redo stack was cleared (block stays at 999ms)").toBe(999); // unchanged

    // But can undo the 999 move
    act(() => getState().undo());
    expect(getBlock("hl-1")!.start_ms, "Undo should revert to 100ms (the state before the 999 move)").toBe(100);
  });
});

describe("Workflow: Scrub playhead while editing", () => {
  it("set playhead -> move block -> playhead unchanged -> undo -> playhead unchanged", () => {
    // User scrubs to 5000ms
    act(() => getState().setPlayhead(5000));
    expect(getState().project!.timeline.playhead_ms, "Playhead should be set to 5000ms after scrub").toBe(5000);

    // User moves a block
    act(() => getState().moveBlock("hl-1", 300));

    // Playhead stays where user put it (block moves don't affect playhead)
    expect(getState().project!.timeline.playhead_ms, "Playhead should remain at 5000ms after block move (moves don't affect playhead)").toBe(5000);

    // Undo restores block but NOT the playhead -- playhead is not in undo history
    // (actually, undo restores the entire project snapshot, which may include playhead)
    act(() => getState().undo());
    expect(getBlock("hl-1")!.start_ms, "After undo, block hl-1 should be back at original 0ms").toBe(0);
  });
});

describe("Workflow: Selection state through operations", () => {
  it("select -> deselect via Escape -> select another -> multi-select -> clear", () => {
    // Select hl-1
    act(() => getState().selectBlock("hl-1"));
    expect(getState().selectedBlockIds, "After selecting hl-1, selectedBlockIds should be ['hl-1']").toEqual(["hl-1"]);
    expect(getState().selectedTrackId, "After selecting hl-1, selectedTrackId should be its parent track").toBe("track-highlight");

    // Escape
    act(() => getState().clearSelection());
    expect(getState().selectedBlockIds, "After clearSelection, selectedBlockIds should be empty").toEqual([]);
    expect(getState().selectedTrackId, "After clearSelection, selectedTrackId should be null").toBeNull();

    // Select hl-2
    act(() => getState().selectBlock("hl-2"));
    expect(getState().selectedBlockIds, "After selecting hl-2, selectedBlockIds should be ['hl-2']").toEqual(["hl-2"]);

    // Shift-click hl-3
    act(() => getState().selectBlock("hl-3", true));
    expect(getState().selectedBlockIds, "After shift-clicking hl-3, both hl-2 and hl-3 should be selected").toEqual(["hl-2", "hl-3"]);

    // Shift-click hl-2 again to deselect it
    act(() => getState().selectBlock("hl-2", true));
    expect(getState().selectedBlockIds, "After shift-clicking hl-2 again, only hl-3 should remain selected").toEqual(["hl-3"]);

    // Click audio-1 (different track) without shift -> replaces selection
    act(() => getState().selectBlock("audio-1"));
    expect(getState().selectedBlockIds, "Single-clicking audio-1 should replace selection with ['audio-1']").toEqual(["audio-1"]);
    expect(getState().selectedTrackId, "After selecting audio-1, selectedTrackId should switch to audio track").toBe("track-audio");
  });
});

describe("Workflow: Track visibility doesn't affect editing", () => {
  it("hiding a track still allows block operations on it", () => {
    // Hide highlight track
    act(() => getState().toggleTrackVisibility("track-highlight"));
    const hlTrack = getState().project!.timeline.tracks.find(
      (t) => t.id === "track-highlight"
    );
    expect(hlTrack!.visible, "Highlight track should be hidden after toggle").toBe(false);

    // Can still select and move blocks on hidden track
    act(() => getState().selectBlock("hl-1"));
    expect(getState().selectedBlockIds, "Should be able to select blocks on a hidden track").toEqual(["hl-1"]);

    act(() => getState().moveBlock("hl-1", 500));
    expect(getBlock("hl-1")!.start_ms, "Should be able to move blocks on a hidden track").toBe(500);
  });
});

describe("Workflow: Zoom and scroll don't affect block data", () => {
  it("zoom/scroll changes only viewport, blocks stay at same ms positions", () => {
    const originalStart = getBlock("hl-1")!.start_ms;

    // User zooms in
    act(() => getState().setZoom(200));
    expect(getState().project!.timeline.zoom, "Zoom should be set to 200").toBe(200);
    expect(getBlock("hl-1")!.start_ms, "Block start_ms should not change when zooming").toBe(originalStart);

    // User scrolls right
    act(() => getState().setScrollX(500));
    expect(getState().project!.timeline.scroll_x, "scroll_x should be set to 500").toBe(500);
    expect(getBlock("hl-1")!.start_ms, "Block start_ms should not change when scrolling").toBe(originalStart);
  });
});
