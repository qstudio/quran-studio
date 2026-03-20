import React from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useAppStore } from "@/stores/appStore";
import { preloadedPageImages } from "@/lib/preloadProject";
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

/**
 * Binary search for the active word at a given timestamp.
 * Returns the index into blocks, or -1 if none.
 */
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

  const ref = blocks[idx];
  if (ref.data.type !== "highlight") return -1;

  // Check gap tolerance
  if (timestampMs > ref.end_ms) {
    const nextIdx = idx + 1;
    if (nextIdx < blocks.length && blocks[nextIdx].start_ms - timestampMs < GAP_TOLERANCE_MS) {
      return idx; // keep current during gap
    }
    return -1;
  }

  return idx;
}

/**
 * Get all highlight blocks for a given ayah number.
 */
function getAyahBlocks(blocks: Block[], surah: number, ayah: number): HighlightBlockData[] {
  const result: HighlightBlockData[] = [];
  for (const block of blocks) {
    if (block.data.type !== "highlight") continue;
    const data = block.data as HighlightBlockData;
    if (data.surah === surah && data.ayah === ayah) {
      result.push(data);
    }
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
      const y = bbox.y + bbox.height + 4;
      ctx.globalAlpha = Math.min(opacity + 0.3, 1.0);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
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

      // Fill
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();

      // Outline
      ctx.globalAlpha = Math.min(opacity + 0.3, 1.0);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
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
      const isPlaying = useTimelineStore.getState().isPlaying;
      const timestampMs = isPlaying ? currentPlayheadMs : currentProject.timeline.playhead_ms;

      // Clear
      ctx.fillStyle = "#0A0A0A";
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

      // Draw mushaf page
      if (activePage !== null) {
        const img = preloadedPageImages.get(activePage);
        if (img) {
          // Compute draw dimensions
          const imgAspect = img.width / img.height;
          const canvasAspect = w / h;
          let drawW: number, drawH: number, drawX: number, drawY: number;
          if (canvasAspect > imgAspect) {
            drawH = h; drawW = h * imgAspect;
            drawX = (w - drawW) / 2; drawY = 0;
          } else {
            drawW = w; drawH = w / imgAspect;
            drawX = 0; drawY = (h - drawH) / 2;
          }

          // Cream background + page image
          ctx.fillStyle = "#F5EFE3";
          ctx.fillRect(drawX, drawY, drawW, drawH);
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
                // Single word highlight
                const bbox = fractionalToPixel(activeData, drawX, drawY, drawW, drawH);
                drawHighlightBoxes(ctx, [bbox], style.color, style.opacity, padding, shape);

              } else if (mode === "ayah") {
                // Full ayah highlight — all words in the current ayah
                const ayahBlocks = getAyahBlocks(highlightTrack.blocks, activeData.surah, activeData.ayah);
                const ayahBboxes = ayahBlocks.map((d) => fractionalToPixel(d, drawX, drawY, drawW, drawH));
                const merged = mergeBboxes(ayahBboxes);
                drawHighlightBoxes(ctx, merged, style.color, style.opacity, padding, shape);

              } else if (mode === "word_and_ayah") {
                // Dim ayah highlight + bright active word
                const ayahBlocks = getAyahBlocks(highlightTrack.blocks, activeData.surah, activeData.ayah);
                const ayahBboxes = ayahBlocks.map((d) => fractionalToPixel(d, drawX, drawY, drawW, drawH));
                const merged = mergeBboxes(ayahBboxes);

                // Draw ayah at reduced opacity
                drawHighlightBoxes(ctx, merged, style.color, style.opacity * 0.35, padding, shape);

                // Draw active word at full opacity
                const wordBbox = fractionalToPixel(activeData, drawX, drawY, drawW, drawH);
                drawHighlightBoxes(ctx, [wordBbox], style.color, style.opacity, padding, shape);
              }

              // Info text
              ctx.font = `${Math.round(w * 0.022)}px "Inter", sans-serif`;
              ctx.fillStyle = style.color;
              ctx.globalAlpha = 0.8;
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              ctx.fillText(
                `${activeData.surah}:${activeData.ayah} w${activeData.word_position}`,
                w / 2, h - 8
              );
              ctx.globalAlpha = 1;
            }
          }
        } else {
          // Placeholder
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
