import { test, expect } from "@playwright/test";

const PROJECT_ID = Number(process.env.E2E_PROJECT_ID ?? "31");

test.describe("Drawings Smoke", () => {
  test("drawings page renders primary controls", async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/drawings`);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { name: "Drawings" })).toBeVisible();
    await expect(
      page.getByPlaceholder("Search drawings by number or title"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload Drawings" })).toBeVisible();
  });
});
