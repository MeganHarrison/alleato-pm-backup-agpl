import { test, expect } from "@playwright/test";

test.describe("Daily Logs Smoke", () => {
  test("daily log list renders core controls", async ({ page }) => {
    await page.goto("/daily-log");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('input[placeholder*="Search" i]').first()).toBeVisible();
    await expect(page.locator('button:has-text("Columns")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Export")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Create Log Entry")').first()).toBeVisible();
  });
});
