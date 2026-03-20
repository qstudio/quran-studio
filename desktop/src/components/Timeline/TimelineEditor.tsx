import TimelineToolbar from "./TimelineToolbar";
import TimelineCanvas from "./TimelineCanvas";
import ZoomControl from "./ZoomControl";

export default function TimelineEditor() {
  return (
    <div className="flex flex-col h-full w-full">
      <TimelineToolbar />
      <TimelineCanvas />
      <ZoomControl />
    </div>
  );
}
