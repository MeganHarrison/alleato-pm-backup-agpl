import { chromium } from '../../frontend/node_modules/.pnpm/playwright@1.58.1/node_modules/playwright/index.mjs';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const PROCORE_EMAIL = process.env.PROCORE_USER;
const PROCORE_PASSWORD = process.env.PROCORE_PASSWORD;

const AUTH_STATE_PATH = join(__dirname, '../../frontend/tests/.auth/user.json');

const pages = [
  { url: 'http://localhost:3000/67/prime-contracts', name: 'prime-contracts' },
  { url: 'http://localhost:3000/67/commitments', name: 'commitments' },
  { url: 'http://localhost:3000/67/change-orders', name: 'change-orders' },
  { url: 'http://localhost:3000/67/direct-costs', name: 'direct-costs' },
  { url: 'http://localhost:3000/67/change-events', name: 'change-events' }
];

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });

  // Try to use saved auth state if it exists
  let context;
  if (existsSync(AUTH_STATE_PATH)) {
    console.log('Using saved authentication state...');
    context = await browser.newContext({ storageState: AUTH_STATE_PATH });
  } else {
    console.log('No saved auth state found, will authenticate...');
    context = await browser.newContext();
  }

  const page = await context.newPage();

  // Set viewport to desktop size
  await page.setViewportSize({ width: 1440, height: 900 });

  // Navigate to first page to check if we need to authenticate
  console.log('Checking authentication...');
  await page.goto(pages[0].url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const currentUrl = page.url();

  // If redirected to login, authenticate
  if (currentUrl.includes('login') || currentUrl.includes('auth')) {
    console.log('Need to authenticate...');

    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="session[email]"]', { timeout: 10000 });

    // Fill email
    const emailInput = await page.locator('input[type="email"], input[name="session[email]"]').first();
    await emailInput.fill(PROCORE_EMAIL);

    // Click submit or continue
    const submitButton = await page.locator('button[type="submit"]').first();
    await submitButton.click();
    await page.waitForTimeout(2000);

    // Fill password if on separate page
    const passwordVisible = await page.locator('input[type="password"], input[name="session[password]"]').count() > 0;
    if (passwordVisible) {
      const passwordInput = await page.locator('input[type="password"], input[name="session[password]"]').first();
      await passwordInput.fill(PROCORE_PASSWORD);

      const passwordSubmit = await page.locator('button[type="submit"]').first();
      await passwordSubmit.click();
      await page.waitForTimeout(5000);
    }

    console.log('Authentication complete');
  } else {
    console.log('Already authenticated');
  }

  // Take screenshots of each page
  for (const pageInfo of pages) {
    console.log(`\nNavigating to ${pageInfo.name}...`);

    try {
      await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for page to be ready
      await page.waitForTimeout(3000);

      // Wait for main content to load
      await page.waitForSelector('main', { timeout: 10000 }).catch(() => {
        console.log('Main element not found, continuing anyway...');
      });

      const screenshotPath = `/tmp/screenshot-${pageInfo.name}.png`;
      await page.screenshot({
        path: screenshotPath,
        fullPage: false // Just capture viewport, not full page
      });

      console.log(`✓ Screenshot saved: ${screenshotPath}`);

      // Get page title
      const title = await page.title();
      console.log(`  Page title: ${title}`);

      // Check for header
      const hasHeader = await page.locator('header').count() > 0;
      console.log(`  Has header element: ${hasHeader}`);

    } catch (error) {
      console.error(`✗ Error capturing ${pageInfo.name}:`, error.message);
    }
  }

  await browser.close();
  console.log('\n✓ All screenshots captured');
}

takeScreenshots().catch(console.error);
