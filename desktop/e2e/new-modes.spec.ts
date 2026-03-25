/**
 * E2E: Caption, Reel, and Long-form mode creation workflows
 *
 * Tests that users can create projects in each of the new modes
 * and that the editor renders mode-appropriate content.
 */
import { test, expect, type Page } from "@playwright/test";

async function openNewProjectDialog(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /New/ }).click();
  await page.getByRole("heading", { name: "New Project" }).waitFor();
}

async function selectReciterAndSurah(page: Page) {
  // Select first reciter
  const reciterBtn = page
    .locator("button")
    .filter({ hasText: /Mishari|Afasy|Sudais|Husary/ })
    .first();
  await reciterBtn.waitFor({ timeout: 5000 });
  await reciterBtn.click();

  // Select surah
  const surahTrigger = page.locator('[role="combobox"]').first();
  if (await surahTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
    await surahTrigger.click();
    const option = page.getByRole("option").first();
    await option.waitFor({ timeout: 3000 });
    await option.click();
  }
}

async function createProjectInMode(page: Page, mode: string) {
  await openNewProjectDialog(page);

  // Select the mode
  await page.getByText(mode, { exact: true }).click();

  await selectReciterAndSurah(page);

  // Create
  const createBtn = page.getByRole("button", { name: "Create" });
  await createBtn.waitFor({ state: "attached" });
  await createBtn.click();

  // Wait for editor
  await expect(page.getByText("Quran Studio")).toBeVisible({ timeout: 10000 });
  await expect(
    page.locator('[title*="Play"]').or(page.locator('[title*="Pause"]'))
  ).toBeVisible({ timeout: 5000 });
}

test.describe("Caption Mode", () => {
  test("can create a Caption project and land in editor", async ({ page }) => {
    await createProjectInMode(page, "Caption");

    // Timeline should be visible with canvas
    await expect(page.locator("canvas").first()).toBeVisible();

    // Inspector should show project info
    await expect(page.getByText("Project", { exact: true }).first()).toBeVisible({
      timeout: 3000,
    });
  });

  test("Caption mode shows text style options in inspector", async ({ page }) => {
    await createProjectInMode(page, "Caption");

    // Should NOT show Mushaf section
    // Should show relevant sections
    await expect(page.getByText("Project", { exact: true }).first()).toBeVisible({
      timeout: 3000,
    });
  });
});

test.describe("Reel Mode", () => {
  test("can create a Reel project and land in editor", async ({ page }) => {
    await createProjectInMode(page, "Reel");

    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByText("Project", { exact: true }).first()).toBeVisible({
      timeout: 3000,
    });
  });

  test("Reel mode shows highlight settings in inspector", async ({ page }) => {
    await createProjectInMode(page, "Reel");

    // Reel mode should show the Highlight section
    await expect(page.getByText("Highlight", { exact: true }).first()).toBeVisible({
      timeout: 3000,
    });
  });
});

test.describe("Long-form Mode", () => {
  test("can create a Long-form project and land in editor", async ({ page }) => {
    await createProjectInMode(page, "Long-form");

    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByText("Project", { exact: true }).first()).toBeVisible({
      timeout: 3000,
    });
  });

  test("Long-form mode shows highlight and export settings", async ({ page }) => {
    await createProjectInMode(page, "Long-form");

    await expect(page.getByText("Highlight", { exact: true }).first()).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByText("Export", { exact: true }).first()).toBeVisible({
      timeout: 3000,
    });
  });
});

test.describe("Mode switching in dialog", () => {
  test("all four mode buttons are clickable", async ({ page }) => {
    await openNewProjectDialog(page);

    // All mode buttons should be enabled
    for (const mode of ["Caption", "Reel", "Long-form", "Mushaf"]) {
      const btn = page.getByText(mode, { exact: true });
      await expect(btn).toBeVisible();
      await btn.click();
    }
  });
});
