import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTimelineStore } from "@/stores/timelineStore";
import { useAppStore } from "@/stores/appStore";

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

export function TransportControls() {
  const project = useTimelineStore((s) => s.project);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const togglePlayback = useTimelineStore((s) => s.togglePlayback);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const aspectRatio = useAppStore((s) => s.aspectRatio);
  const setAspectRatio = useAppStore((s) => s.setAspectRatio);

  const currentMs = project?.timeline.playhead_ms ?? 0;
  const durationMs = project?.timeline.duration_ms ?? 0;

  const handleSkipBack = () => {
    setPlayhead(Math.max(0, currentMs - 5000));
  };

  const handleSkipForward = () => {
    setPlayhead(Math.min(durationMs, currentMs + 5000));
  };

  return (
    <div className="flex items-center justify-center gap-4 px-4 py-2 bg-[#0A0A0A] border-t border-[#1F1F1F] w-full shrink-0">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={handleSkipBack}>
          <SkipBack className="h-4 w-4" strokeWidth={1.5} />
        </Button>

        <Button
          variant="default"
          size="icon"
          className="h-9 w-9"
          onClick={togglePlayback}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" strokeWidth={1.5} />
          ) : (
            <Play className="h-5 w-5 ml-0.5" strokeWidth={1.5} />
          )}
        </Button>

        <Button variant="ghost" size="icon" onClick={handleSkipForward}>
          <SkipForward className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>

      <span
        className="text-[13px] text-[#A0A0A0] tabular-nums"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {formatTime(currentMs)} / {formatTime(durationMs)}
      </span>

      <ToggleGroup
        type="single"
        value={aspectRatio}
        onValueChange={(value: string) => {
          if (value) setAspectRatio(value as "9:16" | "16:9" | "1:1");
        }}
        size="sm"
      >
        <ToggleGroupItem value="9:16" className="text-xs px-2">
          9:16
        </ToggleGroupItem>
        <ToggleGroupItem value="16:9" className="text-xs px-2">
          16:9
        </ToggleGroupItem>
        <ToggleGroupItem value="1:1" className="text-xs px-2">
          1:1
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
