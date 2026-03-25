import { renderHook, act } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTestProject } from "@/__tests__/fixtures";

beforeEach(() => {
  act(() => {
    useTimelineStore.getState().setProject(createTestProject());
  });
});

afterEach(() => {
  act(() => {
    useTimelineStore.setState({
      project: null,
      selectedBlockIds: [],
      selectedTrackId: null,
      isPlaying: false,
    });
  });
});

function pressKey(
  key: string,
  opts: Partial<KeyboardEventInit> = {}
): void {
  fireEvent.keyDown(window, { key, ...opts });
}

describe("useKeyboardShortcuts", () => {
  it("Space toggles playback", () => {
    renderHook(() => useKeyboardShortcuts());

    expect(useTimelineStore.getState().isPlaying, "Playback should start paused").toBe(false);

    act(() => pressKey(" "));
    expect(useTimelineStore.getState().isPlaying, "Space key should toggle playback to playing").toBe(true);

    act(() => pressKey(" "));
    expect(useTimelineStore.getState().isPlaying, "Space key should toggle playback back to paused").toBe(false);
  });

  it("j seeks back 5000ms", () => {
    renderHook(() => useKeyboardShortcuts());

    // Set playhead to 5000ms first
    act(() => {
      useTimelineStore.getState().setPlayhead(5000);
    });
    expect(useTimelineStore.getState().project!.timeline.playhead_ms,
      "Playhead should be at 5000ms before pressing J").toBe(5000);

    act(() => pressKey("j"));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms,
      "J key should seek back 5000ms (from 5000 to 0)").toBe(0);
  });

  it("j does not go below 0", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      useTimelineStore.getState().setPlayhead(2000);
    });

    act(() => pressKey("j"));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms,
      "J key from 2000ms should clamp to 0 (not go negative)").toBe(0);
  });

  it("l seeks forward 5000ms", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => pressKey("l"));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms,
      "L key should seek forward 5000ms from 0").toBe(5000);
  });

  it("l does not exceed duration", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      useTimelineStore.getState().setPlayhead(8000);
    });

    act(() => pressKey("l"));
    // duration is 10000
    expect(useTimelineStore.getState().project!.timeline.playhead_ms,
      "L key from 8000ms should clamp to duration 10000ms (not exceed it)").toBe(10000);
  });

  it("k pauses playback", () => {
    renderHook(() => useKeyboardShortcuts());

    // Start playing first
    act(() => {
      useTimelineStore.getState().play();
    });
    expect(useTimelineStore.getState().isPlaying,
      "Playback should be playing before pressing K").toBe(true);

    act(() => pressKey("k"));
    expect(useTimelineStore.getState().isPlaying,
      "K key should pause playback").toBe(false);
  });

  it("ArrowLeft moves playhead back 100ms", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      useTimelineStore.getState().setPlayhead(500);
    });

    act(() => pressKey("ArrowLeft"));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms,
      "ArrowLeft should move playhead back 100ms (from 500 to 400)").toBe(400);
  });

  it("ArrowLeft with Shift moves playhead back 1000ms", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      useTimelineStore.getState().setPlayhead(2000);
    });

    act(() => pressKey("ArrowLeft", { shiftKey: true }));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms,
      "Shift+ArrowLeft should move playhead back 1000ms (from 2000 to 1000)").toBe(1000);
  });

  it("ArrowRight moves playhead forward 100ms", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => pressKey("ArrowRight"));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms,
      "ArrowRight should move playhead forward 100ms (from 0 to 100)").toBe(100);
  });

  it("ArrowRight with Shift moves playhead forward 1000ms", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => pressKey("ArrowRight", { shiftKey: true }));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms,
      "Shift+ArrowRight should move playhead forward 1000ms (from 0 to 1000)").toBe(1000);
  });

  it("Cmd+z undoes a moveBlock action", () => {
    renderHook(() => useKeyboardShortcuts());

    const blockId = "hl-1";

    // Verify initial position
    const getBlock = () => {
      const project = useTimelineStore.getState().project!;
      for (const track of project.timeline.tracks) {
        for (const block of track.blocks) {
          if (block.id === blockId) return block;
        }
      }
      return null;
    };

    expect(getBlock()!.start_ms, "Block hl-1 should start at 0ms initially").toBe(0);

    // Move block
    act(() => {
      useTimelineStore.getState().moveBlock(blockId, 500);
    });
    expect(getBlock()!.start_ms, "Block hl-1 should be at 500ms after move").toBe(500);

    // Undo via keyboard
    act(() => pressKey("z", { metaKey: true }));
    expect(getBlock()!.start_ms, "Cmd+Z should undo the move and return block hl-1 to 0ms").toBe(0);
  });

  it("Cmd+Shift+z redoes an undone action", () => {
    renderHook(() => useKeyboardShortcuts());

    const blockId = "hl-1";

    const getBlock = () => {
      const project = useTimelineStore.getState().project!;
      for (const track of project.timeline.tracks) {
        for (const block of track.blocks) {
          if (block.id === blockId) return block;
        }
      }
      return null;
    };

    // Move, undo, then redo
    act(() => {
      useTimelineStore.getState().moveBlock(blockId, 500);
    });
    act(() => pressKey("z", { metaKey: true }));
    expect(getBlock()!.start_ms, "Block should be at 0ms after Cmd+Z undo").toBe(0);

    act(() => pressKey("Z", { metaKey: true, shiftKey: true }));
    expect(getBlock()!.start_ms, "Cmd+Shift+Z should redo the move, putting block back at 500ms").toBe(500);
  });

  it("+ zooms in by 1.25x", () => {
    renderHook(() => useKeyboardShortcuts());

    const initialZoom = useTimelineStore.getState().project!.timeline.zoom;

    act(() => pressKey("+"));
    expect(useTimelineStore.getState().project!.timeline.zoom,
      `+ key should zoom in by 1.25x (from ${initialZoom} to ${initialZoom * 1.25})`
    ).toBeCloseTo(initialZoom * 1.25);
  });

  it("= zooms in by 1.25x", () => {
    renderHook(() => useKeyboardShortcuts());

    const initialZoom = useTimelineStore.getState().project!.timeline.zoom;

    act(() => pressKey("="));
    expect(useTimelineStore.getState().project!.timeline.zoom,
      `= key should also zoom in by 1.25x (from ${initialZoom} to ${initialZoom * 1.25})`
    ).toBeCloseTo(initialZoom * 1.25);
  });

  it("- zooms out by 0.8x", () => {
    renderHook(() => useKeyboardShortcuts());

    const initialZoom = useTimelineStore.getState().project!.timeline.zoom;

    act(() => pressKey("-"));
    expect(useTimelineStore.getState().project!.timeline.zoom,
      `- key should zoom out by 0.8x (from ${initialZoom} to ${initialZoom * 0.8})`
    ).toBeCloseTo(initialZoom * 0.8);
  });

  it("Delete deletes selected blocks", () => {
    renderHook(() => useKeyboardShortcuts());

    // Select a block first
    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    expect(useTimelineStore.getState().selectedBlockIds,
      "hl-1 should be selected before pressing Delete").toEqual(["hl-1"]);

    act(() => pressKey("Delete"));

    // Block should be deleted and selection cleared
    expect(useTimelineStore.getState().selectedBlockIds,
      "Selection should be cleared after Delete key").toEqual([]);
    const project = useTimelineStore.getState().project!;
    const highlightTrack = project.timeline.tracks.find(
      (t) => t.track_type === "highlight"
    )!;
    const deletedBlock = highlightTrack.blocks.find((b) => b.id === "hl-1");
    expect(deletedBlock, "Block hl-1 should be removed from the track after Delete key").toBeUndefined();
  });

  it("Backspace deletes selected blocks", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      useTimelineStore.getState().selectBlock("hl-2");
    });

    act(() => pressKey("Backspace"));

    expect(useTimelineStore.getState().selectedBlockIds,
      "Selection should be cleared after Backspace key").toEqual([]);
    const project = useTimelineStore.getState().project!;
    const highlightTrack = project.timeline.tracks.find(
      (t) => t.track_type === "highlight"
    )!;
    expect(highlightTrack.blocks.find((b) => b.id === "hl-2"),
      "Block hl-2 should be removed from the track after Backspace key").toBeUndefined();
  });

  it("Delete does nothing when no blocks are selected", () => {
    renderHook(() => useKeyboardShortcuts());

    const blockCountBefore = useTimelineStore
      .getState()
      .project!.timeline.tracks.flatMap((t) => t.blocks).length;

    act(() => pressKey("Delete"));

    const blockCountAfter = useTimelineStore
      .getState()
      .project!.timeline.tracks.flatMap((t) => t.blocks).length;

    expect(blockCountAfter,
      "Delete with no selection should not change the total block count").toBe(blockCountBefore);
  });

  it("Escape clears selection", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    expect(useTimelineStore.getState().selectedBlockIds,
      "hl-1 should be selected before pressing Escape").toEqual(["hl-1"]);

    act(() => pressKey("Escape"));
    expect(useTimelineStore.getState().selectedBlockIds,
      "Escape key should clear all selected blocks").toEqual([]);
  });

  it("Cmd+a selects all blocks", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => pressKey("a", { metaKey: true }));

    const allBlockIds = useTimelineStore
      .getState()
      .project!.timeline.tracks.flatMap((t) => t.blocks.map((b) => b.id));

    expect(useTimelineStore.getState().selectedBlockIds.sort(),
      "Cmd+A should select all blocks across all tracks").toEqual(allBlockIds.sort());
  });

  it("ignores keys when target is an INPUT element", () => {
    renderHook(() => useKeyboardShortcuts());

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      fireEvent.keyDown(input, { key: " " });
    });

    // Playback should NOT have toggled
    expect(useTimelineStore.getState().isPlaying,
      "Space key should be ignored when focused on an input element").toBe(false);

    document.body.removeChild(input);
  });

  it("ignores keys when target is a TEXTAREA element", () => {
    renderHook(() => useKeyboardShortcuts());

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    act(() => {
      fireEvent.keyDown(textarea, { key: " " });
    });

    expect(useTimelineStore.getState().isPlaying,
      "Space key should be ignored when focused on a textarea element").toBe(false);

    document.body.removeChild(textarea);
  });
});
