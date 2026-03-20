/**
 * Pre-load all mushaf page images for a project.
 * Must be called before opening the editor so images are ready for the preview.
 */

import { isTauri } from "@/hooks/useTauri";
import type { Project } from "@/types/project";

// Shared image cache — keyed by "style:page" to support multiple styles
export const preloadedPageImages = new Map<string, HTMLImageElement>();

let _getMushafPage: ((page: number, style?: string) => Promise<number[]>) | null = null;

export function setMushafPageFetcher(fn: (page: number, style?: string) => Promise<number[]>) {
  _getMushafPage = fn;
}

/** Get cache key for a page + style combo */
export function pageCacheKey(page: number, style: string): string {
  return `${style}:${page}`;
}

/** Get a preloaded image for a page (checks current style, falls back to any cached version) */
export function getPageImage(page: number, style: string): HTMLImageElement | undefined {
  return preloadedPageImages.get(pageCacheKey(page, style))
    ?? preloadedPageImages.get(pageCacheKey(page, "madani"))
    ?? preloadedPageImages.get(pageCacheKey(page, "tajweed"));
}

export async function preloadProjectPages(
  project: Project,
  style: string = "madani",
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  if (!isTauri() || !_getMushafPage) return;

  const pages = new Set<number>();
  for (const track of project.timeline.tracks) {
    if (track.track_type !== "mushaf_page") continue;
    for (const block of track.blocks) {
      if (block.data.type === "mushaf_page") {
        pages.add(block.data.page);
      }
    }
  }

  const pageList = Array.from(pages).sort((a, b) => a - b);
  if (pageList.length === 0) return;

  let loaded = 0;
  const total = pageList.length;

  const batchSize = 4;
  for (let i = 0; i < pageList.length; i += batchSize) {
    const batch = pageList.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (page) => {
        try {
          const key = pageCacheKey(page, style);
          if (preloadedPageImages.has(key)) {
            loaded++;
            onProgress?.(loaded, total);
            return;
          }

          const bytes = await _getMushafPage!(page, style);
          const uint8 = new Uint8Array(bytes);
          const blob = new Blob([uint8], { type: "image/png" });
          const url = URL.createObjectURL(blob);

          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              preloadedPageImages.set(key, img);
              loaded++;
              onProgress?.(loaded, total);
              resolve();
            };
            img.onerror = () => reject(new Error(`Failed to load page ${page}`));
            img.src = url;
          });
        } catch {
          loaded++;
          onProgress?.(loaded, total);
        }
      })
    );
  }
}
