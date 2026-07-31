import { expect, test } from "../../fixtures/index";

test.describe("Budget table horizontal scrolling", () => {
  test("keeps grand totals aligned with the budget table on tablet screens", async ({
    authenticatedRequest,
    page,
  }) => {
    const seededProjectResponse = await authenticatedRequest.get("/api/projects/67");
    let projectId = 67;

    if (!seededProjectResponse.ok()) {
      const projectsResponse = await authenticatedRequest.get(
        "/api/projects?archived=false&page=1&limit=1",
      );
      expect(projectsResponse.ok()).toBeTruthy();

      const projectsJson = await projectsResponse.json();
      const project = projectsJson.projects?.[0] ?? projectsJson.data?.[0];
      expect(project?.id, "A project fixture is required for the budget table check").toBeTruthy();
      projectId = project.id;
    }

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/${projectId}/budget`);
    await expect(page.getByRole("heading", { name: "Budget" })).toBeVisible();
    await page.waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll<HTMLElement>('[aria-label="Budget table scroll area"]'),
        ).some((element) => element.offsetWidth > 0),
      undefined,
      { timeout: 15000 },
    );

    const syncResult = await page.evaluate(async () => {
      const budgetScrollArea = Array.from(
        document.querySelectorAll<HTMLElement>('[aria-label="Budget table scroll area"]'),
      ).find((element) => element.offsetWidth > 0 && element.scrollWidth > element.clientWidth);
      const totalsScrollArea = Array.from(
        document.querySelectorAll<HTMLElement>('[aria-label="Budget totals scroll area"]'),
      ).find((element) => element.offsetWidth > 0);

      if (!budgetScrollArea || !totalsScrollArea) {
        return {
          foundScrollAreas: false,
          bodyScrollLeft: 0,
          totalsScrollLeft: 0,
          totalsFocused: false,
        };
      }

      budgetScrollArea.scrollLeft = 320;
      budgetScrollArea.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(resolve));

      totalsScrollArea.focus();

      return {
        foundScrollAreas: true,
        bodyScrollLeft: Math.round(budgetScrollArea.scrollLeft),
        totalsScrollLeft: Math.round(totalsScrollArea.scrollLeft),
        totalsFocused: document.activeElement === totalsScrollArea,
      };
    });

    expect(syncResult.foundScrollAreas).toBe(true);
    expect(syncResult.bodyScrollLeft).toBeGreaterThan(250);
    expect(syncResult.totalsScrollLeft).toBeGreaterThan(250);
    expect(syncResult.totalsFocused).toBe(true);
  });

  test("uses an expandable budget list on phone screens", async ({
    authenticatedRequest,
    page,
  }) => {
    const seededProjectResponse = await authenticatedRequest.get("/api/projects/67");
    let projectId = 67;

    if (!seededProjectResponse.ok()) {
      const projectsResponse = await authenticatedRequest.get(
        "/api/projects?archived=false&page=1&limit=1",
      );
      expect(projectsResponse.ok()).toBeTruthy();

      const projectsJson = await projectsResponse.json();
      const project = projectsJson.projects?.[0] ?? projectsJson.data?.[0];
      expect(project?.id, "A project fixture is required for the budget mobile list check").toBeTruthy();
      projectId = project.id;
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${projectId}/budget`);
    await expect(page.getByRole("heading", { name: "Budget" })).toBeVisible();
    await expect(page.getByTestId("budget-mobile-list").first()).toBeVisible();
    await expect(page.getByLabel("Budget table scroll area")).toBeHidden();
    await expect(
      page.getByTestId("budget-mobile-list").first().getByText("Grand Totals"),
    ).toBeVisible();

    const metrics = await page.evaluate(() => ({
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      cardCount: document.querySelectorAll("[data-budget-mobile-card]").length,
      hasProjected: document.body.innerText.toLowerCase().includes("projected +/-"),
    }));

    expect(metrics.docOverflow).toBe(false);
    expect(metrics.cardCount).toBeGreaterThan(0);
    expect(metrics.hasProjected).toBe(true);
  });
});
