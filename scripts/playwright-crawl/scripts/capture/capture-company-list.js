import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// Your specific URL
const TARGET_URL = "https://us02.procore.com/562949953443325/company/home/list";
const OUTPUT_DIR = "./procore-crawl";
const USER_DATA_DIR = path.join(process.cwd(), "user-data");

// Create directories
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

(async () => {
  console.log("Starting capture for company home list view...");
  
  // Use persistent browser context to maintain login
  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    args: ["--disable-blink-features=AutomationControlled"]
  });

  const page = browser.pages()[0] || await browser.newPage();

  try {
    // Navigate directly to your URL
    console.log(`Navigating to: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 30000 });
    
    // Wait for content to fully load
    await page.waitForTimeout(3000);
    
    // Create output directory for this capture
    const outputSubdir = path.join(OUTPUT_DIR, "company_home_list_562949953443325");
    if (!fs.existsSync(outputSubdir)) {
      fs.mkdirSync(outputSubdir, { recursive: true });
    }
    
    // Capture full-page screenshot
    console.log("Capturing screenshot...");
    await page.screenshot({
      path: path.join(outputSubdir, "screenshot.png"),
      fullPage: true
    });
    
    // Save DOM content
    console.log("Saving DOM content...");
    const html = await page.content();
    fs.writeFileSync(path.join(outputSubdir, "dom.html"), html);
    
    // Extract page title and basic info
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        projectCount: document.querySelectorAll('table tbody tr').length || 
                     document.querySelectorAll('.project-card').length ||
                     document.querySelectorAll('[data-project-id]').length
      };
    });
    
    // Save metadata
    fs.writeFileSync(
      path.join(outputSubdir, "metadata.json"),
      JSON.stringify(pageInfo, null, 2)
    );
    
    console.log("\n✅ Capture successful!");
    console.log(`📁 Files saved to: ${outputSubdir}`);
    console.log(`   - screenshot.png (full page screenshot)`);
    console.log(`   - dom.html (complete DOM content)`);
    console.log(`   - metadata.json (page information)`);
    console.log(`\n📊 Page info:`, pageInfo);
    
  } catch (error) {
    console.error("❌ Capture failed:", error.message);
    
    // If we hit a login page, inform the user
    if (page.url().includes("login.procore.com")) {
      console.log("\n⚠️  You need to log in first!");
      console.log("The browser window is open - please log in manually.");
      console.log("After logging in, run this script again.");
    }
  }
  
  await browser.close();
})();