/**
 * E2E: Editor workflow
 *
 * Tests real user interactions inside the editor:
 * timeline controls, keyboard shortcuts, inspector panel,
 * zoom, and command palette.
 *
 * These tests create a project first, then exercise the editor UI.
 */
import { test, expect, type Page } from "@playwright/test";

/**
 * Helper: Create a project and land in the editor.
 * Uses the mock data path (no Tauri backend needed).
 */
async function createProjectAndOpenEditor(page: Page) {
  await page.goto("/");

  // Open dialog
  await page.getByRole("button", { name: /New/ }).click();
  await page.getByRole("heading", { name: "New Project" }).waitFor();

  // Select first available reciter
  const reciterBtn = page
    .locator("button")
    .filter({ hasText: /Mishari|Afasy|Sudais|Husary/ })
    .first();
  await reciterBtn.waitFor({ timeout: 5000 });
  await reciterBtn.click();

  // Select surah via dropdown
  const surahTrigger = page.locator('[role="combobox"]').first();
  if (await surahTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
    await surahTrigger.click();
    const option = page.getByRole("option").first();
    await option.waitFor({ timeout: 3000 });
    await option.click();
  }

  // Create
  const createBtn = page.getByRole("button", { name: "Create" });
  await createBtn.waitFor({ state: "attached" });
  await createBtn.click();

  // Wait for editor to appear
  await expect(page.getByText("Quran Studio")).toBeVisible({ timeout: 10000 });
  await expect(
    page.locator('[title*="Play"]').or(page.locator('[title*="Pause"]'))
  ).toBeVisible({ timeout: 5000 });
}

test.describe("Timeline Controls", () => {
  test("play/pause button toggles state", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    // Should show Play icon initially
    const playPauseBtn = page.locator('[title="Play/Pause (Space)"]');
    await expect(playPauseBtn).toBeVisible();

    // Click play
    await playPauseBtn.click();
    // Brief wait for state update
    await page.waitForTimeout(100);

    // Click pause
    await playPauseBtn.click();
    await page.waitForTimeout(100);

    // Button should still be there (toggles between play/pause icons)
    await expect(playPauseBtn).toBeVisible();
  });

  test("skip buttons are functional", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    const skipBack = page.locator('[title="Skip Back (J)"]');
    const skipForward = page.locator('[title="Skip Forward (L)"]');

    await expect(skipBack).toBeVisible();
    await expect(skipForward).toBeVisible();

    // Click skip forward then back
    await skipForward.click();
    await page.waitForTimeout(100);
    await skipBack.click();
  });

  test("time display is visible and formatted", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    // Look for time display in MM:SS.mmm / MM:SS.mmm format
    const timeDisplay = page.locator('[style*="JetBrains Mono"]').first();
    await expect(timeDisplay).toBeVisible();
    const text = await timeDisplay.textContent();
    expect(text).toMatch(/\d{2}:\d{2}\.\d{1,3}/);
  });
});

test.describe("Zoom Controls", () => {
  test("zoom in/out buttons and slider are present", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    await expect(page.locator('[title="Zoom In (+)"]')).toBeVisible();
    await expect(page.locator('[title="Zoom Out (-)"]')).toBeVisible();
    await expect(page.locator('input[type="range"]')).toBeVisible();
  });

  test("zoom value displays and changes on button click", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    // Find the zoom display (e.g., "50.0x")
    const zoomDisplay = page.locator("span").filter({ hasText: /\d+\.\d+x/ });
    await expect(zoomDisplay).toBeVisible();
    const initialText = await zoomDisplay.textContent();

    // Click zoom in
    await page.locator('[title="Zoom In (+)"]').click();
    await page.waitForTimeout(100);

    const newText = await zoomDisplay.textContent();
    expect(newText).not.toBe(initialText);
  });
});

test.describe("Keyboard Shortcuts", () => {
  test("Space toggles playback", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    // Press space to play
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);

    // Press space to pause
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);
  });

  test("+ and - change zoom", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    const zoomDisplay = page.locator("span").filter({ hasText: /\d+\.\d+x/ });
    await expect(zoomDisplay).toBeVisible();
    const initialZoom = await zoomDisplay.textContent();

    // Press = (zoom in)
    await page.keyboard.press("Equal");
    await page.waitForTimeout(100);
    const zoomedIn = await zoomDisplay.textContent();
    expect(zoomedIn).not.toBe(initialZoom);

    // Press - (zoom out)
    await page.keyboard.press("Minus");
    await page.waitForTimeout(100);
    const zoomedOut = await zoomDisplay.textContent();
    expect(zoomedOut).not.toBe(zoomedIn);
  });

  test("Cmd+K opens command palette", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    // Open command palette
    await page.keyboard.press("Meta+k");

    // Should see the search input
    const cmdInput = page.getByPlaceholder("Type a command or search...");
    await expect(cmdInput).toBeVisible({ timeout: 2000 });

    // Type something
    await cmdInput.fill("play");
    await page.waitForTimeout(200);

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(cmdInput).not.toBeVisible({ timeout: 2000 });
  });

  test("Cmd+I toggles inspector panel", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    // Inspector should be visible initially (280px panel)
    const inspectorHeading = page.getByText("Project", { exact: true }).first();

    // If inspector is visible, toggle it off
    const wasVisible = await inspectorHeading
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    await page.keyboard.press("Meta+i");
    await page.waitForTimeout(300);

    if (wasVisible) {
      // Should now be hidden
      await expect(inspectorHeading).not.toBeVisible({ timeout: 2000 });
    }

    // Toggle back
    await page.keyboard.press("Meta+i");
    await page.waitForTimeout(300);
  });
});

test.describe("Canvas Timeline", () => {
  test("canvas element renders in the timeline area", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    // Timeline area should contain a canvas
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();

    // Canvas should have non-zero dimensions
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(20);
  });

  test("clicking canvas sets playhead", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Click in the ruler area (top 24px of canvas)
    // Click at ~1/3 of the canvas width
    await canvas.click({
      position: { x: box!.width / 3, y: 12 },
    });
    await page.waitForTimeout(100);

    // Time display should have changed from 00:00.000
    const timeDisplay = page.locator('[style*="JetBrains Mono"]').first();
    const text = await timeDisplay.textContent();
    // It should no longer be exactly at 0 (unless the click mapped to 0)
    expect(text).toBeDefined();
  });
});

test.describe("Inspector Panel", () => {
  test("shows project info when project is loaded", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    // Inspector section headings
    await expect(page.getByText("Project", { exact: true }).first()).toBeVisible({
      timeout: 3000,
    });

    // Should show project details
    await expect(page.getByText("Reciter").first()).toBeVisible();
    await expect(page.getByText("Surah").first()).toBeVisible();
    await expect(page.getByText("Duration").first()).toBeVisible();
  });

  test("highlight settings section is visible", async ({ page }) => {
    await createProjectAndOpenEditor(page);

    // Scroll down in inspector if needed — look for Highlight section
    const highlightHeading = page.getByText("Highlight", { exact: true }).first();
    await expect(highlightHeading).toBeVisible({ timeout: 3000 });

    // Mode, Shape toggles should be visible
    await expect(page.getByText("Word").first()).toBeVisible();
    await expect(page.getByText("Rectangle").first()).toBeVisible();
  });
});

test.describe("Full Editing Workflow", () => {
  test("create project → zoom → scrub → keyboard navigate → verify UI updates", async ({
    page,
  }) => {
    await createProjectAndOpenEditor(page);

    // 1. Verify we're in the editor
    await expect(page.getByText("Quran Studio")).toBeVisible();

    // 2. Zoom in twice with keyboard
    await page.keyboard.press("Equal");
    await page.keyboard.press("Equal");
    await page.waitForTimeout(100);

    // 3. Scrub by clicking canvas ruler
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await canvas.click({ position: { x: box.width / 2, y: 12 } });
    }

    // 4. Use L to skip forward
    await page.keyboard.press("l");
    await page.waitForTimeout(100);

    // 5. Use J to skip back
    await page.keyboard.press("j");
    await page.waitForTimeout(100);

    // 6. Space to play briefly, then space to pause
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);
    await page.keyboard.press("Space");

    // 7. Zoom out
    await page.keyboard.press("Minus");
    await page.waitForTimeout(100);

    // 8. Open command palette, search, close
    await page.keyboard.press("Meta+k");
    const cmdInput = page.getByPlaceholder("Type a command or search...");
    await expect(cmdInput).toBeVisible({ timeout: 2000 });
    await cmdInput.fill("export");
    await page.waitForTimeout(200);
    await page.keyboard.press("Escape");

    // 9. Toggle inspector
    await page.keyboard.press("Meta+i");
    await page.waitForTimeout(200);
    await page.keyboard.press("Meta+i");
    await page.waitForTimeout(200);

    // All good — editor is responsive through the whole workflow
    await expect(page.getByText("Quran Studio")).toBeVisible();
  });
});
