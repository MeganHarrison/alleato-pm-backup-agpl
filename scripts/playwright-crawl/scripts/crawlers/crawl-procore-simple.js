import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./procore-crawl";
const USER_DATA_DIR = path.join(process.cwd(), "user-data");
const WAIT_TIME = 2000;  // allow content to load

// Create directories
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase()
    .substring(0, 100); // Limit length
}

async function capture(page, label) {
  const safe = sanitizeFilename(label);
  const subdir = path.join(OUTPUT_DIR, safe);

  if (!fs.existsSync(subdir)) {
    fs.mkdirSync(subdir, { recursive: true });
  }

  // Screenshot
  await page.screenshot({
    path: path.join(subdir, "screenshot.png"),
    fullPage: true
  });

  // Save DOM snapshot
  const html = await page.content();
  fs.writeFileSync(path.join(subdir, "dom.html"), html);
  
  console.log(`  ✓ Captured: ${safe}`);
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
    slowMo: 100,
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
    
    // Wait for successful login
    await page.waitForFunction(
      () => !window.location.href.includes('login.procore.com'),
      { timeout: 300000 }
    );
    console.log("Login successful! Session saved.");
  } else {
    console.log("Using existing session - skipping login.");
  }

  // Navigate to a known Procore page first
  await page.goto("https://us02.procore.com");
  await page.waitForTimeout(2000);
  
  // Use the hardcoded base URL for now
  const baseUrl = "https://us02.procore.com/562949954728542";

  console.log(`\nBase URL: ${baseUrl}`);
  console.log("Starting crawl...\n");

  // Project-level pages
  const projectPages = [
    { url: `${baseUrl}/project/home`, name: "Project Home" },
    { url: `${baseUrl}/project/directory`, name: "Directory" },
    { url: `${baseUrl}/project/rfis`, name: "RFIs" },
    { url: `${baseUrl}/project/submittals`, name: "Submittals" },
    { url: `${baseUrl}/project/drawings`, name: "Drawings" },
    { url: `${baseUrl}/project/schedule`, name: "Schedule" },
    { url: `${baseUrl}/project/daily_log`, name: "Daily Log" },
    { url: `${baseUrl}/project/prime_contracts`, name: "Prime Contracts" },
    { url: `${baseUrl}/project/prime_contract_change_orders`, name: "Prime Contract Change Orders" },
    { url: `${baseUrl}/project/commitments`, name: "Commitments" },
    { url: `${baseUrl}/project/commitment_change_orders`, name: "Commitment Change Orders" },
    { url: `${baseUrl}/project/budget`, name: "Budget" },
    { url: `${baseUrl}/project/photos`, name: "Photos" },
    { url: `${baseUrl}/project/punch_list`, name: "Punch List" },
    { url: `${baseUrl}/project/inspections`, name: "Inspections" },
    { url: `${baseUrl}/project/meetings`, name: "Meetings" },
    { url: `${baseUrl}/project/correspondence`, name: "Correspondence" },
    { url: `${baseUrl}/project/forms`, name: "Forms" }
  ];

  // Company-level pages
  const companyPages = [
    { url: `${baseUrl}/company/home/list`, name: "Company - Project List" },
    { url: `${baseUrl}/company/home/portfolio`, name: "Company - Portfolio" },
    { url: `${baseUrl}/company/home/thumbnail`, name: "Company - Thumbnail View" },
    { url: `${baseUrl}/company/home/map`, name: "Company - Map View" },
    { url: `${baseUrl}/company/home/executive_dashboard`, name: "Company - Executive Dashboard" },
    { url: `${baseUrl}/company/home/health_dashboard`, name: "Company - Health Dashboard" },
    { url: `${baseUrl}/company/home/my_open_items`, name: "Company - My Open Items" },
    { url: `${baseUrl}/company/home/budgeting_report`, name: "Company - Budgeting Report" },
    { url: `${baseUrl}/company/home/project_variance_report`, name: "Company - Project Variance Report" },
    { url: `${baseUrl}/company/home/job_cost_summary`, name: "Company - Job Cost Summary" },
    { url: `${baseUrl}/company/home/committed_costs`, name: "Company - Committed Costs" }
  ];

  // Crawl all pages
  const allPages = [...projectPages, ...companyPages];
  
  for (const pageInfo of allPages) {
    try {
      console.log(`Navigating to: ${pageInfo.name}`);
      await page.goto(pageInfo.url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(WAIT_TIME);
      
      await capture(page, pageInfo.name);
      
    } catch (error) {
      console.error(`  ✗ Failed to crawl ${pageInfo.name}: ${error.message}`);
    }
  }

  console.log("\nCrawl complete!");
  await browser.close();
})().catch(error => {
  console.error("Script failed:", error);
  process.exit(1);
});