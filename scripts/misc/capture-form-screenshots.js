const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '../screenshots/forms');

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const forms = [
  { name: 'login', url: 'http://localhost:3004/auth/login', description: 'Login form' },
  { name: 'signup', url: 'http://localhost:3004/auth/sign-up', description: 'Sign up form' },
  { name: 'forgot-password', url: 'http://localhost:3004/auth/forgot-password', description: 'Password reset form' },
  { name: 'project-creation', url: 'http://localhost:3004/project-form', description: 'Project creation form' },
  { name: 'budget-line-item', url: 'http://localhost:3004/1/budget/line-item/new', description: 'Budget line item form' },
  { name: 'budget-page', url: 'http://localhost:3004/1/budget', description: 'Budget management page' },
  { name: 'commitments-subcontract', url: 'http://localhost:3004/1/commitments/new?type=subcontract', description: 'Subcontract form' },
  { name: 'commitments-po', url: 'http://localhost:3004/1/commitments/new?type=purchase_order', description: 'Purchase order form' },
  { name: 'commitments-list', url: 'http://localhost:3004/1/commitments', description: 'Commitments list' },
  { name: 'project-home', url: 'http://localhost:3004/1/home', description: 'Project home page' },
  { name: 'contracts', url: 'http://localhost:3004/1/contracts', description: 'Contracts page' },
  { name: 'change-orders', url: 'http://localhost:3004/1/change-orders', description: 'Change orders page' },
  { name: 'invoices', url: 'http://localhost:3004/1/invoices', description: 'Invoices page' }
];

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('📸 Starting screenshot capture...\n');

  const results = [];

  for (const form of forms) {
    console.log(`\n📋 Capturing: ${form.description}`);
    console.log(`   URL: ${form.url}`);

    try {
      await page.goto(form.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000); // Give page time to fully render

      const screenshotPath = path.join(SCREENSHOT_DIR, `${form.name}.png`);
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });

      console.log(`   ✅ Screenshot saved: ${form.name}.png`);

      // Check for forms
      const hasForm = await page.locator('form').count() > 0;
      const inputCount = await page.locator('input, select, textarea').count();
      
      results.push({
        name: form.name,
        description: form.description,
        url: form.url,
        screenshot: `${form.name}.png`,
        hasForm,
        inputCount,
        status: 'captured'
      });

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        name: form.name,
        description: form.description,
        url: form.url,
        error: error.message,
        status: 'failed'
      });
    }
  }

  // Save results summary
  const summaryPath = path.join(SCREENSHOT_DIR, 'capture-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));

  console.log('\n\n📊 CAPTURE SUMMARY');
  console.log('==================');
  console.log(`Total forms: ${forms.length}`);
  console.log(`Successful captures: ${results.filter(r => r.status === 'captured').length}`);
  console.log(`Failed captures: ${results.filter(r => r.status === 'failed').length}`);
  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);
  console.log(`Summary saved to: capture-summary.json`);

  await browser.close();
}

// Run the capture
captureScreenshots().catch(console.error);