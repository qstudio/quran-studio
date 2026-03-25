/**
 * Integration tests: Mouse interaction workflows
 *
 * Simulates real mouse interactions with the timeline canvas,
 * combining hit testing with store actions to verify end-to-end behavior.
 */
import { act } from "@testing-library/react";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTestProject } from "@/__tests__/fixtures";
import {
  getBlockAtPosition,
  handleWheel,
} from "@/components/Timeline/TimelineInteraction";
import { msToX, xToMs } from "@/components/Timeline/utils";
import { TRACK_HEADER_WIDTH, TRACK_HEIGHT, TIME_RULER_HEIGHT } from "@/components/Timeline/constants";

function getState() {
  return useTimelineStore.getState();
}

beforeEach(() => {
  act(() => {
    useTimelineStore.getState().setProject(createTestProject());
  });
});

describe("Workflow: Click ruler to scrub, then click block to select", () => {
  it("ruler click sets playhead, then block click selects without moving playhead", () => {
    const project = getState().project!;
    const { zoom, scroll_x } = project.timeline;

    // Click on ruler at x position that maps to ~2000ms
    const targetMs = 2000;
    const rulerX = msToX(targetMs, zoom, scroll_x);

    const rulerHit = getBlockAtPosition(rulerX, 10, project, zoom, scroll_x);
    expect(rulerHit.type, "Clicking at y=10 should hit the ruler area").toBe("ruler");

    // Simulate setting playhead like handleMouseDown would
    act(() => getState().setPlayhead(xToMs(rulerX, zoom, scroll_x)));
    expect(getState().project!.timeline.playhead_ms,
      "After ruler click, playhead should be near 2000ms").toBeCloseTo(targetMs, -1);

    // Now click on hl-1 block body (track 2, which is at y offset 2 * TRACK_HEIGHT + TIME_RULER_HEIGHT)
    const hl1 = project.timeline.tracks[2].blocks[0]; // 0-1000ms
    const blockCenterX = msToX((hl1.start_ms + hl1.end_ms) / 2, zoom, scroll_x);
    const blockY = TIME_RULER_HEIGHT + 2 * TRACK_HEIGHT + TRACK_HEIGHT / 2;

    const blockHit = getBlockAtPosition(blockCenterX, blockY, project, zoom, scroll_x);
    expect(blockHit.type, "Clicking center of hl-1 should hit a block").toBe("block");
    expect(blockHit.blockId, "Hit block should be identified as hl-1").toBe("hl-1");

    // Select the block
    act(() => getState().selectBlock(blockHit.blockId!));
    expect(getState().selectedBlockIds, "After clicking block, hl-1 should be selected").toEqual(["hl-1"]);

    // Playhead should NOT have moved from the ruler scrub
    expect(getState().project!.timeline.playhead_ms,
      "Selecting a block should not move the playhead from its ruler-scrubbed position").toBeCloseTo(targetMs, -1);
  });
});

describe("Workflow: Detect resize handles at block edges", () => {
  it("near left edge -> resize-left, center -> block, near right edge -> resize-right", () => {
    const project = getState().project!;
    const { zoom, scroll_x } = project.timeline;
    const blockY = TIME_RULER_HEIGHT + 2 * TRACK_HEIGHT + TRACK_HEIGHT / 2;

    const hl1 = project.timeline.tracks[2].blocks[0]; // 0-1000ms
    const leftEdgeX = msToX(hl1.start_ms, zoom, scroll_x);
    const rightEdgeX = msToX(hl1.end_ms, zoom, scroll_x);
    const centerX = (leftEdgeX + rightEdgeX) / 2;

    // Near left edge (within 6px)
    const leftHit = getBlockAtPosition(leftEdgeX + 2, blockY, project, zoom, scroll_x);
    expect(leftHit.type, "Clicking 2px from left edge of hl-1 should detect left resize handle").toBe("block-edge-left");

    // Center
    const centerHit = getBlockAtPosition(centerX, blockY, project, zoom, scroll_x);
    expect(centerHit.type, "Clicking center of hl-1 should detect block body (not edge)").toBe("block");

    // Near right edge (within 6px)
    const rightHit = getBlockAtPosition(rightEdgeX - 2, blockY, project, zoom, scroll_x);
    expect(rightHit.type, "Clicking 2px from right edge of hl-1 should detect right resize handle").toBe("block-edge-right");
  });
});

describe("Workflow: Scroll wheel zooms and pans", () => {
  it("Shift+wheel pans, Ctrl+wheel zooms, plain wheel pans", () => {
    const project = getState().project!;
    const initialZoom = project.timeline.zoom;
    const initialScrollX = project.timeline.scroll_x;
    const canvas = document.createElement("canvas");

    const mockStore = {
      setPlayhead: vi.fn(),
      selectBlock: vi.fn(),
      clearSelection: vi.fn(),
      moveBlock: vi.fn(),
      resizeBlock: vi.fn(),
      setZoom: (z: number) => act(() => getState().setZoom(z)),
      setScrollX: (x: number) => act(() => getState().setScrollX(x)),
    };

    // Shift+wheel -> horizontal pan
    const shiftWheel = new WheelEvent("wheel", {
      deltaY: 100,
      shiftKey: true,
    });
    Object.defineProperty(shiftWheel, "preventDefault", { value: vi.fn() });
    handleWheel(shiftWheel, canvas, getState().project!, mockStore);
    expect(getState().project!.timeline.scroll_x,
      "Shift+wheel with deltaY=100 should pan scroll_x by 100 pixels").toBe(initialScrollX + 100);

    // Reset
    act(() => getState().setScrollX(0));

    // Ctrl+wheel -> zoom
    const ctrlWheel = new WheelEvent("wheel", {
      deltaY: -50,
      ctrlKey: true,
    });
    Object.defineProperty(ctrlWheel, "preventDefault", { value: vi.fn() });
    handleWheel(ctrlWheel, canvas, getState().project!, mockStore);
    // deltaY=-50, factor = 1 - (-50)*0.01 = 1.5, zoom = 50 * 1.5 = 75
    expect(getState().project!.timeline.zoom,
      "Ctrl+wheel with deltaY=-50 should zoom from 50 to 75 (factor 1.5)").toBeCloseTo(75, 0);

    // Reset
    act(() => getState().setZoom(initialZoom));

    // Plain wheel -> vertical scroll acts as horizontal pan
    const plainWheel = new WheelEvent("wheel", { deltaY: 50 });
    Object.defineProperty(plainWheel, "preventDefault", { value: vi.fn() });
    handleWheel(plainWheel, canvas, getState().project!, mockStore);
    expect(getState().project!.timeline.scroll_x,
      "Plain wheel with deltaY=50 should pan scroll_x by 50 pixels").toBe(50);
  });
});

describe("Workflow: Click empty space clears selection", () => {
  it("selecting a block then clicking empty space deselects", () => {
    const project = getState().project!;
    const { zoom, scroll_x } = project.timeline;

    // Select a block first
    act(() => getState().selectBlock("hl-1"));
    expect(getState().selectedBlockIds, "hl-1 should be selected before clicking empty space").toEqual(["hl-1"]);

    // Click empty space (far right where no blocks exist)
    const emptyX = msToX(9000, zoom, scroll_x); // way past all highlight blocks
    const emptyY = TIME_RULER_HEIGHT + 2 * TRACK_HEIGHT + TRACK_HEIGHT / 2;
    const hit = getBlockAtPosition(emptyX, emptyY, project, zoom, scroll_x);
    expect(hit.type, "Clicking at 9000ms (past all blocks) should hit empty space").toBe("empty");

    // handleMouseDown would call clearSelection for empty/header hits
    act(() => getState().clearSelection());
    expect(getState().selectedBlockIds, "Selection should be empty after clicking empty space").toEqual([]);
  });
});

describe("Workflow: msToX/xToMs consistency through zoom changes", () => {
  it("block positions map correctly at different zoom levels", () => {
    const hl2StartMs = 1000;

    // At default zoom (50)
    const x1 = msToX(hl2StartMs, 50, 0);
    const ms1 = xToMs(x1, 50, 0);
    expect(ms1, "msToX/xToMs should round-trip correctly at zoom=50").toBeCloseTo(hl2StartMs);

    // At zoomed in (200)
    const x2 = msToX(hl2StartMs, 200, 0);
    expect(x2, "Higher zoom (200) should produce more pixels than lower zoom (50) for same ms").toBeGreaterThan(x1); // more pixels at higher zoom
    const ms2 = xToMs(x2, 200, 0);
    expect(ms2, "msToX/xToMs should round-trip correctly at zoom=200").toBeCloseTo(hl2StartMs);

    // At zoomed in with scroll
    const x3 = msToX(hl2StartMs, 200, 100);
    const ms3 = xToMs(x3, 200, 100);
    expect(ms3, "msToX/xToMs should round-trip correctly at zoom=200 with scroll_x=100").toBeCloseTo(hl2StartMs);
  });
});
