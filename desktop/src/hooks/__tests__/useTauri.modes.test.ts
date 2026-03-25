/**
 * Tests for useTauri mock data generation across all project modes.
 *
 * Verifies that createProject() generates correct track structures,
 * block data shapes, and export settings for each mode when running
 * outside the Tauri shell (i.e., using mock fallbacks).
 */
import { useProjects } from "@/hooks/useTauri";

const { createProject } = useProjects();

const DEFAULT_PARAMS = {
  reciterId: "mishari_alafasy",
  surah: 1,
  ayahStart: 1,
  ayahEnd: 7,
};

// ═══════════════════════════════════════════════════════════════════════
// Caption Mode
// ═══════════════════════════════════════════════════════════════════════

describe("createProject with mode 'caption'", () => {
  it("returns a project with exactly 3 tracks of correct types", async () => {
    const project = await createProject({ mode: "caption", ...DEFAULT_PARAMS });

    const tracks = project.timeline.tracks;
    expect(
      tracks.length,
      "Caption project should have exactly 3 tracks"
    ).toBe(3);

    const trackTypes = tracks.map((t) => t.track_type);
    expect(
      trackTypes,
      "Caption track types should be [audio, text_arabic, text_translation]"
    ).toEqual(["audio", "text_arabic", "text_translation"]);
  });

  it("has an audio track with a single audio block", async () => {
    const project = await createProject({ mode: "caption", ...DEFAULT_PARAMS });

    const audioTrack = project.timeline.tracks.find((t) => t.track_type === "audio");
    expect(
      audioTrack,
      "Caption project should contain an audio track"
    ).toBeDefined();
    expect(
      audioTrack!.blocks.length,
      "Audio track should have at least one block"
    ).toBeGreaterThanOrEqual(1);
    expect(
      audioTrack!.blocks[0].data.type,
      "Audio block data type should be 'audio'"
    ).toBe("audio");
  });

  it("has Arabic text blocks with correct structure", async () => {
    const project = await createProject({ mode: "caption", ...DEFAULT_PARAMS });

    const arabicTrack = project.timeline.tracks.find((t) => t.track_type === "text_arabic");
    expect(
      arabicTrack,
      "Caption project should contain a text_arabic track"
    ).toBeDefined();
    expect(
      arabicTrack!.blocks.length,
      "Arabic text track should have blocks (one per ayah)"
    ).toBeGreaterThan(0);

    for (const block of arabicTrack!.blocks) {
      const data = block.data as any;
      expect(
        data.type,
        `Block ${block.id} data type should be 'text_arabic'`
      ).toBe("text_arabic");
      expect(
        typeof data.text,
        `Block ${block.id} should have a string 'text' field`
      ).toBe("string");
      expect(
        typeof data.surah,
        `Block ${block.id} should have a numeric 'surah' field`
      ).toBe("number");
      expect(
        typeof data.ayah,
        `Block ${block.id} should have a numeric 'ayah' field`
      ).toBe("number");
      expect(
        typeof data.language,
        `Block ${block.id} should have a string 'language' field`
      ).toBe("string");
    }
  });

  it("does not have mushaf_page, highlight, background, or card tracks", async () => {
    const project = await createProject({ mode: "caption", ...DEFAULT_PARAMS });

    const trackTypes = project.timeline.tracks.map((t) => t.track_type);
    expect(
      trackTypes,
      "Caption mode should not include a mushaf_page track"
    ).not.toContain("mushaf_page");
    expect(
      trackTypes,
      "Caption mode should not include a highlight track"
    ).not.toContain("highlight");
    expect(
      trackTypes,
      "Caption mode should not include a background track"
    ).not.toContain("background");
    expect(
      trackTypes,
      "Caption mode should not include a card track"
    ).not.toContain("card");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Reel Mode
// ═══════════════════════════════════════════════════════════════════════

describe("createProject with mode 'reel'", () => {
  it("returns a project with exactly 5 tracks of correct types", async () => {
    const project = await createProject({ mode: "reel", ...DEFAULT_PARAMS });

    const tracks = project.timeline.tracks;
    expect(
      tracks.length,
      "Reel project should have exactly 5 tracks"
    ).toBe(5);

    const trackTypes = tracks.map((t) => t.track_type);
    expect(
      trackTypes,
      "Reel track types should be [background, audio, text_arabic, highlight, text_translation]"
    ).toEqual(["background", "audio", "text_arabic", "highlight", "text_translation"]);
  });

  it("has a background track with a background block", async () => {
    const project = await createProject({ mode: "reel", ...DEFAULT_PARAMS });

    const bgTrack = project.timeline.tracks.find((t) => t.track_type === "background");
    expect(
      bgTrack,
      "Reel project should contain a background track"
    ).toBeDefined();
    expect(
      bgTrack!.blocks.length,
      "Background track should have at least one block"
    ).toBeGreaterThanOrEqual(1);
    expect(
      bgTrack!.blocks[0].data.type,
      "Background block data type should be 'background'"
    ).toBe("background");
  });

  it("has highlight blocks with word-level data", async () => {
    const project = await createProject({ mode: "reel", ...DEFAULT_PARAMS });

    const hlTrack = project.timeline.tracks.find((t) => t.track_type === "highlight");
    expect(
      hlTrack,
      "Reel project should contain a highlight track"
    ).toBeDefined();
    expect(
      hlTrack!.blocks.length,
      "Highlight track should have multiple blocks (word-level)"
    ).toBeGreaterThan(0);

    for (const block of hlTrack!.blocks) {
      const data = block.data as any;
      expect(
        data.type,
        `Highlight block ${block.id} type should be 'highlight'`
      ).toBe("highlight");
      expect(
        typeof data.word_position,
        `Highlight block ${block.id} should have a numeric word_position`
      ).toBe("number");
      expect(
        typeof data.x,
        `Highlight block ${block.id} should have a numeric x coordinate`
      ).toBe("number");
      expect(
        typeof data.y,
        `Highlight block ${block.id} should have a numeric y coordinate`
      ).toBe("number");
      expect(
        typeof data.width,
        `Highlight block ${block.id} should have a numeric width`
      ).toBe("number");
      expect(
        typeof data.height,
        `Highlight block ${block.id} should have a numeric height`
      ).toBe("number");
      expect(
        typeof data.text_uthmani,
        `Highlight block ${block.id} should have a string text_uthmani`
      ).toBe("string");
      expect(
        data.style,
        `Highlight block ${block.id} should have a style object`
      ).toBeDefined();
    }
  });

  it("does not have mushaf_page or card tracks", async () => {
    const project = await createProject({ mode: "reel", ...DEFAULT_PARAMS });

    const trackTypes = project.timeline.tracks.map((t) => t.track_type);
    expect(
      trackTypes,
      "Reel mode should not include a mushaf_page track"
    ).not.toContain("mushaf_page");
    expect(
      trackTypes,
      "Reel mode should not include a card track"
    ).not.toContain("card");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Long-form Mode
// ═══════════════════════════════════════════════════════════════════════

describe("createProject with mode 'long_form'", () => {
  it("returns a project with exactly 6 tracks of correct types", async () => {
    const project = await createProject({ mode: "long_form", ...DEFAULT_PARAMS });

    const tracks = project.timeline.tracks;
    expect(
      tracks.length,
      "Long-form project should have exactly 6 tracks"
    ).toBe(6);

    const trackTypes = tracks.map((t) => t.track_type);
    expect(
      trackTypes,
      "Long-form track types should be [background, audio, text_arabic, highlight, text_translation, card]"
    ).toEqual(["background", "audio", "text_arabic", "highlight", "text_translation", "card"]);
  });

  it("has a card track with card blocks containing card_type and text", async () => {
    const project = await createProject({ mode: "long_form", ...DEFAULT_PARAMS });

    const cardTrack = project.timeline.tracks.find((t) => t.track_type === "card");
    expect(
      cardTrack,
      "Long-form project should contain a card track"
    ).toBeDefined();
    expect(
      cardTrack!.blocks.length,
      "Card track should have at least one card block"
    ).toBeGreaterThanOrEqual(1);

    for (const block of cardTrack!.blocks) {
      const data = block.data as any;
      expect(
        data.type,
        `Card block ${block.id} data type should be 'card'`
      ).toBe("card");
      expect(
        typeof data.card_type,
        `Card block ${block.id} should have a string card_type field`
      ).toBe("string");
      expect(
        ["surah_title", "bismillah", "ayah_end"],
        `Card block ${block.id} card_type '${data.card_type}' should be a valid CardType`
      ).toContain(data.card_type);
      expect(
        typeof data.text,
        `Card block ${block.id} should have a string text field`
      ).toBe("string");
      expect(
        typeof data.background_color,
        `Card block ${block.id} should have a string background_color`
      ).toBe("string");
      expect(
        typeof data.text_color,
        `Card block ${block.id} should have a string text_color`
      ).toBe("string");
    }
  });

  it("has export settings at 1920x1080 (16:9 landscape)", async () => {
    const project = await createProject({ mode: "long_form", ...DEFAULT_PARAMS });

    expect(
      project.export_settings.width,
      "Long-form export width should be 1920"
    ).toBe(1920);
    expect(
      project.export_settings.height,
      "Long-form export height should be 1080"
    ).toBe(1080);
  });

  it("has highlight blocks with word-level data", async () => {
    const project = await createProject({ mode: "long_form", ...DEFAULT_PARAMS });

    const hlTrack = project.timeline.tracks.find((t) => t.track_type === "highlight");
    expect(
      hlTrack,
      "Long-form project should contain a highlight track"
    ).toBeDefined();
    expect(
      hlTrack!.blocks.length,
      "Long-form highlight track should have blocks"
    ).toBeGreaterThan(0);

    const firstBlock = hlTrack!.blocks[0].data as any;
    expect(
      firstBlock.type,
      "Highlight block type should be 'highlight'"
    ).toBe("highlight");
    expect(
      typeof firstBlock.word_position,
      "Highlight block should have numeric word_position"
    ).toBe("number");
    expect(
      typeof firstBlock.text_uthmani,
      "Highlight block should have string text_uthmani"
    ).toBe("string");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Mushaf Mode (existing behavior preserved)
// ═══════════════════════════════════════════════════════════════════════

describe("createProject with mode 'mushaf' (regression)", () => {
  it("returns a project with exactly 3 tracks: audio, mushaf_page, highlight", async () => {
    const project = await createProject({ mode: "mushaf", ...DEFAULT_PARAMS });

    const tracks = project.timeline.tracks;
    expect(
      tracks.length,
      "Mushaf project should have exactly 3 tracks"
    ).toBe(3);

    const trackTypes = tracks.map((t) => t.track_type);
    expect(
      trackTypes,
      "Mushaf track types should be [audio, mushaf_page, highlight]"
    ).toEqual(["audio", "mushaf_page", "highlight"]);
  });

  it("does not have text_arabic, text_translation, background, or card tracks", async () => {
    const project = await createProject({ mode: "mushaf", ...DEFAULT_PARAMS });

    const trackTypes = project.timeline.tracks.map((t) => t.track_type);
    expect(
      trackTypes,
      "Mushaf mode should not include a text_arabic track"
    ).not.toContain("text_arabic");
    expect(
      trackTypes,
      "Mushaf mode should not include a text_translation track"
    ).not.toContain("text_translation");
    expect(
      trackTypes,
      "Mushaf mode should not include a background track"
    ).not.toContain("background");
    expect(
      trackTypes,
      "Mushaf mode should not include a card track"
    ).not.toContain("card");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Cross-mode Arabic text block structure
// ═══════════════════════════════════════════════════════════════════════

describe("Arabic text blocks have correct structure across modes", () => {
  const modesWithArabicText = ["caption", "reel", "long_form"] as const;

  for (const mode of modesWithArabicText) {
    it(`${mode} mode: Arabic text blocks have text, surah, ayah, language fields`, async () => {
      const project = await createProject({ mode, ...DEFAULT_PARAMS });

      const arabicTrack = project.timeline.tracks.find((t) => t.track_type === "text_arabic");
      expect(
        arabicTrack,
        `${mode} project should have a text_arabic track`
      ).toBeDefined();

      for (const block of arabicTrack!.blocks) {
        const data = block.data as any;
        expect(
          data.type,
          `${mode}: block ${block.id} type should be 'text_arabic'`
        ).toBe("text_arabic");
        expect(
          data.text,
          `${mode}: block ${block.id} should have a non-empty text field`
        ).toBeTruthy();
        expect(
          data.surah,
          `${mode}: block ${block.id} surah should be 1`
        ).toBe(1);
        expect(
          typeof data.ayah,
          `${mode}: block ${block.id} ayah should be a number`
        ).toBe("number");
        expect(
          data.language,
          `${mode}: block ${block.id} language should be 'ar'`
        ).toBe("ar");
        expect(
          typeof data.font_size,
          `${mode}: block ${block.id} should have numeric font_size`
        ).toBe("number");
        expect(
          typeof data.color,
          `${mode}: block ${block.id} should have string color`
        ).toBe("string");
        expect(
          typeof data.position,
          `${mode}: block ${block.id} should have string position`
        ).toBe("string");
      }
    });
  }
});
