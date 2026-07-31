/**
 * Direct Costs Form Investigation
 * Specifically tests Create form loading - the known hang concern
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const DC_URL = "http://localhost:3000/67/direct-costs";
const SCREENSHOT_DIR = path.join(__dirname, "../../", "test-results", "dc-investigation");

test.describe("DC Form Investigation", () => {
  test.use({ storageState: "tests/.auth/user.json" });

  test("Investigate: Click New Direct Cost, capture form state and network", async ({ page }) => {
    const networkRequests: { url: string; status: number; failed: boolean }[] = [];
    const consoleErrors: string[] = [];

    // Capture all network activity
    page.on("request", (req) => {
      if (req.url().includes("/api/")) {
        networkRequests.push({ url: req.url(), status: 0, failed: false });
      }
    });
    page.on("response", (res) => {
      const entry = networkRequests.find((r) => r.url === res.url() && r.status === 0);
      if (entry) entry.status = res.status();
    });
    page.on("requestfailed", (req) => {
      const entry = networkRequests.find((r) => r.url === req.url());
      if (entry) entry.failed = true;
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // Navigate to Direct Costs list
    await page.goto(DC_URL, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-list-loaded.png") });

    // Capture list page state
    const listTitle = await page.locator("h1").textContent();
    const rowCount = await page.locator("table tbody tr").count();
    console.log(`List page loaded: "${listTitle}", rows: ${rowCount}`);

    // Click New Direct Cost
    await page.getByRole("button", { name: "New Direct Cost" }).click();
    console.log("Clicked New Direct Cost button");

    // Wait up to 10 seconds to see if form opens
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-after-click-3s.png") });

    // Check what opened
    const url3s = page.url();
    const dialogOpen = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    const sheetOpen = await page.locator('[data-state="open"]').first().isVisible().catch(() => false);
    const drawerOpen = await page.locator('[role="complementary"], [data-drawer]').isVisible().catch(() => false);
    console.log(`After 3s: URL=${url3s}, dialog=${dialogOpen}, sheet=${sheetOpen}, drawer=${drawerOpen}`);

    // Wait more for any pending API calls
    await page.waitForTimeout(7000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-after-click-10s.png") });

    // Capture detailed page structure
    const snapshot = await page.accessibility.snapshot();

    // Check specific vendor/employee/budget-code API calls
    const vendorReq = networkRequests.find((r) => r.url.includes("/vendors"));
    const employeeReq = networkRequests.find((r) => r.url.includes("/employees"));
    const budgetCodeReq = networkRequests.find((r) => r.url.includes("/budget-codes"));

    console.log("Network summary:");
    console.log("  Vendor API:", vendorReq ? `${vendorReq.url} -> ${vendorReq.status} (failed:${vendorReq.failed})` : "NOT CALLED");
    console.log("  Employee API:", employeeReq ? `${employeeReq.url} -> ${employeeReq.status} (failed:${employeeReq.failed})` : "NOT CALLED");
    console.log("  BudgetCode API:", budgetCodeReq ? `${budgetCodeReq.url} -> ${budgetCodeReq.status} (failed:${budgetCodeReq.failed})` : "NOT CALLED");
    console.log("  All API calls:", JSON.stringify(networkRequests.slice(-20), null, 2));
    console.log("  Console errors:", consoleErrors);

    // Now try to fill the form if visible
    const allInputs = page.locator("input:visible, select:visible, textarea:visible");
    const inputCount = await allInputs.count();
    console.log(`Visible inputs: ${inputCount}`);

    if (inputCount > 0) {
      const inputInfo = await allInputs.evaluateAll((els) =>
        els.map((el) => ({
          tag: el.tagName,
          type: (el as HTMLInputElement).type,
          name: (el as HTMLInputElement).name,
          id: el.id,
          placeholder: (el as HTMLInputElement).placeholder,
        }))
      );
      console.log("Form inputs:", JSON.stringify(inputInfo, null, 2));
    }

    // Verify: record what we found
    const finalUrl = page.url();
    const finalDialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);

    // Save a report
    const report = {
      listLoaded: { title: listTitle, rows: rowCount },
      afterButtonClick: {
        url: finalUrl,
        dialogVisible: finalDialogVisible,
        formInputsFound: inputCount,
        networkCalls: networkRequests,
        consoleErrors,
        vendorApiCalled: !!vendorReq,
        vendorApiStatus: vendorReq?.status,
        employeeApiCalled: !!employeeReq,
        employeeApiStatus: employeeReq?.status,
        budgetCodeApiCalled: !!budgetCodeReq,
        budgetCodeApiStatus: budgetCodeReq?.status,
      },
    };

    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, "form-investigation-report.json"),
      JSON.stringify(report, null, 2)
    );

    // Assertions to capture in test output
    expect(listTitle).toContain("Direct Costs");
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // The form should open - if it doesn't this confirms the hang
    console.log(`\n=== FORM INVESTIGATION RESULT ===`);
    console.log(`Form opened: ${finalDialogVisible || inputCount > 0}`);
    console.log(`Input count in form: ${inputCount}`);
    console.log(`Vendor API status: ${vendorReq?.status ?? "NOT CALLED"}`);
    console.log(`Employee API status: ${employeeReq?.status ?? "NOT CALLED"}`);
    console.log(`Budget Code API status: ${budgetCodeReq?.status ?? "NOT CALLED"}`);
  });
});
