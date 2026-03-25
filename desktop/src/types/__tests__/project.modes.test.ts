/**
 * Tests for new TypeScript types: TextBlockData, BackgroundBlockData,
 * CardBlockData, VideoBlockData, and their integration with existing
 * utility functions (blockDuration, blocksOverlap, timeInBlock).
 *
 * These tests verify type correctness at runtime and ensure the
 * utility functions work with all new block data variants.
 */
import {
  blockDuration,
  blocksOverlap,
  timeInBlock,
} from "@/types/project";
import type {
  Block,
  BlockData,
  TextBlockData,
  BackgroundBlockData,
  CardBlockData,
  VideoBlockData,
  TextPosition,
  CardType,
} from "@/types/project";

// ─── Helper ───────────────────────────────────────────────────────────

function makeBlock(start_ms: number, end_ms: number, data: BlockData): Block {
  return { id: `test-${start_ms}-${end_ms}`, start_ms, end_ms, data };
}

// ═══════════════════════════════════════════════════════════════════════
// TextBlockData
// ═══════════════════════════════════════════════════════════════════════

describe("TextBlockData", () => {
  it("can be created with all required fields for text_arabic", () => {
    const data: TextBlockData = {
      type: "text_arabic",
      text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
      surah: 1,
      ayah: 1,
      language: "ar",
      font_size: 48,
      color: "#FFFFFF",
      position: "center",
    };

    expect(data.type, "TextBlockData type should be 'text_arabic'").toBe("text_arabic");
    expect(data.text, "TextBlockData text should contain Arabic text").toBeTruthy();
    expect(data.surah, "TextBlockData surah should be 1").toBe(1);
    expect(data.ayah, "TextBlockData ayah should be 1").toBe(1);
    expect(data.language, "TextBlockData language should be 'ar'").toBe("ar");
    expect(data.font_size, "TextBlockData font_size should be 48").toBe(48);
    expect(data.color, "TextBlockData color should be '#FFFFFF'").toBe("#FFFFFF");
    expect(data.position, "TextBlockData position should be 'center'").toBe("center");
  });

  it("can be created with all required fields for text_translation", () => {
    const data: TextBlockData = {
      type: "text_translation",
      text: "In the name of God, the Most Gracious, the Most Merciful",
      surah: 1,
      ayah: 1,
      language: "en",
      font_size: 24,
      color: "#A0A0A0",
      position: "bottom",
    };

    expect(data.type, "TextBlockData type should be 'text_translation'").toBe("text_translation");
    expect(data.language, "Translation language should be 'en'").toBe("en");
    expect(data.position, "Translation position should be 'bottom'").toBe("bottom");
  });

  it("accepts all valid TextPosition values", () => {
    const positions: TextPosition[] = ["top", "center", "bottom"];

    for (const pos of positions) {
      const data: TextBlockData = {
        type: "text_arabic",
        text: "test",
        surah: 1,
        ayah: 1,
        language: "ar",
        font_size: 48,
        color: "#FFF",
        position: pos,
      };
      expect(
        data.position,
        `TextBlockData should accept position '${pos}'`
      ).toBe(pos);
    }
  });

  it("supports optional background field", () => {
    const dataWithBg: TextBlockData = {
      type: "text_arabic",
      text: "test",
      surah: 1,
      ayah: 1,
      language: "ar",
      font_size: 48,
      color: "#FFF",
      position: "center",
      background: { color: "#000000", opacity: 0.5, padding: 8 },
    };

    expect(
      dataWithBg.background,
      "TextBlockData should support optional background object"
    ).toBeDefined();
    expect(
      dataWithBg.background!.color,
      "TextBackground color should be '#000000'"
    ).toBe("#000000");
    expect(
      dataWithBg.background!.opacity,
      "TextBackground opacity should be 0.5"
    ).toBe(0.5);
    expect(
      dataWithBg.background!.padding,
      "TextBackground padding should be 8"
    ).toBe(8);

    const dataWithoutBg: TextBlockData = {
      type: "text_arabic",
      text: "test",
      surah: 1,
      ayah: 1,
      language: "ar",
      font_size: 48,
      color: "#FFF",
      position: "center",
    };

    expect(
      dataWithoutBg.background,
      "TextBlockData background should be undefined when not provided"
    ).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BackgroundBlockData
// ═══════════════════════════════════════════════════════════════════════

describe("BackgroundBlockData", () => {
  it("works with image_path", () => {
    const data: BackgroundBlockData = {
      type: "background",
      image_path: "/assets/bg-mosque.jpg",
    };

    expect(data.type, "BackgroundBlockData type should be 'background'").toBe("background");
    expect(
      data.image_path,
      "BackgroundBlockData should have image_path '/assets/bg-mosque.jpg'"
    ).toBe("/assets/bg-mosque.jpg");
    expect(
      data.color,
      "BackgroundBlockData color should be undefined when image_path is provided"
    ).toBeUndefined();
  });

  it("works with color", () => {
    const data: BackgroundBlockData = {
      type: "background",
      color: "#0A0A0A",
    };

    expect(data.type, "BackgroundBlockData type should be 'background'").toBe("background");
    expect(
      data.color,
      "BackgroundBlockData should have color '#0A0A0A'"
    ).toBe("#0A0A0A");
    expect(
      data.image_path,
      "BackgroundBlockData image_path should be undefined when color is provided"
    ).toBeUndefined();
  });

  it("works with both image_path and color", () => {
    const data: BackgroundBlockData = {
      type: "background",
      image_path: "/assets/bg.jpg",
      color: "#000000",
    };

    expect(
      data.image_path,
      "BackgroundBlockData should support both image_path and color simultaneously"
    ).toBe("/assets/bg.jpg");
    expect(
      data.color,
      "BackgroundBlockData color should be set when both provided"
    ).toBe("#000000");
  });

  it("works with neither image_path nor color (both optional)", () => {
    const data: BackgroundBlockData = {
      type: "background",
    };

    expect(data.type, "BackgroundBlockData type should be 'background'").toBe("background");
    expect(
      data.image_path,
      "BackgroundBlockData image_path should be undefined when not provided"
    ).toBeUndefined();
    expect(
      data.color,
      "BackgroundBlockData color should be undefined when not provided"
    ).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CardBlockData
// ═══════════════════════════════════════════════════════════════════════

describe("CardBlockData", () => {
  it("works with card_type 'surah_title'", () => {
    const data: CardBlockData = {
      type: "card",
      card_type: "surah_title",
      text: "Al-Fatihah",
      background_color: "#000000",
      text_color: "#FFFFFF",
    };

    expect(data.type, "CardBlockData type should be 'card'").toBe("card");
    expect(data.card_type, "CardBlockData card_type should be 'surah_title'").toBe("surah_title");
    expect(data.text, "CardBlockData text should be 'Al-Fatihah'").toBe("Al-Fatihah");
    expect(data.background_color, "CardBlockData background_color should be '#000000'").toBe("#000000");
    expect(data.text_color, "CardBlockData text_color should be '#FFFFFF'").toBe("#FFFFFF");
  });

  it("works with card_type 'bismillah'", () => {
    const data: CardBlockData = {
      type: "card",
      card_type: "bismillah",
      text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
      background_color: "#111111",
      text_color: "#D4A944",
    };

    expect(data.card_type, "CardBlockData card_type should be 'bismillah'").toBe("bismillah");
    expect(
      data.text,
      "CardBlockData text for bismillah should contain Bismillah text"
    ).toBeTruthy();
  });

  it("works with card_type 'ayah_end'", () => {
    const data: CardBlockData = {
      type: "card",
      card_type: "ayah_end",
      text: "End of Surah Al-Fatihah",
      background_color: "#000000",
      text_color: "#CCCCCC",
    };

    expect(data.card_type, "CardBlockData card_type should be 'ayah_end'").toBe("ayah_end");
  });

  it("accepts all valid CardType values", () => {
    const cardTypes: CardType[] = ["surah_title", "bismillah", "ayah_end"];

    for (const ct of cardTypes) {
      const data: CardBlockData = {
        type: "card",
        card_type: ct,
        text: `Test ${ct}`,
        background_color: "#000",
        text_color: "#FFF",
      };
      expect(
        data.card_type,
        `CardBlockData should accept card_type '${ct}'`
      ).toBe(ct);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// VideoBlockData
// ═══════════════════════════════════════════════════════════════════════

describe("VideoBlockData", () => {
  it("has correct structure with video_path", () => {
    const data: VideoBlockData = {
      type: "video",
      video_path: "/media/recitation.mp4",
    };

    expect(data.type, "VideoBlockData type should be 'video'").toBe("video");
    expect(
      data.video_path,
      "VideoBlockData video_path should be '/media/recitation.mp4'"
    ).toBe("/media/recitation.mp4");
  });

  it("video_path can be any string path", () => {
    const paths = ["/absolute/path.mp4", "relative/path.mov", "file.webm"];

    for (const path of paths) {
      const data: VideoBlockData = { type: "video", video_path: path };
      expect(
        data.video_path,
        `VideoBlockData should accept video_path '${path}'`
      ).toBe(path);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BlockData union accepts all new variants
// ═══════════════════════════════════════════════════════════════════════

describe("BlockData union type", () => {
  it("accepts TextBlockData (text_arabic)", () => {
    const data: BlockData = {
      type: "text_arabic",
      text: "test", surah: 1, ayah: 1, language: "ar",
      font_size: 48, color: "#FFF", position: "center",
    };
    expect(data.type, "BlockData union should accept 'text_arabic'").toBe("text_arabic");
  });

  it("accepts TextBlockData (text_translation)", () => {
    const data: BlockData = {
      type: "text_translation",
      text: "test", surah: 1, ayah: 1, language: "en",
      font_size: 24, color: "#AAA", position: "bottom",
    };
    expect(data.type, "BlockData union should accept 'text_translation'").toBe("text_translation");
  });

  it("accepts BackgroundBlockData", () => {
    const data: BlockData = { type: "background", color: "#000" };
    expect(data.type, "BlockData union should accept 'background'").toBe("background");
  });

  it("accepts CardBlockData", () => {
    const data: BlockData = {
      type: "card", card_type: "surah_title", text: "Test",
      background_color: "#000", text_color: "#FFF",
    };
    expect(data.type, "BlockData union should accept 'card'").toBe("card");
  });

  it("accepts VideoBlockData", () => {
    const data: BlockData = { type: "video", video_path: "/test.mp4" };
    expect(data.type, "BlockData union should accept 'video'").toBe("video");
  });

  it("accepts AudioBlockData (existing)", () => {
    const data: BlockData = { type: "audio", reciter_id: "test", surah: 1, audio_path: null };
    expect(data.type, "BlockData union should accept 'audio'").toBe("audio");
  });

  it("accepts HighlightBlockData (existing)", () => {
    const data: BlockData = {
      type: "highlight", surah: 1, ayah: 1, word_position: 1, page: 1,
      x: 0, y: 0, width: 100, height: 50, text_uthmani: "test",
      style: { highlight_type: "golden_glow", color: "#D4A944", opacity: 0.6, border_radius: 4, padding: 4 },
    };
    expect(data.type, "BlockData union should accept 'highlight'").toBe("highlight");
  });

  it("accepts MushafPageBlockData (existing)", () => {
    const data: BlockData = { type: "mushaf_page", page: 1, image_path: "/page_001.png" };
    expect(data.type, "BlockData union should accept 'mushaf_page'").toBe("mushaf_page");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Utility functions with new block types
// ═══════════════════════════════════════════════════════════════════════

describe("blockDuration works with new block types", () => {
  it("returns correct duration for a text_arabic block", () => {
    const block = makeBlock(0, 3000, {
      type: "text_arabic", text: "test", surah: 1, ayah: 1,
      language: "ar", font_size: 48, color: "#FFF", position: "center",
    });
    expect(
      blockDuration(block),
      "blockDuration for text block [0, 3000] should be 3000ms"
    ).toBe(3000);
  });

  it("returns correct duration for a background block", () => {
    const block = makeBlock(0, 10000, { type: "background", color: "#000" });
    expect(
      blockDuration(block),
      "blockDuration for background block [0, 10000] should be 10000ms"
    ).toBe(10000);
  });

  it("returns correct duration for a card block", () => {
    const block = makeBlock(500, 3500, {
      type: "card", card_type: "surah_title", text: "Al-Fatihah",
      background_color: "#000", text_color: "#FFF",
    });
    expect(
      blockDuration(block),
      "blockDuration for card block [500, 3500] should be 3000ms"
    ).toBe(3000);
  });

  it("returns correct duration for a video block", () => {
    const block = makeBlock(1000, 5000, { type: "video", video_path: "/test.mp4" });
    expect(
      blockDuration(block),
      "blockDuration for video block [1000, 5000] should be 4000ms"
    ).toBe(4000);
  });
});

describe("blocksOverlap works with new block types", () => {
  it("detects overlap between text and card blocks", () => {
    const textBlock = makeBlock(0, 3000, {
      type: "text_arabic", text: "test", surah: 1, ayah: 1,
      language: "ar", font_size: 48, color: "#FFF", position: "center",
    });
    const cardBlock = makeBlock(2000, 5000, {
      type: "card", card_type: "surah_title", text: "Title",
      background_color: "#000", text_color: "#FFF",
    });

    expect(
      blocksOverlap(textBlock, cardBlock),
      "Text block [0,3000] and card block [2000,5000] should overlap in [2000,3000]"
    ).toBe(true);
  });

  it("detects non-overlap between background and video blocks", () => {
    const bgBlock = makeBlock(0, 5000, { type: "background", color: "#000" });
    const videoBlock = makeBlock(6000, 10000, { type: "video", video_path: "/test.mp4" });

    expect(
      blocksOverlap(bgBlock, videoBlock),
      "Background block [0,5000] and video block [6000,10000] should not overlap"
    ).toBe(false);
  });
});

describe("timeInBlock works with new block types", () => {
  it("correctly identifies time within a text_translation block", () => {
    const block = makeBlock(1000, 4000, {
      type: "text_translation", text: "Praise be to God", surah: 1, ayah: 2,
      language: "en", font_size: 24, color: "#AAA", position: "bottom",
    });

    expect(
      timeInBlock(2000, block),
      "Time 2000ms should be inside text_translation block [1000,4000]"
    ).toBe(true);
    expect(
      timeInBlock(500, block),
      "Time 500ms should be before text_translation block [1000,4000]"
    ).toBe(false);
    expect(
      timeInBlock(4000, block),
      "Time 4000ms (end boundary) should be outside text_translation block [1000,4000] (exclusive)"
    ).toBe(false);
  });

  it("correctly identifies time within a card block", () => {
    const block = makeBlock(0, 3000, {
      type: "card", card_type: "bismillah", text: "Bismillah",
      background_color: "#000", text_color: "#FFF",
    });

    expect(
      timeInBlock(0, block),
      "Time 0ms (start boundary) should be inside card block [0,3000] (inclusive)"
    ).toBe(true);
    expect(
      timeInBlock(1500, block),
      "Time 1500ms should be inside card block [0,3000]"
    ).toBe(true);
    expect(
      timeInBlock(3000, block),
      "Time 3000ms (end boundary) should be outside card block [0,3000] (exclusive)"
    ).toBe(false);
  });
});
