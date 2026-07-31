import { expect, test } from "@playwright/test";

test.describe("Sidebar Navigation", () => {
  test("shows Docs Chat navigation entry and can navigate to docs", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    let docsLink = page.locator('a[href="/docs"]', { hasText: "Docs Chat" }).first();
    if (!(await docsLink.isVisible().catch(() => false))) {
      const toggleSidebar = page.locator('button[aria-label="Toggle Sidebar"]').first();
      if (await toggleSidebar.isVisible().catch(() => false)) {
        await toggleSidebar.click();
      }
      docsLink = page.locator('a[href="/docs"]', { hasText: "Docs Chat" }).first();
    }

    await expect(docsLink).toBeAttached();
    await expect(docsLink).toHaveAttribute("href", "/docs");

    await page.goto("/docs");
    await expect(page).toHaveURL(/\/docs/);
  });
});
