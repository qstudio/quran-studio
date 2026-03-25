import { render } from "@testing-library/react";
import TimelineEditor from "@/components/Timeline/TimelineEditor";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTestProject } from "@/__tests__/fixtures";
import { act } from "@testing-library/react";

// Mock child components to isolate TimelineEditor tests
vi.mock("@/components/Timeline/TimelineToolbar", () => ({
  default: () => <div data-testid="timeline-toolbar" />,
}));

vi.mock("@/components/Timeline/TimelineCanvas", () => ({
  default: () => (
    <div data-testid="timeline-canvas">
      <canvas />
    </div>
  ),
}));

vi.mock("@/components/Timeline/ZoomControl", () => ({
  default: () => <div data-testid="zoom-control" />,
}));

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

describe("TimelineEditor", () => {
  it("renders without crashing", () => {
    const { container } = render(<TimelineEditor />);
    expect(container).toBeDefined();
  });

  it("renders toolbar, canvas, and zoom control children", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });

    const { getByTestId } = render(<TimelineEditor />);

    expect(getByTestId("timeline-toolbar")).toBeDefined();
    expect(getByTestId("timeline-canvas")).toBeDefined();
    expect(getByTestId("zoom-control")).toBeDefined();
  });

  it("with project: renders canvas element", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });

    const { container } = render(<TimelineEditor />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });
});
