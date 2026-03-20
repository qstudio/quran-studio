import React from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useAppStore } from "@/stores/appStore";
import { usePreview } from "@/hooks/useTauri";

export function PreviewPanel() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const project = useTimelineStore((s) => s.project);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const aspectRatio = useAppStore((s) => s.aspectRatio);
  const { getPreviewFrame } = usePreview();
  const rafRef = React.useRef<number>(0);
  const lastFrameTimeRef = React.useRef<number>(0);

  const getAspectRatioDimensions = React.useCallback(() => {
    switch (aspectRatio) {
      case "9:16":
        return { w: 9, h: 16 };
      case "16:9":
        return { w: 16, h: 9 };
      case "1:1":
        return { w: 1, h: 1 };
    }
  }, [aspectRatio]);

  const renderFrame = React.useCallback(
    async (timestampMs: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !project) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      try {
        const frameData = await getPreviewFrame(project.id, timestampMs);
        const bytes = new Uint8Array(frameData);
        const blob = new Blob([bytes], { type: "image/png" });
        const bitmap = await createImageBitmap(blob);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
      } catch {
        // Frame not available; show black
        const ctx2 = canvas.getContext("2d");
        if (ctx2) {
          ctx2.fillStyle = "#000000";
          ctx2.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    },
    [project, getPreviewFrame]
  );

  // Resize canvas to fit container with correct aspect ratio
  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { width: cw, height: ch } = entry.contentRect;
      const { w, h } = getAspectRatioDimensions();
      const targetRatio = w / h;
      const containerRatio = cw / ch;

      let canvasWidth: number;
      let canvasHeight: number;

      if (containerRatio > targetRatio) {
        canvasHeight = ch;
        canvasWidth = ch * targetRatio;
      } else {
        canvasWidth = cw;
        canvasHeight = cw / targetRatio;
      }

      canvas.width = Math.round(canvasWidth);
      canvas.height = Math.round(canvasHeight);
      canvas.style.width = `${Math.round(canvasWidth)}px`;
      canvas.style.height = `${Math.round(canvasHeight)}px`;
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [getAspectRatioDimensions]);

  // Render frame at playhead when not playing
  React.useEffect(() => {
    if (!isPlaying && project) {
      renderFrame(project.timeline.playhead_ms);
    }
  }, [isPlaying, project, renderFrame]);

  // Playback loop at ~30fps
  React.useEffect(() => {
    if (!isPlaying || !project) return;

    const targetInterval = 1000 / 30;

    const tick = (time: number) => {
      if (time - lastFrameTimeRef.current >= targetInterval) {
        lastFrameTimeRef.current = time;
        const store = useTimelineStore.getState();
        if (store.project) {
          renderFrame(store.project.timeline.playhead_ms);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, project, renderFrame]);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center w-full h-full bg-black"
    >
      <canvas
        ref={canvasRef}
        className="bg-black"
      />
    </div>
  );
}
