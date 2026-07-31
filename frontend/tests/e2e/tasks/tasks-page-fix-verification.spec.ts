import { test, expect } from '@playwright/test';

test('tasks page fixed verification', async ({ page }) => {
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[ERROR] ${msg.text()}`);
    }
  });
  await page.waitForTimeout(2000);

  // Navigate to tasks page
  await page.goto('/tasks');
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({
    path: 'tests/screenshots/tasks-page-FIXED.png',
    fullPage: true
  });

  // Verify no error overlay
  const errorOverlay = await page.locator('text=Runtime TypeError').count();
  console.log(`Error overlay count: ${errorOverlay}`);

  // Check for headers
  const headers = await page.locator('header').count();
  console.log(`Header count: ${headers}`);

  // Check for table
  const tables = await page.locator('table').count();
  console.log(`Table count: ${tables}`);

  // Check for search input
  const searchInput = await page.locator('input[placeholder*="Search"]').count();
  console.log(`Search input count: ${searchInput}`);

  // Log console errors
  console.log('\n=== CONSOLE ERRORS ===');
  if (consoleErrors.length === 0) {
    console.log('No console errors found');
  } else {
    consoleErrors.forEach(err => console.log(err));
  }

  // Assertions
  expect(errorOverlay).toBe(0);
  expect(headers).toBeGreaterThan(0);
  expect(tables).toBeGreaterThan(0);
});
