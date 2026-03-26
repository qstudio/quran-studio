/**
 * Integration tests: Web mode (HTTP) workflows
 *
 * Verifies that the frontend works correctly when running in web mode
 * (no Tauri), including project loading via HTTP, error fallbacks,
 * and API_BASE configuration.
 */
import { act } from "@testing-library/react";
import { useTimelineStore } from "@/stores/timelineStore";
import { useAppStore } from "@/stores/appStore";
import type { Project } from "@/types/project";

// ── Fetch mock setup ────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);

  // Reset stores
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

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Helpers ─────────────────────────────────────────────────────────

function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

const SAMPLE_PROJECT: Project = {
  id: "web-proj-1",
  name: "Web Mode Test",
  mode: "mushaf",
  surah: 1,
  ayah_start: 1,
  ayah_end: 7,
  reciter_id: "mishari_alafasy",
  timeline: {
    duration_ms: 35000,
    tracks: [
      {
        id: "track-audio",
        name: "Audio",
        track_type: "audio",
        blocks: [
          {
            id: "audio-1",
            start_ms: 0,
            end_ms: 35000,
            data: { type: "audio", reciter_id: "mishari_alafasy", surah: 1, audio_path: null },
          },
        ],
        visible: true,
        locked: false,
      },
      {
        id: "track-mushaf",
        name: "Mushaf Pages",
        track_type: "mushaf_page",
        blocks: [
          {
            id: "page-1",
            start_ms: 0,
            end_ms: 35000,
            data: { type: "mushaf_page", page: 1, image_path: "/mushaf/page_001.png" },
          },
        ],
        visible: true,
        locked: false,
      },
      {
        id: "track-highlight",
        name: "Highlights",
        track_type: "highlight",
        blocks: [
          {
            id: "hl-1",
            start_ms: 0,
            end_ms: 5000,
            data: {
              type: "highlight",
              surah: 1,
              ayah: 1,
              word_position: 1,
              page: 1,
              x: 50000,
              y: 20000,
              width: 10000,
              height: 5000,
              text_uthmani: "بِسْمِ",
              style: {
                highlight_type: "golden_glow",
                color: "#D4A944",
                opacity: 0.6,
                border_radius: 4,
                padding: 4,
              },
            },
          },
        ],
        visible: true,
        locked: false,
      },
    ],
    playhead_ms: 0,
    zoom: 50,
    scroll_x: 0,
  },
  export_settings: {
    width: 1080,
    height: 1920,
    fps: 30,
    video_codec: "h264",
    audio_codec: "aac",
    crf: 23,
    output_format: "mp4",
    output_path: null,
  },
  created_at: "2025-06-01T00:00:00Z",
  updated_at: "2025-06-01T00:00:00Z",
};

// ── Tests ───────────────────────────────────────────────────────────

describe("Web mode workflow: Fetch projects and open one", () => {
  it("loads a project from HTTP and sets the store correctly", async () => {
    // Mock the load endpoint
    mockFetch.mockResolvedValueOnce(jsonResponse(SAMPLE_PROJECT));

    // Dynamically import to ensure the non-Tauri path is used
    const { useProjects } = await import("@/hooks/useTauri");
    const { loadProject } = useProjects();

    const project = await loadProject("web-proj-1");

    // Open it in the app
    act(() => useAppStore.getState().openProject(project));

    const appState = useAppStore.getState();
    const tlState = useTimelineStore.getState();

    expect(
      appState.view,
      "App should transition to editor view after opening a project"
    ).toBe("editor");

    expect(
      tlState.project,
      "Timeline store should have a non-null project after opening"
    ).not.toBeNull();

    expect(
      tlState.project!.id,
      "Timeline project id should match the loaded project"
    ).toBe("web-proj-1");

    expect(
      tlState.project!.name,
      "Timeline project name should match the loaded project"
    ).toBe("Web Mode Test");

    expect(
      tlState.project!.timeline.tracks.length,
      "Loaded project should have 3 tracks"
    ).toBe(3);

    const trackTypes = tlState.project!.timeline.tracks.map((t) => t.track_type);
    expect(
      trackTypes,
      "Track types should be [audio, mushaf_page, highlight]"
    ).toEqual(["audio", "mushaf_page", "highlight"]);
  });
});

describe("Web mode workflow: Create project via HTTP", () => {
  it("creates a project via HTTP and opens it in the editor", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(SAMPLE_PROJECT));

    const { useProjects } = await import("@/hooks/useTauri");
    const { createProject } = useProjects();

    const project = await createProject({
      mode: "mushaf",
      reciterId: "mishari_alafasy",
      surah: 1,
      ayahStart: 1,
      ayahEnd: 7,
    });

    expect(
      project.id,
      "Created project should have an id"
    ).toBeTruthy();

    expect(
      project.mode,
      "Created project mode should be mushaf"
    ).toBe("mushaf");

    expect(
      project.timeline,
      "Created project should have a timeline"
    ).toBeDefined();

    // Open it
    act(() => useAppStore.getState().openProject(project));

    expect(
      useAppStore.getState().view,
      "View should be editor after opening created project"
    ).toBe("editor");

    expect(
      useTimelineStore.getState().project!.id,
      "Timeline store should hold the created project"
    ).toBe(project.id);
  });
});

describe("Web mode workflow: HTTP errors fall back gracefully", () => {
  it("listReciters returns mock data when server is unreachable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Failed to fetch"));

    const { useReciters } = await import("@/hooks/useTauri");
    const { listReciters } = useReciters();

    const reciters = await listReciters();

    expect(
      reciters.length,
      "Should return mock reciters when HTTP fails"
    ).toBeGreaterThanOrEqual(5);

    // The mock data should still be usable for project creation
    expect(
      reciters[0].id,
      "First mock reciter should have a valid id"
    ).toBeTruthy();

    expect(
      reciters[0].available_surahs.length,
      "Mock reciter should have available surahs"
    ).toBeGreaterThan(0);
  });

  it("listSurahs returns mock data when server returns error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: () => Promise.resolve("Service Unavailable"),
    });

    const { useSurahs } = await import("@/hooks/useTauri");
    const { listSurahs } = useSurahs();

    const surahs = await listSurahs();

    expect(
      surahs.length,
      "Should return mock surahs when server returns 503"
    ).toBeGreaterThan(0);

    expect(
      surahs[0].name_english,
      "First mock surah should be Al-Fatihah"
    ).toBe("Al-Fatihah");
  });

  it("createProject returns mock project when HTTP fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const { useProjects } = await import("@/hooks/useTauri");
    const { createProject } = useProjects();

    const project = await createProject({
      mode: "mushaf",
      reciterId: "mishari_alafasy",
      surah: 1,
      ayahStart: 1,
      ayahEnd: 7,
    });

    expect(
      project.id,
      "Fallback project should have an id even when HTTP fails"
    ).toBeTruthy();

    expect(
      project.timeline.tracks.length,
      "Fallback project should have 3 tracks"
    ).toBe(3);

    // Verify it can still be opened in the editor
    act(() => useAppStore.getState().openProject(project));

    expect(
      useAppStore.getState().view,
      "Editor should open even with a fallback mock project"
    ).toBe("editor");
  });
});

describe("Web mode workflow: API_BASE configuration", () => {
  it("fetch URLs use the default empty API_BASE (same-origin)", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    const { useProjects } = await import("@/hooks/useTauri");
    const { listProjects } = useProjects();
    await listProjects();

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(
      calledUrl,
      "Fetch URL should start with /api/ when API_BASE is empty (same-origin)"
    ).toMatch(/^\/api\//);
  });

  it("fetch URLs include the correct endpoint path", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    const { useSurahs } = await import("@/hooks/useTauri");
    const { listSurahs } = useSurahs();
    await listSurahs();

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(
      calledUrl,
      "Surahs endpoint should be /api/surahs"
    ).toContain("/api/surahs");
  });
});

describe("Web mode workflow: Full round-trip with store interaction", () => {
  it("fetched project can be edited via timeline store", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(SAMPLE_PROJECT));

    const { useProjects } = await import("@/hooks/useTauri");
    const { loadProject } = useProjects();

    const project = await loadProject("web-proj-1");
    act(() => useAppStore.getState().openProject(project));

    // Edit: select and move a highlight block
    const tlStore = useTimelineStore.getState();
    act(() => tlStore.selectBlock("hl-1"));

    expect(
      useTimelineStore.getState().selectedBlockIds,
      "hl-1 should be selected"
    ).toEqual(["hl-1"]);

    act(() => useTimelineStore.getState().moveBlock("hl-1", 1000));

    const movedBlock = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1");

    expect(
      movedBlock!.start_ms,
      "hl-1 should be moved to start at 1000ms"
    ).toBe(1000);

    // Undo should restore original position
    act(() => useTimelineStore.getState().undo());

    const restoredBlock = useTimelineStore
      .getState()
      .project!.timeline.tracks[2].blocks.find((b) => b.id === "hl-1");

    expect(
      restoredBlock!.start_ms,
      "hl-1 should return to 0ms after undo"
    ).toBe(0);
  });
});
