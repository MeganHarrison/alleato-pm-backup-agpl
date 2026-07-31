import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./playwright-procore-crawl/procore-crawls/schedule/crawl-schedule";
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Starting URLs - Procore Schedule/Calendar feature
const PROJECT_ID = "562949954728542";
const BASE_URL = `https://us02.procore.com/${PROJECT_ID}`;

// Multiple entry points for Schedule feature
const START_URLS = [
  `${BASE_URL}/project/calendar`,           // Main calendar view
  `${BASE_URL}/project/schedule`,           // Schedule view (if different)
  `${BASE_URL}/project/calendar/tasks`,     // Tasks view
  `${BASE_URL}/project/calendar/settings`,  // Calendar settings
  `${BASE_URL}/project/home/ajax_overview_details?domain_name=calendar&filter=overdue&row_models[]=Task&row_models[]=TodoItem&row_title=Schedule`, // Dashboard widget
];

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
      // Schedule-specific components
      calendar: document.querySelectorAll('[class*="calendar"], [class*="Calendar"]').length,
      gantt: document.querySelectorAll('[class*="gantt"], [class*="Gantt"]').length,
      timeline: document.querySelectorAll('[class*="timeline"], [class*="Timeline"]').length,
      tasks: document.querySelectorAll('[class*="task"], [class*="Task"]').length,
      events: document.querySelectorAll('[class*="event"], [class*="Event"]').length,
      datePicker: document.querySelectorAll('[class*="date-picker"], [class*="datepicker"], input[type="date"]').length
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

    // Analyze calendar elements
    const calendarElements = Array.from(document.querySelectorAll('[class*="calendar"], [class*="Calendar"]')).map((el, index) => ({
      index: index + 1,
      classes: el.className,
      id: el.id || null,
      childCount: el.children.length
    }));

    return {
      components,
      tables,
      calendarElements,
      title: document.title,
      h1: document.querySelector('h1')?.textContent.trim() || null
    };
  });
}

// Extract all clickable elements and links - Schedule specific
async function extractLinks(page, currentUrl) {
  return await page.evaluate((baseUrl) => {
    const links = [];
    const clickables = [];

    // Extract all anchor links
    document.querySelectorAll('a[href]').forEach((link, index) => {
      const href = link.href;
      const text = link.textContent.trim();
      const isExternal = !href.includes('procore.com');

      // Filter for schedule/calendar related links
      const isScheduleRelated = href.includes('calendar') ||
                                href.includes('schedule') ||
                                href.includes('task') ||
                                href.includes('todo') ||
                                href.includes('event');

      if (!isExternal && href !== baseUrl && !href.includes('javascript:') && !href.includes('#')) {
        links.push({
          href,
          text,
          classes: link.className,
          id: link.id || null,
          index,
          isScheduleRelated
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

    // Extract calendar-specific interactions
    const calendarInteractions = [];
    document.querySelectorAll('[class*="calendar"] button, [class*="Calendar"] button, [class*="nav"] button').forEach((el, index) => {
      calendarInteractions.push({
        text: el.textContent.trim() || el.getAttribute('aria-label') || 'unlabeled',
        classes: el.className,
        ariaLabel: el.getAttribute('aria-label'),
        index
      });
    });

    return { links, clickables, dropdowns, calendarInteractions };
  }, currentUrl);
}

// Capture a single page with comprehensive analysis
async function capturePage(page, url, pageName, category = "schedule") {
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
    const { links, clickables, dropdowns, calendarInteractions } = await extractLinks(page, url);

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
      calendarInteractions: calendarInteractions.length,
      calendarInteractionDetails: calendarInteractions,
      screenshotPath: path.relative(OUTPUT_DIR, screenshotPath)
    };

    fs.writeFileSync(
      path.join(pageDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    siteMap.push(metadata);
    console.log(`   ✅ Captured: ${links.length} links, ${clickables.length} clickables, ${dropdowns.length} dropdowns, ${calendarInteractions.length} calendar interactions`);

    // Add new schedule-related links to queue (prioritize)
    links.forEach(link => {
      if (!visitedUrls.has(link.href) && !urlQueue.includes(link.href)) {
        if (link.isScheduleRelated) {
          urlQueue.unshift(link.href); // Priority
        } else {
          urlQueue.push(link.href);
        }
      }
    });

    return { metadata, links, clickables, dropdowns, calendarInteractions };
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
      // Calendar-specific selectors
      'button[aria-label*="view"]',
      'button[aria-label*="filter"]',
      '[class*="calendar-nav"] button',
      '[class*="view-selector"]'
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
              'ul[class*="menu"] a',
              '[role="listbox"] [role="option"]',
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

          // Click each menu item and capture if it's a link
          for (let j = 0; j < menuItems.length; j++) {
            const menuItem = menuItems[j];
            if (menuItem.href && !visitedUrls.has(menuItem.href)) {
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

// Capture calendar view variations (day, week, month, etc.)
async function captureCalendarViews(page, baseUrl, pageName) {
  console.log(`\n📅 Looking for calendar view options...`);

  const viewSelectors = [
    { selector: '[aria-label*="day" i]', name: 'day-view' },
    { selector: '[aria-label*="week" i]', name: 'week-view' },
    { selector: '[aria-label*="month" i]', name: 'month-view' },
    { selector: '[aria-label*="year" i]', name: 'year-view' },
    { selector: 'button:has-text("Day")', name: 'day-view' },
    { selector: 'button:has-text("Week")', name: 'week-view' },
    { selector: 'button:has-text("Month")', name: 'month-view' },
    { selector: '[class*="view-day"]', name: 'day-view' },
    { selector: '[class*="view-week"]', name: 'week-view' },
    { selector: '[class*="view-month"]', name: 'month-view' },
  ];

  for (const { selector, name } of viewSelectors) {
    try {
      const element = await page.$(selector);
      if (element && await element.isVisible()) {
        console.log(`   🔍 Found view option: ${name}`);
        await element.click();
        await page.waitForTimeout(2000);

        const viewPageId = generatePageId(baseUrl, `${pageName}_${name}`);
        const viewDir = path.join(SCREENSHOT_DIR, viewPageId);
        if (!fs.existsSync(viewDir)) {
          fs.mkdirSync(viewDir, { recursive: true });
        }

        await page.screenshot({
          path: path.join(viewDir, "screenshot.png"),
          fullPage: true
        });

        fs.writeFileSync(
          path.join(viewDir, "metadata.json"),
          JSON.stringify({
            parentPage: pageName,
            parentUrl: baseUrl,
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
  let tableContent = `# Procore Schedule Crawl Sitemap\n\n`;
  tableContent += `**Generated:** ${new Date().toISOString()}\n\n`;
  tableContent += `**Total Pages:** ${siteMap.length}\n\n`;
  tableContent += `| Page Name | Category | Links | Clickables | Dropdowns | Calendar Interactions | Screenshot |\n`;
  tableContent += `|-----------|----------|-------|------------|-----------|----------------------|------------|\n`;

  siteMap.forEach(page => {
    const relPath = page.screenshotPath.replace(/\\/g, '/');
    tableContent += `| ${page.pageName} | ${page.category} | ${page.links} | ${page.clickables} | ${page.dropdowns} | ${page.calendarInteractions || 0} | [View](../${relPath}) |\n`;
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
    totalCalendarInteractions: siteMap.reduce((sum, page) => sum + (page.calendarInteractions || 0), 0),
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
async function crawlSchedule() {
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

    // Add all starting URLs to queue
    START_URLS.forEach(url => {
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
      const urlParts = currentUrl.split(/[/?]/);
      let pageName = urlParts.filter(p => p && !p.includes('=') && !p.includes('procore.com')).pop() || 'unknown';

      // Make name more descriptive
      if (currentUrl.includes('calendar')) pageName = `calendar_${pageName}`;
      if (currentUrl.includes('schedule')) pageName = `schedule_${pageName}`;
      if (currentUrl.includes('task')) pageName = `task_${pageName}`;

      // Capture the page
      const result = await capturePage(page, currentUrl, pageName, 'schedule');

      if (result) {
        // Look for and capture dropdowns
        await captureDropdowns(page, currentUrl, pageName);

        // Try to capture different calendar views if this is a calendar page
        if (currentUrl.includes('calendar')) {
          await captureCalendarViews(page, currentUrl, pageName);
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
crawlSchedule().catch(console.error);
