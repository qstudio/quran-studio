import React from "react";
import type { Block } from "@/types/project";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TranslationInspectorProps {
  block: Block;
}

export function TranslationInspector({ block: _block }: TranslationInspectorProps) {
  const [language, setLanguage] = React.useState("en");
  const [fontSize, setFontSize] = React.useState(16);
  const [position, setPosition] = React.useState<"top" | "bottom">("bottom");

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-medium text-[#A0A0A0] uppercase tracking-wider mb-2">
          Translation
        </h3>
      </div>

      <Separator />

      <div className="space-y-3">
        <div>
          <label className="text-xs text-[#5C5C5C] mb-1 block">Language</label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ar">Arabic</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="ur">Urdu</SelectItem>
              <SelectItem value="id">Indonesian</SelectItem>
              <SelectItem value="tr">Turkish</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-[#5C5C5C] mb-1 block">
            Font Size ({fontSize}px)
          </label>
          <Slider
            value={[fontSize]}
            onValueChange={([val]: number[]) => setFontSize(val)}
            min={10}
            max={48}
            step={1}
          />
        </div>

        <div>
          <label className="text-xs text-[#5C5C5C] mb-1 block">Position</label>
          <Select value={position} onValueChange={(v: string) => setPosition(v as "top" | "bottom")}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
