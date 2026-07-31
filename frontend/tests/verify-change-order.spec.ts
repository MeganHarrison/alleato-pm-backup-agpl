import { test, expect } from '@playwright/test';

test('verify CO-GAUNTLET-001 exists in change orders tab', async ({ page }) => {
  // Navigate directly to the prime contract detail page with change-orders tab via URL
  await page.goto('http://localhost:3000/67/prime-contracts/20c40a53-f2d7-4b22-a257-cc1b3a80efaa');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Take screenshot of initial page
  await page.screenshot({ path: '/tmp/verify-create-change-order-1.png', fullPage: false });

  // Contract detail tabs are plain <button> elements inside <nav aria-label="Contract tabs">
  // There is no role="tab" or role="tablist" on this page
  const contractNav = page.locator('nav[aria-label="Contract tabs"]');
  await contractNav.getByRole('button', { name: /change orders/i }).click();

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Take screenshot after clicking tab
  await page.screenshot({ path: '/tmp/verify-create-change-order-2.png', fullPage: false });

  // Check page content for CO-GAUNTLET-001
  const pageContent = await page.content();
  const hasGauntlet = pageContent.includes('CO-GAUNTLET-001');
  const hasAmount = pageContent.includes('5,000') || pageContent.includes('5000');

  // Count visible instances
  const coTextCount = await page.getByText('CO-GAUNTLET-001').count();

  console.log('CO-GAUNTLET-001 found in DOM:', hasGauntlet);
  console.log('Amount 5,000 found:', hasAmount);
  console.log('CO text element count:', coTextCount);

  // Take full page screenshot
  await page.screenshot({ path: '/tmp/verify-create-change-order-3.png', fullPage: true });

  // Assert
  expect(hasGauntlet, 'CO-GAUNTLET-001 should be visible in the change orders tab').toBe(true);
});
