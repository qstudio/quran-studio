import { renderWaveform } from "@/components/Timeline/WaveformRenderer";
import type { WaveformRect } from "@/components/Timeline/WaveformRenderer";

function createMockCtx() {
  return {
    fillStyle: "",
    fillRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe("renderWaveform", () => {
  it("does not call fillRect with empty peaks", () => {
    const ctx = createMockCtx();
    const rect: WaveformRect = { x: 0, y: 0, w: 200, h: 32 };
    renderWaveform(ctx, [], rect, 100);
    expect(ctx.fillRect, "fillRect should not be called when peaks array is empty").not.toHaveBeenCalled();
  });

  it("does not call fillRect with zero-width rect", () => {
    const ctx = createMockCtx();
    const rect: WaveformRect = { x: 0, y: 0, w: 0, h: 32 };
    renderWaveform(ctx, [0.5, 0.8], rect, 100);
    expect(ctx.fillRect, "fillRect should not be called when waveform rect has zero width").not.toHaveBeenCalled();
  });

  it("does not call fillRect with zero-height rect", () => {
    const ctx = createMockCtx();
    const rect: WaveformRect = { x: 0, y: 0, w: 200, h: 0 };
    renderWaveform(ctx, [0.5, 0.8], rect, 100);
    expect(ctx.fillRect, "fillRect should not be called when waveform rect has zero height").not.toHaveBeenCalled();
  });

  it("calls fillRect multiple times for normal peaks", () => {
    const ctx = createMockCtx();
    const rect: WaveformRect = { x: 0, y: 0, w: 200, h: 32 };
    const peaks = Array.from({ length: 100 }, () => 0.5);
    renderWaveform(ctx, peaks, rect, 100);
    expect(ctx.fillRect, "fillRect should be called at least once for 100 peaks in a 200px-wide rect").toHaveBeenCalled();
    expect(
      (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length,
      "fillRect should be called multiple times to draw individual waveform bars"
    ).toBeGreaterThan(1);
  });

  it("changes fillStyle at the playheadX boundary", () => {
    const ctx = createMockCtx();
    const rect: WaveformRect = { x: 0, y: 0, w: 200, h: 32 };
    const peaks = Array.from({ length: 100 }, () => 0.5);

    // playheadX in the middle so some bars are before and some after
    renderWaveform(ctx, peaks, rect, 100);

    // Re-run with a proxy ctx to capture fillStyle changes
    const styles: string[] = [];
    const proxyCtx = {
      _fillStyle: "",
      get fillStyle() {
        return this._fillStyle;
      },
      set fillStyle(v: string) {
        this._fillStyle = v;
        styles.push(v);
      },
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    renderWaveform(proxyCtx, peaks, rect, 100);

    // Should have at least two different fill styles (played and unplayed colors)
    const uniqueStyles = new Set(styles);
    expect(
      uniqueStyles.size,
      "Waveform should use at least 2 different fill styles (played vs unplayed colors) when playheadX is in the middle"
    ).toBeGreaterThanOrEqual(2);
  });
});
