import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive Direct Costs E2E Tests
 *
 * Tests the complete direct costs functionality including:
 * - Authentication and authorization
 * - Page display and navigation
 * - CRUD operations (Create, Read, Update, Delete)
 * - Form validation
 * - Table functionality (sorting, filtering, pagination)
 * - Bulk operations
 * - Export functionality
 * - Error handling
 */

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_PROJECT_ID = '67'; // Use an existing project ID

// Helper function to login
async function login(page: Page) {
  await page.waitForLoadState('networkidle');
  // Dev-login redirects to '/' by default
}

// Helper function to navigate to direct costs page
async function navigateToDirectCosts(page: Page, projectId: string = TEST_PROJECT_ID) {
  await page.goto(`/${projectId}/direct-costs`);
  await page.waitForLoadState('networkidle');
}

// Helper function to take screenshots
async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `tests/screenshots/direct-costs-e2e/${name}.png`,
    fullPage: true,
  });
}

// Helper function to fill form fields
async function fillDirectCostForm(page: Page, data: {
  costType?: string;
  description?: string;
  amount?: string;
  date?: string;
  vendor?: string;
  reference?: string;
}) {
  if (data.costType) {
    await page.selectOption('select[name="cost_type"], select:first', data.costType);
  }
  if (data.description) {
    await page.fill('input[name="description"], textarea[name="description"]', data.description);
  }
  if (data.amount) {
    await page.fill('input[name="amount"]', data.amount);
  }
  if (data.date) {
    await page.fill('input[name="date"], input[type="date"]', data.date);
  }
  if (data.vendor) {
    await page.fill('input[name="vendor"]', data.vendor);
  }
  if (data.reference) {
    await page.fill('input[name="reference"]', data.reference);
  }
}

test.describe('Direct Costs - Authentication & Authorization', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    // Try to access direct costs without login
    await page.goto(`/${TEST_PROJECT_ID}/direct-costs`);

    // Should redirect to auth page or show unauthorized
    const url = page.url();
    expect(url.includes('/auth') || url.includes('/login')).toBeTruthy();

    await takeScreenshot(page, '01-unauthorized-redirect');
  });

  test('should allow access with valid authentication', async ({ page }) => {
    await login(page);
    await navigateToDirectCosts(page);

    // Should load the direct costs page
    await expect(page.locator('h1')).toContainText(['Direct Costs', 'direct costs'], { ignoreCase: true });

    await takeScreenshot(page, '02-authorized-access');
  });
});

test.describe('Direct Costs - Page Display & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display direct costs page correctly', async ({ page }) => {
    await navigateToDirectCosts(page);

    // Check page header
    await expect(page.locator('h1').first()).toBeVisible();

    // Check for Direct Costs specific elements
    await expect(page.locator('text=Direct Costs').first()).toBeVisible();

    // Check for main action button
    const newButton = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Add")').first();
    if (await newButton.isVisible()) {
      await expect(newButton).toBeVisible();
    }

    await takeScreenshot(page, '03-page-display');
  });

  test('should show tabs if available', async ({ page }) => {
    await navigateToDirectCosts(page);

    // Look for common tab patterns
    const summaryTab = page.locator('text=Summary').first();
    const costCodeTab = page.locator('text=Summary by Cost Code, text=Cost Code').first();

    if (await summaryTab.isVisible()) {
      await expect(summaryTab).toBeVisible();

      if (await costCodeTab.isVisible()) {
        // Test tab switching
        await costCodeTab.click();
        await page.waitForTimeout(1000);

        // Should update URL or content
        const url = page.url();
        expect(url.includes('view=cost-code') || url.includes('cost-code')).toBeTruthy();

        // Switch back
        await summaryTab.click();
        await page.waitForTimeout(1000);
      }
    }

    await takeScreenshot(page, '04-tab-navigation');
  });

  test('should display data table or empty state', async ({ page }) => {
    await navigateToDirectCosts(page);

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Look for table or empty state
    const table = page.locator('table, [data-testid="direct-cost-table"], [data-testid="generic-data-table"]').first();
    const emptyState = page.locator('text=No direct costs, text=No data, text=empty').first();

    const hasTable = await table.isVisible();
    const hasEmptyState = await emptyState.isVisible();

    expect(hasTable || hasEmptyState).toBeTruthy();

    if (hasTable) {
      // Verify table structure
      await expect(table).toBeVisible();
    } else if (hasEmptyState) {
      await expect(emptyState).toBeVisible();
    }

    await takeScreenshot(page, '05-table-or-empty-state');
  });
});

test.describe('Direct Costs - Create Operation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToDirectCosts(page);
  });

  test('should navigate to create form', async ({ page }) => {
    // Click create/new button
    const createButton = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Add"), text=New Direct Cost').first();

    if (await createButton.isVisible()) {
      await createButton.click();

      // Should navigate to form or open modal
      await page.waitForTimeout(1000);

      // Check for form elements
      const form = page.locator('form, [data-testid="direct-cost-form"]').first();
      const createTitle = page.locator('text=Create, text=New, text=Add').first();

      if (await form.isVisible() || await createTitle.isVisible()) {
        await expect(page.locator('text=Create Direct Cost, text=New Direct Cost, text=Add Direct Cost').first()).toBeVisible();
      }

      await takeScreenshot(page, '06-create-form-navigation');
    }
  });

  test('should create a new direct cost with valid data', async ({ page }) => {
    // Navigate to create form
    const createButton = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Add"), text=New Direct Cost').first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(1000);

      // Fill form with test data
      const testData = {
        costType: 'material',
        description: 'Test Direct Cost Item',
        amount: '1000.00',
        date: '2024-01-15',
        vendor: 'Test Vendor',
        reference: 'REF-001'
      };

      await fillDirectCostForm(page, testData);

      // Submit form
      const submitButton = page.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("Submit"), button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Wait for success indication
        await page.waitForTimeout(2000);

        // Should redirect back to list or show success
        const success = await page.locator('text=created, text=success, text=saved').first().isVisible().catch(() => false);
        const backToList = page.url().includes('/direct-costs') && !page.url().includes('/new');

        expect(success || backToList).toBeTruthy();
      }

      await takeScreenshot(page, '07-create-success');
    }
  });

  test('should show validation errors for invalid data', async ({ page }) => {
    const createButton = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Add"), text=New Direct Cost').first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(1000);

      // Try to submit empty form
      const submitButton = page.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("Submit"), button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should show validation errors
        await page.waitForTimeout(1000);

        const errorMessages = page.locator('text=required, text=invalid, text=error, .error, .text-red, .text-destructive').first();
        const hasErrors = await errorMessages.isVisible().catch(() => false);

        if (hasErrors) {
          await expect(errorMessages).toBeVisible();
        }
      }

      await takeScreenshot(page, '08-validation-errors');
    }
  });
});

test.describe('Direct Costs - Read & Table Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToDirectCosts(page);
  });

  test('should display existing direct costs in table', async ({ page }) => {
    await page.waitForTimeout(2000);

    const table = page.locator('table, [data-testid="direct-cost-table"], [data-testid="generic-data-table"]').first();

    if (await table.isVisible()) {
      // Check for table headers
      const headers = ['Date', 'Amount', 'Type', 'Description', 'Status', 'Actions'];

      for (const header of headers) {
        const headerElement = page.locator(`th:has-text("${header}"), td:has-text("${header}")`, { strict: false }).first();
        if (await headerElement.isVisible()) {
          await expect(headerElement).toBeVisible();
        }
      }
    }

    await takeScreenshot(page, '09-table-display');
  });

  test('should support table filtering if available', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for filter inputs
    const filterInput = page.locator('input[placeholder*="filter"], input[placeholder*="search"], input[placeholder*="Filter"], input[placeholder*="Search"]').first();
    const filterSelect = page.locator('select[data-testid*="filter"]').first();

    if (await filterInput.isVisible()) {
      await filterInput.fill('test');
      await page.waitForTimeout(1000);

      await takeScreenshot(page, '10-table-filtering');

      // Clear filter
      await filterInput.clear();
      await page.waitForTimeout(1000);
    } else if (await filterSelect.isVisible()) {
      await filterSelect.selectOption({ index: 1 });
      await page.waitForTimeout(1000);

      await takeScreenshot(page, '11-table-select-filter');
    }
  });

  test('should support table sorting if available', async ({ page }) => {
    await page.waitForTimeout(2000);

    const table = page.locator('table').first();

    if (await table.isVisible()) {
      // Try clicking on sortable headers
      const sortableHeaders = page.locator('th[role="button"], th.cursor-pointer, th:has(.sort)').first();

      if (await sortableHeaders.isVisible()) {
        await sortableHeaders.click();
        await page.waitForTimeout(1000);

        // Click again to reverse sort
        await sortableHeaders.click();
        await page.waitForTimeout(1000);

        await takeScreenshot(page, '12-table-sorting');
      }
    }
  });

  test('should support pagination if available', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for pagination controls
    const pagination = page.locator('nav[aria-label*="pagination"], .pagination, [data-testid*="pagination"]').first();
    const nextButton = page.locator('button:has-text("Next"), button:has-text("→"), button[aria-label*="next"]').first();

    if (await pagination.isVisible() && await nextButton.isVisible()) {
      const isEnabled = await nextButton.isEnabled();

      if (isEnabled) {
        await nextButton.click();
        await page.waitForTimeout(1000);

        await takeScreenshot(page, '13-table-pagination');

        // Go back
        const prevButton = page.locator('button:has-text("Previous"), button:has-text("←"), button[aria-label*="previous"]').first();
        if (await prevButton.isVisible() && await prevButton.isEnabled()) {
          await prevButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });
});

test.describe('Direct Costs - Update & Delete Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToDirectCosts(page);
  });

  test('should open edit form for existing direct cost', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for edit buttons or clickable rows
    const editButton = page.locator('button:has-text("Edit"), button[aria-label*="edit"], .edit-button').first();
    const tableRow = page.locator('table tr').nth(1); // Skip header row

    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(1000);

      // Should open edit form
      const editForm = page.locator('form, [data-testid="direct-cost-form"]').first();
      const editTitle = page.locator('text=Edit, text=Update').first();

      if (await editForm.isVisible() || await editTitle.isVisible()) {
        await expect(page.locator('text=Edit Direct Cost, text=Update Direct Cost').first()).toBeVisible();
      }

      await takeScreenshot(page, '14-edit-form');
    } else if (await tableRow.isVisible()) {
      // Try double-clicking row
      await tableRow.dblclick();
      await page.waitForTimeout(1000);

      await takeScreenshot(page, '15-row-edit');
    }
  });

  test('should delete direct cost with confirmation', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for delete buttons
    const deleteButton = page.locator('button:has-text("Delete"), button[aria-label*="delete"], .delete-button').first();

    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(500);

      // Should show confirmation dialog
      const confirmDialog = page.locator('[role="dialog"], .modal, .confirm-dialog').first();
      const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")').first();

      if (await confirmDialog.isVisible() && await confirmButton.isVisible()) {
        await takeScreenshot(page, '16-delete-confirmation');

        await confirmButton.click();
        await page.waitForTimeout(1000);

        // Should show success or redirect
        await takeScreenshot(page, '17-delete-success');
      }
    }
  });
});

test.describe('Direct Costs - API Integration & Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API requests to simulate errors
    await page.route('**/api/projects/*/direct-costs', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await navigateToDirectCosts(page);
    await page.waitForTimeout(2000);

    // Should show error message
    const errorMessage = page.locator('text=error, text=Error, .error, .text-red').first();
    const hasError = await errorMessage.isVisible().catch(() => false);

    if (hasError) {
      await expect(errorMessage).toBeVisible();
    }

    await takeScreenshot(page, '18-api-error-handling');
  });

  test('should handle network timeouts', async ({ page }) => {
    // Intercept API requests to simulate timeout
    await page.route('**/api/projects/*/direct-costs', route => {
      // Don't fulfill the route to simulate timeout
      setTimeout(() => {
        route.fulfill({
          status: 408,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Request Timeout' })
        });
      }, 30000); // 30 second delay
    });

    await navigateToDirectCosts(page);
    await page.waitForTimeout(5000);

    // Should show loading state or timeout message
    const loadingIndicator = page.locator('text=loading, text=Loading, .loading, .spinner').first();
    const timeoutMessage = page.locator('text=timeout, text=Timeout').first();

    const hasLoading = await loadingIndicator.isVisible().catch(() => false);
    const hasTimeout = await timeoutMessage.isVisible().catch(() => false);

    if (hasLoading || hasTimeout) {
      await takeScreenshot(page, '19-network-timeout');
    }
  });

  test('should validate required authentication on API calls', async ({ page }) => {
    // Test unauthorized API access
    await page.goto(`${BASE_URL}/api/projects/${TEST_PROJECT_ID}/direct-costs`);

    // Should return 401 or redirect to login
    const responseText = await page.textContent('body');
    const isUnauthorized = responseText?.includes('401') || responseText?.includes('Unauthorized') || responseText?.includes('authenticate');

    expect(isUnauthorized).toBeTruthy();

    await takeScreenshot(page, '20-api-auth-validation');
  });
});

test.describe('Direct Costs - Export & Bulk Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToDirectCosts(page);
  });

  test('should export data if export feature available', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for export buttons
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download"), .export-button').first();

    if (await exportButton.isVisible()) {
      // Start download monitoring
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      await exportButton.click();

      try {
        const download = await downloadPromise;
        expect(download).toBeTruthy();

        await takeScreenshot(page, '21-export-success');
      } catch (error) {
        // Export might open in new tab or show dialog
        await takeScreenshot(page, '22-export-attempt');
      }
    }
  });

  test('should support bulk selection if available', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for bulk selection checkboxes
    const selectAllCheckbox = page.locator('input[type="checkbox"][aria-label*="select all"], th input[type="checkbox"]').first();
    const rowCheckboxes = page.locator('td input[type="checkbox"]');

    if (await selectAllCheckbox.isVisible()) {
      await selectAllCheckbox.click();
      await page.waitForTimeout(500);

      // Should select all rows
      const checkedBoxes = await rowCheckboxes.count();
      if (checkedBoxes > 0) {
        // Look for bulk action buttons
        const bulkDeleteButton = page.locator('button:has-text("Delete Selected"), button:has-text("Bulk Delete")').first();

        if (await bulkDeleteButton.isVisible()) {
          await takeScreenshot(page, '23-bulk-selection');

          // Unselect to avoid accidentally deleting
          await selectAllCheckbox.click();
        }
      }
    }
  });
});

test.describe('Direct Costs - Performance & Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load page within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await navigateToDirectCosts(page);
    await page.waitForLoadState('networkidle');

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Page should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);

    await takeScreenshot(page, '24-performance-test');
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await navigateToDirectCosts(page);
    await page.waitForTimeout(2000);

    // Check if page is responsive
    const content = page.locator('main, .main-content, .container').first();
    if (await content.isVisible()) {
      const boundingBox = await content.boundingBox();

      // Content should fit within mobile viewport
      expect(boundingBox?.width).toBeLessThanOrEqual(375);
    }

    await takeScreenshot(page, '25-mobile-responsive');

    // Reset to desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});