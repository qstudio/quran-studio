import { TRACK_HEADER_WIDTH } from "./constants";
import type { Track, Block } from "@/types/project";

export function msToX(ms: number, zoom: number, scrollX: number): number {
  return TRACK_HEADER_WIDTH + (ms * zoom) / 1000 - scrollX;
}

export function xToMs(x: number, zoom: number, scrollX: number): number {
  return ((x - TRACK_HEADER_WIDTH + scrollX) * 1000) / zoom;
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(millis).padStart(3, "0");
  return `${mm}:${ss}.${mmm}`;
}

export function findActiveBlock(
  tracks: Track[],
  type: string,
  timestampMs: number
): Block | null {
  for (const track of tracks) {
    if (track.track_type !== type) continue;
    for (const block of track.blocks) {
      if (block.start_ms <= timestampMs && block.end_ms > timestampMs) {
        return block;
      }
    }
  }
  return null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
