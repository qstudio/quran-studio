/**
 * Integration tests: Project lifecycle workflows
 *
 * Simulates the full project lifecycle: creating a project,
 * opening it in the editor, editing, and closing.
 */
import { act } from "@testing-library/react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useAppStore } from "@/stores/appStore";
import { createTestProject } from "@/__tests__/fixtures";

function getTimeline() {
  return useTimelineStore.getState();
}
function getApp() {
  return useAppStore.getState();
}

beforeEach(() => {
  // Reset both stores
  act(() => {
    useAppStore.setState({
      view: "library",
      inspectorVisible: true,
      aspectRatio: "9:16",
      mushafStyle: "madani",
      backgroundColor: "#0A0A0A",
      pageMargin: 20,
      showInfo: true,
    });
    useTimelineStore.getState().setProject(createTestProject());
    // Then reset to null-like state for lifecycle tests
  });
});

describe("Workflow: Open project → edit → close", () => {
  it("opening a project transitions to editor view with full timeline state", () => {
    const project = createTestProject();

    // User is on library view
    act(() => useAppStore.setState({ view: "library" }));
    expect(getApp().view).toBe("library");

    // User opens a project
    act(() => getApp().openProject(project));

    // Should switch to editor
    expect(getApp().view).toBe("editor");

    // Timeline store should have the project loaded
    const tlState = getTimeline();
    expect(tlState.project).not.toBeNull();
    expect(tlState.project!.id).toBe(project.id);
    expect(tlState.project!.name).toBe("Al-Fatihah - Ayahs 1-7");
    expect(tlState.project!.timeline.tracks.length).toBe(3);

    // Defaults should be initialized
    expect(tlState.project!.timeline.playhead_ms).toBe(0);
    expect(tlState.project!.timeline.zoom).toBe(50);
    expect(tlState.project!.timeline.scroll_x).toBe(0);

    // Undo/redo should be clean
    expect(tlState.canUndo).toBe(false);
    expect(tlState.canRedo).toBe(false);
  });
});

describe("Workflow: Edit and verify state consistency", () => {
  it("multiple edits maintain consistent track/block counts and IDs", () => {
    const project = createTestProject();
    act(() => getApp().openProject(project));

    // Verify initial block count
    const hlTrack = getTimeline().project!.timeline.tracks[2];
    expect(hlTrack.blocks.length).toBe(3);
    expect(hlTrack.blocks.map((b) => b.id)).toEqual(["hl-1", "hl-2", "hl-3"]);

    // Select and delete hl-2
    act(() => getTimeline().selectBlock("hl-2"));
    act(() => getTimeline().deleteSelectedBlocks());

    // Verify hl-2 gone, others intact
    const tracksAfter = getTimeline().project!.timeline.tracks[2];
    expect(tracksAfter.blocks.length).toBe(2);
    expect(tracksAfter.blocks.map((b) => b.id)).toEqual(["hl-1", "hl-3"]);

    // Audio and mushaf tracks unaffected
    expect(getTimeline().project!.timeline.tracks[0].blocks.length).toBe(1);
    expect(getTimeline().project!.timeline.tracks[1].blocks.length).toBe(1);

    // Move hl-3
    act(() => getTimeline().moveBlock("hl-3", 500));
    expect(getTimeline().project!.timeline.tracks[2].blocks[1].start_ms).toBe(500);

    // Undo move
    act(() => getTimeline().undo());
    expect(getTimeline().project!.timeline.tracks[2].blocks[1].start_ms).toBe(2000);

    // Undo delete
    act(() => getTimeline().undo());
    expect(getTimeline().project!.timeline.tracks[2].blocks.length).toBe(3);
  });
});

describe("Workflow: Inspector settings persist through edits", () => {
  it("changing display settings doesn't affect timeline state", () => {
    const project = createTestProject();
    act(() => getApp().openProject(project));

    // Change display settings
    act(() => {
      getApp().setBackgroundColor("#FFFFFF");
      getApp().setMushafStyle("tajweed");
      getApp().setPageMargin(40);
      getApp().setShowInfo(false);
      getApp().setAspectRatio("16:9");
    });

    // Verify settings changed
    expect(getApp().backgroundColor).toBe("#FFFFFF");
    expect(getApp().mushafStyle).toBe("tajweed");
    expect(getApp().pageMargin).toBe(40);
    expect(getApp().showInfo).toBe(false);
    expect(getApp().aspectRatio).toBe("16:9");

    // Timeline state unaffected
    expect(getTimeline().project!.timeline.tracks.length).toBe(3);
    expect(getTimeline().project!.timeline.playhead_ms).toBe(0);
  });
});

describe("Workflow: Toggle inspector visibility", () => {
  it("Cmd+I toggles inspector, doesn't affect project state", () => {
    const project = createTestProject();
    act(() => getApp().openProject(project));

    expect(getApp().inspectorVisible).toBe(true);

    act(() => getApp().toggleInspector());
    expect(getApp().inspectorVisible).toBe(false);

    act(() => getApp().toggleInspector());
    expect(getApp().inspectorVisible).toBe(true);

    // Project state unchanged throughout
    expect(getTimeline().project!.id).toBe(project.id);
  });
});

describe("Workflow: Open project with missing UI fields", () => {
  it("projects from Rust backend (no playhead_ms/zoom/scroll_x) get defaults", () => {
    // Simulate a project from the Rust backend that doesn't have UI fields
    const rustProject = createTestProject();
    // @ts-expect-error — simulating missing fields from Rust
    delete rustProject.timeline.playhead_ms;
    // @ts-expect-error
    delete rustProject.timeline.zoom;
    // @ts-expect-error
    delete rustProject.timeline.scroll_x;

    act(() => getApp().openProject(rustProject));

    // Store should have filled in defaults
    expect(getTimeline().project!.timeline.playhead_ms).toBe(0);
    expect(getTimeline().project!.timeline.zoom).toBe(50);
    expect(getTimeline().project!.timeline.scroll_x).toBe(0);
  });
});

describe("Workflow: Rapid project switching", () => {
  it("opening a new project resets all editing state", () => {
    const project1 = createTestProject({ id: "proj-1", name: "Project 1" });
    const project2 = createTestProject({ id: "proj-2", name: "Project 2" });

    // Open project 1, make edits
    act(() => getApp().openProject(project1));
    act(() => getTimeline().selectBlock("hl-1"));
    act(() => getTimeline().moveBlock("hl-1", 500));
    act(() => getTimeline().setPlayhead(3000));
    act(() => getTimeline().setZoom(200));
    expect(getTimeline().canUndo).toBe(true);
    expect(getTimeline().selectedBlockIds).toEqual(["hl-1"]);

    // Open project 2 — should reset everything
    act(() => getApp().openProject(project2));
    expect(getTimeline().project!.id).toBe("proj-2");
    expect(getTimeline().project!.name).toBe("Project 2");
    expect(getTimeline().canUndo).toBe(false);
    expect(getTimeline().canRedo).toBe(false);

    // Playhead/zoom reset to defaults
    expect(getTimeline().project!.timeline.playhead_ms).toBe(0);
    expect(getTimeline().project!.timeline.zoom).toBe(50);
  });
});
