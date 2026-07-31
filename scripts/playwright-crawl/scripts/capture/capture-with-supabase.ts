/**
 * Procore Authenticated Screenshot Capture with Supabase Storage
 * 
 * Captures screenshots and saves metadata + images to Supabase.
 * 
 * SETUP:
 * 1. Set environment variables:
 *    export SUPABASE_URL=https://your-project.supabase.co
 *    export SUPABASE_SERVICE_KEY=your-service-role-key
 * 
 * 2. Run Supabase migration:
 *    Copy supabase/migrations/001_create_tables.sql to SQL Editor
 * 
 * 3. Create storage bucket 'procore-screenshots' in Supabase Dashboard
 * 
 * 4. Run: npx playwright test capture-with-supabase.ts
 */

import { test, chromium, Page, Browser, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import { db, Screenshot } from '../../lib/supabase';

const OUTPUT_DIR = './procore-app-screenshots';
const AUTH_FILE = './auth.json';

// Should we upload to Supabase Storage? (set to false to just save metadata)
const UPLOAD_TO_STORAGE = true;

// Determine base URL and company from environment or defaults
const PROCORE_BASE_URL = process.env.PROCORE_BASE_URL || 'https://us02.procore.com';
const COMPANY_ID = process.env.PROCORE_COMPANY_ID || '562949953443325';

// Procore app navigation structure
const PROCORE_APP_SECTIONS = {
  companyLevel: [
    { name: 'portfolio', category: 'company', path: `/${COMPANY_ID}/company/home/list` },
    { name: 'company-directory', category: 'company', path: `/${COMPANY_ID}/company/directory` },
    { name: 'company-admin', category: 'company', path: `/${COMPANY_ID}/company/admin` },
  ],
  
  projectLevel: [
    // Core Tools
    { name: 'project-home', category: 'project_management', path: '/{PROJECT_ID}/project/home' },
    { name: 'daily-log', category: 'project_management', path: '/{PROJECT_ID}/project/daily_log' },
    { name: 'directory', category: 'project_management', path: '/{PROJECT_ID}/project/directory' },
    { name: 'documents', category: 'project_management', path: '/{PROJECT_ID}/project/documents' },
    { name: 'drawings', category: 'project_management', path: '/{PROJECT_ID}/project/drawings' },
    { name: 'photos', category: 'project_management', path: '/{PROJECT_ID}/project/photos' },
    { name: 'schedule', category: 'project_management', path: '/{PROJECT_ID}/project/schedule' },
    
    // Quality & Safety
    { name: 'punch-list', category: 'quality_safety', path: '/{PROJECT_ID}/project/punch_list' },
    { name: 'inspections', category: 'quality_safety', path: '/{PROJECT_ID}/project/checklist/lists' },
    { name: 'observations', category: 'quality_safety', path: '/{PROJECT_ID}/project/observations' },
    { name: 'incidents', category: 'quality_safety', path: '/{PROJECT_ID}/project/incidents' },
    
    // Design Coordination
    { name: 'rfi', category: 'design_coordination', path: '/{PROJECT_ID}/project/rfi' },
    { name: 'submittals', category: 'design_coordination', path: '/{PROJECT_ID}/project/submittals' },
    { name: 'coordination-issues', category: 'design_coordination', path: '/{PROJECT_ID}/project/coordination_issues' },
    
    // Financials
    { name: 'budget', category: 'financials', path: '/{PROJECT_ID}/project/budget' },
    { name: 'change-events', category: 'financials', path: '/{PROJECT_ID}/project/change_events' },
    { name: 'commitments', category: 'financials', path: '/{PROJECT_ID}/project/commitments' },
    { name: 'invoicing', category: 'financials', path: '/{PROJECT_ID}/project/invoicing' },
  ],
};

interface CaptureResult {
  name: string;
  category: string;
  url: string;
  fullpagePath: string;
  viewportPath: string;
  pageTitle: string;
  viewportWidth: number;
  viewportHeight: number;
}

async function setupDirectories(): Promise<void> {
  const dirs = [
    OUTPUT_DIR,
    path.join(OUTPUT_DIR, 'fullpage'),
    path.join(OUTPUT_DIR, 'viewport'),
    path.join(OUTPUT_DIR, 'components'),
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
  category: string
): Promise<CaptureResult> {
  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Get page title
  const pageTitle = await page.title();
  
  // Get viewport dimensions
  const viewport = page.viewportSize() || { width: 1920, height: 1080 };
  
  // Hide any overlays
  await page.evaluate(() => {
    const hideSelectors = [
      '[class*="onboarding"]',
      '[class*="tooltip"]',
      '[class*="tour"]',
      '.intercom-lightweight-app',
    ];
    hideSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    });
  });
  
  // Capture full page
  const fullpagePath = path.join(OUTPUT_DIR, 'fullpage', `${category}-${name}.png`);
  await page.screenshot({
    path: fullpagePath,
    fullPage: true,
  });
  
  // Capture viewport only
  const viewportPath = path.join(OUTPUT_DIR, 'viewport', `${category}-${name}.png`);
  await page.screenshot({
    path: viewportPath,
    fullPage: false,
  });
  
  return {
    name,
    category,
    url: page.url(),
    fullpagePath,
    viewportPath,
    pageTitle,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  };
}

async function detectComponents(page: Page): Promise<any[]> {
  // Detect common UI components on the page
  return page.evaluate(() => {
    const components: any[] = [];
    
    const componentSelectors = {
      sidebar: '[class*="sidebar"], [class*="nav-"]',
      header: 'header, [class*="header"]',
      table: 'table, [class*="table"], [class*="grid"]',
      form: 'form, [class*="form"]',
      button: 'button, [class*="btn"]',
      modal: '[role="dialog"], [class*="modal"]',
      dropdown: '[class*="dropdown"], [class*="select"]',
      tabs: '[role="tablist"], [class*="tabs"]',
      card: '[class*="card"]',
      toolbar: '[class*="toolbar"], [class*="action-bar"]',
    };
    
    for (const [type, selector] of Object.entries(componentSelectors)) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 20) { // Filter tiny elements
          components.push({
            component_type: type,
            component_name: `${type}-${index + 1}`,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      });
    }
    
    return components.slice(0, 50); // Limit to 50 components per page
  });
}

// Main capture test with Supabase
test.describe('Procore Capture with Supabase', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let screenshotCount = 0;
  
  test.beforeAll(async () => {
    await setupDirectories();
    
    // Check Supabase connection
    const isConnected = await db.healthCheck();
    if (!isConnected) {
      console.error(`
        ❌ Cannot connect to Supabase!
        
        Make sure you have set:
        - SUPABASE_URL
        - SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY)
        
        And run the migration in supabase/migrations/001_create_tables.sql
      `);
      throw new Error('Supabase connection failed');
    }
    console.log('✅ Supabase connected');
    
    // Check for auth file
    if (!fs.existsSync(AUTH_FILE)) {
      console.error(`
        ❌ Authentication file not found!
        Run: npm run auth
      `);
      throw new Error('Authentication required');
    }
    
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext({
      storageState: AUTH_FILE,
      viewport: { width: 1920, height: 1080 },
    });
    page = await context.newPage();
    
    // Start capture session
    await db.startSession('authenticated_app', 'Automated Procore capture');
  });
  
  test.afterAll(async () => {
    // Complete session
    await db.completeSession(screenshotCount);
    
    await context.close();
    await browser.close();
  });
  
  test('Capture Company Level Pages', async () => {
    for (const section of PROCORE_APP_SECTIONS.companyLevel) {
      try {
        const url = `${PROCORE_BASE_URL}${section.path}`;
        console.log(`→ Capturing: ${section.name}`);
        
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        
        // Capture screenshots
        const result = await capturePageScreenshots(page, section.name, section.category);
        
        // Detect components
        const components = await detectComponents(page);
        
        // Save to Supabase
        if (UPLOAD_TO_STORAGE) {
          const screenshotId = await db.uploadAndSaveScreenshot(
            result.fullpagePath,
            result.viewportPath,
            {
              name: result.name,
              category: result.category,
              source_url: result.url,
              page_title: result.pageTitle,
              fullpage_path: result.fullpagePath,
              viewport_path: result.viewportPath,
              viewport_width: result.viewportWidth,
              viewport_height: result.viewportHeight,
              detected_components: components,
            }
          );
          
          // Save components
          if (components.length > 0) {
            await db.saveComponents(screenshotId, components);
          }
        } else {
          // Just save metadata
          await db.saveScreenshot({
            name: result.name,
            category: result.category,
            source_url: result.url,
            page_title: result.pageTitle,
            fullpage_path: result.fullpagePath,
            viewport_path: result.viewportPath,
            viewport_width: result.viewportWidth,
            viewport_height: result.viewportHeight,
            detected_components: components,
          });
        }
        
        screenshotCount++;
        console.log(`  ✓ Saved to Supabase (${components.length} components detected)`);
        
      } catch (error) {
        console.error(`  ✗ Error: ${error}`);
      }
    }
  });
  
  test('Capture Project Level Pages', async () => {
    // Use project ID from environment variable if provided
    let projectId = process.env.PROCORE_PROJECT_ID;
    
    if (!projectId) {
      // Try to get first project ID from portfolio
      await page.goto(`${PROCORE_BASE_URL}/${COMPANY_ID}/company/home/list`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      const projectLinks = await page.$$eval('a[href*="/projects/"]', links => 
        links.map(a => {
          const href = (a as HTMLAnchorElement).href;
          const match = href.match(/\/projects\/(\d+)/);
          return match ? match[1] : null;
        }).filter(Boolean)
      );
      
      if (projectLinks.length === 0) {
        console.log('⚠ No projects found. Skipping project-level capture.');
        return;
      }
      
      projectId = projectLinks[0];
    }
    console.log(`\n📁 Capturing project: ${projectId}`);
    
    for (const section of PROCORE_APP_SECTIONS.projectLevel) {
      try {
        const urlPath = section.path.replace('{PROJECT_ID}', projectId!);
        const url = `${PROCORE_BASE_URL}${urlPath}`;
        console.log(`→ Capturing: ${section.name}`);
        
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        
        const result = await capturePageScreenshots(page, section.name, section.category);
        const components = await detectComponents(page);
        
        // Save to Supabase
        if (UPLOAD_TO_STORAGE) {
          const screenshotId = await db.uploadAndSaveScreenshot(
            result.fullpagePath,
            result.viewportPath,
            {
              name: result.name,
              category: result.category,
              subcategory: 'project',
              source_url: result.url,
              page_title: result.pageTitle,
              fullpage_path: result.fullpagePath,
              viewport_path: result.viewportPath,
              viewport_width: result.viewportWidth,
              viewport_height: result.viewportHeight,
              detected_components: components,
            }
          );
          
          if (components.length > 0) {
            await db.saveComponents(screenshotId, components);
          }
        } else {
          await db.saveScreenshot({
            name: result.name,
            category: result.category,
            subcategory: 'project',
            source_url: result.url,
            page_title: result.pageTitle,
            fullpage_path: result.fullpagePath,
            viewport_path: result.viewportPath,
            viewport_width: result.viewportWidth,
            viewport_height: result.viewportHeight,
            detected_components: components,
          });
        }
        
        screenshotCount++;
        console.log(`  ✓ Saved to Supabase (${components.length} components detected)`);
        
      } catch (error) {
        console.error(`  ✗ Error: ${error}`);
      }
    }
  });
});

// Standalone function for manual capture
export async function captureAndSave(
  page: Page,
  name: string,
  category: string
): Promise<string> {
  const result = await capturePageScreenshots(page, name, category);
  const components = await detectComponents(page);
  
  const screenshotId = await db.uploadAndSaveScreenshot(
    result.fullpagePath,
    result.viewportPath,
    {
      name: result.name,
      category: result.category,
      source_url: result.url,
      page_title: result.pageTitle,
      fullpage_path: result.fullpagePath,
      viewport_path: result.viewportPath,
      viewport_width: result.viewportWidth,
      viewport_height: result.viewportHeight,
      detected_components: components,
    }
  );
  
  return screenshotId;
}
