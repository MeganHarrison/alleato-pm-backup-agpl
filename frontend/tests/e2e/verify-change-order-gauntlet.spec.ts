import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.use({ storageState: './tests/.auth/user.json' });

test('verify CO-GAUNTLET-001 in change orders table', async ({ page }) => {
  const screenshotDir = '/Users/meganharrison/Documents/alleato-pm/.claude/form-gauntlet/prime-contracts/forms/create_change_order/attempt-1';

  // Navigate to the prime contract detail page
  await page.goto('http://localhost:3000/67/prime-contracts/20c40a53-f2d7-4b22-a257-cc1b3a80efaa');
  await page.waitForLoadState('networkidle');

  // Screenshot initial state
  await page.screenshot({ path: path.join(screenshotDir, '01-page-loaded.png'), fullPage: true });

  // The tabs are plain <button> elements inside a <nav aria-label="Contract tabs">
  // NOT role="tab" — must target by the nav aria-label to avoid sidebar intercepting
  const contractTabsNav = page.locator('nav[aria-label="Contract tabs"]');
  const changeOrdersTab = contractTabsNav.getByText('Change Orders');

  await changeOrdersTab.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(screenshotDir, '02-change-orders-tab.png'), fullPage: true });

  // Look for CO-GAUNTLET-001 in the page
  const gauntletEntry = page.getByText('CO-GAUNTLET-001');
  const gauntletVisible = await gauntletEntry.isVisible().catch(() => false);

  // Look for $5,000 amount
  const amountText = page.getByText(/\$5,000/).or(page.getByText('5,000.00')).first();
  const amountVisible = await amountText.isVisible().catch(() => false);

  // Take final screenshot
  await page.screenshot({ path: path.join(screenshotDir, '03-final-state.png'), fullPage: true });

  // Write results to a JSON file for the verification report
  const results = {
    gauntletFound: gauntletVisible,
    amountFound: amountVisible,
    url: page.url(),
    pageTitle: await page.title(),
  };

  fs.writeFileSync(
    path.join(screenshotDir, 'test-results.json'),
    JSON.stringify(results, null, 2)
  );

  // Soft assertions to capture both results
  expect(gauntletVisible, 'CO-GAUNTLET-001 should be visible in the table').toBe(true);
  expect(amountVisible, 'Amount $5,000 should be visible').toBe(true);
});
