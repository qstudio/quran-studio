/**
 * Pre-load all mushaf page images for a project.
 * Must be called before opening the editor so images are ready for the preview.
 */

import { isTauri } from "@/hooks/useTauri";
import type { Project } from "@/types/project";

// Shared image cache — keyed by page number
export const preloadedPageImages = new Map<number, HTMLImageElement>();

// Module-level reference to getMushafPage (avoids circular imports)
let _getMushafPage: ((page: number) => Promise<number[]>) | null = null;

export function setMushafPageFetcher(fn: (page: number) => Promise<number[]>) {
  _getMushafPage = fn;
}

export async function preloadProjectPages(
  project: Project,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  if (!isTauri() || !_getMushafPage) return;

  // Find all unique page numbers
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
          if (preloadedPageImages.has(page)) {
            loaded++;
            onProgress?.(loaded, total);
            return;
          }

          const bytes = await _getMushafPage!(page);
          const uint8 = new Uint8Array(bytes);
          const blob = new Blob([uint8], { type: "image/png" });
          const url = URL.createObjectURL(blob);

          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              preloadedPageImages.set(page, img);
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
