import { test, expect } from '@playwright/test';

test('submit feedback with autocapture', async ({ page, context }) => {
  // Collect any console errors or warnings
  const consoleLogs: string[] = [];
  const networkErrors: string[] = [];

  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      consoleLogs.push(`ERROR: ${msg.text()}`);
    }
  });

  page.on('response', response => {
    if (!response.ok() && response.url().includes('api')) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  // Navigate to a page with the feedback widget
  console.log('\n=== Starting feedback submission test ===');
  console.log('Navigating to budget page...');
  await page.goto('http://localhost:3001/67/budget', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  // Look for feedback launcher button - check various selectors
  console.log('Looking for feedback widget...');

  // The widget might be in a dialog or floating element
  const feedbackElements = page.locator('[class*="feedback"], [id*="feedback"], button:has-text("Feedback")');
  const count = await feedbackElements.count().catch(() => 0);
  console.log(`Found ${count} feedback-related elements`);

  // Try to find by aria-label or title
  const possibleButtons = page.locator('button[aria-label*="feedback" i], button[title*="feedback" i], div[data-testid*="feedback" i]');
  const possibleCount = await possibleButtons.count().catch(() => 0);
  console.log(`Found ${possibleCount} possible feedback buttons`);

  // Check if the widget is mounted by looking for its container
  const widgetContainer = page.locator('div[class*="floating"], div[class*="feedback"]').first();
  const isPresent = await widgetContainer.isVisible().catch(() => false);
  console.log(`Widget container visible: ${isPresent}`);

  // Look for the feedback launcher by examining all buttons
  const allButtons = page.locator('button');
  const totalButtons = await allButtons.count();
  console.log(`Total buttons on page: ${totalButtons}`);

  // Try to trigger the feedback widget via keyboard shortcut or click
  // The widget might be hidden by default
  await page.keyboard.press('?'); // Common help/feedback shortcut
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/tmp/after_shortcut.png' });

  if (consoleLogs.length > 0) {
    console.log('\n=== Console Errors ===');
    consoleLogs.forEach(log => console.log(log));
  }

  if (networkErrors.length > 0) {
    console.log('\n=== Network Errors ===');
    networkErrors.forEach(err => console.log(err));
  }

  console.log('\n=== Test Complete ===');
});
