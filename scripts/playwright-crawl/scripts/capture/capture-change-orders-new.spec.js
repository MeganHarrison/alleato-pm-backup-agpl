const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Change Orders /new Page Documentation', () => {
  test('capture change orders new page state', async ({ page }) => {
    const screenshotDir = path.join(__dirname, 'procore-change-orders-crawl', 'current-implementation');

    // Navigate to change orders new page
    await page.goto('http://localhost:3000/67/change-orders/new');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take full page screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'change-orders-new-initial.png'),
      fullPage: true
    });

    // Get page HTML for analysis
    const html = await page.content();
    const fs = require('fs');
    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.writeFileSync(path.join(screenshotDir, 'page-dom.html'), html);

    // Extract metadata
    const metadata = {
      url: page.url(),
      title: await page.title(),
      timestamp: new Date().toISOString(),
      viewport: await page.viewportSize(),
      textContent: await page.locator('body').textContent(),
      buttons: await page.locator('button').count(),
      inputs: await page.locator('input').count(),
      cards: await page.locator('[class*="card"]').count()
    };

    fs.writeFileSync(
      path.join(screenshotDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log('✓ Captured change orders /new page');
    console.log(`  Screenshots saved to: ${screenshotDir}`);
  });

  test('capture change orders list page state', async ({ page }) => {
    const screenshotDir = path.join(__dirname, 'procore-change-orders-crawl', 'current-implementation');

    // Navigate to change orders list page
    await page.goto('http://localhost:3000/67/change-orders');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take full page screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'change-orders-list.png'),
      fullPage: true
    });

    console.log('✓ Captured change orders list page');
  });
});
