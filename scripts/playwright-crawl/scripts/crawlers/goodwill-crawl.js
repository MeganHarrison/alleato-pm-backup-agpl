import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./outputs";
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screenshots");
const DOM_DIR = path.join(OUTPUT_DIR, "dom");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");
const AUTH_FILE = "./auth.json";
const WAIT_TIME = 3000;
const COMPANY_ID = '562949953443325';
const PROJECT_ID = '562949954728542';

// Create directories
[OUTPUT_DIR, SCREENSHOT_DIR, DOM_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Store all page information
const crawlResults = [];

function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .substring(0, 100);
}

async function capturePageData(page, pageInfo) {
  const sanitizedName = sanitizeFilename(pageInfo.name || pageInfo.url);
  
  try {
    // Wait for content to load
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(WAIT_TIME);
    
    // Check if it's a 404 page
    const is404 = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      const title = document.title.toLowerCase();
      return bodyText.includes('404') || bodyText.includes('not found') || 
             title.includes('404') || title.includes('not found') ||
             bodyText.includes('page not found') || bodyText.includes('error');
    });
    
    if (is404) {
      console.log(`  ⚠️  404/Error page detected: ${pageInfo.name}`);
      return { ...pageInfo, status: '404', skipped: true };
    }
    
    // Capture screenshot
    const screenshotPath = path.join(SCREENSHOT_DIR, `${sanitizedName}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    
    // Capture DOM
    const domContent = await page.content();
    const domPath = path.join(DOM_DIR, `${sanitizedName}.html`);
    fs.writeFileSync(domPath, domContent);
    
    console.log(`  ✅ Captured: ${pageInfo.name}`);
    
    return {
      ...pageInfo,
      status: 'success',
      screenshot: screenshotPath,
      dom: domPath,
      url: page.url()
    };
    
  } catch (error) {
    console.log(`  ❌ Error capturing ${pageInfo.name}: ${error.message}`);
    return { ...pageInfo, status: 'error', error: error.message };
  }
}

async function crawlGoodwillProject() {
  console.log("🚀 Starting Goodwill Bart Project Crawl");
  console.log("=====================================\n");
  
  const browser = await chromium.launch({
    headless: false,
    viewport: { width: 1920, height: 1080 }
  });
  
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Step 1: Navigate to company portfolio
    console.log("📍 Step 1: Navigating to company portfolio...");
    await page.goto(`https://us02.procore.com/${COMPANY_ID}/company/home/list`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Capture portfolio page
    const portfolioResult = await capturePageData(page, { name: "Company Portfolio" });
    crawlResults.push(portfolioResult);
    
    // Step 2: Click on Goodwill Bart project
    console.log("\n📍 Step 2: Navigating to Goodwill Bart project...");
    await page.click('a[href*="/set_project/562949954728542"]');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Capture project home
    const projectHomeResult = await capturePageData(page, { name: "Goodwill Bart - Project Home" });
    crawlResults.push(projectHomeResult);
    
    // Step 3: Capture all links on the project home page
    console.log("\n📍 Step 3: Capturing project home page links...");
    
    // Get all navigation links from the page
    const homePageLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/project/"]'));
      return links.map(link => ({
        text: link.textContent.trim(),
        href: link.href
      })).filter(link => link.text && !link.href.includes('javascript:'));
    });
    
    // Common project pages to capture
    const projectPages = [
      { name: 'Schedule', path: '/project/schedule' },
      { name: 'Punch List', path: '/project/punch_list' },
      { name: 'Meetings', path: '/project/meetings' },
      { name: 'Daily Log', path: '/project/daily_log' },
      { name: 'Directory', path: '/project/directory' },
      { name: 'Documents', path: '/project/documents' },
      { name: 'Photos', path: '/project/photos' },
      { name: 'Drawings', path: '/project/drawings' },
      { name: 'Forms', path: '/project/forms' },
      { name: 'Reports', path: '/project/reports' },
      { name: 'Emails', path: '/project/emails' },
      { name: 'Specifications', path: '/project/specifications' },
    ];
    
    for (const pageInfo of projectPages) {
      try {
        const url = `https://us02.procore.com/${PROJECT_ID}${pageInfo.path}`;
        console.log(`\n  📄 Navigating to ${pageInfo.name}...`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        const result = await capturePageData(page, { name: `Goodwill Bart - ${pageInfo.name}` });
        crawlResults.push(result);
      } catch (error) {
        console.log(`  ⚠️  Skipping ${pageInfo.name}: ${error.message}`);
      }
    }
    
    // Step 4: Navigate to Financial Tools via dropdown
    console.log("\n📍 Step 4: Capturing Financial Tools...");
    
    // Financial tools with their specific URLs
    const financialTools = [
      { 
        name: 'Prime Contracts', 
        url: `https://us02.procore.com/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/contracts/prime_contracts` 
      },
      { 
        name: 'Budget', 
        url: `https://us02.procore.com/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/budgets` 
      },
      { 
        name: 'Commitments', 
        url: `https://us02.procore.com/${PROJECT_ID}/project/commitments` 
      },
      { 
        name: 'Change Orders', 
        url: `https://us02.procore.com/${PROJECT_ID}/project/commitment_change_orders` 
      },
      { 
        name: 'Change Events', 
        url: `https://us02.procore.com/${PROJECT_ID}/project/change_events` 
      },
      { 
        name: 'Direct Costs', 
        url: `https://us02.procore.com/${PROJECT_ID}/project/direct_costs` 
      },
      { 
        name: 'Invoicing', 
        url: `https://us02.procore.com/${PROJECT_ID}/project/work_in_progress_report` 
      }
    ];
    
    for (const tool of financialTools) {
      try {
        console.log(`\n  💰 Navigating to ${tool.name}...`);
        await page.goto(tool.url, { waitUntil: 'networkidle', timeout: 60000 });
        const result = await capturePageData(page, { name: `Goodwill Bart - ${tool.name}` });
        crawlResults.push(result);
      } catch (error) {
        console.log(`  ⚠️  Skipping ${tool.name}: ${error.message}`);
      }
    }
    
    // Step 5: Capture Project Management Tools
    console.log("\n📍 Step 5: Capturing Project Management Tools...");
    
    const projectMgmtTools = [
      { name: 'RFIs', path: '/project/rfis' },
      { name: 'Submittals', path: '/project/submittals' },
      { name: 'Transmittals', path: '/project/transmittals' },
      { name: 'Action Plans', path: '/project/action_plans' },
      { name: 'Instructions', path: '/project/instructions' },
      { name: 'Observations', path: '/project/observations' },
      { name: 'Inspections', path: '/project/inspections' },
      { name: 'Incidents', path: '/project/incidents' },
      { name: 'Coordination Issues', path: '/project/coordination_issues' },
      { name: 'Bid Packages', path: '/project/bid_packages' },
      { name: 'Timesheets', path: '/project/timesheets' },
      { name: 'T&M Tickets', path: '/project/timecard_entries' },
    ];
    
    for (const tool of projectMgmtTools) {
      try {
        const url = `https://us02.procore.com/${PROJECT_ID}${tool.path}`;
        console.log(`\n  🔧 Navigating to ${tool.name}...`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        const result = await capturePageData(page, { name: `Goodwill Bart - ${tool.name}` });
        crawlResults.push(result);
      } catch (error) {
        console.log(`  ⚠️  Skipping ${tool.name}: ${error.message}`);
      }
    }
    
    // Generate summary report
    console.log("\n📊 Generating summary report...");
    const summary = {
      projectName: "Goodwill Bart",
      projectId: PROJECT_ID,
      totalPages: crawlResults.length,
      successful: crawlResults.filter(r => r.status === 'success').length,
      errors: crawlResults.filter(r => r.status === 'error').length,
      notFound: crawlResults.filter(r => r.status === '404').length,
      timestamp: new Date().toISOString(),
      results: crawlResults
    };
    
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'goodwill-crawl-summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    // Generate markdown report
    const markdownReport = `# Goodwill Bart Project Crawl Report
Generated: ${new Date().toLocaleString()}

## Summary
- Project: Goodwill Bart (ID: ${PROJECT_ID})
- Total Pages: ${summary.totalPages}
- Successful: ${summary.successful}
- 404/Errors: ${summary.notFound}
- Failed: ${summary.errors}

## Pages Captured

### ✅ Successful
${crawlResults.filter(r => r.status === 'success').map(r => `- ${r.name}`).join('\n')}

### ⚠️ 404/Not Found
${crawlResults.filter(r => r.status === '404').map(r => `- ${r.name}`).join('\n')}

### ❌ Errors
${crawlResults.filter(r => r.status === 'error').map(r => `- ${r.name}: ${r.error}`).join('\n')}
`;
    
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'goodwill-crawl-report.md'),
      markdownReport
    );
    
    console.log("\n✅ Crawl completed!");
    console.log(`📁 Results saved to: ${OUTPUT_DIR}`);
    console.log(`📊 Summary: ${summary.successful}/${summary.totalPages} pages captured successfully`);
    
  } catch (error) {
    console.error("❌ Crawl failed:", error);
  } finally {
    await browser.close();
  }
}

// Run the crawl
crawlGoodwillProject().catch(console.error);