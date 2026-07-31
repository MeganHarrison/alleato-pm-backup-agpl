const { chromium } = require('@playwright/test');

(async () => {
  console.log("🔍 Finding Procore Project ID...\n");
  
  const browser = await chromium.launchPersistentContext('../user-data', {
    headless: false,
    viewport: { width: 1400, height: 900 }
  });
  
  const page = browser.pages()[0] || await browser.newPage();
  
  console.log("1. Navigate to a project in Procore");
  console.log("2. The URL will contain the project ID");
  console.log("   Example: /projects/123456789/project/home");
  console.log("3. Add to .env: PROCORE_PROJECT_ID=123456789\n");
  console.log("Keep this window open to find your project ID...");
  
  // Keep browser open
  await new Promise(() => {});
})();