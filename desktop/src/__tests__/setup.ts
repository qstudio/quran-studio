import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Auto-cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.__TAURI_INTERNALS__ (make isTauri() return false by default)
Object.defineProperty(window, "__TAURI_INTERNALS__", {
  value: undefined,
  writable: true,
});

// Mock requestAnimationFrame / cancelAnimationFrame
if (typeof window.requestAnimationFrame === "undefined") {
  window.requestAnimationFrame = (cb) =>
    setTimeout(cb, 0) as unknown as number;
  window.cancelAnimationFrame = (id) => clearTimeout(id);
}

// Mock ResizeObserver (used by Radix UI components)
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Canvas 2D context mock factory
export function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "start" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;
}

// Patch HTMLCanvasElement.getContext to return mock
HTMLCanvasElement.prototype.getContext = vi.fn(function () {
  return createMockCanvasContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;
