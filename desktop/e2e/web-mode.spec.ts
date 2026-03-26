/**
 * E2E: Web mode detection and graceful fallbacks
 *
 * Verifies that the app works correctly when served by a web server
 * (not Tauri). In the Playwright environment, Tauri is not available,
 * so the app should detect web mode and fall back to mock data.
 */
import { test, expect } from "@playwright/test";

test.describe("Web Mode Detection", () => {
  test("app loads without Tauri and renders the project library", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText("Recent Projects"),
      "Library header should be visible when app loads in web mode"
    ).toBeVisible();
  });

  test("isTauri returns false in browser context", async ({ page }) => {
    await page.goto("/");

    const isTauri = await page.evaluate(() => {
      return !!(window as any).__TAURI_INTERNALS__;
    });

    expect(
      isTauri,
      "Browser should not have __TAURI_INTERNALS__ defined"
    ).toBe(false);
  });

  test("API calls fall back gracefully when no Axum server is running", async ({ page }) => {
    await page.goto("/");

    // App should still render even without an Axum server (mock fallback)
    await expect(
      page.getByRole("button", { name: /New/ }),
      "New button should be visible even without a backend server"
    ).toBeVisible();
  });

  test("empty state is shown when no projects are returned", async ({ page }) => {
    await page.goto("/");

    // Without a real backend, listProjects falls back to [] which shows empty state
    await expect(
      page.getByText("No projects yet"),
      "Empty state message should appear when no projects are available"
    ).toBeVisible({ timeout: 5000 });
  });

  test("new project dialog works in web mode with mock reciters", async ({ page }) => {
    await page.goto("/");

    // Open the new project dialog
    await page.getByRole("button", { name: /New/ }).click();

    // Dialog should appear
    await expect(
      page.getByRole("heading", { name: "New Project" }),
      "New Project dialog heading should be visible"
    ).toBeVisible();

    // Mock reciters should be loaded (fallback from useTauri)
    // Look for a reciter name that comes from the mock data
    await expect(
      page.locator("button").filter({ hasText: /Mishari|Afasy/ }).first(),
      "Mock reciter 'Mishari Rashid al-Afasy' should appear in the dialog"
    ).toBeVisible({ timeout: 5000 });
  });

  test("window.__TAURI_INTERNALS__ is not present on any page navigation", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");

    // Check on initial load
    const hasTauriOnLoad = await page.evaluate(
      () => "__TAURI_INTERNALS__" in window
    );
    expect(
      hasTauriOnLoad,
      "__TAURI_INTERNALS__ should not be in window on initial page load"
    ).toBe(false);

    // Interact with the page (open dialog and close it)
    await page.getByRole("button", { name: /New/ }).click();
    await expect(
      page.getByRole("heading", { name: "New Project" }),
      "Dialog should open"
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    // Check again after interaction
    const hasTauriAfterInteraction = await page.evaluate(
      () => "__TAURI_INTERNALS__" in window
    );
    expect(
      hasTauriAfterInteraction,
      "__TAURI_INTERNALS__ should not appear after page interactions"
    ).toBe(false);
  });
});
