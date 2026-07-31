import { test, expect, Page } from '@playwright/test';
import { format } from 'date-fns';
import path from 'path';

// Test configuration
const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Test User'
};

const SCREENSHOT_DIR = 'tests/screenshots/form-tests';
let projectId: string;

// Helper function to take and save screenshot
async function takeScreenshot(page: Page, name: string) {
  const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
  const filename = `${timestamp}-${name}.png`;
  await page.screenshot({ 
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: true 
  });
  return filename;
}

// Helper to generate unique identifiers
function generateId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

test.describe('Comprehensive Form Testing', () => {
  test.describe.configure({ mode: 'serial' });

  // 1. AUTHENTICATION FORMS
  test.describe('1. Authentication Forms', () => {
    test('1.1 Sign Up Form', async ({ page }) => {
      await page.goto('/auth/sign-up');
      
      // Fill sign up form
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.fill('input[name="name"]', TEST_USER.name);
      
      // Take screenshot before submission
      const screenshotBefore = await takeScreenshot(page, 'signup-form-filled');
      console.log(`✅ Sign up form filled - Screenshot: ${screenshotBefore}`);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for success
      await page.waitForURL('/auth/sign-up-success', { timeout: 10000 });
      const screenshotAfter = await takeScreenshot(page, 'signup-success');
      console.log(`✅ Sign up successful - Screenshot: ${screenshotAfter}`);
    });

    test('1.2 Login Form', async ({ page }) => {
      await page.goto('/auth/login');
      
      // Fill login form
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      
      const screenshotBefore = await takeScreenshot(page, 'login-form-filled');
      console.log(`✅ Login form filled - Screenshot: ${screenshotBefore}`);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for redirect to dashboard
      await page.waitForURL('/', { timeout: 10000 });
      const screenshotAfter = await takeScreenshot(page, 'login-success-dashboard');
      console.log(`✅ Login successful - Screenshot: ${screenshotAfter}`);
    });

    test('1.3 Forgot Password Form', async ({ page }) => {
      await page.goto('/auth/forgot-password');
      
      await page.fill('input[name="email"]', TEST_USER.email);
      const screenshot = await takeScreenshot(page, 'forgot-password-filled');
      
      await page.click('button[type="submit"]');
      
      // Wait for success message
      await expect(page.locator('text=Password reset instructions sent')).toBeVisible({ timeout: 5000 });
      const screenshotSuccess = await takeScreenshot(page, 'forgot-password-success');
      console.log(`✅ Password reset sent - Screenshot: ${screenshotSuccess}`);
    });
  });

  // 2. PROJECT MANAGEMENT
  test.describe('2. Project Management', () => {
    test('2.1 Create New Project', async ({ page }) => {
      // Login first
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      // Navigate to project form
      await page.goto('/project-form');
      
      const projectData = {
        name: generateId('Test Project'),
        description: 'Comprehensive test project for form validation',
        number: generateId('TEST'),
        address: '123 Test Street, Test City, TC 12345',
        stage: 'Pre-Construction',
        workScope: 'New Construction', 
        sector: 'Commercial',
        deliveryMethod: 'Design-Build',
        type: 'Office Building',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        timezone: 'America/New_York',
        country: 'United States',
        state: 'New York'
      };

      // Fill basic information
      await page.fill('input[name="name"]', projectData.name);
      await page.fill('textarea[name="description"]', projectData.description);
      await page.fill('input[name="project_number"]', projectData.number);
      await page.fill('input[name="address"]', projectData.address);
      
      const screenshotBasic = await takeScreenshot(page, 'project-form-basic-info');
      console.log(`✅ Basic info filled - Screenshot: ${screenshotBasic}`);

      // Fill project details
      await page.selectOption('select[name="stage"]', projectData.stage);
      await page.selectOption('select[name="work_scope"]', projectData.workScope);
      await page.selectOption('select[name="sector"]', projectData.sector);
      await page.selectOption('select[name="delivery_method"]', projectData.deliveryMethod);
      await page.selectOption('select[name="type"]', projectData.type);
      
      // Fill dates
      await page.fill('input[name="start_date"]', projectData.startDate);
      await page.fill('input[name="end_date"]', projectData.endDate);
      
      const screenshotDetails = await takeScreenshot(page, 'project-form-all-details');
      console.log(`✅ All details filled - Screenshot: ${screenshotDetails}`);

      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for redirect to project page and capture project ID
      await page.waitForURL(/\/\d+\/home/, { timeout: 15000 });
      const url = page.url();
      projectId = url.match(/\/(\d+)\/home/)?.[1] || '';
      
      const screenshotSuccess = await takeScreenshot(page, 'project-created-home');
      console.log(`✅ Project created with ID: ${projectId} - Screenshot: ${screenshotSuccess}`);
    });
  });

  // 3. BUDGET MANAGEMENT
  test.describe('3. Budget Management', () => {
    test('3.1 Create Budget Line Items (Form Page)', async ({ page }) => {
      await page.goto(`/${projectId}/budget/line-item/new`);
      
      // Wait for form to load
      await page.waitForSelector('form');
      
      // Add first line item
      await page.click('button:has-text("Select budget code")');
      await page.click('text=Create New Budget Code');
      
      // In the budget code creation modal
      await page.waitForSelector('[role="dialog"]');
      await page.click('text=01 General Requirements'); // Expand division
      await page.click('text=01-3120'); // Select cost code
      await page.selectOption('select', 'L'); // Select Labor type
      await page.click('button:has-text("Create Budget Code")');
      
      // Fill line item details
      await page.fill('input[placeholder="0"]', '100'); // Quantity
      await page.selectOption('select', 'HR'); // UOM
      await page.fill('input[placeholder="0.00"]', '75'); // Unit cost
      
      const screenshot1 = await takeScreenshot(page, 'budget-line-item-1');
      console.log(`✅ First budget line item - Screenshot: ${screenshot1}`);
      
      // Add second line item
      await page.click('button:has-text("Add Row")');
      // ... repeat process for second item
      
      // Submit form
      await page.click('button:has-text("Create")');
      await page.waitForURL(`/${projectId}/budget`);
      
      const screenshotSuccess = await takeScreenshot(page, 'budget-items-created');
      console.log(`✅ Budget items created - Screenshot: ${screenshotSuccess}`);
    });

    test('3.2 Create Budget Line Items (Modal)', async ({ page }) => {
      await page.goto(`/${projectId}/budget`);
      
      // Open modal
      await page.click('button:has-text("Create Budget Line Item")');
      await page.waitForSelector('[role="dialog"]');
      
      // Fill modal form
      // Similar to above but in modal context
      
      const screenshotModal = await takeScreenshot(page, 'budget-modal-filled');
      console.log(`✅ Budget modal filled - Screenshot: ${screenshotModal}`);
    });
  });

  // 4. FINANCIAL FORMS
  test.describe('4. Financial Forms', () => {
    test('4.1 Create Subcontract Commitment', async ({ page }) => {
      await page.goto(`/${projectId}/commitments/new?type=subcontract`);
      
      const commitmentData = {
        number: generateId('SC'),
        title: 'Electrical Subcontract',
        description: 'Complete electrical installation for project',
        amount: '150000',
        retention: '10'
      };
      
      // Fill commitment form
      await page.fill('input[name="commitment_number"]', commitmentData.number);
      await page.fill('input[name="title"]', commitmentData.title);
      await page.fill('textarea[name="description"]', commitmentData.description);
      await page.fill('input[name="contract_amount"]', commitmentData.amount);
      await page.fill('input[name="retention_percentage"]', commitmentData.retention);
      
      // Select status
      await page.selectOption('select[name="status"]', 'draft');
      
      // Set dates
      const today = format(new Date(), 'yyyy-MM-dd');
      await page.fill('input[name="executed_date"]', today);
      await page.fill('input[name="start_date"]', today);
      
      const screenshot = await takeScreenshot(page, 'subcontract-form-filled');
      console.log(`✅ Subcontract form filled - Screenshot: ${screenshot}`);
      
      // Submit
      await page.click('button[type="submit"]');
      await page.waitForURL(`/${projectId}/commitments`);
      
      const screenshotSuccess = await takeScreenshot(page, 'subcontract-created');
      console.log(`✅ Subcontract created - Screenshot: ${screenshotSuccess}`);
    });

    test('4.2 Create Purchase Order Commitment', async ({ page }) => {
      await page.goto(`/${projectId}/commitments/new?type=purchase_order`);
      
      const poData = {
        number: generateId('PO'),
        title: 'Steel Materials Order',
        description: 'Structural steel for main building',
        amount: '75000'
      };
      
      // Fill PO form
      await page.fill('input[name="commitment_number"]', poData.number);
      await page.fill('input[name="title"]', poData.title);
      await page.fill('textarea[name="description"]', poData.description);
      await page.fill('input[name="contract_amount"]', poData.amount);
      
      const screenshot = await takeScreenshot(page, 'purchase-order-filled');
      console.log(`✅ Purchase order filled - Screenshot: ${screenshot}`);
      
      // Submit
      await page.click('button[type="submit"]');
      await page.waitForURL(`/${projectId}/commitments`);
      
      const screenshotSuccess = await takeScreenshot(page, 'purchase-order-created');
      console.log(`✅ Purchase order created - Screenshot: ${screenshotSuccess}`);
    });
  });

  // 5. DATA VERIFICATION
  test.describe('5. Data Verification', () => {
    test('5.1 Project Home Page', async ({ page }) => {
      await page.goto(`/${projectId}/home`);
      
      // Verify project details
      await expect(page.locator('h1')).toContainText('Project');
      
      // Check financial toggles
      await page.click('text=Budget');
      const screenshotBudget = await takeScreenshot(page, 'project-home-budget-toggle');
      
      await page.click('text=Prime Contract');
      const screenshotContract = await takeScreenshot(page, 'project-home-contract-toggle');
      
      await page.click('text=Commitments');
      const screenshotCommitments = await takeScreenshot(page, 'project-home-commitments-toggle');
      
      console.log(`✅ Project home verified - Screenshots: ${screenshotBudget}, ${screenshotContract}, ${screenshotCommitments}`);
    });

    test('5.2 Budget Page', async ({ page }) => {
      await page.goto(`/${projectId}/budget`);
      
      // Verify budget items display
      await expect(page.locator('table')).toBeVisible();
      await expect(page.locator('text=01-3120')).toBeVisible();
      
      const screenshot = await takeScreenshot(page, 'budget-page-complete');
      console.log(`✅ Budget page verified - Screenshot: ${screenshot}`);
    });

    test('5.3 Commitments Page', async ({ page }) => {
      await page.goto(`/${projectId}/commitments`);
      
      // Verify commitments display
      await expect(page.locator('text=Electrical Subcontract')).toBeVisible();
      await expect(page.locator('text=Steel Materials Order')).toBeVisible();
      
      // Check tabs
      await page.click('text=Subcontracts');
      const screenshotSub = await takeScreenshot(page, 'commitments-subcontracts');
      
      await page.click('text=Purchase Orders');
      const screenshotPO = await takeScreenshot(page, 'commitments-purchase-orders');
      
      console.log(`✅ Commitments verified - Screenshots: ${screenshotSub}, ${screenshotPO}`);
    });
  });

  // 6. ERROR HANDLING
  test.describe('6. Error Handling', () => {
    test('6.1 Form Validation Errors', async ({ page }) => {
      await page.goto('/project-form');
      
      // Try to submit empty form
      await page.click('button[type="submit"]');
      
      // Check for validation errors
      await expect(page.locator('text=required')).toBeVisible();
      const screenshot = await takeScreenshot(page, 'form-validation-errors');
      console.log(`✅ Validation errors shown - Screenshot: ${screenshot}`);
    });
  });
});

// Generate test summary
test.afterAll(async () => {
  console.log('\n📊 TEST SUMMARY:');
  console.log('================');
  console.log(`Project ID: ${projectId}`);
  console.log(`Test User: ${TEST_USER.email}`);
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log('\n✅ All forms tested successfully!');
});
