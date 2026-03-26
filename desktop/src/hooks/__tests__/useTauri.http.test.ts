/**
 * Tests for the HTTP fetch path in useTauri.ts
 *
 * In the test environment (jsdom), window.__TAURI_INTERNALS__ is undefined,
 * so isTauri() returns false and all API functions attempt the HTTP path.
 * We mock global fetch to verify correct endpoints, methods, and bodies.
 */
import {
  useProjects,
  useReciters,
  useSurahs,
  useExport,
  useMushaf,
  useAudioFile,
  useAlignment,
} from "@/hooks/useTauri";

// ── Fetch mock setup ────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Helper: create a successful JSON response ───────────────────────

function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

function bytesResponse(length: number) {
  return {
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(length)),
  };
}

function failedResponse(status: number, body = "") {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(body),
  };
}

// ── listProjects ────────────────────────────────────────────────────

describe("HTTP path: listProjects", () => {
  it("calls GET /api/projects when fetch succeeds", async () => {
    const mockData = [{ id: "p1", name: "Test Project" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(mockData));

    const { listProjects } = useProjects();
    const result = await listProjects();

    expect(
      mockFetch,
      "Should call fetch for /api/projects"
    ).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects"),
      expect.anything()
    );
    expect(result.length, "Should return 1 project from HTTP response").toBe(1);
    expect(result[0].id, "Returned project id should be 'p1'").toBe("p1");
  });

  it("returns empty array when both Tauri and HTTP fail", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { listProjects } = useProjects();
    const result = await listProjects();

    expect(
      result,
      "Should return empty array as fallback when fetch fails"
    ).toEqual([]);
  });
});

// ── listReciters ────────────────────────────────────────────────────

describe("HTTP path: listReciters", () => {
  it("calls GET /api/reciters when fetch succeeds", async () => {
    const mockReciters = [
      { id: "test_reciter", name_en: "Test", name_ar: "تست", style: "Murattal", available_surahs: [1] },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(mockReciters));

    const { listReciters } = useReciters();
    const result = await listReciters();

    expect(
      mockFetch,
      "Should call fetch for /api/reciters"
    ).toHaveBeenCalledWith(
      expect.stringContaining("/api/reciters"),
      expect.anything()
    );
    expect(result.length, "Should return 1 reciter from HTTP response").toBe(1);
    expect(result[0].id, "Returned reciter id should be 'test_reciter'").toBe("test_reciter");
  });

  it("falls back to MOCK_RECITERS when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { listReciters } = useReciters();
    const result = await listReciters();

    expect(
      result.length,
      "Should return at least 5 mock reciters when fetch fails"
    ).toBeGreaterThanOrEqual(5);
    expect(
      result[0].id,
      "First mock reciter should be mishari_alafasy"
    ).toBe("mishari_alafasy");
  });
});

// ── listSurahs ──────────────────────────────────────────────────────

describe("HTTP path: listSurahs", () => {
  it("calls GET /api/surahs when fetch succeeds", async () => {
    const mockSurahs = [
      { number: 1, name_arabic: "الفاتحة", name_english: "Al-Fatihah", total_ayahs: 7 },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(mockSurahs));

    const { listSurahs } = useSurahs();
    const result = await listSurahs();

    expect(
      mockFetch,
      "Should call fetch for /api/surahs"
    ).toHaveBeenCalledWith(
      expect.stringContaining("/api/surahs"),
      expect.anything()
    );
    expect(result.length, "Should return 1 surah from HTTP response").toBe(1);
    expect(result[0].number, "Returned surah number should be 1").toBe(1);
  });

  it("falls back to MOCK_SURAHS when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { listSurahs } = useSurahs();
    const result = await listSurahs();

    expect(
      result.length,
      "Should return mock surahs when fetch fails"
    ).toBeGreaterThan(0);
    expect(
      result[0].name_english,
      "First mock surah should be Al-Fatihah"
    ).toBe("Al-Fatihah");
  });
});

// ── createProject ───────────────────────────────────────────────────

describe("HTTP path: createProject", () => {
  it("calls POST /api/projects with correct body when fetch succeeds", async () => {
    const mockProject = {
      id: "new-proj",
      name: "Al-Fatihah 1-7",
      mode: "mushaf",
      surah: 1,
      ayah_start: 1,
      ayah_end: 7,
      reciter_id: "mishari_alafasy",
      timeline: { duration_ms: 35000, tracks: [], playhead_ms: 0, zoom: 50, scroll_x: 0 },
      export_settings: {},
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(mockProject));

    const { createProject } = useProjects();
    const params = {
      mode: "mushaf",
      reciterId: "mishari_alafasy",
      surah: 1,
      ayahStart: 1,
      ayahEnd: 7,
    };
    const result = await createProject(params);

    expect(
      mockFetch,
      "Should call fetch for POST /api/projects"
    ).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(params),
      })
    );
    expect(result.id, "Returned project id should be 'new-proj'").toBe("new-proj");
  });

  it("falls back to mock project when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { createProject } = useProjects();
    const result = await createProject({
      mode: "mushaf",
      reciterId: "mishari_alafasy",
      surah: 1,
      ayahStart: 1,
      ayahEnd: 7,
    });

    expect(
      result.mode,
      "Fallback mock project mode should be 'mushaf'"
    ).toBe("mushaf");
    expect(
      result.timeline,
      "Fallback mock project should have a timeline"
    ).toBeDefined();
    expect(
      result.timeline.tracks.length,
      "Fallback mock project should have 3 tracks"
    ).toBe(3);
  });
});

// ── loadProject ─────────────────────────────────────────────────────

describe("HTTP path: loadProject", () => {
  it("calls GET /api/projects/:id when not in Tauri", async () => {
    const mockProject = {
      id: "proj-123",
      name: "Test",
      mode: "mushaf",
      surah: 1,
      ayah_start: 1,
      ayah_end: 7,
      reciter_id: "mishari_alafasy",
      timeline: { duration_ms: 35000, tracks: [], playhead_ms: 0, zoom: 50, scroll_x: 0 },
      export_settings: {},
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(mockProject));

    const { loadProject } = useProjects();
    const result = await loadProject("proj-123");

    expect(
      mockFetch,
      "Should call fetch for /api/projects/proj-123"
    ).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/proj-123"),
      expect.anything()
    );
    expect(result.id, "Returned project id should be 'proj-123'").toBe("proj-123");
  });
});

// ── saveProject ─────────────────────────────────────────────────────

describe("HTTP path: saveProject", () => {
  it("calls PUT /api/projects/:id with project as body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(null));

    const { saveProject } = useProjects();
    const project = {
      id: "proj-save",
      name: "Save Test",
      mode: "mushaf" as const,
      surah: 1,
      ayah_start: 1,
      ayah_end: 7,
      reciter_id: "mishari_alafasy",
      timeline: { duration_ms: 35000, tracks: [] as any[], playhead_ms: 0, zoom: 50, scroll_x: 0 },
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
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    await saveProject(project);

    expect(
      mockFetch,
      "Should call fetch for PUT /api/projects/proj-save"
    ).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/proj-save"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(project),
      })
    );
  });
});

// ── deleteProject ───────────────────────────────────────────────────

describe("HTTP path: deleteProject", () => {
  it("calls DELETE /api/projects/:id", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(null));

    const { deleteProject } = useProjects();
    await deleteProject("proj-del");

    expect(
      mockFetch,
      "Should call fetch with DELETE method for /api/projects/proj-del"
    ).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/proj-del"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ── getMushafPage (binary) ──────────────────────────────────────────

describe("HTTP path: getMushafPage", () => {
  it("calls GET /api/mushaf/:page and returns byte array", async () => {
    mockFetch.mockResolvedValueOnce(bytesResponse(256));

    const { getMushafPage } = useMushaf();
    const result = await getMushafPage(42);

    expect(
      mockFetch,
      "Should call fetch for /api/mushaf/42"
    ).toHaveBeenCalledWith(expect.stringContaining("/api/mushaf/42"));
    expect(
      Array.isArray(result),
      "getMushafPage should return an array of bytes"
    ).toBe(true);
    expect(
      result.length,
      "Returned byte array length should match the ArrayBuffer size (256)"
    ).toBe(256);
  });

  it("appends style query parameter when provided", async () => {
    mockFetch.mockResolvedValueOnce(bytesResponse(100));

    const { getMushafPage } = useMushaf();
    await getMushafPage(1, "tajweed");

    expect(
      mockFetch,
      "Should include ?style=tajweed in the URL"
    ).toHaveBeenCalledWith(expect.stringContaining("/api/mushaf/1?style=tajweed"));
  });
});

// ── getAudioFile (binary) ───────────────────────────────────────────

describe("HTTP path: getAudioFile", () => {
  it("calls GET /api/audio/:reciter/:surah and returns byte array", async () => {
    mockFetch.mockResolvedValueOnce(bytesResponse(512));

    const { getAudioFile } = useAudioFile();
    const result = await getAudioFile("mishari_alafasy", 1);

    expect(
      mockFetch,
      "Should call fetch for /api/audio/mishari_alafasy/1"
    ).toHaveBeenCalledWith(expect.stringContaining("/api/audio/mishari_alafasy/1"));
    expect(
      result.length,
      "Returned byte array length should be 512"
    ).toBe(512);
  });
});

// ── getExportProgress ───────────────────────────────────────────────

describe("HTTP path: getExportProgress", () => {
  it("calls GET /api/export/progress and returns a number", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(0.75));

    const { getExportProgress } = useExport();
    const result = await getExportProgress();

    expect(
      mockFetch,
      "Should call fetch for /api/export/progress"
    ).toHaveBeenCalledWith(
      expect.stringContaining("/api/export/progress"),
      expect.anything()
    );
    expect(
      result,
      "Export progress should be 0.75"
    ).toBe(0.75);
  });
});

// ── getAlignmentProgress ────────────────────────────────────────────

describe("HTTP path: getAlignmentProgress", () => {
  it("calls GET /api/alignment/progress and returns a number", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(0.5));

    const { getAlignmentProgress } = useAlignment();
    const result = await getAlignmentProgress();

    expect(
      mockFetch,
      "Should call fetch for /api/alignment/progress"
    ).toHaveBeenCalledWith(
      expect.stringContaining("/api/alignment/progress"),
      expect.anything()
    );
    expect(
      result,
      "Alignment progress should be 0.5"
    ).toBe(0.5);
  });
});

// ── HTTP error handling ─────────────────────────────────────────────

describe("HTTP error handling", () => {
  it("httpFetch throws on non-ok response with status text", async () => {
    mockFetch.mockResolvedValueOnce(failedResponse(500, "Internal Server Error"));

    const { loadProject } = useProjects();

    await expect(
      loadProject("bad-id"),
      "loadProject should throw when HTTP returns 500"
    ).rejects.toThrow("HTTP 500");
  });

  it("listReciters returns MOCK_RECITERS when server returns 500", async () => {
    mockFetch.mockResolvedValueOnce(failedResponse(500, "Server down"));

    const { listReciters } = useReciters();
    const result = await listReciters();

    expect(
      result.length,
      "Should fall back to mock reciters on HTTP 500"
    ).toBeGreaterThanOrEqual(5);
  });

  it("listSurahs returns MOCK_SURAHS when server returns 404", async () => {
    mockFetch.mockResolvedValueOnce(failedResponse(404, "Not Found"));

    const { listSurahs } = useSurahs();
    const result = await listSurahs();

    expect(
      result.length,
      "Should fall back to mock surahs on HTTP 404"
    ).toBeGreaterThan(0);
  });
});

// ── Content-Type header ─────────────────────────────────────────────

describe("HTTP request headers", () => {
  it("POST requests include Content-Type: application/json", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "new" }));

    const { createProject } = useProjects();
    await createProject({
      mode: "mushaf",
      reciterId: "mishari_alafasy",
      surah: 1,
      ayahStart: 1,
      ayahEnd: 7,
    });

    const fetchCall = mockFetch.mock.calls[0];
    const options = fetchCall[1];
    expect(
      options.headers,
      "POST request should include Content-Type header"
    ).toEqual({ "Content-Type": "application/json" });
  });

  it("GET requests do not include Content-Type header", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    const { listProjects } = useProjects();
    await listProjects();

    const fetchCall = mockFetch.mock.calls[0];
    const options = fetchCall[1];
    expect(
      options.headers,
      "GET request should not include Content-Type header"
    ).toBeUndefined();
  });
});
