import { useEffect } from "react";
import { useTimelineStore } from "@/stores/timelineStore";

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      const state = useTimelineStore.getState();
      const isMeta = e.metaKey || e.ctrlKey;

      switch (e.key) {
        case " ": {
          e.preventDefault();
          state.togglePlayback();
          break;
        }

        case "j":
        case "J": {
          if (!isMeta && state.project) {
            e.preventDefault();
            state.setPlayhead(
              Math.max(0, state.project.timeline.playhead_ms - 5000)
            );
          }
          break;
        }

        case "k":
        case "K": {
          if (!isMeta) {
            e.preventDefault();
            state.pause();
          }
          break;
        }

        case "l":
        case "L": {
          if (!isMeta && state.project) {
            e.preventDefault();
            state.setPlayhead(
              Math.min(
                state.project.timeline.duration_ms,
                state.project.timeline.playhead_ms + 5000
              )
            );
          }
          break;
        }

        case "ArrowLeft": {
          if (state.project) {
            e.preventDefault();
            const step = e.shiftKey ? 1000 : 100;
            state.setPlayhead(
              Math.max(0, state.project.timeline.playhead_ms - step)
            );
          }
          break;
        }

        case "ArrowRight": {
          if (state.project) {
            e.preventDefault();
            const step = e.shiftKey ? 1000 : 100;
            state.setPlayhead(
              Math.min(
                state.project.timeline.duration_ms,
                state.project.timeline.playhead_ms + step
              )
            );
          }
          break;
        }

        case "z":
        case "Z": {
          if (isMeta) {
            e.preventDefault();
            if (e.shiftKey) {
              state.redo();
            } else {
              state.undo();
            }
          }
          break;
        }

        case "+":
        case "=": {
          if (!isMeta && state.project) {
            e.preventDefault();
            state.setZoom(state.project.timeline.zoom * 1.25);
          }
          break;
        }

        case "-": {
          if (!isMeta && state.project) {
            e.preventDefault();
            state.setZoom(state.project.timeline.zoom * 0.8);
          }
          break;
        }

        case "Delete":
        case "Backspace": {
          if (!isMeta && state.selectedBlockIds.length > 0) {
            e.preventDefault();
            state.deleteSelectedBlocks();
          }
          break;
        }

        case "Escape": {
          state.clearSelection();
          break;
        }

        case "a":
        case "A": {
          if (isMeta && state.project) {
            e.preventDefault();
            // Select all blocks
            const allIds: string[] = [];
            for (const track of state.project.timeline.tracks) {
              for (const block of track.blocks) {
                allIds.push(block.id);
              }
            }
            // Select them one by one with multi=true
            state.clearSelection();
            for (const id of allIds) {
              state.selectBlock(id, true);
            }
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
