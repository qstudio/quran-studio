import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTimelineStore } from "@/stores/timelineStore";
import type { HighlightType, HighlightMode, HighlightBlockData } from "@/types/project";

export function InspectorPanel() {
  const project = useTimelineStore((s) => s.project);

  const currentStyle = React.useMemo(() => {
    if (!project) return null;
    const hlTrack = project.timeline.tracks.find((t) => t.track_type === "highlight");
    if (!hlTrack || hlTrack.blocks.length === 0) return null;
    const firstBlock = hlTrack.blocks[0];
    if (firstBlock.data.type !== "highlight") return null;
    return (firstBlock.data as HighlightBlockData).style;
  }, [project?.id]);

  const [highlightMode, setHighlightMode] = React.useState<HighlightMode>(
    currentStyle?.mode ?? "word"
  );
  const [highlightShape, setHighlightShape] = React.useState<"rectangle" | "underline">(
    currentStyle?.highlight_type === "underline" ? "underline" : "rectangle"
  );
  const [highlightColor, setHighlightColor] = React.useState(
    currentStyle?.color ?? "#D4A944"
  );
  const [highlightOpacity, setHighlightOpacity] = React.useState(
    currentStyle?.opacity ?? 0.55
  );
  const [highlightPadding, setHighlightPadding] = React.useState(
    currentStyle?.padding ?? 6
  );

  const applyStyle = React.useCallback(
    (updates: {
      highlight_type?: HighlightType;
      color?: string;
      opacity?: number;
      padding?: number;
      mode?: HighlightMode;
    }) => {
      const store = useTimelineStore.getState();
      const proj = store.project;
      if (!proj) return;

      const newStyle = {
        highlight_type: updates.highlight_type ?? (highlightShape === "underline" ? "underline" as HighlightType : "rectangle" as HighlightType),
        color: updates.color ?? highlightColor,
        opacity: updates.opacity ?? highlightOpacity,
        border_radius: currentStyle?.border_radius ?? 6,
        padding: updates.padding ?? highlightPadding,
        mode: updates.mode ?? highlightMode,
      };

      const newTracks = proj.timeline.tracks.map((track) => {
        if (track.track_type !== "highlight") return track;
        return {
          ...track,
          blocks: track.blocks.map((block) => {
            if (block.data.type !== "highlight") return block;
            return {
              ...block,
              data: { ...block.data, style: newStyle },
            };
          }),
        };
      });

      useTimelineStore.setState({
        project: {
          ...proj,
          timeline: { ...proj.timeline, tracks: newTracks },
        },
      });
    },
    [highlightShape, highlightColor, highlightOpacity, highlightPadding, highlightMode, currentStyle]
  );

  if (!project) {
    return (
      <ScrollArea className="h-full bg-[#0A0A0A]">
        <div className="p-3 text-center text-[#5C5C5C] text-sm py-8">
          No project loaded
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full bg-[#0A0A0A]">
      <div className="p-3 space-y-4">
        {/* Project Info */}
        <div>
          <h3 className="text-[11px] font-medium text-[#5C5C5C] uppercase tracking-wider mb-2">
            Project
          </h3>
          <div className="space-y-1.5">
            <InfoRow label="Name" value={project.name} truncate />
            <InfoRow label="Reciter" value={project.reciter_id} />
            <InfoRow label="Surah" value={String(project.surah)} />
            <InfoRow label="Ayahs" value={`${project.ayah_start}–${project.ayah_end}`} />
            <InfoRow label="Duration" value={formatDuration(project.timeline.duration_ms)} mono />
          </div>
        </div>

        <Separator />

        {/* Highlight Settings */}
        <div>
          <h3 className="text-[11px] font-medium text-[#5C5C5C] uppercase tracking-wider mb-3">
            Highlight
          </h3>

          <div className="space-y-3">
            {/* Mode: Word / Ayah / Both */}
            <div>
              <label className="text-xs text-[#5C5C5C] mb-1.5 block">Mode</label>
              <ToggleGroup
                type="single"
                value={highlightMode}
                onValueChange={(v: string) => {
                  if (!v) return;
                  const mode = v as HighlightMode;
                  setHighlightMode(mode);
                  applyStyle({ mode });
                }}
                size="sm"
                className="w-full"
              >
                <ToggleGroupItem value="word" className="flex-1 text-[10px]">
                  Word
                </ToggleGroupItem>
                <ToggleGroupItem value="ayah" className="flex-1 text-[10px]">
                  Ayah
                </ToggleGroupItem>
                <ToggleGroupItem value="word_and_ayah" className="flex-1 text-[10px]">
                  Both
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Shape: Rectangle / Underline */}
            <div>
              <label className="text-xs text-[#5C5C5C] mb-1.5 block">Shape</label>
              <ToggleGroup
                type="single"
                value={highlightShape}
                onValueChange={(v: string) => {
                  if (!v) return;
                  const shape = v as "rectangle" | "underline";
                  setHighlightShape(shape);
                  applyStyle({ highlight_type: shape });
                }}
                size="sm"
                className="w-full"
              >
                <ToggleGroupItem value="rectangle" className="flex-1 text-[10px]">
                  Rectangle
                </ToggleGroupItem>
                <ToggleGroupItem value="underline" className="flex-1 text-[10px]">
                  Underline
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Color */}
            <div>
              <label className="text-xs text-[#5C5C5C] mb-1 block">Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={highlightColor}
                  onChange={(e) => {
                    setHighlightColor(e.target.value);
                    applyStyle({ color: e.target.value });
                  }}
                  className="h-6 w-6 rounded border border-[#2E2E2E] bg-transparent cursor-pointer p-0"
                />
                <span className="text-[10px] text-[#5C5C5C] font-mono uppercase">
                  {highlightColor}
                </span>
              </div>
            </div>

            {/* Opacity */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#5C5C5C]">Opacity</label>
                <span className="text-[10px] text-[#5C5C5C] font-mono">{Math.round(highlightOpacity * 100)}%</span>
              </div>
              <Slider
                value={[highlightOpacity * 100]}
                onValueChange={([val]: number[]) => {
                  const v = val / 100;
                  setHighlightOpacity(v);
                  applyStyle({ opacity: v });
                }}
                min={10}
                max={100}
                step={5}
              />
            </div>

            {/* Padding */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#5C5C5C]">Padding</label>
                <span className="text-[10px] text-[#5C5C5C] font-mono">{highlightPadding}px</span>
              </div>
              <Slider
                value={[highlightPadding]}
                onValueChange={([val]: number[]) => {
                  setHighlightPadding(val);
                  applyStyle({ padding: val });
                }}
                min={0}
                max={30}
                step={1}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Export */}
        <div>
          <h3 className="text-[11px] font-medium text-[#5C5C5C] uppercase tracking-wider mb-3">
            Export
          </h3>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-[#5C5C5C] mb-1 block">Resolution</label>
              <Select
                value={`${project.export_settings.width}x${project.export_settings.height}`}
                onValueChange={() => {}}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1080x1920">1080×1920 (9:16)</SelectItem>
                  <SelectItem value="1920x1080">1920×1080 (16:9)</SelectItem>
                  <SelectItem value="1080x1080">1080×1080 (1:1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <InfoRow label="Codec" value={project.export_settings.video_codec} />
            <InfoRow label="FPS" value={String(project.export_settings.fps)} />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function InfoRow({ label, value, mono, truncate }: { label: string; value: string; mono?: boolean; truncate?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#5C5C5C]">{label}</span>
      <span className={`text-xs text-[#FAFAFA] ${mono ? "font-mono" : ""} ${truncate ? "truncate ml-2 max-w-[160px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}
