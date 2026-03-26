import { test, expect } from "@playwright/test";

test.describe("Custom Audio UI", () => {
  test("audio source toggle appears in new project dialog", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /New/ }).click();
    await page.getByRole("heading", { name: "New Project" }).waitFor();

    await expect(page.getByText("Reciter Library"), "Reciter Library toggle should be visible in new project dialog").toBeVisible();
    await expect(page.getByText("Custom Audio"), "Custom Audio toggle should be visible in new project dialog").toBeVisible();
  });

  test("selecting Custom Audio shows file picker instead of reciter list", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /New/ }).click();
    await page.getByRole("heading", { name: "New Project" }).waitFor();

    // Click Custom Audio
    await page.getByText("Custom Audio").click();

    // File picker button should appear
    await expect(page.getByRole("button", { name: /Choose File/i }), "Choose File button should appear after selecting Custom Audio").toBeVisible();

    // Reciter browser should be hidden
    await expect(page.getByPlaceholder("Search reciters..."), "Reciter search should be hidden when Custom Audio is selected").not.toBeVisible();
  });

  test("switching back to Reciter Library shows reciter browser", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /New/ }).click();
    await page.getByRole("heading", { name: "New Project" }).waitFor();

    // Switch to Custom Audio
    await page.getByText("Custom Audio").click();
    await expect(page.getByRole("button", { name: /Choose File/i }), "Choose File button should be visible after switching to Custom Audio").toBeVisible();

    // Switch back to Reciter Library
    await page.getByText("Reciter Library").click();
    await expect(page.getByPlaceholder("Search reciters..."), "Reciter search should reappear after switching back to Reciter Library").toBeVisible({ timeout: 2000 });
  });
});
