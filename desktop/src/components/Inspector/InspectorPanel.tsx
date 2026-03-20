import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTimelineStore } from "@/stores/timelineStore";
import { ProjectInspector } from "@/components/Inspector/ProjectInspector";
import { MushafPageInspector } from "@/components/Inspector/MushafPageInspector";
import { HighlightInspector } from "@/components/Inspector/HighlightInspector";
import type { Block, Track } from "@/types/project";

function getSelectedBlocks(
  tracks: Track[],
  selectedBlockIds: string[]
): Block[] {
  const blocks: Block[] = [];
  for (const track of tracks) {
    for (const block of track.blocks) {
      if (selectedBlockIds.includes(block.id)) {
        blocks.push(block);
      }
    }
  }
  return blocks;
}

export function InspectorPanel() {
  const project = useTimelineStore((s) => s.project);
  const selectedBlockIds = useTimelineStore((s) => s.selectedBlockIds);

  const selectedBlocks = React.useMemo(() => {
    if (!project || selectedBlockIds.length === 0) return [];
    return getSelectedBlocks(project.timeline.tracks, selectedBlockIds);
  }, [project, selectedBlockIds]);

  const renderContent = () => {
    if (selectedBlocks.length === 0) {
      return <ProjectInspector />;
    }

    const firstBlock = selectedBlocks[0];
    const blockType = firstBlock.data.type;

    switch (blockType) {
      case "mushaf_page":
        return <MushafPageInspector block={firstBlock} />;
      case "highlight":
        return <HighlightInspector blocks={selectedBlocks} />;
      default:
        return <ProjectInspector />;
    }
  };

  return (
    <ScrollArea className="h-full bg-[#0A0A0A]">
      <div className="p-3">{renderContent()}</div>
    </ScrollArea>
  );
}
