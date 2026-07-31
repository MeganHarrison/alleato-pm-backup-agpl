const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  const screenshotDir = path.join(__dirname, 'procore-change-orders-crawl', 'current-implementation');
  fs.mkdirSync(screenshotDir, { recursive: true });

  try {
    console.log('Navigating to change orders /new page...');
    await page.goto('http://localhost:3000/67/change-orders/new', { waitUntil: 'networkidle' });

    // Take screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'change-orders-new-initial.png'),
      fullPage: true
    });

    // Get page HTML
    const html = await page.content();
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
      cards: await page.locator('[class*="card"]').count(),
      headings: {
        h1: await page.locator('h1').allTextContents(),
        h2: await page.locator('h2').allTextContents(),
        h3: await page.locator('h3').allTextContents()
      },
      allButtons: await page.locator('button').allTextContents()
    };

    fs.writeFileSync(
      path.join(screenshotDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log('✓ Captured change orders /new page');

    // Navigate to list page
    console.log('Navigating to change orders list page...');
    await page.goto('http://localhost:3000/67/change-orders', { waitUntil: 'networkidle' });

    await page.screenshot({
      path: path.join(screenshotDir, 'change-orders-list.png'),
      fullPage: true
    });

    const listHtml = await page.content();
    fs.writeFileSync(path.join(screenshotDir, 'list-page-dom.html'), listHtml);

    const listMetadata = {
      url: page.url(),
      title: await page.title(),
      timestamp: new Date().toISOString(),
      textContent: await page.locator('body').textContent(),
      buttons: await page.locator('button').count(),
      links: await page.locator('a').count(),
      headings: {
        h1: await page.locator('h1').allTextContents(),
        h2: await page.locator('h2').allTextContents()
      }
    };

    fs.writeFileSync(
      path.join(screenshotDir, 'list-metadata.json'),
      JSON.stringify(listMetadata, null, 2)
    );

    console.log('✓ Captured change orders list page');
    console.log(`\nAll screenshots saved to: ${screenshotDir}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
