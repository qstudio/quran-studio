import { currentPlayheadMs, setCurrentPlayheadMs } from "@/stores/playheadSync";

// The module uses a mutable `let` export, so we need to re-import to read the
// live binding. Vitest's ESM handling preserves live bindings, but we import
// the whole module namespace to be safe.
import * as sync from "@/stores/playheadSync";

beforeEach(() => {
  // Reset to 0 before each test
  setCurrentPlayheadMs(0);
});

describe("playheadSync", () => {
  it("has an initial value of 0", () => {
    expect(
      sync.currentPlayheadMs,
      "currentPlayheadMs should start at 0 before any updates"
    ).toBe(0);
  });

  it("setCurrentPlayheadMs updates the value", () => {
    setCurrentPlayheadMs(5000);
    expect(
      sync.currentPlayheadMs,
      "currentPlayheadMs should be 5000 after calling setCurrentPlayheadMs(5000)"
    ).toBe(5000);
  });

  it("tracks multiple sequential updates correctly", () => {
    setCurrentPlayheadMs(1000);
    expect(
      sync.currentPlayheadMs,
      "currentPlayheadMs should be 1000 after first update"
    ).toBe(1000);

    setCurrentPlayheadMs(2500);
    expect(
      sync.currentPlayheadMs,
      "currentPlayheadMs should be 2500 after second update"
    ).toBe(2500);

    setCurrentPlayheadMs(9999);
    expect(
      sync.currentPlayheadMs,
      "currentPlayheadMs should be 9999 after third update"
    ).toBe(9999);
  });

  it("stores negative values as-is (no clamping in this module)", () => {
    setCurrentPlayheadMs(-500);
    expect(
      sync.currentPlayheadMs,
      "currentPlayheadMs should store -500 without clamping"
    ).toBe(-500);
  });
});
