import { useRef, useEffect, useCallback } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { isTauri, useAudioFile } from "@/hooks/useTauri";
import { setCurrentPlayheadMs } from "@/stores/playheadSync";

export function usePlayback() {
  const project = useTimelineStore((s) => s.project);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const play = useTimelineStore((s) => s.play);
  const pause = useTimelineStore((s) => s.pause);
  const togglePlayback = useTimelineStore((s) => s.togglePlayback);

  const { getAudioFile, readFileBytes } = useAudioFile();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const audioKeyRef = useRef<string>("");
  const loadingRef = useRef(false);
  const failedRef = useRef(false);

  const getAudioInfo = useCallback((): {
    reciterId: string;
    surah: number;
    audioPath: string | null;
  } | null => {
    const currentProject = useTimelineStore.getState().project;
    if (!currentProject) return null;
    for (const track of currentProject.timeline.tracks) {
      if (track.track_type !== "audio") continue;
      for (const block of track.blocks) {
        if (block.data.type === "audio") {
          return {
            reciterId: block.data.reciter_id,
            surah: block.data.surah,
            audioPath: block.data.audio_path,
          };
        }
      }
    }
    return null;
  }, []);

  // Load audio using asset protocol (convertFileSrc)
  useEffect(() => {
    const audioInfo = getAudioInfo();
    if (!audioInfo || !isTauri()) {
      audioRef.current = null;
      return;
    }

    const key = audioInfo.audioPath || `${audioInfo.reciterId}:${audioInfo.surah}`;

    // Prevent re-loading same audio or infinite retries
    if (audioKeyRef.current === key) return;
    if (loadingRef.current) return;

    audioKeyRef.current = key;
    loadingRef.current = true;
    failedRef.current = false;

    const loadAudio = async () => {
      try {
        console.log("[usePlayback] Loading audio for", key);

        // Fetch audio bytes via IPC
        let bytes: number[];
        if (audioInfo.audioPath) {
          bytes = await readFileBytes(audioInfo.audioPath);
        } else {
          bytes = await getAudioFile(audioInfo.reciterId, audioInfo.surah);
        }

        console.log("[usePlayback] Got", bytes.length, "bytes");

        // Create blob URL
        const uint8 = new Uint8Array(bytes);
        const blob = new Blob([uint8], { type: "audio/mpeg" });
        const blobUrl = URL.createObjectURL(blob);

        const audio = new Audio();

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Audio load timeout (15s)")), 15000);

          audio.addEventListener("canplaythrough", () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });

          audio.addEventListener("error", () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(blobUrl);
            reject(new Error(`Audio element error: ${audio.error?.message || audio.error?.code || "unknown"}`));
          }, { once: true });

          audio.preload = "auto";
          audio.src = blobUrl;
          audio.load();
        });

        audioRef.current = audio;
        loadingRef.current = false;
        console.log("[usePlayback] Audio loaded, duration:", audio.duration, "s");
      } catch (err) {
        console.error("[usePlayback] Audio load failed:", err);
        audioRef.current = null;
        loadingRef.current = false;
        failedRef.current = true;
      }
    };

    loadAudio();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      loadingRef.current = false;
      // Don't reset audioKeyRef here — prevents infinite retry on cleanup/re-mount
    };
  }, [project?.id]); // Only re-run when project changes, not on every render

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const currentProject = useTimelineStore.getState().project;
    if (!currentProject) return;

    if (audioRef.current) {
      audioRef.current.currentTime = currentProject.timeline.playhead_ms / 1000;
      audioRef.current.play().catch((err) => {
        console.error("[usePlayback] play() failed:", err);
      });
    }

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      const state = useTimelineStore.getState();
      if (!state.project || !state.isPlaying) return;

      let currentMs: number;
      if (
        audioRef.current &&
        !audioRef.current.paused &&
        !isNaN(audioRef.current.currentTime)
      ) {
        currentMs = audioRef.current.currentTime * 1000;
      } else {
        currentMs = state.project.timeline.playhead_ms + deltaMs;
      }

      if (currentMs >= state.project.timeline.duration_ms) {
        setCurrentPlayheadMs(state.project.timeline.duration_ms);
        setPlayhead(state.project.timeline.duration_ms);
        pause();
        return;
      }

      // Write to shared mutable ref FIRST (frame-accurate, no GC)
      setCurrentPlayheadMs(currentMs);
      // Then update store (triggers React UI updates, but OK if slightly delayed)
      setPlayhead(currentMs);

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, setPlayhead, pause]);

  const seek = useCallback(
    (ms: number) => {
      setCurrentPlayheadMs(ms);
      setPlayhead(ms);
      if (audioRef.current) {
        audioRef.current.currentTime = ms / 1000;
      }
    },
    [setPlayhead]
  );

  return {
    play,
    pause,
    toggle: togglePlayback,
    seek,
    isPlaying,
    currentTime: project?.timeline.playhead_ms ?? 0,
  };
}
