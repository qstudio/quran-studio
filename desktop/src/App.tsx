import { useEffect } from "react";
import { useAppStore } from "@/stores/appStore";
import { useTimelineStore } from "@/stores/timelineStore";
import { AppShell } from "@/components/Layout/AppShell";
import { ProjectLibrary } from "@/components/ProjectLibrary/ProjectLibrary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useMushaf } from "@/hooks/useTauri";
import { setMushafPageFetcher } from "@/lib/preloadProject";

export default function App() {
  const view = useAppStore((s) => s.view);
  const project = useTimelineStore((s) => s.project);
  const { getMushafPage } = useMushaf();

  // Register the image fetcher once on mount so preloading works everywhere
  useEffect(() => {
    setMushafPageFetcher(getMushafPage);
  }, [getMushafPage]);

  return (
    <TooltipProvider>
      <div className="h-screen w-screen overflow-hidden bg-[#000000] text-[#FAFAFA]">
        {view === "editor" && project ? <AppShell /> : <ProjectLibrary />}
      </div>
    </TooltipProvider>
  );
}
