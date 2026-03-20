import { useRef, useEffect, useCallback } from "react";
import { useTimelineStore } from "@/stores/timelineStore";

export function usePlayback() {
  const project = useTimelineStore((s) => s.project);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const play = useTimelineStore((s) => s.play);
  const pause = useTimelineStore((s) => s.pause);
  const togglePlayback = useTimelineStore((s) => s.togglePlayback);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Find the audio path from the project
  const getAudioPath = useCallback((): string | null => {
    const currentProject = useTimelineStore.getState().project;
    if (!currentProject) return null;
    for (const track of currentProject.timeline.tracks) {
      if (track.track_type !== "audio") continue;
      for (const block of track.blocks) {
        if (block.data.type === "audio" && block.data.audio_path) {
          return block.data.audio_path;
        }
      }
    }
    return null;
  }, []);

  // Create or update audio element
  useEffect(() => {
    const audioPath = getAudioPath();
    if (!audioPath) {
      audioRef.current = null;
      return;
    }

    if (!audioRef.current || audioRef.current.src !== audioPath) {
      const audio = new Audio(audioPath);
      audio.preload = "auto";
      audioRef.current = audio;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [getAudioPath, project]);

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

    // Start audio playback
    if (audioRef.current) {
      audioRef.current.currentTime =
        currentProject.timeline.playhead_ms / 1000;
      audioRef.current.play().catch(() => {
        // Audio playback failed (e.g., no audio file), continue with visual-only playback
      });
    }

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      const state = useTimelineStore.getState();
      if (!state.project || !state.isPlaying) return;

      const newPlayhead = state.project.timeline.playhead_ms + deltaMs;

      // If audio is playing, sync to audio time for accuracy
      if (
        audioRef.current &&
        !audioRef.current.paused &&
        !isNaN(audioRef.current.currentTime)
      ) {
        setPlayhead(audioRef.current.currentTime * 1000);
      } else {
        // Visual-only playback
        if (newPlayhead >= state.project.timeline.duration_ms) {
          setPlayhead(state.project.timeline.duration_ms);
          pause();
          return;
        }
        setPlayhead(newPlayhead);
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, setPlayhead, pause]);

  const seek = useCallback(
    (ms: number) => {
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
