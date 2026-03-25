import { act } from "@testing-library/react";
import { useAppStore } from "@/stores/appStore";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTestProject } from "@/__tests__/fixtures";

// Reset store before each test
beforeEach(() => {
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
  });
});

describe("initial state", () => {
  it("has correct defaults", () => {
    const state = useAppStore.getState();
    expect(state.view, "Default view should be 'library'").toBe("library");
    expect(state.inspectorVisible, "Inspector should be visible by default").toBe(true);
    expect(state.aspectRatio, "Default aspect ratio should be '9:16' (portrait/reel)").toBe("9:16");
  });
});

describe("toggleInspector", () => {
  it("flips inspector visibility", () => {
    expect(useAppStore.getState().inspectorVisible, "Inspector should start visible").toBe(true);
    act(() => {
      useAppStore.getState().toggleInspector();
    });
    expect(useAppStore.getState().inspectorVisible, "Inspector should be hidden after first toggle").toBe(false);
    act(() => {
      useAppStore.getState().toggleInspector();
    });
    expect(useAppStore.getState().inspectorVisible, "Inspector should be visible again after second toggle").toBe(true);
  });
});

describe("setAspectRatio", () => {
  it("updates aspect ratio", () => {
    act(() => {
      useAppStore.getState().setAspectRatio("16:9");
    });
    expect(useAppStore.getState().aspectRatio, "Aspect ratio should update to '16:9' after setAspectRatio").toBe("16:9");
  });
});

describe("setMushafStyle", () => {
  it("updates mushaf style", () => {
    act(() => {
      useAppStore.getState().setMushafStyle("tajweed");
    });
    expect(useAppStore.getState().mushafStyle, "Mushaf style should update to 'tajweed' after setMushafStyle").toBe("tajweed");
  });
});

describe("setBackgroundColor", () => {
  it("updates background color", () => {
    act(() => {
      useAppStore.getState().setBackgroundColor("#FFFFFF");
    });
    expect(useAppStore.getState().backgroundColor, "Background color should update to '#FFFFFF' after setBackgroundColor").toBe("#FFFFFF");
  });
});

describe("setPageMargin", () => {
  it("updates page margin", () => {
    act(() => {
      useAppStore.getState().setPageMargin(40);
    });
    expect(useAppStore.getState().pageMargin, "Page margin should update to 40 after setPageMargin").toBe(40);
  });
});

describe("setShowInfo", () => {
  it("updates show info flag", () => {
    act(() => {
      useAppStore.getState().setShowInfo(false);
    });
    expect(useAppStore.getState().showInfo, "showInfo should be false after setShowInfo(false)").toBe(false);
  });
});

describe("openProject", () => {
  it("sets view to editor", () => {
    act(() => {
      useAppStore.getState().openProject(createTestProject());
    });
    expect(useAppStore.getState().view, "View should switch to 'editor' after openProject").toBe("editor");
  });
});

describe("closeProject", () => {
  it("sets view back to library and resets inspector", () => {
    act(() => {
      useAppStore.getState().openProject(createTestProject());
    });
    expect(useAppStore.getState().view, "View should be 'editor' after opening a project").toBe("editor");

    // closeProject internally calls setProject(null as unknown as Project),
    // which may throw when cloning null. We spy to prevent the crash.
    const spy = vi.spyOn(useTimelineStore.getState(), "setProject");
    spy.mockImplementation(() => {});

    act(() => {
      useAppStore.getState().closeProject();
    });
    expect(useAppStore.getState().view, "View should return to 'library' after closeProject").toBe("library");
    expect(useAppStore.getState().inspectorVisible, "Inspector should be reset to visible after closeProject").toBe(true);
    expect(spy, "closeProject should call setProject to clear the timeline state").toHaveBeenCalled();

    spy.mockRestore();
  });
});
