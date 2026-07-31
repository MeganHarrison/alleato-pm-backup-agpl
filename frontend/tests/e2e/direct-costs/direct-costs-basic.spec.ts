import { test, expect } from '@playwright/test';

test.describe('Direct Costs - Basic Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for redirect to home page
    // Navigate directly to a known project's direct costs (using a common test project ID)
    await page.goto('/projects/test-project-id/direct-costs');
  });

  test('Direct Costs page loads successfully', async ({ page }) => {
    // Check page header
    await expect(page.locator('h1').first()).toBeVisible();
    
    // Check for Direct Costs specific elements
    await expect(page.locator('text=Direct Costs')).toBeVisible();
    
    // Check for tabs
    await expect(page.locator('text=Summary')).toBeVisible();
    await expect(page.locator('text=Summary by Cost Code')).toBeVisible();
    
    // Check for New Direct Cost button
    const newButton = page.locator('text=New Direct Cost');
    await expect(newButton).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/direct-costs-page.png', fullPage: true });
  });

  test('Can navigate to create new Direct Cost', async ({ page }) => {
    // Click New Direct Cost button
    await page.click('text=New Direct Cost');
    
    // Wait for navigation
    // Check form elements
    await expect(page.locator('text=Create Direct Cost')).toBeVisible();
    await expect(page.locator('text=Basic Information')).toBeVisible();
    
    // Check cost type select exists
    const costTypeSelect = page.locator('select').first();
    await expect(costTypeSelect).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/direct-costs-create-form.png', fullPage: true });
  });

  test('Direct Costs table displays data or empty state', async ({ page }) => {
    // Wait for table or empty state
    await page.waitForSelector('[data-testid="generic-data-table"], text=No direct costs found', { timeout: 10000 });
    
    // Check if table headers are visible (if table exists)
    const tableExists = await page.locator('[data-testid="generic-data-table"]').isVisible().catch(() => false);
    
    if (tableExists) {
      // Verify table structure
      await expect(page.locator('text=Date')).toBeVisible();
      await expect(page.locator('text=Amount')).toBeVisible();
      await expect(page.locator('text=Status')).toBeVisible();
    } else {
      // Verify empty state
      await expect(page.locator('text=No direct costs found')).toBeVisible();
    }
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/direct-costs-table.png', fullPage: true });
  });

  test('Tab switching works', async ({ page }) => {
    // Click Summary by Cost Code tab
    await page.click('text=Summary by Cost Code');
    
    // Verify URL changed
    await expect(page).toHaveURL(/view=cost-code/);
    
    // Click back to Summary
    await page.locator('text=Summary').first().click();
    
    // Verify URL changed back
    await expect(page).not.toHaveURL(/view=cost-code/);
  });
});