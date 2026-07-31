/**
 * Procore Specifications Feature - Comprehensive Crawler
 *
 * Captures all views, dropdowns, tabs, and interactions for implementation planning.
 *
 * Generated: 2026-02-01
 * Feature: Specifications
 * App URL: https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954056757/tools/specifications/specification_sections
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '../../../.env');
dotenv.config({ path: envPath });

// Configuration
const OUTPUT_DIR = join(__dirname, '../../../docs/project-mgmt/specifications/crawl-specifications');
const START_URL = 'https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954056757/tools/specifications/specification_sections';
const PROCORE_EMAIL = process.env.PROCORE_USER || 'bclymer@alleatogroup.com';
const PROCORE_PASSWORD = process.env.PROCORE_PASSWORD;
const WAIT_TIME = 3000; // Wait for dynamic content
const maxPages = 50; // Safety limit

// State tracking
const visitedUrls = new Set();
const urlQueue = [START_URL];
const capturedPages = [];
let pageCount = 0;

// Helper: Sanitize filename
function sanitizeFilename(url) {
  return url
    .replace(/https?:\/\//, '')
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase()
    .substring(0, 100);
}

// Helper: Create directory if not exists
function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

// Helper: Extract metadata from page
async function extractMetadata(page, url) {
  return await page.evaluate(() => {
    const metadata = {
      title: document.title,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      links: [],
      clickables: [],
      dropdowns: [],
      tables: [],
      forms: [],
      buttons: [],
      tabs: [],
      stats: {
        totalLinks: 0,
        totalButtons: 0,
        totalDropdowns: 0,
        totalTables: 0,
        totalForms: 0
      }
    };

    // Extract all links
    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.href;
      const text = link.textContent.trim();
      if (text && href) {
        metadata.links.push({ href, text });
        metadata.stats.totalLinks++;
      }
    });

    // Extract clickable elements (buttons, menu items)
    document.querySelectorAll('button, [role="button"], [role="menuitem"]').forEach(el => {
      const text = el.textContent.trim();
      const classes = el.className;
      const id = el.id;
      if (text) {
        metadata.clickables.push({ text, classes, id });
        metadata.stats.totalButtons++;
      }
    });

    // Extract dropdowns and selects
    document.querySelectorAll('select, [role="combobox"], [role="listbox"]').forEach(el => {
      const label = el.getAttribute('aria-label') || el.name || el.id;
      const options = Array.from(el.querySelectorAll('option')).map(opt => opt.textContent.trim());
      metadata.dropdowns.push({ label, options: options.length > 0 ? options : ['Dropdown detected'] });
      metadata.stats.totalDropdowns++;
    });

    // Extract tables
    document.querySelectorAll('table').forEach((table, idx) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rowCount = table.querySelectorAll('tbody tr').length;
      const tableId = table.id || `table-${idx}`;
      metadata.tables.push({
        id: tableId,
        headers,
        rowCount,
        classes: table.className
      });
      metadata.stats.totalTables++;
    });

    // Extract forms
    document.querySelectorAll('form').forEach((form, idx) => {
      const inputs = Array.from(form.querySelectorAll('input, textarea, select')).map(input => ({
        type: input.type || input.tagName.toLowerCase(),
        name: input.name || input.id,
        label: input.getAttribute('aria-label') || input.placeholder
      }));
      metadata.forms.push({
        id: form.id || `form-${idx}`,
        action: form.action,
        inputs
      });
      metadata.stats.totalForms++;
    });

    // Extract tabs
    document.querySelectorAll('[role="tab"]').forEach(tab => {
      const text = tab.textContent.trim();
      const selected = tab.getAttribute('aria-selected') === 'true';
      if (text) {
        metadata.tabs.push({ text, selected });
      }
    });

    // Extract buttons
    document.querySelectorAll('button').forEach(btn => {
      const text = btn.textContent.trim();
      const type = btn.type;
      const classes = btn.className;
      if (text) {
        metadata.buttons.push({ text, type, classes });
      }
    });

    return metadata;
  });
}

// Helper: Extract links from page
async function extractLinks(page, baseUrl) {
  const links = await page.evaluate(() => {
    const allLinks = [];
    document.querySelectorAll('a[href]').forEach(link => {
      allLinks.push(link.href);
    });
    return allLinks;
  });

  // Filter to only Procore specifications URLs
  return links.filter(link => {
    return link.includes('/specifications/') &&
           !visitedUrls.has(link) &&
           !link.includes('logout') &&
           !link.includes('download') &&
           !link.includes('export');
  });
}

// Main crawl function
async function crawlPage(page, url) {
  if (visitedUrls.has(url) || pageCount >= maxPages) {
    return;
  }

  console.log(`\n📄 Crawling [${pageCount + 1}/${maxPages}]: ${url}`);
  visitedUrls.add(url);
  pageCount++;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(WAIT_TIME);

    // Create page-specific directory
    const sanitized = sanitizeFilename(url);
    const pageDir = join(OUTPUT_DIR, 'pages', sanitized);
    ensureDir(pageDir);

    // Capture screenshot
    console.log('  📸 Capturing screenshot...');
    await page.screenshot({
      path: join(pageDir, 'screenshot.png'),
      fullPage: true
    });

    // Save DOM
    console.log('  💾 Saving DOM...');
    const html = await page.content();
    writeFileSync(join(pageDir, 'dom.html'), html, 'utf-8');

    // Extract metadata
    console.log('  🔍 Extracting metadata...');
    const metadata = await extractMetadata(page, url);
    writeFileSync(join(pageDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

    capturedPages.push({
      url,
      sanitized,
      title: metadata.title,
      stats: metadata.stats,
      timestamp: metadata.timestamp
    });

    console.log(`  ✅ Captured: ${metadata.title}`);
    console.log(`     Links: ${metadata.stats.totalLinks} | Buttons: ${metadata.stats.totalButtons} | Tables: ${metadata.stats.totalTables}`);

    // Extract and queue new links
    const newLinks = await extractLinks(page, url);
    newLinks.forEach(link => {
      if (!visitedUrls.has(link) && !urlQueue.includes(link)) {
        urlQueue.push(link);
      }
    });

    // Explore dropdowns if present
    if (metadata.dropdowns.length > 0) {
      console.log(`  🔽 Found ${metadata.dropdowns.length} dropdowns, exploring...`);
      await exploreDropdowns(page, pageDir, url);
    }

    // Explore tabs if present
    if (metadata.tabs.length > 0) {
      console.log(`  📑 Found ${metadata.tabs.length} tabs, exploring...`);
      await exploreTabs(page, pageDir, url);
    }

  } catch (error) {
    console.error(`  ❌ Error crawling ${url}:`, error.message);
  }
}

// Explore dropdowns
async function exploreDropdowns(page, pageDir, baseUrl) {
  const dropdowns = await page.locator('select, [role="combobox"]').all();

  for (let i = 0; i < Math.min(dropdowns.length, 3); i++) {
    try {
      const dropdown = dropdowns[i];
      await dropdown.click();
      await page.waitForTimeout(1000);

      const screenshotPath = join(pageDir, `dropdown-${i}-expanded.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`    📸 Captured dropdown ${i + 1}`);
    } catch (error) {
      console.log(`    ⚠️  Could not capture dropdown ${i + 1}`);
    }
  }
}

// Explore tabs
async function exploreTabs(page, pageDir, baseUrl) {
  const tabs = await page.locator('[role="tab"]').all();

  for (let i = 0; i < tabs.length; i++) {
    try {
      const tab = tabs[i];
      const tabText = await tab.textContent();
      await tab.click();
      await page.waitForTimeout(2000);

      const screenshotPath = join(pageDir, `tab-${i}-${sanitizeFilename(tabText)}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`    📸 Captured tab: ${tabText.trim()}`);
    } catch (error) {
      console.log(`    ⚠️  Could not capture tab ${i + 1}`);
    }
  }
}

// Generate reports
function generateReports() {
  console.log('\n📊 Generating reports...');

  const reportsDir = join(OUTPUT_DIR, 'reports');
  ensureDir(reportsDir);

  // Sitemap table (Markdown)
  let sitemap = '# Specifications Feature - Sitemap\n\n';
  sitemap += `**Generated:** ${new Date().toISOString()}\n`;
  sitemap += `**Pages Captured:** ${capturedPages.length}\n\n`;
  sitemap += '| # | Page Title | URL | Links | Buttons | Tables |\n';
  sitemap += '|---|------------|-----|-------|---------|--------|\n';

  capturedPages.forEach((page, idx) => {
    const screenshotPath = `../pages/${page.sanitized}/screenshot.png`;
    sitemap += `| ${idx + 1} | [${page.title}](${screenshotPath}) | [Link](${page.url}) | ${page.stats.totalLinks} | ${page.stats.totalButtons} | ${page.stats.totalTables} |\n`;
  });

  writeFileSync(join(reportsDir, 'sitemap-table.md'), sitemap, 'utf-8');

  // Detailed report (JSON)
  writeFileSync(
    join(reportsDir, 'detailed-report.json'),
    JSON.stringify(capturedPages, null, 2),
    'utf-8'
  );

  console.log('✅ Reports generated');
}

// Main execution
async function main() {
  console.log('🚀 Starting Procore Specifications Comprehensive Crawler\n');
  console.log(`📁 Output Directory: ${OUTPUT_DIR}`);
  console.log(`🌐 Starting URL: ${START_URL}\n`);

  const userDataDir = join(__dirname, 'user-data');
  ensureDir(userDataDir);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    // Check authentication by navigating to start URL
    console.log('🔐 Checking authentication...');
    await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Check if we're on login page
    let currentUrl = page.url();
    if (currentUrl.includes('login.procore.com') || currentUrl.includes('id.procore.com')) {
      console.log('🔑 Logging in automatically with credentials from .env...');

      if (!PROCORE_PASSWORD) {
        console.error('❌ PROCORE_PASSWORD not found in .env file');
        await context.close();
        return;
      }

      // Fill in email
      const emailInput = await page.locator('input[name="session[email]"], input[type="email"], input#user_email').first();
      await emailInput.fill(PROCORE_EMAIL);
      await page.waitForTimeout(1000);

      // Click continue/submit for email
      const continueBtn = await page.locator('button[type="submit"], button:has-text("Continue"), button#login-btn').first();
      await continueBtn.click();
      await page.waitForTimeout(3000);

      // Check if we need to enter password on a separate page
      currentUrl = page.url();
      if (currentUrl.includes('login.procore.com') || currentUrl.includes('id.procore.com')) {
        // Fill in password
        const passwordInput = await page.locator('input[name="session[password]"], input[type="password"], input#user_password').first();
        if (await passwordInput.count() > 0) {
          await passwordInput.fill(PROCORE_PASSWORD);
          await page.waitForTimeout(1000);

          // Click submit
          const submitBtn = await page.locator('button[type="submit"], button:has-text("Log In"), button:has-text("Sign In")').first();
          await submitBtn.click();
          await page.waitForTimeout(5000);
        }
      }

      // Wait for redirect after login
      await page.waitForURL((url) => !url.includes('login.procore.com') && !url.includes('id.procore.com'), {
        timeout: 15000
      }).catch(() => console.log('⚠️  Still on login page, may need MFA'));

      // Navigate to start URL if not already there
      currentUrl = page.url();
      if (!currentUrl.includes('specification_sections')) {
        await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);
      }
    }

    console.log('✅ Authentication verified\n');

    // Start crawling
    while (urlQueue.length > 0 && pageCount < maxPages) {
      const currentUrl = urlQueue.shift();
      await crawlPage(page, currentUrl);
    }

    // Generate reports
    generateReports();

    console.log('\n✅ Crawl complete!');
    console.log(`📊 Total pages captured: ${pageCount}`);
    console.log(`📁 Output location: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await context.close();
  }
}

main();
