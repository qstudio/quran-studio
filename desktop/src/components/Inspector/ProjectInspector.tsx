import { useTimelineStore } from "@/stores/timelineStore";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function ProjectInspector() {
  const project = useTimelineStore((s) => s.project);

  if (!project) {
    return (
      <div className="text-center text-[#5C5C5C] text-sm py-8">
        No project loaded
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-medium text-[#A0A0A0] uppercase tracking-wider mb-2">
          Project
        </h3>
        <div className="space-y-2">
          <div>
            <span className="text-xs text-[#5C5C5C]">Name</span>
            <p className="text-sm text-[#FAFAFA]">{project.name}</p>
          </div>
          <div>
            <span className="text-xs text-[#5C5C5C]">Mode</span>
            <p className="text-sm text-[#FAFAFA] capitalize">{project.mode}</p>
          </div>
        </div>
      </div>

      <Separator />

      <Accordion type="single" collapsible defaultValue="export">
        <AccordionItem value="export">
          <AccordionTrigger className="text-xs font-medium text-[#A0A0A0] uppercase tracking-wider py-2">
            Export Settings
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-[#5C5C5C]">Resolution</span>
                <p className="text-sm text-[#FAFAFA]">
                  {project.export_settings.width}x{project.export_settings.height}
                </p>
              </div>

              <div>
                <span className="text-xs text-[#5C5C5C]">Format</span>
                <p className="text-sm text-[#FAFAFA] uppercase">
                  {project.export_settings.output_format} / {project.export_settings.video_codec}
                </p>
              </div>

              <div>
                <span className="text-xs text-[#5C5C5C]">FPS</span>
                <p className="text-sm text-[#FAFAFA]">{project.export_settings.fps}</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
