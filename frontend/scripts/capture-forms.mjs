import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '../tests/screenshots/form-tests');

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const forms = [
  { name: 'login', url: 'http://localhost:3004/auth/login', description: 'Login form' },
  { name: 'signup', url: 'http://localhost:3004/auth/sign-up', description: 'Sign up form' },
  { name: 'project-home', url: 'http://localhost:3004/1/home', description: 'Project home page' },
  { name: 'budget-page', url: 'http://localhost:3004/1/budget', description: 'Budget management page' }
];

async function captureScreenshots() {
  console.log('📸 Starting form documentation...\n');
  console.log('Note: Make sure dev server is running on port 3004\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  for (const form of forms) {
    console.log(`\nCapturing: ${form.description}`);
    
    try {
      await page.goto(form.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(1000);

      const screenshotPath = path.join(SCREENSHOT_DIR, `${form.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      console.log(`✅ Saved: ${form.name}.png`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }

  await browser.close();
  console.log(`\n✅ Screenshots saved to: ${SCREENSHOT_DIR}`);
}

captureScreenshots().catch(console.error);