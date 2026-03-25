import { useRef, useEffect, useCallback } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import type { Block, Track } from "@/types/project";
import {
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleWheel,
  createInitialDragState,
} from "./TimelineInteraction";
import type { DragState } from "./TimelineInteraction";
import { msToX, formatTime } from "./utils";
import {
  TRACK_HEADER_WIDTH,
  TRACK_HEIGHT,
  TIME_RULER_HEIGHT,
  PLAYHEAD_COLOR,
  SELECTION_COLOR,
  SELECTION_OVERLAY_ALPHA,
  BLOCK_BORDER_RADIUS,
  PLAYHEAD_TRIANGLE_SIZE,
  FONT_LABEL,
  FONT_TIME,
  FONT_BLOCK_LABEL,
  COLOR_BG,
  COLOR_TRACK_HEADER_BG,
  COLOR_TRACK_BORDER,
  COLOR_LABEL,
  COLOR_TIME_TEXT,
  COLOR_BLOCK_BG,
  COLOR_BLOCK_BORDER,
  COLOR_HIGHLIGHT_GOLD,
  COLOR_HIGHLIGHT_ALPHA,
  COLOR_AYAH_MARKER,
  COLOR_SELECTED_BORDER,
  COLOR_TEXT_ARABIC_BG,
  COLOR_TEXT_TRANSLATION_BG,
  COLOR_BACKGROUND_BG,
  COLOR_CARD_BG,
  COLOR_VIDEO_BG,
} from "./constants";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderTimeRuler(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  zoom: number,
  scrollX: number,
  durationMs: number
): void {
  ctx.fillStyle = COLOR_TRACK_HEADER_BG;
  ctx.fillRect(0, 0, canvasWidth, TIME_RULER_HEIGHT);

  // Draw bottom border
  ctx.strokeStyle = COLOR_TRACK_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, TIME_RULER_HEIGHT - 0.5);
  ctx.lineTo(canvasWidth, TIME_RULER_HEIGHT - 0.5);
  ctx.stroke();

  // Determine tick interval based on zoom
  // At zoom=1, 1 second = 1px. We want ticks ~80px apart.
  const pxPerMs = zoom / 1000;
  const targetTickPx = 80;
  const rawIntervalMs = targetTickPx / pxPerMs;

  // Snap to nice intervals
  const niceIntervals = [
    100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000,
    300000, 600000,
  ];
  let intervalMs = niceIntervals[niceIntervals.length - 1];
  for (const ni of niceIntervals) {
    if (ni >= rawIntervalMs) {
      intervalMs = ni;
      break;
    }
  }

  ctx.font = FONT_TIME;
  ctx.fillStyle = COLOR_TIME_TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  const startMs = Math.max(
    0,
    Math.floor(((scrollX) * 1000) / zoom / intervalMs) * intervalMs
  );
  const endMs = Math.min(
    durationMs,
    Math.ceil(((scrollX + canvasWidth) * 1000) / zoom / intervalMs) *
      intervalMs +
      intervalMs
  );

  for (let ms = startMs; ms <= endMs; ms += intervalMs) {
    const x = msToX(ms, zoom, scrollX);
    if (x < TRACK_HEADER_WIDTH || x > canvasWidth) continue;

    // Major tick
    ctx.strokeStyle = COLOR_TRACK_BORDER;
    ctx.beginPath();
    ctx.moveTo(x, TIME_RULER_HEIGHT - 6);
    ctx.lineTo(x, TIME_RULER_HEIGHT);
    ctx.stroke();

    // Label
    ctx.fillText(formatTime(ms), x, TIME_RULER_HEIGHT - 7);

    // Minor ticks (subdivisions)
    const subInterval = intervalMs / 4;
    for (let j = 1; j < 4; j++) {
      const subMs = ms + j * subInterval;
      const subX = msToX(subMs, zoom, scrollX);
      if (subX < TRACK_HEADER_WIDTH || subX > canvasWidth) continue;
      ctx.beginPath();
      ctx.moveTo(subX, TIME_RULER_HEIGHT - 3);
      ctx.lineTo(subX, TIME_RULER_HEIGHT);
      ctx.stroke();
    }
  }

  // Header area background
  ctx.fillStyle = COLOR_TRACK_HEADER_BG;
  ctx.fillRect(0, 0, TRACK_HEADER_WIDTH, TIME_RULER_HEIGHT);
}

function renderTrackHeaders(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  canvasHeight: number
): void {
  ctx.fillStyle = COLOR_TRACK_HEADER_BG;
  ctx.fillRect(
    0,
    TIME_RULER_HEIGHT,
    TRACK_HEADER_WIDTH,
    canvasHeight - TIME_RULER_HEIGHT
  );

  // Vertical divider
  ctx.strokeStyle = COLOR_TRACK_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TRACK_HEADER_WIDTH - 0.5, TIME_RULER_HEIGHT);
  ctx.lineTo(TRACK_HEADER_WIDTH - 0.5, canvasHeight);
  ctx.stroke();

  ctx.font = FONT_LABEL;
  ctx.fillStyle = COLOR_LABEL;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (let i = 0; i < tracks.length; i++) {
    const y = TIME_RULER_HEIGHT + i * TRACK_HEIGHT;

    // Track border bottom
    ctx.strokeStyle = COLOR_TRACK_BORDER;
    ctx.beginPath();
    ctx.moveTo(0, y + TRACK_HEIGHT - 0.5);
    ctx.lineTo(TRACK_HEADER_WIDTH, y + TRACK_HEIGHT - 0.5);
    ctx.stroke();

    // Label
    ctx.fillStyle = COLOR_LABEL;
    const label = tracks[i].name;
    const maxWidth = TRACK_HEADER_WIDTH - 16;
    let displayLabel = label;
    if (ctx.measureText(label).width > maxWidth) {
      while (
        displayLabel.length > 0 &&
        ctx.measureText(displayLabel + "...").width > maxWidth
      ) {
        displayLabel = displayLabel.slice(0, -1);
      }
      displayLabel += "...";
    }
    ctx.fillText(displayLabel, 8, y + TRACK_HEIGHT / 2);
  }
}

function renderTrackLanes(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  canvasWidth: number
): void {
  for (let i = 0; i < tracks.length; i++) {
    const y = TIME_RULER_HEIGHT + i * TRACK_HEIGHT;

    // Lane border
    ctx.strokeStyle = COLOR_TRACK_BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(TRACK_HEADER_WIDTH, y + TRACK_HEIGHT - 0.5);
    ctx.lineTo(canvasWidth, y + TRACK_HEIGHT - 0.5);
    ctx.stroke();
  }
}

function renderBlock(
  ctx: CanvasRenderingContext2D,
  block: Block,
  trackIndex: number,
  zoom: number,
  scrollX: number,
  canvasWidth: number,
  isSelected: boolean,
  _playheadX: number
): void {
  const startX = msToX(block.start_ms, zoom, scrollX);
  const endX = msToX(block.end_ms, zoom, scrollX);

  // Frustum culling
  if (endX < TRACK_HEADER_WIDTH || startX > canvasWidth) return;

  const visibleStartX = Math.max(startX, TRACK_HEADER_WIDTH);
  const visibleEndX = Math.min(endX, canvasWidth);
  const y = TIME_RULER_HEIGHT + trackIndex * TRACK_HEIGHT + 2;
  const h = TRACK_HEIGHT - 4;
  const w = visibleEndX - visibleStartX;

  if (w < 1) return;

  const blockType = block.data.type;

  switch (blockType) {
    case "audio": {
      // Audio block with waveform
      roundRect(ctx, visibleStartX, y, w, h, BLOCK_BORDER_RADIUS);
      ctx.fillStyle = COLOR_BLOCK_BG;
      ctx.fill();
      ctx.strokeStyle = isSelected ? COLOR_SELECTED_BORDER : COLOR_BLOCK_BORDER;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.stroke();

      // Render waveform
      // Waveform rendering placeholder (no waveform data in current types)

      break;
    }

    case "mushaf_page": {
      roundRect(ctx, visibleStartX, y, w, h, BLOCK_BORDER_RADIUS);
      ctx.fillStyle = COLOR_BLOCK_BG;
      ctx.fill();
      ctx.strokeStyle = isSelected ? COLOR_SELECTED_BORDER : COLOR_BLOCK_BORDER;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.stroke();

      // Page label
      if (w > 30 && block.data.type === "mushaf_page") {
        ctx.save();
        roundRect(ctx, visibleStartX, y, w, h, BLOCK_BORDER_RADIUS);
        ctx.clip();
        ctx.font = FONT_BLOCK_LABEL;
        ctx.fillStyle = COLOR_LABEL;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(
          `P.${block.data.page}`,
          visibleStartX + 6,
          y + h / 2
        );
        ctx.restore();
      }
      break;
    }

    case "highlight": {
      ctx.globalAlpha = COLOR_HIGHLIGHT_ALPHA;
      ctx.fillStyle = COLOR_HIGHLIGHT_GOLD;
      ctx.fillRect(visibleStartX, y, w, h);
      ctx.globalAlpha = 1;

      if (isSelected) {
        ctx.strokeStyle = COLOR_SELECTED_BORDER;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(visibleStartX, y, w, h);
      }
      break;
    }

    case "text_arabic": {
      roundRect(ctx, visibleStartX, y, w, h, BLOCK_BORDER_RADIUS);
      ctx.fillStyle = COLOR_TEXT_ARABIC_BG;
      ctx.fill();
      ctx.strokeStyle = isSelected ? COLOR_SELECTED_BORDER : COLOR_BLOCK_BORDER;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.stroke();

      if (w > 30 && block.data.type === "text_arabic") {
        ctx.save();
        roundRect(ctx, visibleStartX, y, w, h, BLOCK_BORDER_RADIUS);
        ctx.clip();
        ctx.font = FONT_BLOCK_LABEL;
        ctx.fillStyle = COLOR_LABEL;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(
          (block.data as import("@/types/project").TextBlockData).text.slice(0, 20),
          visibleStartX + 6,
          y + h / 2
        );
        ctx.restore();
      }
      break;
    }

    case "text_translation": {
      roundRect(ctx, visibleStartX, y, w, h, BLOCK_BORDER_RADIUS);
      ctx.fillStyle = COLOR_TEXT_TRANSLATION_BG;
      ctx.fill();
      ctx.strokeStyle = isSelected ? COLOR_SELECTED_BORDER : COLOR_BLOCK_BORDER;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.stroke();

      if (w > 30 && block.data.type === "text_translation") {
        ctx.save();
        roundRect(ctx, visibleStartX, y, w, h, BLOCK_BORDER_RADIUS);
        ctx.clip();
        ctx.font = FONT_BLOCK_LABEL;
        ctx.fillStyle = COLOR_LABEL;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(
          (block.data as import("@/types/project").TextBlockData).text.slice(0, 20),
          visibleStartX + 6,
          y + h / 2
        );
        ctx.restore();
      }
      break;
    }

    case "background": {
      roundRect(ctx, visibleStartX, y, w, h, BLOCK_BORDER_RADIUS);
      ctx.fillStyle = COLOR_BACKGROUND_BG;
      ctx.fill();
      ctx.strokeStyle = isSelected ? COLOR_SELECTED_BORDER : COLOR_BLOCK_BORDER;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.stroke();
      break;
    }

    case "card": {
      roundRect(ctx, visibleStartX, y, w, h, BLOCK_BORDER_RADIUS);
      ctx.fillStyle = COLOR_CARD_BG;
      ctx.fill();
      ctx.strokeStyle = isSelected ? COLOR_SELECTED_BORDER : COLOR_BLOCK_BORDER;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.stroke();

      if (w > 30 && block.data.type === "card") {
        ctx.save();
        roundRect(ctx, visibleStartX, y, w, h, BLOCK_BORDER_RADIUS);
        ctx.clip();
        ctx.font = FONT_BLOCK_LABEL;
        ctx.fillStyle = COLOR_LABEL;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(
          (block.data as import("@/types/project").CardBlockData).text.slice(0, 20),
          visibleStartX + 6,
          y + h / 2
        );
        ctx.restore();
      }
      break;
    }

    case "video": {
      roundRect(ctx, visibleStartX, y, w, h, BLOCK_BORDER_RADIUS);
      ctx.fillStyle = COLOR_VIDEO_BG;
      ctx.fill();
      ctx.strokeStyle = isSelected ? COLOR_SELECTED_BORDER : COLOR_BLOCK_BORDER;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.stroke();
      break;
    }
  }

  // Render resize handles for selected blocks
  if (isSelected && w > 12) {
    ctx.fillStyle = COLOR_SELECTED_BORDER;

    // Left handle
    const handleW = 3;
    const handleH = h * 0.5;
    const handleY = y + (h - handleH) / 2;
    ctx.fillRect(visibleStartX + 2, handleY, handleW, handleH);

    // Right handle
    ctx.fillRect(visibleEndX - handleW - 2, handleY, handleW, handleH);
  }
}

function renderAyahMarkers(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  zoom: number,
  scrollX: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  // Only render ayah markers when zoomed in enough (at least 2px per 100ms)
  if (zoom < 20) return;

  const highlightTrack = tracks.find((t) => t.track_type === "highlight");
  if (!highlightTrack) return;

  // Find ayah boundaries from highlight blocks
  const ayahStarts = new Set<number>();
  let prevAyah = -1;
  for (const block of highlightTrack.blocks) {
    if (block.data.type === "highlight") {
      const ayahKey = (block.data as import("@/types/project").HighlightBlockData).surah * 1000 + (block.data as import("@/types/project").HighlightBlockData).ayah;
      if (ayahKey !== prevAyah) {
        ayahStarts.add(block.start_ms);
        prevAyah = ayahKey;
      }
    }
  }

  ctx.strokeStyle = COLOR_AYAH_MARKER;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (const ms of ayahStarts) {
    const x = msToX(ms, zoom, scrollX);
    if (x < TRACK_HEADER_WIDTH || x > canvasWidth) continue;

    ctx.beginPath();
    ctx.moveTo(x, TIME_RULER_HEIGHT);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

function renderPlayhead(
  ctx: CanvasRenderingContext2D,
  playheadMs: number,
  zoom: number,
  scrollX: number,
  canvasHeight: number
): number {
  const x = msToX(playheadMs, zoom, scrollX);
  if (x < TRACK_HEADER_WIDTH) return x;

  // Playhead line
  ctx.strokeStyle = PLAYHEAD_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, TIME_RULER_HEIGHT);
  ctx.lineTo(x, canvasHeight);
  ctx.stroke();

  // Triangle at top
  ctx.fillStyle = PLAYHEAD_COLOR;
  ctx.beginPath();
  ctx.moveTo(x, TIME_RULER_HEIGHT);
  ctx.lineTo(x - PLAYHEAD_TRIANGLE_SIZE / 2, TIME_RULER_HEIGHT - PLAYHEAD_TRIANGLE_SIZE);
  ctx.lineTo(x + PLAYHEAD_TRIANGLE_SIZE / 2, TIME_RULER_HEIGHT - PLAYHEAD_TRIANGLE_SIZE);
  ctx.closePath();
  ctx.fill();

  return x;
}

export default function TimelineCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState>(createInitialDragState());
  const animFrameRef = useRef<number>(0);

  const project = useTimelineStore((s) => s.project);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const selectBlock = useTimelineStore((s) => s.selectBlock);
  const clearSelection = useTimelineStore((s) => s.clearSelection);
  const moveBlock = useTimelineStore((s) => s.moveBlock);
  const resizeBlock = useTimelineStore((s) => s.resizeBlock);
  const setZoom = useTimelineStore((s) => s.setZoom);
  const setScrollX = useTimelineStore((s) => s.setScrollX);

  const storeActions = useRef({
    setPlayhead,
    selectBlock,
    clearSelection,
    moveBlock,
    resizeBlock,
    setZoom,
    setScrollX,
  });

  // Keep storeActions ref up to date
  storeActions.current = {
    setPlayhead,
    selectBlock,
    clearSelection,
    moveBlock,
    resizeBlock,
    setZoom,
    setScrollX,
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const currentProject = useTimelineStore.getState().project;
    const currentSelectedIds = useTimelineStore.getState().selectedBlockIds;

    if (!currentProject) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Resize canvas if needed
    if (
      canvas.width !== Math.floor(width * dpr) ||
      canvas.height !== Math.floor(height * dpr)
    ) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    const { timeline } = currentProject;
    const { tracks, zoom, scroll_x: scrollX, playhead_ms: playheadMs, duration_ms: durationMs } = timeline;

    // 1. Background
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, width, height);

    // 2. Track headers
    renderTrackHeaders(ctx, tracks, height);

    // 3. Track lanes
    renderTrackLanes(ctx, tracks, width);

    // 4. Blocks
    const selectedSet = new Set(currentSelectedIds);
    const playheadX = msToX(playheadMs, zoom, scrollX);

    for (let ti = 0; ti < tracks.length; ti++) {
      const track = tracks[ti];
      if (!track.visible) continue;

      for (const block of track.blocks) {
        renderBlock(
          ctx,
          block,
          ti,
          zoom,
          scrollX,
          width,
          selectedSet.has(block.id),
          playheadX
        );
      }
    }

    // 5. Ayah markers
    renderAyahMarkers(ctx, tracks, zoom, scrollX, width, height);

    // 6. Selection overlay for selected blocks
    for (let ti = 0; ti < tracks.length; ti++) {
      const track = tracks[ti];
      for (const block of track.blocks) {
        if (!selectedSet.has(block.id)) continue;
        const startX = msToX(block.start_ms, zoom, scrollX);
        const endX = msToX(block.end_ms, zoom, scrollX);
        if (endX < TRACK_HEADER_WIDTH || startX > width) continue;

        const visStartX = Math.max(startX, TRACK_HEADER_WIDTH);
        const visEndX = Math.min(endX, width);
        const by = TIME_RULER_HEIGHT + ti * TRACK_HEIGHT + 2;
        const bh = TRACK_HEIGHT - 4;

        ctx.fillStyle = SELECTION_COLOR;
        ctx.globalAlpha = SELECTION_OVERLAY_ALPHA;
        ctx.fillRect(visStartX, by, visEndX - visStartX, bh);
        ctx.globalAlpha = 1;
      }
    }

    // 7. Playhead
    renderPlayhead(ctx, playheadMs, zoom, scrollX, height);

    // 8. Time ruler (drawn last to sit on top)
    renderTimeRuler(ctx, width, zoom, scrollX, durationMs);

    ctx.restore();

    animFrameRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      const currentProject = useTimelineStore.getState().project;
      const currentSelectedIds = useTimelineStore.getState().selectedBlockIds;
      if (!currentProject) return;
      dragStateRef.current = handleMouseDown(
        e,
        canvas,
        currentProject,
        storeActions.current,
        currentSelectedIds
      );
    };

    const onMouseMove = (e: MouseEvent) => {
      const currentProject = useTimelineStore.getState().project;
      if (!currentProject) return;
      handleMouseMove(
        e,
        canvas,
        currentProject,
        storeActions.current,
        dragStateRef.current
      );
    };

    const onMouseUp = (e: MouseEvent) => {
      dragStateRef.current = handleMouseUp(e, canvas, dragStateRef.current);
    };

    const onWheel = (e: WheelEvent) => {
      const currentProject = useTimelineStore.getState().project;
      if (!currentProject) return;
      handleWheel(e, canvas, currentProject, storeActions.current);
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)]">
        No project loaded
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
      />
    </div>
  );
}
