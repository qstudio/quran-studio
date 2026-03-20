import { Minus, Plus } from "lucide-react";
import { useTimelineStore } from "@/stores/timelineStore";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_BAR_HEIGHT } from "./constants";

export default function ZoomControl() {
  const project = useTimelineStore((s) => s.project);
  const setZoom = useTimelineStore((s) => s.setZoom);

  if (!project) return null;

  const zoom = project.timeline.zoom ?? 50;

  // Use logarithmic scale for the slider
  const logMin = Math.log(MIN_ZOOM);
  const logMax = Math.log(MAX_ZOOM);
  const logValue = Math.log(zoom);
  const sliderValue = ((logValue - logMin) / (logMax - logMin)) * 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value) / 100;
    const logZoom = logMin + pct * (logMax - logMin);
    setZoom(Math.exp(logZoom));
  };

  const zoomIn = () => {
    setZoom(zoom * 1.25);
  };

  const zoomOut = () => {
    setZoom(zoom * 0.8);
  };

  return (
    <div
      className="flex items-center justify-center gap-2 px-3 select-none border-t"
      style={{
        height: ZOOM_BAR_HEIGHT,
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border-default)",
      }}
    >
      <button
        onClick={zoomOut}
        className="flex items-center justify-center w-5 h-5 rounded hover:bg-[var(--bg-subtle)] transition-colors"
        title="Zoom Out (-)"
      >
        <Minus size={12} color="var(--text-secondary)" />
      </button>

      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={sliderValue}
        onChange={handleSliderChange}
        className="w-32 h-1 appearance-none rounded-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--text-tertiary) ${sliderValue}%, var(--border-default) ${sliderValue}%)`,
          accentColor: "var(--text-secondary)",
        }}
      />

      <button
        onClick={zoomIn}
        className="flex items-center justify-center w-5 h-5 rounded hover:bg-[var(--bg-subtle)] transition-colors"
        title="Zoom In (+)"
      >
        <Plus size={12} color="var(--text-secondary)" />
      </button>

      <span
        className="text-[10px] ml-1 tabular-nums"
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          color: "var(--text-tertiary)",
        }}
      >
        {zoom.toFixed(1)}x
      </span>
    </div>
  );
}
