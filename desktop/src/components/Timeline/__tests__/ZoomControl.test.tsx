import { render, screen } from "@testing-library/react";
import ZoomControl from "@/components/Timeline/ZoomControl";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTestProject } from "@/__tests__/fixtures";
import { act } from "@testing-library/react";

beforeEach(() => {
  act(() => {
    useTimelineStore.setState({
      project: null,
      selectedBlockIds: [],
      selectedTrackId: null,
      isPlaying: false,
    });
  });
});

describe("ZoomControl", () => {
  it("returns null when no project is loaded", () => {
    const { container } = render(<ZoomControl />);
    expect(container.innerHTML).toBe("");
  });

  it("renders without crashing when project exists", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });

    const { container } = render(<ZoomControl />);

    // Should render zoom in and zoom out buttons
    expect(screen.getByTitle("Zoom In (+)")).toBeDefined();
    expect(screen.getByTitle("Zoom Out (-)")).toBeDefined();

    // Should render a range input (slider)
    const slider = container.querySelector('input[type="range"]');
    expect(slider).not.toBeNull();

    // Should display zoom value
    expect(screen.getByText("50.0x")).toBeDefined();
  });
});
