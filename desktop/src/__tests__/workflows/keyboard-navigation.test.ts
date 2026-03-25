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
  it("Space to play → L to skip forward → K to pause → J to skip back", () => {
    // Start paused at 0
    expect(getState().isPlaying).toBe(false);
    expect(getState().project!.timeline.playhead_ms).toBe(0);

    // Space → play
    press(" ");
    expect(getState().isPlaying).toBe(true);

    // L → skip forward 5000ms (from 0 → 5000)
    press("l");
    expect(getState().project!.timeline.playhead_ms).toBe(5000);

    // K → pause
    press("k");
    expect(getState().isPlaying).toBe(false);

    // J → skip back 5000ms (from 5000 → 0)
    press("j");
    expect(getState().project!.timeline.playhead_ms).toBe(0);
  });
});

describe("Workflow: Fine-grained seeking with arrow keys", () => {
  it("Arrow keys for precise positioning, Shift+arrows for larger jumps", () => {
    // Set playhead to middle
    act(() => getState().setPlayhead(5000));

    // ArrowRight → +100ms
    press("ArrowRight");
    expect(getState().project!.timeline.playhead_ms).toBe(5100);

    // ArrowRight again
    press("ArrowRight");
    expect(getState().project!.timeline.playhead_ms).toBe(5200);

    // Shift+ArrowRight → +1000ms
    press("ArrowRight", { shiftKey: true });
    expect(getState().project!.timeline.playhead_ms).toBe(6200);

    // ArrowLeft → -100ms
    press("ArrowLeft");
    expect(getState().project!.timeline.playhead_ms).toBe(6100);

    // Shift+ArrowLeft → -1000ms
    press("ArrowLeft", { shiftKey: true });
    expect(getState().project!.timeline.playhead_ms).toBe(5100);
  });

  it("seeking clamps at boundaries", () => {
    // At 0, press ArrowLeft → stays at 0
    act(() => getState().setPlayhead(0));
    press("ArrowLeft");
    expect(getState().project!.timeline.playhead_ms).toBe(0);

    // Near end, skip forward → clamps to duration
    act(() => getState().setPlayhead(9900));
    press("ArrowRight");
    expect(getState().project!.timeline.playhead_ms).toBe(10000);

    // At end, press L → stays at duration
    press("l");
    expect(getState().project!.timeline.playhead_ms).toBe(10000);
  });
});

describe("Workflow: Select all, delete, undo", () => {
  it("Cmd+A → Delete → Cmd+Z restores all blocks", () => {
    // Count total blocks before
    const totalBlocks = getState()
      .project!.timeline.tracks.reduce((sum, t) => sum + t.blocks.length, 0);

    // Cmd+A to select all
    press("a", { metaKey: true });
    expect(getState().selectedBlockIds.length).toBe(totalBlocks);

    // Delete all
    press("Delete");
    const blocksAfterDelete = getState()
      .project!.timeline.tracks.reduce((sum, t) => sum + t.blocks.length, 0);
    expect(blocksAfterDelete).toBe(0);
    expect(getState().selectedBlockIds).toEqual([]);

    // Cmd+Z to undo
    press("z", { metaKey: true });
    const blocksAfterUndo = getState()
      .project!.timeline.tracks.reduce((sum, t) => sum + t.blocks.length, 0);
    expect(blocksAfterUndo).toBe(totalBlocks);
  });
});

describe("Workflow: Zoom in and out via keyboard", () => {
  it("+ to zoom in, - to zoom out, maintains relative values", () => {
    const initialZoom = getState().project!.timeline.zoom; // 50

    // + → zoom in (×1.25)
    press("=");
    expect(getState().project!.timeline.zoom).toBeCloseTo(62.5);

    // + again
    press("=");
    expect(getState().project!.timeline.zoom).toBeCloseTo(78.125);

    // - → zoom out (×0.8)
    press("-");
    expect(getState().project!.timeline.zoom).toBeCloseTo(62.5);

    // - back to near-original
    press("-");
    expect(getState().project!.timeline.zoom).toBeCloseTo(initialZoom);
  });
});

describe("Workflow: Edit, undo with keyboard, then continue editing", () => {
  it("select → move (via store) → Cmd+Z → select different block → move → Cmd+Z", () => {
    // Select and move hl-1
    act(() => getState().selectBlock("hl-1"));
    act(() => getState().moveBlock("hl-1", 500));
    expect(getState().project!.timeline.tracks[2].blocks[0].start_ms).toBe(500);

    // Cmd+Z → undo the move
    press("z", { metaKey: true });
    expect(getState().project!.timeline.tracks[2].blocks[0].start_ms).toBe(0);

    // Now select and move hl-2
    act(() => getState().selectBlock("hl-2"));
    act(() => getState().moveBlock("hl-2", 3000));
    expect(getState().project!.timeline.tracks[2].blocks[1].start_ms).toBe(3000);

    // Cmd+Z → undo hl-2 move
    press("z", { metaKey: true });
    expect(getState().project!.timeline.tracks[2].blocks[1].start_ms).toBe(1000);

    // Cmd+Shift+Z → redo hl-2 move
    press("z", { metaKey: true, shiftKey: true });
    expect(getState().project!.timeline.tracks[2].blocks[1].start_ms).toBe(3000);
  });
});

describe("Workflow: Escape clears selection mid-operation", () => {
  it("select block → Escape → delete does nothing", () => {
    act(() => getState().selectBlock("hl-1"));
    expect(getState().selectedBlockIds.length).toBe(1);

    // Escape clears
    press("Escape");
    expect(getState().selectedBlockIds).toEqual([]);

    // Delete with no selection → no-op
    const blocksBefore = getState()
      .project!.timeline.tracks.reduce((sum, t) => sum + t.blocks.length, 0);
    press("Delete");
    const blocksAfter = getState()
      .project!.timeline.tracks.reduce((sum, t) => sum + t.blocks.length, 0);
    expect(blocksAfter).toBe(blocksBefore);
  });
});

describe("Workflow: Keyboard ignored when typing in input", () => {
  it("Space in an input field doesn't toggle playback", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    expect(getState().isPlaying).toBe(false);
    fireEvent.keyDown(input, { key: " " });
    expect(getState().isPlaying).toBe(false);

    // But Space on window still works
    press(" ");
    expect(getState().isPlaying).toBe(true);

    document.body.removeChild(input);
  });
});
