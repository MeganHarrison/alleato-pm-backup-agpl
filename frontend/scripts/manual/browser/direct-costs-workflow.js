#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * ==============================================================================
 * DIRECT COSTS WORKFLOW E2E TEST
 * ==============================================================================
 *
 * PURPOSE:
 * This script performs a full end-to-end test of the Direct Costs feature,
 * simulating a real user creating a new direct cost record. It validates that:
 *   1. The direct costs list page loads correctly
 *   2. The "Add Direct Cost" button navigates to the create form
 *   3. The create form can be filled with valid data
 *   4. Form submission creates a record and redirects to detail view
 *   5. The created record appears in the list after navigation back
 *
 * USAGE:
 *   node direct-costs-workflow.js
 *
 * REQUIRED ENVIRONMENT VARIABLES:
 *   BASE_URL       - Application base URL (e.g., http://localhost:3000)
 *   PROJECT_ID     - Numeric project ID to test against
 *   LOGIN_EMAIL    - User email for authentication
 *   LOGIN_PASSWORD - User password for authentication
 *
 * OPTIONAL ENVIRONMENT VARIABLES:
 *   HEADLESS       - Run in headless mode (default: false, set "true" for CI)
 *   STORAGE_STATE  - Path to Playwright auth state JSON (default: tests/.auth/user.json)
 *   OUTPUT_DIR     - Directory for screenshots and reports
 *   RUN_LABEL      - Label to append to run directory name
 *
 * OUTPUT:
 *   - Screenshots at each workflow step (saved to OUTPUT_DIR/runs/<timestamp>/)
 *   - JSON report with pass/fail status and metadata
 *   - last-run.json symlink to most recent report
 *
 * EXIT CODES:
 *   0 - Workflow completed successfully
 *   1 - Workflow failed (see report.json for details)
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { chromium } = require('playwright');

// ==============================================================================
// CONFIGURATION & ENVIRONMENT SETUP
// ==============================================================================

/**
 * Resolve the frontend root directory (three levels up from this script).
 * Used as the base path for .env files and default output directories.
 */
const FRONTEND_ROOT = path.resolve(__dirname, '../../..');

/**
 * Load environment variables from .env and .env.local files.
 * .env.local takes precedence (loaded second, overwrites .env values).
 */
dotenv.config({ path: path.join(FRONTEND_ROOT, '.env') });
dotenv.config({ path: path.join(FRONTEND_ROOT, '.env.local') });

/**
 * Validates that a required environment variable exists and is non-empty.
 * @param {string} name - Environment variable name
 * @returns {string} Trimmed value
 * @throws {Error} If variable is missing or empty
 */
function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

// Required configuration from environment
const BASE_URL = requireEnv('BASE_URL').replace(/\/$/, ''); // Strip trailing slash
const PROJECT_ID = requireEnv('PROJECT_ID');
const LOGIN_EMAIL = requireEnv('LOGIN_EMAIL');
const LOGIN_PASSWORD = requireEnv('LOGIN_PASSWORD');

// Optional configuration with defaults
const HEADLESS = process.env.HEADLESS === 'true';
const STORAGE_STATE = process.env.STORAGE_STATE || path.resolve(FRONTEND_ROOT, 'tests/.auth/user.json');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.resolve(FRONTEND_ROOT, '../output/playwright/direct-costs-workflow');

// Run identification for organizing artifacts
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-'); // ISO timestamp, filesystem-safe
const RUN_LABEL = process.env.RUN_LABEL || '';

// Test data - unique per run to avoid collisions
const INVOICE_NUMBER = `AUTO-DC-${Date.now()}`; // Unique invoice number based on timestamp
const DESCRIPTION = `Playwright workflow ${RUN_ID}`;

// Output directory structure
const RUNS_DIR = path.join(OUTPUT_DIR, 'runs');
const RUN_DIR = path.join(RUNS_DIR, RUN_LABEL ? `${RUN_ID}-${RUN_LABEL}` : RUN_ID);
const LAST_RUN_REPORT = path.join(OUTPUT_DIR, 'last-run.json');

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

/**
 * Creates a directory and all parent directories if they don't exist.
 * @param {string} dirPath - Directory path to create
 */
function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Constructs an absolute URL by joining BASE_URL with a path.
 * @param {string} urlPath - Relative URL path (e.g., "/67/direct-costs")
 * @returns {string} Full URL (e.g., "http://localhost:3000/67/direct-costs")
 */
function absoluteUrl(urlPath) {
  return `${BASE_URL}${urlPath}`;
}

/**
 * Captures a full-page screenshot and saves it to the run directory.
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} name - Screenshot filename (without extension)
 */
async function screenshot(page, name) {
  const target = path.join(RUN_DIR, `${name}.png`);
  await page.screenshot({ path: target, fullPage: true });
  console.log(`📸 ${target}`);
}

/**
 * Writes the test run report to both the run directory and the last-run symlink.
 * @param {object} report - Report data object
 */
function writeReport(report) {
  ensureDir(RUN_DIR);
  const reportPath = path.join(RUN_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(LAST_RUN_REPORT, JSON.stringify(report, null, 2));
  console.log(`🧾 Report: ${reportPath}`);
}

// ==============================================================================
// PAGE WAIT & NAVIGATION HELPERS
// ==============================================================================

/**
 * Waits for the Direct Costs list page to be fully loaded.
 * Validates that:
 *   1. DOM content is loaded
 *   2. Page heading with "direct costs" text is visible
 *   3. The "Add Direct Cost" button/link is present
 *
 * @param {import('playwright').Page} page - Playwright page object
 * @throws {Error} If page doesn't load within timeout
 */
async function waitForDirectCostsList(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('heading', { name: /direct costs/i }).first().waitFor({ timeout: 20000 });
  await page.locator('[data-testid="direct-costs-create-button"], a:has-text("Add Direct Cost"), button:has-text("Add Direct Cost")').first().waitFor({ timeout: 10000 });
}

// ==============================================================================
// AUTHENTICATION FUNCTIONS
// ==============================================================================

/**
 * Performs authentication via the /auth/login page.
 * This is used when stored auth state is expired or missing.
 *
 * Flow:
 *   1. Navigate to login page with callback URL
 *   2. Fill email and password fields
 *   3. Submit login form
 *   4. Wait for redirect away from login page
 *
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} callbackPath - Path to redirect to after login (e.g., "/67/direct-costs")
 * @throws {Error} If login fails (invalid credentials or timeout)
 */
async function performRealLogin(page, callbackPath) {
  if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
    throw new Error('LOGIN_EMAIL and LOGIN_PASSWORD are required for real login flow');
  }

  const loginUrl = absoluteUrl(`/auth/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  // Fill login form
  await page.locator('#email').fill(LOGIN_EMAIL);
  await page.locator('#password').fill(LOGIN_PASSWORD);
  await page.getByRole('button', { name: /^login$/i }).click();

  // Wait briefly and check if still on login page (indicates failure)
  await page.waitForTimeout(1000);
  const stillOnLogin = page.url().includes('/auth/login');
  if (stillOnLogin) {
    const bodyText = await page.locator('body').innerText();
    if (/invalid email or password/i.test(bodyText)) {
      throw new Error('Authentication failed: invalid email or password');
    }
    throw new Error('Authentication failed: remained on /auth/login after submit');
  }

  // Wait for navigation away from login page to complete
  await page.waitForFunction(() => !window.location.pathname.startsWith('/auth/login'), { timeout: 30000 });
}

/**
 * Checks if page was redirected to login and performs authentication if needed.
 * This handles the case where stored auth state has expired.
 *
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} targetPath - Original target path to redirect back to after login
 */
async function authenticateIfNeeded(page, targetPath) {
  if (!page.url().includes('/auth/login')) return;

  console.log('🔐 Redirected to login, using real /auth/login flow...');
  await performRealLogin(page, targetPath);
}

// ==============================================================================
// FORM INTERACTION HELPERS
// ==============================================================================

/**
 * Opens a Radix UI Select component and picks the first available option.
 * Used for vendor/employee selection dropdowns.
 *
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} triggerText - Text content of the combobox trigger button
 * @returns {Promise<boolean>} True if an option was selected, false otherwise
 */
async function openRadixSelectAndPickFirst(page, triggerText) {
  const trigger = page.locator('button[role="combobox"]').filter({ hasText: triggerText }).first();
  if ((await trigger.count()) === 0) return false;

  await trigger.click();
  const firstOption = page.locator('[role="option"]').filter({ hasNotText: /^$/ }).first();
  if ((await firstOption.count()) === 0) {
    await page.keyboard.press('Escape'); // Close dropdown if no options
    return false;
  }
  await firstOption.click();
  return true;
}

/**
 * Opens the Budget Code combobox and selects the first available budget code.
 * This uses cmdk (command menu) pattern for searchable dropdowns.
 *
 * @param {import('playwright').Page} page - Playwright page object
 */
async function selectFirstBudgetCode(page) {
  const trigger = page.locator('button[role="combobox"]').filter({ hasText: /select budget code/i }).first();
  await trigger.click();

  // Wait for search input to appear (indicates dropdown is open)
  const searchInput = page.getByPlaceholder('Search budget codes...');
  await searchInput.waitFor({ timeout: 8000 });
  await searchInput.fill(''); // Clear any existing search

  // Select first budget code (excluding "create new" option)
  const firstCode = page.locator('[cmdk-item]').filter({ hasNotText: /create new budget code/i }).first();
  await firstCode.waitFor({ timeout: 8000 });
  await firstCode.click();
}

/**
 * Fills the Direct Cost create form with test data.
 *
 * Fields populated:
 *   - Invoice Number: Unique auto-generated value (AUTO-DC-<timestamp>)
 *   - Description: Workflow run identifier
 *   - Payment Terms: "Net 30"
 *   - Date: Today's date
 *   - Vendor/Employee: First available option
 *   - Budget Code: First available code
 *   - Unit Cost: $1,250.50
 *
 * @param {import('playwright').Page} page - Playwright page object
 */
async function fillCreateForm(page) {
  // Wait for form to be ready
  await page.getByRole('heading', { name: /new direct cost/i }).first().waitFor({ timeout: 15000 });
  await page.getByText('Basic Information').first().waitFor({ timeout: 10000 });

  // Fill text inputs
  await page.getByLabel('Invoice Number').fill(INVOICE_NUMBER);
  await page.getByLabel('Description').fill(DESCRIPTION);
  await page.getByLabel('Payment Terms').fill('Net 30');

  // Fill date (today)
  const dateInput = page.locator('input[type="date"]').first();
  await dateInput.fill(new Date().toISOString().slice(0, 10));

  // Select vendor or employee (whichever is available)
  const pickedVendor = await openRadixSelectAndPickFirst(page, 'Select vendor');
  if (!pickedVendor) {
    await openRadixSelectAndPickFirst(page, 'Select employee');
  }

  // Select budget code
  await selectFirstBudgetCode(page);

  // Fill cost amount
  const unitCostInput = page.getByPlaceholder('Enter amount').first();
  await unitCostInput.fill('1250.50');
}

// ==============================================================================
// MAIN WORKFLOW
// ==============================================================================

/**
 * Main workflow execution function.
 *
 * Workflow steps:
 *   1. Set up output directories for screenshots and reports
 *   2. Launch browser and restore auth state if available
 *   3. Navigate to direct costs list page
 *   4. Handle authentication if redirected to login
 *   5. Click "Add Direct Cost" button
 *   6. Fill the create form with test data
 *   7. Submit form and wait for redirect to detail page
 *   8. Navigate back to list and verify created record is visible
 *   9. Generate pass/fail report with screenshots
 *
 * On failure:
 *   - Captures failure screenshot (99-failure.png)
 *   - Writes error details to report.json
 *   - Sets exit code to 1
 */
async function run() {
  // Initialize output directories
  ensureDir(OUTPUT_DIR);
  ensureDir(RUNS_DIR);
  ensureDir(RUN_DIR);
  console.log(`🧭 Base URL: ${BASE_URL}`);
  console.log(`🧱 Project ID: ${PROJECT_ID}`);
  console.log(`📂 Artifacts: ${RUN_DIR}`);

  // Launch browser with optional auth state
  const browser = await chromium.launch({ headless: HEADLESS });
  const contextOptions = {};
  if (fs.existsSync(STORAGE_STATE)) {
    contextOptions.storageState = STORAGE_STATE;
    console.log(`🔐 Using storage state: ${STORAGE_STATE}`);
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Navigate to Direct Costs list page
    // -------------------------------------------------------------------------
    const listUrl = absoluteUrl(`/${PROJECT_ID}/direct-costs`);
    console.log(`➡️ Opening ${listUrl}`);
    await page.goto(listUrl, { waitUntil: 'domcontentloaded' });

    // Handle auth redirect if storage state is expired
    await authenticateIfNeeded(page, `/${PROJECT_ID}/direct-costs`);
    await page.goto(listUrl, { waitUntil: 'domcontentloaded' });

    // Wait for list page to be fully loaded
    await waitForDirectCostsList(page);
    await screenshot(page, '01-list');

    // -------------------------------------------------------------------------
    // STEP 2: Click "Add Direct Cost" to open create form
    // -------------------------------------------------------------------------
    const addButton = page.locator('[data-testid="direct-costs-create-button"], a:has-text("Add Direct Cost"), button:has-text("Add Direct Cost")').first();
    await addButton.click();
    await page.waitForURL(/\/direct-costs\/new/, { timeout: 20000 });
    await screenshot(page, '02-create-form');

    // -------------------------------------------------------------------------
    // STEP 3: Fill the create form with test data
    // -------------------------------------------------------------------------
    await fillCreateForm(page);
    await screenshot(page, '03-form-filled');

    // -------------------------------------------------------------------------
    // STEP 4: Submit form and wait for redirect to detail page
    // -------------------------------------------------------------------------
    const submitButton = page.getByRole('button', { name: /create direct cost/i }).first();
    await submitButton.waitFor({ timeout: 10000 });
    await submitButton.click();

    // Wait for redirect to detail page (URL pattern: /<projectId>/direct-costs/<id>)
    await page.waitForURL(/\/(?:projects\/)?\d+\/direct-costs\/[^/?#]+(?:\?.*)?$/, { timeout: 25000 });
    await page.getByRole('heading', { name: /direct cost details/i }).first().waitFor({ timeout: 15000 });
    await screenshot(page, '04-created-detail');

    // -------------------------------------------------------------------------
    // STEP 5: Navigate back to list and verify record appears
    // -------------------------------------------------------------------------
    await page.goto(listUrl, { waitUntil: 'domcontentloaded' });
    await waitForDirectCostsList(page);
    await screenshot(page, '05-list-after-create');

    // Verify the created record is visible in the list by invoice number
    const createdRecordVisible = await page.getByText(INVOICE_NUMBER, { exact: false }).first().isVisible().catch(() => false);
    if (!createdRecordVisible) {
      throw new Error(`Created record ${INVOICE_NUMBER} not visible in direct costs list`);
    }

    // -------------------------------------------------------------------------
    // SUCCESS: Write passing report
    // -------------------------------------------------------------------------
    console.log(`✅ Created record visible: ${INVOICE_NUMBER}`);
    console.log('✅ Direct Costs workflow completed');
    writeReport({
      status: 'passed',
      runId: RUN_ID,
      runLabel: RUN_LABEL,
      baseUrl: BASE_URL,
      projectId: PROJECT_ID,
      outputDir: RUN_DIR,
      invoiceNumber: INVOICE_NUMBER,
      createdRecordVisible,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // -------------------------------------------------------------------------
    // FAILURE: Capture failure state and write error report
    // -------------------------------------------------------------------------
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('❌ Workflow failed:', message);
    await screenshot(page, '99-failure');
    writeReport({
      status: 'failed',
      runId: RUN_ID,
      runLabel: RUN_LABEL,
      baseUrl: BASE_URL,
      projectId: PROJECT_ID,
      outputDir: RUN_DIR,
      invoiceNumber: INVOICE_NUMBER,
      error: message,
      stack,
      timestamp: new Date().toISOString(),
    });
    process.exitCode = 1;
  } finally {
    // Clean up browser resources
    await context.close();
    await browser.close();
  }
}

// Execute the workflow
run();
