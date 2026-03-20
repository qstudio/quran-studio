import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useTimelineStore } from "@/stores/timelineStore";
import { formatTime } from "./utils";

export default function TimelineToolbar() {
  const project = useTimelineStore((s) => s.project);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const togglePlayback = useTimelineStore((s) => s.togglePlayback);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);

  if (!project) return null;

  const { playhead_ms: playheadMs, duration_ms: durationMs } = project.timeline;

  const skipBack = () => {
    setPlayhead(Math.max(0, playheadMs - 5000));
  };

  const skipForward = () => {
    setPlayhead(Math.min(durationMs, playheadMs + 5000));
  };

  return (
    <div
      className="flex items-center gap-1 px-2 h-9 border-b select-none"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border-default)",
      }}
    >
      <button
        onClick={skipBack}
        className="flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--bg-subtle)] transition-colors"
        title="Skip Back (J)"
      >
        <SkipBack size={14} color="var(--text-secondary)" />
      </button>

      <button
        onClick={togglePlayback}
        className="flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--bg-subtle)] transition-colors"
        title="Play/Pause (Space)"
      >
        {isPlaying ? (
          <Pause size={14} color="var(--text-primary)" />
        ) : (
          <Play size={14} color="var(--text-primary)" />
        )}
      </button>

      <button
        onClick={skipForward}
        className="flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--bg-subtle)] transition-colors"
        title="Skip Forward (L)"
      >
        <SkipForward size={14} color="var(--text-secondary)" />
      </button>

      <div className="w-px h-4 bg-[var(--border-default)] mx-1" />

      <span
        className="text-xs tabular-nums"
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          color: "var(--text-secondary)",
        }}
      >
        {formatTime(playheadMs)}
        <span style={{ color: "var(--text-tertiary)" }}> / </span>
        {formatTime(durationMs)}
      </span>
    </div>
  );
}
