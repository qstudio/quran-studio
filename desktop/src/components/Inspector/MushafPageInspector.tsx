import type { Block, MushafPageBlockData } from "@/types/project";
import { Separator } from "@/components/ui/separator";

interface MushafPageInspectorProps {
  block: Block;
}

export function MushafPageInspector({ block }: MushafPageInspectorProps) {
  const data = block.data as MushafPageBlockData;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-medium text-[#A0A0A0] uppercase tracking-wider mb-2">
          Mushaf Page
        </h3>
        <div className="space-y-2">
          <div>
            <span className="text-xs text-[#5C5C5C]">Page Number</span>
            <p className="text-sm text-[#FAFAFA]">{data.page}</p>
          </div>
          <div>
            <span className="text-xs text-[#5C5C5C]">Image Path</span>
            <p className="text-sm text-[#FAFAFA]">{data.image_path}</p>
          </div>
        </div>
      </div>

      <Separator />
    </div>
  );
}
