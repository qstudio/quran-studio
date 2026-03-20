import React from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useAppStore } from "@/stores/appStore";
import { preloadedPageImages } from "@/components/ProjectLibrary/NewProjectDialog";
import { currentPlayheadMs } from "@/stores/playheadSync";
import type { Block, HighlightBlockData } from "@/types/project";

// ─── Highlight logic ported from rollingquran/backend/app/services/renderer.py ───

const PAD_X = 10;
const PAD_Y = 6;
const GAP_TOLERANCE_MS = 500;

interface WordBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Binary search to find the active highlight blocks at a given timestamp.
 * Mirrors rollingquran's _get_active_words() using bisect_right logic.
 * Returns all highlight blocks that share the same time range (ayah-level grouping).
 */
function getActiveHighlights(
  blocks: Block[],
  timestampMs: number
): HighlightBlockData[] {
  if (blocks.length === 0) return [];

  // Binary search: find rightmost block where start_ms <= timestampMs
  let lo = 0;
  let hi = blocks.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (blocks[mid].start_ms <= timestampMs) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const idx = lo - 1;
  if (idx < 0) return [];

  const ref = blocks[idx];
  if (ref.data.type !== "highlight") return [];

  // Check if we're within this word's time range
  if (timestampMs > ref.end_ms) {
    // In a gap — check if next word starts soon (500ms tolerance like rollingquran)
    const nextIdx = idx + 1;
    if (nextIdx < blocks.length && blocks[nextIdx].start_ms - timestampMs < GAP_TOLERANCE_MS) {
      // Keep current highlight visible during gap
    } else {
      return [];
    }
  }

  // Collect all blocks with the same start/end time (ayah-level grouping)
  const active: HighlightBlockData[] = [ref.data as HighlightBlockData];

  // Look forward
  for (let i = idx + 1; i < blocks.length; i++) {
    if (blocks[i].start_ms === ref.start_ms && blocks[i].end_ms === ref.end_ms) {
      if (blocks[i].data.type === "highlight") active.push(blocks[i].data as HighlightBlockData);
    } else break;
  }
  // Look backward
  for (let i = idx - 1; i >= 0; i--) {
    if (blocks[i].start_ms === ref.start_ms && blocks[i].end_ms === ref.end_ms) {
      if (blocks[i].data.type === "highlight") active.unshift(blocks[i].data as HighlightBlockData);
    } else break;
  }

  return active;
}

/**
 * Convert fractional coordinates to pixel coordinates in the drawn area.
 * Mirrors rollingquran's _fractional_to_pixel().
 */
function fractionalToPixel(
  data: HighlightBlockData,
  drawX: number,
  drawY: number,
  drawW: number,
  drawH: number
): WordBBox {
  const fracX = data.x / 100000;
  const fracY = data.y / 100000;
  const fracW = data.width / 100000;
  const fracH = data.height / 100000;

  return {
    x: drawX + fracX * drawW,
    y: drawY + fracY * drawH,
    width: fracW * drawW,
    height: fracH * drawH,
  };
}

/**
 * Merge word bounding boxes into line-level boxes.
 * Mirrors rollingquran's _merge_bboxes() — groups by Y center snapped to 20px grid.
 */
function mergeBboxes(bboxes: WordBBox[]): WordBBox[] {
  if (bboxes.length <= 1) return bboxes;

  const lines: Map<number, WordBBox[]> = new Map();
  for (const b of bboxes) {
    const yCenter = b.y + b.height / 2;
    const lineKey = Math.floor(yCenter / 20);
    if (!lines.has(lineKey)) lines.set(lineKey, []);
    lines.get(lineKey)!.push(b);
  }

  const merged: WordBBox[] = [];
  for (const lineBboxes of lines.values()) {
    const minX = Math.min(...lineBboxes.map((b) => b.x));
    const minY = Math.min(...lineBboxes.map((b) => b.y));
    const maxX = Math.max(...lineBboxes.map((b) => b.x + b.width));
    const maxY = Math.max(...lineBboxes.map((b) => b.y + b.height));
    merged.push({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  }

  return merged;
}

/**
 * Draw golden glow highlights matching rollingquran's _draw_golden_glow().
 * fill=(255,215,0,140/255≈0.55), outline darker, radius=6, width=3
 */
function drawHighlights(
  ctx: CanvasRenderingContext2D,
  bboxes: WordBBox[],
  color: string,
  opacity: number
) {
  ctx.save();
  for (const bbox of bboxes) {
    const x = bbox.x - PAD_X;
    const y = bbox.y - PAD_Y;
    const w = bbox.width + PAD_X * 2;
    const h = bbox.height + PAD_Y * 2;
    const radius = 6;

    // Fill
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();

    // Outline (darker)
    ctx.globalAlpha = Math.min(opacity + 0.3, 1.0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.stroke();
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
    // The render loop reads project from getState() inside the loop,
    // so we don't depend on the project React state (which changes 60fps during playback)

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
          ch = rect.height;
          cw = rect.height * targetRatio;
        } else {
          cw = rect.width;
          ch = rect.width / targetRatio;
        }
        const rw = Math.round(cw);
        const rh = Math.round(ch);
        if (canvas.width !== rw || canvas.height !== rh) {
          canvas.width = rw;
          canvas.height = rh;
          canvas.style.width = `${rw}px`;
          canvas.style.height = `${rh}px`;
        }
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      // During playback: use shared mutable ref for frame-accurate sync
      // When paused: use store value (updated by scrubbing, seeking, etc.)
      const isPlaying = useTimelineStore.getState().isPlaying;
      const timestampMs = isPlaying ? currentPlayheadMs : currentProject.timeline.playhead_ms;

      // Clear
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, w, h);

      // Find active mushaf page
      const mushafTrack = currentProject.timeline.tracks.find((t) => t.track_type === "mushaf_page");
      const highlightTrack = currentProject.timeline.tracks.find((t) => t.track_type === "highlight");

      let activePage: number | null = null;
      if (mushafTrack) {
        // Binary search for active page block
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

      // Get active highlight words (with grouping, gap tolerance, merging)
      let mergedBboxes: WordBBox[] = [];
      let highlightColor = "#FFD700";
      let highlightOpacity = 0.55; // 140/255 ≈ 0.55 matching rollingquran
      let activeInfo: { surah: number; ayah: number; word_position: number; text: string } | null = null;

      if (highlightTrack && activePage !== null) {
        const activeHighlights = getActiveHighlights(highlightTrack.blocks, timestampMs);

        if (activeHighlights.length > 0) {
          activeInfo = {
            surah: activeHighlights[0].surah,
            ayah: activeHighlights[0].ayah,
            word_position: activeHighlights[0].word_position,
            text: activeHighlights[0].text_uthmani,
          };
          highlightColor = activeHighlights[0].style.color;
          highlightOpacity = activeHighlights[0].style.opacity;
        }

        // We need drawX/drawY/drawW/drawH to convert fractional to pixel
        // Compute them from the page image (same as drawMushafPage)
        const img = preloadedPageImages.get(activePage);
        if (img && activeHighlights.length > 0) {
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

          // Convert fractional coords to pixel coords
          const wordBboxes = activeHighlights.map((hl) =>
            fractionalToPixel(hl, drawX, drawY, drawW, drawH)
          );

          // Merge per-word boxes into per-line boxes (like rollingquran)
          mergedBboxes = mergeBboxes(wordBboxes);
        }
      }

      // Draw mushaf page
      if (activePage !== null) {
        const img = preloadedPageImages.get(activePage);
        if (img) {
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

          // Cream background behind page
          ctx.fillStyle = "#F5EFE3";
          ctx.fillRect(drawX, drawY, drawW, drawH);

          // Draw page image
          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          // Draw merged highlight boxes
          if (mergedBboxes.length > 0) {
            drawHighlights(ctx, mergedBboxes, highlightColor, highlightOpacity);
          }

          // Info text
          if (activeInfo) {
            ctx.font = `${Math.round(w * 0.022)}px "Inter", sans-serif`;
            ctx.fillStyle = "#D4A944";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(
              `${activeInfo.surah}:${activeInfo.ayah} w${activeInfo.word_position}`,
              w / 2,
              h - 8
            );
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
  }, [aspectRatio]); // Only restart loop when aspect ratio changes, NOT on playhead updates

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center w-full h-full bg-black"
    >
      <canvas ref={canvasRef} className="bg-black" />
    </div>
  );
}
