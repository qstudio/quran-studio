import { create } from "zustand";
import type { Project, MushafStyle } from "@/types/project";
import { useTimelineStore } from "@/stores/timelineStore";

interface AppState {
  view: "library" | "editor";
  inspectorVisible: boolean;
  aspectRatio: "9:16" | "16:9" | "1:1";

  // Display settings
  mushafStyle: MushafStyle;
  backgroundColor: string;
  pageMargin: number;
  showInfo: boolean;

  toggleInspector: () => void;
  setAspectRatio: (ratio: "9:16" | "16:9" | "1:1") => void;
  setMushafStyle: (style: MushafStyle) => void;
  setBackgroundColor: (color: string) => void;
  setPageMargin: (margin: number) => void;
  setShowInfo: (show: boolean) => void;
  openProject: (project: Project) => void;
  closeProject: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "library",
  inspectorVisible: true,
  aspectRatio: "9:16",

  mushafStyle: "madani",
  backgroundColor: "#0A0A0A",
  pageMargin: 20,
  showInfo: true,

  toggleInspector: () =>
    set((state) => ({ inspectorVisible: !state.inspectorVisible })),

  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
  setMushafStyle: (style) => set({ mushafStyle: style }),
  setBackgroundColor: (color) => set({ backgroundColor: color }),
  setPageMargin: (margin) => set({ pageMargin: margin }),
  setShowInfo: (show) => set({ showInfo: show }),

  openProject: (project) => {
    useTimelineStore.getState().setProject(project);
    set({ view: "editor" });
  },

  closeProject: () => {
    useTimelineStore.getState().setProject(null as unknown as Project);
    set({ view: "library", inspectorVisible: true });
  },
}));
