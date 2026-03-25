import { render, screen, fireEvent, act } from "@testing-library/react";
import TimelineToolbar from "@/components/Timeline/TimelineToolbar";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTestProject } from "@/__tests__/fixtures";

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

describe("TimelineToolbar", () => {
  it("returns null when no project is loaded", () => {
    const { container } = render(<TimelineToolbar />);
    expect(container.innerHTML).toBe("");
  });

  it("renders play button, skip buttons, and time display when project exists", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });

    render(<TimelineToolbar />);

    // Play/pause button
    expect(screen.getByTitle("Play/Pause (Space)")).toBeDefined();

    // Skip buttons
    expect(screen.getByTitle("Skip Back (J)")).toBeDefined();
    expect(screen.getByTitle("Skip Forward (L)")).toBeDefined();

    // Time display - formatted time should be present
    expect(screen.getByText(/00:00\.000/)).toBeDefined();
    expect(screen.getByText(/00:10\.000/)).toBeDefined();
  });

  it("play button toggles playback state", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });

    render(<TimelineToolbar />);

    expect(useTimelineStore.getState().isPlaying).toBe(false);

    const playButton = screen.getByTitle("Play/Pause (Space)");
    act(() => {
      fireEvent.click(playButton);
    });

    expect(useTimelineStore.getState().isPlaying).toBe(true);

    act(() => {
      fireEvent.click(playButton);
    });

    expect(useTimelineStore.getState().isPlaying).toBe(false);
  });

  it('time display shows "00:00.000 / 00:10.000" for 10s project at 0ms', () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });

    render(<TimelineToolbar />);

    // The time display uses formatTime which produces "MM:SS.mmm"
    // The text is split across child elements so we use a regex on the parent span
    expect(screen.getByText(/00:00\.000/)).toBeDefined();
    expect(screen.getByText(/00:10\.000/)).toBeDefined();
  });

  it("skip back button decreases playhead by 5000ms", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
      useTimelineStore.getState().setPlayhead(7000);
    });

    render(<TimelineToolbar />);

    const skipBackButton = screen.getByTitle("Skip Back (J)");
    act(() => {
      fireEvent.click(skipBackButton);
    });

    expect(
      useTimelineStore.getState().project!.timeline.playhead_ms
    ).toBe(2000);
  });

  it("skip forward button increases playhead by 5000ms", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });

    render(<TimelineToolbar />);

    const skipForwardButton = screen.getByTitle("Skip Forward (L)");
    act(() => {
      fireEvent.click(skipForwardButton);
    });

    expect(
      useTimelineStore.getState().project!.timeline.playhead_ms
    ).toBe(5000);
  });
});
