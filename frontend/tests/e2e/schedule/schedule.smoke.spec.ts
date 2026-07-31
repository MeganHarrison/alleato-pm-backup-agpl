import { test, expect } from "@playwright/test";

const PROJECT_ID = 43;
const SCHEDULE_URL = `/${PROJECT_ID}/schedule`;

test.describe("Schedule Smoke", () => {
  test("page renders with heading and primary actions", async ({ page }) => {
    await page.goto(SCHEDULE_URL);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { name: "Schedule", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Task" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
  });

  test("view tabs are visible", async ({ page }) => {
    await page.goto(SCHEDULE_URL);
    await page.waitForLoadState("domcontentloaded");

    for (const tab of ["Grid", "Board", "Schedule", "Timeline", "Calendar"]) {
      await expect(page.getByRole("button", { name: `Switch to ${tab} view` })).toBeVisible();
    }
  });

  test("add task dialog opens and closes", async ({ page }) => {
    await page.goto(SCHEDULE_URL);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: "Add Task" }).first().click();
    await expect(page.getByRole("dialog", { name: "Create New Task" })).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog", { name: "Create New Task" })).not.toBeVisible();
  });
});
