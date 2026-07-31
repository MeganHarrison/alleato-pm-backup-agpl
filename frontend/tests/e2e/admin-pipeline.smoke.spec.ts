import { test, expect } from "@playwright/test";

test.describe("Feedback Inbox Smoke", () => {
  test("feedback inbox renders with type switch and status filter", async ({ page }) => {
    await page.goto("/feedback-inbox");
    await page.waitForLoadState("domcontentloaded");

    const welcomeClose = page.getByRole("button", { name: /close welcome/i });
    if (await welcomeClose.isVisible()) await welcomeClose.click();

    await expect(page.getByText("Feedback Inbox").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /issues/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /features/i })).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: /filter feedback status/i }),
    ).toBeVisible();
  });

  test("changing the status filter does not crash the page", async ({ page }) => {
    await page.goto("/feedback-inbox");
    await page.waitForLoadState("domcontentloaded");

    const welcomeClose = page.getByRole("button", { name: /close welcome/i });
    if (await welcomeClose.isVisible()) await welcomeClose.click();

    await page
      .getByRole("combobox", { name: /filter feedback status/i })
      .click();
    await page.getByRole("option", { name: "All" }).click();
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  });
});
