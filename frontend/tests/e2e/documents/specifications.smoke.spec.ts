import { test, expect } from "@playwright/test";

const PROJECT_ID = Number(process.env.E2E_PROJECT_ID ?? "31");

test.describe("Specifications Smoke", () => {
  test("specifications list page renders", async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: "Specifications" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /upload specification/i })).toBeVisible();
  });

  test("upload specification dialog opens and closes", async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: /upload specification/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upload Specification" })).toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
