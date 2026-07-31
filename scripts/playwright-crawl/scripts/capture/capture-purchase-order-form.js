import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const TARGET_URL = "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools/contracts/commitments/purchase_order_contracts/create";
const OUTPUT_DIR = "./outputs/forms";
const AUTH_FILE = "./auth.json";

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

(async () => {
  console.log("Starting capture of Commitment - Purchase Order form...");
  
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
    
    // Wait for form elements to be visible
    await page.waitForSelector('form, [class*="form"], [role="form"]', { timeout: 10000 }).catch(() => {
      console.log("No specific form selector found, continuing anyway...");
    });
    
    // Capture screenshot
    console.log("Capturing screenshot...");
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "purchase-order-form-screenshot.png"),
      fullPage: true
    });
    
    // Save DOM content
    console.log("Saving DOM content...");
    const html = await page.content();
    fs.writeFileSync(path.join(OUTPUT_DIR, "purchase-order-form.html"), html);
    
    // Try to extract form fields
    const formData = await page.evaluate(() => {
      // Find all input fields
      const inputs = document.querySelectorAll('input, textarea, select');
      const fields = Array.from(inputs).map(input => ({
        type: input.tagName.toLowerCase(),
        name: input.getAttribute('name') || input.getAttribute('id') || '',
        label: input.getAttribute('aria-label') || input.getAttribute('placeholder') || '',
        required: input.hasAttribute('required') || input.getAttribute('aria-required') === 'true',
        value: input.value || ''
      }));
      
      // Find labels
      const labels = Array.from(document.querySelectorAll('label')).map(label => ({
        text: label.textContent?.trim() || '',
        for: label.getAttribute('for') || ''
      }));
      
      return {
        fieldCount: fields.length,
        fields: fields.slice(0, 30), // First 30 fields
        labels: labels.slice(0, 20), // First 20 labels
        pageTitle: document.title,
        hasForm: document.querySelector('form') !== null,
        formCount: document.querySelectorAll('form').length
      };
    });
    
    // Save metadata
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "purchase-order-form-metadata.json"),
      JSON.stringify({
        url: TARGET_URL,
        captureDate: new Date().toISOString(),
        ...formData
      }, null, 2)
    );
    
    console.log("\n✅ Capture successful!");
    console.log(`📁 Files saved to: ${OUTPUT_DIR}/`);
    console.log(`   - purchase-order-form.html (DOM content)`);
    console.log(`   - purchase-order-form-screenshot.png`);
    console.log(`   - purchase-order-form-metadata.json`);
    console.log(`\n📊 Form data:`, formData);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    
    // Check if we're on login page
    const currentUrl = page.url();
    if (currentUrl.includes("login")) {
      console.log("\n⚠️  Auth token may have expired. Please run:");
      console.log("  npx playwright codegen us02.procore.com --save-storage=auth.json");
      console.log("  Then run this script again.");
    }
    
    // Take error screenshot
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "error-screenshot.png")
    });
  }
  
  await browser.close();
})();