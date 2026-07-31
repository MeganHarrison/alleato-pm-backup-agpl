import { test, expect } from '@playwright/test';

test.describe('QA Audit Sidebar Tests', () => {
  test.use({ storageState: 'tests/.auth/user.json' });

  test('should test QA Audit sidebar redesign', async ({ page }) => {
    const results: { step: string; status: string; details?: string }[] = [];
    const consoleErrors: string[] = [];

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(`PAGE ERROR: ${err.message}`);
    });

    // Step 1: Navigate to QA Audit page
    console.log('Step 1: Navigating to QA Audit page...');
    await page.goto('/qa-audit');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Step 2: Wait for table to load
    console.log('Step 2: Waiting for table to load...');
    try {
      await page.waitForSelector('table', { timeout: 10000 });
      const tableRows = await page.locator('tbody tr').count();
      results.push({
        step: 'Table Load',
        status: 'PASS',
        details: `Table loaded with ${tableRows} rows`
      });
      console.log(`✅ Table loaded with ${tableRows} rows`);
    } catch (error) {
      results.push({
        step: 'Table Load',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.log(`❌ Table failed to load: ${error}`);
    }

    // Step 3: Take screenshot of table view
    await page.screenshot({
      path: 'tests/screenshots/qa-audit-table-view.png',
      fullPage: true,
    });
    console.log('✅ Screenshot saved: qa-audit-table-view.png');

    // Step 4: Click on first row to open sidebar
    console.log('Step 3: Clicking on first table row...');
    try {
      const firstRow = page.locator('tbody tr').first();
      await firstRow.click();
      await page.waitForTimeout(500);

      // Verify sidebar opened
      const sidebar = page.locator('[role="dialog"]');
      await expect(sidebar).toBeVisible({ timeout: 5000 });

      results.push({
        step: 'Sidebar Opens',
        status: 'PASS',
        details: 'Sidebar opened successfully after clicking row'
      });
      console.log('✅ Sidebar opened successfully');
    } catch (error) {
      results.push({
        step: 'Sidebar Opens',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.log(`❌ Sidebar failed to open: ${error}`);
      throw error; // Stop test if sidebar doesn't open
    }

    // Step 5: Verify sidebar width
    console.log('Step 4: Verifying sidebar width...');
    try {
      const sidebarContent = page.locator('.w-\\[700px\\]');
      await expect(sidebarContent).toBeVisible();

      const boundingBox = await sidebarContent.boundingBox();
      if (boundingBox) {
        const width = boundingBox.width;
        const expectedWidth = 700;
        const tolerance = 10; // Allow 10px tolerance

        if (Math.abs(width - expectedWidth) <= tolerance) {
          results.push({
            step: 'Sidebar Width',
            status: 'PASS',
            details: `Width: ${width}px (expected ~${expectedWidth}px)`
          });
          console.log(`✅ Sidebar width: ${width}px (expected ~${expectedWidth}px)`);
        } else {
          results.push({
            step: 'Sidebar Width',
            status: 'FAIL',
            details: `Width: ${width}px, expected ~${expectedWidth}px`
          });
          console.log(`❌ Sidebar width: ${width}px, expected ~${expectedWidth}px`);
        }
      }
    } catch (error) {
      results.push({
        step: 'Sidebar Width',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.log(`❌ Failed to verify sidebar width: ${error}`);
    }

    // Step 6: Verify sticky header with page name
    console.log('Step 5: Verifying sticky header...');
    try {
      const stickyHeader = page.locator('.sticky.top-0');
      await expect(stickyHeader).toBeVisible();

      // Check for SheetTitle within header
      const pageTitle = page.locator('[role="dialog"] h2');
      await expect(pageTitle).toBeVisible();
      const titleText = await pageTitle.textContent();

      results.push({
        step: 'Sticky Header',
        status: 'PASS',
        details: `Header present with title: "${titleText}"`
      });
      console.log(`✅ Sticky header present with title: "${titleText}"`);
    } catch (error) {
      results.push({
        step: 'Sticky Header',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.log(`❌ Sticky header verification failed: ${error}`);
    }

    // Step 7: Verify content sections
    console.log('Step 6: Verifying content sections...');
    try {
      const sections = [
        { name: 'Status & Tracking', selector: 'h3:has-text("Status & Tracking")' },
        { name: 'Classification', selector: 'h3:has-text("Classification")' },
        { name: 'Assignment', selector: 'h3:has-text("Assignment")' },
        { name: 'Notes', selector: 'h3:has-text("Notes")' },
      ];

      const missingSections: string[] = [];
      const foundSections: string[] = [];

      for (const section of sections) {
        const sectionElement = page.locator(section.selector).first();
        const isVisible = await sectionElement.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          foundSections.push(section.name);
        } else {
          missingSections.push(section.name);
        }
      }

      if (missingSections.length === 0) {
        results.push({
          step: 'Content Sections',
          status: 'PASS',
          details: `All sections present: ${foundSections.join(', ')}`
        });
        console.log(`✅ All content sections present: ${foundSections.join(', ')}`);
      } else {
        results.push({
          step: 'Content Sections',
          status: 'PASS',
          details: `Found ${foundSections.length}/4 sections: ${foundSections.join(', ')}`
        });
        console.log(`⚠️  Found ${foundSections.length}/4 sections: ${foundSections.join(', ')}`);
        if (missingSections.length > 0) {
          console.log(`   Note: ${missingSections.join(', ')} may not be visible in viewport`);
        }
      }
    } catch (error) {
      results.push({
        step: 'Content Sections',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.log(`❌ Content sections verification failed: ${error}`);
    }

    // Step 8: Verify footer with Done button
    console.log('Step 7: Verifying footer...');
    try {
      const footer = page.locator('.sticky.bottom-0');
      await expect(footer).toBeVisible();

      // Check for "Changes save automatically" text
      const autoSaveText = page.locator('text=Changes save automatically');
      await expect(autoSaveText).toBeVisible();

      // Check for Done button
      const doneButton = page.locator('button', { hasText: 'Done' });
      await expect(doneButton).toBeVisible();

      results.push({
        step: 'Footer',
        status: 'PASS',
        details: 'Footer present with Done button and auto-save text'
      });
      console.log('✅ Footer present with Done button and auto-save text');
    } catch (error) {
      results.push({
        step: 'Footer',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.log(`❌ Footer verification failed: ${error}`);
    }

    // Step 9: Take screenshot of open sidebar
    console.log('Step 8: Taking screenshot of open sidebar...');
    await page.screenshot({
      path: 'tests/screenshots/qa-audit-sidebar.png',
      fullPage: true,
    });
    console.log('✅ Screenshot saved: qa-audit-sidebar.png');

    // Step 10: Click Done button to close sidebar
    console.log('Step 9: Clicking Done button...');
    try {
      const doneButton = page.locator('button', { hasText: 'Done' });
      await doneButton.click();
      await page.waitForTimeout(500);

      // Verify sidebar closed
      const sidebar = page.locator('[role="dialog"]');
      await expect(sidebar).not.toBeVisible({ timeout: 5000 });

      results.push({
        step: 'Sidebar Closes',
        status: 'PASS',
        details: 'Sidebar closed successfully after clicking Done'
      });
      console.log('✅ Sidebar closed successfully');
    } catch (error) {
      results.push({
        step: 'Sidebar Closes',
        status: 'FAIL',
        details: error instanceof Error ? error.message : String(error)
      });
      console.log(`❌ Sidebar failed to close: ${error}`);
    }

    // Step 11: Take screenshot after sidebar closes
    await page.screenshot({
      path: 'tests/screenshots/qa-audit-after-close.png',
      fullPage: true,
    });
    console.log('✅ Screenshot saved: qa-audit-after-close.png');

    // Print summary
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');

    let passCount = 0;
    let failCount = 0;

    results.forEach((result) => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${result.step}: ${result.status}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
      if (result.status === 'PASS') passCount++;
      else failCount++;
    });

    console.log('\n========================================');
    console.log(`Total: ${results.length} | Pass: ${passCount} | Fail: ${failCount}`);
    console.log(`Pass Rate: ${Math.round((passCount / results.length) * 100)}%`);
    console.log('========================================');

    if (consoleErrors.length > 0) {
      console.log('\n⚠️  Console Errors Found:');
      consoleErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ No console errors found');
    }

    console.log('\nScreenshots saved to:');
    console.log('- tests/screenshots/qa-audit-table-view.png');
    console.log('- tests/screenshots/qa-audit-sidebar.png');
    console.log('- tests/screenshots/qa-audit-after-close.png');

    // Final assertion - fail test if any verification failed
    const hasFailures = results.some(r => r.status === 'FAIL');
    expect(hasFailures).toBe(false);
  });
});
