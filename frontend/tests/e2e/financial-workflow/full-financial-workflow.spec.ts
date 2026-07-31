/**
 * Full Financial Workflow E2E Test
 *
 * Tests the complete construction project financial lifecycle:
 *
 * 1.  Create project (bootstrap API via page.request)
 * 2.  Create prime contract (UI — form at /prime-contracts/new)
 * 3.  Add budget line items (UI — BudgetLineItemCreatorModal, NOT a dialog)
 * 4.  Lock budget (UI — AlertDialog confirmation required)
 * 5.  Unlock budget (UI — UnlockBudgetDialog, choose "Unlock and Preserve")
 * 6.  Create purchase order commitment (UI)
 * 7.  Create subcontract commitment (UI)
 * 8.  Create budget modification (UI — only available when budget IS locked)
 * 9.  Create direct cost (UI — navigates to /direct-costs/new page)
 * 10. Create prime contract invoice (UI)
 *
 * test.describe.serial → single worker, shared beforeAll/afterAll (runs once).
 * page fixture IS supported in beforeAll/afterAll within serial describe.
 */

import path from "path";
import { test, expect } from "../../fixtures/index";
import { createTestProject } from "../../helpers/bootstrap";

// ─── Shared State ────────────────────────────────────────────────────────────
let projectId: number;
let primeContractId: string;
const ts = Date.now();
const authFile = path.join(__dirname, "../../.auth/user.json");
const baseUrl =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost:3000";

// ─── Serial describe — shared worker + beforeAll/afterAll run once ────────────
test.describe.serial("Full Financial Workflow", () => {
  // Override per-test timeout to 2 minutes (root config has 60s which is too short)
  test.setTimeout(120000);

  // Use browser (worker-scoped) — page is test-scoped and not allowed in beforeAll/afterAll
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile });
    const pg = await ctx.newPage();
    try {
      const project = await createTestProject(pg, { template: "commercial" });
      projectId = project.project.id;
      console.log(`[FullWorkflow] Project created: ${projectId}`);
    } finally {
      await ctx.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    if (!projectId) return;
    const ctx = await browser.newContext({ storageState: authFile });
    const pg = await ctx.newPage();
    try {
      const res = await pg.request.delete(
        `${baseUrl}/api/projects/${projectId}`,
      );
      if (res.ok()) {
        console.log(`[FullWorkflow] Project ${projectId} archived`);
      } else {
        console.warn(`[FullWorkflow] Delete failed: ${res.status()}`);
      }
    } finally {
      await ctx.close();
    }
  });

  // ─── Step 2: Prime Contract ────────────────────────────────────────────────

  test("Step 2 – creates a prime contract with SOV line items", async ({
    page,
    safeNavigate,
  }) => {
    await safeNavigate(`/${projectId}/prime-contracts/new`);

    // A compiler/server error is a failed boundary. Do not hide it with an
    // unsolicited reload because that can invalidate form hydration.
    await expect(page.getByText("Cannot find module")).not.toBeVisible();
    await expect(page.getByText("Internal Server Error")).not.toBeVisible();

    // Wait for the form to be ready.
    await expect(page.getByLabel("Contract #")).toBeVisible({ timeout: 45000 });
    // Small delay for React to attach event handlers after hydration
    await page.waitForTimeout(500);

    const contractNumber = `PC-WF-${ts}`;
    const contractTitle = `Workflow Prime Contract ${ts}`;

    await page.getByLabel("Contract #").fill(contractNumber);
    await page.getByLabel("Title").fill(contractTitle);

    // Status → Approved (shadcn Select via label association)
    await page.getByLabel("Status").click();
    await page.waitForTimeout(500); // wait for dropdown to render
    // Options appear as role="option" within the Select portal
    await page
      .getByRole("option", { name: "Approved" })
      .click({ timeout: 10000 });

    // Mark as executed
    await page.getByLabel("Contract is executed").click();

    // Owner/client (first available)
    const ownerSelect = page.getByTestId("owner-client-select");
    if ((await ownerSelect.count()) > 0) {
      await ownerSelect.click();
      await page
        .locator('[data-testid^="owner-client-option-"]')
        .first()
        .click();
    }

    // SOV: first line
    const addLineEmpty = page.getByTestId("sov-add-line-empty");
    if ((await addLineEmpty.count()) > 0) {
      await addLineEmpty.click();
    } else {
      await page
        .getByRole("button", { name: /add line|add item/i })
        .first()
        .click();
    }

    const firstLine = page.getByTestId("sov-line-0");
    await firstLine.getByTestId("sov-line-description").fill("Site Work");
    await firstLine.getByTestId("sov-line-amount").fill("250000");

    // SOV: second line
    const addLineFooter = page.getByTestId("sov-add-line-footer");
    if ((await addLineFooter.count()) > 0) {
      await addLineFooter.click();
      const secondLine = page.getByTestId("sov-line-1");
      await secondLine.getByTestId("sov-line-description").fill("Foundation");
      await secondLine.getByTestId("sov-line-amount").fill("150000");
    }

    // Verify $400k total
    const total = page.getByTestId("sov-total-amount");
    if ((await total.count()) > 0) {
      await expect(total).toContainText("400");
    }

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/projects/${projectId}/contracts`,
      { timeout: 20000 },
    );
    await page.getByRole("button", { name: "Create Prime Contract" }).click();
    const createResponse = await createResponsePromise;
    const responseBody = await createResponse.json().catch(() => null);

    expect(
      createResponse.status(),
      `Prime contract creation failed: ${JSON.stringify(responseBody)}`,
    ).toBe(201);
    expect(responseBody?.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(responseBody?.creation_receipt?.lineItems?.attempted).toBe(2);
    expect(responseBody?.creation_receipt?.lineItems?.failed).toEqual([]);

    await expect(page).toHaveURL(
      new RegExp(`/${projectId}/prime-contracts/[a-f0-9-]{36}`),
      { timeout: 15000 },
    );

    primeContractId = page.url().split("/").pop()!;
    expect(primeContractId).toMatch(/^[a-f0-9-]{36}$/);

    await expect(
      page.getByRole("heading", { name: contractTitle }).first(),
    ).toBeVisible({ timeout: 10000 });

    console.log(`[FullWorkflow] Prime contract: ${primeContractId}`);
  });

  // ─── Step 3: Budget Line Items ───────────────────────────────────────────
  // Executing the prime contract locks newly created budget amounts at $0.00.
  // Create two lines so the subsequent balanced-transfer flow has From/To rows.

  test("Step 3 – adds zero-dollar budget lines after contract execution", async ({
    page,
  }) => {
    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /budget/i }).first(),
    ).toBeVisible({ timeout: 10000 });

    // Open Create dropdown
    const createBtn = page.getByRole("button", { name: /create/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();

    // Click "Budget Line Item" from the dropdown
    const lineItemOption = page.getByRole("menuitem", {
      name: /budget line item/i,
    });
    await expect(lineItemOption).toBeVisible({ timeout: 3000 });
    await lineItemOption.click();

    const modal = page.getByRole("dialog", { name: "Add Budget Line Items" });
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText("Budget amounts are locked")).toBeVisible();

    const createBudgetCodeForRow = async (
      rowNumber: number,
      costType: "L - Labor" | "M - Material",
    ) => {
      const codeSelect = modal.getByRole("combobox", {
        name: `Cost Code for line item ${rowNumber}`,
      });
      await expect(codeSelect).toBeEnabled({ timeout: 10000 });
      await codeSelect.click();
      await page.getByRole("option", { name: /create budget code/i }).click();

      const codeDialog = page.getByRole("dialog", {
        name: "Create New Budget Code",
      });
      await expect(codeDialog).toBeVisible({ timeout: 5000 });
      await expect(
        codeDialog.getByText("Loading cost codes..."),
      ).not.toBeVisible({ timeout: 10000 });

      const costCodeButton = codeDialog
        .getByRole("button")
        .filter({ hasText: /\d{4,6}.*–/ })
        .first();
      if (!(await costCodeButton.isVisible().catch(() => false))) {
        await codeDialog
          .getByRole("button")
          .filter({ hasText: /01.*general requirements/i })
          .first()
          .click();
      }
      await expect(costCodeButton).toBeVisible({ timeout: 5000 });
      await costCodeButton.click();

      await codeDialog.getByRole("combobox").click();
      await page.getByRole("option", { name: costType }).click();

      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname ===
            `/api/projects/${projectId}/budget-codes`,
      );
      await codeDialog
        .getByRole("button", { name: "Create Budget Code" })
        .click();
      const response = await responsePromise;
      expect(
        response.status(),
        `Budget code creation failed: ${await response.text()}`,
      ).toBe(200);
      await expect(codeDialog).not.toBeVisible({ timeout: 5000 });
    };

    await createBudgetCodeForRow(1, "L - Labor");

    await modal.getByRole("button", { name: "Add line item" }).click();
    await createBudgetCodeForRow(2, "M - Material");

    await expect(
      modal.getByRole("textbox", { name: "Unit cost" }).first(),
    ).toBeDisabled();
    await expect(modal.getByText("Total").locator("..")).toContainText("$0.00");

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/projects/${projectId}/budget`,
      { timeout: 15000 },
    );
    const createLineBtn = page.getByRole("button", {
      name: /create.*line item/i,
    });
    await expect(createLineBtn).toBeVisible({ timeout: 5000 });
    await expect(createLineBtn).toBeEnabled({ timeout: 5000 });
    await createLineBtn.click();
    const createResponse = await createResponsePromise;
    expect(
      createResponse.status(),
      `Budget line creation failed: ${await createResponse.text()}`,
    ).toBe(200);

    await expect(modal).not.toBeVisible({ timeout: 10000 });

    console.log("[FullWorkflow] Two zero-dollar budget lines created ✓");
  });

  // ─── Step 4: Lock Budget ─────────────────────────────────────────────────
  // "Lock Budget" button → AlertDialog → confirm "Lock Budget" action button.

  test("Step 4 – locks the budget", async ({ page }) => {
    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState("domcontentloaded");

    // Ensure unlocked state first
    const unlockFirst = page.getByRole("button", { name: /^locked /i });
    if ((await unlockFirst.count()) > 0) {
      await unlockFirst.click();
      const preserveBtn = page.getByRole("button", {
        name: /unlock and preserve/i,
      });
      if ((await preserveBtn.count()) > 0) await preserveBtn.click();
      await page.waitForTimeout(1000);
    }

    // Click "Lock Budget" trigger button
    const lockBtn = page.getByRole("button", {
      name: /click to lock budget/i,
    });
    await expect(lockBtn).toBeVisible({ timeout: 5000 });
    await lockBtn.click();

    // AlertDialog confirmation: click the action "Lock Budget" button
    const lockDialog = page.getByRole("alertdialog", {
      name: "Lock Budget",
    });
    await expect(lockDialog).toBeVisible();
    const confirmLockBtn = lockDialog.getByRole("button", {
      name: "Lock Budget",
    });
    await expect(confirmLockBtn).toBeVisible({ timeout: 5000 });
    const lockResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/projects/${projectId}/budget/lock`,
    );
    await confirmLockBtn.click();
    const lockResponse = await lockResponsePromise;
    const lockBody = await lockResponse.json().catch(() => null);
    expect(
      lockResponse.status(),
      `Budget lock failed: ${JSON.stringify(lockBody)}`,
    ).toBe(200);

    // Header status control should now expose the locked timestamp/owner.
    await expect(page.getByRole("button", { name: /^locked /i })).toBeVisible({
      timeout: 5000,
    });

    // Locked budgets replace the create menu with the only valid action.
    await expect(
      page.getByRole("button", { name: "Budget Change", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^create$/i })).toHaveCount(
      0,
    );

    // Reload and verify persists
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("button", { name: /^locked /i })).toBeVisible({
      timeout: 10000,
    });

    console.log("[FullWorkflow] Budget locked ✓");
  });

  // ─── Step 8 (inserted here): Budget Modification ─────────────────────────
  // The locked header replaces Create with the canonical Budget Change action.
  // Run immediately after lock (step 4), before unlock (step 5).

  test("Step 8 – creates a budget modification (while locked)", async ({
    page,
  }) => {
    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState("domcontentloaded");

    const budgetChangeButton = page.getByRole("button", {
      name: "Budget Change",
      exact: true,
    });
    await expect(budgetChangeButton).toBeVisible({ timeout: 5000 });
    await budgetChangeButton.click();

    const modal = page.getByRole("dialog", {
      name: "Add Budget Modification",
    });
    await expect(modal).toBeVisible({ timeout: 5000 });

    const fromSelect = modal.getByLabel("From");
    await fromSelect.click();
    await page.getByRole("option").first().click();

    const toSelect = modal.getByLabel("To");
    await toSelect.click();
    await page.getByRole("option").last().click();

    await modal.getByLabel("Amount").fill("25000");
    await modal
      .getByLabel("Notes")
      .fill("Balanced transfer for scope expansion");

    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/projects/${projectId}/budget/modifications`,
    );
    await modal.getByRole("button", { name: "Save" }).click();
    const response = await responsePromise;
    expect(
      response.status(),
      `Budget modification failed: ${await response.text()}`,
    ).toBe(200);
    await expect(modal).not.toBeVisible({ timeout: 10000 });
    console.log("[FullWorkflow] Budget modification created ✓");
  });

  // ─── Step 5: Unlock Budget ───────────────────────────────────────────────
  // "Unlock Budget" → UnlockBudgetDialog → "Unlock and Preserve"

  test("Step 5 – blocks unlock while an active modification exists", async ({
    page,
  }) => {
    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState("domcontentloaded");

    // Ensure it's locked (from step 4)
    const lockFirst = page.getByRole("button", {
      name: /click to lock budget/i,
    });
    if ((await lockFirst.count()) > 0) {
      await lockFirst.click();
      const confirmLockBtn = page
        .getByRole("button", { name: /^lock budget$/i })
        .last();
      if ((await confirmLockBtn.count()) > 0) await confirmLockBtn.click();
      await page.waitForTimeout(1000);
    }

    // Click "Unlock Budget"
    const unlockBtn = page.getByRole("button", { name: /^locked /i });
    await expect(unlockBtn).toBeVisible({ timeout: 5000 });
    await unlockBtn.click();

    const unlockDialog = page.getByRole("dialog", { name: "Unlock Budget" });
    await expect(unlockDialog).toBeVisible({ timeout: 10000 });
    await expect(
      unlockDialog.getByText("Budget cannot be unlocked."),
    ).toBeVisible({
      timeout: 5000,
    });
    await expect(
      unlockDialog.getByRole("button", { name: /unlock and preserve/i }),
    ).toHaveCount(0);
    await expect(unlockDialog.getByRole("listitem")).toContainText(
      "Modification BM-0001",
    );
    await unlockDialog.getByRole("button", { name: "Close" }).last().click();
    await expect(unlockDialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^locked /i })).toBeVisible();

    console.log("[FullWorkflow] Active modification blocks unlock ✓");
  });

  // ─── Step 6: Purchase Order ──────────────────────────────────────────────

  test("Step 6 – creates a purchase order commitment", async ({ page }) => {
    await page.goto(`/${projectId}/commitments/new?type=purchase_order`);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /new purchase order/i }),
    ).toBeVisible({ timeout: 10000 });

    const contractField = page
      .getByLabel(/contract #|contract number/i)
      .first();
    await contractField.clear();
    await contractField.fill(`PO-WF-${ts}`);

    const purchaseOrderTitle = `E2E Purchase Order ${ts}`;
    await page.getByLabel(/title/i).first().fill(purchaseOrderTitle);

    const companyCombobox = page.getByRole("combobox", {
      name: /contract company/i,
    });
    await expect(companyCombobox).toBeEnabled({ timeout: 10000 });
    await companyCombobox.click();
    const firstCompanyOption = page.getByRole("option").first();
    await expect(firstCompanyOption).toBeVisible({ timeout: 5000 });
    const selectedCompany = (await firstCompanyOption.textContent())?.trim();
    expect(selectedCompany).toBeTruthy();
    await firstCompanyOption.click();
    await expect(companyCombobox).toContainText(selectedCompany!);

    // Payment terms
    const paymentTerms = page.getByLabel(/payment terms/i);
    if ((await paymentTerms.count()) > 0) {
      await paymentTerms.fill("Net 30");
    }

    const purchaseOrderResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/projects/${projectId}/purchase-orders`,
    );
    await page.getByRole("button", { name: /create purchase order/i }).click();
    const purchaseOrderResponse = await purchaseOrderResponsePromise;
    expect(
      purchaseOrderResponse.status(),
      `Purchase order creation failed: ${await purchaseOrderResponse.text()}`,
    ).toBe(200);
    await expect(page).not.toHaveURL(/\/commitments\/new/, {
      timeout: 15000,
    });
    await expect(
      page
        .getByRole("link", { name: purchaseOrderTitle, exact: true })
        .filter({ visible: true }),
    ).toBeVisible({ timeout: 10000 });
    console.log(`[FullWorkflow] PO created → ${page.url()} ✓`);
  });

  // ─── Step 7: Subcontract ─────────────────────────────────────────────────

  test("Step 7 – creates a subcontract commitment", async ({ page }) => {
    await page.goto(`/${projectId}/commitments/new?type=subcontract`);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /new subcontract/i }),
    ).toBeVisible({ timeout: 10000 });

    const contractField = page
      .getByLabel(/contract #|contract number/i)
      .first();
    await contractField.clear();
    await contractField.fill(`SC-WF-${ts}`);

    const subcontractTitle = `E2E Subcontract ${ts}`;
    await page.getByLabel(/title/i).first().fill(subcontractTitle);

    const companyCombobox = page.getByRole("combobox", {
      name: /contract company/i,
    });
    await expect(companyCombobox).toBeEnabled({ timeout: 10000 });
    await companyCombobox.click();
    const firstCompanyOption = page.getByRole("option").first();
    await expect(firstCompanyOption).toBeVisible({ timeout: 5000 });
    const selectedCompany = (await firstCompanyOption.textContent())?.trim();
    expect(selectedCompany).toBeTruthy();
    await firstCompanyOption.click();
    await expect(companyCombobox).toContainText(selectedCompany!);

    // Scope of work
    const description = page.getByLabel(/description|scope/i).first();
    if ((await description.count()) > 0) {
      await description.fill("Concrete and foundation work per drawings");
    }

    const subcontractResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/projects/${projectId}/subcontracts`,
    );
    await page.getByRole("button", { name: /create subcontract/i }).click();
    const subcontractResponse = await subcontractResponsePromise;
    expect(
      subcontractResponse.status(),
      `Subcontract creation failed: ${await subcontractResponse.text()}`,
    ).toBe(200);
    await expect(page).not.toHaveURL(/\/commitments\/new/, {
      timeout: 15000,
    });
    await expect(
      page
        .getByRole("link", { name: subcontractTitle, exact: true })
        .filter({ visible: true }),
    ).toBeVisible({ timeout: 10000 });
    console.log(`[FullWorkflow] Subcontract created → ${page.url()} ✓`);
  });

  // ─── Step 9: Direct Cost ─────────────────────────────────────────────────
  // Direct costs are owned by Acumatica and intentionally read-only in Alleato.

  test("Step 9 – explains the direct-cost source of truth", async ({
    page,
  }) => {
    await page.goto(`/${projectId}/direct-costs/new`);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: "Direct Costs Are Read-Only" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/synced from Acumatica/i)).toBeVisible();
    await page.getByRole("link", { name: "Back to Direct Costs" }).click();
    await expect(page).toHaveURL(new RegExp(`/${projectId}/direct-costs$`));
  });

  // ─── Step 10: Invoice ────────────────────────────────────────────────────

  test("Step 10 – opens invoice creation with contract context", async ({
    page,
  }) => {
    expect(primeContractId).toMatch(/^[a-f0-9-]{36}$/);
    await page.goto(`/${projectId}/prime-contracts/${primeContractId}`);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /prime contract/i }).first(),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("menuitem", { name: "Create Invoice" }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/${projectId}/invoices/new\\?contractType=prime&contractId=${primeContractId}`,
      ),
      { timeout: 15000 },
    );
    await expect(
      page.getByRole("heading", { name: "New Invoice" }),
    ).toBeVisible({ timeout: 15000 });
  });

  // ─── Validation ──────────────────────────────────────────────────────────

  test("Validation – prime contract requires Contract # and Title", async ({
    page,
    safeNavigate,
  }) => {
    await safeNavigate(`/${projectId}/prime-contracts/new`);

    // Submit empty form
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByLabel("Contract #")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByLabel("Title")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    await expect(page).toHaveURL(new RegExp(`/prime-contracts/new$`));
    console.log("[FullWorkflow] Validation ✓");
  });
});
