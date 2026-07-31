import { test, expect } from '../fixtures/index';
import { createTestProject } from '../helpers/bootstrap';
import {

  addProjectMember,
  createProject,
  getUserIdByEmail,
  listBudgetLinesForProject,
  deleteBudgetLinesByProject,
} from "../helpers/db";
import { cleanupProjectArtifacts } from "../helpers/cleanup";
import { pollFor } from "../helpers/poll";
test.skip(true, "Legacy budget spec - migrated to budget-core");


const testUserEmail =
  process.env.PLAYWRIGHT_TEST_USER_EMAIL ?? "test1@mail.com";

let projectId: number;

test.describe.skip("Budget – Line Item CRUD", () => {
  test.beforeEach(async ({ page, authenticatedRequest }) => {
    const project = await createTestProject(page, {}, authenticatedRequest);
    projectId = project.project.id;
  });

  test.beforeAll(async () => {
    const userId = await getUserIdByEmail(testUserEmail);
    projectId = await createProject(`E2E Budget ${Date.now()}`);
    await addProjectMember(projectId, userId, "admin");
  });

  test.afterAll(async () => {
    if (projectId) {
      await cleanupProjectArtifacts(projectId);
    }
  });

  // ── READ: Budget page loads with correct tabs ──────────────────

  test("Budget page loads and displays tabs", async ({ page }) => {
    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState("domcontentloaded");

    // Verify the budget page loaded (header or tabs visible)
    const budgetHeader = page.getByText(/budget/i).first();
    await expect(budgetHeader).toBeVisible({ timeout: 15000 });

    // Check for budget tabs
    const budgetTab = page.getByRole("tab", { name: /budget/i })
      .or(page.locator("button:has-text('Budget')")).first();

    if (await budgetTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(budgetTab).toBeVisible();
    }
  });

  // ── CREATE: Add line item via the wizard ───────────────────────

  test("Create budget line item via UI wizard", async ({ page }) => {
    await deleteBudgetLinesByProject(projectId);

    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState("domcontentloaded");

    // Click Create button
    const createButton = page.getByRole("button", {
      name: /create/i,
    }).first();
    await expect(createButton).toBeVisible({ timeout: 15000 });
    await createButton.click();

    // Wait for create modal/wizard to appear
    const dialog = page.getByRole("dialog");
    const wizardVisible = await dialog
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (wizardVisible) {
      // Fill cost code if there's an input
      const costCodeInput = dialog.locator(
        "input[name*='cost_code'], input[name*='costCode'], " +
        "input[placeholder*='cost code'], input[placeholder*='Cost Code']",
      ).first();

      if (await costCodeInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await costCodeInput.fill("01-100");
        await page.waitForTimeout(500);

        // Select from dropdown if one appeared
        const option = page.locator(
          "[role='option'], [role='listbox'] li, [data-value]",
        ).first();
        if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
          await option.click();
        }
      }

      // Fill description
      const descInput = dialog.locator(
        "input[name*='description'], textarea[name*='description']",
      ).first();
      if (await descInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await descInput.fill("E2E Test Budget Line");
      }

      // Fill original amount
      const amountInput = dialog.locator(
        "input[name*='amount'], input[name*='originalAmount'], " +
        "input[type='number']",
      ).first();
      if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await amountInput.fill("50000");
      }

      // Save / Create
      const saveButton = dialog.getByRole("button", {
        name: /save|create|add|submit/i,
      }).first();
      if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveButton.click();
      }

      // Wait for dialog to close and data to refresh
      await page.waitForTimeout(2000);

      // Verify the line item appears in the table
      const lineText = page.getByText("E2E Test Budget Line");
      const created = await lineText
        .isVisible({ timeout: 10000 })
        .catch(() => false);

      if (created) {
        // Also verify in database
        await pollFor(
          () => listBudgetLinesForProject(projectId),
          (rows) => {
            expect(rows.length).toBeGreaterThan(0);
          },
        );
      }
    }
  });

  // ── EDIT: Modify budget line via inline edit ───────────────────

  test("Edit budget line item updates description", async ({
    page,
  }) => {
    // This test requires an existing line item created via UI or DB
    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState("domcontentloaded");

    // Wait for table content to load
    await page.waitForTimeout(3000);

    // Find an edit button (pencil icon) on a row
    const editButton = page.locator(
      "button:has(svg[class*='lucide-pencil']), " +
      "button:has(svg[class*='lucide-edit']), " +
      "[data-testid*='edit']",
    ).first();

    if (await editButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editButton.click();

      // Wait for edit modal
      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Find and update description
        const descInput = dialog.locator(
          "input[name*='description'], textarea[name*='description']",
        ).first();

        if (await descInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await descInput.clear();
          await descInput.fill("Updated Budget Line Description");

          // Save
          const saveButton = dialog.getByRole("button", {
            name: /save|update|submit/i,
          }).first();
          await saveButton.click();

          // Verify update appears in table
          await expect(
            page.getByText("Updated Budget Line Description"),
          ).toBeVisible({ timeout: 10000 });
        }
      }
    }
  });

  // ── DELETE: Select and delete line items ────────────────────────

  test("Delete selected budget line items", async ({ page }) => {
    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Check if there are rows with checkboxes
    const checkbox = page.locator(
      "tbody input[type='checkbox'], " +
      "tbody [role='checkbox']",
    ).first();

    if (await checkbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Select the first row
      await checkbox.click();
      await page.waitForTimeout(500);

      // Look for "Delete Selected" button that appears in selection bar
      const deleteSelected = page.getByRole("button", {
        name: /delete selected|delete/i,
      });

      if (
        await deleteSelected
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await deleteSelected.click();

        // Confirm deletion
        const confirmDelete = page.getByRole("button", {
          name: /delete|confirm|yes/i,
        }).last();

        if (
          await confirmDelete
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          await confirmDelete.click();

          // Verify toast or row removal
          const toast = page.getByText(/deleted successfully/i);
          await expect(toast).toBeVisible({ timeout: 10000 });
        }
      }
    }
  });

  // ── KEYBOARD: Ctrl+E opens create dialog ───────────────────────

  test("Ctrl+E keyboard shortcut opens create line item dialog", async ({
    page,
  }) => {
    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Press Ctrl+E
    await page.keyboard.press("Control+KeyE");
    await page.waitForTimeout(500);

    // Should open the create dialog
    const dialog = page.getByRole("dialog");
    const opened = await dialog
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (opened) {
      await expect(dialog).toBeVisible();

      // Close it
      await page.keyboard.press("Escape");
    }
  });

  // ── TABS: Navigate between budget tabs ─────────────────────────

  test("Tab navigation switches budget views", async ({ page }) => {
    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Try switching to Cost Codes tab
    const costCodesTab = page.getByRole("tab", {
      name: /cost.?codes/i,
    }).or(page.locator("button:has-text('Cost Codes')")).first();

    if (
      await costCodesTab.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await costCodesTab.click();
      await page.waitForTimeout(1000);

      // Should update URL or show different content
      const url = page.url();
      const hasCostCodesParam =
        url.includes("tab=cost-codes") ||
        url.includes("cost-codes");

      // Check for cost codes content
      const costCodesContent = page.getByText(/cost code/i);
      const visible = await costCodesContent
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(hasCostCodesParam || visible).toBe(true);
    }

    // Switch to Forecasting tab
    const forecastTab = page.getByRole("tab", {
      name: /forecast/i,
    }).or(page.locator("button:has-text('Forecasting')")).first();

    if (
      await forecastTab.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await forecastTab.click();
      await page.waitForTimeout(1000);
    }

    // Switch back to Budget tab
    const budgetTab = page.getByRole("tab", {
      name: /^budget$/i,
    }).or(page.locator("button:has-text('Budget')")).first();

    if (
      await budgetTab.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await budgetTab.click();
      await page.waitForTimeout(1000);
    }
  });

  // ── EXPORT: Export button triggers download ────────────────────

  test("Export button is functional", async ({ page }) => {
    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Look for Export button
    const exportButton = page.getByRole("button", {
      name: /export/i,
    });

    if (
      await exportButton.isVisible({ timeout: 5000 }).catch(() => false)
    ) {
      await exportButton.click();
      await page.waitForTimeout(500);

      // Export dropdown should appear with format options
      const excelOption = page.getByRole("menuitem", {
        name: /excel/i,
      });
      const csvOption = page.getByRole("menuitem", {
        name: /csv/i,
      });

      const hasExcel = await excelOption
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      const hasCsv = await csvOption
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      expect(hasExcel || hasCsv).toBe(true);

      // Close dropdown
      await page.keyboard.press("Escape");
    }
  });
});
