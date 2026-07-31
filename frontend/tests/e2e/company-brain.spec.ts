import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoCompanyBrain } from "../helpers/company-brain";

async function openBrain(page: Page, state = "ready") {
  await gotoCompanyBrain(page, state);
  await expect(
    page.getByRole("heading", { name: "Company Brain", exact: true }).first(),
  ).toBeVisible();
}

test.describe("Company Brain command center", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "alleato_onboarding_completed_v3",
        "playwright-company-brain",
      );
    });
  });

  test("renders the permission-scoped system overview and accessible text map", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openBrain(page);

    await expect(page.getByTestId("company-brain-map")).toBeVisible();
    await expect(page.getByTestId("company-brain-mobile-story")).toBeHidden();
    await expect(page.getByTestId("company-brain-map")).not.toContainText(
      "Knowledge growth",
    );
    await expect(page.getByTestId("company-brain-flow-panel")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(page.getByTestId("company-brain-flow-panel")).toHaveCSS(
      "border-top-width",
      "0px",
    );
    for (const status of [
      page.getByTestId("company-brain-live-status"),
      page.getByTestId("company-brain-health-status"),
    ]) {
      await expect(status).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(status).toHaveCSS("border-top-width", "0px");
    }
    const pipeline = page.getByTestId("company-brain-pipeline");
    await expect(pipeline).toContainText("Parser");
    await expect(pipeline).toContainText("Embedder");
    await expect(pipeline).toContainText("Extractor");
    await expect(pipeline).not.toContainText("Collected");
    await expect(pipeline).not.toContainText("Processed");
    await expect(pipeline).not.toContainText("Structured");
    await expect(
      page.getByText("Knowledge coverage", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Live activity feed", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Top knowledge connections", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Knowledge branches", { exact: true }),
    ).toHaveCount(0);
    // The activity feed reads below the metric strip, not beside the map.
    const metricRail = page.getByLabel("System monitoring metrics");
    const feedTop = await page
      .getByRole("heading", { name: "Live activity feed" })
      .evaluate((element) => element.getBoundingClientRect().top);
    const railTop = await metricRail.evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    expect(feedTop).toBeGreaterThan(railTop);
    await expect(
      pipeline.getByText("Pipeline stages", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("brain-node-outcome-tasks")).toContainText(
      "Tasks Generated",
    );
    await expect(
      page.getByTestId("brain-node-source-outlook").locator("img"),
    ).toHaveAttribute("src", /\/company-brain\/outlook\.svg/);
    await expect(
      page.getByTestId("brain-node-source-fireflies").locator("img"),
    ).toHaveAttribute("src", /\/company-brain\/fireflies\.svg/);
    await expect(
      page.getByTestId("brain-node-brain-core").locator("img").first(),
    ).toHaveAttribute("src", /neural-brain\.webp/);

    await page
      .getByRole("button", { name: "Show accessible text map" })
      .click();
    await expect(page.getByTestId("company-brain-text-map")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Sources", exact: true }),
    ).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
      .include('[data-testid="company-brain-experience"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations.filter((violation) =>
        ["critical", "serious"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
  });

  test("7D and 30D re-scope the URL, the pressed state, and the metric window label", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openBrain(page);

    const range = page.getByLabel("Activity range");
    await expect(range.getByRole("button", { name: "24H" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByText("Tasks generated (24H)", { exact: true }),
    ).toBeVisible();

    for (const [button, label] of [
      ["7D", "Tasks generated (7D)"],
      ["30D", "Tasks generated (30D)"],
    ] as const) {
      await range.getByRole("button", { name: button }).click();
      await expect(page).toHaveURL(new RegExp(`range=${button.toLowerCase()}`));
      await expect(range.getByRole("button", { name: button })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("selection, Escape, and arrow keys preserve keyboard focus and URL state", async ({
    page,
  }) => {
    await openBrain(page);
    const outlook = page.getByTestId("brain-node-source-outlook");
    await outlook.focus();
    await outlook.press("ArrowDown");
    await expect(page.getByTestId("brain-node-source-fireflies")).toBeFocused();

    await outlook.focus();
    await outlook.press("Enter");
    await expect(page).toHaveURL(/focus=source%3Aoutlook/);
    await expect(page.getByTestId("entity-inspector")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close inspector" }),
    ).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/focus=/);
    await expect(outlook).toBeFocused();
  });

  test("browser Back closes the inspector and restores the selected node", async ({
    page,
  }) => {
    await openBrain(page);
    const source = page.getByTestId("brain-node-source-fireflies");
    await source.click();
    await expect(page).toHaveURL(/focus=source%3Afireflies/);

    await page.goBack();
    await expect(page).not.toHaveURL(/focus=/);
    await expect(source).toBeFocused();
  });

  test("search is keyboard reachable, shareable, and has a no-results state", async ({
    page,
  }) => {
    await openBrain(page);
    const search = page.getByRole("textbox", { name: "Search Company Brain" });
    await search.focus();
    await expect(search).toBeFocused();
    await search.fill("SharePoint");
    await expect(page).toHaveURL(/q=SharePoint/);
    await page.getByTestId("brain-node-source-sharepoint").click();
    await expect(page).toHaveURL(/focus=source%3Asharepoint/);

    await page.keyboard.press("Escape");
    await search.fill("definitely-no-match");
    await expect(
      page.getByText(
        "No matching system entities. Clear the search to restore the map.",
      ),
    ).toBeVisible();
  });

  test("uses the desktop map at 1024px and 768px", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await openBrain(page);
    await expect(page.getByTestId("company-brain-map")).toBeVisible();
    await expect(page.getByTestId("company-brain-mobile-story")).toBeHidden();

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId("company-brain-map")).toBeVisible();
    await expect(page.getByTestId("company-brain-mobile-story")).toBeHidden();
    const viewport = page.getByTestId("company-brain-map-viewport");
    expect(
      await viewport.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
  });

  test("keeps the brain and its animated flow on the 375px map", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openBrain(page);
    const mobileMap = page.getByTestId("company-brain-mobile-story");
    await expect(mobileMap).toBeVisible();
    await expect(page.getByTestId("company-brain-map")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Show accessible text map" }),
    ).toBeVisible();

    // The brain is the point of this page — it must survive the breakpoint,
    // animation and all, not degrade to a list.
    const mobileBrain = page.getByTestId("mobile-brain-node-brain-core");
    await expect(mobileBrain).toBeVisible();
    const brainBox = await mobileBrain.boundingBox();
    expect(brainBox?.height ?? 0).toBeGreaterThan(120);
    const lane = mobileMap.locator("svg path").first();
    await expect(lane).toHaveCSS("animation-iteration-count", "infinite");

    await expect(mobileMap.getByText("Ingestion sources")).toBeVisible();
    await expect(mobileMap.getByText("Intelligence outputs")).toBeVisible();

    const mobileOutlook = page
      .getByTestId("company-brain-mobile-story")
      .getByRole("button", { name: /Outlook/ });
    await mobileOutlook.click();
    await expect(page.getByTestId("entity-inspector")).toBeVisible();
    await expect(page.getByTestId("entity-inspector")).toHaveCSS(
      "width",
      "375px",
    );
    await page.getByRole("button", { name: "Close inspector" }).click();
    await expect(mobileOutlook).toBeFocused();
  });

  test("stops decorative flow motion for reduced-motion users", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openBrain(page, "ready");
    const edge = page.getByTestId("company-brain-map").locator("path").first();
    await expect(edge).toHaveCSS("animation-name", "none");
  });

  test("renders first-run, partial, full-failure, and permission-limited states", async ({
    page,
  }) => {
    await openBrain(page, "empty");
    await expect(
      page.getByRole("heading", { name: "No knowledge sources yet" }),
    ).toBeVisible();

    await openBrain(page, "partial");
    await expect(
      page.getByText("Some system data is unavailable"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry unavailable data" }),
    ).toBeVisible();

    await openBrain(page, "error");
    await expect(page.getByText("Company Brain is unavailable")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();

    await openBrain(page, "permission_limited");
    await expect(
      page.getByText(
        "This view excludes entities and activity outside your access.",
      ),
    ).toBeVisible();
    // The notice deliberately carries no "Review available access" link: no
    // such page exists, and the noise gate bans an affordance that points at a
    // placeholder. Assert it stays absent so the link cannot creep back.
    await expect(
      page.getByRole("link", { name: "Review available access" }),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("company-brain-experience"),
    ).not.toContainText("SharePoint");
    await expect(
      page.getByTestId("company-brain-experience"),
    ).not.toContainText("Change Events");
    await expect(page.getByRole("button", { name: /retry sync/i })).toHaveCount(
      0,
    );
  });
});
