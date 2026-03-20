import { create } from "zustand";
import type { Project, Block, Track } from "../types/project";

const MAX_HISTORY = 50;

interface HistoryEntry {
  project: Project;
  selectedBlockIds: string[];
  selectedTrackId: string | null;
}

export interface TimelineState {
  project: Project | null;
  selectedBlockIds: string[];
  selectedTrackId: string | null;
  isPlaying: boolean;

  // History
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setProject: (project: Project) => void;
  setPlayhead: (ms: number) => void;
  setZoom: (zoom: number) => void;
  setScrollX: (x: number) => void;
  selectBlock: (blockId: string, multi?: boolean) => void;
  selectTrack: (trackId: string | null) => void;
  clearSelection: () => void;
  moveBlock: (blockId: string, newStartMs: number) => void;
  resizeBlock: (blockId: string, newStartMs: number, newEndMs: number) => void;
  deleteSelectedBlocks: () => void;
  toggleTrackLock: (trackId: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  undo: () => void;
  redo: () => void;

  // Helpers for internal use
  _pushHistory: () => void;
}

// Internal history stacks (outside Zustand to avoid serialization)
let undoStack: HistoryEntry[] = [];
let redoStack: HistoryEntry[] = [];

function cloneProject(p: Project): Project {
  return JSON.parse(JSON.stringify(p));
}

function findBlockInProject(
  project: Project,
  blockId: string
): { track: Track; block: Block; blockIndex: number; trackIndex: number } | null {
  for (let ti = 0; ti < project.timeline.tracks.length; ti++) {
    const track = project.timeline.tracks[ti];
    for (let bi = 0; bi < track.blocks.length; bi++) {
      if (track.blocks[bi].id === blockId) {
        return { track, block: track.blocks[bi], blockIndex: bi, trackIndex: ti };
      }
    }
  }
  return null;
}

export const useTimelineStore = create<TimelineState>()((set, get) => ({
  project: null,
  selectedBlockIds: [],
  selectedTrackId: null,
  isPlaying: false,
  canUndo: false,
  canRedo: false,

  setProject: (project: Project) => {
    undoStack = [];
    redoStack = [];
    set({ project: cloneProject(project), canUndo: false, canRedo: false });
  },

  setPlayhead: (ms: number) => {
    const { project } = get();
    if (!project) return;
    const clamped = Math.max(0, Math.min(ms, project.timeline.duration_ms));
    set({
      project: {
        ...project,
        timeline: { ...project.timeline, playhead_ms: clamped },
      },
    });
  },

  setZoom: (zoom: number) => {
    const { project } = get();
    if (!project) return;
    const clamped = Math.max(1, Math.min(500, zoom));
    set({
      project: {
        ...project,
        timeline: { ...project.timeline, zoom: clamped },
      },
    });
  },

  setScrollX: (x: number) => {
    const { project } = get();
    if (!project) return;
    const clamped = Math.max(0, x);
    set({
      project: {
        ...project,
        timeline: { ...project.timeline, scroll_x: clamped },
      },
    });
  },

  selectBlock: (blockId: string, multi?: boolean) => {
    const { selectedBlockIds, project } = get();
    if (!project) return;

    // Find which track this block belongs to
    const found = findBlockInProject(project, blockId);
    if (!found) return;

    if (multi) {
      const isSelected = selectedBlockIds.includes(blockId);
      set({
        selectedBlockIds: isSelected
          ? selectedBlockIds.filter((id) => id !== blockId)
          : [...selectedBlockIds, blockId],
        selectedTrackId: found.track.id,
      });
    } else {
      set({
        selectedBlockIds: [blockId],
        selectedTrackId: found.track.id,
      });
    }
  },

  selectTrack: (trackId: string | null) => {
    set({ selectedTrackId: trackId });
  },

  clearSelection: () => {
    set({ selectedBlockIds: [], selectedTrackId: null });
  },

  moveBlock: (blockId: string, newStartMs: number) => {
    const state = get();
    if (!state.project) return;

    state._pushHistory();

    const project = cloneProject(state.project);
    const found = findBlockInProject(project, blockId);
    if (!found) return;
    if (found.track.locked) return;

    const duration = found.block.end_ms - found.block.start_ms;
    const clampedStart = Math.max(0, Math.round(newStartMs));
    found.block.start_ms = clampedStart;
    found.block.end_ms = clampedStart + duration;

    set({ project });
  },

  resizeBlock: (blockId: string, newStartMs: number, newEndMs: number) => {
    const state = get();
    if (!state.project) return;

    state._pushHistory();

    const project = cloneProject(state.project);
    const found = findBlockInProject(project, blockId);
    if (!found) return;
    if (found.track.locked) return;

    const minDuration = 10; // minimum 10ms
    const start = Math.max(0, Math.round(newStartMs));
    const end = Math.max(start + minDuration, Math.round(newEndMs));
    found.block.start_ms = start;
    found.block.end_ms = end;

    set({ project });
  },

  deleteSelectedBlocks: () => {
    const state = get();
    if (!state.project || state.selectedBlockIds.length === 0) return;

    state._pushHistory();

    const project = cloneProject(state.project);
    const idsToDelete = new Set(state.selectedBlockIds);

    for (const track of project.timeline.tracks) {
      if (track.locked) continue;
      track.blocks = track.blocks.filter((b) => !idsToDelete.has(b.id));
    }

    set({ project, selectedBlockIds: [], selectedTrackId: null });
  },

  toggleTrackLock: (trackId: string) => {
    const { project } = get();
    if (!project) return;
    const newProject = cloneProject(project);
    const track = newProject.timeline.tracks.find((t) => t.id === trackId);
    if (track) {
      track.locked = !track.locked;
      set({ project: newProject });
    }
  },

  toggleTrackVisibility: (trackId: string) => {
    const { project } = get();
    if (!project) return;
    const newProject = cloneProject(project);
    const track = newProject.timeline.tracks.find((t) => t.id === trackId);
    if (track) {
      track.visible = !track.visible;
      set({ project: newProject });
    }
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlayback: () => set((s) => ({ isPlaying: !s.isPlaying })),

  undo: () => {
    const state = get();
    if (undoStack.length === 0 || !state.project) return;

    // Push current state to redo
    redoStack.push({
      project: cloneProject(state.project),
      selectedBlockIds: [...state.selectedBlockIds],
      selectedTrackId: state.selectedTrackId,
    });

    const prev = undoStack.pop()!;
    set({
      project: prev.project,
      selectedBlockIds: prev.selectedBlockIds,
      selectedTrackId: prev.selectedTrackId,
      canUndo: undoStack.length > 0,
      canRedo: true,
    });
  },

  redo: () => {
    const state = get();
    if (redoStack.length === 0 || !state.project) return;

    // Push current state to undo
    undoStack.push({
      project: cloneProject(state.project),
      selectedBlockIds: [...state.selectedBlockIds],
      selectedTrackId: state.selectedTrackId,
    });

    const next = redoStack.pop()!;
    set({
      project: next.project,
      selectedBlockIds: next.selectedBlockIds,
      selectedTrackId: next.selectedTrackId,
      canUndo: true,
      canRedo: redoStack.length > 0,
    });
  },

  _pushHistory: () => {
    const state = get();
    if (!state.project) return;

    undoStack.push({
      project: cloneProject(state.project),
      selectedBlockIds: [...state.selectedBlockIds],
      selectedTrackId: state.selectedTrackId,
    });

    // Trim to MAX_HISTORY
    if (undoStack.length > MAX_HISTORY) {
      undoStack = undoStack.slice(undoStack.length - MAX_HISTORY);
    }

    // Clear redo on new action
    redoStack = [];

    set({ canUndo: true, canRedo: false });
  },
}));
