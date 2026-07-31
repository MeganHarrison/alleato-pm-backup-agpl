import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "../../documentation/*project-mgmt/in-progress/punch-list/crawl-punch-list";
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Starting URL - Punch List
const START_URL = "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools/punchlist/list";

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
      // Punch list specific
      statusBadges: document.querySelectorAll('[class*="status"], [class*="badge"], [class*="tag"]').length,
      checkboxes: document.querySelectorAll('input[type="checkbox"]').length,
      images: document.querySelectorAll('img').length,
      thumbnails: document.querySelectorAll('[class*="thumbnail"], [class*="preview"]').length
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

    // Analyze punch list items (commonly in cards or list items)
    const punchItems = Array.from(document.querySelectorAll('[class*="punch"], [class*="item"], [data-testid*="punch"]')).slice(0, 20).map((item, index) => {
      return {
        index,
        text: item.textContent.trim().substring(0, 100),
        classes: item.className
      };
    });

    // Analyze status filters
    const statusFilters = Array.from(document.querySelectorAll('[class*="filter"], [class*="status"]')).map(el => ({
      text: el.textContent.trim().substring(0, 50),
      classes: el.className
    }));

    return {
      components,
      tables,
      punchItems,
      statusFilters,
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

    // Extract all anchor links - filter for punch list related
    document.querySelectorAll('a[href]').forEach((link, index) => {
      const href = link.href;
      const text = link.textContent.trim();
      const isExternal = !href.includes('procore.com');

      // Filter to stay within punch list feature
      const isPunchListRelated = href.includes('punchlist') ||
                                  href.includes('punch_list') ||
                                  href.includes('punch-list') ||
                                  href.includes('/tools/') ||
                                  href.includes('562949954728542'); // Project ID

      if (!isExternal && href !== baseUrl && !href.includes('javascript:') && !href.includes('#') && isPunchListRelated) {
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

    // Extract tabs
    const tabs = [];
    document.querySelectorAll('[role="tab"], .tab, [class*="tab-"]').forEach((el, index) => {
      tabs.push({
        text: el.textContent.trim(),
        classes: el.className,
        isActive: el.classList.contains('active') || el.getAttribute('aria-selected') === 'true',
        index
      });
    });

    return { links, clickables, dropdowns, tabs };
  }, currentUrl);
}

// Capture a single page with comprehensive analysis
async function capturePage(page, url, pageName, category = "punch-list") {
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
    const { links, clickables, dropdowns, tabs } = await extractLinks(page, url);

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
      tabs: tabs.length,
      tabDetails: tabs,
      screenshotPath: path.relative(OUTPUT_DIR, screenshotPath)
    };

    fs.writeFileSync(
      path.join(pageDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    siteMap.push(metadata);
    console.log(`   ✅ Captured: ${links.length} links, ${clickables.length} clickables, ${dropdowns.length} dropdowns, ${tabs.length} tabs`);

    // Add new links to queue
    links.forEach(link => {
      if (!visitedUrls.has(link.href) && !urlQueue.includes(link.href)) {
        urlQueue.push(link.href);
      }
    });

    return { metadata, links, clickables, dropdowns, tabs };
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

      for (let i = 0; i < Math.min(elements.length, 5); i++) { // Limit to first 5 of each type
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
              '[role="menuitem"]',
              '.dropdown-menu a',
              '.dropdown-menu button',
              '[class*="menu-item"]',
              'ul[class*="dropdown"] a',
              'ul[class*="menu"] a',
              '[class*="popover"] a',
              '[class*="popover"] button'
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

          // Add menu item links to queue
          for (const menuItem of menuItems) {
            if (menuItem.href && !visitedUrls.has(menuItem.href) && menuItem.href.includes('punchlist')) {
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

// Capture tabs on the page
async function captureTabs(page, pageUrl, pageName) {
  console.log(`\n📑 Looking for tabs on: ${pageName}`);

  try {
    const tabSelectors = [
      '[role="tab"]',
      '[class*="tab-item"]',
      '[class*="tabs"] button',
      '[data-testid*="tab"]'
    ];

    for (const selector of tabSelectors) {
      const tabs = await page.$$(selector);

      for (let i = 0; i < tabs.length; i++) {
        try {
          const tab = tabs[i];
          const text = await tab.textContent();
          const isVisible = await tab.isVisible();
          const isActive = await tab.evaluate(el =>
            el.classList.contains('active') || el.getAttribute('aria-selected') === 'true'
          );

          if (!isVisible || isActive) continue;

          console.log(`   📌 Clicking tab: "${text?.trim()}"`);

          await tab.click();
          await page.waitForTimeout(WAIT_TIME);

          // Capture tab content
          const tabPageId = generatePageId(pageUrl, `${pageName}_tab_${sanitizeFilename(text?.trim() || String(i))}`);
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
              tabName: text?.trim(),
              tabIndex: i,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          console.log(`   ✅ Captured tab: ${text?.trim()}`);

        } catch (err) {
          console.error(`   ⚠️  Error with tab ${i}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing tabs:`, error.message);
  }
}

// Capture filter/status variations
async function captureFilters(page, pageUrl, pageName) {
  console.log(`\n🔍 Looking for filters on: ${pageName}`);

  try {
    const filterSelectors = [
      '[class*="filter"]',
      '[data-testid*="filter"]',
      '[class*="status-filter"]',
      'select[class*="filter"]'
    ];

    for (const selector of filterSelectors) {
      const filters = await page.$$(selector);

      for (let i = 0; i < Math.min(filters.length, 3); i++) {
        try {
          const filter = filters[i];
          const isVisible = await filter.isVisible();

          if (!isVisible) continue;

          // Click to open filter
          await filter.click();
          await page.waitForTimeout(1000);

          // Capture filter options
          const filterPageId = generatePageId(pageUrl, `${pageName}_filter_${i}`);
          const filterDir = path.join(SCREENSHOT_DIR, filterPageId);
          if (!fs.existsSync(filterDir)) {
            fs.mkdirSync(filterDir, { recursive: true });
          }

          await page.screenshot({
            path: path.join(filterDir, "screenshot.png"),
            fullPage: true
          });

          // Extract filter options
          const filterOptions = await page.evaluate(() => {
            const options = [];
            document.querySelectorAll('[role="option"], [class*="option"], select option').forEach(opt => {
              options.push(opt.textContent.trim());
            });
            return options;
          });

          fs.writeFileSync(
            path.join(filterDir, "metadata.json"),
            JSON.stringify({
              parentPage: pageName,
              parentUrl: pageUrl,
              filterIndex: i,
              options: filterOptions,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          console.log(`   📋 Found ${filterOptions.length} filter options`);

          // Close filter
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);

        } catch (err) {
          console.error(`   ⚠️  Error with filter ${i}:`, err.message);
          await page.keyboard.press('Escape');
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing filters:`, error.message);
  }
}

// Generate comprehensive report
function generateReport() {
  console.log('\n📊 Generating comprehensive report...');

  // Generate sitemap table
  let tableContent = `# Procore Punch List Crawl Sitemap\n\n`;
  tableContent += `**Generated:** ${new Date().toISOString()}\n\n`;
  tableContent += `**Total Pages:** ${siteMap.length}\n\n`;
  tableContent += `| Page Name | Category | Links | Clickables | Dropdowns | Tabs | Screenshot |\n`;
  tableContent += `|-----------|----------|-------|------------|-----------|------|------------|\n`;

  siteMap.forEach(page => {
    const relPath = page.screenshotPath.replace(/\\/g, '/');
    tableContent += `| ${page.pageName} | ${page.category} | ${page.links} | ${page.clickables} | ${page.dropdowns} | ${page.tabs || 0} | [View](../${relPath}) |\n`;
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
    totalDropdowns: siteMap.reduce((sum, page) => sum + page.dropdowns, 0),
    totalTabs: siteMap.reduce((sum, page) => sum + (page.tabs || 0), 0),
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

  // Generate summary statistics
  const summary = {
    generated: new Date().toISOString(),
    feature: "Punch List",
    statistics: {
      totalPages: siteMap.length,
      totalLinks: linkGraph.totalLinks,
      totalClickables: linkGraph.totalClickables,
      totalDropdowns: linkGraph.totalDropdowns,
      totalTabs: linkGraph.totalTabs
    },
    uiComponents: siteMap.reduce((acc, page) => {
      if (page.analysis && page.analysis.components) {
        Object.entries(page.analysis.components).forEach(([key, val]) => {
          acc[key] = (acc[key] || 0) + val;
        });
      }
      return acc;
    }, {}),
    tables: siteMap.flatMap(page => page.analysis?.tables || [])
  };

  fs.writeFileSync(
    path.join(REPORTS_DIR, "summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log('✅ Reports generated in:', REPORTS_DIR);
}

// Main crawler
async function crawlPunchList() {
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

    // Start with the main punch list page
    urlQueue.push(START_URL);

    // Also add common punch list pages to explore
    const additionalPages = [
      // Will be discovered from main page
    ];
    additionalPages.forEach(url => urlQueue.push(url));

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
      const result = await capturePage(page, currentUrl, pageName, 'punch-list');

      if (result) {
        // Look for and capture dropdowns
        await captureDropdowns(page, currentUrl, pageName);

        // Capture tabs
        await captureTabs(page, currentUrl, pageName);

        // Capture filters (only on main list page)
        if (currentUrl.includes('/list') || currentUrl === START_URL) {
          await captureFilters(page, currentUrl, pageName);
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
crawlPunchList().catch(console.error);
