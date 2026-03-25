import { msToX, xToMs, formatTime, findActiveBlock, clamp } from "@/components/Timeline/utils";
import type { Track } from "@/types/project";

describe("msToX", () => {
  it("returns TRACK_HEADER_WIDTH when ms=0, scrollX=0", () => {
    expect(msToX(0, 50, 0)).toBe(120);
  });

  it("converts ms to pixel position accounting for zoom and scroll", () => {
    // TRACK_HEADER_WIDTH + (2000 * 50) / 1000 - 10 = 120 + 100 - 10 = 210
    expect(msToX(2000, 50, 10)).toBe(210);
  });
});

describe("msToX and xToMs are inverses", () => {
  const cases = [
    { ms: 0, zoom: 50, scrollX: 0 },
    { ms: 5000, zoom: 100, scrollX: 50 },
    { ms: 12345, zoom: 25, scrollX: 200 },
  ];

  it.each(cases)("round-trips ms=$ms zoom=$zoom scrollX=$scrollX", ({ ms, zoom, scrollX }) => {
    const x = msToX(ms, zoom, scrollX);
    const recovered = xToMs(x, zoom, scrollX);
    expect(recovered).toBeCloseTo(ms, 5);
  });
});

describe("formatTime", () => {
  it("formats 0 as 00:00.000", () => {
    expect(formatTime(0)).toBe("00:00.000");
  });

  it("formats 65432 as 01:05.432", () => {
    expect(formatTime(65432)).toBe("01:05.432");
  });

  it("formats 3661000 as 61:01.000", () => {
    expect(formatTime(3661000)).toBe("61:01.000");
  });
});

describe("findActiveBlock", () => {
  const tracks: Track[] = [
    {
      id: "t1",
      name: "Highlights",
      track_type: "highlight",
      blocks: [
        {
          id: "b1",
          start_ms: 0,
          end_ms: 1000,
          data: {
            type: "highlight",
            surah: 1,
            ayah: 1,
            word_position: 1,
            page: 1,
            x: 0,
            y: 0,
            width: 100,
            height: 50,
            text_uthmani: "test",
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
  ];

  it("returns the matching block when timestamp is within range", () => {
    const result = findActiveBlock(tracks, "highlight", 500);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("b1");
  });

  it("returns null when no block matches the timestamp", () => {
    const result = findActiveBlock(tracks, "highlight", 2000);
    expect(result).toBeNull();
  });

  it("returns null for empty tracks", () => {
    const result = findActiveBlock([], "highlight", 500);
    expect(result).toBeNull();
  });
});

describe("clamp", () => {
  it("returns the value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min when value is below", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps to max when value is above", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("returns min when value equals min", () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it("returns max when value equals max", () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});
