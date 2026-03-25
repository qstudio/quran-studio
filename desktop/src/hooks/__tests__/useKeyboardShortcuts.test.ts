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

    expect(useTimelineStore.getState().isPlaying).toBe(false);

    act(() => pressKey(" "));
    expect(useTimelineStore.getState().isPlaying).toBe(true);

    act(() => pressKey(" "));
    expect(useTimelineStore.getState().isPlaying).toBe(false);
  });

  it("j seeks back 5000ms", () => {
    renderHook(() => useKeyboardShortcuts());

    // Set playhead to 5000ms first
    act(() => {
      useTimelineStore.getState().setPlayhead(5000);
    });
    expect(useTimelineStore.getState().project!.timeline.playhead_ms).toBe(5000);

    act(() => pressKey("j"));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms).toBe(0);
  });

  it("j does not go below 0", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      useTimelineStore.getState().setPlayhead(2000);
    });

    act(() => pressKey("j"));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms).toBe(0);
  });

  it("l seeks forward 5000ms", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => pressKey("l"));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms).toBe(5000);
  });

  it("l does not exceed duration", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      useTimelineStore.getState().setPlayhead(8000);
    });

    act(() => pressKey("l"));
    // duration is 10000
    expect(useTimelineStore.getState().project!.timeline.playhead_ms).toBe(10000);
  });

  it("k pauses playback", () => {
    renderHook(() => useKeyboardShortcuts());

    // Start playing first
    act(() => {
      useTimelineStore.getState().play();
    });
    expect(useTimelineStore.getState().isPlaying).toBe(true);

    act(() => pressKey("k"));
    expect(useTimelineStore.getState().isPlaying).toBe(false);
  });

  it("ArrowLeft moves playhead back 100ms", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      useTimelineStore.getState().setPlayhead(500);
    });

    act(() => pressKey("ArrowLeft"));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms).toBe(400);
  });

  it("ArrowLeft with Shift moves playhead back 1000ms", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      useTimelineStore.getState().setPlayhead(2000);
    });

    act(() => pressKey("ArrowLeft", { shiftKey: true }));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms).toBe(1000);
  });

  it("ArrowRight moves playhead forward 100ms", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => pressKey("ArrowRight"));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms).toBe(100);
  });

  it("ArrowRight with Shift moves playhead forward 1000ms", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => pressKey("ArrowRight", { shiftKey: true }));
    expect(useTimelineStore.getState().project!.timeline.playhead_ms).toBe(1000);
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

    expect(getBlock()!.start_ms).toBe(0);

    // Move block
    act(() => {
      useTimelineStore.getState().moveBlock(blockId, 500);
    });
    expect(getBlock()!.start_ms).toBe(500);

    // Undo via keyboard
    act(() => pressKey("z", { metaKey: true }));
    expect(getBlock()!.start_ms).toBe(0);
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
    expect(getBlock()!.start_ms).toBe(0);

    act(() => pressKey("Z", { metaKey: true, shiftKey: true }));
    expect(getBlock()!.start_ms).toBe(500);
  });

  it("+ zooms in by 1.25x", () => {
    renderHook(() => useKeyboardShortcuts());

    const initialZoom = useTimelineStore.getState().project!.timeline.zoom;

    act(() => pressKey("+"));
    expect(useTimelineStore.getState().project!.timeline.zoom).toBeCloseTo(
      initialZoom * 1.25
    );
  });

  it("= zooms in by 1.25x", () => {
    renderHook(() => useKeyboardShortcuts());

    const initialZoom = useTimelineStore.getState().project!.timeline.zoom;

    act(() => pressKey("="));
    expect(useTimelineStore.getState().project!.timeline.zoom).toBeCloseTo(
      initialZoom * 1.25
    );
  });

  it("- zooms out by 0.8x", () => {
    renderHook(() => useKeyboardShortcuts());

    const initialZoom = useTimelineStore.getState().project!.timeline.zoom;

    act(() => pressKey("-"));
    expect(useTimelineStore.getState().project!.timeline.zoom).toBeCloseTo(
      initialZoom * 0.8
    );
  });

  it("Delete deletes selected blocks", () => {
    renderHook(() => useKeyboardShortcuts());

    // Select a block first
    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    expect(useTimelineStore.getState().selectedBlockIds).toEqual(["hl-1"]);

    act(() => pressKey("Delete"));

    // Block should be deleted and selection cleared
    expect(useTimelineStore.getState().selectedBlockIds).toEqual([]);
    const project = useTimelineStore.getState().project!;
    const highlightTrack = project.timeline.tracks.find(
      (t) => t.track_type === "highlight"
    )!;
    const deletedBlock = highlightTrack.blocks.find((b) => b.id === "hl-1");
    expect(deletedBlock).toBeUndefined();
  });

  it("Backspace deletes selected blocks", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      useTimelineStore.getState().selectBlock("hl-2");
    });

    act(() => pressKey("Backspace"));

    expect(useTimelineStore.getState().selectedBlockIds).toEqual([]);
    const project = useTimelineStore.getState().project!;
    const highlightTrack = project.timeline.tracks.find(
      (t) => t.track_type === "highlight"
    )!;
    expect(highlightTrack.blocks.find((b) => b.id === "hl-2")).toBeUndefined();
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

    expect(blockCountAfter).toBe(blockCountBefore);
  });

  it("Escape clears selection", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => {
      useTimelineStore.getState().selectBlock("hl-1");
    });
    expect(useTimelineStore.getState().selectedBlockIds).toEqual(["hl-1"]);

    act(() => pressKey("Escape"));
    expect(useTimelineStore.getState().selectedBlockIds).toEqual([]);
  });

  it("Cmd+a selects all blocks", () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => pressKey("a", { metaKey: true }));

    const allBlockIds = useTimelineStore
      .getState()
      .project!.timeline.tracks.flatMap((t) => t.blocks.map((b) => b.id));

    expect(useTimelineStore.getState().selectedBlockIds.sort()).toEqual(
      allBlockIds.sort()
    );
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
    expect(useTimelineStore.getState().isPlaying).toBe(false);

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

    expect(useTimelineStore.getState().isPlaying).toBe(false);

    document.body.removeChild(textarea);
  });
});
