import { useAppStore } from "@/stores/appStore";
import { useTimelineStore } from "@/stores/timelineStore";
import { AppShell } from "@/components/Layout/AppShell";
import { ProjectLibrary } from "@/components/ProjectLibrary/ProjectLibrary";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function App() {
  const view = useAppStore((s) => s.view);
  const project = useTimelineStore((s) => s.project);

  return (
    <TooltipProvider>
      <div className="h-screen w-screen overflow-hidden bg-[#000000] text-[#FAFAFA]">
        {view === "editor" && project ? <AppShell /> : <ProjectLibrary />}
      </div>
    </TooltipProvider>
  );
}
