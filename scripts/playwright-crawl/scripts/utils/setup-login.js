import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const USER_DATA_DIR = path.join(process.cwd(), "user-data");

(async () => {
  // Create user-data directory if it doesn't exist
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  // Use persistent browser context
  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized"
    ],
    viewport: null
  });

  const page = browser.pages()[0] || await browser.newPage();

  // Go to Procore login
  await page.goto("https://login.procore.com");

  console.log("\n=== PROCORE LOGIN SETUP ===");
  console.log("1. Log in to Procore in the browser window");
  console.log("2. Complete any MFA if required");
  console.log("3. Once logged in, close the browser or press Ctrl+C");
  console.log("\nYour session will be saved for future use!");
  
  // Keep browser open
  await new Promise(() => {});
})();