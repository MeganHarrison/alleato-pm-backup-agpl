import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Navigating to budget page...');
    await page.goto('http://localhost:3003/67/budget', { waitUntil: 'domcontentloaded', timeout: 10000 });

    await page.waitForTimeout(3000);

    console.log('\n=== CHECKING SCROLLBAR-HIDE CLASS ===\n');

    // Check HTML content
    const html = await page.content();
    const hasScrollbarHide = html.includes('scrollbar-hide');
    console.log(`scrollbar-hide found in HTML: ${hasScrollbarHide}`);

    if (hasScrollbarHide) {
      const matches = html.match(/scrollbar-hide/g);
      console.log(`Number of occurrences: ${matches ? matches.length : 0}`);
    }

    // Check specific elements
    const count = await page.locator('.overflow-auto.scrollbar-hide').count();
    console.log(`\nElements with both .overflow-auto AND .scrollbar-hide: ${count}`);

    // Check CSS
    const cssCheck = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule && rule.selectorText?.includes('scrollbar-hide')) {
              return { found: true, selector: rule.selectorText };
            }
          }
        } catch (e) {
          // Skip
        }
      }
      return { found: false };
    });
    console.log(`\nCSS .scrollbar-hide rule found: ${cssCheck.found}`);
    if (cssCheck.found) {
      console.log(`Selector: ${cssCheck.selector}`);
    }

    // Check overflow-auto elements
    const overflowEls = await page.locator('.overflow-auto').all();
    console.log(`\n=== OVERFLOW-AUTO ELEMENTS (${overflowEls.length} total) ===\n`);

    for (let i = 0; i < Math.min(overflowEls.length, 3); i++) {
      const classes = await overflowEls[i].getAttribute('class');
      console.log(`Element ${i + 1}: ${classes}`);
    }

    // Screenshot
    await page.screenshot({ path: 'scrollbar-check-result.png', fullPage: false });
    console.log('\nScreenshot saved to scrollbar-check-result.png');

    await page.waitForTimeout(2000);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
