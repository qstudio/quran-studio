import {
  FolderPlus,
  FolderOpen,
  Play,
  Pause,
  SkipBack,
  Undo2,
  Redo2,
  PanelLeft,
  Download,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { useAppStore } from "@/stores/appStore";
import { useTimelineStore } from "@/stores/timelineStore";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const toggleInspector = useAppStore((s) => s.toggleInspector);
  const closeProject = useAppStore((s) => s.closeProject);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const togglePlayback = useTimelineStore((s) => s.togglePlayback);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const undo = useTimelineStore((s) => s.undo);
  const redo = useTimelineStore((s) => s.redo);
  const canUndo = useTimelineStore((s) => s.canUndo);
  const canRedo = useTimelineStore((s) => s.canRedo);

  const runCommand = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Projects">
          <CommandItem onSelect={() => runCommand(() => {})}>
            <FolderPlus className="mr-2 h-4 w-4" strokeWidth={1.5} />
            New Project
          </CommandItem>
          <CommandItem onSelect={() => runCommand(closeProject)}>
            <FolderOpen className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Open Recent...
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Playback">
          <CommandItem onSelect={() => runCommand(togglePlayback)}>
            {isPlaying ? (
              <Pause className="mr-2 h-4 w-4" strokeWidth={1.5} />
            ) : (
              <Play className="mr-2 h-4 w-4" strokeWidth={1.5} />
            )}
            {isPlaying ? "Pause" : "Play"}
            <CommandShortcut>Space</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setPlayhead(0))}>
            <SkipBack className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Jump to Start
            <CommandShortcut>Home</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Edit">
          <CommandItem
            onSelect={() => runCommand(undo)}
            disabled={!canUndo}
          >
            <Undo2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Undo
            <CommandShortcut>Cmd+Z</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(redo)}
            disabled={!canRedo}
          >
            <Redo2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Redo
            <CommandShortcut>Cmd+Shift+Z</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="View">
          <CommandItem onSelect={() => runCommand(toggleInspector)}>
            <PanelLeft className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Toggle Inspector
            <CommandShortcut>Cmd+I</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Export">
          <CommandItem onSelect={() => runCommand(() => {})}>
            <Download className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Export Video
            <CommandShortcut>Cmd+E</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
