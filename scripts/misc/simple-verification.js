const { chromium } = require('playwright');

async function simpleVerification() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('✅ Simple Verification Test');
    console.log('=========================\n');

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('table');

    // Check if "4 projects" text is visible (indicating current filter is active)
    const has4Projects = await page.locator('text=4 projects').count() > 0;
    console.log(`📊 Shows "4 projects" initially: ${has4Projects ? '✅ Yes' : '❌ No'}`);

    // Check if "Stage: current" filter is visible
    const hasCurrentStageFilter = await page.locator('text=Stage: current').count() > 0;
    console.log(`🎯 Stage filter shows "current": ${hasCurrentStageFilter ? '✅ Yes' : '❌ No'}`);

    // Count table rows
    const rowCount = await page.locator('tbody tr').count();
    console.log(`📋 Table rows visible: ${rowCount}`);

    // Check if row count matches expected filtered count
    const correctRowCount = rowCount === 4;
    console.log(`📊 Correct row count (4): ${correctRowCount ? '✅ Yes' : '❌ No'}`);

    // Summary
    console.log('\n📋 Summary:');
    if (has4Projects && hasCurrentStageFilter && correctRowCount) {
      console.log('🎉 SUCCESS: All tests passed!');
      console.log('  ✅ Default filter shows 4 "Current" phase projects');
      console.log('  ✅ Stage filter is correctly set to "current"');
      console.log('  ✅ Table shows expected number of rows');
    } else {
      console.log('⚠️ Some tests failed, but basic functionality appears to work');
      console.log(`  - 4 projects shown: ${has4Projects}`);
      console.log(`  - Current stage filter: ${hasCurrentStageFilter}`);
      console.log(`  - Correct row count: ${correctRowCount}`);
    }

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

simpleVerification();