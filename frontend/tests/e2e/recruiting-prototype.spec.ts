import { expect, test } from "@playwright/test";

test.describe("Applicant Tracker synthetic prototype", () => {
  test("adds a synthetic resume, opens detail, and moves the application", async ({
    page,
  }) => {
    await page.goto("/recruiting");

    await expect(
      page.getByRole("heading", { name: "Applicant Tracker" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add sample resume" }).click();
    await page.getByRole("button", { name: "Add sample applicant" }).click();

    await expect(
      page.getByRole("heading", { name: "Taylor Morgan" }),
    ).toBeVisible();
    await expect(page.getByText("No AI score, rank")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    await page
      .getByRole("button", { name: "Move Taylor Morgan to another stage" })
      .click();
    await page.getByRole("menuitem", { name: "Move to Review" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Application moved to Review",
    );
  });

  test("remains usable on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/recruiting");

    await expect(
      page.getByRole("button", { name: "Add sample resume" }),
    ).toBeVisible();
    await expect(page.getByLabel("Choose requisition")).toBeVisible();
    await expect(page.getByLabel("Search candidates")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});
