import { test, expect } from '@playwright/test';

test.describe('Tasks Page Verification', () => {
  test('should verify tasks page structure and headers', async ({ page }) => {
    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');

    // Navigate to tasks page
    await page.goto('/tasks');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow UI to settle

    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Take screenshot
    await page.screenshot({
      path: '/Users/meganharrison/Documents/github/alleato-procore/tests/screenshots/tasks-page-verification.png',
      fullPage: true
    });

    // Verify page loaded without errors
    const pageTitle = await page.title();
    console.log('Page Title:', pageTitle);

    // Check for "Tasks" header(s) - should only be ONE
    const headings = await page.locator('h1, h2, h3').filter({ hasText: 'Tasks' }).all();
    console.log(`Number of "Tasks" headers found: ${headings.length}`);

    // Get all headings text for debugging
    for (let i = 0; i < headings.length; i++) {
      const text = await headings[i].textContent();
      const tagName = await headings[i].evaluate(el => el.tagName);
      console.log(`Header ${i + 1}: <${tagName}> "${text}"`);
    }

    // Check if table exists
    const table = await page.locator('table').count();
    console.log(`Tables found: ${table}`);

    // Check for TablePageWrapper component
    const pageWrapper = await page.locator('[class*="page-wrapper"], [class*="PageWrapper"]').count();
    console.log(`Page wrapper elements: ${pageWrapper}`);

    // Log console errors
    console.log('Console errors:', consoleErrors.length === 0 ? 'None' : consoleErrors);

    // Assertions
    expect(headings.length).toBe(1); // Only ONE "Tasks" header
    expect(table).toBeGreaterThan(0); // Table should exist
    expect(consoleErrors.length).toBe(0); // No console errors
  });
});
