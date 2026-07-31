import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./procore-budget-crawl";
const WAIT_TIME = 3000; // Increased for tab loading
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");

// Procore credentials
const PROCORE_EMAIL = "bclymer@alleatogroup.com";
const PROCORE_PASSWORD = "Clymer926!";

// Base URL - Budget module
const BASE_URL = "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949955214786/tools/budgets";

// Target views to capture
const BUDGET_VIEWS = [
  {
    name: "budget-main-view",
    description: "Main Budget View",
    category: "budget-core",
    action: async (page) => {
      // This is the default view - just wait for load
      await page.waitForTimeout(WAIT_TIME);
    }
  },
  {
    name: "budget-details",
    description: "Budget Details Tab",
    category: "budget-tabs",
    action: async (page) => {
      // Look for "Details" tab
      const detailsSelectors = [
        'button:has-text("Details")',
        'a:has-text("Details")',
        '[role="tab"]:has-text("Details")',
        '[data-test-id*="details"]',
        '.tab:has-text("Details")'
      ];

      for (const selector of detailsSelectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            console.log(`   ✅ Found Details tab with selector: ${selector}`);
            await element.click();
            await page.waitForTimeout(WAIT_TIME);
            return true;
          }
        } catch (err) {
          console.log(`   ⚠️  Selector failed: ${selector}`);
        }
      }
      console.log(`   ❌ Could not find Details tab`);
      return false;
    }
  },
  {
    name: "budget-forecasting",
    description: "Budget Forecasting Tab",
    category: "budget-tabs",
    action: async (page) => {
      // Look for "Forecasting" or "Forecast" tab
      const forecastSelectors = [
        'button:has-text("Forecasting")',
        'button:has-text("Forecast")',
        'a:has-text("Forecasting")',
        'a:has-text("Forecast")',
        '[role="tab"]:has-text("Forecasting")',
        '[role="tab"]:has-text("Forecast")',
        '[data-test-id*="forecast"]',
        '.tab:has-text("Forecasting")',
        '.tab:has-text("Forecast")'
      ];

      for (const selector of forecastSelectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            console.log(`   ✅ Found Forecasting tab with selector: ${selector}`);
            await element.click();
            await page.waitForTimeout(WAIT_TIME);
            return true;
          }
        } catch (err) {
          console.log(`   ⚠️  Selector failed: ${selector}`);
        }
      }
      console.log(`   ❌ Could not find Forecasting tab`);
      return false;
    }
  },
  {
    name: "budget-project-status-snapshots",
    description: "Project Status Snapshots Tab",
    category: "budget-tabs",
    action: async (page) => {
      // Look for "Snapshots" or "Project Status Snapshots" tab
      const snapshotSelectors = [
        'button:has-text("Project Status Snapshots")',
        'button:has-text("Snapshots")',
        'a:has-text("Project Status Snapshots")',
        'a:has-text("Snapshots")',
        '[role="tab"]:has-text("Snapshots")',
        '[role="tab"]:has-text("Project Status")',
        '[data-test-id*="snapshot"]',
        '.tab:has-text("Snapshots")',
        '.tab:has-text("Project Status")'
      ];

      for (const selector of snapshotSelectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            console.log(`   ✅ Found Snapshots tab with selector: ${selector}`);
            await element.click();
            await page.waitForTimeout(WAIT_TIME);
            return true;
          }
        } catch (err) {
          console.log(`   ⚠️  Selector failed: ${selector}`);
        }
      }
      console.log(`   ❌ Could not find Snapshots tab`);
      return false;
    }
  },
  {
    name: "budget-change-history",
    description: "Budget Change History Tab",
    category: "budget-tabs",
    action: async (page) => {
      // Look for "Change History" or "History" tab
      const historySelectors = [
        'button:has-text("Change History")',
        'button:has-text("History")',
        'a:has-text("Change History")',
        'a:has-text("History")',
        '[role="tab"]:has-text("Change History")',
        '[role="tab"]:has-text("History")',
        '[data-test-id*="history"]',
        '[data-test-id*="change"]',
        '.tab:has-text("Change History")',
        '.tab:has-text("History")'
      ];

      for (const selector of historySelectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            console.log(`   ✅ Found Change History tab with selector: ${selector}`);
            await element.click();
            await page.waitForTimeout(WAIT_TIME);
            return true;
          }
        } catch (err) {
          console.log(`   ⚠️  Selector failed: ${selector}`);
        }
      }
      console.log(`   ❌ Could not find Change History tab`);
      return false;
    }
  },
  {
    name: "budget-financial-views-dropdown",
    description: "Financial Views Dropdown Menu",
    category: "budget-dropdowns",
    action: async (page) => {
      // Look for "Financial Views" dropdown
      const financialViewsSelectors = [
        'button:has-text("Financial Views")',
        '[data-test-id*="financial-views"]',
        '[class*="financial-views"]',
        'select:has-text("Financial Views")',
        '.dropdown:has-text("Financial Views")'
      ];

      for (const selector of financialViewsSelectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            console.log(`   ✅ Found Financial Views dropdown with selector: ${selector}`);
            await element.click();
            await page.waitForTimeout(2000);
            return true;
          }
        } catch (err) {
          console.log(`   ⚠️  Selector failed: ${selector}`);
        }
      }
      console.log(`   ❌ Could not find Financial Views dropdown`);
      return false;
    }
  },
  {
    name: "budget-export-dropdown",
    description: "Export Options Dropdown",
    category: "budget-dropdowns",
    action: async (page) => {
      // Look for "Export" button and click it
      const exportSelectors = [
        'button:has-text("Export")',
        '[data-test-id*="export"]',
        '[aria-label*="Export"]'
      ];

      for (const selector of exportSelectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            console.log(`   ✅ Found Export button with selector: ${selector}`);
            await element.click();
            await page.waitForTimeout(2000);
            return true;
          }
        } catch (err) {
          console.log(`   ⚠️  Selector failed: ${selector}`);
        }
      }
      console.log(`   ⚠️  Could not find Export dropdown (may not be present)`);
      return false;
    }
  },
  {
    name: "budget-import-dropdown",
    description: "Import Options Dropdown",
    category: "budget-dropdowns",
    action: async (page) => {
      // Look for "Import" button and click it
      const importSelectors = [
        'button:has-text("Import")',
        '[data-test-id*="import"]',
        '[aria-label*="Import"]'
      ];

      for (const selector of importSelectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            console.log(`   ✅ Found Import button with selector: ${selector}`);
            await element.click();
            await page.waitForTimeout(2000);
            return true;
          }
        } catch (err) {
          console.log(`   ⚠️  Selector failed: ${selector}`);
        }
      }
      console.log(`   ⚠️  Could not find Import dropdown (may not be present)`);
      return false;
    }
  }
];

function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .substring(0, 150);
}

// Enhanced page analysis
async function analyzePageStructure(page) {
  return await page.evaluate(() => {
    // Analyze UI components
    const components = {
      buttons: document.querySelectorAll('button, input[type="button"], input[type="submit"], .btn').length,
      forms: document.querySelectorAll('form').length,
      inputs: document.querySelectorAll('input, textarea, select').length,
      tables: document.querySelectorAll('table').length,
      modals: document.querySelectorAll('.modal, .dialog, .popup, [role="dialog"]').length,
      navigation: document.querySelectorAll('nav, .nav, .navigation, [role="navigation"]').length,
      cards: document.querySelectorAll('.card, .panel, .widget').length,
      lists: document.querySelectorAll('ul, ol').length,
      tabs: document.querySelectorAll('[role="tab"], .tab, .tabs li').length,
      dropdowns: document.querySelectorAll('select, .dropdown').length,
      icons: document.querySelectorAll('i[class*="icon"], .icon, svg').length
    };

    // Analyze tables
    const tables = Array.from(document.querySelectorAll('table')).map((table, index) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = table.querySelectorAll('tbody tr').length;
      return {
        index: index + 1,
        headers,
        rows,
        classes: table.className,
        id: table.id || null
      };
    });

    // Extract visible tabs
    const tabs = Array.from(document.querySelectorAll('[role="tab"], .tab, [class*="tab"]'))
      .filter(tab => {
        const rect = tab.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map(tab => ({
        text: tab.textContent.trim(),
        classes: tab.className,
        id: tab.id || null,
        isSelected: tab.getAttribute('aria-selected') === 'true' || tab.classList.contains('active')
      }));

    return {
      components,
      tables,
      tabs,
      title: document.title,
      h1: document.querySelector('h1')?.textContent.trim() || null
    };
  });
}

// Capture a specific view
async function captureView(page, view) {
  try {
    console.log(`\n📸 Capturing: ${view.description}`);
    console.log(`   Category: ${view.category}`);

    // Navigate back to base URL before each view
    await page.goto(BASE_URL, {
      waitUntil: "networkidle",
      timeout: 60000
    });
    await page.waitForTimeout(2000);

    // Execute the view-specific action
    const success = await view.action(page);

    if (!success && view.category === "budget-tabs") {
      console.log(`   ⚠️  Skipping ${view.name} - tab not found`);
      return null;
    }

    // Create page directory
    const pageDir = path.join(SCREENSHOT_DIR, view.name);
    if (!fs.existsSync(pageDir)) {
      fs.mkdirSync(pageDir, { recursive: true });
    }

    // Capture screenshot
    const screenshotPath = path.join(pageDir, "screenshot.png");
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      timeout: 60000
    });

    // Save DOM
    const htmlContent = await page.content();
    fs.writeFileSync(path.join(pageDir, "dom.html"), htmlContent);

    // Analyze page structure
    const analysis = await analyzePageStructure(page);

    // Save metadata
    const metadata = {
      viewName: view.name,
      description: view.description,
      category: view.category,
      baseUrl: BASE_URL,
      timestamp: new Date().toISOString(),
      analysis,
      screenshotPath: path.relative(OUTPUT_DIR, screenshotPath)
    };

    fs.writeFileSync(
      path.join(pageDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`   ✅ Captured successfully`);
    console.log(`   📊 Tables: ${analysis.tables.length}, Tabs: ${analysis.tabs.length}, Buttons: ${analysis.components.buttons}`);

    // Close any open dropdowns/modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    return metadata;
  } catch (error) {
    console.error(`   ❌ Error capturing ${view.name}:`, error.message);

    // Try to recover
    try {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } catch (e) {
      // Ignore recovery errors
    }

    return null;
  }
}

// Generate summary report
function generateSummaryReport(capturedViews) {
  console.log('\n📊 Generating summary report...');

  const successfulCaptures = capturedViews.filter(v => v !== null);
  const failedCaptures = BUDGET_VIEWS.length - successfulCaptures.length;

  let report = `# Budget Views Crawl Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total Views Targeted:** ${BUDGET_VIEWS.length}\n`;
  report += `- **Successfully Captured:** ${successfulCaptures.length}\n`;
  report += `- **Failed/Skipped:** ${failedCaptures}\n\n`;
  report += `## Captured Views\n\n`;
  report += `| View Name | Description | Category | Tables | Tabs | Screenshot |\n`;
  report += `|-----------|-------------|----------|--------|------|------------|\n`;

  successfulCaptures.forEach(view => {
    const relPath = view.screenshotPath.replace(/\\/g, '/');
    report += `| ${view.viewName} | ${view.description} | ${view.category} | ${view.analysis.tables.length} | ${view.analysis.tabs.length} | [View](../${relPath}) |\n`;
  });

  report += `\n## View Details\n\n`;

  successfulCaptures.forEach(view => {
    report += `### ${view.description}\n\n`;
    report += `- **View Name:** ${view.viewName}\n`;
    report += `- **Category:** ${view.category}\n`;
    report += `- **Timestamp:** ${view.timestamp}\n`;

    if (view.analysis.tabs.length > 0) {
      report += `- **Visible Tabs:** ${view.analysis.tabs.map(t => `"${t.text}"`).join(', ')}\n`;
    }

    if (view.analysis.tables.length > 0) {
      report += `- **Tables Found:** ${view.analysis.tables.length}\n`;
      view.analysis.tables.forEach((table, idx) => {
        report += `  - Table ${idx + 1}: ${table.headers.length} columns, ${table.rows} rows\n`;
        if (table.headers.length > 0) {
          report += `    - Headers: ${table.headers.join(', ')}\n`;
        }
      });
    }

    report += `\n`;
  });

  const reportPath = path.join(OUTPUT_DIR, "MISSING-VIEWS-CRAWL-REPORT.md");
  fs.writeFileSync(reportPath, report);
  console.log(`✅ Report saved to: ${reportPath}`);

  // Also save JSON
  const jsonPath = path.join(OUTPUT_DIR, "missing-views-crawl-data.json");
  fs.writeFileSync(jsonPath, JSON.stringify(successfulCaptures, null, 2));
  console.log(`✅ JSON data saved to: ${jsonPath}`);
}

// Main crawler
async function crawlMissingViews() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('🚀 Starting Budget Missing Views Crawl');
    console.log('🔐 Logging into Procore...');

    // Login
    await page.goto('https://login.procore.com/');
    await page.waitForTimeout(2000);

    await page.fill('input[type="email"]', PROCORE_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.fill('input[type="password"]', PROCORE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    console.log('✅ Logged in successfully');

    // Capture all views
    const capturedViews = [];

    for (let i = 0; i < BUDGET_VIEWS.length; i++) {
      const view = BUDGET_VIEWS[i];
      console.log(`\n[${i + 1}/${BUDGET_VIEWS.length}] Processing: ${view.description}`);

      const result = await captureView(page, view);
      capturedViews.push(result);

      // Brief pause between captures
      await page.waitForTimeout(1000);
    }

    // Generate summary report
    generateSummaryReport(capturedViews);

    console.log('\n✅ Crawl complete!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`📊 Successfully captured: ${capturedViews.filter(v => v !== null).length}/${BUDGET_VIEWS.length} views`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the crawler
crawlMissingViews().catch(console.error);
