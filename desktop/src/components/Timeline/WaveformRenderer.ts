import { COLOR_WAVEFORM_PLAYED, COLOR_WAVEFORM_UNPLAYED } from "./constants";

export interface WaveformRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function renderWaveform(
  ctx: CanvasRenderingContext2D,
  peaks: number[],
  rect: WaveformRect,
  playheadX: number
): void {
  if (peaks.length === 0 || rect.w <= 0 || rect.h <= 0) return;

  const barWidth = 2;
  const gap = 1;
  const step = barWidth + gap;
  const numBars = Math.floor(rect.w / step);
  if (numBars <= 0) return;

  const centerY = rect.y + rect.h / 2;
  const maxBarHeight = rect.h * 0.8;

  for (let i = 0; i < numBars; i++) {
    const barX = rect.x + i * step;

    // Skip bars outside visible area
    if (barX + barWidth < 0) continue;
    if (barX > rect.x + rect.w) break;

    // Sample the peak data proportionally
    const peakIndex = Math.floor((i / numBars) * peaks.length);
    const peak = peaks[Math.min(peakIndex, peaks.length - 1)];
    const barHeight = Math.max(1, peak * maxBarHeight);

    ctx.fillStyle =
      barX < playheadX ? COLOR_WAVEFORM_PLAYED : COLOR_WAVEFORM_UNPLAYED;
    ctx.fillRect(
      barX,
      centerY - barHeight / 2,
      barWidth,
      barHeight
    );
  }
}
