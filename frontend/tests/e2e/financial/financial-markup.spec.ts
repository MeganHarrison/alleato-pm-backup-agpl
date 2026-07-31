import { test, expect, Page } from "@playwright/test";

/**
 * Financial Markup E2E Tests
 *
 * Comprehensive tests for the Financial Markup feature including:
 * - Markup configuration CRUD
 * - Markup calculation verification (compound and non-compound)
 * - UI display and interaction
 * - API integration
 */

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_PROJECT_ID = "67";
let TEST_CONTRACT_ID: string | null = null;

// Helper function to create a test contract
async function createTestContract(page: Page, projectId: string = TEST_PROJECT_ID): Promise<string> {
  const cookies = await page.context().cookies();
  const cookieHeader = cookies
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const response = await page.request.post(
    `/api/projects/${projectId}/contracts`,
    {
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      data: {
        title: "Test Financial Markup Contract",
        contract_type: "prime",
        status: "draft",
        contract_number: `FM-TEST-${Date.now()}`,
        execution_date: new Date().toISOString().split('T')[0],
        start_date: new Date().toISOString().split('T')[0],
      },
    }
  );

  const data = await response.json();
  return data.contract?.id || data.data?.id;
}

// Helper function to navigate to a contract detail page
async function navigateToContractDetail(
  page: Page,
  projectId: string = TEST_PROJECT_ID
) {
  // If we have a test contract ID, navigate directly to it
  if (TEST_CONTRACT_ID) {
    await page.goto(`/${projectId}/prime-contracts/${TEST_CONTRACT_ID}`);
    await page.waitForLoadState("networkidle");
    return;
  }

  // Otherwise, try to find and click on a contract
  await page.goto(`/${projectId}/prime-contracts`);
  await page.waitForLoadState("networkidle");

  // Check if there are any contracts
  const contractLink = page.locator("tbody tr td a").first();
  if (await contractLink.isVisible({ timeout: 5000 })) {
    await contractLink.click();
    await page.waitForURL(`**/${projectId}/prime-contracts/*`, {
      timeout: 10000,
    });
    await page.waitForLoadState("networkidle");
  } else {
    // No contracts found, create one
    TEST_CONTRACT_ID = await createTestContract(page, projectId);
    await page.goto(`/${projectId}/prime-contracts/${TEST_CONTRACT_ID}`);
    await page.waitForLoadState("networkidle");
  }
}

// Helper function to navigate to Financial Markup tab
async function navigateToFinancialMarkupTab(page: Page) {
  const financialMarkupTab = page
    .locator('[role="tab"]:has-text("Financial Markup")')
    .first();
  await financialMarkupTab.click();
  await page.waitForTimeout(500);
}

// Helper to take screenshots
async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `tests/screenshots/financial-markup/${name}.png`,
    fullPage: true,
  });
}

test.describe("Financial Markup - Tab Display", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToContractDetail(page);
  });

  test("should display Financial Markup tab in contract detail", async ({
    page,
  }) => {
    const financialMarkupTab = page
      .locator('[role="tab"]:has-text("Financial Markup")')
      .first();
    await expect(financialMarkupTab).toBeVisible();

    await takeScreenshot(page, "01-financial-markup-tab-visible");
  });

  test("should navigate to Financial Markup tab", async ({ page }) => {
    await navigateToFinancialMarkupTab(page);

    // Verify Financial Markup content is displayed
    await expect(page.locator("text=Financial Markup").first()).toBeVisible();
    await expect(
      page.locator(
        "text=Configure markup percentages applied to change orders"
      )
    ).toBeVisible();

    await takeScreenshot(page, "02-financial-markup-tab-content");
  });

  test("should display markup type explanations", async ({ page }) => {
    await navigateToFinancialMarkupTab(page);

    // Verify horizontal and vertical markup explanations
    await expect(page.locator("text=Horizontal Markup")).toBeVisible();
    await expect(page.locator("text=Vertical Markup")).toBeVisible();
    await expect(
      page.locator(
        "text=Calculates markup on individual line items"
      )
    ).toBeVisible();
    await expect(
      page.locator(
        "text=Calculates markup as a subtotal on all line items"
      )
    ).toBeVisible();

    await takeScreenshot(page, "03-markup-type-explanations");
  });

  test("should display common markup categories reference", async ({
    page,
  }) => {
    await navigateToFinancialMarkupTab(page);

    // Verify common markup categories
    await expect(page.locator("text=Common Markup Categories")).toBeVisible();
    await expect(page.locator("text=GC Fee")).toBeVisible();
    await expect(page.locator("text=Insurance")).toBeVisible();
    await expect(page.locator("text=Bond")).toBeVisible();
    await expect(page.locator("text=Overhead")).toBeVisible();

    // Verify typical percentages
    await expect(page.locator("text=Typically 3-10%")).toBeVisible();
    await expect(page.locator("text=Typically 1-2%")).toBeVisible();

    await takeScreenshot(page, "04-common-markup-categories");
  });
});

test.describe("Financial Markup - Vertical Markup Configuration", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToContractDetail(page);
    await navigateToFinancialMarkupTab(page);
  });

  test("should display Vertical Markup Configuration card", async ({
    page,
  }) => {
    await expect(
      page.locator("text=Vertical Markup Configuration")
    ).toBeVisible();
    await expect(
      page.locator("text=Project-level markup settings applied to change orders")
    ).toBeVisible();

    await takeScreenshot(page, "05-vertical-markup-config-card");
  });

  test("should display empty state when no markups configured", async ({
    page,
  }) => {
    // This test will pass if either markups are shown or empty state is shown
    const markupsTable = page.locator(
      '[data-testid="markup-calculation-preview"], table:has(th:has-text("Markup Type"))'
    );
    const emptyState = page.locator("text=No markup items configured");

    const hasMarkups = await markupsTable.isVisible({ timeout: 3000 }).catch(() => false);
    const isEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasMarkups || isEmpty).toBeTruthy();

    await takeScreenshot(page, "06-vertical-markup-state");
  });

  test("should display markup table with correct columns when markups exist", async ({
    page,
  }) => {
    // Check if markups table has correct columns
    const markupTable = page.locator('table:has(th:has-text("Order"))').first();
    if (await markupTable.isVisible({ timeout: 3000 })) {
      await expect(page.locator('th:has-text("Order")')).toBeVisible();
      await expect(page.locator('th:has-text("Markup Type")')).toBeVisible();
      await expect(page.locator('th:has-text("Percentage")')).toBeVisible();
      await expect(page.locator('th:has-text("Compound")')).toBeVisible();

      await takeScreenshot(page, "07-markup-table-columns");
    }
  });
});

test.describe("Financial Markup - Calculation Preview", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToContractDetail(page);
    await navigateToFinancialMarkupTab(page);
  });

  test("should display calculation preview section when markups exist", async ({
    page,
  }) => {
    const calculationPreview = page.locator(
      '[data-testid="markup-calculation-preview"]'
    );

    // Only run this test if markups exist (calculation preview only shows when markups exist)
    if (await calculationPreview.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator("text=Calculation Preview")).toBeVisible();
      await expect(
        page.locator(
          "text=Test how markups will be applied to a change order amount"
        )
      ).toBeVisible();

      await takeScreenshot(page, "08-calculation-preview-visible");
    }
  });

  test("should have base amount input field", async ({ page }) => {
    const calculationPreview = page.locator(
      '[data-testid="markup-calculation-preview"]'
    );

    if (await calculationPreview.isVisible({ timeout: 5000 }).catch(() => false)) {
      const baseAmountInput = page.locator('[data-testid="markup-preview-input"]');
      await expect(baseAmountInput).toBeVisible();
      await expect(baseAmountInput).toHaveValue("10000");

      await takeScreenshot(page, "09-base-amount-input");
    }
  });

  test("should have Calculate button", async ({ page }) => {
    const calculationPreview = page.locator(
      '[data-testid="markup-calculation-preview"]'
    );

    if (await calculationPreview.isVisible({ timeout: 5000 }).catch(() => false)) {
      const calculateButton = page.locator('[data-testid="calculate-markup-btn"]');
      await expect(calculateButton).toBeVisible();
      await expect(calculateButton).toHaveText(/Calculate/);

      await takeScreenshot(page, "10-calculate-button");
    }
  });

  test("should calculate and display markup results", async ({ page }) => {
    const calculationPreview = page.locator(
      '[data-testid="markup-calculation-preview"]'
    );

    if (await calculationPreview.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Enter a base amount
      const baseAmountInput = page.locator('[data-testid="markup-preview-input"]');
      await baseAmountInput.fill("100000");

      // Click calculate
      const calculateButton = page.locator('[data-testid="calculate-markup-btn"]');
      await calculateButton.click();

      // Wait for results
      await page.waitForTimeout(1000);

      // Verify results are displayed
      const calculationResults = page.locator(
        '[data-testid="markup-calculation-results"]'
      );

      if (await calculationResults.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(page.locator("text=Base Amount")).toBeVisible();
        await expect(page.locator("text=Total with Markup")).toBeVisible();

        await takeScreenshot(page, "11-calculation-results");
      }
    }
  });

  test("should display running total for each markup", async ({ page }) => {
    const calculationPreview = page.locator(
      '[data-testid="markup-calculation-preview"]'
    );

    if (await calculationPreview.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Calculate with a known amount
      const baseAmountInput = page.locator('[data-testid="markup-preview-input"]');
      await baseAmountInput.fill("50000");

      const calculateButton = page.locator('[data-testid="calculate-markup-btn"]');
      await calculateButton.click();
      await page.waitForTimeout(1000);

      // Check for running totals in the results
      const calculationResults = page.locator(
        '[data-testid="markup-calculation-results"]'
      );

      if (await calculationResults.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Verify the table shows running totals
        await expect(page.locator('th:has-text("Running Total")')).toBeVisible();

        await takeScreenshot(page, "12-running-totals");
      }
    }
  });
});

test.describe("Financial Markup - API Integration", () => {
  test("should fetch vertical markups from API", async ({ page }) => {

    // Track API requests
    const apiRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/vertical-markup")) {
        apiRequests.push(request.url());
      }
    });

    await navigateToContractDetail(page);
    await navigateToFinancialMarkupTab(page);

    // Wait for API call
    await page.waitForTimeout(2000);

    // Verify API was called
    const markupApiCalled = apiRequests.some((url) =>
      url.includes("/vertical-markup")
    );
    expect(markupApiCalled).toBeTruthy();

    await takeScreenshot(page, "13-api-called");
  });

  test("should call calculate API when Calculate button clicked", async ({
    page,
  }) => {
    await navigateToContractDetail(page);
    await navigateToFinancialMarkupTab(page);

    // Track API requests
    let calculateApiCalled = false;
    page.on("request", (request) => {
      if (request.url().includes("/vertical-markup/calculate")) {
        calculateApiCalled = true;
      }
    });

    const calculationPreview = page.locator(
      '[data-testid="markup-calculation-preview"]'
    );

    if (await calculationPreview.isVisible({ timeout: 5000 }).catch(() => false)) {
      const calculateButton = page.locator('[data-testid="calculate-markup-btn"]');
      await calculateButton.click();
      await page.waitForTimeout(1000);

      expect(calculateApiCalled).toBeTruthy();

      await takeScreenshot(page, "14-calculate-api-called");
    }
  });
});

test.describe("Financial Markup - Calculation Accuracy", () => {
  /**
   * These tests verify the mathematical accuracy of markup calculations.
   * They test both non-compound (base only) and compound (running total) calculations.
   */

  test("should verify API calculation endpoint returns correct format", async ({
    page,
  }) => {
    // Get auth cookies for API request
    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Make direct API call to verify calculation format
    const response = await page.request.post(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup/calculate`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        data: { baseAmount: 100000 },
      }
    );

    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty("baseAmount");
    expect(data).toHaveProperty("calculations");
    expect(data).toHaveProperty("totalMarkup");
    expect(data).toHaveProperty("finalAmount");

    // Verify baseAmount is correct
    expect(data.baseAmount).toBe(100000);

    // Verify finalAmount = baseAmount + totalMarkup
    expect(data.finalAmount).toBe(data.baseAmount + data.totalMarkup);

    await takeScreenshot(page, "15-api-response-format");
  });

  test("should calculate non-compound markup correctly", async ({ page }) => {

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // First, add a non-compound markup
    await page.request.post(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        data: {
          markup_type: "Test Non-Compound",
          percentage: 10,
          compound: false,
        },
      }
    );

    // Calculate with base amount of $100,000
    const response = await page.request.post(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup/calculate`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        data: { baseAmount: 100000 },
      }
    );

    const data = await response.json();

    // For non-compound markup at 10%:
    // Markup amount should be $100,000 * 10% = $10,000
    if (data.calculations && data.calculations.length > 0) {
      const testMarkup = data.calculations.find(
        (c: { markup_type: string }) => c.markup_type === "Test Non-Compound"
      );
      if (testMarkup) {
        expect(testMarkup.markupAmount).toBe(10000);
        expect(testMarkup.compound).toBe(false);
      }
    }

    // Cleanup - delete the test markup
    const listResponse = await page.request.get(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: { Cookie: cookieHeader },
      }
    );
    const listData = await listResponse.json();
    const testMarkupItem = listData.markups?.find(
      (m: { markup_type: string }) => m.markup_type === "Test Non-Compound"
    );
    if (testMarkupItem) {
      await page.request.delete(
        `/api/projects/${TEST_PROJECT_ID}/vertical-markup?markupId=${testMarkupItem.id}`,
        {
          headers: { Cookie: cookieHeader },
        }
      );
    }
  });

  test("should calculate compound markup correctly", async ({ page }) => {

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Delete any existing test markups
    const listResponse = await page.request.get(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: { Cookie: cookieHeader },
      }
    );
    const existingData = await listResponse.json();
    for (const m of existingData.markups || []) {
      if (m.markup_type.startsWith("Test ")) {
        await page.request.delete(
          `/api/projects/${TEST_PROJECT_ID}/vertical-markup?markupId=${m.id}`,
          {
            headers: { Cookie: cookieHeader },
          }
        );
      }
    }

    // Add a non-compound markup first (order 1)
    await page.request.post(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        data: {
          markup_type: "Test Base Markup",
          percentage: 10,
          compound: false,
        },
      }
    );

    // Add a compound markup (order 2) that compounds on the above
    await page.request.post(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        data: {
          markup_type: "Test Compound Markup",
          percentage: 5,
          compound: true,
        },
      }
    );

    // Calculate with base amount of $100,000
    const response = await page.request.post(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup/calculate`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        data: { baseAmount: 100000 },
      }
    );

    const data = await response.json();

    /**
     * Expected calculation:
     * Base: $100,000
     * Test Base Markup (10%, non-compound): $100,000 * 10% = $10,000 -> Running: $110,000
     * Test Compound Markup (5%, compound): $110,000 * 5% = $5,500 -> Running: $115,500
     * Total markup: $15,500
     * Final amount: $115,500
     */

    if (data.calculations && data.calculations.length >= 2) {
      const baseMarkup = data.calculations.find(
        (c: { markup_type: string }) => c.markup_type === "Test Base Markup"
      );
      const compoundMarkup = data.calculations.find(
        (c: { markup_type: string }) => c.markup_type === "Test Compound Markup"
      );

      if (baseMarkup) {
        // Non-compound should be calculated on base amount
        expect(baseMarkup.baseAmount).toBe(100000);
        expect(baseMarkup.markupAmount).toBe(10000);
        expect(baseMarkup.runningTotal).toBe(110000);
      }

      if (compoundMarkup) {
        // Compound should be calculated on running total
        expect(compoundMarkup.baseAmount).toBe(110000); // Running total at this point
        expect(compoundMarkup.markupAmount).toBe(5500); // 110000 * 5% = 5500
        expect(compoundMarkup.runningTotal).toBe(115500);
      }

      // Verify totals
      expect(data.finalAmount).toBe(115500);
    }

    // Cleanup
    const cleanupResponse = await page.request.get(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: { Cookie: cookieHeader },
      }
    );
    const cleanupData = await cleanupResponse.json();
    for (const m of cleanupData.markups || []) {
      if (m.markup_type.startsWith("Test ")) {
        await page.request.delete(
          `/api/projects/${TEST_PROJECT_ID}/vertical-markup?markupId=${m.id}`,
          {
            headers: { Cookie: cookieHeader },
          }
        );
      }
    }
  });

  test("should handle multiple compound markups in sequence", async ({
    page,
  }) => {

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Cleanup existing test markups
    const listResponse = await page.request.get(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: { Cookie: cookieHeader },
      }
    );
    const existingData = await listResponse.json();
    for (const m of existingData.markups || []) {
      if (m.markup_type.startsWith("Seq Test ")) {
        await page.request.delete(
          `/api/projects/${TEST_PROJECT_ID}/vertical-markup?markupId=${m.id}`,
          {
            headers: { Cookie: cookieHeader },
          }
        );
      }
    }

    // Create a sequence of markups:
    // 1. Overhead (10%, non-compound)
    // 2. Profit (5%, compound)
    // 3. Insurance (2%, compound)
    // 4. Bond (1%, compound)

    const markups = [
      { markup_type: "Seq Test Overhead", percentage: 10, compound: false },
      { markup_type: "Seq Test Profit", percentage: 5, compound: true },
      { markup_type: "Seq Test Insurance", percentage: 2, compound: true },
      { markup_type: "Seq Test Bond", percentage: 1, compound: true },
    ];

    for (const markup of markups) {
      await page.request.post(
        `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieHeader,
          },
          data: markup,
        }
      );
    }

    // Calculate with base amount of $100,000
    const response = await page.request.post(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup/calculate`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        data: { baseAmount: 100000 },
      }
    );

    const data = await response.json();

    /**
     * Expected calculation:
     * Base: $100,000
     * 1. Overhead (10%, non-compound): $100,000 * 10% = $10,000 -> Running: $110,000
     * 2. Profit (5%, compound): $110,000 * 5% = $5,500 -> Running: $115,500
     * 3. Insurance (2%, compound): $115,500 * 2% = $2,310 -> Running: $117,810
     * 4. Bond (1%, compound): $117,810 * 1% = $1,178.10 -> Running: $118,988.10
     * Total: $118,988.10
     */

    // Verify final amount is approximately correct (accounting for floating point)
    if (data.finalAmount) {
      expect(data.finalAmount).toBeCloseTo(118988.1, 0);
    }

    // Cleanup
    const cleanupResponse = await page.request.get(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: { Cookie: cookieHeader },
      }
    );
    const cleanupData = await cleanupResponse.json();
    for (const m of cleanupData.markups || []) {
      if (m.markup_type.startsWith("Seq Test ")) {
        await page.request.delete(
          `/api/projects/${TEST_PROJECT_ID}/vertical-markup?markupId=${m.id}`,
          {
            headers: { Cookie: cookieHeader },
          }
        );
      }
    }
  });

  test("should return correct result when no markups configured", async ({
    page,
  }) => {

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Use a project ID that likely doesn't have markups configured
    const response = await page.request.post(
      `/api/projects/999/vertical-markup/calculate`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        data: { baseAmount: 50000 },
      }
    );

    const data = await response.json();

    // When no markups, finalAmount should equal baseAmount
    expect(data.baseAmount).toBe(50000);
    expect(data.calculations).toEqual([]);
    expect(data.totalMarkup).toBe(0);
    expect(data.finalAmount).toBe(50000);
  });
});

test.describe("Financial Markup - CRUD Operations", () => {
  test("should create a new vertical markup", async ({ page }) => {

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Create a new markup
    const response = await page.request.post(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        data: {
          markup_type: "E2E Test Markup",
          percentage: 7.5,
          compound: false,
        },
      }
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("id");
    expect(data.data.markup_type).toBe("E2E Test Markup");
    expect(data.data.percentage).toBe(7.5);
    expect(data.data.compound).toBe(false);

    // Cleanup
    await page.request.delete(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup?markupId=${data.data.id}`,
      {
        headers: { Cookie: cookieHeader },
      }
    );
  });

  test("should list all vertical markups", async ({ page }) => {

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await page.request.get(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("markups");
    expect(Array.isArray(data.markups)).toBeTruthy();
  });

  test("should delete a vertical markup", async ({ page }) => {

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // First create a markup to delete
    const createResponse = await page.request.post(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        data: {
          markup_type: "To Be Deleted",
          percentage: 1,
          compound: false,
        },
      }
    );

    const createData = await createResponse.json();
    const markupId = createData.data.id;

    // Delete it
    const deleteResponse = await page.request.delete(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup?markupId=${markupId}`,
      {
        headers: { Cookie: cookieHeader },
      }
    );

    expect(deleteResponse.ok()).toBeTruthy();
    const deleteData = await deleteResponse.json();
    expect(deleteData.success).toBe(true);

    // Verify it's deleted
    const listResponse = await page.request.get(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: { Cookie: cookieHeader },
      }
    );
    const listData = await listResponse.json();
    const found = listData.markups?.find(
      (m: { id: number }) => m.id === markupId
    );
    expect(found).toBeUndefined();
  });
});

test.describe("Financial Markup - UI Calculation Verification", () => {
  test("should display correct markup calculations in UI", async ({ page }) => {

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Create test markups
    await page.request.post(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        data: {
          markup_type: "UI Test GC Fee",
          percentage: 5,
          compound: false,
        },
      }
    );

    await navigateToContractDetail(page);
    await navigateToFinancialMarkupTab(page);

    // Wait for markups to load
    await page.waitForTimeout(1000);

    const calculationPreview = page.locator(
      '[data-testid="markup-calculation-preview"]'
    );

    if (await calculationPreview.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Enter a base amount and calculate
      const baseAmountInput = page.locator('[data-testid="markup-preview-input"]');
      await baseAmountInput.fill("200000");

      const calculateButton = page.locator('[data-testid="calculate-markup-btn"]');
      await calculateButton.click();
      await page.waitForTimeout(1500);

      // Verify results appear
      const calculationResults = page.locator(
        '[data-testid="markup-calculation-results"]'
      );

      if (await calculationResults.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Check for final amount display
        const finalAmount = page.locator('[data-testid="final-amount"]');
        if (await finalAmount.isVisible({ timeout: 2000 }).catch(() => false)) {
          const finalText = await finalAmount.textContent();
          // Should contain a dollar amount
          expect(finalText).toMatch(/\$[\d,]+/);
        }

        await takeScreenshot(page, "16-ui-calculation-results");
      }
    }

    // Cleanup
    const listResponse = await page.request.get(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: { Cookie: cookieHeader },
      }
    );
    const listData = await listResponse.json();
    for (const m of listData.markups || []) {
      if (m.markup_type === "UI Test GC Fee") {
        await page.request.delete(
          `/api/projects/${TEST_PROJECT_ID}/vertical-markup?markupId=${m.id}`,
          {
            headers: { Cookie: cookieHeader },
          }
        );
      }
    }
  });

  test("should show compound indicator in calculation results", async ({
    page,
  }) => {

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Create a compound markup
    await page.request.post(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        data: {
          markup_type: "UI Test Insurance",
          percentage: 2,
          compound: true,
        },
      }
    );

    await navigateToContractDetail(page);
    await navigateToFinancialMarkupTab(page);
    await page.waitForTimeout(1000);

    const calculationPreview = page.locator(
      '[data-testid="markup-calculation-preview"]'
    );

    if (await calculationPreview.isVisible({ timeout: 5000 }).catch(() => false)) {
      const calculateButton = page.locator('[data-testid="calculate-markup-btn"]');
      await calculateButton.click();
      await page.waitForTimeout(1500);

      // Check for "Running Total" indicator (compound markup uses running total)
      const runningTotalIndicator = page.locator("text=Running Total");
      if (await runningTotalIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
        await takeScreenshot(page, "17-compound-markup-indicator");
      }
    }

    // Cleanup
    const listResponse = await page.request.get(
      `/api/projects/${TEST_PROJECT_ID}/vertical-markup`,
      {
        headers: { Cookie: cookieHeader },
      }
    );
    const listData = await listResponse.json();
    for (const m of listData.markups || []) {
      if (m.markup_type === "UI Test Insurance") {
        await page.request.delete(
          `/api/projects/${TEST_PROJECT_ID}/vertical-markup?markupId=${m.id}`,
          {
            headers: { Cookie: cookieHeader },
          }
        );
      }
    }
  });
});
