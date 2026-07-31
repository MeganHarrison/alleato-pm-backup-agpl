import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./playwright-procore-crawl/procore-crawls/scheduling/crawl-scheduling";
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Starting URL - Schedule Management tool
const START_URL = "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools/schedulemgmt";

// Project and company IDs for URL filtering
const PROJECT_ID = "562949954728542";
const COMPANY_ID = "562949953443325";

// Procore credentials - load from auth.json if available
let PROCORE_EMAIL = "bclymer@alleatogroup.com";
let PROCORE_PASSWORD = "Clymer926!";

try {
  const authPath = path.join(process.cwd(), "auth.json");
  if (fs.existsSync(authPath)) {
    const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    // Auth contains cookies, we'll use those instead
    console.log('Found auth.json with stored cookies');
  }
} catch (e) {
  console.log('Using default credentials');
}

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

// Enhanced page analysis for Schedule Management
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
      badges: document.querySelectorAll('[class*="badge"], [class*="status"], [class*="tag"]').length,
      // Schedule-specific components
      gantt: document.querySelectorAll('[class*="gantt"], [class*="Gantt"], [class*="timeline"]').length,
      calendar: document.querySelectorAll('[class*="calendar"], [class*="Calendar"]').length,
      tasks: document.querySelectorAll('[class*="task"], [class*="Task"], [class*="activity"]').length,
      milestones: document.querySelectorAll('[class*="milestone"], [class*="Milestone"]').length,
      progress: document.querySelectorAll('[class*="progress"], [class*="Progress"]').length,
      dependencies: document.querySelectorAll('[class*="dependency"], [class*="link"]').length,
      resources: document.querySelectorAll('[class*="resource"], [class*="Resource"]').length,
      datePicker: document.querySelectorAll('[class*="date"], input[type="date"]').length
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

    // Look for schedule-specific elements
    const scheduleElements = {
      ganttChart: document.querySelectorAll('[class*="gantt-chart"], [class*="GanttChart"]').length,
      timelineView: document.querySelectorAll('[class*="timeline-view"], [class*="TimelineView"]').length,
      taskList: document.querySelectorAll('[class*="task-list"], [class*="TaskList"]').length,
      criticalPath: document.querySelectorAll('[class*="critical"], [class*="Critical"]').length,
      baseline: document.querySelectorAll('[class*="baseline"], [class*="Baseline"]').length,
      lookahead: document.querySelectorAll('[class*="lookahead"], [class*="Lookahead"]').length,
      resourceView: document.querySelectorAll('[class*="resource-view"], [class*="ResourceView"]').length,
      importExport: document.querySelectorAll('[class*="import"], [class*="export"], [class*="Import"], [class*="Export"]').length,
      filters: document.querySelectorAll('[class*="filter"], [class*="Filter"]').length,
      viewSelector: document.querySelectorAll('[class*="view-selector"], [class*="ViewSelector"]').length
    };

    return {
      components,
      tables,
      scheduleElements,
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

      // Focus on schedule-related links
      if (!isExternal && href !== baseUrl && !href.includes('javascript:') && !href.includes('#')) {
        const isScheduleLink = href.includes('schedule') ||
                              href.includes('schedulemgmt') ||
                              href.includes('gantt') ||
                              href.includes('task') ||
                              href.includes('calendar') ||
                              href.includes('562949954728542') ||
                              href.includes('tools/');
        links.push({
          href,
          text,
          classes: link.className,
          id: link.id || null,
          index,
          isScheduleLink
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

    // Extract schedule-specific interactions
    const scheduleInteractions = [];
    document.querySelectorAll('[class*="schedule"] button, [class*="gantt"] button, [class*="toolbar"] button').forEach((el, index) => {
      scheduleInteractions.push({
        text: el.textContent.trim() || el.getAttribute('aria-label') || el.getAttribute('title') || 'unlabeled',
        classes: el.className,
        ariaLabel: el.getAttribute('aria-label'),
        title: el.getAttribute('title'),
        index
      });
    });

    return { links, clickables, dropdowns, scheduleInteractions };
  }, currentUrl);
}

// Capture a single page with comprehensive analysis
async function capturePage(page, url, pageName, category = "scheduling") {
  try {
    console.log(`\n📸 Capturing: ${pageName}`);
    console.log(`   URL: ${url}`);

    // Navigate to page
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 90000
    });

    await page.waitForTimeout(WAIT_TIME);

    // Wait for schedule-specific elements to load
    try {
      await page.waitForSelector('[class*="schedule"], [class*="gantt"], [class*="task"], table, .loading', {
        timeout: 10000,
        state: 'attached'
      });
      await page.waitForTimeout(1000); // Extra wait for animations
    } catch (e) {
      console.log('   Note: No schedule-specific elements found, continuing...');
    }

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
    const { links, clickables, dropdowns, scheduleInteractions } = await extractLinks(page, url);

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
      scheduleInteractions: scheduleInteractions.length,
      scheduleInteractionDetails: scheduleInteractions,
      screenshotPath: path.relative(OUTPUT_DIR, screenshotPath)
    };

    fs.writeFileSync(
      path.join(pageDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    siteMap.push(metadata);
    console.log(`   ✅ Captured: ${links.length} links, ${clickables.length} clickables, ${dropdowns.length} dropdowns, ${scheduleInteractions.length} schedule interactions`);

    // Add new schedule-related links to queue (prioritize schedule links)
    links.forEach(link => {
      if (!visitedUrls.has(link.href) && !urlQueue.includes(link.href)) {
        // Prioritize schedule-specific links
        if (link.isScheduleLink && (
          link.href.includes('schedule') ||
          link.href.includes('gantt') ||
          link.href.includes('/tools/') ||
          link.href.includes('create') ||
          link.href.includes('edit') ||
          link.href.includes('configure') ||
          link.href.includes('task')
        )) {
          urlQueue.push(link.href);
        }
      }
    });

    return { metadata, links, clickables, dropdowns, scheduleInteractions };
  } catch (error) {
    console.error(`   ❌ Error capturing ${pageName}:`, error.message);
    return null;
  }
}

// Click and capture dropdown/menu items
async function captureDropdowns(page, pageUrl, pageName) {
  console.log(`\n🎯 Looking for dropdowns and menus on: ${pageName}`);

  try {
    // Look for three-dot menus, settings, view selectors, and dropdown triggers
    const dropdownSelectors = [
      '[data-test-id*="more"]',
      '[class*="more-options"]',
      '[class*="kebab"]',
      '[class*="three-dot"]',
      'button[aria-label*="more"]',
      'button[aria-label*="options"]',
      'button[aria-label*="settings"]',
      'button[aria-label*="view"]',
      'button[aria-label*="filter"]',
      'button[aria-haspopup="menu"]',
      '[class*="dropdown-toggle"]',
      'button:has(svg[class*="dots"])',
      'button:has([class*="icon-more"])',
      '[data-testid*="actions"]',
      '[class*="action-menu"]',
      'button[class*="ellipsis"]',
      // Schedule-specific selectors
      '[class*="view-selector"] button',
      '[class*="toolbar"] [class*="dropdown"]',
      '[class*="zoom"] button',
      '[class*="export"] button',
      '[class*="import"] button'
    ];

    let dropdownCount = 0;

    for (const selector of dropdownSelectors) {
      const elements = await page.$$(selector);

      for (let i = 0; i < elements.length && dropdownCount < 15; i++) {
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
          const dropdownPageId = generatePageId(pageUrl, `${pageName}_dropdown_${dropdownCount + 1}`);
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
              '[class*="popover"] button',
              '[role="listbox"] [role="option"]'
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
              dropdownIndex: dropdownCount + 1,
              menuItems,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          dropdownCount++;

          // Click each menu item and capture if it's a link
          for (let j = 0; j < menuItems.length; j++) {
            const menuItem = menuItems[j];
            if (menuItem.href && !visitedUrls.has(menuItem.href) &&
                (menuItem.href.includes('schedule') || menuItem.href.includes('task') || menuItem.href.includes('gantt'))) {
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

// Capture tabs on schedule pages
async function captureTabs(page, pageUrl, pageName) {
  console.log(`\n📑 Looking for tabs on: ${pageName}`);

  try {
    const tabSelectors = [
      '[role="tab"]',
      '[class*="tab-item"]',
      '.tabs button',
      '.tab-list button',
      '[class*="TabItem"]',
      '[class*="view-tab"]'
    ];

    for (const selector of tabSelectors) {
      const tabs = await page.$$(selector);

      for (let i = 0; i < tabs.length; i++) {
        try {
          const tab = tabs[i];
          const text = await tab.textContent();
          const isVisible = await tab.isVisible();
          const isActive = await tab.getAttribute('aria-selected');

          if (!isVisible || isActive === 'true') continue;

          console.log(`   📑 Clicking tab: "${text?.trim()}"`);

          await tab.click();
          await page.waitForTimeout(2000);

          // Capture the tab content
          const tabPageId = generatePageId(pageUrl, `${pageName}_tab_${text?.trim() || i}`);
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
              tabName: text?.trim(),
              tabIndex: i,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          console.log(`   ✅ Captured tab: ${text?.trim()}`);

        } catch (err) {
          console.error(`   ⚠️ Error with tab ${i}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing tabs:`, error.message);
  }
}

// Capture different schedule views (Gantt, List, Calendar, etc.)
async function captureScheduleViews(page, pageUrl, pageName) {
  console.log(`\n📅 Looking for schedule view options...`);

  const viewSelectors = [
    { selector: '[aria-label*="Gantt" i]', name: 'gantt-view' },
    { selector: '[aria-label*="List" i]', name: 'list-view' },
    { selector: '[aria-label*="Calendar" i]', name: 'calendar-view' },
    { selector: '[aria-label*="Resource" i]', name: 'resource-view' },
    { selector: '[aria-label*="Timeline" i]', name: 'timeline-view' },
    { selector: 'button:has-text("Gantt")', name: 'gantt-view' },
    { selector: 'button:has-text("List")', name: 'list-view' },
    { selector: 'button:has-text("Calendar")', name: 'calendar-view' },
    { selector: 'button:has-text("Resource")', name: 'resource-view' },
    { selector: 'button:has-text("Lookahead")', name: 'lookahead-view' },
    { selector: '[class*="view-gantt"]', name: 'gantt-view' },
    { selector: '[class*="view-list"]', name: 'list-view' },
    { selector: '[class*="view-calendar"]', name: 'calendar-view' },
  ];

  for (const { selector, name } of viewSelectors) {
    try {
      const element = await page.$(selector);
      if (element && await element.isVisible()) {
        console.log(`   🔍 Found view option: ${name}`);
        await element.click();
        await page.waitForTimeout(2000);

        const viewPageId = generatePageId(pageUrl, `${pageName}_${name}`);
        const viewDir = path.join(SCREENSHOT_DIR, viewPageId);
        if (!fs.existsSync(viewDir)) {
          fs.mkdirSync(viewDir, { recursive: true });
        }

        await page.screenshot({
          path: path.join(viewDir, "screenshot.png"),
          fullPage: true
        });

        // Save DOM
        const htmlContent = await page.content();
        fs.writeFileSync(path.join(viewDir, "dom.html"), htmlContent);

        fs.writeFileSync(
          path.join(viewDir, "metadata.json"),
          JSON.stringify({
            parentPage: pageName,
            parentUrl: pageUrl,
            viewType: name,
            timestamp: new Date().toISOString()
          }, null, 2)
        );

        console.log(`   ✅ Captured ${name}`);
      }
    } catch (err) {
      // View not found or not clickable
    }
  }
}

// Generate comprehensive report
function generateReport() {
  console.log('\n📊 Generating comprehensive report...');

  // Generate sitemap table
  let tableContent = `# Procore Schedule Management Crawl Sitemap\n\n`;
  tableContent += `**Generated:** ${new Date().toISOString()}\n\n`;
  tableContent += `**Total Pages:** ${siteMap.length}\n\n`;
  tableContent += `| Page Name | Category | Links | Clickables | Dropdowns | Schedule Interactions | Screenshot |\n`;
  tableContent += `|-----------|----------|-------|------------|-----------|----------------------|------------|\n`;

  siteMap.forEach(page => {
    const relPath = page.screenshotPath.replace(/\\/g, '/');
    tableContent += `| ${page.pageName} | ${page.category} | ${page.links} | ${page.clickables} | ${page.dropdowns} | ${page.scheduleInteractions || 0} | [View](../${relPath}) |\n`;
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
    totalScheduleInteractions: siteMap.reduce((sum, page) => sum + (page.scheduleInteractions || 0), 0),
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
async function crawlScheduling() {
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

    // Start with the main schedule management page
    urlQueue.push(START_URL);

    // Also add key schedule URLs to capture
    const additionalUrls = [
      // Main schedule tool views
      `https://us02.procore.com/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/schedulemgmt`,
      // Different possible schedule-related paths
      `https://us02.procore.com/${PROJECT_ID}/project/schedule`,
      `https://us02.procore.com/${PROJECT_ID}/project/calendar`,
      `https://us02.procore.com/${PROJECT_ID}/project/schedule/tasks`,
      `https://us02.procore.com/${PROJECT_ID}/project/schedule/gantt`,
      // Configure and settings
      `https://us02.procore.com/${PROJECT_ID}/project/schedule/configure`,
      `https://us02.procore.com/${PROJECT_ID}/project/schedulemgmt/configure`,
      // New task creation
      `https://us02.procore.com/${PROJECT_ID}/project/schedule/tasks/new`,
      `https://us02.procore.com/${PROJECT_ID}/project/schedulemgmt/new`,
      // Lookahead views
      `https://us02.procore.com/${PROJECT_ID}/project/schedule/lookahead`,
      `https://us02.procore.com/${PROJECT_ID}/project/schedulemgmt/lookahead`,
    ];

    additionalUrls.forEach(url => {
      if (!urlQueue.includes(url)) {
        urlQueue.push(url);
      }
    });

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
      let pageName = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'unknown';

      // Clean up page name from query params
      if (pageName.includes('?')) {
        pageName = pageName.split('?')[0] || 'main-view';
      }

      // Make more descriptive names
      if (currentUrl.includes('schedulemgmt')) {
        pageName = 'schedule-management-' + pageName;
      } else if (currentUrl.includes('configure')) {
        pageName = 'schedule-configure-settings';
      } else if (currentUrl.includes('new') || currentUrl.includes('create')) {
        pageName = 'create-new-task';
      } else if (currentUrl.includes('edit')) {
        pageName = 'edit-task';
      } else if (currentUrl.includes('gantt')) {
        pageName = 'gantt-view';
      } else if (currentUrl.includes('lookahead')) {
        pageName = 'lookahead-view';
      } else if (currentUrl.includes('calendar')) {
        pageName = 'calendar-view';
      }

      // Capture the page
      const result = await capturePage(page, currentUrl, pageName, 'scheduling');

      if (result) {
        // Look for and capture dropdowns
        await captureDropdowns(page, currentUrl, pageName);

        // Capture tabs if present
        await captureTabs(page, currentUrl, pageName);

        // If this is the main schedule page, try to capture different views
        if (currentUrl.includes('schedulemgmt') || currentUrl.includes('/schedule')) {
          await captureScheduleViews(page, currentUrl, pageName);
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
crawlScheduling().catch(console.error);
