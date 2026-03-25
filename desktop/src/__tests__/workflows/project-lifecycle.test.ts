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

describe("Workflow: Open project -> edit -> close", () => {
  it("opening a project transitions to editor view with full timeline state", () => {
    const project = createTestProject();

    // User is on library view
    act(() => useAppStore.setState({ view: "library" }));
    expect(getApp().view, "Should start on library view").toBe("library");

    // User opens a project
    act(() => getApp().openProject(project));

    // Should switch to editor
    expect(getApp().view, "View should switch to 'editor' after opening project").toBe("editor");

    // Timeline store should have the project loaded
    const tlState = getTimeline();
    expect(tlState.project, "Timeline store should have a project loaded").not.toBeNull();
    expect(tlState.project!.id, "Loaded project ID should match the opened project").toBe(project.id);
    expect(tlState.project!.name, "Loaded project name should match").toBe("Al-Fatihah - Ayahs 1-7");
    expect(tlState.project!.timeline.tracks.length, "Project should have 3 tracks (audio, mushaf, highlight)").toBe(3);

    // Defaults should be initialized
    expect(tlState.project!.timeline.playhead_ms, "Playhead should be initialized to 0ms").toBe(0);
    expect(tlState.project!.timeline.zoom, "Zoom should be initialized to default 50").toBe(50);
    expect(tlState.project!.timeline.scroll_x, "scroll_x should be initialized to 0").toBe(0);

    // Undo/redo should be clean
    expect(tlState.canUndo, "canUndo should be false for a freshly opened project").toBe(false);
    expect(tlState.canRedo, "canRedo should be false for a freshly opened project").toBe(false);
  });
});

describe("Workflow: Edit and verify state consistency", () => {
  it("multiple edits maintain consistent track/block counts and IDs", () => {
    const project = createTestProject();
    act(() => getApp().openProject(project));

    // Verify initial block count
    const hlTrack = getTimeline().project!.timeline.tracks[2];
    expect(hlTrack.blocks.length, "Highlight track should initially have 3 blocks").toBe(3);
    expect(hlTrack.blocks.map((b) => b.id), "Highlight track block IDs should be hl-1, hl-2, hl-3").toEqual(["hl-1", "hl-2", "hl-3"]);

    // Select and delete hl-2
    act(() => getTimeline().selectBlock("hl-2"));
    act(() => getTimeline().deleteSelectedBlocks());

    // Verify hl-2 gone, others intact
    const tracksAfter = getTimeline().project!.timeline.tracks[2];
    expect(tracksAfter.blocks.length, "Highlight track should have 2 blocks after deleting hl-2").toBe(2);
    expect(tracksAfter.blocks.map((b) => b.id), "Remaining blocks should be hl-1 and hl-3").toEqual(["hl-1", "hl-3"]);

    // Audio and mushaf tracks unaffected
    expect(getTimeline().project!.timeline.tracks[0].blocks.length, "Audio track should still have 1 block").toBe(1);
    expect(getTimeline().project!.timeline.tracks[1].blocks.length, "Mushaf track should still have 1 block").toBe(1);

    // Move hl-3
    act(() => getTimeline().moveBlock("hl-3", 500));
    expect(getTimeline().project!.timeline.tracks[2].blocks[1].start_ms, "hl-3 should be at 500ms after move").toBe(500);

    // Undo move
    act(() => getTimeline().undo());
    expect(getTimeline().project!.timeline.tracks[2].blocks[1].start_ms, "After undo, hl-3 should return to 2000ms").toBe(2000);

    // Undo delete
    act(() => getTimeline().undo());
    expect(getTimeline().project!.timeline.tracks[2].blocks.length, "After undoing delete, highlight track should have 3 blocks again").toBe(3);
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
    expect(getApp().backgroundColor, "Background color should be updated to #FFFFFF").toBe("#FFFFFF");
    expect(getApp().mushafStyle, "Mushaf style should be updated to tajweed").toBe("tajweed");
    expect(getApp().pageMargin, "Page margin should be updated to 40").toBe(40);
    expect(getApp().showInfo, "Show info should be updated to false").toBe(false);
    expect(getApp().aspectRatio, "Aspect ratio should be updated to 16:9").toBe("16:9");

    // Timeline state unaffected
    expect(getTimeline().project!.timeline.tracks.length, "Changing display settings should not affect track count").toBe(3);
    expect(getTimeline().project!.timeline.playhead_ms, "Changing display settings should not affect playhead position").toBe(0);
  });
});

describe("Workflow: Toggle inspector visibility", () => {
  it("Cmd+I toggles inspector, doesn't affect project state", () => {
    const project = createTestProject();
    act(() => getApp().openProject(project));

    expect(getApp().inspectorVisible, "Inspector should start visible").toBe(true);

    act(() => getApp().toggleInspector());
    expect(getApp().inspectorVisible, "Inspector should be hidden after first toggle").toBe(false);

    act(() => getApp().toggleInspector());
    expect(getApp().inspectorVisible, "Inspector should be visible again after second toggle").toBe(true);

    // Project state unchanged throughout
    expect(getTimeline().project!.id, "Toggling inspector should not change the loaded project").toBe(project.id);
  });
});

describe("Workflow: Open project with missing UI fields", () => {
  it("projects from Rust backend (no playhead_ms/zoom/scroll_x) get defaults", () => {
    // Simulate a project from the Rust backend that doesn't have UI fields
    const rustProject = createTestProject();
    // @ts-expect-error -- simulating missing fields from Rust backend
    delete rustProject.timeline.playhead_ms;
    // @ts-expect-error -- simulating missing fields from Rust backend
    delete rustProject.timeline.zoom;
    // @ts-expect-error -- simulating missing fields from Rust backend
    delete rustProject.timeline.scroll_x;

    act(() => getApp().openProject(rustProject));

    // Store should have filled in defaults
    expect(getTimeline().project!.timeline.playhead_ms, "playhead_ms should default to 0 when missing from Rust backend data").toBe(0);
    expect(getTimeline().project!.timeline.zoom, "zoom should default to 50 when missing from Rust backend data").toBe(50);
    expect(getTimeline().project!.timeline.scroll_x, "scroll_x should default to 0 when missing from Rust backend data").toBe(0);
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
    expect(getTimeline().canUndo, "Should have undo history after editing project 1").toBe(true);
    expect(getTimeline().selectedBlockIds, "hl-1 should be selected in project 1").toEqual(["hl-1"]);

    // Open project 2 -- should reset everything
    act(() => getApp().openProject(project2));
    expect(getTimeline().project!.id, "Active project should switch to proj-2").toBe("proj-2");
    expect(getTimeline().project!.name, "Active project name should be 'Project 2'").toBe("Project 2");
    expect(getTimeline().canUndo, "canUndo should be false after switching projects (history cleared)").toBe(false);
    expect(getTimeline().canRedo, "canRedo should be false after switching projects (history cleared)").toBe(false);

    // Playhead/zoom reset to defaults
    expect(getTimeline().project!.timeline.playhead_ms, "Playhead should reset to 0ms for new project").toBe(0);
    expect(getTimeline().project!.timeline.zoom, "Zoom should reset to default 50 for new project").toBe(50);
  });
});
