import { expect, test } from "@playwright/test";

test.describe("Executive Daily Brief table", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  test("routes only to the executive assessment surface", async ({ page }) => {
    await page.goto("/daily-briefs");
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("heading", { name: "Daily Brief History" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    const detailLink = page.locator('table a[href^="/daily-briefs/"]').first();
    const href = await detailLink.getAttribute("href");
    expect(href).toMatch(/^\/daily-briefs\/[^/]+$/);
    await detailLink.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { name: "Executive Assessment" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Record conflict" })).toHaveCount(0);

  });
});

const adminStorageState = process.env.ADMIN_E2E_STORAGE_STATE;

test.describe("Admin Daily Brief table", () => {
  test.skip(
    !adminStorageState,
    "Run AUTH_BASE_URL=<origin> node ../scripts/verify/agent-browser-auth.mjs --role admin, then set ADMIN_E2E_STORAGE_STATE=tests/.auth/admin.json.",
  );
  test.use({ storageState: adminStorageState });

  test("routes to the technical packet review surface", async ({ page }) => {
    await page.goto("/admin/daily-briefs");
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("heading", { name: "Daily Brief Operations" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "RAG sources" })).toBeVisible();
    const detailLink = page.locator('table a[href^="/admin/daily-briefs/"]').first();
    const href = await detailLink.getAttribute("href");
    expect(href).toMatch(/^\/admin\/daily-briefs\/[^/]+$/);
    await detailLink.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByText("Canonical packet review for this day.")).toBeVisible();
  });
});
