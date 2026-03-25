/**
 * E2E: Project creation workflow
 *
 * Tests the full flow a user goes through to create a new project:
 * Library → New button → Dialog → Pick reciter → Pick surah → Create → Editor
 */
import { test, expect } from "@playwright/test";

test.describe("Project Library", () => {
  test("shows library on startup with header and new button", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Recent Projects")).toBeVisible();
    await expect(page.getByPlaceholder("Search projects...")).toBeVisible();
    await expect(page.getByRole("button", { name: /New/ })).toBeVisible();
  });

  test("shows empty state when no projects exist", async ({ page }) => {
    await page.goto("/");

    // Without Tauri backend, listProjects returns [] — empty state
    await expect(page.getByText("No projects yet")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("New Project Dialog", () => {
  test("opens dialog and shows form fields", async ({ page }) => {
    await page.goto("/");

    // Click "New" button
    await page.getByRole("button", { name: /New/ }).click();

    // Dialog should appear
    await expect(page.getByRole("heading", { name: "New Project" })).toBeVisible();
    await expect(
      page.getByText("Create a new Quran recitation video project.")
    ).toBeVisible();

    // Mode toggle visible — Mushaf should be the only enabled one
    await expect(page.getByRole("radio", { name: "Mushaf" }).or(page.getByText("Mushaf"))).toBeVisible();

    // Create button should be disabled until form is filled
    const createBtn = page.getByRole("button", { name: "Create" });
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeDisabled();

    // Cancel button works
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "New Project" })
    ).not.toBeVisible();
  });

  test("full creation flow: select reciter → surah → create → lands in editor", async ({
    page,
  }) => {
    await page.goto("/");

    // Open new project dialog
    await page.getByRole("button", { name: /New/ }).click();
    await expect(page.getByRole("heading", { name: "New Project" })).toBeVisible();

    // Select a reciter (mock data shows Mishari Rashid al-Afasy)
    const reciterSearch = page.getByPlaceholder("Search reciters...");
    if (await reciterSearch.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reciterSearch.fill("Mishari");
    }
    // Click on a reciter button
    const reciterBtn = page.locator("button").filter({ hasText: /Mishari|Afasy/ }).first();
    await reciterBtn.waitFor({ timeout: 5000 });
    await reciterBtn.click();

    // Select a surah
    const surahTrigger = page.locator('[role="combobox"]').filter({ hasText: /Select a surah|surah/i }).first();
    if (await surahTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await surahTrigger.click();
      // Pick Al-Fatihah
      const option = page.getByRole("option", { name: /Fatihah|فاتحة/ }).first();
      await option.waitFor({ timeout: 3000 });
      await option.click();
    }

    // Create button should now be enabled
    const createBtn = page.getByRole("button", { name: "Create" });
    await expect(createBtn).toBeEnabled({ timeout: 3000 });

    // Click Create
    await createBtn.click();

    // Should show progress then land in editor
    // In mock mode, creation is near-instant
    // Editor should be visible (AppShell renders with project)
    await expect(page.getByText("Quran Studio")).toBeVisible({ timeout: 10000 });

    // Timeline controls should be present
    await expect(
      page.locator('[title*="Play"]').or(page.locator('[title*="Pause"]'))
    ).toBeVisible({ timeout: 5000 });
  });
});
