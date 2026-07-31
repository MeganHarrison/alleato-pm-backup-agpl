import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./documentation/*project-mgmt/in-progress/specifications/crawl-specifications";
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Starting URLs
const START_URL = "https://us02.procore.com/562949954728542/project/specification_sections";

// Procore credentials
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
      icons: document.querySelectorAll('i[class*="icon"], .icon, svg').length,
      treeViews: document.querySelectorAll('[role="tree"], .tree-view, [class*="tree"]').length,
      accordions: document.querySelectorAll('[class*="accordion"], [class*="collapsible"], details').length
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

    // Analyze specification-specific elements
    const specElements = {
      divisions: document.querySelectorAll('[class*="division"], [data-division]').length,
      sections: document.querySelectorAll('[class*="section"], [data-section]').length,
      revisions: document.querySelectorAll('[class*="revision"], [data-revision]').length,
      attachments: document.querySelectorAll('[class*="attachment"], [data-attachment]').length,
      pdfViewers: document.querySelectorAll('iframe[src*="pdf"], [class*="pdf-viewer"], embed[type*="pdf"]').length
    };

    return {
      components,
      tables,
      specElements,
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

      // Filter for specification-related links
      const isSpecRelated = href.includes('specification') ||
                           href.includes('spec_') ||
                           href.includes('/project/') ||
                           href.includes('562949954728542');

      if (!isExternal && href !== baseUrl && !href.includes('javascript:') && !href.includes('#') && isSpecRelated) {
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

    // Extract tree/hierarchy elements (common in specifications)
    const treeItems = [];
    document.querySelectorAll('[role="treeitem"], [class*="tree-item"], [class*="division"], [class*="section-item"]').forEach((el, index) => {
      treeItems.push({
        text: el.textContent.trim().substring(0, 100),
        classes: el.className,
        level: el.getAttribute('aria-level') || null,
        expanded: el.getAttribute('aria-expanded') || null,
        index
      });
    });

    return { links, clickables, dropdowns, treeItems };
  }, currentUrl);
}

// Capture a single page with comprehensive analysis
async function capturePage(page, url, pageName, category = "specifications") {
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
    const { links, clickables, dropdowns, treeItems } = await extractLinks(page, url);

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
      treeItems: treeItems.length,
      treeItemDetails: treeItems,
      screenshotPath: path.relative(OUTPUT_DIR, screenshotPath)
    };

    fs.writeFileSync(
      path.join(pageDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    siteMap.push(metadata);
    console.log(`   ✅ Captured: ${links.length} links, ${clickables.length} clickables, ${dropdowns.length} dropdowns, ${treeItems.length} tree items`);

    // Add new links to queue
    links.forEach(link => {
      if (!visitedUrls.has(link.href) && !urlQueue.includes(link.href)) {
        urlQueue.push(link.href);
      }
    });

    return { metadata, links, clickables, dropdowns, treeItems };
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
      'button:has([class*="icon-more"])',
      '[data-testid*="actions"]',
      '[class*="action-menu"]'
    ];

    for (const selector of dropdownSelectors) {
      const elements = await page.$$(selector);

      for (let i = 0; i < Math.min(elements.length, 5); i++) {
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
              'ul[class*="menu"] a',
              '[role="menuitem"]'
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
            if (menuItem.href && !visitedUrls.has(menuItem.href) && menuItem.href.includes('specification')) {
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

// Capture tabs on a page
async function captureTabs(page, pageUrl, pageName) {
  console.log(`\n📑 Looking for tabs on: ${pageName}`);

  try {
    const tabSelectors = [
      '[role="tab"]',
      '[class*="tab"]',
      '.nav-tabs a',
      '[data-toggle="tab"]'
    ];

    for (const selector of tabSelectors) {
      const tabs = await page.$$(selector);

      for (let i = 0; i < tabs.length; i++) {
        try {
          const tab = tabs[i];
          const tabText = await tab.textContent();
          const isVisible = await tab.isVisible();
          const isSelected = await tab.getAttribute('aria-selected');

          if (!isVisible || isSelected === 'true') continue;

          console.log(`   📑 Clicking tab: "${tabText?.trim()}"`);

          await tab.click();
          await page.waitForTimeout(WAIT_TIME);

          // Capture the tab content
          const tabPageId = generatePageId(pageUrl, `${pageName}_tab_${sanitizeFilename(tabText || i.toString())}`);
          const tabDir = path.join(SCREENSHOT_DIR, tabPageId);
          if (!fs.existsSync(tabDir)) {
            fs.mkdirSync(tabDir, { recursive: true });
          }

          await page.screenshot({
            path: path.join(tabDir, "screenshot.png"),
            fullPage: true
          });

          // Save DOM
          const htmlContent = await page.content();
          fs.writeFileSync(path.join(tabDir, "dom.html"), htmlContent);

          // Save metadata
          fs.writeFileSync(
            path.join(tabDir, "metadata.json"),
            JSON.stringify({
              parentPage: pageName,
              parentUrl: pageUrl,
              tabName: tabText?.trim(),
              tabIndex: i,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          console.log(`   ✅ Captured tab: ${tabText?.trim()}`);

        } catch (err) {
          console.error(`   ⚠️  Error with tab ${i}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing tabs:`, error.message);
  }
}

// Expand and capture tree/hierarchy items (for spec divisions)
async function captureTreeItems(page, pageUrl, pageName) {
  console.log(`\n🌳 Looking for expandable tree items on: ${pageName}`);

  try {
    const expandSelectors = [
      '[aria-expanded="false"]',
      '[class*="expand"]',
      '[class*="collapse"]',
      'button[class*="toggle"]',
      '[class*="tree"] button',
      '[class*="division"] [class*="arrow"]'
    ];

    let expandedCount = 0;
    const maxExpand = 10; // Limit expansions

    for (const selector of expandSelectors) {
      if (expandedCount >= maxExpand) break;

      const expandButtons = await page.$$(selector);

      for (let i = 0; i < Math.min(expandButtons.length, maxExpand - expandedCount); i++) {
        try {
          const btn = expandButtons[i];
          const isVisible = await btn.isVisible();

          if (!isVisible) continue;

          await btn.click();
          await page.waitForTimeout(1000);
          expandedCount++;

          console.log(`   🌳 Expanded item ${expandedCount}`);

        } catch (err) {
          // Ignore expansion errors
        }
      }
    }

    if (expandedCount > 0) {
      // Capture the expanded state
      const expandedPageId = generatePageId(pageUrl, `${pageName}_expanded`);
      const expandedDir = path.join(SCREENSHOT_DIR, expandedPageId);
      if (!fs.existsSync(expandedDir)) {
        fs.mkdirSync(expandedDir, { recursive: true });
      }

      await page.screenshot({
        path: path.join(expandedDir, "screenshot.png"),
        fullPage: true
      });

      fs.writeFileSync(
        path.join(expandedDir, "metadata.json"),
        JSON.stringify({
          parentPage: pageName,
          parentUrl: pageUrl,
          expandedItems: expandedCount,
          timestamp: new Date().toISOString()
        }, null, 2)
      );

      console.log(`   ✅ Captured expanded state with ${expandedCount} items`);
    }

  } catch (error) {
    console.error(`   ❌ Error capturing tree items:`, error.message);
  }
}

// Generate comprehensive report
function generateReport() {
  console.log('\n📊 Generating comprehensive report...');

  // Generate sitemap table
  let tableContent = `# Procore Specifications Crawl Sitemap\n\n`;
  tableContent += `**Generated:** ${new Date().toISOString()}\n\n`;
  tableContent += `**Total Pages:** ${siteMap.length}\n\n`;
  tableContent += `| Page Name | Category | Links | Clickables | Dropdowns | Tree Items | Screenshot |\n`;
  tableContent += `|-----------|----------|-------|------------|-----------|------------|------------|\n`;

  siteMap.forEach(page => {
    const relPath = page.screenshotPath.replace(/\\/g, '/');
    tableContent += `| ${page.pageName} | ${page.category} | ${page.links} | ${page.clickables} | ${page.dropdowns} | ${page.treeItems || 0} | [View](../${relPath}) |\n`;
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
    totalTreeItems: siteMap.reduce((sum, page) => sum + (page.treeItems || 0), 0),
    pages: siteMap.map(page => ({
      name: page.pageName,
      url: page.url,
      outgoingLinks: page.linkDetails.map(l => l.href)
    }))
  };

  fs.writeFileSync(
    path.join(REPORTS_DIR, "link-graph.json"),
    JSON.stringify(linkGraph, null, 2)
  );

  console.log('✅ Reports generated in:', REPORTS_DIR);
}

// Main crawler
async function crawlSpecifications() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
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

    // Start with the main specifications page
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
      const result = await capturePage(page, currentUrl, pageName, 'specifications');

      if (result) {
        // Look for and capture dropdowns
        await captureDropdowns(page, currentUrl, pageName);

        // Capture tabs
        await captureTabs(page, currentUrl, pageName);

        // Capture tree/hierarchy items
        await captureTreeItems(page, currentUrl, pageName);
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
crawlSpecifications().catch(console.error);
