import { test, expect } from "@playwright/test";

const PROJECT_ID = Number(process.env.E2E_PROJECT_ID ?? "67");

// Verifies the RelatedItemsPanel renders in entity detail pages.
// Added by the entity-relationships feature (claude/add-entity-relationships-dmUl4).
test.describe("Related Items Panel Smoke", () => {
  test("RFI detail page has Related Items section", async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/rfis`);
    await page.waitForLoadState("domcontentloaded");

    const welcomeClose = page.getByRole("button", { name: /close welcome/i });
    if (await welcomeClose.isVisible()) await welcomeClose.click();

    // Find a link to an RFI detail page (href matches /67/rfis/<id>)
    const rfiLink = page.locator(`a[href^="/${PROJECT_ID}/rfis/"]`).first();
    if ((await rfiLink.count()) === 0) {
      console.warn("No RFI links found in project — skipping detail navigation");
      return;
    }

    const href = await rfiLink.getAttribute("href");
    if (!href) return;

    await page.goto(href);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText(/related items/i).first()).toBeVisible();
  });

  test("Submittal detail page has Related Items section", async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/submittals`);
    await page.waitForLoadState("domcontentloaded");

    const welcomeClose = page.getByRole("button", { name: /close welcome/i });
    if (await welcomeClose.isVisible()) await welcomeClose.click();

    const submittalLink = page.locator(`a[href^="/${PROJECT_ID}/submittals/"]`).first();
    if ((await submittalLink.count()) === 0) {
      console.warn("No Submittal links found — skipping detail navigation");
      return;
    }

    const href = await submittalLink.getAttribute("href");
    if (!href) return;

    await page.goto(href);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText(/related items/i).first()).toBeVisible();
  });
});
