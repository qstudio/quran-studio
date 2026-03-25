import { render, screen, act } from "@testing-library/react";
import { InspectorPanel } from "@/components/Inspector/InspectorPanel";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTestProject } from "@/__tests__/fixtures";

// Mock the preloadProject module used by InspectorPanel
vi.mock("@/lib/preloadProject", () => ({
  preloadProjectPages: vi.fn(),
  setMushafPageFetcher: vi.fn(),
}));

beforeEach(() => {
  act(() => {
    // Reset to no project
    useTimelineStore.setState({ project: null });
  });
});

describe("InspectorPanel", () => {
  it("shows 'No project loaded' when no project in store", () => {
    render(<InspectorPanel />);
    expect(
      screen.getByText("No project loaded"),
      "Should display 'No project loaded' when project is null"
    ).toBeInTheDocument();
  });

  it("shows 'Project' section heading when project is loaded", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });
    render(<InspectorPanel />);
    expect(
      screen.getByText("Project"),
      "Should display 'Project' section heading"
    ).toBeInTheDocument();
  });

  it("shows the project name when project is loaded", () => {
    act(() => {
      useTimelineStore.getState().setProject(
        createTestProject({ name: "My Custom Name" })
      );
    });
    render(<InspectorPanel />);
    expect(
      screen.getByText("My Custom Name"),
      "Should display the project name from the store"
    ).toBeInTheDocument();
  });

  it("shows 'Highlight' section heading when project is loaded", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });
    render(<InspectorPanel />);
    expect(
      screen.getByText("Highlight"),
      "Should display 'Highlight' section heading"
    ).toBeInTheDocument();
  });

  it("shows highlight mode options: Word, Ayah, Both", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });
    render(<InspectorPanel />);
    expect(
      screen.getByText("Word"),
      "Should display 'Word' highlight mode option"
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ayah"),
      "Should display 'Ayah' highlight mode option"
    ).toBeInTheDocument();
    expect(
      screen.getByText("Both"),
      "Should display 'Both' highlight mode option"
    ).toBeInTheDocument();
  });

  it("shows export info (resolution, codec, FPS) when project is loaded", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });
    render(<InspectorPanel />);
    expect(
      screen.getByText("Export"),
      "Should display 'Export' section heading"
    ).toBeInTheDocument();
    // The fixture uses video_codec: "libx264"
    expect(
      screen.getByText("libx264"),
      "Should display the video codec value"
    ).toBeInTheDocument();
    expect(
      screen.getByText("30"),
      "Should display the FPS value"
    ).toBeInTheDocument();
  });
});
