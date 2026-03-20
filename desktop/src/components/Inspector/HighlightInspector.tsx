import React from "react";
import type { Block, HighlightBlockData, HighlightType } from "@/types/project";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface HighlightInspectorProps {
  blocks: Block[];
}

export function HighlightInspector({ blocks }: HighlightInspectorProps) {
  const firstData = blocks[0].data as HighlightBlockData;
  const [styleType, setStyleType] = React.useState<HighlightType>(firstData.style.highlight_type);
  const [color, setColor] = React.useState(firstData.style.color);
  const [opacity, setOpacity] = React.useState(firstData.style.opacity);
  const [padding, setPadding] = React.useState(firstData.style.padding);

  const isMultiSelect = blocks.length > 1;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-medium text-[#A0A0A0] uppercase tracking-wider mb-2">
          Highlight{isMultiSelect ? ` (${blocks.length} selected)` : ""}
        </h3>
        {!isMultiSelect && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#5C5C5C]">Ayah</span>
              <span className="text-xs text-[#FAFAFA]">
                {firstData.surah}:{firstData.ayah}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#5C5C5C]">Word</span>
              <span className="text-xs text-[#FAFAFA]">
                {firstData.word_position}
              </span>
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-xs font-medium text-[#A0A0A0] uppercase tracking-wider">
          Style
        </h3>

        <div>
          <label className="text-xs text-[#5C5C5C] mb-1.5 block">Type</label>
          <ToggleGroup
            type="single"
            value={styleType}
            onValueChange={(value: string) => {
              if (value) setStyleType(value as HighlightType);
            }}
            size="sm"
            className="w-full"
          >
            <ToggleGroupItem value="golden_glow" className="flex-1 text-xs">
              Golden Glow
            </ToggleGroupItem>
            <ToggleGroupItem value="blue_box" className="flex-1 text-xs">
              Blue Box
            </ToggleGroupItem>
            <ToggleGroupItem value="underline" className="flex-1 text-xs">
              Underline
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div>
          <label className="text-xs text-[#5C5C5C] mb-1 block">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-7 rounded border border-[#2E2E2E] bg-transparent cursor-pointer p-0"
            />
            <span className="text-xs text-[#A0A0A0] font-mono uppercase">
              {color}
            </span>
          </div>
        </div>

        <div>
          <label className="text-xs text-[#5C5C5C] mb-1 block">
            Opacity ({Math.round(opacity * 100)}%)
          </label>
          <Slider
            value={[opacity * 100]}
            onValueChange={([val]: number[]) => setOpacity(val / 100)}
            min={0}
            max={100}
            step={1}
          />
        </div>

        <div>
          <label className="text-xs text-[#5C5C5C] mb-1 block">
            Padding ({padding}px)
          </label>
          <Slider
            value={[padding]}
            onValueChange={([val]: number[]) => setPadding(val)}
            min={0}
            max={20}
            step={1}
          />
        </div>
      </div>

      <Separator />

      <Button variant="secondary" size="sm" className="w-full text-xs">
        Apply to all highlight blocks
      </Button>
    </div>
  );
}
