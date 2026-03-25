import { useProjects, useReciters, useSurahs } from "@/hooks/useTauri";

describe("useTauri mock fallbacks (non-Tauri environment)", () => {
  // ── Reciters ──────────────────────────────────────────────────────

  describe("useReciters", () => {
    it("listReciters() returns at least 5 mock reciters", async () => {
      const api = useReciters();
      const reciters = await api.listReciters();
      expect(
        reciters.length,
        "Should return at least 5 mock reciters when not in Tauri"
      ).toBeGreaterThanOrEqual(5);
    });

    it("mock reciters have required fields (id, name_en, name_ar, available_surahs)", async () => {
      const api = useReciters();
      const reciters = await api.listReciters();
      for (const reciter of reciters) {
        expect(
          reciter.id,
          `Reciter should have a non-empty id, got: ${reciter.id}`
        ).toBeTruthy();
        expect(
          reciter.name_en,
          `Reciter ${reciter.id} should have a non-empty name_en`
        ).toBeTruthy();
        expect(
          reciter.name_ar,
          `Reciter ${reciter.id} should have a non-empty name_ar`
        ).toBeTruthy();
        expect(
          Array.isArray(reciter.available_surahs),
          `Reciter ${reciter.id} available_surahs should be an array`
        ).toBe(true);
        expect(
          reciter.available_surahs.length,
          `Reciter ${reciter.id} should have at least one available surah`
        ).toBeGreaterThan(0);
      }
    });
  });

  // ── Surahs ────────────────────────────────────────────────────────

  describe("useSurahs", () => {
    it("listSurahs() returns mock surahs", async () => {
      const api = useSurahs();
      const surahs = await api.listSurahs();
      expect(
        surahs.length,
        "Should return at least one mock surah"
      ).toBeGreaterThan(0);
    });

    it("mock surahs have required fields (number, name_arabic, name_english, total_ayahs)", async () => {
      const api = useSurahs();
      const surahs = await api.listSurahs();
      for (const surah of surahs) {
        expect(
          typeof surah.number,
          `Surah number should be a number, got ${typeof surah.number}`
        ).toBe("number");
        expect(
          surah.name_arabic,
          `Surah ${surah.number} should have a non-empty name_arabic`
        ).toBeTruthy();
        expect(
          surah.name_english,
          `Surah ${surah.number} should have a non-empty name_english`
        ).toBeTruthy();
        expect(
          surah.total_ayahs,
          `Surah ${surah.number} should have total_ayahs > 0`
        ).toBeGreaterThan(0);
      }
    });

    it("getSurahPages() returns mock pages [1, 2, 3]", async () => {
      const api = useSurahs();
      const pages = await api.getSurahPages(1);
      expect(
        pages,
        "getSurahPages should return [1, 2, 3] as fallback mock data"
      ).toEqual([1, 2, 3]);
    });
  });

  // ── Projects ──────────────────────────────────────────────────────

  describe("useProjects", () => {
    it("listProjects() returns an empty array when not in Tauri", async () => {
      const api = useProjects();
      const projects = await api.listProjects();
      expect(
        projects,
        "listProjects should return an empty array as fallback"
      ).toEqual([]);
    });

    it("createProject() returns a mock project with correct structure", async () => {
      const api = useProjects();
      const project = await api.createProject({
        mode: "mushaf",
        reciterId: "mishari_alafasy",
        surah: 1,
        ayahStart: 1,
        ayahEnd: 7,
      });

      expect(
        project.id,
        "Mock project should have a non-empty id"
      ).toBeTruthy();
      expect(
        project.mode,
        "Mock project mode should be 'mushaf'"
      ).toBe("mushaf");
      expect(
        project.surah,
        "Mock project surah should be 1"
      ).toBe(1);
      expect(
        project.ayah_start,
        "Mock project ayah_start should be 1"
      ).toBe(1);
      expect(
        project.ayah_end,
        "Mock project ayah_end should be 7"
      ).toBe(7);
      expect(
        project.timeline,
        "Mock project should have a timeline object"
      ).toBeDefined();
      expect(
        project.export_settings,
        "Mock project should have export_settings object"
      ).toBeDefined();
    });

    it("created mock project has 3 tracks (audio, mushaf_page, highlight)", async () => {
      const api = useProjects();
      const project = await api.createProject({
        mode: "mushaf",
        reciterId: "mishari_alafasy",
        surah: 1,
        ayahStart: 1,
        ayahEnd: 7,
      });

      const tracks = project.timeline.tracks;
      expect(
        tracks.length,
        "Mock project should have exactly 3 tracks"
      ).toBe(3);

      const trackTypes = tracks.map((t) => t.track_type);
      expect(
        trackTypes,
        "Track types should be [audio, mushaf_page, highlight]"
      ).toEqual(["audio", "mushaf_page", "highlight"]);
    });
  });
});
