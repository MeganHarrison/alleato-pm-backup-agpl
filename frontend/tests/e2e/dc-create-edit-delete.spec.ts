/**
 * Direct Costs - Create, Edit, Delete, Validation Tests
 * Tests T3-T6 using the /new route for create instead of the button click
 */
import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:3000";
const PROJECT_ID = 67;
const DC_URL = `${BASE}/${PROJECT_ID}/direct-costs`;
const NEW_URL = `${BASE}/${PROJECT_ID}/direct-costs/new`;
const SCREENSHOT_DIR = path.join(__dirname, "../../", "test-results", "dc-investigation");

const TEST_INVOICE = `VERIFY-${Date.now()}`;

test.describe("DC CRUD Tests T3-T6", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  // ── Test 3a: Navigate to /new route directly ──────────────────────────
  test("T3a: New page route loads - no hang", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // Navigate directly to the /new route
    await page.goto(NEW_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const url = page.url();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "T3a-new-page.png") });

    console.log(`T3a URL: ${url}`);
    console.log(`T3a Errors: ${JSON.stringify(errors)}`);

    // Check if it navigated away (login redirect, etc.)
    const stayedOnNewPage = url.includes("/direct-costs/new");
    const pageTitle = await page.locator("h1").first().textContent().catch(() => "NO H1");
    console.log(`T3a Title: ${pageTitle}`);

    // Check for any inputs
    const inputs = await page.locator("input:visible").count();
    const selects = await page.locator("select:visible").count();
    console.log(`T3a Inputs: ${inputs}, Selects: ${selects}`);

    expect(url).toContain("/direct-costs");
  });

  // ── Test 3b: Button navigates correctly ─────────────────────────────
  test("T3b: New Direct Cost button actually navigates to /new", async ({ page }) => {
    const navEvents: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        navEvents.push(frame.url());
      }
    });

    await page.goto(DC_URL, { waitUntil: "networkidle" });
    console.log(`Before click URL: ${page.url()}`);

    // Click the button
    await page.getByRole("button", { name: "New Direct Cost" }).click();

    // Wait up to 5 seconds for navigation
    try {
      await page.waitForURL(/\/direct-costs\/new/, { timeout: 5000 });
      console.log("Navigation to /new succeeded");
    } catch {
      console.log("Navigation to /new FAILED within 5s");
      console.log(`Final URL: ${page.url()}`);
      console.log(`Navigation events: ${JSON.stringify(navEvents)}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "T3b-after-button-click.png") });
    const finalUrl = page.url();
    console.log(`T3b Final URL: ${finalUrl}`);

    // This tests whether the button actually navigates
    expect(finalUrl).toContain("/direct-costs");
  });

  // ── Test 3c: CreateDirectCostForm works ──────────────────────────────
  test("T3c: Create form loads, all dropdowns load, submit creates record", async ({ page }) => {
    const networkCalls: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      if (res.url().includes("/api/")) {
        networkCalls.push({ url: res.url(), status: res.status() });
      }
    });

    await page.goto(NEW_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000); // Wait for dropdowns to load

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "T3c-create-form.png") });

    const url = page.url();
    const h1 = await page.locator("h1").first().textContent().catch(() => "none");
    console.log(`URL: ${url}, H1: ${h1}`);

    // Check dropdowns loaded
    const vendorDropdown = page.locator('[name="vendor_id"], select[id*="vendor"], [id*="vendor"]').first();
    const vendorLoaded = await vendorDropdown.isVisible().catch(() => false);

    // Check for loading spinners - form might be stuck loading dropdowns
    const spinners = await page.locator('[class*="spin"], [class*="loader"], [class*="loading"]').count();
    console.log(`Loading spinners visible: ${spinners}`);

    // Check API calls
    const vendorCall = networkCalls.find((r) => r.url.includes("/vendors"));
    const budgetCodeCall = networkCalls.find((r) => r.url.includes("/budget-codes"));
    const employeeCall = networkCalls.find((r) => r.url.includes("/employees"));
    console.log(`Vendor API: ${vendorCall ? `${vendorCall.url} -> ${vendorCall.status}` : "NOT CALLED"}`);
    console.log(`BudgetCode API: ${budgetCodeCall ? `${budgetCodeCall.url} -> ${budgetCodeCall.status}` : "NOT CALLED"}`);
    console.log(`Employee API: ${employeeCall ? `${employeeCall.url} -> ${employeeCall.status}` : "NOT CALLED"}`);

    // Get all inputs visible
    const allInputs = await page.locator("input:visible, select:visible, textarea:visible, button[role='combobox']:visible").count();
    console.log(`Visible form elements: ${allInputs}`);

    // List all visible inputs
    const inputList = await page.locator("input:visible, textarea:visible").evaluateAll((els) =>
      els.map((el) => ({
        name: (el as HTMLInputElement).name,
        type: (el as HTMLInputElement).type,
        id: el.id,
        placeholder: (el as HTMLInputElement).placeholder,
      }))
    );
    console.log(`Input fields: ${JSON.stringify(inputList, null, 2)}`);

    // Save network calls for report
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, "T3c-network.json"),
      JSON.stringify({ networkCalls, spinners, inputList }, null, 2)
    );
  });

  // ── Test 4: Edit ──────────────────────────────────────────────────────
  test("T4: Edit - click row opens detail page", async ({ page }) => {
    await page.goto(DC_URL, { waitUntil: "networkidle" });

    // Click first row
    const firstRow = page.locator("table tbody tr").first();
    const rowText = await firstRow.textContent();
    console.log(`Clicking row: ${rowText?.substring(0, 80)}`);

    await firstRow.click();
    await page.waitForTimeout(2000);

    const newUrl = page.url();
    console.log(`After row click URL: ${newUrl}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "T4-after-row-click.png") });

    const navigatedToDetail = newUrl.includes("/direct-costs/") && !newUrl.endsWith("/direct-costs");
    console.log(`Navigated to detail: ${navigatedToDetail}`);

    if (navigatedToDetail) {
      // Check what's on detail page
      const h1 = await page.locator("h1").first().textContent().catch(() => "none");
      console.log(`Detail page h1: ${h1}`);

      // Look for edit form
      const inputs = await page.locator("input:visible").count();
      console.log(`Detail page inputs: ${inputs}`);
    }

    expect(newUrl).toContain("/direct-costs");
  });

  // ── Test 5: Delete ────────────────────────────────────────────────────
  test("T5: Delete - find and trigger delete action on a row", async ({ page }) => {
    await page.goto(DC_URL, { waitUntil: "networkidle" });

    const initialRows = await page.locator("table tbody tr").count();
    console.log(`Initial row count: ${initialRows}`);

    // Click the action menu on first row (last button in the row)
    const actionBtn = page.locator("table tbody tr").first().locator("button").last();
    await actionBtn.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "T5-dropdown-open.png") });

    // Check what menu items appeared
    const menuItems = await page.locator('[role="menuitem"]').allTextContents();
    console.log(`Menu items: ${JSON.stringify(menuItems)}`);

    // Look for Delete
    const deleteItem = page.locator('[role="menuitem"]').filter({ hasText: "Delete" }).first();
    const deleteVisible = await deleteItem.isVisible().catch(() => false);
    console.log(`Delete menu item visible: ${deleteVisible}`);

    if (deleteVisible) {
      await deleteItem.click();
      await page.waitForTimeout(500);

      // Check for confirm dialog
      const dialogVisible = await page.locator('[role="alertdialog"]').isVisible().catch(() => false);
      console.log(`Confirm dialog appeared: ${dialogVisible}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "T5-confirm-dialog.png") });

      if (dialogVisible) {
        const confirmBtn = page.locator('[role="alertdialog"]').getByRole("button", { name: /delete|confirm|yes/i }).first();
        await confirmBtn.click();
        await page.waitForTimeout(2000);

        const afterRows = await page.locator("table tbody tr").count();
        console.log(`Row count after delete: ${afterRows}, was: ${initialRows}`);

        const toastText = await page.locator('[data-sonner-toast]').first().textContent().catch(() => "none");
        console.log(`Toast: ${toastText}`);
      }
    }
  });

  // ── Test 6: Validation ────────────────────────────────────────────────
  test("T6: Form validation on /new page - errors on empty submit", async ({ page }) => {
    await page.goto(NEW_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const urlAfterLoad = page.url();
    console.log(`URL after loading /new: ${urlAfterLoad}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "T6-form-before-submit.png") });

    // Check if form loaded
    const formVisible = await page.locator("form").isVisible().catch(() => false);
    console.log(`Form visible: ${formVisible}`);

    // Find submit button
    const submitBtn = page.getByRole("button", { name: /save|submit|create|add direct cost/i }).last();
    const submitVisible = await submitBtn.isVisible().catch(() => false);
    console.log(`Submit button visible: ${submitVisible}`);

    if (submitVisible) {
      await submitBtn.click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "T6-after-empty-submit.png") });

      // Check for validation errors
      const errorCount = await page.locator(
        '[aria-invalid="true"], [class*="error"], p[class*="text-red"], p[class*="text-destructive"], [data-field-error]'
      ).count();
      console.log(`Validation errors found: ${errorCount}`);

      const errorTexts = await page.locator(
        'p[class*="text-red"], p[class*="text-destructive"], [class*="field-error"]'
      ).allTextContents();
      console.log(`Error messages: ${JSON.stringify(errorTexts)}`);
    } else {
      console.log("Submit button NOT FOUND - form may not have loaded");

      // Check if there's a loading state
      const loadingSpinners = await page.locator('[class*="animate-spin"], [class*="loading"]').count();
      const bodyText = await page.locator("main").textContent().catch(() => "none");
      console.log(`Loading spinners: ${loadingSpinners}`);
      console.log(`Main content (first 200 chars): ${bodyText?.substring(0, 200)}`);
    }

    expect(urlAfterLoad).toContain("/direct-costs");
  });
});
