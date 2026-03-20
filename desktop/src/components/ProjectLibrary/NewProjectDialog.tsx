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
import { ReciterBrowser } from "@/components/ReciterBrowser/ReciterBrowser";
import { useProjects, useSurahs } from "@/hooks/useTauri";
import { useAppStore } from "@/stores/appStore";
import { useTimelineStore } from "@/stores/timelineStore";
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
  const [creating, setCreating] = React.useState(false);

  const { createProject } = useProjects();
  const { listSurahs } = useSurahs();
  const openProject = useAppStore((s) => s.openProject);
  const setProject = useTimelineStore((s) => s.setProject);

  React.useEffect(() => {
    if (open) {
      listSurahs()
        .then(setSurahs)
        .catch(() => setSurahs([]));
    }
  }, [open, listSurahs]);

  const selectedSurah = surahs.find(
    (s) => s.number === Number(surahNumber)
  );

  React.useEffect(() => {
    if (selectedSurah) {
      setAyahEnd(String(selectedSurah.total_ayahs));
    }
  }, [selectedSurah]);

  const handleCreate = async () => {
    if (!reciterId || !surahNumber) return;

    setCreating(true);
    try {
      const project = await createProject({
        mode,
        reciterId,
        surah: Number(surahNumber),
        ayahStart: Number(ayahStart),
        ayahEnd: Number(ayahEnd),
      });
      setProject(project);
      openProject(project);
      onOpenChange(false);
      onCreated();
    } catch {
      // Handle error
    } finally {
      setCreating(false);
    }
  };

  const isValid = reciterId && surahNumber && ayahStart && ayahEnd;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Create a new Quran recitation video project.
          </DialogDescription>
        </DialogHeader>

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
            disabled={!isValid || creating}
          >
            {creating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
