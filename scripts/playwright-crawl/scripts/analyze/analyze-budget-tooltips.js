import { chromium } from 'playwright';

async function analyzeBudgetPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    console.log('🔐 Logging into Procore...');
    await page.goto('https://login.procore.com/');
    await page.fill('input[name="email"]', 'dexter.watkins@gmail.com');
    await page.fill('input[name="password"]', 'AlleatoGroup2025!');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    console.log('✅ Logged in successfully\n');

    // Navigate to budget page
    console.log('📊 Navigating to Budget page...');
    await page.goto('https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949955214786/tools/budgets');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Extract all column headers and their tooltips
    console.log('📋 Analyzing Budget Main Tab...\n');

    const mainTabColumns = await page.evaluate(() => {
      const headers = [];

      // Find all column headers in the AG Grid
      const headerCells = document.querySelectorAll('[role="columnheader"]');

      headerCells.forEach(cell => {
        const headerText = cell.textContent?.trim();
        const ariaLabel = cell.getAttribute('aria-label');
        const title = cell.getAttribute('title');

        // Check for tooltip elements
        const tooltipIcon = cell.querySelector('[data-testid*="tooltip"], [class*="tooltip"]');

        headers.push({
          headerText,
          ariaLabel,
          title,
          hasTooltip: !!tooltipIcon,
          isEditable: cell.querySelector('input, [contenteditable="true"]') !== null
        });
      });

      return headers;
    });

    console.log('Main Tab Columns:');
    mainTabColumns.forEach((col, i) => {
      console.log(`\n${i + 1}. ${col.headerText}`);
      console.log(`   - Aria Label: ${col.ariaLabel || 'none'}`);
      console.log(`   - Title: ${col.title || 'none'}`);
      console.log(`   - Has Tooltip: ${col.hasTooltip}`);
      console.log(`   - Is Editable: ${col.isEditable}`);
    });

    // Navigate to Details tab
    console.log('\n\n📋 Analyzing Budget Details Tab...\n');
    await page.click('a[href*="tab=details"], button:has-text("Details")');
    await page.waitForTimeout(2000);

    const detailsTabColumns = await page.evaluate(() => {
      const headers = [];
      const headerCells = document.querySelectorAll('[role="columnheader"]');

      headerCells.forEach(cell => {
        const headerText = cell.textContent?.trim();
        const ariaLabel = cell.getAttribute('aria-label');
        const title = cell.getAttribute('title');
        const tooltipIcon = cell.querySelector('[data-testid*="tooltip"], [class*="tooltip"]');

        headers.push({
          headerText,
          ariaLabel,
          title,
          hasTooltip: !!tooltipIcon,
          isEditable: cell.querySelector('input, [contenteditable="true"]') !== null
        });
      });

      return headers;
    });

    console.log('Details Tab Columns:');
    detailsTabColumns.forEach((col, i) => {
      console.log(`\n${i + 1}. ${col.headerText}`);
      console.log(`   - Aria Label: ${col.ariaLabel || 'none'}`);
      console.log(`   - Title: ${col.title || 'none'}`);
      console.log(`   - Has Tooltip: ${col.hasTooltip}`);
      console.log(`   - Is Editable: ${col.isEditable}`);
    });

    // Check for calculation formulas by hovering over calculated columns
    console.log('\n\n🔍 Checking for tooltips on calculated columns...\n');

    const calculatedColumns = ['Over/Under Budget', 'Remaining Budget', 'Variance'];

    for (const colName of calculatedColumns) {
      try {
        const header = await page.locator(`[role="columnheader"]:has-text("${colName}")`).first();
        if (await header.isVisible()) {
          await header.hover();
          await page.waitForTimeout(1000);

          const tooltip = await page.evaluate(() => {
            const tooltipEl = document.querySelector('.ag-tooltip, [role="tooltip"]');
            return tooltipEl ? tooltipEl.textContent : null;
          });

          console.log(`${colName}: ${tooltip || 'No tooltip found'}`);
        }
      } catch {
        console.log(`${colName}: Column not found`);
      }
    }

    // Check a sample row for editable cells
    console.log('\n\n✏️ Checking for editable cells in first row...\n');

    const editableCells = await page.evaluate(() => {
      const cells = [];
      const firstRow = document.querySelector('[role="row"][row-index="0"]');

      if (firstRow) {
        const cellElements = firstRow.querySelectorAll('[role="gridcell"]');
        cellElements.forEach((cell, index) => {
          const isEditable = cell.querySelector('input, [contenteditable="true"]') !== null;
          const hasEditClass = cell.className.includes('editable');

          cells.push({
            index,
            text: cell.textContent?.trim(),
            isEditable,
            hasEditClass
          });
        });
      }

      return cells;
    });

    console.log('First Row Cells:');
    editableCells.forEach((cell, i) => {
      if (cell.isEditable || cell.hasEditClass) {
        console.log(`\n${i}. ${cell.text}`);
        console.log(`   - Is Editable: ${cell.isEditable}`);
        console.log(`   - Has Edit Class: ${cell.hasEditClass}`);
      }
    });

    // Take screenshots
    await page.screenshot({
      path: 'scripts/screenshot-capture/budget-details-tab.png',
      fullPage: true
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

analyzeBudgetPage();
