/**
 * Integration tests: Keyboard-driven navigation workflows
 *
 * Simulates a user navigating the timeline purely with keyboard shortcuts,
 * combining playback, seeking, zoom, selection, and editing.
 */
import { renderHook, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTestProject } from "@/__tests__/fixtures";

function getState() {
  return useTimelineStore.getState();
}

function press(key: string, opts: Partial<KeyboardEventInit> = {}) {
  fireEvent.keyDown(window, { key, ...opts });
}

beforeEach(() => {
  act(() => {
    useTimelineStore.getState().setProject(createTestProject());
  });
  renderHook(() => useKeyboardShortcuts());
});

describe("Workflow: Play, seek, and pause via keyboard", () => {
  it("Space to play -> L to skip forward -> K to pause -> J to skip back", () => {
    // Start paused at 0
    expect(getState().isPlaying, "Should start in paused state").toBe(false);
    expect(getState().project!.timeline.playhead_ms, "Playhead should start at 0ms").toBe(0);

    // Space -> play
    press(" ");
    expect(getState().isPlaying, "Space should start playback").toBe(true);

    // L -> skip forward 5000ms (from 0 -> 5000)
    press("l");
    expect(getState().project!.timeline.playhead_ms, "L key should skip playhead forward to 5000ms").toBe(5000);

    // K -> pause
    press("k");
    expect(getState().isPlaying, "K key should pause playback").toBe(false);

    // J -> skip back 5000ms (from 5000 -> 0)
    press("j");
    expect(getState().project!.timeline.playhead_ms, "J key should skip playhead back to 0ms").toBe(0);
  });
});

describe("Workflow: Fine-grained seeking with arrow keys", () => {
  it("Arrow keys for precise positioning, Shift+arrows for larger jumps", () => {
    // Set playhead to middle
    act(() => getState().setPlayhead(5000));

    // ArrowRight -> +100ms
    press("ArrowRight");
    expect(getState().project!.timeline.playhead_ms, "ArrowRight should advance playhead by 100ms to 5100ms").toBe(5100);

    // ArrowRight again
    press("ArrowRight");
    expect(getState().project!.timeline.playhead_ms, "Second ArrowRight should advance to 5200ms").toBe(5200);

    // Shift+ArrowRight -> +1000ms
    press("ArrowRight", { shiftKey: true });
    expect(getState().project!.timeline.playhead_ms, "Shift+ArrowRight should advance by 1000ms to 6200ms").toBe(6200);

    // ArrowLeft -> -100ms
    press("ArrowLeft");
    expect(getState().project!.timeline.playhead_ms, "ArrowLeft should go back 100ms to 6100ms").toBe(6100);

    // Shift+ArrowLeft -> -1000ms
    press("ArrowLeft", { shiftKey: true });
    expect(getState().project!.timeline.playhead_ms, "Shift+ArrowLeft should go back 1000ms to 5100ms").toBe(5100);
  });

  it("seeking clamps at boundaries", () => {
    // At 0, press ArrowLeft -> stays at 0
    act(() => getState().setPlayhead(0));
    press("ArrowLeft");
    expect(getState().project!.timeline.playhead_ms, "ArrowLeft at 0ms should clamp to 0 (can't go negative)").toBe(0);

    // Near end, skip forward -> clamps to duration
    act(() => getState().setPlayhead(9900));
    press("ArrowRight");
    expect(getState().project!.timeline.playhead_ms, "ArrowRight at 9900ms should clamp to duration 10000ms").toBe(10000);

    // At end, press L -> stays at duration
    press("l");
    expect(getState().project!.timeline.playhead_ms, "L key at 10000ms should stay at duration (can't exceed)").toBe(10000);
  });
});

describe("Workflow: Select all, delete, undo", () => {
  it("Cmd+A -> Delete -> Cmd+Z restores all blocks", () => {
    // Count total blocks before
    const totalBlocks = getState()
      .project!.timeline.tracks.reduce((sum, t) => sum + t.blocks.length, 0);

    // Cmd+A to select all
    press("a", { metaKey: true });
    expect(getState().selectedBlockIds.length, "Cmd+A should select all blocks in the project").toBe(totalBlocks);

    // Delete all
    press("Delete");
    const blocksAfterDelete = getState()
      .project!.timeline.tracks.reduce((sum, t) => sum + t.blocks.length, 0);
    expect(blocksAfterDelete, "All blocks should be deleted after Delete key").toBe(0);
    expect(getState().selectedBlockIds, "Selection should be cleared after deleting all blocks").toEqual([]);

    // Cmd+Z to undo
    press("z", { metaKey: true });
    const blocksAfterUndo = getState()
      .project!.timeline.tracks.reduce((sum, t) => sum + t.blocks.length, 0);
    expect(blocksAfterUndo, "Cmd+Z should restore all deleted blocks").toBe(totalBlocks);
  });
});

describe("Workflow: Zoom in and out via keyboard", () => {
  it("+ to zoom in, - to zoom out, maintains relative values", () => {
    const initialZoom = getState().project!.timeline.zoom; // 50

    // + -> zoom in (x1.25)
    press("=");
    expect(getState().project!.timeline.zoom, "= key should zoom in to 62.5 (50 * 1.25)").toBeCloseTo(62.5);

    // + again
    press("=");
    expect(getState().project!.timeline.zoom, "Second = key should zoom to 78.125 (62.5 * 1.25)").toBeCloseTo(78.125);

    // - -> zoom out (x0.8)
    press("-");
    expect(getState().project!.timeline.zoom, "- key should zoom out to 62.5 (78.125 * 0.8)").toBeCloseTo(62.5);

    // - back to near-original
    press("-");
    expect(getState().project!.timeline.zoom, "Second - key should return zoom near original value").toBeCloseTo(initialZoom);
  });
});

describe("Workflow: Edit, undo with keyboard, then continue editing", () => {
  it("select -> move (via store) -> Cmd+Z -> select different block -> move -> Cmd+Z", () => {
    // Select and move hl-1
    act(() => getState().selectBlock("hl-1"));
    act(() => getState().moveBlock("hl-1", 500));
    expect(getState().project!.timeline.tracks[2].blocks[0].start_ms,
      "Block hl-1 should be at 500ms after move").toBe(500);

    // Cmd+Z -> undo the move
    press("z", { metaKey: true });
    expect(getState().project!.timeline.tracks[2].blocks[0].start_ms,
      "After Cmd+Z, block hl-1 should return to 0ms").toBe(0);

    // Now select and move hl-2
    act(() => getState().selectBlock("hl-2"));
    act(() => getState().moveBlock("hl-2", 3000));
    expect(getState().project!.timeline.tracks[2].blocks[1].start_ms,
      "Block hl-2 should be at 3000ms after move").toBe(3000);

    // Cmd+Z -> undo hl-2 move
    press("z", { metaKey: true });
    expect(getState().project!.timeline.tracks[2].blocks[1].start_ms,
      "After Cmd+Z, block hl-2 should return to original 1000ms").toBe(1000);

    // Cmd+Shift+Z -> redo hl-2 move
    press("z", { metaKey: true, shiftKey: true });
    expect(getState().project!.timeline.tracks[2].blocks[1].start_ms,
      "After Cmd+Shift+Z redo, block hl-2 should be back at 3000ms").toBe(3000);
  });
});

describe("Workflow: Escape clears selection mid-operation", () => {
  it("select block -> Escape -> delete does nothing", () => {
    act(() => getState().selectBlock("hl-1"));
    expect(getState().selectedBlockIds.length, "One block should be selected before Escape").toBe(1);

    // Escape clears
    press("Escape");
    expect(getState().selectedBlockIds, "Escape should clear all selected blocks").toEqual([]);

    // Delete with no selection -> no-op
    const blocksBefore = getState()
      .project!.timeline.tracks.reduce((sum, t) => sum + t.blocks.length, 0);
    press("Delete");
    const blocksAfter = getState()
      .project!.timeline.tracks.reduce((sum, t) => sum + t.blocks.length, 0);
    expect(blocksAfter, "Delete with no selection should not remove any blocks").toBe(blocksBefore);
  });
});

describe("Workflow: Keyboard ignored when typing in input", () => {
  it("Space in an input field doesn't toggle playback", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    expect(getState().isPlaying, "Should start paused").toBe(false);
    fireEvent.keyDown(input, { key: " " });
    expect(getState().isPlaying, "Space in input field should not toggle playback").toBe(false);

    // But Space on window still works
    press(" ");
    expect(getState().isPlaying, "Space on window (not in input) should toggle playback to playing").toBe(true);

    document.body.removeChild(input);
  });
});
