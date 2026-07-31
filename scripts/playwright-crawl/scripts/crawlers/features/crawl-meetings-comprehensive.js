import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./procore-meetings-crawl";
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Starting URL - Meetings
const START_URL = "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools/meetings/list";

// Project ID for meetings feature
const PROJECT_ID = "562949954728542";
const COMPANY_ID = "562949953443325";

// Load auth from auth.json
const AUTH_PATH = path.join(process.cwd(), "auth.json");
let authCookies = [];

try {
  const authData = JSON.parse(fs.readFileSync(AUTH_PATH, "utf-8"));
  authCookies = authData.cookies || [];
  console.log(`✅ Loaded ${authCookies.length} auth cookies from auth.json`);
} catch (err) {
  console.error("⚠️  Could not load auth.json, will try manual login");
}

// Procore credentials (fallback)
const PROCORE_EMAIL = "bclymer@alleatogroup.com";
const PROCORE_PASSWORD = "Clymer926!";

// Create directories
[OUTPUT_DIR, SCREENSHOT_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Store all page information for sitemap generation
const siteMap = [];
const visitedUrls = new Set();
const urlQueue = [];

function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .substring(0, 150);
}

function generatePageId(url, name) {
  const sanitized = sanitizeFilename(name || url);
  return sanitized || "unknown_page";
}

// Enhanced page analysis
async function analyzePageStructure(page) {
  return await page.evaluate(() => {
    // Analyze UI components
    const components = {
      buttons: document.querySelectorAll('button, input[type="button"], input[type="submit"], .btn').length,
      forms: document.querySelectorAll('form').length,
      inputs: document.querySelectorAll('input, textarea, select').length,
      tables: document.querySelectorAll('table').length,
      modals: document.querySelectorAll('.modal, .dialog, .popup, [role="dialog"]').length,
      navigation: document.querySelectorAll('nav, .nav, .navigation, [role="navigation"]').length,
      cards: document.querySelectorAll('.card, .panel, .widget').length,
      lists: document.querySelectorAll('ul, ol').length,
      tabs: document.querySelectorAll('[role="tab"], .tab, .tabs li').length,
      dropdowns: document.querySelectorAll('select, .dropdown').length,
      icons: document.querySelectorAll('i[class*="icon"], .icon, svg').length
    };

    // Analyze tables
    const tables = Array.from(document.querySelectorAll('table')).map((table, index) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = table.querySelectorAll('tbody tr').length;
      return {
        index: index + 1,
        headers,
        rows,
        classes: table.className,
        id: table.id || null
      };
    });

    // Extract form fields
    const formFields = Array.from(document.querySelectorAll('input, select, textarea')).map((field, index) => {
      return {
        index: index + 1,
        type: field.type || field.tagName.toLowerCase(),
        name: field.name || null,
        id: field.id || null,
        placeholder: field.placeholder || null,
        label: field.labels?.[0]?.textContent?.trim() || null,
        required: field.required || false
      };
    });

    return {
      components,
      tables,
      formFields,
      title: document.title,
      h1: document.querySelector('h1')?.textContent.trim() || null
    };
  });
}

// Extract all clickable elements and links
async function extractLinks(page, currentUrl) {
  return await page.evaluate((baseUrl) => {
    const links = [];
    const clickables = [];

    // Extract all anchor links
    document.querySelectorAll('a[href]').forEach((link, index) => {
      const href = link.href;
      const text = link.textContent.trim();
      const isExternal = !href.includes('procore.com');

      if (!isExternal && href !== baseUrl && !href.includes('javascript:') && !href.includes('#')) {
        links.push({
          href,
          text,
          classes: link.className,
          id: link.id || null,
          index
        });
      }
    });

    // Extract clickable buttons and elements
    document.querySelectorAll('button, [role="button"], .btn, [onclick]').forEach((el, index) => {
      const text = el.textContent.trim();
      const id = el.id || el.className;

      clickables.push({
        text,
        id,
        type: el.tagName.toLowerCase(),
        classes: el.className,
        hasDropdown: el.querySelector('[class*="dropdown"], [class*="menu"]') !== null,
        index
      });
    });

    // Extract dropdown menus and three-dot menus
    const dropdowns = [];
    document.querySelectorAll('[class*="dropdown"], [class*="menu"], [class*="more"], [aria-haspopup]').forEach((el, index) => {
      dropdowns.push({
        text: el.textContent.trim().substring(0, 50),
        classes: el.className,
        id: el.id || null,
        hasMenu: el.querySelector('ul, [role="menu"]') !== null,
        index
      });
    });

    return { links, clickables, dropdowns };
  }, currentUrl);
}

// Capture a single page with comprehensive analysis
async function capturePage(page, url, pageName, category = "meetings") {
  try {
    console.log(`\n📸 Capturing: ${pageName}`);
    console.log(`   URL: ${url}`);

    // Navigate to page
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForTimeout(WAIT_TIME);

    // Create page directory
    const pageId = generatePageId(url, pageName);
    const pageDir = path.join(SCREENSHOT_DIR, pageId);
    if (!fs.existsSync(pageDir)) {
      fs.mkdirSync(pageDir, { recursive: true });
    }

    // Capture screenshot
    const screenshotPath = path.join(pageDir, "screenshot.png");
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      timeout: 60000
    });

    // Save DOM
    const htmlContent = await page.content();
    fs.writeFileSync(path.join(pageDir, "dom.html"), htmlContent);

    // Analyze page structure
    const analysis = await analyzePageStructure(page);

    // Extract all links and clickables
    const { links, clickables, dropdowns } = await extractLinks(page, url);

    // Save metadata
    const metadata = {
      url,
      pageName,
      category,
      pageId,
      timestamp: new Date().toISOString(),
      analysis,
      links: links.length,
      linkDetails: links,
      clickables: clickables.length,
      clickableDetails: clickables,
      dropdowns: dropdowns.length,
      dropdownDetails: dropdowns,
      screenshotPath: path.relative(OUTPUT_DIR, screenshotPath)
    };

    fs.writeFileSync(
      path.join(pageDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    siteMap.push(metadata);
    console.log(`   ✅ Captured: ${links.length} links, ${clickables.length} clickables, ${dropdowns.length} dropdowns`);

    // Add new links to queue (only meetings related)
    links.forEach(link => {
      if (!visitedUrls.has(link.href) &&
          !urlQueue.includes(link.href) &&
          (link.href.includes('/meetings') ||
           link.href.includes('meeting'))) {
        urlQueue.push(link.href);
      }
    });

    return { metadata, links, clickables, dropdowns };
  } catch (error) {
    console.error(`   ❌ Error capturing ${pageName}:`, error.message);
    return null;
  }
}

// Click and capture dropdown/menu items
async function captureDropdowns(page, pageUrl, pageName) {
  console.log(`\n🎯 Looking for dropdowns and menus on: ${pageName}`);

  try {
    // Look for three-dot menus, settings, and dropdown triggers
    const dropdownSelectors = [
      '[data-test-id*="more"]',
      '[class*="more-options"]',
      '[class*="kebab"]',
      '[class*="three-dot"]',
      'button[aria-label*="more"]',
      'button[aria-label*="options"]',
      'button[aria-label*="settings"]',
      'button[aria-haspopup="menu"]',
      '[class*="dropdown-toggle"]',
      'button:has(svg[class*="dots"])',
      'button:has([class*="icon-more"])'
    ];

    for (const selector of dropdownSelectors) {
      const elements = await page.$$(selector);

      for (let i = 0; i < elements.length; i++) {
        try {
          const element = elements[i];
          const text = await element.textContent();
          const isVisible = await element.isVisible();

          if (!isVisible) continue;

          console.log(`   🔍 Found dropdown trigger: "${text?.trim() || 'unlabeled'}"`);

          // Click to open dropdown
          await element.click();
          await page.waitForTimeout(1000);

          // Capture the opened dropdown
          const dropdownPageId = generatePageId(pageUrl, `${pageName}_dropdown_${i}`);
          const dropdownDir = path.join(SCREENSHOT_DIR, dropdownPageId);
          if (!fs.existsSync(dropdownDir)) {
            fs.mkdirSync(dropdownDir, { recursive: true });
          }

          await page.screenshot({
            path: path.join(dropdownDir, "screenshot.png"),
            fullPage: true
          });

          // Extract menu items
          const menuItems = await page.evaluate(() => {
            const items = [];
            // Look for visible menu items
            const menuSelectors = [
              '[role="menu"] a',
              '[role="menu"] button',
              '.dropdown-menu a',
              '.dropdown-menu button',
              '[class*="menu-item"]',
              'ul[class*="dropdown"] a',
              'ul[class*="menu"] a'
            ];

            menuSelectors.forEach(sel => {
              document.querySelectorAll(sel).forEach(item => {
                const rect = item.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  items.push({
                    text: item.textContent.trim(),
                    href: item.href || null,
                    type: item.tagName.toLowerCase()
                  });
                }
              });
            });

            return items;
          });

          console.log(`   📋 Found ${menuItems.length} menu items`);

          // Save dropdown metadata
          fs.writeFileSync(
            path.join(dropdownDir, "metadata.json"),
            JSON.stringify({
              parentPage: pageName,
              parentUrl: pageUrl,
              dropdownIndex: i,
              menuItems,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          // Click each menu item and capture if it's a link
          for (let j = 0; j < menuItems.length; j++) {
            const menuItem = menuItems[j];
            if (menuItem.href && !visitedUrls.has(menuItem.href) && menuItem.href.includes('meeting')) {
              urlQueue.push(menuItem.href);
            }
          }

          // Close dropdown (click outside or press escape)
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);

        } catch (err) {
          console.error(`   ⚠️  Error with dropdown ${i}:`, err.message);
          // Try to recover by pressing Escape
          await page.keyboard.press('Escape');
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing dropdowns:`, error.message);
  }
}

// Try to open meeting detail view
async function captureMeetingDetails(page) {
  console.log(`\n📋 Looking for meeting details...`);

  try {
    // Look for first meeting row to click
    const meetingRowSelectors = [
      'table tbody tr',
      '[data-test-id*="meeting"]',
      '.meeting-row',
      '[class*="meeting-item"]',
      'a[href*="meetings"]'
    ];

    for (const selector of meetingRowSelectors) {
      const rows = await page.$$(selector);

      if (rows.length > 0) {
        console.log(`   Found ${rows.length} meeting rows`);

        // Click first meeting to view details
        try {
          await rows[0].click();
          await page.waitForTimeout(2000);

          // Capture the meeting detail view
          const detailUrl = page.url();
          if (!visitedUrls.has(detailUrl)) {
            await capturePage(page, detailUrl, 'meeting_detail', 'meetings');
            visitedUrls.add(detailUrl);

            // Look for tabs in the detail view
            await captureTabs(page, detailUrl, 'meeting_detail');
          }

          // Go back to list
          await page.goBack();
          await page.waitForTimeout(1000);
        } catch (err) {
          console.error(`   ⚠️  Error opening meeting detail:`, err.message);
        }

        break;
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing meeting details:`, error.message);
  }
}

// Try to capture meeting creation flow
async function captureMeetingCreation(page, pageUrl) {
  console.log(`\n📝 Looking for meeting creation button...`);

  try {
    // Look for "Create Meeting" or "New Meeting" button
    const createSelectors = [
      'button:has-text("Create")',
      'button:has-text("New")',
      'a:has-text("Create Meeting")',
      'a:has-text("New Meeting")',
      '[data-test-id*="create"]',
      '[data-test-id*="new"]',
      '.btn-primary:has-text("Create")'
    ];

    for (const selector of createSelectors) {
      try {
        const createBtn = await page.$(selector);
        if (createBtn) {
          const isVisible = await createBtn.isVisible();
          if (isVisible) {
            console.log(`   🔍 Found create button`);

            // Click to open create form
            await createBtn.click();
            await page.waitForTimeout(2000);

            // Capture the create form
            const createUrl = page.url();
            const createPageId = generatePageId(createUrl, 'meeting_create');
            const createDir = path.join(SCREENSHOT_DIR, createPageId);
            if (!fs.existsSync(createDir)) {
              fs.mkdirSync(createDir, { recursive: true });
            }

            await page.screenshot({
              path: path.join(createDir, "screenshot.png"),
              fullPage: true
            });

            // Save DOM
            const htmlContent = await page.content();
            fs.writeFileSync(path.join(createDir, "dom.html"), htmlContent);

            // Analyze form fields
            const analysis = await analyzePageStructure(page);
            fs.writeFileSync(
              path.join(createDir, "metadata.json"),
              JSON.stringify({
                url: createUrl,
                pageName: 'meeting_create',
                category: 'meetings',
                timestamp: new Date().toISOString(),
                analysis
              }, null, 2)
            );

            console.log(`   ✅ Captured meeting creation form`);

            // Close modal or go back
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);

            // If still on create page, try going back
            if (page.url() !== pageUrl) {
              await page.goto(pageUrl, { waitUntil: 'networkidle' });
              await page.waitForTimeout(1000);
            }

            break;
          }
        }
      } catch (err) {
        // Continue to next selector
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing meeting creation:`, error.message);
  }
}

// Capture tabs within the page
async function captureTabs(page, pageUrl, pageName) {
  console.log(`\n📑 Looking for tabs on: ${pageName}`);

  try {
    // Look for tab elements
    const tabSelectors = [
      '[role="tab"]',
      '.tab',
      '[class*="tab-"]',
      'a[data-toggle="tab"]',
      'button[data-toggle="tab"]'
    ];

    for (const selector of tabSelectors) {
      const tabs = await page.$$(selector);

      if (tabs.length > 0) {
        console.log(`   Found ${tabs.length} tabs`);

        for (let i = 0; i < tabs.length; i++) {
          try {
            const tab = tabs[i];
            const text = await tab.textContent();
            const isVisible = await tab.isVisible();

            if (!isVisible) continue;

            console.log(`   🔍 Clicking tab: "${text?.trim() || 'unlabeled'}"`);

            // Click the tab
            await tab.click();
            await page.waitForTimeout(1500);

            // Capture the tab view
            const tabPageId = generatePageId(pageUrl, `${pageName}_tab_${i}_${sanitizeFilename(text || '')}`);
            const tabDir = path.join(SCREENSHOT_DIR, tabPageId);
            if (!fs.existsSync(tabDir)) {
              fs.mkdirSync(tabDir, { recursive: true });
            }

            await page.screenshot({
              path: path.join(tabDir, "screenshot.png"),
              fullPage: true
            });

            // Save tab metadata
            fs.writeFileSync(
              path.join(tabDir, "metadata.json"),
              JSON.stringify({
                parentPage: pageName,
                parentUrl: pageUrl,
                tabIndex: i,
                tabText: text?.trim() || 'unlabeled',
                timestamp: new Date().toISOString()
              }, null, 2)
            );

            console.log(`   ✅ Captured tab: ${text?.trim()}`);

          } catch (err) {
            console.error(`   ⚠️  Error with tab ${i}:`, err.message);
          }
        }

        break;
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing tabs:`, error.message);
  }
}

// Generate comprehensive report
function generateReport() {
  console.log('\n📊 Generating comprehensive report...');

  // Generate sitemap table
  let tableContent = `# Procore Meetings Crawl Sitemap\n\n`;
  tableContent += `**Generated:** ${new Date().toISOString()}\n\n`;
  tableContent += `**Total Pages:** ${siteMap.length}\n\n`;
  tableContent += `| Page Name | Category | Links | Clickables | Dropdowns | Screenshot |\n`;
  tableContent += `|-----------|----------|-------|------------|-----------|------------|\n`;

  siteMap.forEach(page => {
    const relPath = page.screenshotPath.replace(/\\/g, '/');
    tableContent += `| ${page.pageName} | ${page.category} | ${page.links} | ${page.clickables} | ${page.dropdowns} | [View](../${relPath}) |\n`;
  });

  fs.writeFileSync(
    path.join(REPORTS_DIR, "sitemap-table.md"),
    tableContent
  );

  // Generate detailed JSON
  fs.writeFileSync(
    path.join(REPORTS_DIR, "detailed-report.json"),
    JSON.stringify(siteMap, null, 2)
  );

  // Generate link graph
  const linkGraph = {
    totalPages: siteMap.length,
    totalLinks: siteMap.reduce((sum, page) => sum + page.links, 0),
    totalClickables: siteMap.reduce((sum, page) => sum + page.clickables, 0),
    pages: siteMap.map(page => ({
      name: page.pageName,
      url: page.url,
      outgoingLinks: page.linkDetails?.map(l => l.href) || []
    }))
  };

  fs.writeFileSync(
    path.join(REPORTS_DIR, "link-graph.json"),
    JSON.stringify(linkGraph, null, 2)
  );

  console.log('✅ Reports generated in:', REPORTS_DIR);
}

// Main crawler
async function crawlMeetings() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  // Add auth cookies if available
  if (authCookies.length > 0) {
    await context.addCookies(authCookies);
    console.log('✅ Added auth cookies to context');
  }

  const page = await context.newPage();

  try {
    // Try navigating directly with cookies first
    console.log('🔐 Attempting to access Procore with cookies...');
    try {
      await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000);
    } catch (navErr) {
      console.log('⚠️  Initial navigation timeout, will try login...');
    }

    // Check if we need to login
    const needsLogin = page.url().includes('login') || await page.$('input[type="email"]');

    if (needsLogin) {
      console.log('🔐 Logging into Procore...');

      // Login
      await page.goto('https://login.procore.com/');
      await page.waitForTimeout(2000);

      await page.fill('input[type="email"]', PROCORE_EMAIL);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      await page.fill('input[type="password"]', PROCORE_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);

      console.log('✅ Logged in successfully');
    } else {
      console.log('✅ Already authenticated via cookies');
    }

    // Start with the main meetings page
    urlQueue.push(START_URL);

    let pageCount = 0;
    const maxPages = 50; // Safety limit

    while (urlQueue.length > 0 && pageCount < maxPages) {
      const currentUrl = urlQueue.shift();

      if (visitedUrls.has(currentUrl)) {
        continue;
      }

      visitedUrls.add(currentUrl);
      pageCount++;

      // Determine page name from URL
      const urlParts = currentUrl.split('/');
      const pageName = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'unknown';

      // Capture the page
      const result = await capturePage(page, currentUrl, pageName, 'meetings');

      if (result) {
        // Look for and capture tabs
        await captureTabs(page, currentUrl, pageName);

        // Look for and capture dropdowns
        await captureDropdowns(page, currentUrl, pageName);

        // If this is the main meetings list, try to open a meeting detail
        if (pageName === 'list' || pageName.includes('meeting')) {
          await captureMeetingDetails(page);
          await captureMeetingCreation(page, currentUrl);
        }
      }

      console.log(`\n📊 Progress: ${pageCount}/${maxPages} pages captured, ${urlQueue.length} in queue`);
    }

    // Generate final report
    generateReport();

    console.log('\n✅ Crawl complete!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`📊 Total pages captured: ${siteMap.length}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await browser.close();
  }
}

// Run the crawler
crawlMeetings().catch(console.error);
