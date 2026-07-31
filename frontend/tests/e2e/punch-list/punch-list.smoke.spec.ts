import { test, expect } from "@playwright/test";

const PROJECT_ID = Number(process.env.E2E_PROJECT_ID ?? "31");

test.describe("Punch List Smoke", () => {
  test("punch list page renders with create action and tabs", async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/punch-list`);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("Punch List").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /create punch item/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /all items/i })).toBeVisible();
  });
});
