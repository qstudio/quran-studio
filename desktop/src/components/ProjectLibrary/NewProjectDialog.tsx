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
import { useProjects, useSurahs, useMushaf } from "@/hooks/useTauri";
import { useAppStore } from "@/stores/appStore";
import { preloadProjectPages, setMushafPageFetcher } from "@/lib/preloadProject";
import type { Surah } from "@/types/project";

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
  const [audioSource, setAudioSource] = React.useState<"reciter" | "custom">("reciter");
  const [customAudioPath, setCustomAudioPath] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progressStatus, setProgressStatus] = React.useState("");
  const [progressPercent, setProgressPercent] = React.useState(0);

  const { createProject } = useProjects();
  const { listSurahs } = useSurahs();
  const { getMushafPage } = useMushaf();

  // Register the fetcher so the shared preload module can use it
  React.useEffect(() => {
    setMushafPageFetcher(getMushafPage);
  }, [getMushafPage]);
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
      setCustomAudioPath("");
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

  // (preloading uses shared module: preloadProjectPages)

  const handleCreate = async () => {
    if (!isValid) return;

    setCreating(true);
    setError(null);

    try {
      // Step 1: Create project (backend downloads audio + builds timeline)
      setProgressStatus(audioSource === "custom" ? "Analyzing audio with AI..." : "Preparing audio and alignment data...");
      setProgressPercent(10);

      const project = await createProject({
        mode,
        reciterId: audioSource === "custom" ? "custom" : reciterId,
        surah: Number(surahNumber),
        ayahStart: Number(ayahStart),
        ayahEnd: Number(ayahEnd),
        ...(audioSource === "custom" && { audioPath: customAudioPath }),
      });

      setProgressPercent(30);

      // Step 2: Pre-load mushaf page images (only for mushaf mode)
      if (mode === "mushaf") {
        setProgressStatus("Loading mushaf pages...");
        const style = useAppStore.getState().mushafStyle;
        await preloadProjectPages(project, style, (loaded, total) => {
          setProgressPercent(30 + Math.round((loaded / total) * 60));
          setProgressStatus(`Loading mushaf pages... ${loaded}/${total}`);
        });
      } else {
        setProgressPercent(90);
      }

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

  const isValid = audioSource === "custom"
    ? customAudioPath && surahNumber && ayahStart && ayahEnd
    : reciterId && surahNumber && ayahStart && ayahEnd;

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
                    className="flex-1 text-xs"
                  >
                    Caption
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="reel"
                    className="flex-1 text-xs"
                  >
                    Reel
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="long_form"
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
                <label className="text-xs text-[#A0A0A0] mb-1.5 block">Audio Source</label>
                <ToggleGroup
                  type="single"
                  value={audioSource}
                  onValueChange={(v: string) => v && setAudioSource(v as "reciter" | "custom")}
                  size="sm"
                  className="w-full"
                >
                  <ToggleGroupItem value="reciter" className="flex-1 text-xs">Reciter Library</ToggleGroupItem>
                  <ToggleGroupItem value="custom" className="flex-1 text-xs">Custom Audio</ToggleGroupItem>
                </ToggleGroup>
              </div>

              {audioSource === "reciter" ? (
                <div>
                  <label className="text-xs text-[#A0A0A0] mb-1.5 block">
                    Reciter
                  </label>
                  <ReciterBrowser
                    selectedId={reciterId}
                    onSelect={setReciterId}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs text-[#A0A0A0] mb-1.5 block">Audio File</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-xs"
                      onClick={async () => {
                        try {
                          const { open } = await import("@tauri-apps/plugin-dialog");
                          const file = await open({
                            filters: [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "ogg", "flac"] }],
                            multiple: false,
                          });
                          if (file) setCustomAudioPath(file);
                        } catch {
                          // Not in Tauri or dialog cancelled — use a mock path for dev
                          setCustomAudioPath("/mock/custom_audio.mp3");
                        }
                      }}
                    >
                      Choose File
                    </Button>
                    {customAudioPath && (
                      <span className="text-xs text-[#A0A0A0] truncate max-w-[200px]">
                        {customAudioPath.split("/").pop() || customAudioPath}
                      </span>
                    )}
                  </div>
                </div>
              )}

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
