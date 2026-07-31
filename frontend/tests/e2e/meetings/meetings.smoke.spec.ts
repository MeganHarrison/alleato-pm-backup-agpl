import { test, expect } from "@playwright/test";

const PROJECT_ID = Number(process.env.E2E_PROJECT_ID ?? "67");

test.describe("Meetings Smoke", () => {
  test("meetings list renders with header and create action", async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/meetings`);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { name: "Meetings", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /create meeting/i })).toBeVisible();
  });

  test("create meeting dialog opens and can be cancelled", async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/meetings`);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: /create meeting/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: /create new meeting/i })).toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
