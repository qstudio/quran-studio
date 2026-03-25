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
    expect(container.innerHTML, "Toolbar should render nothing when no project is loaded").toBe("");
  });

  it("renders play button, skip buttons, and time display when project exists", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });

    render(<TimelineToolbar />);

    // Play/pause button
    expect(screen.getByTitle("Play/Pause (Space)"), "Play/Pause button should be rendered when project is loaded").toBeDefined();

    // Skip buttons
    expect(screen.getByTitle("Skip Back (J)"), "Skip Back button should be rendered when project is loaded").toBeDefined();
    expect(screen.getByTitle("Skip Forward (L)"), "Skip Forward button should be rendered when project is loaded").toBeDefined();

    // Time display - formatted time should be present
    expect(screen.getByText(/00:00\.000/), "Current time display should show 00:00.000 at playhead position 0").toBeDefined();
    expect(screen.getByText(/00:10\.000/), "Duration display should show 00:10.000 for a 10-second project").toBeDefined();
  });

  it("play button toggles playback state", () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });

    render(<TimelineToolbar />);

    expect(useTimelineStore.getState().isPlaying, "Playback should start in paused state").toBe(false);

    const playButton = screen.getByTitle("Play/Pause (Space)");
    act(() => {
      fireEvent.click(playButton);
    });

    expect(useTimelineStore.getState().isPlaying, "Clicking play button should start playback").toBe(true);

    act(() => {
      fireEvent.click(playButton);
    });

    expect(useTimelineStore.getState().isPlaying, "Clicking play button again should pause playback").toBe(false);
  });

  it('time display shows "00:00.000 / 00:10.000" for 10s project at 0ms', () => {
    act(() => {
      useTimelineStore.getState().setProject(createTestProject());
    });

    render(<TimelineToolbar />);

    // The time display uses formatTime which produces "MM:SS.mmm"
    // The text is split across child elements so we use a regex on the parent span
    expect(screen.getByText(/00:00\.000/), "Time display should show current position as 00:00.000").toBeDefined();
    expect(screen.getByText(/00:10\.000/), "Time display should show total duration as 00:10.000").toBeDefined();
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
      useTimelineStore.getState().project!.timeline.playhead_ms,
      "Skip Back from 7000ms should set playhead to 2000ms (7000 - 5000)"
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
      useTimelineStore.getState().project!.timeline.playhead_ms,
      "Skip Forward from 0ms should set playhead to 5000ms (0 + 5000)"
    ).toBe(5000);
  });
});
