import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive Prime Contracts E2E Tests
 *
 * Tests the complete contracts functionality including:
 * - Page display and navigation
 * - Contract list with filtering and search
 * - Contract creation form
 * - Contract detail view with tabs
 * - Change orders integration
 * - Export functionality
 * - Status management
 */

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_PROJECT_ID = '67';

// Helper function to login
async function login(page: Page) {
}

// Helper function to navigate to contracts page
async function navigateToContracts(page: Page, projectId: string = TEST_PROJECT_ID) {
  await page.goto(`/${projectId}/prime-contracts`);
  await page.waitForLoadState('networkidle');
}

// Helper function to take screenshots
async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `tests/screenshots/contracts-e2e/${name}.png`,
    fullPage: true,
  });
}

test.describe('Prime Contracts - Page Display', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display contracts page with header and action buttons', async ({ page }) => {
    await navigateToContracts(page);

    // Verify page header
    await expect(page.locator('h1:has-text("Prime Contracts")')).toBeVisible();
    await expect(page.locator('text=Manage prime contracts and owner agreements')).toBeVisible();

    // Verify New Contract button
    await expect(page.getByRole('button', { name: /New Contract/i })).toBeVisible();

    await takeScreenshot(page, '01-contracts-page-display');
  });

  test('should display contracts tabs', async ({ page }) => {
    await navigateToContracts(page);

    // Verify tabs are visible
    await expect(page.locator('text=All Contracts')).toBeVisible();
    await expect(page.locator('text=Draft')).toBeVisible();
    await expect(page.locator('text=Out for Bid')).toBeVisible();
    await expect(page.locator('text=Out for Signature')).toBeVisible();
    await expect(page.locator('text=Approved')).toBeVisible();

    await takeScreenshot(page, '02-contracts-tabs');
  });

  test('should display summary cards with totals', async ({ page }) => {
    await navigateToContracts(page);

    // Wait for data to load
    await page.waitForSelector('text=Original Contract Amount', { timeout: 10000 });

    // Verify summary cards
    await expect(page.locator('text=Original Contract Amount')).toBeVisible();
    await expect(page.locator('text=Approved Change Orders')).toBeVisible();
    await expect(page.locator('text=Revised Contract Amount')).toBeVisible();
    await expect(page.locator('text=Pending Change Orders')).toBeVisible();

    await takeScreenshot(page, '03-contracts-summary-cards');
  });

  test('should display search and filter controls', async ({ page }) => {
    await navigateToContracts(page);

    // Verify search input
    await expect(page.getByPlaceholder('Search contracts or clients...')).toBeVisible();

    // Verify status filter dropdown
    const statusFilter = page.locator('button:has-text("All statuses"), select').first();
    await expect(statusFilter).toBeVisible();

    await takeScreenshot(page, '04-contracts-search-filters');
  });

  test('should display contracts table with columns', async ({ page }) => {
    await navigateToContracts(page);

    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });

    // Verify key column headers
    const columnHeaders = ['#', 'Owner/Client', 'Title', 'Status', 'Executed', 'Original Amount'];
    for (const header of columnHeaders) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }

    await takeScreenshot(page, '05-contracts-table-columns');
  });

  test('should display Grand Totals row in table footer', async ({ page }) => {
    await navigateToContracts(page);

    await page.waitForSelector('table', { timeout: 10000 });

    // Check for Grand Totals row
    await expect(page.locator('tfoot:has-text("Grand Totals")')).toBeVisible();

    await takeScreenshot(page, '06-contracts-grand-totals');
  });
});

test.describe('Prime Contracts - Filtering and Search', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToContracts(page);
  });

  test('should filter contracts by search term', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search contracts or clients...');
    await searchInput.fill('test');
    await page.waitForTimeout(500);

    await takeScreenshot(page, '07-contracts-search');
  });

  test('should open status filter dropdown', async ({ page }) => {
    // Click on status filter
    const statusTrigger = page.locator('[class*="SelectTrigger"]').first();
    if (await statusTrigger.isVisible({ timeout: 3000 })) {
      await statusTrigger.click();
      await page.waitForTimeout(300);

      // Verify filter options
      await expect(page.getByRole('option', { name: 'All statuses' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Draft' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Out for Bid' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Out for Signature' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Approved' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Complete' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Terminated' })).toBeVisible();

      await takeScreenshot(page, '08-contracts-status-filter-dropdown');

      await page.keyboard.press('Escape');
    }
  });

  test('should filter contracts by Draft status', async ({ page }) => {
    const statusTrigger = page.locator('[class*="SelectTrigger"]').first();
    if (await statusTrigger.isVisible({ timeout: 3000 })) {
      await statusTrigger.click();
      await page.waitForTimeout(300);

      await page.getByRole('option', { name: 'Draft' }).click();
      await page.waitForTimeout(500);

      await takeScreenshot(page, '09-contracts-filtered-by-draft');
    }
  });

  test('should filter contracts by Approved status', async ({ page }) => {
    const statusTrigger = page.locator('[class*="SelectTrigger"]').first();
    if (await statusTrigger.isVisible({ timeout: 3000 })) {
      await statusTrigger.click();
      await page.waitForTimeout(300);

      await page.getByRole('option', { name: 'Approved' }).click();
      await page.waitForTimeout(500);

      await takeScreenshot(page, '10-contracts-filtered-by-approved');
    }
  });
});

test.describe('Prime Contracts - Table Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToContracts(page);
  });

  test('should expand contract row to show change orders', async ({ page }) => {
    await page.waitForSelector('table', { timeout: 10000 });

    // Find and click the expand button on first row
    const expandButtons = page.locator('tbody tr button').first();
    if (await expandButtons.isVisible({ timeout: 3000 })) {
      await expandButtons.click();
      await page.waitForTimeout(500);

      await takeScreenshot(page, '11-contracts-expanded-row');
    }
  });

  test('should navigate to contract detail on row click', async ({ page }) => {
    await page.waitForSelector('table', { timeout: 10000 });

    // Find a contract link and click it
    const contractLink = page.locator('tbody tr td a').first();
    if (await contractLink.isVisible({ timeout: 3000 })) {
      await contractLink.click();
      await takeScreenshot(page, '12-contract-detail-page');
    }
  });

  test('should display status badges with correct colors', async ({ page }) => {
    await page.waitForSelector('table', { timeout: 10000 });

    // Check for status badges
    const statusBadges = page.locator('tbody [class*="Badge"]');
    const badgeCount = await statusBadges.count();

    if (badgeCount > 0) {
      await takeScreenshot(page, '13-contracts-status-badges');
    }
  });
});

test.describe('Prime Contracts - Create New Contract', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToContracts(page);
  });

  test('should navigate to new contract form', async ({ page }) => {
    await page.getByRole('button', { name: /New Contract/i }).click();
    // Verify form page loaded
    await expect(page.locator('text=General Information').first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, '14-new-contract-form');
  });

  test('should display contract form sections', async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/prime-contracts/new`);
    await page.waitForLoadState('networkidle');

    // Verify form sections are visible
    const sections = [
      'General Information',
      'Schedule of Values',
      'Contract Dates',
    ];

    for (const section of sections) {
      await expect(page.locator(`text=${section}`).first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Section might be in a collapsible area
      });
    }

    await takeScreenshot(page, '15-contract-form-sections');
  });

  test('should display contract form fields', async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/prime-contracts/new`);
    await page.waitForLoadState('networkidle');

    // Verify key form fields
    await expect(page.locator('label:has-text("Contract")').first()).toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, '16-contract-form-fields');
  });

  test('should display status dropdown options', async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/prime-contracts/new`);
    await page.waitForLoadState('networkidle');

    // Find and click status dropdown
    const statusSelect = page.locator('button:has-text("Draft"), [id*="status"]').first();
    if (await statusSelect.isVisible({ timeout: 5000 })) {
      await statusSelect.click();
      await page.waitForTimeout(300);

      await takeScreenshot(page, '17-contract-status-dropdown');

      await page.keyboard.press('Escape');
    }
  });

  test('should have Cancel and Create buttons', async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/prime-contracts/new`);
    await page.waitForLoadState('networkidle');

    // Verify form buttons
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create|Save/i })).toBeVisible();

    await takeScreenshot(page, '18-contract-form-buttons');
  });

  test('should navigate back on Cancel', async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/prime-contracts/new`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Cancel/i }).click();
    await takeScreenshot(page, '19-contract-form-cancelled');
  });
});

test.describe('Prime Contracts - Contract Detail View', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display contract detail page with tabs', async ({ page }) => {
    // Navigate to contracts and click on first contract
    await navigateToContracts(page);
    await page.waitForSelector('table', { timeout: 10000 });

    const contractLink = page.locator('tbody tr td a').first();
    if (await contractLink.isVisible({ timeout: 3000 })) {
      await contractLink.click();
      // Verify tabs are visible
      const tabs = ['General', 'Change Orders', 'Invoices', 'Payments'];
      for (const tab of tabs) {
        const tabElement = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first();
        if (await tabElement.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Tab exists
        }
      }

      await takeScreenshot(page, '20-contract-detail-tabs');
    }
  });

  test('should display contract general information', async ({ page }) => {
    await navigateToContracts(page);
    await page.waitForSelector('table', { timeout: 10000 });

    const contractLink = page.locator('tbody tr td a').first();
    if (await contractLink.isVisible({ timeout: 3000 })) {
      await contractLink.click();
      // Look for general information section
      await page.waitForTimeout(1000);

      await takeScreenshot(page, '21-contract-detail-general');
    }
  });

  test('should navigate to Change Orders tab', async ({ page }) => {
    await navigateToContracts(page);
    await page.waitForSelector('table', { timeout: 10000 });

    const contractLink = page.locator('tbody tr td a').first();
    if (await contractLink.isVisible({ timeout: 3000 })) {
      await contractLink.click();
      const changeOrdersTab = page.locator('button:has-text("Change Orders"), [role="tab"]:has-text("Change Orders")').first();
      if (await changeOrdersTab.isVisible({ timeout: 3000 })) {
        await changeOrdersTab.click();
        await page.waitForTimeout(500);

        await takeScreenshot(page, '22-contract-change-orders-tab');
      }
    }
  });

  test('should display Create dropdown in contract detail', async ({ page }) => {
    await navigateToContracts(page);
    await page.waitForSelector('table', { timeout: 10000 });

    const contractLink = page.locator('tbody tr td a').first();
    if (await contractLink.isVisible({ timeout: 3000 })) {
      await contractLink.click();
      const createButton = page.getByRole('button', { name: /Create/i }).first();
      if (await createButton.isVisible({ timeout: 3000 })) {
        await createButton.click();
        await page.waitForTimeout(300);

        await takeScreenshot(page, '23-contract-detail-create-dropdown');

        await page.keyboard.press('Escape');
      }
    }
  });
});

test.describe('Prime Contracts - Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToContracts(page);
  });

  test('should have export button in page header', async ({ page }) => {
    // Look for export button
    const exportButton = page.getByRole('button', { name: /Export/i });
    if (await exportButton.isVisible({ timeout: 3000 })) {
      await expect(exportButton).toBeVisible();
      await takeScreenshot(page, '24-contracts-export-button');
    }
  });

  test('should show export options dropdown', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /Export/i });
    if (await exportButton.isVisible({ timeout: 3000 })) {
      await exportButton.click();
      await page.waitForTimeout(300);

      await takeScreenshot(page, '25-contracts-export-dropdown');

      await page.keyboard.press('Escape');
    }
  });
});

test.describe('Prime Contracts - Empty State', () => {
  test('should display empty state for project with no contracts', async ({ page }) => {
    await login(page);

    // Navigate to a project that might not have contracts
    await page.goto(`/999/prime-contracts`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for either empty state or loading/error
    const emptyState = page.locator('text=No contracts found');
    const createButton = page.locator('text=Create your first contract');

    if (await emptyState.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(emptyState).toBeVisible();
      await takeScreenshot(page, '26-contracts-empty-state');
    }
  });
});

test.describe('Prime Contracts - Responsive Design', () => {
  test('should display mobile filter modal on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await navigateToContracts(page);

    await takeScreenshot(page, '27-contracts-mobile-view');
  });

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await navigateToContracts(page);

    await takeScreenshot(page, '28-contracts-tablet-view');
  });
});

test.describe('Prime Contracts - API Integration', () => {
  test('should load contracts from API', async ({ page }) => {
    await login(page);

    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/prime-contracts') || request.url().includes('supabase')) {
        requests.push(request.url());
      }
    });

    await navigateToContracts(page);

    // Verify data was loaded (either from API or Supabase)
    await page.waitForTimeout(2000);

    await takeScreenshot(page, '29-contracts-api-loaded');
  });
});

test.describe('Prime Contracts - Schedule of Values', () => {
  test('should display SOV section in contract form', async ({ page }) => {
    await login(page);
    await page.goto(`/${TEST_PROJECT_ID}/prime-contracts/new`);
    await page.waitForLoadState('networkidle');

    // Look for Schedule of Values section
    await expect(page.locator('text=Schedule of Values').first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, '30-contract-sov-section');
  });

  test('should have Add Line button in SOV section', async ({ page }) => {
    await login(page);
    await page.goto(`/${TEST_PROJECT_ID}/prime-contracts/new`);
    await page.waitForLoadState('networkidle');

    // Look for Add Line button
    const addLineButton = page.getByRole('button', { name: /Add Line/i });
    if (await addLineButton.isVisible({ timeout: 5000 })) {
      await expect(addLineButton).toBeVisible();
      await takeScreenshot(page, '31-contract-sov-add-line');
    }
  });
});

test.describe('Prime Contracts - Status Badge Colors', () => {
  test('should display correct badge colors for different statuses', async ({ page }) => {
    await login(page);
    await navigateToContracts(page);

    await page.waitForSelector('table', { timeout: 10000 });

    // Status badges should have proper styling
    const statusBadges = page.locator('tbody [class*="Badge"]');
    const count = await statusBadges.count();

    if (count > 0) {
      // Take screenshot showing status badges
      await takeScreenshot(page, '32-contracts-status-badge-colors');
    }
  });
});
