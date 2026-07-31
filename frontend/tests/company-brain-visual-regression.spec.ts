import { expect, test } from "@playwright/test";
import { gotoCompanyBrain } from "./helpers/company-brain";

test.describe("Company Brain visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "alleato_onboarding_completed_v3",
        "playwright-company-brain",
      );
    });
  });

  test("1440px command center", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await gotoCompanyBrain(page);
    await expect(
      page.getByRole("heading", { name: "Company Brain", exact: true }).first(),
    ).toBeVisible();
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelectorAll("main").forEach((element) => {
        element.scrollTop = 0;
      });
    });
    await expect(page).toHaveScreenshot("company-brain-1440.png", {
      animations: "disabled",
      caret: "hide",
    });
  });

  test("375px story mode", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
    await gotoCompanyBrain(page);
    const story = page.getByTestId("company-brain-mobile-story");
    await expect(story).toBeVisible();
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await story.scrollIntoViewIfNeeded();
    await expect(page).toHaveScreenshot("company-brain-375.png", {
      animations: "disabled",
      caret: "hide",
    });
  });
});
