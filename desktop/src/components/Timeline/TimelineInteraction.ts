import type { Project, Block } from "@/types/project";
import {
  TRACK_HEADER_WIDTH,
  TRACK_HEIGHT,
  TIME_RULER_HEIGHT,
  RESIZE_HIT_AREA,
} from "./constants";
import { msToX, xToMs } from "./utils";

export type DragMode =
  | "none"
  | "scrub"
  | "move"
  | "resize-left"
  | "resize-right"
  | "range-select";

export interface DragState {
  mode: DragMode;
  blockId: string | null;
  startX: number;
  startY: number;
  originalStartMs: number;
  originalEndMs: number;
}

export function createInitialDragState(): DragState {
  return {
    mode: "none",
    blockId: null,
    startX: 0,
    startY: 0,
    originalStartMs: 0,
    originalEndMs: 0,
  };
}

export interface HitResult {
  type: "ruler" | "header" | "block" | "block-edge-left" | "block-edge-right" | "empty";
  blockId: string | null;
  trackIndex: number;
}

interface StoreActions {
  setPlayhead: (ms: number) => void;
  selectBlock: (blockId: string, multi?: boolean) => void;
  clearSelection: () => void;
  moveBlock: (blockId: string, newStartMs: number) => void;
  resizeBlock: (blockId: string, newStartMs: number, newEndMs: number) => void;
  setZoom: (zoom: number) => void;
  setScrollX: (x: number) => void;
}

export function getBlockAtPosition(
  x: number,
  y: number,
  project: Project,
  zoom: number,
  scrollX: number
): HitResult {
  // Check ruler area
  if (y < TIME_RULER_HEIGHT) {
    return { type: "ruler", blockId: null, trackIndex: -1 };
  }

  // Check header area
  if (x < TRACK_HEADER_WIDTH) {
    const trackIndex = Math.floor((y - TIME_RULER_HEIGHT) / TRACK_HEIGHT);
    return { type: "header", blockId: null, trackIndex };
  }

  // Check tracks
  const trackIndex = Math.floor((y - TIME_RULER_HEIGHT) / TRACK_HEIGHT);
  if (trackIndex < 0 || trackIndex >= project.timeline.tracks.length) {
    return { type: "empty", blockId: null, trackIndex: -1 };
  }

  const track = project.timeline.tracks[trackIndex];

  for (let i = track.blocks.length - 1; i >= 0; i--) {
    const block = track.blocks[i];
    const blockStartX = msToX(block.start_ms, zoom, scrollX);
    const blockEndX = msToX(block.end_ms, zoom, scrollX);

    if (x >= blockStartX && x <= blockEndX) {
      // Check if near left edge
      if (x - blockStartX <= RESIZE_HIT_AREA) {
        return {
          type: "block-edge-left",
          blockId: block.id,
          trackIndex,
        };
      }
      // Check if near right edge
      if (blockEndX - x <= RESIZE_HIT_AREA) {
        return {
          type: "block-edge-right",
          blockId: block.id,
          trackIndex,
        };
      }
      return { type: "block", blockId: block.id, trackIndex };
    }
  }

  return { type: "empty", blockId: null, trackIndex };
}

function findBlockById(project: Project, blockId: string): Block | null {
  for (const track of project.timeline.tracks) {
    for (const block of track.blocks) {
      if (block.id === blockId) return block;
    }
  }
  return null;
}

function snapToNearestEdge(
  ms: number,
  project: Project,
  excludeBlockId: string | null,
  snapThresholdMs: number
): number {
  let closestMs = ms;
  let closestDist = snapThresholdMs;

  for (const track of project.timeline.tracks) {
    for (const block of track.blocks) {
      if (block.id === excludeBlockId) continue;

      const distStart = Math.abs(ms - block.start_ms);
      const distEnd = Math.abs(ms - block.end_ms);

      if (distStart < closestDist) {
        closestDist = distStart;
        closestMs = block.start_ms;
      }
      if (distEnd < closestDist) {
        closestDist = distEnd;
        closestMs = block.end_ms;
      }
    }
  }

  return closestMs;
}

export function handleMouseDown(
  e: MouseEvent,
  canvas: HTMLCanvasElement,
  project: Project,
  store: StoreActions,
  selectedBlockIds: string[]
): DragState {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const { zoom, scroll_x: scrollX } = project.timeline;
  const hit = getBlockAtPosition(x, y, project, zoom, scrollX);

  switch (hit.type) {
    case "ruler": {
      const ms = xToMs(x, zoom, scrollX);
      store.setPlayhead(Math.max(0, ms));
      return {
        mode: "scrub",
        blockId: null,
        startX: x,
        startY: y,
        originalStartMs: 0,
        originalEndMs: 0,
      };
    }

    case "block": {
      const block = findBlockById(project, hit.blockId!);
      if (!block) return createInitialDragState();

      const isShift = e.shiftKey;
      if (!selectedBlockIds.includes(hit.blockId!)) {
        store.selectBlock(hit.blockId!, isShift);
      }

      return {
        mode: "move",
        blockId: hit.blockId,
        startX: x,
        startY: y,
        originalStartMs: block.start_ms,
        originalEndMs: block.end_ms,
      };
    }

    case "block-edge-left": {
      const block = findBlockById(project, hit.blockId!);
      if (!block) return createInitialDragState();
      store.selectBlock(hit.blockId!, false);
      return {
        mode: "resize-left",
        blockId: hit.blockId,
        startX: x,
        startY: y,
        originalStartMs: block.start_ms,
        originalEndMs: block.end_ms,
      };
    }

    case "block-edge-right": {
      const block = findBlockById(project, hit.blockId!);
      if (!block) return createInitialDragState();
      store.selectBlock(hit.blockId!, false);
      return {
        mode: "resize-right",
        blockId: hit.blockId,
        startX: x,
        startY: y,
        originalStartMs: block.start_ms,
        originalEndMs: block.end_ms,
      };
    }

    case "header":
    case "empty":
    default:
      store.clearSelection();
      return createInitialDragState();
  }
}

export function handleMouseMove(
  e: MouseEvent,
  canvas: HTMLCanvasElement,
  project: Project,
  store: StoreActions,
  dragState: DragState
): void {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const { zoom, scroll_x: scrollX } = project.timeline;

  // Update cursor based on hover position
  const y = e.clientY - rect.top;
  if (dragState.mode === "none") {
    const hit = getBlockAtPosition(x, y, project, zoom, scrollX);
    if (
      hit.type === "block-edge-left" ||
      hit.type === "block-edge-right"
    ) {
      canvas.style.cursor = "col-resize";
    } else if (hit.type === "block") {
      canvas.style.cursor = "grab";
    } else if (hit.type === "ruler") {
      canvas.style.cursor = "text";
    } else {
      canvas.style.cursor = "default";
    }
    return;
  }

  const deltaX = x - dragState.startX;
  const deltaMs = (deltaX * 1000) / zoom;
  const snapThreshold = (10 * 1000) / zoom; // 10px worth of ms

  switch (dragState.mode) {
    case "scrub": {
      const ms = xToMs(x, zoom, scrollX);
      store.setPlayhead(Math.max(0, ms));
      break;
    }

    case "move": {
      if (!dragState.blockId) break;
      canvas.style.cursor = "grabbing";
      let newStartMs = dragState.originalStartMs + deltaMs;
      newStartMs = snapToNearestEdge(
        newStartMs,
        project,
        dragState.blockId,
        snapThreshold
      );
      newStartMs = Math.max(0, newStartMs);
      store.moveBlock(dragState.blockId, newStartMs);
      break;
    }

    case "resize-left": {
      if (!dragState.blockId) break;
      let newStartMs = dragState.originalStartMs + deltaMs;
      newStartMs = snapToNearestEdge(
        newStartMs,
        project,
        dragState.blockId,
        snapThreshold
      );
      newStartMs = Math.max(0, newStartMs);
      newStartMs = Math.min(newStartMs, dragState.originalEndMs - 10);
      store.resizeBlock(
        dragState.blockId,
        newStartMs,
        dragState.originalEndMs
      );
      break;
    }

    case "resize-right": {
      if (!dragState.blockId) break;
      let newEndMs = dragState.originalEndMs + deltaMs;
      newEndMs = snapToNearestEdge(
        newEndMs,
        project,
        dragState.blockId,
        snapThreshold
      );
      newEndMs = Math.max(dragState.originalStartMs + 10, newEndMs);
      store.resizeBlock(
        dragState.blockId,
        dragState.originalStartMs,
        newEndMs
      );
      break;
    }
  }
}

export function handleMouseUp(
  _e: MouseEvent,
  canvas: HTMLCanvasElement,
  _dragState: DragState
): DragState {
  canvas.style.cursor = "default";
  return createInitialDragState();
}

export function handleWheel(
  e: WheelEvent,
  _canvas: HTMLCanvasElement,
  project: Project,
  store: StoreActions
): void {
  e.preventDefault();

  const { zoom, scroll_x: scrollX } = project.timeline;

  if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    // Horizontal pan
    const delta = e.shiftKey ? e.deltaY : e.deltaX;
    store.setScrollX(scrollX + delta);
  } else if (e.ctrlKey || e.metaKey) {
    // Pinch zoom (trackpad)
    const factor = 1 - e.deltaY * 0.01;
    store.setZoom(zoom * factor);
  } else {
    // Scroll = pan
    store.setScrollX(scrollX + e.deltaY);
  }
}
