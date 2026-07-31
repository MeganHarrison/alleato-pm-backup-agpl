const { test } = require('@playwright/test');

test('inspect checkbox rendering', async ({ page }) => {
  // Go to the viewer
  await page.goto('http://localhost:8080');

  // Wait for the file list to load
  await page.waitForSelector('#file-list a');

  // Click on EXECUTION-PLAN.md (or any file with checkboxes)
  const executionPlanLink = page.locator('#file-list a').filter({ hasText: /execution.*plan/i }).first();
  if (await executionPlanLink.count() > 0) {
    await executionPlanLink.click();
    await page.waitForTimeout(1000);
  }

  // Find checkboxes and inspect their HTML
  const checkboxes = await page.locator('input[type="checkbox"]').all();
  console.log(`Found ${checkboxes.length} checkboxes`);

  for (let i = 0; i < Math.min(5, checkboxes.length); i++) {
    const checkbox = checkboxes[i];
    const isChecked = await checkbox.isChecked();
    const parent = checkbox.locator('..');
    const parentHTML = await parent.innerHTML();
    console.log(`\nCheckbox ${i + 1}:`);
    console.log(`  Checked: ${isChecked}`);
    console.log(`  Parent HTML: ${parentHTML.substring(0, 200)}`);
  }

  // Get computed styles for a checked checkbox
  if (checkboxes.length > 0) {
    const firstChecked = page.locator('input[type="checkbox"]:checked').first();
    if (await firstChecked.count() > 0) {
      const styles = await firstChecked.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          accentColor: computed.accentColor,
          backgroundColor: computed.backgroundColor,
          width: computed.width,
          height: computed.height
        };
      });
      console.log('\nChecked checkbox styles:', styles);
    }
  }

  // Take a screenshot
  await page.screenshot({ path: '/tmp/checkbox-test.png', fullPage: true });
  console.log('\nScreenshot saved to /tmp/checkbox-test.png');
});
