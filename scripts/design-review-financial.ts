import { chromium, Browser, Page } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:3000';
const OUTPUT_DIR = '/Users/meganharrison/Documents/github/alleato-procore/design-review-output';
const AUTH_PATH = '/Users/meganharrison/Documents/github/alleato-procore/frontend/tests/.auth/user.json';

// Viewport configurations
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 }
};

interface PageReview {
  url: string;
  name: string;
  category: string;
  screenshots: {
    desktop?: string;
    tablet?: string;
    mobile?: string;
  };
  consoleErrors: string[];
  loadTime: number;
}

const FINANCIAL_PAGES = [
  // Budget pages
  { path: '/budget', name: 'Budget List', category: 'Budget' },
  { path: '/budget/setup', name: 'Budget Setup', category: 'Budget' },
  { path: '/budget/line-item/new', name: 'New Budget Line Item', category: 'Budget' },
  { path: '/budget-v2', name: 'Budget V2', category: 'Budget' },

  // Commitments
  { path: '/commitments', name: 'Commitments List', category: 'Commitments' },
  { path: '/commitments/new', name: 'New Commitment', category: 'Commitments' },

  // Prime Contracts
  { path: '/prime-contracts', name: 'Prime Contracts List', category: 'Prime Contracts' },
  { path: '/prime-contracts/new', name: 'New Prime Contract', category: 'Prime Contracts' },

  // Change Events
  { path: '/change-events', name: 'Change Events List', category: 'Change Events' },
  { path: '/change-events/new', name: 'New Change Event', category: 'Change Events' },

  // Change Orders
  { path: '/change-orders', name: 'Change Orders List', category: 'Change Orders' },
  { path: '/change-orders/new', name: 'New Change Order', category: 'Change Orders' },

  // Direct Costs
  { path: '/direct-costs', name: 'Direct Costs List', category: 'Direct Costs' },
  { path: '/direct-costs/new', name: 'New Direct Cost', category: 'Direct Costs' },

  // Invoicing
  { path: '/invoices', name: 'Invoices List', category: 'Invoicing' },
  { path: '/invoices/new', name: 'New Invoice', category: 'Invoicing' },
];

async function getProjectId(page: Page): Promise<string> {
  try {
    // Navigate to home
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000);

    // Try multiple selectors to find a project
    const selectors = [
      'a[href*="/1/"]',  // Try project ID 1
      'a[href*="/2/"]',  // Try project ID 2
      'a[href^="/"][href*="/home"]',  // Project home link
      '[data-project-id]'  // Data attribute
    ];

    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        const href = await element.getAttribute('href', { timeout: 1000 });
        if (href) {
          const match = href.match(/\/(\d+)\//);
          if (match) {
            console.log(`Found project ID: ${match[1]}`);
            return match[1];
          }
        }
      } catch (e) {
        // Try next selector
      }
    }

    // Check current URL
    const url = page.url();
    const urlMatch = url.match(/\/(\d+)\//);
    if (urlMatch) return urlMatch[1];

    console.log('Could not find project ID, using default: 1');
    return '1';
  } catch (error) {
    console.log('Error finding project ID, using default: 1');
    return '1';
  }
}

async function capturePageReview(
  page: Page,
  projectId: string,
  pageConfig: typeof FINANCIAL_PAGES[0],
  viewport: string
): Promise<Partial<PageReview>> {
  const url = `${BASE_URL}/${projectId}${pageConfig.path}`;
  const consoleErrors: string[] = [];

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const startTime = Date.now();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for page to be somewhat loaded
    await page.waitForTimeout(3000);

    const loadTime = Date.now() - startTime;

    // Take screenshot
    const screenshotPath = join(
      OUTPUT_DIR,
      `${pageConfig.category.toLowerCase().replace(/\s+/g, '-')}-${pageConfig.name.toLowerCase().replace(/\s+/g, '-')}-${viewport}.png`
    );

    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    return {
      screenshots: { [viewport]: screenshotPath },
      consoleErrors,
      loadTime
    };
  } catch (error) {
    console.error(`Error capturing ${pageConfig.name} at ${viewport}:`, error);
    return {
      screenshots: { [viewport]: 'ERROR' },
      consoleErrors: [...consoleErrors, `Navigation error: ${error}`],
      loadTime: Date.now() - startTime
    };
  }
}

async function runDesignReview() {
  // Create output directory
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: AUTH_PATH,
    viewport: VIEWPORTS.desktop
  });

  const page = await context.newPage();

  console.log('Finding project ID...');
  const projectId = await getProjectId(page);
  console.log(`Using project ID: ${projectId}`);

  const reviews: PageReview[] = [];

  for (const pageConfig of FINANCIAL_PAGES) {
    console.log(`\n=== Reviewing: ${pageConfig.name} ===`);

    const review: PageReview = {
      url: `${BASE_URL}/${projectId}${pageConfig.path}`,
      name: pageConfig.name,
      category: pageConfig.category,
      screenshots: {},
      consoleErrors: [],
      loadTime: 0
    };

    // Capture at desktop viewport
    console.log('  - Desktop viewport (1440x900)');
    await page.setViewportSize(VIEWPORTS.desktop);
    const desktopResult = await capturePageReview(page, projectId, pageConfig, 'desktop');
    Object.assign(review, desktopResult);
    review.screenshots = { ...review.screenshots, ...desktopResult.screenshots };

    // Capture at tablet viewport
    console.log('  - Tablet viewport (768x1024)');
    await page.setViewportSize(VIEWPORTS.tablet);
    const tabletResult = await capturePageReview(page, projectId, pageConfig, 'tablet');
    review.screenshots = { ...review.screenshots, ...tabletResult.screenshots };

    // Capture at mobile viewport
    console.log('  - Mobile viewport (375x667)');
    await page.setViewportSize(VIEWPORTS.mobile);
    const mobileResult = await capturePageReview(page, projectId, pageConfig, 'mobile');
    review.screenshots = { ...review.screenshots, ...mobileResult.screenshots };

    reviews.push(review);
    console.log(`  ✓ Completed (${review.loadTime}ms)`);
  }

  // Save review data
  const reportPath = join(OUTPUT_DIR, 'review-data.json');
  writeFileSync(reportPath, JSON.stringify(reviews, null, 2));
  console.log(`\n✓ Review complete! Data saved to ${reportPath}`);
  console.log(`Screenshots saved to: ${OUTPUT_DIR}`);

  await browser.close();
}

runDesignReview().catch(console.error);
