/**
 * Shared mutable playhead time for frame-accurate sync between
 * the playback engine and preview renderer.
 *
 * The Zustand store's project.timeline.playhead_ms is updated via immutable
 * state updates which cause GC pressure and race conditions between rAF loops.
 * This module provides a simple mutable value that both loops read/write directly.
 */

/** Current playhead position in milliseconds — written by usePlayback, read by PreviewPanel */
export let currentPlayheadMs = 0;

/** Update the playhead position (called from playback rAF loop) */
export function setCurrentPlayheadMs(ms: number) {
  currentPlayheadMs = ms;
}
