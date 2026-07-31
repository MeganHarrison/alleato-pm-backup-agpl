import { expect, test } from "../../fixtures/index";
import type { Page } from "@playwright/test";

async function mockCommitmentsList(page: Page) {
  await page.route("**/api/commitments?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        data: [
          {
            id: "commitment-selection-gutter",
            project_id: 67,
            number: "SC-001",
            title: "Selection gutter check",
            type: "subcontract",
            status: "draft",
            executed: false,
            original_amount: 1000,
            revised_contract_amount: 1000,
            billed_to_date: 0,
            balance_to_finish: 1000,
            contract_company_id: "company-1",
            contract_company: {
              id: "company-1",
              name: "A Brannan Builders LLC",
              type: "subcontractor",
            },
            description: null,
            start_date: null,
            executed_date: null,
            retention_percentage: null,
            created_at: "2026-04-26T00:00:00.000Z",
            updated_at: "2026-04-26T00:00:00.000Z",
            erp_status: "not_synced",
            ssov_status: "draft",
            approved_change_orders: 0,
            pending_change_orders: 0,
            draft_change_orders: 0,
            invoiced_amount: 0,
            payments_issued: 0,
            percent_paid: 0,
            remaining_balance: 1000,
            is_private: false,
          },
        ],
        meta: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
        },
      },
    });
  });
}

test.describe("Mobile shell chrome", () => {
  test("keeps shared development and onboarding chrome from obscuring product pages", async ({
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
      expect(project?.id, "A project fixture is required for mobile shell checks").toBeTruthy();
      projectId = project.id;
    }

    const routes = [
      { path: "/", heading: "Projects" },
      { path: `/${projectId}/budget`, heading: "Budget" },
      { path: `/${projectId}/commitments`, heading: "Commitments" },
      { path: `/${projectId}/invoices`, heading: "Invoices" },
      { path: `/${projectId}/schedule`, heading: "Schedule" },
    ];

    await page.setViewportSize({ width: 390, height: 844 });

    async function expectControlInsideViewport(label: string) {
      const control = page.getByLabel(label).first();
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box, `${label} should have a layout box`).toBeTruthy();
      expect(box!.x, `${label} should not be clipped off the left edge`).toBeGreaterThanOrEqual(0);
      expect(
        box!.x + box!.width,
        `${label} should not be clipped off the right edge`,
      ).toBeLessThanOrEqual(390);
    }

    for (const route of routes) {
      const consoleMessages: string[] = [];
      page.on("console", (message) => {
        consoleMessages.push(message.text());
      });

      await page.goto(route.path);
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible({
        timeout: 15000,
      });

      const metrics = await page.evaluate(() => {
        const fixedElements = Array.from(document.querySelectorAll<HTMLElement>("*"))
          .map((element) => {
            const styles = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return {
              ariaLabel: element.getAttribute("aria-label"),
              className: element.getAttribute("class"),
              height: rect.height,
              position: styles.position,
              text: element.textContent?.trim() ?? "",
              width: rect.width,
            };
          })
          .filter(
            (element) =>
              element.position === "fixed" && element.width > 1 && element.height > 1,
          );

        return {
          docOverflow:
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
          fixedElements,
          hasAiLauncher: !!document.querySelector("[aria-label='Open Alleato AI']"),
          hasAdminFeedback: !!document.querySelector("[data-admin-feedback-root='true']"),
          hasAgentationChrome:
            document.body.innerText.includes("Agentation") ||
            document.body.innerText.includes("MCP Connected") ||
            /\d+ Issues/.test(document.body.innerText),
          hasWelcome: !!document.querySelector("[aria-label='Alleato AI welcome']"),
        };
      });

      expect(metrics.docOverflow, `${route.path} should not create page-level x-scroll`).toBe(
        false,
      );
      expect(metrics.hasWelcome, `${route.path} should not auto-open mobile onboarding`).toBe(false);
      expect(metrics.hasAdminFeedback, `${route.path} should hide admin feedback on mobile`).toBe(
        false,
      );
      expect(metrics.hasAgentationChrome, `${route.path} should hide Agentation on mobile`).toBe(
        false,
      );
      expect(metrics.hasAiLauncher, `${route.path} should keep the AI launcher available`).toBe(
        true,
      );
      expect(metrics.fixedElements).toHaveLength(1);
      expect(consoleMessages.join("\n")).not.toContain(
        'Image with src "/Alleato-Group-Logo_Dark.png"',
      );

      if (route.heading === "Commitments") {
        const tabsMetrics = await page.evaluate(() => {
          const tabs = document.querySelector<HTMLElement>("nav[aria-label='Tabs']");
          if (!tabs) return null;
          const rect = tabs.getBoundingClientRect();
          return {
            clientWidth: tabs.clientWidth,
            right: rect.right,
            scrollWidth: tabs.scrollWidth,
          };
        });

        expect(tabsMetrics, "Commitments tabs should exist").toBeTruthy();
        expect(tabsMetrics!.scrollWidth, "Commitments tabs should scroll horizontally").toBeGreaterThan(
          tabsMetrics!.clientWidth,
        );
        expect(tabsMetrics!.right, "Commitments tabs should run flush to the right edge").toBeGreaterThanOrEqual(390);
      }

      if (route.heading === "Schedule") {
        await expectControlInsideViewport("Switch to Timeline view");

        await page.getByLabel("Switch to Board view").click();
        const firstScheduleCard = page.locator("[data-schedule-task-card='true']").first();
        await expect(firstScheduleCard).toBeVisible();

        const cardBox = await firstScheduleCard.boundingBox();
        expect(cardBox, "Schedule board card should have a layout box").toBeTruthy();
        expect(cardBox!.width, "Schedule board cards should use the available phone width").toBeGreaterThanOrEqual(320);
        expect(cardBox!.height, "Schedule board cards should stay dense on mobile").toBeLessThanOrEqual(120);
      }
    }
  });

  test("keeps Commitments table selection gutter compact at narrow tablet width", async ({
    page,
  }) => {
    await mockCommitmentsList(page);

    await page.setViewportSize({ width: 676, height: 923 });
    await page.goto("/67/commitments?view=table");
    await expect(page.getByRole("heading", { name: "Commitments" })).toBeVisible({
      timeout: 15000,
    });

    const selectionHeaderMetrics = await page.evaluate(() => {
      const selectionHeader = document.querySelector<HTMLElement>(
        "table thead tr:last-child th:first-child",
      );
      if (!selectionHeader) return null;
      const rect = selectionHeader.getBoundingClientRect();
      const styles = window.getComputedStyle(selectionHeader);
      return {
        boxShadow: styles.boxShadow,
        width: rect.width,
      };
    });

    expect(selectionHeaderMetrics, "Commitments table selection header should exist").toBeTruthy();
    expect(selectionHeaderMetrics!.width, "Selection column should stay compact").toBeLessThanOrEqual(44);
    expect(selectionHeaderMetrics!.boxShadow, "Selection column should not draw a divider").toBe("none");
  });

  test("keeps Commitments mobile header, tabs, and cards compact", async ({ page }) => {
    await mockCommitmentsList(page);

    await page.setViewportSize({ width: 512, height: 923 });
    await page.goto("/67/commitments?view=table");
    await expect(page.getByRole("heading", { name: "Commitments" })).toBeVisible({
      timeout: 15000,
    });

    const metrics = await page.evaluate(() => {
      const title = Array.from(document.querySelectorAll("h1")).find(
        (element) => element.textContent?.trim() === "Commitments",
      );
      const tabs = document.querySelector<HTMLElement>("nav[aria-label='Tabs']");
      const card = Array.from(document.querySelectorAll<HTMLElement>("[role='button']")).find(
        (element) => element.textContent?.includes("Selection gutter check"),
      );
      const expand = card?.querySelector<HTMLElement>("[aria-label='Expand commitment']");
      const action = card?.querySelector<HTMLElement>("[aria-label='Row actions']");
      const tabsRect = tabs?.getBoundingClientRect();
      const cardRect = card?.getBoundingClientRect();
      const expandRect = expand?.getBoundingClientRect();
      const actionRect = action?.getBoundingClientRect();
      const cardStyles = card ? window.getComputedStyle(card) : null;

      return {
        card: {
          borderColor: cardStyles?.borderColor,
          height: cardRect?.height,
          width: cardRect?.width,
        },
        docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        expandX: expandRect?.x,
        actionX: actionRect?.x,
        hasItemCount: Array.from(document.querySelectorAll("span, div")).some((element) => {
          const directText = Array.from(element.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent ?? "")
            .join("")
            .trim();
          return /^\d+ items$/.test(directText);
        }),
        tabs: {
          clientWidth: tabs?.clientWidth,
          scrollWidth: tabs?.scrollWidth,
          right: tabsRect?.right,
        },
      };
    });

    expect(metrics.hasItemCount).toBe(false);
    expect(metrics.tabs.scrollWidth).toBeGreaterThan(metrics.tabs.clientWidth ?? 0);
    expect(metrics.tabs.right).toBeGreaterThanOrEqual(512);
    expect(metrics.card.width).toBeGreaterThan(450);
    expect(metrics.card.height).toBeLessThanOrEqual(150);
    expect(metrics.expandX ?? 0).toBeGreaterThan(340);
    expect(metrics.actionX ?? 0).toBeGreaterThan(metrics.expandX ?? 0);
    expect(metrics.docOverflow).toBe(false);
  });

  test("keeps Commitments desktop tabs full width and supports expand all", async ({ page }) => {
    await mockCommitmentsList(page);

    await page.setViewportSize({ width: 1183, height: 923 });
    await page.goto("/67/commitments");
    await expect(page.getByRole("heading", { name: "Commitments" })).toBeVisible({
      timeout: 15000,
    });

    const toolbarMetrics = await page.evaluate(() => {
      const tabs = document.querySelector<HTMLElement>("nav[aria-label='Tabs']");
      const tabsRect = tabs?.getBoundingClientRect();
      const desktopTabFade = tabs?.parentElement?.querySelector<HTMLElement>(
        ".pointer-events-none.absolute.right-0",
      );
      const desktopTabFadeRect = desktopTabFade?.getBoundingClientRect();
      const tableScroller = document.querySelector<HTMLElement>("table")?.parentElement?.parentElement;
      const tableScrollerRect = tableScroller?.getBoundingClientRect();
      return {
        desktopTabFadeVisible:
          Boolean(desktopTabFadeRect) &&
          (desktopTabFadeRect?.width ?? 0) > 0 &&
          (desktopTabFadeRect?.height ?? 0) > 0 &&
          window.getComputedStyle(desktopTabFade!).display !== "none",
        hasToolbarItemCount: Array.from(document.querySelectorAll("span, div")).some((element) => {
          const directText = Array.from(element.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent ?? "")
            .join("")
            .trim();
          return /^\d+ items$/.test(directText);
        }),
        tableScrollerClientWidth: tableScroller?.clientWidth,
        tableScrollerRight: tableScrollerRect?.right,
        tabsHeight: tabsRect?.height,
        tabsWidth: tabsRect?.width,
      };
    });

    expect(toolbarMetrics.tabsWidth).toBeGreaterThan(900);
    expect(toolbarMetrics.tabsHeight).toBeLessThanOrEqual(50);
    expect(toolbarMetrics.desktopTabFadeVisible).toBe(false);
    expect(toolbarMetrics.hasToolbarItemCount).toBe(false);
    expect(toolbarMetrics.tableScrollerRight).toBeGreaterThanOrEqual(1183);

    const expandAll = page.getByLabel("Expand all rows");
    await expect(expandAll).toBeVisible();
    await expandAll.evaluate((element) => (element as HTMLButtonElement).click());
    await expect(page.getByLabel("Collapse all rows")).toBeVisible();
    await expect(page.locator("button[aria-label='Collapse commitment']:visible").first()).toBeVisible();
  });
});
