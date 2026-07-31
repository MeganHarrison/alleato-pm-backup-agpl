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

// Create directories
[OUTPUT_DIR, SCREENSHOT_DIR, DOM_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Store all page information
const crawlResults = [];
const visitedUrls = new Set();

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
    
    // Extract page data
    const pageData = await page.evaluate(() => {
      return {
        title: document.title,
        tables: document.querySelectorAll('table').length,
        forms: document.querySelectorAll('form').length,
        buttons: document.querySelectorAll('button').length,
        links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
          text: a.textContent.trim(),
          href: a.href
        })).filter(l => l.text && !l.href.includes('javascript:'))
      };
    });
    
    return {
      ...pageInfo,
      ...pageData,
      status: 'success',
      screenshot: screenshotPath,
      dom: domPath
    };
    
  } catch (error) {
    console.log(`  ❌ Error capturing ${pageInfo.name}: ${error.message}`);
    return { ...pageInfo, status: 'error', error: error.message };
  }
}

async function crawlProcore() {
  console.log("🚀 Starting Fresh Procore Crawl");
  console.log("================================\n");
  
  const browser = await chromium.launch({
    headless: false,
    viewport: { width: 1920, height: 1080 }
  });
  
  // Create context with stored auth
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Start from the portfolio page with correct company ID
    const COMPANY_ID = '562949953443325';
    console.log("📍 Navigating to portfolio page...");
    await page.goto(`https://us02.procore.com/${COMPANY_ID}/company/home/list`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Check if we're authenticated
    const isAuthenticated = await page.evaluate(() => {
      return !window.location.href.includes('login') && 
             !document.body.innerText.includes('Sign In');
    });
    
    if (!isAuthenticated) {
      console.log("❌ Not authenticated. Please run 'npm run setup' first to save authentication.");
      await browser.close();
      return;
    }
    
    console.log("✅ Authenticated successfully\n");
    
    // Get all projects from portfolio
    console.log("📊 Finding all projects...");
    const projects = await page.evaluate(() => {
      // Try multiple selectors for project links
      const projectLinks = Array.from(document.querySelectorAll('a[href*="/set_project/"]'));
      const uniqueProjects = new Map();
      
      projectLinks.forEach(link => {
        const href = link.href;
        const name = link.textContent.trim();
        // Extract project ID from URL
        const match = href.match(/\/set_project\/(\d+)/);
        if (match && name && !uniqueProjects.has(match[1])) {
          uniqueProjects.set(match[1], {
            id: match[1],
            name: name,
            url: href
          });
        }
      });
      
      return Array.from(uniqueProjects.values());
    });
    
    console.log(`  Found ${projects.length} projects\n`);
    
    // Define all the main sections to capture
    const mainSections = [
      // Company Level
      { name: 'Portfolio', path: '/company/home/list' },
      { name: 'Company Admin', path: '/company/admin/info' },
      { name: 'Company Directory', path: '/company/directory/main' },
      { name: 'Company Reports', path: '/company/reports/dashboards' },
    ];
    
    // Project Level sections
    const projectSections = [
      // Core
      { name: 'Project Home', path: '/project/home' },
      { name: 'Project Directory', path: '/project/directory' },
      { name: 'Documents', path: '/project/documents' },
      { name: 'Photos', path: '/project/photos' },
      { name: 'Drawings', path: '/project/drawings' },
      { name: 'Emails', path: '/project/emails' },
      { name: 'Daily Log', path: '/project/daily_log' },
      { name: 'Schedule', path: '/project/schedule' },
      
      // Financial
      { name: 'Budget', path: '/project/budgets' },
      { name: 'Commitments', path: '/project/commitments' },
      { name: 'Prime Contracts', path: '/project/prime_contracts' },
      { name: 'Change Events', path: '/project/change_events' },
      { name: 'Invoicing', path: '/project/work_in_progress_report' },
      { name: 'Direct Costs', path: '/project/direct_costs' },
      
      // Project Management
      { name: 'RFIs', path: '/project/rfis' },
      { name: 'Submittals', path: '/project/submittals' },
      { name: 'Punch List', path: '/project/punch_list' },
      { name: 'Meetings', path: '/project/meetings' },
      { name: 'Inspections', path: '/project/inspections' },
      { name: 'Observations', path: '/project/observations' },
      { name: 'Incidents', path: '/project/incidents' },
      { name: 'Forms', path: '/project/forms' },
      { name: 'Action Plans', path: '/project/action_plans' },
      { name: 'Timesheets', path: '/project/timesheets' },
    ];
    
    // Capture main company sections
    console.log("📸 Capturing company-level pages...");
    for (const section of mainSections) {
      const url = `https://us02.procore.com/${COMPANY_ID}${section.path}`;
      if (!visitedUrls.has(url)) {
        visitedUrls.add(url);
        console.log(`  📄 ${section.name}`);
        
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
        const result = await capturePageData(page, { name: section.name, url });
        crawlResults.push(result);
      }
    }
    
    // Capture pages for specific project
    const TARGET_PROJECT_ID = '562949954728542';
    let targetProject = projects.find(p => p.id === TARGET_PROJECT_ID);
    
    // If specific project not found in list, create it manually
    if (!targetProject && TARGET_PROJECT_ID) {
      targetProject = {
        id: TARGET_PROJECT_ID,
        name: 'Target Project',
        url: `https://us02.procore.com/set_project/${TARGET_PROJECT_ID}`
      };
    }
    
    if (targetProject) {
      console.log(`\n📸 Capturing project-level pages for: ${targetProject.name} (ID: ${targetProject.id})`);
      
      // First navigate to the project
      console.log(`  Setting project context...`);
      await page.goto(targetProject.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      // Now we should be in the project context
      const projectId = targetProject.id;
      
      for (const section of projectSections) {
        const url = `https://us02.procore.com/${projectId}${section.path}`;
        if (!visitedUrls.has(url)) {
          visitedUrls.add(url);
          console.log(`  📄 ${section.name}`);
          
          await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
          const result = await capturePageData(page, { 
            name: `${targetProject.name} - ${section.name}`, 
            url,
            projectName: targetProject.name,
            section: section.name
          });
          crawlResults.push(result);
        }
      }
    }
    
    // Generate summary report
    console.log("\n📊 Generating summary report...");
    const summary = {
      totalPages: crawlResults.length,
      successful: crawlResults.filter(r => r.status === 'success').length,
      errors: crawlResults.filter(r => r.status === 'error').length,
      notFound: crawlResults.filter(r => r.status === '404').length,
      timestamp: new Date().toISOString(),
      results: crawlResults
    };
    
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'crawl-summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    // Generate markdown report
    const markdownReport = `# Procore Crawl Report
Generated: ${new Date().toLocaleString()}

## Summary
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
      path.join(REPORTS_DIR, 'crawl-report.md'),
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
crawlProcore().catch(console.error);