import { test, expect } from "@playwright/test";

const PROJECT_ID = Number(process.env.E2E_PROJECT_ID ?? "67");

test.describe("Drawings Smoke", () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss the welcome dialog if it appears (shown to new sessions)
    await page.goto(`/${PROJECT_ID}/drawings`);
    await page.waitForLoadState("domcontentloaded");
    const welcomeClose = page.getByRole("button", { name: /close welcome/i });
    if (await welcomeClose.isVisible()) {
      await welcomeClose.click();
    }
  });

  test("drawings list page renders without error", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Drawings" })).toBeVisible();
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    await expect(page.getByText("Failed to load")).not.toBeVisible();
  });

  test("drawings page shows toolbar actions — Upload button present", async ({ page }) => {
    await expect(page.getByRole("button", { name: /upload/i })).toBeVisible();
  });

  test("drawings page has tab navigation — Current Drawings, Drawing Sets", async ({ page }) => {
    await expect(page.getByRole("button", { name: /current drawings/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /drawing sets/i })).toBeVisible();
  });
});
