import { render, screen, act } from "@testing-library/react";
import { TransportControls } from "@/components/Preview/TransportControls";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTestProject } from "@/__tests__/fixtures";

beforeEach(() => {
  act(() => {
    // Load a 10s project with playhead at 0
    useTimelineStore.getState().setProject(createTestProject());
    useTimelineStore.getState().setPlayhead(0);
    useTimelineStore.getState().pause();
  });
});

describe("TransportControls", () => {
  it("renders time display '00:00.0 / 00:10.0' for 10s project at 0ms", () => {
    render(<TransportControls />);
    expect(
      screen.getByText("00:00.0 / 00:10.0"),
      "Time display should show '00:00.0 / 00:10.0' for a 10s project at playhead 0ms"
    ).toBeInTheDocument();
  });

  it("shows aspect ratio toggles '9:16', '16:9', '1:1'", () => {
    render(<TransportControls />);
    expect(
      screen.getByText("9:16"),
      "Should display '9:16' aspect ratio toggle"
    ).toBeInTheDocument();
    expect(
      screen.getByText("16:9"),
      "Should display '16:9' aspect ratio toggle"
    ).toBeInTheDocument();
    expect(
      screen.getByText("1:1"),
      "Should display '1:1' aspect ratio toggle"
    ).toBeInTheDocument();
  });

  it("shows play/pause and skip buttons", () => {
    render(<TransportControls />);
    // The component renders 3 buttons: skip back, play/pause, skip forward
    const buttons = screen.getAllByRole("button");
    expect(
      buttons.length,
      "Should render at least 3 buttons (skip back, play/pause, skip forward)"
    ).toBeGreaterThanOrEqual(3);
  });
});
