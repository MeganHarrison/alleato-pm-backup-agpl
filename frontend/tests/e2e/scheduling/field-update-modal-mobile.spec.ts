import { expect, test } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe("schedule field-update modal", () => {
  test("keeps the audited update action reachable and operable on mobile", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/43/schedule", { waitUntil: "domcontentloaded" });

    const task = page.getByText("Install Sanitary Sewer", { exact: true }).first();
    await expect(task).toBeVisible();
    await task.dispatchEvent("click");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const recordFieldUpdate = dialog.getByRole("button", { name: "Record field update" });
    await recordFieldUpdate.scrollIntoViewIfNeeded();
    await expect(recordFieldUpdate).toBeInViewport();
    await recordFieldUpdate.click();
  });
});
