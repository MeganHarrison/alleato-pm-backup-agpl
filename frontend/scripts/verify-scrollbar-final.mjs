import { chromium } from 'playwright';

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Navigating to http://localhost:3003/67/budget...');

    // Try to navigate with a long timeout
    await page.goto('http://localhost:3003/67/budget', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    console.log('Page loaded, waiting for content...');
    await page.waitForTimeout(5000);

    // Get the page content
    const html = await page.content();

    console.log('\n=== RESULTS ===\n');

    // Check for scrollbar-hide in HTML
    const hasScrollbarHide = html.includes('scrollbar-hide');
    console.log(`scrollbar-hide in HTML: ${hasScrollbarHide}`);

    if (hasScrollbarHide) {
      const count = (html.match(/scrollbar-hide/g) || []).length;
      console.log(`Occurrences: ${count}`);
    }

    // Check for the specific div
    const divs = await page.locator('div.overflow-auto').all();
    console.log(`\nFound ${divs.length} divs with .overflow-auto`);

    for (let i = 0; i < Math.min(divs.length, 3); i++) {
      const className = await divs[i].getAttribute('class');
      const hasHide = className?.includes('scrollbar-hide');
      console.log(`Div ${i + 1}: has scrollbar-hide = ${hasHide}`);
      if (!hasHide) {
        console.log(`  Classes: ${className}`);
      }
    }

    // Take screenshot
    await page.screenshot({
      path: '/Users/meganharrison/Documents/github/alleato-procore/frontend/scrollbar-verification.png',
      fullPage: false
    });
    console.log('\nScreenshot saved: scrollbar-verification.png');

  } catch (error) {
    console.error('\nERROR:', error.message);
  } finally {
    await browser.close();
  }
})();
