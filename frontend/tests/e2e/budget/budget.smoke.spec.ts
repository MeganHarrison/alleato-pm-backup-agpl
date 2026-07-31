import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/index";
import { createTestProject } from "../../helpers/bootstrap";

let projectId: number;

interface BudgetApiLineItem {
  costCode: string;
  costType: string;
  originalBudgetAmount: number;
}

interface BudgetApiResponse {
  lineItems?: BudgetApiLineItem[];
}

/**
 * Waits for the main budget table so the page is ready for interaction.
 */
async function waitForBudgetTable(page: Page) {
  await page.waitForSelector("table", { timeout: 15000 });
}

test.describe("Budget Core", () => {
  test.beforeEach(async ({ page, authenticatedRequest }) => {
    const project = await createTestProject(
      page,
      { template: "commercial" },
      authenticatedRequest,
    );
    projectId = project.project.id;
  });

  test("loads budget page with seeded line items", async ({ page, safeNavigate }) => {
    await safeNavigate(`/${projectId}/budget`);
    await waitForBudgetTable(page);

    await expect(page.getByRole("button", { name: /^budget$/i }).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("opens the budget line item creation modal", async ({ page, safeNavigate }) => {
    await safeNavigate(`/${projectId}/budget`);

    const createButton = page.getByRole("button", { name: /create/i }).first();
    await expect(createButton).toBeVisible({ timeout: 15000 });
    await createButton.click();

    const budgetLineItemOption = page.getByRole("menuitem", {
      name: /budget line item/i,
    });
    await expect(budgetLineItemOption).toBeVisible({ timeout: 5000 });
    await budgetLineItemOption.click();

    await expect(page.getByText(/Add Budget Line Items|Create Budget Line Items/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("opens budget column detail modal", async ({ page, safeNavigate }) => {
    await safeNavigate(`/${projectId}/budget`);
    await waitForBudgetTable(page);

    const cell = page.locator('button[aria-label^="Edit $"]').first();
    await expect(cell).toBeVisible({ timeout: 15000 });
    await cell.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15000 });

    const closeButton = dialog.getByRole("button", { name: /close|cancel/i }).first();
    await closeButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 15000 });
  });

  test("adds to an existing budget line without history FK errors", async ({
    authenticatedRequest,
  }) => {
    const beforeResponse = await authenticatedRequest.get(
      `/api/projects/${projectId}/budget`,
    );
    expect(beforeResponse.ok()).toBeTruthy();

    const beforeBudget = (await beforeResponse.json()) as BudgetApiResponse;
    const existingLine = beforeBudget.lineItems?.find(
      (line) => line.costCode && line.costType,
    );
    expect(existingLine).toBeDefined();
    if (!existingLine) return;

    const addResponse = await authenticatedRequest.post(
      `/api/projects/${projectId}/budget`,
      {
        data: {
          lineItems: [
            {
              costCodeId: existingLine.costCode,
              costType: existingLine.costType,
              qty: "2",
              uom: "LS",
              unitCost: "5000",
              amount: "10000",
              description: "Repeat add regression line",
            },
          ],
        },
      },
    );

    const addResponseText = await addResponse.text();
    expect(
      addResponse.ok(),
      `Expected repeat add to succeed, got ${addResponse.status()}: ${addResponseText}`,
    ).toBeTruthy();
    expect(addResponseText).not.toContain("budget_line_history");
    expect(addResponseText).not.toContain("foreign key constraint");

    const afterResponse = await authenticatedRequest.get(
      `/api/projects/${projectId}/budget`,
    );
    expect(afterResponse.ok()).toBeTruthy();

    const afterBudget = (await afterResponse.json()) as BudgetApiResponse;
    const updatedLine = afterBudget.lineItems?.find(
      (line) =>
        line.costCode === existingLine.costCode &&
        line.costType === existingLine.costType,
    );

    expect(updatedLine).toBeDefined();
    expect(updatedLine?.originalBudgetAmount).toBe(
      existingLine.originalBudgetAmount + 10000,
    );
  });
});
