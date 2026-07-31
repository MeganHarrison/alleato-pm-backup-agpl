import { expect, test } from "@playwright/test";

test("deployed app responds without a fatal error", async ({ page }) => {
  const response = await page.goto("/auth/login", { waitUntil: "domcontentloaded" });

  expect(response?.status(), "login route should not return a server error").toBeLessThan(500);
  await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error|Unhandled Runtime Error/i);
});
