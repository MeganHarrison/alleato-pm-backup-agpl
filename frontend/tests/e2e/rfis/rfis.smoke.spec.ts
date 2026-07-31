import { test, expect } from "@playwright/test";

const PROJECT_ID = Number(process.env.E2E_PROJECT_ID ?? "67");

test.describe("RFIs Smoke", () => {
  test("rfis page renders list shell and create action", async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/rfis`);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("RFIs").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /create/i })).toBeVisible();
  });
});
