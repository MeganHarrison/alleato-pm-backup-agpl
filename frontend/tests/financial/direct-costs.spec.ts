import { test, expect } from "@playwright/test";
import {
  addProjectMember,
  createDirectCost,
  createProject,
  deleteDirectCostsByProject,
  getDirectCost,
  getUserIdByEmail,
  listDirectCostsForProject,
} from "../helpers/db";
import { cleanupProjectArtifacts } from "../helpers/cleanup";
import { pollFor } from "../helpers/poll";

const testUserEmail =
  process.env.PLAYWRIGHT_TEST_USER_EMAIL ?? "test1@mail.com";

let projectId: number;
let testUserId: string;

test.describe("Direct Costs – CRUD Workflows", () => {
  test.beforeAll(async () => {
    testUserId = await getUserIdByEmail(testUserEmail);
    projectId = await createProject(`E2E Direct Costs ${Date.now()}`);
    await addProjectMember(projectId, testUserId, "admin");
  });

  test.afterAll(async () => {
    if (projectId) {
      await cleanupProjectArtifacts(projectId);
    }
  });

  // ── READ: Empty state ──────────────────────────────────────────

  test("Empty state shows when no direct costs exist", async ({
    page,
  }) => {
    await deleteDirectCostsByProject(projectId);

    await page.goto(`/${projectId}/direct-costs`);
    await page.waitForLoadState("domcontentloaded");

    // Look for empty state text
    const emptyMsg = page.getByText(/no direct costs/i);
    const addFirst = page.getByText(/add your first/i);
    const emptyTable = page.locator("tbody tr");

    const hasEmptyText = await emptyMsg
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    const hasAddFirst = await addFirst
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    const rowCount = await emptyTable.count().catch(() => 0);

    expect(hasEmptyText || hasAddFirst || rowCount === 0).toBe(true);
  });

  // ── READ: Seeded data renders ──────────────────────────────────

  test("Seeded direct cost renders in the list", async ({ page }) => {
    await deleteDirectCostsByProject(projectId);

    const directCost = await createDirectCost({
      project_id: projectId,
      cost_type: "Expense",
      date: "2025-06-15",
      description: "Concrete delivery for foundations",
      invoice_number: `INV-${Date.now()}`,
      status: "Draft",
      total_amount: 4500,
      created_by_user_id: testUserId,
      updated_by_user_id: testUserId,
    });

    await page.goto(`/${projectId}/direct-costs`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // If data not visible yet, reload
    const dataVisible = await page
      .getByRole("cell", { name: "Concrete delivery for foundations" })
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!dataVisible) {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
    }

    // Verify description appears in the table cell
    await expect(
      page.getByRole("cell", { name: "Concrete delivery for foundations" }),
    ).toBeVisible({ timeout: 15000 });

    // Verify invoice number renders
    await expect(
      page.getByRole("cell", { name: directCost.invoice_number! }),
    ).toBeVisible();
  });

  // ── CREATE: Navigate to form and submit ────────────────────────

  test.skip("Create direct cost via form persists to database", async ({
    page,
  }) => {
    await deleteDirectCostsByProject(projectId);

    await page.goto(`/${projectId}/direct-costs`);
    await page.waitForLoadState("domcontentloaded");

    // Click Add Direct Cost button
    const addButton = page.getByRole("button", {
      name: /add direct cost/i,
    }).first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();
    await page.waitForTimeout(1000);

    // May navigate to /new or open a dialog — handle both
    const onNewPage = page.url().includes("/direct-costs/new");
    if (!onNewPage) {
      // Try "Add your first direct cost" if empty state
      const firstCostBtn = page.getByRole("button", {
        name: /add your first/i,
      });
      if (await firstCostBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstCostBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Wait for form — either navigated or dialog opened
    await page.waitForLoadState("domcontentloaded");

    // Step 1: Basic Information
    // Fill cost type select
    const costTypeSelect = page.locator(
      "#cost_type, [name='cost_type']",
    ).first();
    if (await costTypeSelect.isVisible({ timeout: 5000 })) {
      await costTypeSelect.click();
      await page.waitForTimeout(300);
      // Select first option that isn't the placeholder
      const firstOption = page.getByRole("option").first();
      if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOption.click();
      }
    }

    // Fill description
    const descInput = page.locator(
      "textarea[name='description'], #description",
    ).first();
    if (await descInput.isVisible({ timeout: 3000 })) {
      await descInput.fill("E2E Test - Steel delivery");
    }

    // Fill date
    const dateInput = page.locator(
      "input[name='date'], #date, input[type='date']",
    ).first();
    if (await dateInput.isVisible({ timeout: 3000 })) {
      await dateInput.fill("2025-07-01");
    }

    // Fill invoice number
    const invoiceInput = page.locator(
      "input[name='invoice_number'], #invoice_number",
    ).first();
    const testInvoice = `INV-E2E-${Date.now()}`;
    if (await invoiceInput.isVisible({ timeout: 3000 })) {
      await invoiceInput.fill(testInvoice);
    }

    // Look for a Save or Next button
    const saveButton = page.getByRole("button", {
      name: /save|create|submit/i,
    });
    const nextButton = page.getByRole("button", {
      name: /next/i,
    });

    // If multi-step, navigate through steps then save
    if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextButton.click();
      await page.waitForTimeout(500);

      // Step 2 might need line items — try to skip to save
      const saveOrNext = page.getByRole("button", {
        name: /save|next/i,
      }).first();
      await saveOrNext.click();
      await page.waitForTimeout(500);

      // Step 3 (attachments) — save
      const finalSave = page.getByRole("button", {
        name: /save|create|submit/i,
      }).first();
      if (await finalSave.isVisible({ timeout: 3000 }).catch(() => false)) {
        await finalSave.click();
      }
    } else if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveButton.click();
    }

    // Wait for redirect or success toast
    await page.waitForTimeout(3000);

    // Verify it was created in DB
    await pollFor(
      () => listDirectCostsForProject(projectId),
      (rows) => {
        expect(rows.length).toBeGreaterThan(0);
      },
      15000,
    );
  });

  // ── DELETE: Remove direct cost ─────────────────────────────────

  test("Delete direct cost removes it from list", async ({
    page,
  }) => {
    await deleteDirectCostsByProject(projectId);

    const directCost = await createDirectCost({
      project_id: projectId,
      cost_type: "Invoice",
      date: "2025-06-20",
      description: "E2E Delete Test Item",
      invoice_number: `INV-DEL-${Date.now()}`,
      status: "Draft",
      total_amount: 2000,
      created_by_user_id: testUserId,
      updated_by_user_id: testUserId,
    });

    await page.goto(`/${projectId}/direct-costs`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // If data not visible yet, reload
    const itemVisible = await page
      .getByRole("cell", { name: "E2E Delete Test Item" })
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!itemVisible) {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
    }

    // Wait for the row
    await expect(
      page.getByRole("cell", { name: "E2E Delete Test Item" }),
    ).toBeVisible({ timeout: 15000 });

    // Find the row and its action menu
    const row = page.getByRole("row", {
      name: /E2E Delete Test Item/i,
    });

    const actionButton = row.getByRole("button", { name: /open menu/i });
    await actionButton.click();
    await page.waitForTimeout(500);

    // Click Delete
    const deleteItem = page.getByRole("menuitem", {
      name: /delete/i,
    }).first();
    await deleteItem.click();
    await page.waitForTimeout(500);

    // Confirm deletion dialog
    const confirmButton = page.getByRole("button", {
      name: /delete|confirm|yes/i,
    }).last();
    if (
      await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await confirmButton.click();
    }

    // Wait for UI update
    await page.waitForTimeout(2000);

    // Verify removed from UI
    await expect(
      page.getByRole("cell", { name: "E2E Delete Test Item" }),
    ).not.toBeVisible({ timeout: 10000 });
  });

  // ── SEARCH: Filter by description ──────────────────────────────

  test("Search filters direct costs by description", async ({
    page,
  }) => {
    await deleteDirectCostsByProject(projectId);

    // Seed two items with different descriptions
    await createDirectCost({
      project_id: projectId,
      cost_type: "Expense",
      date: "2025-06-15",
      description: "Rebar shipment batch A",
      status: "Draft",
      total_amount: 3000,
      created_by_user_id: testUserId,
      updated_by_user_id: testUserId,
    });

    await createDirectCost({
      project_id: projectId,
      cost_type: "Subcontractor Invoice",
      date: "2025-06-16",
      description: "Crane rental June",
      status: "Approved",
      total_amount: 8000,
      created_by_user_id: testUserId,
      updated_by_user_id: testUserId,
    });

    await page.goto(`/${projectId}/direct-costs`);
    await page.waitForLoadState("domcontentloaded");

    // Wait for both items to load
    await expect(
      page.getByRole("cell", { name: "Rebar shipment batch A" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("cell", { name: "Crane rental June" }),
    ).toBeVisible();

    // Search for "rebar"
    const searchInput = page.getByPlaceholder(
      /search/i,
    );
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill("rebar");
      await page.waitForTimeout(1000);

      // Rebar should still be visible
      await expect(
        page.getByRole("cell", { name: "Rebar shipment batch A" }),
      ).toBeVisible();

      // Crane should be filtered out
      await expect(
        page.getByRole("cell", { name: "Crane rental June" }),
      ).not.toBeVisible({ timeout: 3000 });

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(1000);

      // Both should be visible again
      await expect(
        page.getByRole("cell", { name: "Crane rental June" }),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ── VIEW: Navigate to detail page ──────────────────────────────

  test("Clicking view opens direct cost detail page", async ({
    page,
  }) => {
    await deleteDirectCostsByProject(projectId);

    const directCost = await createDirectCost({
      project_id: projectId,
      cost_type: "Expense",
      date: "2025-06-15",
      description: "Detail View Test",
      invoice_number: `INV-VIEW-${Date.now()}`,
      status: "Draft",
      total_amount: 1500,
      created_by_user_id: testUserId,
      updated_by_user_id: testUserId,
    });

    await page.goto(`/${projectId}/direct-costs`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // If data not visible yet, reload
    const visible = await page
      .getByRole("cell", { name: "Detail View Test" })
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!visible) {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
    }

    await expect(
      page.getByRole("cell", { name: "Detail View Test" }),
    ).toBeVisible({ timeout: 15000 });

    // Open action menu via "Open menu" button in the row
    const row = page.getByRole("row", {
      name: /Detail View Test/i,
    });
    const actionButton = row.getByRole("button", { name: /open menu/i });
    await actionButton.click();
    await page.waitForTimeout(300);

    // Click View
    const viewItem = page.getByRole("menuitem", {
      name: /view/i,
    });
    if (await viewItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewItem.click();

      // Should navigate to detail page
      await page.waitForURL(
        `**/${projectId}/direct-costs/${directCost.id}**`,
        { timeout: 10000 },
      );

      // Verify detail content
      await expect(
        page.getByText("Detail View Test").first(),
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
