const { chromium } = require('@playwright/test');

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to dev login...');
  await page.goto('http://localhost:3004/dev-login?email=test@example.com&password=testpassword123');
  await page.waitForTimeout(3000);

  console.log('Navigating to meeting page...');
  await page.goto('http://localhost:3004/60/meetings/01KCF4KC2B5DD8BP8STFVTZ3TS');

  console.log('Waiting for page to load...');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  console.log('Taking full page screenshot...');
  await page.screenshot({
    path: 'tests/screenshots/transcript-AUTHENTICATED-FULL.png',
    fullPage: true
  });

  // Look for the transcript section
  console.log('Looking for transcript section...');
  const transcriptHeading = page.locator('text=Full Transcript').first();
  const isVisible = await transcriptHeading.isVisible().catch(() => false);

  console.log('Transcript heading visible:', isVisible);

  if (isVisible) {
    console.log('✅ Found transcript section!');

    // Scroll to transcript
    await transcriptHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);

    // Count paragraphs in the transcript
    const container = page.locator('text=Full Transcript').locator('..').locator('..').locator('div.border').first();
    const pCount = await container.locator('p').count();
    const strongCount = await container.locator('strong').count();

    console.log('📊 Paragraph count:', pCount);
    console.log('📊 Speaker label count (strong tags):', strongCount);

    if (pCount > 10) {
      console.log('✅ ✅ ✅ SUCCESS: Transcript has proper paragraph breaks!');
      console.log('The transcript is now properly formatted with multiple paragraphs.');
    } else {
      console.log('❌ FAILURE: Transcript still appears as one block');
      console.log('Paragraph count is too low:', pCount);
    }

    // Take close-up screenshot of transcript section
    await page.screenshot({
      path: 'tests/screenshots/transcript-FORMATTED-CLOSEUP.png',
      fullPage: false
    });

    // Get sample text
    const firstP = await container.locator('p').first().textContent();
    console.log('📝 First paragraph sample:', firstP?.substring(0, 150));

  } else {
    console.log('❌ Transcript section not found on page');
    console.log('Page title:', await page.title());
  }

  console.log('\n🔍 Keeping browser open for 15 seconds for manual inspection...');
  await page.waitForTimeout(15000);

  await browser.close();
  console.log('✅ Verification complete!');
})();
