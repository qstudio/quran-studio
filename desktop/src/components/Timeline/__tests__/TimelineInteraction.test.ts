import {
  createInitialDragState,
  getBlockAtPosition,
} from "@/components/Timeline/TimelineInteraction";
import { createTestProject } from "@/__tests__/fixtures";

// Constants from constants.ts:
// TRACK_HEADER_WIDTH = 120, TRACK_HEIGHT = 32, TIME_RULER_HEIGHT = 24, RESIZE_HIT_AREA = 6

describe("createInitialDragState", () => {
  it("returns a drag state with mode 'none'", () => {
    const state = createInitialDragState();
    expect(state.mode).toBe("none");
    expect(state.blockId).toBeNull();
    expect(state.startX).toBe(0);
    expect(state.startY).toBe(0);
  });
});

describe("getBlockAtPosition", () => {
  const project = createTestProject();
  const zoom = project.timeline.zoom; // 50
  const scrollX = project.timeline.scroll_x; // 0

  // Helper: compute the X pixel position of a given ms value
  // msToX(ms, zoom, scrollX) = 120 + (ms * zoom) / 1000 - scrollX
  function msToX(ms: number): number {
    return 120 + (ms * zoom) / 1000 - scrollX;
  }

  it("returns type 'ruler' when y < TIME_RULER_HEIGHT (24)", () => {
    const result = getBlockAtPosition(200, 10, project, zoom, scrollX);
    expect(result.type).toBe("ruler");
    expect(result.blockId).toBeNull();
  });

  it("returns type 'header' when x < TRACK_HEADER_WIDTH (120)", () => {
    const result = getBlockAtPosition(50, 30, project, zoom, scrollX);
    expect(result.type).toBe("header");
    expect(result.blockId).toBeNull();
  });

  it("returns type 'block' with correct blockId when over a block body", () => {
    // The highlight track is index 2 (audio=0, mushaf=1, highlight=2)
    // y for track 2: TIME_RULER_HEIGHT + 2*TRACK_HEIGHT + half = 24 + 64 + 16 = 104
    const trackY = 24 + 2 * 32 + 16;
    // hl-1 spans 0..1000ms. Center X = msToX(500)
    const blockCenterX = msToX(500);
    const result = getBlockAtPosition(blockCenterX, trackY, project, zoom, scrollX);
    expect(result.type).toBe("block");
    expect(result.blockId).toBe("hl-1");
  });

  it("returns type 'block-edge-left' near the left edge of a block (within 6px)", () => {
    const trackY = 24 + 2 * 32 + 16;
    // hl-2 starts at 1000ms. Left edge X = msToX(1000)
    const leftEdgeX = msToX(1000);
    // Hit within RESIZE_HIT_AREA (6px) of the left edge
    const result = getBlockAtPosition(leftEdgeX + 3, trackY, project, zoom, scrollX);
    expect(result.type).toBe("block-edge-left");
    expect(result.blockId).toBe("hl-2");
  });

  it("returns type 'block-edge-right' near the right edge of a block (within 6px)", () => {
    const trackY = 24 + 2 * 32 + 16;
    // hl-2 ends at 2000ms. Right edge X = msToX(2000)
    const rightEdgeX = msToX(2000);
    // Hit within RESIZE_HIT_AREA (6px) of the right edge
    const result = getBlockAtPosition(rightEdgeX - 3, trackY, project, zoom, scrollX);
    expect(result.type).toBe("block-edge-right");
    expect(result.blockId).toBe("hl-2");
  });

  it("returns type 'empty' when clicking empty space in a valid track", () => {
    const trackY = 24 + 2 * 32 + 16;
    // After all highlight blocks (last ends at 3000ms), pick a position well past them
    const emptyX = msToX(8000);
    const result = getBlockAtPosition(emptyX, trackY, project, zoom, scrollX);
    expect(result.type).toBe("empty");
    expect(result.blockId).toBeNull();
  });

  it("returns type 'empty' when trackIndex is out of range", () => {
    // 3 tracks, so y for track index 3 would be: 24 + 3*32 + 16 = 136
    const outOfRangeY = 24 + 3 * 32 + 16;
    const result = getBlockAtPosition(200, outOfRangeY, project, zoom, scrollX);
    expect(result.type).toBe("empty");
    expect(result.blockId).toBeNull();
  });
});
