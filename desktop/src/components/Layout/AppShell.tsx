import React from "react";
import { useAppStore } from "@/stores/appStore";
import { useTimelineStore } from "@/stores/timelineStore";
import { TitleBar } from "@/components/Layout/TitleBar";
import { PreviewPanel } from "@/components/Preview/PreviewPanel";
import { TransportControls } from "@/components/Preview/TransportControls";
import { InspectorPanel } from "@/components/Inspector/InspectorPanel";
import TimelineEditor from "@/components/Timeline/TimelineEditor";
import { CommandPalette } from "@/components/CommandPalette/CommandPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePlayback } from "@/hooks/usePlayback";

const MIN_TIMELINE_HEIGHT = 100;
const MAX_TIMELINE_HEIGHT = 500;
const DEFAULT_TIMELINE_HEIGHT = 200;

export function AppShell() {
  const inspectorVisible = useAppStore((s) => s.inspectorVisible);
  const project = useTimelineStore((s) => s.project);
  const [timelineHeight, setTimelineHeight] = React.useState(DEFAULT_TIMELINE_HEIGHT);
  const [isResizing, setIsResizing] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);

  // Activate keyboard shortcuts and playback engine
  useKeyboardShortcuts();
  usePlayback();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        useAppStore.getState().toggleInspector();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startY = e.clientY;
      const startHeight = timelineHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = startY - moveEvent.clientY;
        const newHeight = Math.max(
          MIN_TIMELINE_HEIGHT,
          Math.min(MAX_TIMELINE_HEIGHT, startHeight + delta)
        );
        setTimelineHeight(newHeight);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [timelineHeight]
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#000000]">
      <TitleBar onCommandPaletteOpen={() => setCommandPaletteOpen(true)} />

      <div className="flex flex-1 min-h-0">
        {inspectorVisible && (
          <div className="w-[280px] shrink-0 border-r border-[#1F1F1F]">
            <InspectorPanel />
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#000000]">
            {project ? (
              <>
                <div className="flex-1 flex items-center justify-center min-h-0 w-full p-4">
                  <PreviewPanel />
                </div>
                <TransportControls />
              </>
            ) : (
              <div className="text-[#5C5C5C] text-sm">No project loaded</div>
            )}
          </div>

          <div
            className="h-1 cursor-row-resize bg-[#1F1F1F] hover:bg-[#2E2E2E] transition-colors shrink-0"
            onMouseDown={handleResizeStart}
            style={{
              cursor: isResizing ? "row-resize" : undefined,
            }}
          />

          <div
            className="shrink-0 bg-[#0A0A0A] border-t border-[#1F1F1F]"
            style={{ height: timelineHeight }}
          >
            <TimelineEditor />
          </div>
        </div>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
    </div>
  );
}
