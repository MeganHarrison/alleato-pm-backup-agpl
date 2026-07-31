const { chromium } = require('@playwright/test');

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to meeting page...');
  await page.goto('http://localhost:3004/60/meetings/01KCF4KC2B5DD8BP8STFVTZ3TS');

  console.log('Waiting for page to load...');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  console.log('Taking screenshot...');
  await page.screenshot({
    path: 'tests/screenshots/transcript-VERIFIED-FIX.png',
    fullPage: true
  });

  // Look for the transcript section
  console.log('Looking for transcript section...');
  const transcriptHeading = await page.locator('text=Full Transcript').first();
  const isVisible = await transcriptHeading.isVisible().catch(() => false);

  console.log('Transcript heading visible:', isVisible);

  if (isVisible) {
    // Scroll to transcript
    await transcriptHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Count paragraphs
    const container = page.locator('text=Full Transcript').locator('..').locator('..').locator('div.border').first();
    const pCount = await container.locator('p').count();
    const strongCount = await container.locator('strong').count();

    console.log('✅ Paragraph count:', pCount);
    console.log('✅ Speaker label count (strong tags):', strongCount);

    if (pCount > 10) {
      console.log('✅ SUCCESS: Transcript has proper paragraph breaks!');
    } else {
      console.log('❌ FAILURE: Transcript still appears as one block');
    }

    // Take close-up screenshot
    await page.screenshot({
      path: 'tests/screenshots/transcript-section-VERIFIED.png',
      fullPage: false
    });
  } else {
    console.log('❌ Transcript section not found');
  }

  console.log('Keeping browser open for 10 seconds for manual inspection...');
  await page.waitForTimeout(10000);

  await browser.close();
  console.log('Done!');
})();
