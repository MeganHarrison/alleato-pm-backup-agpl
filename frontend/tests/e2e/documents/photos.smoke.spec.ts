import { test, expect } from "@playwright/test";

const PROJECT_ID = Number(process.env.E2E_PROJECT_ID ?? "118");

test.describe("Photos Smoke", () => {
  test("photos page renders summary and grid shell", async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/photos`);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByTestId("photo-summary")).toBeVisible();
    await expect(page.getByTestId("photos-grid")).toBeVisible();
  });
});
