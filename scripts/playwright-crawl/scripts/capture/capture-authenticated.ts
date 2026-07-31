/**
 * Procore Authenticated Screenshot Capture
 * 
 * This script captures screenshots from an authenticated Procore session.
 * It uses Playwright's persistent context to reuse your login session.
 * 
 * SETUP:
 * 1. Run: npx playwright install chromium
 * 2. Run: npx playwright codegen app.procore.com --save-storage=auth.json
 *    (This opens a browser - log into Procore manually, then close)
 * 3. Run: npx playwright test capture-authenticated.ts
 */

import { test, chromium, Page, Browser, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = './procore-app-screenshots';
const AUTH_FILE = './auth.json';

// Procore app navigation structure
// These are the main sections visible in the left sidebar
const PROCORE_APP_SECTIONS = {
  // Company Level
  companyLevel: [
    { name: 'portfolio', path: '/portfolio' },
    { name: 'company-directory', path: '/company/directory' },
    { name: 'company-admin', path: '/company/admin' },
    { name: 'reports', path: '/company/reports' },
  ],
  
  // Project Level - These need a project ID
  // Replace {PROJECT_ID} with an actual project ID from your account
  projectLevel: [
    // Home & Overview
    { name: 'project-home', path: '/projects/{PROJECT_ID}/project/home' },
    
    // Core Tools
    { name: 'daily-log', path: '/projects/{PROJECT_ID}/project/daily_log' },
    { name: 'directory', path: '/projects/{PROJECT_ID}/project/directory' },
    { name: 'documents', path: '/projects/{PROJECT_ID}/project/documents' },
    { name: 'drawings', path: '/projects/{PROJECT_ID}/project/drawings' },
    { name: 'emails', path: '/projects/{PROJECT_ID}/project/emails' },
    { name: 'meetings', path: '/projects/{PROJECT_ID}/project/meetings' },
    { name: 'photos', path: '/projects/{PROJECT_ID}/project/photos' },
    { name: 'schedule', path: '/projects/{PROJECT_ID}/project/schedule' },
    { name: 'specifications', path: '/projects/{PROJECT_ID}/project/specifications' },
    { name: 'tasks', path: '/projects/{PROJECT_ID}/project/tasks' },
    
    // Quality & Safety
    { name: 'inspections', path: '/projects/{PROJECT_ID}/project/checklist/lists' },
    { name: 'incidents', path: '/projects/{PROJECT_ID}/project/incidents' },
    { name: 'observations', path: '/projects/{PROJECT_ID}/project/observations' },
    { name: 'action-plans', path: '/projects/{PROJECT_ID}/project/action_plans' },
    { name: 'punch-list', path: '/projects/{PROJECT_ID}/project/punch_list' },
    
    // Design Coordination
    { name: 'rfi', path: '/projects/{PROJECT_ID}/project/rfi' },
    { name: 'submittals', path: '/projects/{PROJECT_ID}/project/submittals' },
    { name: 'coordination-issues', path: '/projects/{PROJECT_ID}/project/coordination_issues' },
    { name: 'models', path: '/projects/{PROJECT_ID}/project/models' },
    
    // Financials
    { name: 'budget', path: '/projects/{PROJECT_ID}/project/budget' },
    { name: 'budget-forecasting', path: '/projects/{PROJECT_ID}/project/budget/forecasting' },
    { name: 'change-events', path: '/projects/{PROJECT_ID}/project/change_events' },
    { name: 'change-orders-owner', path: '/projects/{PROJECT_ID}/project/change_orders/potential_change_orders' },
    { name: 'change-orders-commitment', path: '/projects/{PROJECT_ID}/project/commitments/change_orders' },
    { name: 'commitments', path: '/projects/{PROJECT_ID}/project/commitments' },
    { name: 'direct-costs', path: '/projects/{PROJECT_ID}/project/direct_costs' },
    { name: 'invoicing', path: '/projects/{PROJECT_ID}/project/invoicing' },
    { name: 'prime-contract', path: '/projects/{PROJECT_ID}/project/prime_contract' },
    
    // Bidding
    { name: 'bidding', path: '/projects/{PROJECT_ID}/project/bidding' },
  ],
};

interface CaptureResult {
  section: string;
  name: string;
  url: string;
  screenshotPath: string;
  viewportScreenshot: string;
  timestamp: string;
}

async function setupDirectories(): Promise<void> {
  const dirs = [
    OUTPUT_DIR,
    path.join(OUTPUT_DIR, 'fullpage'),
    path.join(OUTPUT_DIR, 'viewport'),
    path.join(OUTPUT_DIR, 'components'),
    path.join(OUTPUT_DIR, 'modals'),
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

async function capturePageScreenshots(
  page: Page, 
  name: string, 
  section: string
): Promise<{ fullPage: string; viewport: string }> {
  
  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Hide any onboarding modals or tooltips
  await page.evaluate(() => {
    const hideSelectors = [
      '[class*="onboarding"]',
      '[class*="tooltip"]',
      '[class*="tour"]',
      '[class*="walkthrough"]',
      '.intercom-lightweight-app',
      '[data-testid="modal-backdrop"]',
    ];
    hideSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    });
  });
  
  // Capture full page
  const fullPagePath = path.join(OUTPUT_DIR, 'fullpage', `${section}-${name}.png`);
  await page.screenshot({
    path: fullPagePath,
    fullPage: true,
  });
  
  // Capture viewport only (what user sees without scrolling)
  const viewportPath = path.join(OUTPUT_DIR, 'viewport', `${section}-${name}.png`);
  await page.screenshot({
    path: viewportPath,
    fullPage: false,
  });
  
  console.log(`  ✓ Captured: ${name}`);
  
  return { fullPage: fullPagePath, viewport: viewportPath };
}

async function captureUIComponents(page: Page, name: string): Promise<void> {
  const componentsDir = path.join(OUTPUT_DIR, 'components');
  
  // Common Procore UI component selectors
  const components = [
    { selector: '[class*="sidebar"]', name: 'sidebar' },
    { selector: '[class*="header"]', name: 'header' },
    { selector: '[class*="toolbar"]', name: 'toolbar' },
    { selector: '[class*="table"]', name: 'table' },
    { selector: '[class*="card"]', name: 'card' },
    { selector: '[class*="form"]', name: 'form' },
    { selector: '[class*="filter"]', name: 'filter' },
    { selector: '[class*="action-bar"]', name: 'action-bar' },
  ];
  
  for (const component of components) {
    try {
      const element = await page.$(component.selector);
      if (element) {
        await element.screenshot({
          path: path.join(componentsDir, `${name}-${component.name}.png`),
        });
      }
    } catch (e) {
      // Component not found, skip
    }
  }
}

async function captureModals(page: Page, name: string): Promise<void> {
  const modalsDir = path.join(OUTPUT_DIR, 'modals');
  
  // List of buttons that typically open modals
  const modalTriggers = [
    { buttonText: 'Create', modalName: 'create-modal' },
    { buttonText: 'Add', modalName: 'add-modal' },
    { buttonText: 'New', modalName: 'new-modal' },
    { buttonText: 'Edit', modalName: 'edit-modal' },
    { buttonText: 'Settings', modalName: 'settings-modal' },
    { buttonText: 'Configure', modalName: 'configure-modal' },
    { buttonText: 'Filter', modalName: 'filter-modal' },
    { buttonText: 'Export', modalName: 'export-modal' },
  ];
  
  for (const trigger of modalTriggers) {
    try {
      // Find and click button
      const button = await page.getByRole('button', { name: trigger.buttonText }).first();
      if (button && await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(500);
        
        // Check if modal appeared
        const modal = await page.$('[role="dialog"], [class*="modal"]');
        if (modal) {
          await modal.screenshot({
            path: path.join(modalsDir, `${name}-${trigger.modalName}.png`),
          });
          
          // Close modal
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }
    } catch (e) {
      // Modal trigger not found or failed, skip
    }
  }
}

// Main capture test
test.describe('Procore Authenticated Capture', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  
  test.beforeAll(async () => {
    await setupDirectories();
    
    // Check for auth file
    if (!fs.existsSync(AUTH_FILE)) {
      console.error(`
        ❌ Authentication file not found!
        
        To set up authentication:
        1. Run: npx playwright codegen app.procore.com --save-storage=auth.json
        2. Log into Procore in the browser window that opens
        3. Close the browser when done
        4. Re-run this test
      `);
      throw new Error('Authentication required');
    }
    
    browser = await chromium.launch({ headless: false }); // Set to true for faster capture
    context = await browser.newContext({
      storageState: AUTH_FILE,
      viewport: { width: 1920, height: 1080 }, // Full HD for best screenshots
    });
    page = await context.newPage();
  });
  
  test.afterAll(async () => {
    await context.close();
    await browser.close();
  });
  
  test('Capture Company Level Pages', async () => {
    const results: CaptureResult[] = [];
    
    for (const section of PROCORE_APP_SECTIONS.companyLevel) {
      try {
        const url = `https://app.procore.com${section.path}`;
        console.log(`→ Navigating to: ${section.name}`);
        
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        const screenshots = await capturePageScreenshots(page, section.name, 'company');
        
        results.push({
          section: 'company',
          name: section.name,
          url,
          screenshotPath: screenshots.fullPage,
          viewportScreenshot: screenshots.viewport,
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        console.error(`  ✗ Error: ${error}`);
      }
    }
    
    // Save results
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'company-manifest.json'),
      JSON.stringify(results, null, 2)
    );
  });
  
  test('Capture Project Level Pages', async () => {
    // First, get a list of projects
    await page.goto('https://app.procore.com/portfolio', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Capture portfolio view
    await capturePageScreenshots(page, 'portfolio-list', 'portfolio');
    
    // Try to find first project link
    const projectLinks = await page.$$eval('a[href*="/projects/"]', links => 
      links.map(a => {
        const href = (a as HTMLAnchorElement).href;
        const match = href.match(/\/projects\/(\d+)/);
        return match ? match[1] : null;
      }).filter(Boolean)
    );
    
    if (projectLinks.length === 0) {
      console.log('No projects found. Create a test project in Procore first.');
      return;
    }
    
    const projectId = projectLinks[0];
    console.log(`\n📁 Capturing project: ${projectId}`);
    
    const results: CaptureResult[] = [];
    
    for (const section of PROCORE_APP_SECTIONS.projectLevel) {
      try {
        const urlPath = section.path.replace('{PROJECT_ID}', projectId!);
        const url = `https://app.procore.com${urlPath}`;
        console.log(`→ ${section.name}`);
        
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        const screenshots = await capturePageScreenshots(page, section.name, 'project');
        
        // Also try to capture UI components and modals
        await captureUIComponents(page, section.name);
        // Uncomment to capture modals (slower):
        // await captureModals(page, section.name);
        
        results.push({
          section: 'project',
          name: section.name,
          url,
          screenshotPath: screenshots.fullPage,
          viewportScreenshot: screenshots.viewport,
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        console.error(`  ✗ Error: ${error}`);
      }
    }
    
    // Save results
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'project-manifest.json'),
      JSON.stringify(results, null, 2)
    );
  });
  
  test('Generate Figma Import Helper', async () => {
    // Create a simple HTML file that displays all screenshots for easy review
    const manifest = {
      company: JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'company-manifest.json'), 'utf-8') || '[]'),
      project: JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'project-manifest.json'), 'utf-8') || '[]'),
    };
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Procore Screenshots - Figma Import Helper</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; }
    .section { margin-bottom: 40px; }
    .screenshot { margin: 20px 0; border: 1px solid #ddd; padding: 10px; }
    .screenshot img { max-width: 100%; height: auto; }
    .screenshot h3 { margin: 0 0 10px 0; }
    .screenshot p { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Procore Screenshots</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  
  <h2>Company Level</h2>
  ${manifest.company.map((item: CaptureResult) => `
    <div class="screenshot">
      <h3>${item.name}</h3>
      <p>URL: ${item.url}</p>
      <img src="${item.viewportScreenshot}" alt="${item.name}" />
    </div>
  `).join('')}
  
  <h2>Project Level</h2>
  ${manifest.project.map((item: CaptureResult) => `
    <div class="screenshot">
      <h3>${item.name}</h3>
      <p>URL: ${item.url}</p>
      <img src="${item.viewportScreenshot}" alt="${item.name}" />
    </div>
  `).join('')}
</body>
</html>
    `;
    
    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html);
    console.log(`\n✅ HTML preview generated: ${path.join(OUTPUT_DIR, 'index.html')}`);
  });
});
