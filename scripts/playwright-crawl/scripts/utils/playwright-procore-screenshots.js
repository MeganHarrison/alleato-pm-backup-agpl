import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ====== CONFIG ========
const PROCORE_EMAIL = process.env.PROCORE_EMAIL;
const PROCORE_PASSWORD = process.env.PROCORE_PASSWORD;

// Starting point after login
const BASE_URL = "https://us02.procore.com/562949953443325";

// Pages to capture (add/remove as needed)
const pagesToCapture = [
  "/company/home/list",                 // Portfolio list
  "/company/home/portfolio",            // Portfolio overview
  "/company/home/thumbnail",            // Thumbnail view
  "/company/home/map",                  // Map view
  "/company/home/executive_dashboard",  // Exec dashboard
  "/company/home/health_dashboard",     // Health dashboard
  "/company/home/my_open_items",        // My items
  "/company/home/budgeting_report",     // Budget variance
  "/company/home/project_variance_report",
  "/company/home/job_cost_summary",
  "/company/home/committed_costs"
];

// Output directory
const OUTPUT_DIR = "./procore-screenshots";
// =======================

/**
 * Utility to sanitize filenames
 */
function safeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

(async () => {
  // Create output directory if needed
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false, // turn TRUE when stable
    slowMo: 70
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 }
  });

  const page = await context.newPage();

  console.log("Navigating to Procore login…");

  // Go to login page
  await page.goto("https://login.procore.com");

  // Login
  await page.fill('input[name="email"]', PROCORE_EMAIL);
  await page.fill('input[name="password"]', PROCORE_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for initial redirect to complete
  await page.waitForLoadState("networkidle");

  console.log("Logged in successfully.");

  // Loop through page list
  for (const relativeUrl of pagesToCapture) {
    const fullUrl = BASE_URL + relativeUrl;

    console.log(`Capturing: ${fullUrl}`);

    try {
      await page.goto(fullUrl, { waitUntil: "networkidle" });
      await page.waitForTimeout(2500); // give Procore time to stabilize

      const filename = safeFilename(relativeUrl) + ".png";
      const fullPath = path.join(OUTPUT_DIR, filename);

      await page.screenshot({
        path: fullPath,
        fullPage: true
      });

      console.log(`✓ Saved screenshot: ${filename}`);
    } catch (err) {
      console.error(`❌ Failed to capture ${relativeUrl}`, err);
    }
  }

  console.log("Done. Closing browser.");
  await browser.close();
})();
