import { Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";

interface TitleBarProps {
  onCommandPaletteOpen: () => void;
}

export function TitleBar({ onCommandPaletteOpen }: TitleBarProps) {
  const view = useAppStore((s) => s.view);

  return (
    <div
      className="flex items-center justify-between h-7 px-3 bg-[#0A0A0A] border-b border-[#1F1F1F] select-none"
      data-tauri-drag-region
    >
      <span className="text-sm font-semibold text-[#FAFAFA] tracking-tight">
        Quran Studio
      </span>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onCommandPaletteOpen}
          title="Command Palette (Cmd+K)"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Button>
        {view === "editor" && (
          <Button size="sm" className="h-5 px-2 text-[11px]">
            <Download className="h-3 w-3 mr-1" strokeWidth={1.5} />
            Export
          </Button>
        )}
      </div>
    </div>
  );
}
