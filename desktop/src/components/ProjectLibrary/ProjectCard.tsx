import { useAppStore } from "@/stores/appStore";
import { useTimelineStore } from "@/stores/timelineStore";
import { useProjects } from "@/hooks/useTauri";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { ProjectSummary } from "@/types/project";

interface ProjectCardProps {
  project: ProjectSummary;
  onDelete: () => void;
  onDuplicate: () => void;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ProjectCard({
  project,
  onDelete,
  onDuplicate,
}: ProjectCardProps) {
  const openProject = useAppStore((s) => s.openProject);
  const setProject = useTimelineStore((s) => s.setProject);
  const { loadProject } = useProjects();

  const handleOpen = async () => {
    try {
      const fullProject = await loadProject(project.id);
      setProject(fullProject);
      openProject(fullProject);
    } catch {
      // Handle error
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          onClick={handleOpen}
          className="w-full text-left bg-[#0A0A0A] border border-[#1F1F1F] rounded-md overflow-hidden transition-colors hover:border-[#2E2E2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
        >
          <div className="h-28 bg-[#141414]" />
          <div className="p-3 space-y-1.5">
            <p className="text-sm font-semibold text-[#FAFAFA] truncate">
              {project.name}
            </p>
            <div className="flex items-center justify-between">
              <Badge className="capitalize">{project.mode}</Badge>
              <span className="text-[11px] text-[#A0A0A0]">
                {formatRelativeTime(project.updated_at)}
              </span>
            </div>
          </div>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleOpen}>Open</ContextMenuItem>
        <ContextMenuItem onClick={onDuplicate}>Duplicate</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={onDelete}
          className="text-[#ef4444] focus:text-[#ef4444]"
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
