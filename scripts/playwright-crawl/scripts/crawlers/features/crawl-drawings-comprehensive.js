import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const FEATURE_NAME = "drawings";
const OUTPUT_DIR = "./playwright-procore-crawl/procore-crawls/drawings/crawl-drawings";
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Headless mode toggle (set HEADLESS=false in env to see browser)
const HEADLESS = process.env.HEADLESS !== "false";

// Maximum pages to crawl (safety limit)
const MAX_PAGES = 50;

// Starting URLs - Drawings feature (main views, NOT individual docs)
const START_URL = "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools/drawings/areas/562949954293344/revisions?tab=revisions&filter_drawing_set=current";

// Additional drawings-related URLs to explore - FOCUS ON FUNCTIONALITY
const ADDITIONAL_URLS = [
  // Main drawings list/area views
  "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools/drawings",
  "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools/drawings/areas",
  // Fullscreen viewer with annotations/markup tools
  "https://us02.procore.com/562949954728542/project/drawing_areas/562949954293344/drawing_log/view_fullscreen/562950055386240?return_action=list&filter_drawing_set=current&page=1&page_size=150&total=0&search_string=&tab=revisions",
  // Configuration/settings if available
  "https://us02.procore.com/562949954728542/project/drawings/settings"
];

// Procore credentials
const PROCORE_EMAIL = "bclymer@alleatogroup.com";
const PROCORE_PASSWORD = "Clymer926!";

// ========= RESUME/IDEMPOTENCY ===========
const MANIFEST_PATH = path.join(OUTPUT_DIR, "crawl-manifest.json");
const VISITED_URLS_PATH = path.join(OUTPUT_DIR, "visitedUrls.json");

// Create directories
[OUTPUT_DIR, SCREENSHOT_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ========= NETWORK REQUEST CAPTURE ===========
const networkRequests = [];
const apiEndpoints = new Map(); // Deduplicated API endpoints

function setupNetworkCapture(page) {
  page.on('request', request => {
    const url = request.url();
    const method = request.method();

    // Filter for API calls (XHR/fetch, not static resources)
    if (
      (url.includes('/api/') || url.includes('/v1/') || url.includes('/rest/') || url.includes('graphql')) &&
      !url.includes('.js') && !url.includes('.css') && !url.includes('.png') && !url.includes('.jpg')
    ) {
      const requestData = {
        url,
        method,
        resourceType: request.resourceType(),
        postData: request.postData() || null,
        timestamp: new Date().toISOString()
      };
      networkRequests.push(requestData);

      // Track unique endpoints
      const endpoint = new URL(url).pathname;
      if (!apiEndpoints.has(endpoint)) {
        apiEndpoints.set(endpoint, { endpoint, methods: new Set([method]), sampleUrl: url });
      } else {
        apiEndpoints.get(endpoint).methods.add(method);
      }
    }
  });

  page.on('response', async response => {
    const url = response.url();
    const status = response.status();

    if ((url.includes('/api/') || url.includes('/v1/') || url.includes('/rest/') || url.includes('graphql'))) {
      const matchingRequest = networkRequests.find(r => r.url === url && !r.response);
      if (matchingRequest) {
        matchingRequest.response = { status, statusText: response.statusText() };
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json') && status === 200) {
            const body = await response.json();
            matchingRequest.response.bodySample = JSON.stringify(body).substring(0, 1000);
          }
        } catch { /* Response body not available */ }
      }
    }
  });
}

// ========= STATE MANAGEMENT ===========
let siteMap = [];
let visitedUrls = new Set();
const urlQueue = [];

function loadPreviousState() {
  try {
    if (fs.existsSync(VISITED_URLS_PATH)) {
      const data = JSON.parse(fs.readFileSync(VISITED_URLS_PATH, 'utf8'));
      visitedUrls = new Set(data);
      console.log(`📂 Resumed: Loaded ${visitedUrls.size} previously visited URLs`);
    }
    if (fs.existsSync(MANIFEST_PATH)) {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      siteMap = manifest.pages || [];
      console.log(`📂 Resumed: Loaded ${siteMap.length} previously captured pages`);
    }
  } catch {
    console.log('📂 Starting fresh crawl (no previous state found)');
  }
}

function saveState() {
  fs.writeFileSync(VISITED_URLS_PATH, JSON.stringify([...visitedUrls], null, 2));
  const manifest = {
    feature: FEATURE_NAME,
    startUrl: START_URL,
    lastUpdated: new Date().toISOString(),
    totalPages: siteMap.length,
    pages: siteMap
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// ========= PAGE ROLE CLASSIFICATION ===========
function classifyPageRole(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('view_fullscreen') || urlLower.includes('viewer')) return 'viewer';
  if (urlLower.includes('markup') || urlLower.includes('annotate')) return 'markup';
  if (urlLower.includes('settings') || urlLower.includes('configure')) return 'settings';
  if (urlLower.includes('upload') || urlLower.includes('import')) return 'upload';
  if (urlLower.includes('compare')) return 'compare';
  if (urlLower.includes('revisions')) return 'revisions-list';
  if (urlLower.includes('areas')) return 'areas-list';
  if (urlLower.includes('/drawings') && !urlLower.includes('drawing_log')) return 'drawings-list';
  return 'drawings';
}

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

// Enhanced page analysis for Drawings
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
      // Drawings-specific components
      drawingPreviews: document.querySelectorAll('[class*="drawing"], [class*="preview"], canvas, img[src*="drawing"]').length,
      revisionIndicators: document.querySelectorAll('[class*="revision"], [class*="version"]').length,
      uploadButtons: document.querySelectorAll('[class*="upload"], input[type="file"]').length,
      areaFolders: document.querySelectorAll('[class*="folder"], [class*="area"], [class*="tree"]').length,
      markupTools: document.querySelectorAll('[class*="markup"], [class*="annotate"], [class*="tool"]').length
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

    // Find drawing-specific elements
    const drawingElements = {
      drawingAreas: Array.from(document.querySelectorAll('[class*="area"], [class*="folder"]')).map(el => ({
        text: el.textContent.trim().substring(0, 100),
        classes: el.className
      })).slice(0, 20),
      revisions: Array.from(document.querySelectorAll('[class*="revision"], [class*="version"]')).map(el => ({
        text: el.textContent.trim().substring(0, 100),
        classes: el.className
      })).slice(0, 20),
      drawings: Array.from(document.querySelectorAll('[class*="drawing"], [class*="sheet"]')).map(el => ({
        text: el.textContent.trim().substring(0, 100),
        classes: el.className
      })).slice(0, 20)
    };

    return {
      components,
      tables,
      drawingElements,
      title: document.title,
      h1: document.querySelector('h1')?.textContent.trim() || null,
      breadcrumbs: Array.from(document.querySelectorAll('[class*="breadcrumb"] a, nav[aria-label*="breadcrumb"] a')).map(a => ({
        text: a.textContent.trim(),
        href: a.href
      }))
    };
  });
}

// Extract all clickable elements and links - focused on drawings URLs
async function extractLinks(page, currentUrl) {
  return await page.evaluate((baseUrl) => {
    const links = [];
    const clickables = [];

    // Extract all anchor links
    document.querySelectorAll('a[href]').forEach((link, index) => {
      const href = link.href;
      const text = link.textContent.trim();
      const isExternal = !href.includes('procore.com');

      // Focus on drawings-related URLs
      const isDrawingsRelated = href.includes('drawing') ||
                               href.includes('area') ||
                               href.includes('revision') ||
                               href.includes('562949954728542'); // Project ID

      if (!isExternal && href !== baseUrl && !href.includes('javascript:') && !href.includes('#')) {
        links.push({
          href,
          text,
          classes: link.className,
          id: link.id || null,
          isDrawingsRelated,
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

    // Extract dropdown menus and action menus
    const dropdowns = [];
    document.querySelectorAll('[class*="dropdown"], [class*="menu"], [class*="more"], [aria-haspopup], [class*="action"]').forEach((el, index) => {
      dropdowns.push({
        text: el.textContent.trim().substring(0, 50),
        classes: el.className,
        id: el.id || null,
        hasMenu: el.querySelector('ul, [role="menu"]') !== null,
        index
      });
    });

    // Extract tabs for different views
    const tabs = Array.from(document.querySelectorAll('[role="tab"], .tab, [class*="tab"]')).map((tab, index) => ({
      text: tab.textContent.trim(),
      isSelected: tab.getAttribute('aria-selected') === 'true' || tab.classList.contains('active'),
      classes: tab.className,
      index
    }));

    return { links, clickables, dropdowns, tabs };
  }, currentUrl);
}

// Capture a single page with comprehensive analysis
async function capturePage(page, url, pageName, category = "drawings") {
  try {
    console.log(`\n📸 Capturing: ${pageName}`);
    console.log(`   URL: ${url}`);

    // Navigate to page
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForTimeout(WAIT_TIME);

    // Wait for drawings content to load
    try {
      await page.waitForSelector('[class*="drawing"], [class*="area"], table, [class*="list"]', { timeout: 10000 });
    } catch (e) {
      console.log('   ⏳ No specific drawing elements found, continuing...');
    }

    // Create page directory
    const pageId = generatePageId(url, pageName);
    const pageDir = path.join(SCREENSHOT_DIR, pageId);
    if (!fs.existsSync(pageDir)) {
      fs.mkdirSync(pageDir, { recursive: true });
    }

    // Capture screenshot (viewport only to avoid timeout issues)
    const screenshotPath = path.join(pageDir, "screenshot.png");
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
      timeout: 30000
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

    // Add new drawings-related links to queue (prioritize)
    links.forEach(link => {
      if (!visitedUrls.has(link.href) && !urlQueue.includes(link.href)) {
        // Prioritize drawings-related URLs
        if (link.isDrawingsRelated) {
          urlQueue.unshift(link.href); // Add to front
        } else {
          urlQueue.push(link.href);
        }
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
      'button[aria-label*="actions"]',
      'button[aria-label*="settings"]',
      'button[aria-haspopup="menu"]',
      '[class*="dropdown-toggle"]',
      'button:has(svg[class*="dots"])',
      'button:has([class*="icon-more"])',
      '[class*="action-menu"]',
      // Drawings-specific
      '[class*="upload"]',
      '[class*="add-drawing"]',
      '[class*="new-area"]',
      '[class*="compare"]',
      '[class*="markup"]'
    ];

    for (const selector of dropdownSelectors) {
      const elements = await page.$$(selector);

      for (let i = 0; i < Math.min(elements.length, 5); i++) { // Limit to 5 per selector
        try {
          const element = elements[i];
          const text = await element.textContent();
          const isVisible = await element.isVisible();

          if (!isVisible) continue;

          console.log(`   🔍 Found dropdown trigger: "${text?.trim().substring(0, 30) || 'unlabeled'}"`);

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
            fullPage: false,
            timeout: 15000
          });

          // Extract menu items
          const menuItems = await page.evaluate(() => {
            const items = [];
            const menuSelectors = [
              '[role="menu"] a',
              '[role="menu"] button',
              '[role="menuitem"]',
              '.dropdown-menu a',
              '.dropdown-menu button',
              '[class*="menu-item"]',
              'ul[class*="dropdown"] a',
              'ul[class*="menu"] a',
              '[class*="option"]'
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
            if (menuItem.href && !visitedUrls.has(menuItem.href) && menuItem.href.includes('procore.com')) {
              urlQueue.push(menuItem.href);
            }
          }

          // Close dropdown
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);

        } catch (err) {
          console.error(`   ⚠️  Error with dropdown ${i}:`, err.message);
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
    // FIRST: Dismiss any modal overlays that might block clicks
    try {
      await page.evaluate(() => {
        document.querySelectorAll('[class*="ModalScrim"], [class*="Overlay"], [class*="modal-backdrop"]').forEach(el => {
          el.remove();
        });
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } catch {
      // Overlay dismissal failed, continue anyway
    }

    const tabSelectors = [
      '[role="tab"]',
      '[class*="tab"]:not([class*="table"])',
      '.nav-tab',
      '[data-tab]'
    ];

    for (const selector of tabSelectors) {
      const tabs = await page.$$(selector);

      for (let i = 0; i < Math.min(tabs.length, 8); i++) { // Limit to 8 tabs per selector
        try {
          const tab = tabs[i];
          const text = await tab.textContent();
          const isVisible = await tab.isVisible();
          const isSelected = await tab.getAttribute('aria-selected');

          if (!isVisible || isSelected === 'true') continue;

          console.log(`   📑 Clicking tab: "${text?.trim()}"`);

          // Short timeout for tab clicks
          await tab.click({ timeout: 5000 });
          await page.waitForTimeout(1500);
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

          // Capture the tab view
          const tabPageId = generatePageId(pageUrl, `${pageName}_tab_${sanitizeFilename(text || i)}`);
          const tabDir = path.join(SCREENSHOT_DIR, tabPageId);
          if (!fs.existsSync(tabDir)) {
            fs.mkdirSync(tabDir, { recursive: true });
          }

          await page.screenshot({
            path: path.join(tabDir, "screenshot.png"),
            fullPage: false,
            timeout: 15000
          });

          // Save tab metadata
          fs.writeFileSync(
            path.join(tabDir, "metadata.json"),
            JSON.stringify({
              parentPage: pageName,
              parentUrl: pageUrl,
              tabName: text?.trim() || `tab_${i}`,
              tabIndex: i,
              timestamp: new Date().toISOString()
            }, null, 2)
          );

          siteMap.push({
            url: pageUrl,
            pageName: `${pageName} - ${text?.trim() || 'Tab ' + i}`,
            category: 'drawings-tab',
            pageId: tabPageId,
            timestamp: new Date().toISOString(),
            screenshotPath: `pages/${tabPageId}/screenshot.png`
          });

        } catch (err) {
          console.error(`   ⚠️  Error with tab ${i}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing tabs:`, error.message);
  }
}

// Capture drawing areas/folders
async function captureDrawingAreas(page, pageUrl, pageName) {
  console.log(`\n📁 Looking for drawing areas/folders on: ${pageName}`);

  try {
    const areaSelectors = [
      '[class*="area"]',
      '[class*="folder"]',
      '[class*="tree-item"]',
      '[class*="category"]',
      'li[class*="nav"]'
    ];

    for (const selector of areaSelectors) {
      const areas = await page.$$(selector);

      for (let i = 0; i < Math.min(areas.length, 10); i++) {
        try {
          const area = areas[i];
          const text = await area.textContent();
          const isVisible = await area.isVisible();
          const link = await area.$('a');

          if (!isVisible) continue;

          if (link) {
            const href = await link.getAttribute('href');
            if (href && !visitedUrls.has(href)) {
              console.log(`   📁 Found area link: "${text?.trim().substring(0, 30)}"`);
              urlQueue.unshift(href.startsWith('http') ? href : `https://us02.procore.com${href}`);
            }
          }
        } catch (err) {
          // Skip problematic elements
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing drawing areas:`, error.message);
  }
}

// Generate comprehensive report
function generateReport() {
  console.log('\n📊 Generating comprehensive report...');

  // Generate sitemap table
  let tableContent = `# Procore Drawings Crawl Sitemap\n\n`;
  tableContent += `**Generated:** ${new Date().toISOString()}\n\n`;
  tableContent += `**Total Pages:** ${siteMap.length}\n\n`;
  tableContent += `**API Endpoints Discovered:** ${apiEndpoints.size}\n\n`;
  tableContent += `| Page Name | Role | Links | Clickables | Dropdowns | Screenshot |\n`;
  tableContent += `|-----------|------|-------|------------|-----------|------------|\n`;

  siteMap.forEach(page => {
    const relPath = (page.screenshotPath || '').replace(/\\/g, '/');
    tableContent += `| ${page.pageName || 'Unknown'} | ${page.category || 'drawings'} | ${page.links || 0} | ${page.clickables || 0} | ${page.dropdowns || 0} | [View](../${relPath}) |\n`;
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
    totalLinks: siteMap.reduce((sum, page) => sum + (page.links || 0), 0),
    totalClickables: siteMap.reduce((sum, page) => sum + (page.clickables || 0), 0),
    pages: siteMap.map(page => ({
      name: page.pageName,
      url: page.url,
      outgoingLinks: (page.linkDetails || []).map(l => l.href)
    }))
  };

  fs.writeFileSync(
    path.join(REPORTS_DIR, "link-graph.json"),
    JSON.stringify(linkGraph, null, 2)
  );

  // ========= NETWORK CAPTURE REPORTS ===========
  // Save raw network requests
  fs.writeFileSync(
    path.join(REPORTS_DIR, "network-requests.json"),
    JSON.stringify(networkRequests, null, 2)
  );

  // Generate inferred API map
  const apiMap = {
    generated: new Date().toISOString(),
    feature: FEATURE_NAME,
    totalRequests: networkRequests.length,
    uniqueEndpoints: apiEndpoints.size,
    endpoints: Array.from(apiEndpoints.values()).map(ep => ({
      ...ep,
      methods: Array.from(ep.methods)
    }))
  };

  fs.writeFileSync(
    path.join(REPORTS_DIR, "inferred-api-map.json"),
    JSON.stringify(apiMap, null, 2)
  );

  // Generate markdown API map
  let apiMapMd = `# Inferred API Map - Drawings\n\n`;
  apiMapMd += `**Generated:** ${new Date().toISOString()}\n`;
  apiMapMd += `**Total Requests Captured:** ${networkRequests.length}\n`;
  apiMapMd += `**Unique Endpoints:** ${apiEndpoints.size}\n\n`;
  apiMapMd += `## Endpoints\n\n`;
  apiMapMd += `| Endpoint | Methods | Sample URL |\n`;
  apiMapMd += `|----------|---------|------------|\n`;

  Array.from(apiEndpoints.values()).forEach(ep => {
    apiMapMd += `| ${ep.endpoint} | ${Array.from(ep.methods).join(', ')} | ${ep.sampleUrl.substring(0, 60)}... |\n`;
  });

  fs.writeFileSync(
    path.join(REPORTS_DIR, "inferred-api-map.md"),
    apiMapMd
  );

  // Generate summary statistics
  const summary = {
    generated: new Date().toISOString(),
    feature: FEATURE_NAME,
    totalPages: siteMap.length,
    networkCapture: {
      totalRequests: networkRequests.length,
      uniqueEndpoints: apiEndpoints.size
    },
    pageRoles: {},
    drawingsFeatures: {
      viewerPages: siteMap.filter(p => p.category === 'viewer').length,
      areasFound: siteMap.filter(p => p.url?.includes('area')).length,
      revisionsFound: siteMap.filter(p => p.url?.includes('revision')).length,
      tabViews: siteMap.filter(p => p.category === 'drawings-tab').length
    }
  };

  siteMap.forEach(page => {
    const cat = page.category || 'other';
    summary.pageRoles[cat] = (summary.pageRoles[cat] || 0) + 1;
  });

  fs.writeFileSync(
    path.join(REPORTS_DIR, "summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log('✅ Reports generated in:', REPORTS_DIR);
  console.log('   - sitemap-table.md');
  console.log('   - detailed-report.json');
  console.log('   - link-graph.json');
  console.log('   - network-requests.json');
  console.log('   - inferred-api-map.json');
  console.log('   - inferred-api-map.md');
  console.log('   - summary.json');
}

// Main crawler
async function crawlDrawings() {
  // Load previous state for resume capability
  loadPreviousState();

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Setup network capture for API discovery
  setupNetworkCapture(page);

  try {
    console.log('🚀 Procore Drawings Crawler - Enhanced with Network Capture & Resume');
    console.log(`📂 Output: ${OUTPUT_DIR}`);
    console.log(`🔄 Resume: ${siteMap.length > 0 ? 'RESUMING' : 'FRESH START'}`);
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

    // Add all starting URLs to queue (skip already visited)
    if (!visitedUrls.has(START_URL)) urlQueue.push(START_URL);
    ADDITIONAL_URLS.forEach(url => {
      if (!urlQueue.includes(url) && !visitedUrls.has(url)) {
        urlQueue.push(url);
      }
    });

    let pageCount = siteMap.length; // Start from previous count if resuming

    while (urlQueue.length > 0 && pageCount < MAX_PAGES) {
      const currentUrl = urlQueue.shift();

      if (visitedUrls.has(currentUrl)) {
        continue;
      }

      // STRICT FILTER: Only crawl DRAWINGS-SPECIFIC URLs
      // Must contain 'drawing' or 'area' in the path - skip meetings, home, conversations, etc.
      const isDrawingsUrl = currentUrl.includes('/drawings') ||
                           currentUrl.includes('/drawing_') ||
                           currentUrl.includes('drawing_areas') ||
                           currentUrl.includes('drawing_log');

      if (!isDrawingsUrl) {
        console.log(`   ⏭️  Skipping non-drawings URL: ${currentUrl.substring(0, 60)}...`);
        continue;
      }

      // SKIP individual drawing document URLs (we want UI, not docs)
      // These typically have long numeric IDs at the end without 'view_fullscreen' or 'areas'
      const isIndividualDoc = /\/drawing_log\/\d+$/.test(currentUrl) && !currentUrl.includes('view_fullscreen');
      if (isIndividualDoc) {
        console.log(`   ⏭️  Skipping individual document: ${currentUrl.substring(0, 60)}...`);
        continue;
      }

      visitedUrls.add(currentUrl);
      pageCount++;

      // Classify page role
      const pageRole = classifyPageRole(currentUrl);

      // Determine page name from URL
      const urlParts = currentUrl.split('/');
      let pageName = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'unknown';

      // Better naming for drawings pages
      if (currentUrl.includes('view_fullscreen')) {
        pageName = 'drawings-viewer-fullscreen';
      } else if (currentUrl.includes('revisions')) {
        pageName = 'drawings-revisions';
      } else if (currentUrl.includes('areas')) {
        pageName = 'drawings-areas';
      } else if (currentUrl.includes('settings')) {
        pageName = 'drawings-settings';
      } else if (currentUrl.includes('drawing')) {
        pageName = 'drawings-' + pageName;
      }

      console.log(`\n📸 [${pageRole}] Capturing: ${pageName}`);

      // Capture the page
      const result = await capturePage(page, currentUrl, pageName, pageRole);

      if (result) {
        // Save state after each successful capture
        saveState();

        // Look for drawing areas/folders first
        await captureDrawingAreas(page, currentUrl, pageName);

        // Look for and capture tabs
        await captureTabs(page, currentUrl, pageName);

        // Look for and capture dropdowns (buttons, menus, etc.)
        await captureDropdowns(page, currentUrl, pageName);
      }

      console.log(`\n📊 Progress: ${pageCount}/${MAX_PAGES} pages captured, ${urlQueue.length} in queue`);
      console.log(`📡 Network: ${networkRequests.length} API calls, ${apiEndpoints.size} unique endpoints`);
    }

    // Generate final reports (including network capture)
    generateReport();

    console.log('\n✅ Crawl complete!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`📊 Total pages captured: ${siteMap.length}`);
    console.log(`📡 API calls captured: ${networkRequests.length}`);
    console.log(`🔌 Unique API endpoints: ${apiEndpoints.size}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    // Save state even on error for resume
    saveState();
  } finally {
    await browser.close();
  }
}

// Run the crawler
crawlDrawings().catch(console.error);
