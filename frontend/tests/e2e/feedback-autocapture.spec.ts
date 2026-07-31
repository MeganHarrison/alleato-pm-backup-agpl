import { test, expect } from '@playwright/test';

test('feedback submission with autocapture', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:3001/67/budget', { waitUntil: 'domcontentloaded' });

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Take a screenshot of the page
  await page.screenshot({ path: '/tmp/1_budget_page.png' });
  console.log('✓ Loaded budget page');

  // Check if feedback widget is present
  const feedbackButton = page.locator('button, [role="button"]').filter({ hasText: /feedback|report|bug/i }).first();
  const isVisible = await feedbackButton.isVisible().catch(() => false);
  console.log('Feedback button visible:', isVisible);

  // Take screenshot
  await page.screenshot({ path: '/tmp/2_page_overview.png' });
  console.log('Screenshot saved');
});
