import { test, expect } from '@playwright/test';

test.describe('Portfolio Table Columns', () => {
  test('should not display est revenue and est profit columns', async ({ page }) => {
    // Navigate to the portfolio page
    await page.goto('/');

    // Wait for the table to load
    await page.waitForSelector('table', { timeout: 10000 });

    // Get all table headers
    const headers = await page.locator('thead th').allTextContents();

    // Verify est revenue and est profit columns are NOT present
    expect(headers.join(' ')).not.toContain('Est Revenue');
    expect(headers.join(' ')).not.toContain('Est Profit');

    // Verify expected columns ARE present
    expect(headers.join(' ')).toContain('Name');
    expect(headers.join(' ')).toContain('Job Number');
    expect(headers.join(' ')).toContain('Client');
    expect(headers.join(' ')).toContain('Start Date');
    expect(headers.join(' ')).toContain('State');
    expect(headers.join(' ')).toContain('Phase');
    expect(headers.join(' ')).toContain('Category');
  });

  test('should not display revenue and profit in grid view cards', async ({ page }) => {
    // Navigate to the portfolio page
    await page.goto('/');

    // Wait for page to load
    await page.waitForSelector('button[aria-label="Thumbnails View"]', { timeout: 10000 });

    // Switch to grid view
    await page.click('button[aria-label="Thumbnails View"]');

    // Wait for grid view to render
    await page.waitForSelector('.grid', { timeout: 5000 });

    // Get text content of first card (if any projects exist)
    const cards = await page.locator('.grid > button').count();

    if (cards > 0) {
      const firstCard = await page.locator('.grid > button').first().textContent();

      // Verify revenue and profit are NOT displayed in cards
      expect(firstCard).not.toContain('Revenue:');
      expect(firstCard).not.toContain('Profit:');
    }
  });
});
