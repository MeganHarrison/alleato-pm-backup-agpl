import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const TARGET_URL = "https://us02.procore.com/562949953443325/company/home/list";
const OUTPUT_DIR = "./procore-crawl";
const AUTH_FILE = "./auth.json";

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

(async () => {
  console.log("Starting capture with stored authentication...");
  
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
    console.log(`Navigating to: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });
    
    // Wait for content to load
    await page.waitForTimeout(3000);
    
    // Create output directory
    const outputSubdir = path.join(OUTPUT_DIR, "company_home_list_562949953443325");
    if (!fs.existsSync(outputSubdir)) {
      fs.mkdirSync(outputSubdir, { recursive: true });
    }
    
    // Capture screenshot
    console.log("Capturing screenshot...");
    await page.screenshot({
      path: path.join(outputSubdir, "screenshot.png"),
      fullPage: true
    });
    
    // Save DOM content
    console.log("Saving DOM content...");
    const html = await page.content();
    fs.writeFileSync(path.join(outputSubdir, "dom.html"), html);
    
    // Try to extract project list data
    const projectData = await page.evaluate(() => {
      // Try different selectors that might contain project list
      const tables = document.querySelectorAll('table');
      const rows = document.querySelectorAll('tr[data-project-id], tbody tr');
      const cards = document.querySelectorAll('.project-card, [class*="project"]');
      
      return {
        tableCount: tables.length,
        rowCount: rows.length,
        cardCount: cards.length,
        pageTitle: document.title,
        hasProjectData: rows.length > 0 || cards.length > 0
      };
    });
    
    // Save metadata
    fs.writeFileSync(
      path.join(outputSubdir, "metadata.json"),
      JSON.stringify({
        url: TARGET_URL,
        captureDate: new Date().toISOString(),
        ...projectData
      }, null, 2)
    );
    
    console.log("\n✅ Capture successful!");
    console.log(`📁 Files saved to: ${outputSubdir}/`);
    console.log(`   - dom.html (the file you need)`);
    console.log(`   - screenshot.png`);
    console.log(`   - metadata.json`);
    console.log(`\n📊 Page data:`, projectData);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    
    // Check if we're on login page
    const currentUrl = page.url();
    if (currentUrl.includes("login")) {
      console.log("\n⚠️  Auth token may have expired. Please run:");
      console.log("  npx playwright codegen us02.procore.com --save-storage=auth.json");
      console.log("  Then run this script again.");
    }
  }
  
  await browser.close();
})();