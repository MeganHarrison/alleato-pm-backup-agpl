import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./procore-budget-crawl";
const WAIT_TIME = 4000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");

// Procore credentials
const PROCORE_EMAIL = "bclymer@alleatogroup.com";
const PROCORE_PASSWORD = "Clymer926!";

// Company and Project IDs from the URL
const COMPANY_ID = "562949953443325";
const PROJECT_ID = "562949955214786";

// Base paths to try
const BASE_PATHS = [
  `https://us02.procore.com/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/budgets`,
  `https://us02.procore.com/${PROJECT_ID}/project/budgets`,
  `https://us02.procore.com/companies/${COMPANY_ID}/projects/${PROJECT_ID}/budgets`
];

// Possible view suffixes based on Procore patterns
const VIEW_PATHS = [
  { path: '', name: 'main-view', description: 'Main Budget View' },
  { path: '/details', name: 'details', description: 'Budget Details' },
  { path: '/detail', name: 'detail', description: 'Budget Detail' },
  { path: '/forecast', name: 'forecast', description: 'Budget Forecast' },
  { path: '/forecasting', name: 'forecasting', description: 'Budget Forecasting' },
  { path: '/snapshots', name: 'snapshots', description: 'Budget Snapshots' },
  { path: '/project_status_snapshots', name: 'project-status-snapshots', description: 'Project Status Snapshots' },
  { path: '/change_history', name: 'change-history', description: 'Change History' },
  { path: '/history', name: 'history', description: 'Budget History' },
  { path: '/changes', name: 'changes', description: 'Budget Changes' },
  { path: '/variance', name: 'variance', description: 'Variance Analysis' },
  { path: '/variance_analysis', name: 'variance-analysis', description: 'Variance Analysis' },
  { path: '?tab=details', name: 'details-tab', description: 'Details Tab (Query)' },
  { path: '?tab=forecast', name: 'forecast-tab', description: 'Forecast Tab (Query)' },
  { path: '?tab=snapshots', name: 'snapshots-tab', description: 'Snapshots Tab (Query)' },
  { path: '?tab=history', name: 'history-tab', description: 'History Tab (Query)' },
  { path: '#details', name: 'details-hash', description: 'Details (Hash)' },
  { path: '#forecast', name: 'forecast-hash', description: 'Forecast (Hash)' },
  { path: '#snapshots', name: 'snapshots-hash', description: 'Snapshots (Hash)' },
  { path: '#history', name: 'history-hash', description: 'History (Hash)' }
];

function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .substring(0, 150);
}

async function analyzePageStructure(page) {
  return await page.evaluate(() => {
    const components = {
      buttons: document.querySelectorAll('button').length,
      tables: document.querySelectorAll('table').length,
      tabs: document.querySelectorAll('[role="tab"], .tab').length
    };

    const tables = Array.from(document.querySelectorAll('table')).map((table, index) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = table.querySelectorAll('tbody tr').length;
      return {
        index: index + 1,
        headers,
        rows
      };
    });

    return {
      components,
      tables,
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() || null
    };
  });
}

async function tryUrl(page, url, viewName, description) {
  try {
    console.log(`\n   🔗 Trying: ${url}`);

    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000
    });

    const status = response?.status();
    console.log(`   HTTP Status: ${status}`);

    if (status === 404 || status === 403 || status === 500) {
      console.log(`   ❌ Failed (${status}) - Skipping`);
      return null;
    }

    await page.waitForTimeout(WAIT_TIME);

    // Check if we're on a valid page (not redirected to error/login)
    const currentUrl = page.url();
    const isError = await page.evaluate(() => {
      const bodyText = document.body.textContent.toLowerCase();
      return bodyText.includes('page not found') ||
             bodyText.includes('404') ||
             bodyText.includes('access denied') ||
             bodyText.includes('unauthorized');
    });

    if (isError) {
      console.log(`   ❌ Error page detected - Skipping`);
      return null;
    }

    console.log(`   ✅ Page loaded successfully`);
    console.log(`   Current URL: ${currentUrl}`);

    // Create page directory
    const pageDir = path.join(SCREENSHOT_DIR, `budget-${viewName}`);
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

    // Analyze page
    const analysis = await analyzePageStructure(page);

    // Save metadata
    const metadata = {
      viewName: `budget-${viewName}`,
      description,
      attemptedUrl: url,
      actualUrl: currentUrl,
      httpStatus: status,
      timestamp: new Date().toISOString(),
      analysis,
      screenshotPath: path.relative(OUTPUT_DIR, screenshotPath)
    };

    fs.writeFileSync(
      path.join(pageDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`   📊 Tables: ${analysis.tables.length}, Buttons: ${analysis.components.buttons}, Title: "${analysis.title}"`);
    console.log(`   ✅ Captured successfully`);

    return metadata;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  const capturedViews = [];

  try {
    console.log('🚀 Budget Direct URL Crawler');
    console.log('🔐 Logging into Procore...\n');

    // Login
    await page.goto('https://login.procore.com/');
    await page.waitForTimeout(2000);

    await page.fill('input[type="email"]', PROCORE_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.fill('input[type="password"]', PROCORE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    console.log('✅ Logged in successfully\n');
    console.log('=' .repeat(70));
    console.log('🔍 TESTING BUDGET VIEW URLs');
    console.log('=' .repeat(70));

    let successCount = 0;
    let failCount = 0;

    // Try each base path with each view path
    for (let baseIdx = 0; baseIdx < BASE_PATHS.length; baseIdx++) {
      const basePath = BASE_PATHS[baseIdx];

      console.log(`\n📂 BASE PATH ${baseIdx + 1}/${BASE_PATHS.length}: ${basePath}`);
      console.log('-'.repeat(70));

      for (let viewIdx = 0; viewIdx < VIEW_PATHS.length; viewIdx++) {
        const view = VIEW_PATHS[viewIdx];
        const fullUrl = basePath + view.path;

        console.log(`\n[${viewIdx + 1}/${VIEW_PATHS.length}] ${view.description}`);

        const result = await tryUrl(page, fullUrl, view.name, view.description);

        if (result) {
          capturedViews.push(result);
          successCount++;
        } else {
          failCount++;
        }

        // Brief pause between requests
        await page.waitForTimeout(500);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RESULTS SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Successfully captured: ${successCount} views`);
    console.log(`❌ Failed/skipped: ${failCount} attempts`);
    console.log(`📁 Total views saved: ${capturedViews.length}`);

    // Generate report
    console.log('\n📝 Generating report...');

    const report = {
      timestamp: new Date().toISOString(),
      totalAttempted: BASE_PATHS.length * VIEW_PATHS.length,
      totalCaptured: capturedViews.length,
      successRate: `${((capturedViews.length / (BASE_PATHS.length * VIEW_PATHS.length)) * 100).toFixed(1)}%`,
      views: capturedViews
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'direct-url-crawl-results.json'),
      JSON.stringify(report, null, 2)
    );

    // Generate markdown report
    let mdReport = `# Budget Direct URL Crawl Report\n\n`;
    mdReport += `**Generated:** ${new Date().toISOString()}\n\n`;
    mdReport += `## Summary\n\n`;
    mdReport += `- **Total URLs Attempted:** ${BASE_PATHS.length * VIEW_PATHS.length}\n`;
    mdReport += `- **Successfully Captured:** ${capturedViews.length}\n`;
    mdReport += `- **Success Rate:** ${report.successRate}\n\n`;
    mdReport += `## Captured Views\n\n`;
    mdReport += `| View | Description | HTTP Status | Tables | Screenshot |\n`;
    mdReport += `|------|-------------|-------------|--------|------------|\n`;

    capturedViews.forEach(view => {
      const relPath = view.screenshotPath.replace(/\\/g, '/');
      mdReport += `| ${view.viewName} | ${view.description} | ${view.httpStatus} | ${view.analysis.tables.length} | [View](../${relPath}) |\n`;
    });

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'DIRECT-URL-CRAWL-REPORT.md'),
      mdReport
    );

    console.log(`✅ JSON report saved to: ${OUTPUT_DIR}/direct-url-crawl-results.json`);
    console.log(`✅ Markdown report saved to: ${OUTPUT_DIR}/DIRECT-URL-CRAWL-REPORT.md`);
    console.log('\n✅ Crawl complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
