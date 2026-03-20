import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ReciterBrowser } from "@/components/ReciterBrowser/ReciterBrowser";
import { useProjects, useSurahs, useMushaf, isTauri } from "@/hooks/useTauri";
import { useAppStore } from "@/stores/appStore";
import type { Project, Surah } from "@/types/project";

// Module-level image cache (shared with PreviewPanel)
export const preloadedPageImages = new Map<number, HTMLImageElement>();

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: NewProjectDialogProps) {
  const [mode, setMode] = React.useState("mushaf");
  const [reciterId, setReciterId] = React.useState("");
  const [surahNumber, setSurahNumber] = React.useState("");
  const [ayahStart, setAyahStart] = React.useState("1");
  const [ayahEnd, setAyahEnd] = React.useState("");
  const [surahs, setSurahs] = React.useState<Surah[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progressStatus, setProgressStatus] = React.useState("");
  const [progressPercent, setProgressPercent] = React.useState(0);

  const { createProject } = useProjects();
  const { listSurahs } = useSurahs();
  const { getMushafPage } = useMushaf();
  const openProject = useAppStore((s) => s.openProject);

  React.useEffect(() => {
    if (open) {
      listSurahs()
        .then(setSurahs)
        .catch(() => setSurahs([]));
      // Reset state
      setError(null);
      setProgressStatus("");
      setProgressPercent(0);
      setCreating(false);
    }
  }, [open]);

  const selectedSurah = surahs.find(
    (s) => s.number === Number(surahNumber)
  );

  React.useEffect(() => {
    if (selectedSurah) {
      setAyahEnd(String(selectedSurah.total_ayahs));
    }
  }, [selectedSurah]);

  // Pre-load all mushaf page images for a project
  const preloadPages = React.useCallback(
    async (project: Project): Promise<void> => {
      if (!isTauri()) return;

      // Find all unique page numbers from mushaf_page blocks
      const pages = new Set<number>();
      for (const track of project.timeline.tracks) {
        if (track.track_type !== "mushaf_page") continue;
        for (const block of track.blocks) {
          if (block.data.type === "mushaf_page") {
            pages.add(block.data.page);
          }
        }
      }

      const pageList = Array.from(pages).sort((a, b) => a - b);
      if (pageList.length === 0) return;

      let loaded = 0;
      const total = pageList.length;

      // Load pages in parallel (batches of 4)
      const batchSize = 4;
      for (let i = 0; i < pageList.length; i += batchSize) {
        const batch = pageList.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (page) => {
            try {
              if (preloadedPageImages.has(page)) {
                loaded++;
                return;
              }
              // Fetch PNG bytes via IPC, create blob URL, load as Image
              const bytes = await getMushafPage(page);
              const uint8 = new Uint8Array(bytes);
              const blob = new Blob([uint8], { type: "image/png" });
              const url = URL.createObjectURL(blob);

              await new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                  preloadedPageImages.set(page, img);
                  loaded++;
                  setProgressPercent(
                    30 + Math.round((loaded / total) * 60)
                  );
                  setProgressStatus(
                    `Loading mushaf pages... ${loaded}/${total}`
                  );
                  resolve();
                };
                img.onerror = () => reject(new Error(`Failed to load page ${page}`));
                img.src = url;
              });
            } catch {
              loaded++;
              // Continue loading other pages even if one fails
            }
          })
        );
      }
    },
    [getMushafPage]
  );

  const handleCreate = async () => {
    if (!reciterId || !surahNumber) return;

    setCreating(true);
    setError(null);

    try {
      // Step 1: Create project (backend downloads audio + builds timeline)
      setProgressStatus("Preparing audio and alignment data...");
      setProgressPercent(10);

      const project = await createProject({
        mode,
        reciterId,
        surah: Number(surahNumber),
        ayahStart: Number(ayahStart),
        ayahEnd: Number(ayahEnd),
      });

      setProgressPercent(30);

      // Step 2: Pre-load all mushaf page images
      setProgressStatus("Loading mushaf pages...");
      await preloadPages(project);

      // Step 3: Done — open the editor
      setProgressPercent(100);
      setProgressStatus("Ready!");

      // Small delay so user sees "Ready!"
      await new Promise((r) => setTimeout(r, 300));

      openProject(project);
      onOpenChange(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const isValid = reciterId && surahNumber && ayahStart && ayahEnd;

  return (
    <Dialog open={open} onOpenChange={creating ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Create a new Quran recitation video project.
          </DialogDescription>
        </DialogHeader>

        {creating ? (
          // Progress view during creation
          <div className="py-8 space-y-4">
            <div className="text-center">
              <p className="text-sm text-[#FAFAFA] mb-1">{progressStatus}</p>
              <p className="text-xs text-[#5C5C5C]">
                {progressPercent < 100
                  ? "This may take a moment..."
                  : "Opening editor..."}
              </p>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>
        ) : (
          // Form view
          <>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs text-[#A0A0A0] mb-1.5 block">Mode</label>
                <ToggleGroup
                  type="single"
                  value={mode}
                  onValueChange={(v: string) => v && setMode(v)}
                  className="w-full"
                >
                  <ToggleGroupItem
                    value="caption"
                    disabled
                    className="flex-1 text-xs"
                  >
                    Caption
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="reel"
                    disabled
                    className="flex-1 text-xs"
                  >
                    Reel
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="longform"
                    disabled
                    className="flex-1 text-xs"
                  >
                    Long-form
                  </ToggleGroupItem>
                  <ToggleGroupItem value="mushaf" className="flex-1 text-xs">
                    Mushaf
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Separator />

              <div>
                <label className="text-xs text-[#A0A0A0] mb-1.5 block">
                  Reciter
                </label>
                <ReciterBrowser
                  selectedId={reciterId}
                  onSelect={setReciterId}
                />
              </div>

              <div>
                <label className="text-xs text-[#A0A0A0] mb-1.5 block">
                  Surah
                </label>
                <Select value={surahNumber} onValueChange={setSurahNumber}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select a surah" />
                  </SelectTrigger>
                  <SelectContent>
                    {surahs.map((s) => (
                      <SelectItem key={s.number} value={String(s.number)}>
                        {s.number}. {s.name_english} ({s.name_arabic})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[#A0A0A0] mb-1 block">
                    From Ayah
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedSurah?.total_ayahs ?? 999}
                    value={ayahStart}
                    onChange={(e) => setAyahStart(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[#A0A0A0] mb-1 block">
                    To Ayah
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedSurah?.total_ayahs ?? 999}
                    value={ayahEnd}
                    onChange={(e) => setAyahEnd(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-[#ef4444]">{error}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!isValid}
              >
                Create
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
