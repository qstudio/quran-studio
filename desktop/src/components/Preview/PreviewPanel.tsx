import React from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useAppStore } from "@/stores/appStore";
import { getPageImage } from "@/lib/preloadProject";
import { currentPlayheadMs } from "@/stores/playheadSync";
import type { Block, Track, HighlightBlockData, HighlightMode, TextBlockData, CardBlockData } from "@/types/project";

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

// ─── Mode-specific rendering helpers ───

function findActiveBlockByType(tracks: Track[], trackType: string, ms: number): Block | null {
  for (const track of tracks) {
    if (track.track_type !== trackType || !track.visible) continue;
    for (const block of track.blocks) {
      if (ms >= block.start_ms && ms < block.end_ms) return block;
    }
  }
  return null;
}

function renderCaptionMode(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tracks: Track[],
  timestampMs: number
): void {
  // Dark background
  ctx.fillStyle = "#0A0A0A";
  ctx.fillRect(0, 0, w, h);

  // Find active Arabic text block
  const arabicBlock = findActiveBlockByType(tracks, "text_arabic", timestampMs);
  if (arabicBlock && arabicBlock.data.type === "text_arabic") {
    const data = arabicBlock.data as TextBlockData;
    const fontSize = Math.round(w * 0.06);
    ctx.save();
    ctx.font = `${fontSize}px "Amiri Quran", "Amiri", serif`;
    ctx.fillStyle = data.color || "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";
    ctx.fillText(data.text, w / 2, h * 0.42, w * 0.85);
    ctx.restore();
  }

  // Find active translation text block
  const translationBlock = findActiveBlockByType(tracks, "text_translation", timestampMs);
  if (translationBlock && translationBlock.data.type === "text_translation") {
    const data = translationBlock.data as TextBlockData;
    const fontSize = Math.round(w * 0.03);
    ctx.save();
    ctx.font = `${fontSize}px "Inter", sans-serif`;
    ctx.fillStyle = data.color || "#A0A0A0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.text, w / 2, h * 0.58, w * 0.85);
    ctx.restore();
  }
}

function renderReelMode(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tracks: Track[],
  timestampMs: number
): void {
  // Dark background
  ctx.fillStyle = "#0A0A0A";
  ctx.fillRect(0, 0, w, h);

  // Check for background block
  const bgBlock = findActiveBlockByType(tracks, "background", timestampMs);
  if (bgBlock && bgBlock.data.type === "background") {
    const bgData = bgBlock.data;
    if (bgData.color) {
      ctx.fillStyle = bgData.color;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // Find active Arabic text block
  const arabicBlock = findActiveBlockByType(tracks, "text_arabic", timestampMs);
  if (arabicBlock && arabicBlock.data.type === "text_arabic") {
    const data = arabicBlock.data as TextBlockData;
    const arabicText = data.text;
    const fontSize = Math.round(w * 0.06);

    // Find active highlight block to determine which word to highlight
    const hlBlock = findActiveBlockByType(tracks, "highlight", timestampMs);
    const highlightWord = hlBlock && hlBlock.data.type === "highlight"
      ? (hlBlock.data as HighlightBlockData).text_uthmani
      : null;

    ctx.save();
    ctx.font = `${fontSize}px "Amiri Quran", "Amiri", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";

    if (highlightWord && arabicText.includes(highlightWord)) {
      // Draw with highlighted word in gold
      const parts = arabicText.split(highlightWord);
      const fullWidth = ctx.measureText(arabicText).width;
      const startX = w / 2 + fullWidth / 2; // RTL start

      // Draw entire text in white first
      ctx.fillStyle = data.color || "#FFFFFF";
      ctx.fillText(arabicText, w / 2, h * 0.42, w * 0.85);

      // Overdraw the highlight word in gold
      // Measure positions to overlay just the highlighted word
      const beforeText = parts[0];
      const beforeWidth = ctx.measureText(beforeText).width;
      const wordWidth = ctx.measureText(highlightWord).width;
      const wordX = startX - beforeWidth - wordWidth / 2;

      ctx.fillStyle = "#D4A944";
      ctx.fillText(highlightWord, wordX, h * 0.42);
    } else {
      ctx.fillStyle = data.color || "#FFFFFF";
      ctx.fillText(arabicText, w / 2, h * 0.42, w * 0.85);
    }
    ctx.restore();
  }

  // Find active translation text block
  const translationBlock = findActiveBlockByType(tracks, "text_translation", timestampMs);
  if (translationBlock && translationBlock.data.type === "text_translation") {
    const data = translationBlock.data as TextBlockData;
    const fontSize = Math.round(w * 0.03);
    ctx.save();
    ctx.font = `${fontSize}px "Inter", sans-serif`;
    ctx.fillStyle = data.color || "#A0A0A0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.text, w / 2, h * 0.58, w * 0.85);
    ctx.restore();
  }
}

function renderLongFormMode(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tracks: Track[],
  timestampMs: number
): void {
  // Same base as reel mode
  renderReelMode(ctx, w, h, tracks, timestampMs);

  // Additionally check for card blocks (surah title overlay)
  const cardBlock = findActiveBlockByType(tracks, "card", timestampMs);
  if (cardBlock && cardBlock.data.type === "card") {
    const data = cardBlock.data as CardBlockData;
    ctx.save();

    // Card background overlay
    const cardH = h * 0.15;
    const cardY = h * 0.1;
    ctx.fillStyle = data.background_color || "#000000";
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, cardY, w, cardH);
    ctx.globalAlpha = 1;

    // Card text
    const fontSize = Math.round(w * 0.04);
    ctx.font = `${fontSize}px "Amiri Quran", "Amiri", serif`;
    ctx.fillStyle = data.text_color || "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.text, w / 2, cardY + cardH / 2, w * 0.8);
    ctx.restore();
  }
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

      // Mode-specific rendering for non-mushaf modes
      const projectMode = currentProject.mode;
      if (projectMode === "caption") {
        renderCaptionMode(ctx, w, h, currentProject.timeline.tracks, timestampMs);
        rafIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }
      if (projectMode === "reel") {
        renderReelMode(ctx, w, h, currentProject.timeline.tracks, timestampMs);
        rafIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }
      if (projectMode === "long_form") {
        renderLongFormMode(ctx, w, h, currentProject.timeline.tracks, timestampMs);
        rafIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      // Mushaf mode rendering
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
