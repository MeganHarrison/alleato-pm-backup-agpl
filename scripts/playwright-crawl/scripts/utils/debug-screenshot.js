import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    bypassCSP: true
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error));

  await page.goto('http://localhost:8080?t=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('Clicking Prime Contracts tab...');
  await page.click('[data-project="prime-contracts"]');
  await page.waitForTimeout(500);

  console.log('Clicking Prime Contracts Page link...');
  await page.click('a:has-text("Prime Contracts Page")');
  await page.waitForTimeout(2000);

  const images = await page.$$eval('img', imgs => imgs.map(img => ({
    alt: img.alt,
    src: img.src,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    complete: img.complete
  })));

  console.log('Images found:', JSON.stringify(images, null, 2));

  // Check network requests for the image
  const responses = [];
  page.on('response', response => {
    if (response.url().includes('.png')) {
      responses.push({
        url: response.url(),
        status: response.status()
      });
    }
  });

  await page.screenshot({ path: '/Users/meganharrison/Documents/github/alleato-procore/scripts/screenshot-capture/debug-screenshot.png', fullPage: true });

  console.log('Screenshot saved to debug-screenshot.png');
  console.log('PNG responses:', responses);

  await page.waitForTimeout(5000);
  await browser.close();
})();
