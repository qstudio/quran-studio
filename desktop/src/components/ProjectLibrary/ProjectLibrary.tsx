import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectCard } from "@/components/ProjectLibrary/ProjectCard";
import { NewProjectDialog } from "@/components/ProjectLibrary/NewProjectDialog";
import { useProjects } from "@/hooks/useTauri";
import type { ProjectSummary } from "@/types/project";

export function ProjectLibrary() {
  const [projects, setProjects] = React.useState<ProjectSummary[]>([]);
  const [search, setSearch] = React.useState("");
  const [newDialogOpen, setNewDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const { listProjects, deleteProject, duplicateProject } = useProjects();

  const fetchProjects = React.useCallback(async () => {
    try {
      const result = await listProjects();
      setProjects(result);
    } catch {
      // Backend not available yet
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []); // listProjects is a stable module-level function

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.mode.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // Handle error
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const dup = await duplicateProject(id);
      setProjects((prev) => [
        {
          id: dup.id,
          name: dup.name,
          mode: dup.mode,
          surah: dup.surah,
          reciter_id: dup.reciter_id,
          duration_ms: dup.timeline.duration_ms,
          created_at: dup.created_at,
          updated_at: dup.updated_at,
        },
        ...prev,
      ]);
    } catch {
      // Handle error
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#000000]">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1F1F1F]">
        <h1 className="text-base font-semibold text-[#FAFAFA] mr-auto">
          Recent Projects
        </h1>
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 h-7 text-xs"
        />
        <Button size="sm" onClick={() => setNewDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
          New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-md bg-[#0A0A0A] border border-[#1F1F1F] animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-sm text-[#5C5C5C]">
              {projects.length === 0
                ? "No projects yet"
                : "No projects match your search"}
            </p>
            {projects.length === 0 && (
              <Button size="sm" onClick={() => setNewDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                Create your first project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={() => handleDelete(project.id)}
                onDuplicate={() => handleDuplicate(project.id)}
              />
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onCreated={fetchProjects}
      />
    </div>
  );
}
