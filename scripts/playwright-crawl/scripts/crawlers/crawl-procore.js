import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const BASE_URL = "https://us02.procore.com/562949954728542/project";
const OUTPUT_DIR = "./procore-crawl";
const USER_DATA_DIR = path.join(process.cwd(), "user-data");
const MAX_DEPTH = 4;     // prevents infinite recursion
const WAIT_TIME = 1500;  // allow content to load

// URL patterns to skip (documentation, support, etc)
const SKIP_PATTERNS = [
  /support\./i,           // support.procore.com
  /help\./i,              // help pages
  /docs\./i,              // documentation
  /learn\./i,             // learning resources
  /training/i,            // training materials
  /academy/i,             // Procore academy
  /knowledge/i,           // knowledge base
  /\/api\//i,             // API docs
  /\/documentation\//i,   // documentation paths
  /\/guides?\//i,         // guides
  /\/tutorial/i,          // tutorials
  /\/blog/i,              // blog posts
  /\/articles?\//i,       // articles
  /\/resources?\//i,      // resources
  /\/faq/i,               // FAQs
  /\.pdf$/i,              // PDF files
  /mailto:/i,             // email links
  /javascript:/i,         // javascript links
  /#$/                    // anchor-only links
];

// ============================


// Create directories
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}


// Prevent crawling the same URL twice
const visited = new Set();

function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

/**
 * Check if URL should be crawled
 */
function shouldCrawlUrl(url) {
  // Always skip if matches any skip pattern
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(url)) {
      console.log(`  Skipping (matches skip pattern): ${url}`);
      return false;
    }
  }
  
  // For relative URLs, assume they're valid Procore pages
  if (url.startsWith('/')) {
    return true;
  }
  
  // For absolute URLs, check if it's a Procore application URL
  if (url.includes('procore.com') && !url.includes('support.') && !url.includes('help.')) {
    return true;
  }
  
  console.log(`  Skipping (not a Procore app page): ${url}`);
  return false;
}


/**
 * Screenshot & HTML capture for any page or modal
 */
async function capture(page, label) {
  const safe = sanitizeFilename(label);
  const subdir = path.join(OUTPUT_DIR, safe);

  if (!fs.existsSync(subdir)) {
    fs.mkdirSync(subdir);
  }

  // Screenshot
  await page.screenshot({
    path: path.join(subdir, "screenshot.png"),
    fullPage: true
  });

  // Save DOM snapshot
  const html = await page.content();
  fs.writeFileSync(path.join(subdir, "dom.html"), html);
}


/**
 * Deep Crawl: 
 * - clicks links
 * - opens modals
 * - captures each state
 */
async function deepCrawl(page, url, depth = 0) {
  if (depth > MAX_DEPTH) return;
  if (visited.has(url)) return;
  if (!shouldCrawlUrl(url)) return;

  console.log(`Crawling: ${url}`);
  visited.add(url);

  // Handle relative URLs
  if (url.startsWith('/')) {
    url = new URL(url, page.url()).href;
  }

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(WAIT_TIME);

  await capture(page, url);

  // --- Click all tabs ---
  const tabs = page.locator("a[href*='/project']");
  const tabCount = await tabs.count();

  for (let i = 0; i < tabCount; i++) {
    try {
      const tab = tabs.nth(i);
      let tabHref = await tab.getAttribute("href");
      
      // Convert relative URLs to absolute
      if (tabHref && tabHref.startsWith('/')) {
        tabHref = new URL(tabHref, page.url()).href;
      }

      if (tabHref && !visited.has(tabHref) && shouldCrawlUrl(tabHref)) {
        console.log("  Clicking tab:", tabHref);
        await tab.click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(WAIT_TIME);

        await capture(page, `${url}_tab_${i}`);

        await deepCrawl(page, tabHref, depth + 1);

        await page.goto(url);
      }
    } catch (e) {
      console.log("Tab click failed:", e.message);
    }
  }

  // --- Click every row (opens modal dialogs) ---
  const rows = page.locator("table tr td a[href*='/project/']");
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    try {
      const row = rows.nth(i);
      let rowHref = await row.getAttribute("href");
      
      // Convert relative URLs to absolute
      if (rowHref && rowHref.startsWith('/')) {
        rowHref = new URL(rowHref, page.url()).href;
      }

      if (rowHref && !visited.has(rowHref) && shouldCrawlUrl(rowHref)) {
        console.log("  [Modal] Clicking row:", rowHref);

        await row.click();
        await page.waitForTimeout(WAIT_TIME);

        // Wait for Procore modal container
        const modal = page.locator(".ui-dialog, .modal");
        if (await modal.count() > 0) {
          await capture(page, rowHref);
        }

        // Close modal
        const closeBtn = page.locator(".ui-dialog-titlebar-close, button.close");
        if (await closeBtn.count() > 0) {
          await closeBtn.first().click();
        }

        await page.waitForTimeout(800);
      }
    } catch (e) {
      console.log("Modal click failed:", e.message);
    }
  }
}


// ============================================
// MAIN SCRIPT
// ============================================
(async () => {
  // Create user-data directory if it doesn't exist
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  // Use persistent browser context
  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    slowMo: 60,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized"
    ],
    viewport: { width: 1500, height: 900 }
  });

  const page = browser.pages()[0] || await browser.newPage();

  // Check if we need to login
  await page.goto("https://login.procore.com");
  await page.waitForTimeout(2000);

  // If we're on login page, prompt for manual login
  if (page.url().includes("login.procore.com")) {
    console.log("\n=== FIRST TIME SETUP ===");
    console.log("Please log in manually in the browser window.");
    console.log("Your session will be saved automatically.");
    console.log("Once logged in, the script will continue automatically.\n");
    
    // Wait for successful login (redirect away from login page)
    await page.waitForFunction(
      () => !window.location.href.includes('login.procore.com'),
      { timeout: 300000 } // 5 minutes to login
    );
    console.log("Login successful! Session saved.");
  } else {
    console.log("Using existing session - skipping login.");
  }

  // List of major tools to crawl
  const projectTools = [
    "home",
    "directory",
    "rfis",
    "submittals",
    "drawings",
    "schedule",
    "daily_log",
    "prime_contracts",
    "prime_contract_change_orders",
    "commitments",
    "commitment_change_orders",
    "budget",
    "photos",
    "punch_list",
    "inspections",
    "meetings",
    "correspondence",
    "forms"
  ];

  // Company-level pages
  const companyPages = [
    "/company/home/list",
    "/company/home/portfolio",
    "/company/home/thumbnail",
    "/company/home/map",
    "/company/home/executive_dashboard",
    "/company/home/health_dashboard",
    "/company/home/my_open_items",
    "/company/home/budgeting_report",
    "/company/home/project_variance_report",
    "/company/home/job_cost_summary",
    "/company/home/committed_costs"
  ];

  // Crawl project tools
  for (const tool of projectTools) {
    const url = `${BASE_URL}/${tool}`;
    await deepCrawl(page, url);
  }

  // Crawl company pages
  const companyBaseUrl = BASE_URL.replace(/\/project.*$/, '');
  for (const companyPage of companyPages) {
    const url = `${companyBaseUrl}${companyPage}`;
    await deepCrawl(page, url);
  }

  console.log("Deep crawl complete.");
  await browser.close();
})().catch(error => {
  console.error("Script failed:", error);
  process.exit(1);
});
