import React from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useAppStore } from "@/stores/appStore";
import { getPageImage } from "@/lib/preloadProject";
import { currentPlayheadMs } from "@/stores/playheadSync";
import type { Block, HighlightBlockData, HighlightMode } from "@/types/project";

// ─── Highlight logic ───

const GAP_TOLERANCE_MS = 500;

interface WordBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function findActiveWordIndex(blocks: Block[], timestampMs: number): number {
  if (blocks.length === 0) return -1;
  let lo = 0;
  let hi = blocks.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (blocks[mid].start_ms <= timestampMs) lo = mid + 1;
    else hi = mid;
  }
  const idx = lo - 1;
  if (idx < 0) return -1;
  if (blocks[idx].data.type !== "highlight") return -1;
  if (timestampMs > blocks[idx].end_ms) {
    const nextIdx = idx + 1;
    if (nextIdx < blocks.length && blocks[nextIdx].start_ms - timestampMs < GAP_TOLERANCE_MS) {
      return idx;
    }
    return -1;
  }
  return idx;
}

function getAyahBlocks(blocks: Block[], surah: number, ayah: number): HighlightBlockData[] {
  const result: HighlightBlockData[] = [];
  for (const block of blocks) {
    if (block.data.type !== "highlight") continue;
    const data = block.data as HighlightBlockData;
    if (data.surah === surah && data.ayah === ayah) result.push(data);
  }
  return result;
}

function fractionalToPixel(
  data: HighlightBlockData,
  drawX: number, drawY: number, drawW: number, drawH: number
): WordBBox {
  return {
    x: drawX + (data.x / 100000) * drawW,
    y: drawY + (data.y / 100000) * drawH,
    width: (data.width / 100000) * drawW,
    height: (data.height / 100000) * drawH,
  };
}

function mergeBboxes(bboxes: WordBBox[]): WordBBox[] {
  if (bboxes.length <= 1) return bboxes;
  const lines: Map<number, WordBBox[]> = new Map();
  for (const b of bboxes) {
    const lineKey = Math.floor((b.y + b.height / 2) / 20);
    if (!lines.has(lineKey)) lines.set(lineKey, []);
    lines.get(lineKey)!.push(b);
  }
  const merged: WordBBox[] = [];
  for (const lineBboxes of lines.values()) {
    merged.push({
      x: Math.min(...lineBboxes.map((b) => b.x)),
      y: Math.min(...lineBboxes.map((b) => b.y)),
      width: Math.max(...lineBboxes.map((b) => b.x + b.width)) - Math.min(...lineBboxes.map((b) => b.x)),
      height: Math.max(...lineBboxes.map((b) => b.y + b.height)) - Math.min(...lineBboxes.map((b) => b.y)),
    });
  }
  return merged;
}

/**
 * Draw highlight boxes with improved visual quality.
 * Uses shadow blur for soft glow effect instead of hard outlines.
 */
function drawHighlightBoxes(
  ctx: CanvasRenderingContext2D,
  bboxes: WordBBox[],
  color: string,
  opacity: number,
  padding: number,
  shape: "rectangle" | "underline"
) {
  ctx.save();
  for (const bbox of bboxes) {
    if (shape === "underline") {
      const x1 = bbox.x - padding;
      const x2 = bbox.x + bbox.width + padding;
      const y = bbox.y + bbox.height + 3;

      // Soft glow under the line
      ctx.globalAlpha = opacity * 0.4;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      // Crisp line on top
      ctx.shadowBlur = 0;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    } else {
      const x = bbox.x - padding;
      const y = bbox.y - padding;
      const w = bbox.width + padding * 2;
      const h = bbox.height + padding * 2;
      const radius = 6;

      // Outer glow (soft shadow)
      ctx.globalAlpha = opacity * 0.3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();

      // Main fill (no shadow)
      ctx.shadowBlur = 0;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();

      // Subtle inner border (slightly brighter)
      ctx.globalAlpha = Math.min(opacity * 0.6, 0.4);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, radius);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ─── PreviewPanel Component ───

export function PreviewPanel() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const rafIdRef = React.useRef<number>(0);
  const aspectRatio = useAppStore((s) => s.aspectRatio);

  React.useEffect(() => {
    const getAspectDims = () => {
      const ratio = useAppStore.getState().aspectRatio;
      switch (ratio) {
        case "9:16": return { w: 9, h: 16 };
        case "16:9": return { w: 16, h: 9 };
        case "1:1": return { w: 1, h: 1 };
      }
    };

    const renderLoop = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) {
        rafIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const state = useTimelineStore.getState();
      const currentProject = state.project;
      if (!currentProject) {
        rafIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      // Read display settings from app store
      const appState = useAppStore.getState();
      const bgColor = appState.backgroundColor;
      const margin = appState.pageMargin;
      const mushafStyle = appState.mushafStyle;
      const showInfoText = appState.showInfo;

      // Resize canvas
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const { w: aw, h: ah } = getAspectDims();
        const targetRatio = aw / ah;
        const containerRatio = rect.width / rect.height;
        let cw: number, ch: number;
        if (containerRatio > targetRatio) {
          ch = rect.height; cw = rect.height * targetRatio;
        } else {
          cw = rect.width; ch = rect.width / targetRatio;
        }
        const rw = Math.round(cw);
        const rh = Math.round(ch);
        if (canvas.width !== rw || canvas.height !== rh) {
          canvas.width = rw; canvas.height = rh;
          canvas.style.width = `${rw}px`; canvas.style.height = `${rh}px`;
        }
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) { rafIdRef.current = requestAnimationFrame(renderLoop); return; }

      const w = canvas.width;
      const h = canvas.height;
      const isPlaying = state.isPlaying;
      const timestampMs = isPlaying ? currentPlayheadMs : currentProject.timeline.playhead_ms;

      // Clear with user-selected background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      // Find active page
      const mushafTrack = currentProject.timeline.tracks.find((t) => t.track_type === "mushaf_page");
      const highlightTrack = currentProject.timeline.tracks.find((t) => t.track_type === "highlight");

      let activePage: number | null = null;
      if (mushafTrack) {
        const blocks = mushafTrack.blocks;
        let lo = 0, hi = blocks.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (blocks[mid].start_ms <= timestampMs) lo = mid + 1;
          else hi = mid;
        }
        const idx = lo - 1;
        if (idx >= 0 && blocks[idx].data.type === "mushaf_page") {
          activePage = (blocks[idx].data as { page: number }).page;
        }
      }

      if (activePage !== null) {
        const img = getPageImage(activePage, mushafStyle);
        if (img) {
          // Compute draw area with margin
          const imgAspect = img.width / img.height;
          const availW = w - margin * 2;
          const availH = h - margin * 2;
          const availAspect = availW / availH;

          let drawW: number, drawH: number, drawX: number, drawY: number;
          if (availAspect > imgAspect) {
            drawH = availH; drawW = availH * imgAspect;
            drawX = (w - drawW) / 2; drawY = margin;
          } else {
            drawW = availW; drawH = availW / imgAspect;
            drawX = margin; drawY = (h - drawH) / 2;
          }

          // Cream background behind the page image (for transparent PNGs)
          ctx.fillStyle = "#F5EFE3";
          ctx.fillRect(drawX, drawY, drawW, drawH);

          // Draw mushaf page
          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          // Draw highlights
          if (highlightTrack) {
            const activeIdx = findActiveWordIndex(highlightTrack.blocks, timestampMs);

            if (activeIdx >= 0) {
              const activeBlock = highlightTrack.blocks[activeIdx];
              const activeData = activeBlock.data as HighlightBlockData;
              const style = activeData.style;
              const mode: HighlightMode = style.mode ?? "word";
              const shape = (style.highlight_type === "underline") ? "underline" as const : "rectangle" as const;
              const padding = style.padding ?? 6;

              if (mode === "word") {
                const bbox = fractionalToPixel(activeData, drawX, drawY, drawW, drawH);
                drawHighlightBoxes(ctx, [bbox], style.color, style.opacity, padding, shape);
              } else if (mode === "ayah") {
                const ayahBlocks = getAyahBlocks(highlightTrack.blocks, activeData.surah, activeData.ayah);
                const ayahBboxes = ayahBlocks.map((d) => fractionalToPixel(d, drawX, drawY, drawW, drawH));
                const merged = mergeBboxes(ayahBboxes);
                drawHighlightBoxes(ctx, merged, style.color, style.opacity, padding, shape);
              } else if (mode === "word_and_ayah") {
                const ayahBlocks = getAyahBlocks(highlightTrack.blocks, activeData.surah, activeData.ayah);
                const ayahBboxes = ayahBlocks.map((d) => fractionalToPixel(d, drawX, drawY, drawW, drawH));
                const merged = mergeBboxes(ayahBboxes);
                // Dim ayah
                drawHighlightBoxes(ctx, merged, style.color, style.opacity * 0.3, padding, shape);
                // Bright word
                const wordBbox = fractionalToPixel(activeData, drawX, drawY, drawW, drawH);
                drawHighlightBoxes(ctx, [wordBbox], style.color, style.opacity, padding, shape);
              }

              // Info text
              if (showInfoText) {
                ctx.save();
                ctx.font = `${Math.round(w * 0.022)}px "Inter", sans-serif`;
                ctx.fillStyle = style.color;
                ctx.globalAlpha = 0.7;
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                ctx.fillText(
                  `${activeData.surah}:${activeData.ayah} w${activeData.word_position}`,
                  w / 2, h - 8
                );
                ctx.restore();
              }
            }
          }
        } else {
          // Placeholder when image not loaded
          ctx.fillStyle = "#1A1A1A";
          ctx.fillRect(0, 0, w, h);
          ctx.font = `${Math.round(w * 0.04)}px "Inter", sans-serif`;
          ctx.fillStyle = "#5C5C5C";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`Page ${activePage}`, w / 2, h / 2);
        }
      }

      rafIdRef.current = requestAnimationFrame(renderLoop);
    };

    rafIdRef.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [aspectRatio]);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center w-full h-full bg-black"
    >
      <canvas ref={canvasRef} className="bg-black" />
    </div>
  );
}
