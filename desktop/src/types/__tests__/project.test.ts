import { blockDuration, blocksOverlap, timeInBlock } from "@/types/project";
import type { Block } from "@/types/project";

function makeBlock(start_ms: number, end_ms: number): Block {
  return {
    id: "test",
    start_ms,
    end_ms,
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
  };
}

describe("blockDuration", () => {
  it("returns the duration for a normal block", () => {
    const block = makeBlock(1000, 3500);
    expect(blockDuration(block)).toBe(2500);
  });

  it("returns 0 for a zero-duration block", () => {
    const block = makeBlock(5000, 5000);
    expect(blockDuration(block)).toBe(0);
  });
});

describe("blocksOverlap", () => {
  it("returns true for overlapping blocks", () => {
    const a = makeBlock(0, 2000);
    const b = makeBlock(1000, 3000);
    expect(blocksOverlap(a, b)).toBe(true);
  });

  it("returns false for non-overlapping blocks", () => {
    const a = makeBlock(0, 1000);
    const b = makeBlock(2000, 3000);
    expect(blocksOverlap(a, b)).toBe(false);
  });

  it("returns false for adjacent blocks (a.end_ms === b.start_ms)", () => {
    const a = makeBlock(0, 1000);
    const b = makeBlock(1000, 2000);
    expect(blocksOverlap(a, b)).toBe(false);
  });

  it("returns true when one block is contained within the other", () => {
    const a = makeBlock(0, 5000);
    const b = makeBlock(1000, 3000);
    expect(blocksOverlap(a, b)).toBe(true);
  });
});

describe("timeInBlock", () => {
  const block = makeBlock(1000, 3000);

  it("returns true when time is inside the block", () => {
    expect(timeInBlock(2000, block)).toBe(true);
  });

  it("returns true at the start of the block (inclusive)", () => {
    expect(timeInBlock(1000, block)).toBe(true);
  });

  it("returns false at the end of the block (exclusive)", () => {
    expect(timeInBlock(3000, block)).toBe(false);
  });

  it("returns false before the block", () => {
    expect(timeInBlock(500, block)).toBe(false);
  });

  it("returns false after the block", () => {
    expect(timeInBlock(4000, block)).toBe(false);
  });
});
