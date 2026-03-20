import { create } from "zustand";
import type { Project } from "@/types/project";

interface AppState {
  view: "library" | "editor";
  inspectorVisible: boolean;
  aspectRatio: "9:16" | "16:9" | "1:1";
  toggleInspector: () => void;
  setAspectRatio: (ratio: "9:16" | "16:9" | "1:1") => void;
  openProject: (project: Project) => void;
  closeProject: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "library",
  inspectorVisible: true,
  aspectRatio: "9:16",

  toggleInspector: () =>
    set((state) => ({ inspectorVisible: !state.inspectorVisible })),

  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),

  openProject: (_project) =>
    set({ view: "editor" }),

  closeProject: () =>
    set({ view: "library", inspectorVisible: true }),
}));
