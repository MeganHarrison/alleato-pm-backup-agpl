import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./documentation/*project-mgmt/in-progress/daily-logs/crawl-daily-logs";
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Starting URLs - Daily Logs specific
const START_URL = "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools/dailylog";
const PROJECT_ID = "562949954728542";
const COMPANY_ID = "562949953443325";

// Procore credentials
const PROCORE_EMAIL = "bclymer@alleatogroup.com";
const PROCORE_PASSWORD = "Clymer926!";

// Check if URL is relevant to daily logs feature
function isRelevantUrl(url) {
  const lowerUrl = url.toLowerCase();

  // Must be on procore.com
  if (!url.includes('procore.com')) return false;

  // Exclude external links, auth pages, help pages
  if (url.includes('login.procore.com')) return false;
  if (url.includes('support.procore.com')) return false;
  if (url.includes('help.procore.com')) return false;
  if (url.includes('javascript:')) return false;
  if (url.includes('#') && url.indexOf('#') === url.length - 1) return false;

  // Include daily log related pages
  if (lowerUrl.includes('dailylog')) return true;
  if (lowerUrl.includes('daily_log')) return true;
  if (lowerUrl.includes('daily-log')) return true;

  // Include project pages that might contain daily log entries
  if (url.includes(PROJECT_ID) && (
    lowerUrl.includes('log') ||
    lowerUrl.includes('entry') ||
    lowerUrl.includes('weather') ||
    lowerUrl.includes('manpower') ||
    lowerUrl.includes('equipment') ||
    lowerUrl.includes('notes') ||
    lowerUrl.includes('visitor') ||
    lowerUrl.includes('delivery') ||
    lowerUrl.includes('inspection') ||
    lowerUrl.includes('accident') ||
    lowerUrl.includes('safety') ||
    lowerUrl.includes('call') ||
    lowerUrl.includes('question')
  )) return true;

  // Include configuration and settings pages for daily logs
  if (url.includes('configuration') && url.includes(PROJECT_ID)) return true;
  if (url.includes('settings') && url.includes(PROJECT_ID)) return true;

  return false;
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

// Enhanced page analysis for Daily Logs
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
      // Daily log specific components
      dateSelectors: document.querySelectorAll('[class*="date"], [type="date"], .calendar').length,
      weatherWidgets: document.querySelectorAll('[class*="weather"]').length,
      timeEntries: document.querySelectorAll('[class*="time"], [type="time"]').length,
      logEntries: document.querySelectorAll('[class*="log-entry"], [class*="entry"]').length,
      attachments: document.querySelectorAll('[class*="attachment"], [class*="file"]').length
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

    // Analyze forms (important for daily log entry forms)
    const forms = Array.from(document.querySelectorAll('form')).map((form, index) => {
      const fields = Array.from(form.querySelectorAll('input, textarea, select')).map(field => ({
        name: field.name || field.id,
        type: field.type || field.tagName.toLowerCase(),
        placeholder: field.placeholder || null,
        required: field.required
      }));
      return {
        index: index + 1,
        action: form.action,
        method: form.method,
        fields,
        classes: form.className
      };
    });

    // Look for daily log specific sections
    const dailyLogSections = [];
    const sectionSelectors = [
      '[class*="weather"]',
      '[class*="manpower"]',
      '[class*="equipment"]',
      '[class*="notes"]',
      '[class*="visitor"]',
      '[class*="delivery"]',
      '[class*="inspection"]',
      '[class*="accident"]',
      '[class*="safety"]',
      '[class*="call"]',
      '[class*="question"]',
      '[data-section]',
      '.log-section',
      '.entry-section'
    ];

    sectionSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        dailyLogSections.push({
          selector: sel,
          text: el.textContent.trim().substring(0, 100),
          classes: el.className
        });
      });
    });

    return {
      components,
      tables,
      forms,
      dailyLogSections,
      title: document.title,
      h1: document.querySelector('h1')?.textContent.trim() || null,
      h2s: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim())
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

    // Extract tabs (daily logs often have tabs for different sections)
    const tabs = [];
    document.querySelectorAll('[role="tab"], .tab, [class*="tab-"]').forEach((el, index) => {
      tabs.push({
        text: el.textContent.trim(),
        isActive: el.classList.contains('active') || el.getAttribute('aria-selected') === 'true',
        classes: el.className,
        index
      });
    });

    return { links, clickables, dropdowns, tabs };
  }, currentUrl);
}

// Capture a single page with comprehensive analysis
async function capturePage(page, url, pageName, category = "daily-logs") {
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

    // Add new relevant links to queue
    links.forEach(link => {
      if (!visitedUrls.has(link.href) && !urlQueue.includes(link.href) && isRelevantUrl(link.href)) {
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

// Click and capture tabs (important for daily logs)
async function captureTabs(page, pageUrl, pageName) {
  console.log(`\n📑 Looking for tabs on: ${pageName}`);

  try {
    const tabSelectors = [
      '[role="tab"]',
      '.tab',
      '[class*="tab-item"]',
      '[data-tab]',
      '.nav-tabs a',
      '.tabs-list button'
    ];

    for (const selector of tabSelectors) {
      const tabs = await page.$$(selector);

      for (let i = 0; i < tabs.length; i++) {
        try {
          const tab = tabs[i];
          const text = await tab.textContent();
          const isVisible = await tab.isVisible();

          if (!isVisible) continue;

          console.log(`   📑 Found tab: "${text?.trim() || 'unlabeled'}"`);

          // Click the tab
          await tab.click();
          await page.waitForTimeout(1500);

          // Capture the tab content
          const tabPageId = generatePageId(pageUrl, `${pageName}_tab_${sanitizeFilename(text || String(i))}`);
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

          console.log(`   ✅ Captured tab content`);

        } catch (err) {
          console.error(`   ⚠️  Error with tab ${i}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing tabs:`, error.message);
  }
}

// Capture date picker interactions (important for daily logs)
async function captureDatePicker(page, pageUrl, pageName) {
  console.log(`\n📅 Looking for date pickers on: ${pageName}`);

  try {
    const dateSelectors = [
      '[class*="date-picker"]',
      '[class*="datepicker"]',
      '[class*="calendar"]',
      'input[type="date"]',
      '[data-test-id*="date"]',
      '[aria-label*="date"]'
    ];

    for (const selector of dateSelectors) {
      const elements = await page.$$(selector);

      for (let i = 0; i < Math.min(elements.length, 3); i++) {
        try {
          const element = elements[i];
          const isVisible = await element.isVisible();

          if (!isVisible) continue;

          console.log(`   📅 Found date picker`);

          // Click to open date picker
          await element.click();
          await page.waitForTimeout(1000);

          // Capture the opened date picker
          const datePickerPageId = generatePageId(pageUrl, `${pageName}_datepicker_${i}`);
          const datePickerDir = path.join(SCREENSHOT_DIR, datePickerPageId);
          if (!fs.existsSync(datePickerDir)) {
            fs.mkdirSync(datePickerDir, { recursive: true });
          }

          await page.screenshot({
            path: path.join(datePickerDir, "screenshot.png"),
            fullPage: true
          });

          fs.writeFileSync(
            path.join(datePickerDir, "metadata.json"),
            JSON.stringify({
              parentPage: pageName,
              parentUrl: pageUrl,
              datePickerIndex: i,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          console.log(`   ✅ Captured date picker`);

          // Close date picker
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);

        } catch (err) {
          console.error(`   ⚠️  Error with date picker ${i}:`, err.message);
          await page.keyboard.press('Escape');
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing date pickers:`, error.message);
  }
}

// Capture "Create" or "Add" dialogs
async function captureCreateDialogs(page, pageUrl, pageName) {
  console.log(`\n➕ Looking for Create/Add buttons on: ${pageName}`);

  try {
    const createSelectors = [
      'button:has-text("Create")',
      'button:has-text("Add")',
      'button:has-text("New")',
      '[data-test-id*="create"]',
      '[data-test-id*="add"]',
      '[aria-label*="Create"]',
      '[aria-label*="Add"]',
      '[class*="create-button"]',
      '[class*="add-button"]'
    ];

    for (const selector of createSelectors) {
      try {
        const elements = await page.$$(selector);

        for (let i = 0; i < Math.min(elements.length, 2); i++) {
          const element = elements[i];
          const text = await element.textContent();
          const isVisible = await element.isVisible();

          if (!isVisible) continue;

          console.log(`   ➕ Found create button: "${text?.trim()}"`);

          // Click to open create dialog
          await element.click();
          await page.waitForTimeout(2000);

          // Capture the dialog
          const dialogPageId = generatePageId(pageUrl, `${pageName}_create_dialog_${i}`);
          const dialogDir = path.join(SCREENSHOT_DIR, dialogPageId);
          if (!fs.existsSync(dialogDir)) {
            fs.mkdirSync(dialogDir, { recursive: true });
          }

          await page.screenshot({
            path: path.join(dialogDir, "screenshot.png"),
            fullPage: true
          });

          // Analyze form fields in the dialog
          const formFields = await page.evaluate(() => {
            const fields = [];
            document.querySelectorAll('[role="dialog"] input, [role="dialog"] textarea, [role="dialog"] select, .modal input, .modal textarea, .modal select').forEach(field => {
              fields.push({
                name: field.name || field.id,
                type: field.type || field.tagName.toLowerCase(),
                placeholder: field.placeholder || null,
                required: field.required,
                label: document.querySelector(`label[for="${field.id}"]`)?.textContent.trim() || null
              });
            });
            return fields;
          });

          fs.writeFileSync(
            path.join(dialogDir, "metadata.json"),
            JSON.stringify({
              parentPage: pageName,
              parentUrl: pageUrl,
              buttonText: text?.trim(),
              dialogIndex: i,
              formFields,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          console.log(`   ✅ Captured create dialog with ${formFields.length} form fields`);

          // Close dialog
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
        }
      } catch (err) {
        console.error(`   ⚠️  Error with selector ${selector}:`, err.message);
        await page.keyboard.press('Escape');
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing create dialogs:`, error.message);
  }
}

// Generate comprehensive report
function generateReport() {
  console.log('\n📊 Generating comprehensive report...');

  // Generate sitemap table
  let tableContent = `# Procore Daily Logs Crawl Sitemap\n\n`;
  tableContent += `**Generated:** ${new Date().toISOString()}\n\n`;
  tableContent += `**Total Pages:** ${siteMap.length}\n\n`;
  tableContent += `## Summary Statistics\n\n`;
  tableContent += `| Metric | Count |\n`;
  tableContent += `|--------|-------|\n`;
  tableContent += `| Total Pages | ${siteMap.length} |\n`;
  tableContent += `| Total Links | ${siteMap.reduce((sum, page) => sum + page.links, 0)} |\n`;
  tableContent += `| Total Clickables | ${siteMap.reduce((sum, page) => sum + page.clickables, 0)} |\n`;
  tableContent += `| Total Dropdowns | ${siteMap.reduce((sum, page) => sum + page.dropdowns, 0)} |\n`;
  tableContent += `| Total Tabs | ${siteMap.reduce((sum, page) => sum + (page.tabs || 0), 0)} |\n\n`;

  tableContent += `## Page Details\n\n`;
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

  // Generate summary for daily logs specific features
  const dailyLogSummary = {
    generated: new Date().toISOString(),
    feature: "Daily Logs",
    startUrl: START_URL,
    projectId: PROJECT_ID,
    companyId: COMPANY_ID,
    statistics: {
      pagesCaptured: siteMap.length,
      totalLinks: linkGraph.totalLinks,
      totalClickables: linkGraph.totalClickables,
      totalDropdowns: linkGraph.totalDropdowns,
      totalTabs: linkGraph.totalTabs
    },
    pagesWithForms: siteMap.filter(p => p.analysis?.forms?.length > 0).length,
    pagesWithTables: siteMap.filter(p => p.analysis?.tables?.length > 0).length,
    uniqueFormFields: [...new Set(
      siteMap.flatMap(p => p.analysis?.forms?.flatMap(f => f.fields?.map(field => field.name)) || [])
    )].filter(Boolean),
    tableHeaders: [...new Set(
      siteMap.flatMap(p => p.analysis?.tables?.flatMap(t => t.headers) || [])
    )].filter(Boolean)
  };

  fs.writeFileSync(
    path.join(REPORTS_DIR, "daily-logs-summary.json"),
    JSON.stringify(dailyLogSummary, null, 2)
  );

  console.log('✅ Reports generated in:', REPORTS_DIR);
}

// Main crawler
async function crawlDailyLogs() {
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

    // Start with the main daily logs page
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
      const result = await capturePage(page, currentUrl, pageName, 'daily-logs');

      if (result) {
        // Look for and capture tabs first (important for daily logs)
        await captureTabs(page, currentUrl, pageName);

        // Look for and capture dropdowns
        await captureDropdowns(page, currentUrl, pageName);

        // Look for and capture date pickers
        await captureDatePicker(page, currentUrl, pageName);

        // Look for and capture create/add dialogs
        await captureCreateDialogs(page, currentUrl, pageName);
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
crawlDailyLogs().catch(console.error);
