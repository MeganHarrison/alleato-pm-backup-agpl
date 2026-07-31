import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========= CONFIG ===========
// Use absolute path from project root
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, "documentation/*project-mgmt/active/submittals/crawl-submittals");
const WAIT_TIME = 3000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Starting URL - Submittals list view
const START_URL = "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools/submittals?view=list&serializer_view=minimal_list&filters%5Bball_in_court_id%5D%5B%5D=12808642&sort%5Battribute%5D=number&sort%5Bdirection%5D=desc&per_page=150&page=1";

// Project and company IDs for URL filtering
const PROJECT_ID = "562949954728542";
const COMPANY_ID = "562949953443325";

// Procore credentials
const PROCORE_EMAIL = "bclymer@alleatogroup.com";
const PROCORE_PASSWORD = "Clymer926!";

console.log('Output directory:', OUTPUT_DIR);

// Create directories
[OUTPUT_DIR, SCREENSHOT_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created directory:', dir);
  }
});

// Store all page information for sitemap generation
const siteMap = [];
const visitedUrls = new Set();

function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .substring(0, 100);
}

function generatePageId(url, name) {
  const sanitized = sanitizeFilename(name || url);
  return sanitized || "unknown_page";
}

// Enhanced page analysis for Submittals
async function analyzePageStructure(page) {
  return await page.evaluate(() => {
    const components = {
      buttons: document.querySelectorAll('button, input[type="button"], input[type="submit"], .btn').length,
      forms: document.querySelectorAll('form').length,
      inputs: document.querySelectorAll('input, textarea, select').length,
      tables: document.querySelectorAll('table').length,
      modals: document.querySelectorAll('.modal, .dialog, .popup, [role="dialog"]').length,
      tabs: document.querySelectorAll('[role="tab"], .tab, .tabs li').length,
      dropdowns: document.querySelectorAll('select, .dropdown').length,
      badges: document.querySelectorAll('[class*="badge"], [class*="status"], [class*="tag"]').length
    };

    const tables = Array.from(document.querySelectorAll('table')).map((table, index) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = table.querySelectorAll('tbody tr').length;
      return { index: index + 1, headers, rows, classes: table.className };
    });

    return {
      components,
      tables,
      title: document.title,
      h1: document.querySelector('h1')?.textContent.trim() || null
    };
  });
}

// Extract clickable elements and links
async function extractLinks(page, currentUrl) {
  return await page.evaluate((baseUrl) => {
    const links = [];
    const clickables = [];
    const dropdowns = [];

    document.querySelectorAll('a[href]').forEach((link, index) => {
      const href = link.href;
      const text = link.textContent.trim();
      const isProcore = href.includes('procore.com') && !href.includes('support.procore') && !href.includes('community.procore');

      if (isProcore && href !== baseUrl && !href.includes('javascript:') && !href.includes('#')) {
        links.push({ href, text, classes: link.className, index });
      }
    });

    document.querySelectorAll('button, [role="button"], .btn').forEach((el, index) => {
      clickables.push({
        text: el.textContent.trim().substring(0, 50),
        classes: el.className,
        type: el.tagName.toLowerCase(),
        index
      });
    });

    document.querySelectorAll('[class*="dropdown"], [aria-haspopup]').forEach((el, index) => {
      dropdowns.push({
        text: el.textContent.trim().substring(0, 50),
        classes: el.className,
        index
      });
    });

    return { links, clickables, dropdowns };
  }, currentUrl);
}

// Capture a single page
async function capturePage(page, url, pageName, category = "submittals") {
  try {
    console.log(`\n📸 Capturing: ${pageName}`);
    console.log(`   URL: ${url.substring(0, 100)}...`);

    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(WAIT_TIME);

    const pageId = generatePageId(url, pageName);
    const pageDir = path.join(SCREENSHOT_DIR, pageId);

    if (!fs.existsSync(pageDir)) {
      fs.mkdirSync(pageDir, { recursive: true });
    }

    const screenshotPath = path.join(pageDir, "screenshot.png");
    await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 60000 });

    const htmlContent = await page.content();
    fs.writeFileSync(path.join(pageDir, "dom.html"), htmlContent);

    const analysis = await analyzePageStructure(page);
    const { links, clickables, dropdowns } = await extractLinks(page, url);

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
      screenshotPath: `pages/${pageId}/screenshot.png`
    };

    fs.writeFileSync(path.join(pageDir, "metadata.json"), JSON.stringify(metadata, null, 2));
    siteMap.push(metadata);

    console.log(`   ✅ Captured: ${links.length} links, ${clickables.length} clickables, ${dropdowns.length} dropdowns`);
    return { metadata, links, clickables, dropdowns };
  } catch (error) {
    console.error(`   ❌ Error capturing ${pageName}:`, error.message);
    return null;
  }
}

// Capture dropdowns
async function captureDropdowns(page, pageUrl, pageName) {
  console.log(`\n🎯 Looking for dropdowns on: ${pageName}`);

  const dropdownSelectors = [
    'button[aria-haspopup="menu"]',
    'button[aria-haspopup="listbox"]',
    '[data-testid*="actions"]',
    'button:has-text("Create")',
    'button:has-text("Export")',
    'button:has-text("Reports")',
    'button:has-text("Actions")',
    '[class*="dropdown-toggle"]'
  ];

  let dropdownCount = 0;

  for (const selector of dropdownSelectors) {
    try {
      const elements = await page.$$(selector);

      for (let i = 0; i < elements.length && dropdownCount < 8; i++) {
        const element = elements[i];
        const isVisible = await element.isVisible().catch(() => false);
        if (!isVisible) continue;

        const text = await element.textContent().catch(() => '');
        console.log(`   🔍 Found dropdown: "${text?.trim().substring(0, 30) || 'unlabeled'}"`);

        try {
          await element.click();
          await page.waitForTimeout(1000);

          const dropdownPageId = `${sanitizeFilename(pageName)}_dropdown_${dropdownCount + 1}`;
          const dropdownDir = path.join(SCREENSHOT_DIR, dropdownPageId);

          if (!fs.existsSync(dropdownDir)) {
            fs.mkdirSync(dropdownDir, { recursive: true });
          }

          await page.screenshot({ path: path.join(dropdownDir, "screenshot.png"), fullPage: true });

          const menuItems = await page.evaluate(() => {
            const items = [];
            const selectors = ['[role="menu"] a', '[role="menu"] button', '[role="menuitem"]', '.dropdown-menu a'];
            selectors.forEach(sel => {
              document.querySelectorAll(sel).forEach(item => {
                const rect = item.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  items.push({ text: item.textContent.trim(), href: item.href || null });
                }
              });
            });
            return items;
          });

          console.log(`   📋 Found ${menuItems.length} menu items`);

          fs.writeFileSync(
            path.join(dropdownDir, "metadata.json"),
            JSON.stringify({ parentPage: pageName, parentUrl: pageUrl, dropdownIndex: dropdownCount + 1, menuItems, timestamp: new Date().toISOString() }, null, 2)
          );

          dropdownCount++;
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        } catch (err) {
          await page.keyboard.press('Escape').catch(() => {});
        }
      }
    } catch (err) {
      // Continue to next selector
    }
  }
}

// Generate reports
function generateReport() {
  console.log('\n📊 Generating comprehensive report...');

  let tableContent = `# Procore Submittals Crawl Sitemap\n\n`;
  tableContent += `**Generated:** ${new Date().toISOString()}\n\n`;
  tableContent += `**Total Pages:** ${siteMap.length}\n\n`;
  tableContent += `| Page Name | Category | Links | Clickables | Dropdowns | Screenshot |\n`;
  tableContent += `|-----------|----------|-------|------------|-----------|------------|\n`;

  siteMap.forEach(page => {
    tableContent += `| ${page.pageName} | ${page.category} | ${page.links} | ${page.clickables} | ${page.dropdowns} | [View](${page.screenshotPath}) |\n`;
  });

  fs.writeFileSync(path.join(REPORTS_DIR, "sitemap-table.md"), tableContent);

  fs.writeFileSync(path.join(REPORTS_DIR, "detailed-report.json"), JSON.stringify(siteMap, null, 2));

  const linkGraph = {
    totalPages: siteMap.length,
    totalLinks: siteMap.reduce((sum, page) => sum + page.links, 0),
    totalClickables: siteMap.reduce((sum, page) => sum + page.clickables, 0),
    pages: siteMap.map(page => ({
      name: page.pageName,
      url: page.url,
      outgoingLinks: page.linkDetails.map(l => l.href)
    }))
  };

  fs.writeFileSync(path.join(REPORTS_DIR, "link-graph.json"), JSON.stringify(linkGraph, null, 2));
  console.log('✅ Reports generated in:', REPORTS_DIR);
}

// Main crawler - focused on Procore app only
async function crawlSubmittals() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    console.log('🔐 Logging into Procore...');

    await page.goto('https://login.procore.com/');
    await page.waitForTimeout(2000);

    await page.fill('input[type="email"]', PROCORE_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.fill('input[type="password"]', PROCORE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    console.log('✅ Logged in successfully');

    // Define key pages to capture - focused on Procore app
    const pagesToCapture = [
      { url: START_URL, name: 'submittals-list-view-filtered' },
      { url: `https://us02.procore.com/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/submittals?view=list`, name: 'submittals-list-view' },
      { url: `https://us02.procore.com/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/submittals/settings?view=general`, name: 'submittals-settings-general' },
      { url: `https://us02.procore.com/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/submittals/settings?view=workflow`, name: 'submittals-settings-workflow' },
      { url: `https://us02.procore.com/webclients/host/companies/${COMPANY_ID}/projects/${PROJECT_ID}/tools/submittals/settings?view=custom_fields`, name: 'submittals-settings-custom-fields' },
      { url: `https://us02.procore.com/${PROJECT_ID}/project/submittals/configure`, name: 'submittals-configure' },
      { url: `https://us02.procore.com/${PROJECT_ID}/project/submittals/new`, name: 'submittals-create-new' },
    ];

    // First capture all defined pages
    for (const pageInfo of pagesToCapture) {
      if (!visitedUrls.has(pageInfo.url)) {
        visitedUrls.add(pageInfo.url);
        const result = await capturePage(page, pageInfo.url, pageInfo.name);
        if (result) {
          await captureDropdowns(page, pageInfo.url, pageInfo.name);
        }
      }
    }

    // Now find and capture individual submittal items from the list
    console.log('\n📋 Looking for individual submittal items...');

    await page.goto(pagesToCapture[1].url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Look for submittal row links
    const submittalLinks = await page.evaluate(() => {
      const links = [];
      // Look for links to individual submittals
      document.querySelectorAll('a[href*="submittals/"]').forEach(link => {
        const href = link.href;
        // Match submittal detail pages (numeric IDs)
        if (href.match(/submittals\/\d+/) && !links.some(l => l.href === href)) {
          links.push({
            href,
            text: link.textContent.trim().substring(0, 50)
          });
        }
      });
      return links.slice(0, 5); // Get first 5 submittals
    });

    console.log(`   Found ${submittalLinks.length} submittal items to capture`);

    for (let i = 0; i < submittalLinks.length; i++) {
      const link = submittalLinks[i];
      if (!visitedUrls.has(link.href)) {
        visitedUrls.add(link.href);
        const result = await capturePage(page, link.href, `submittal-detail-${i + 1}`);
        if (result) {
          await captureDropdowns(page, link.href, `submittal-detail-${i + 1}`);

          // Try to capture tabs on detail page
          const tabs = await page.$$('[role="tab"]');
          for (let t = 0; t < tabs.length && t < 5; t++) {
            try {
              const tab = tabs[t];
              const isVisible = await tab.isVisible().catch(() => false);
              const isSelected = await tab.getAttribute('aria-selected');

              if (isVisible && isSelected !== 'true') {
                const tabText = await tab.textContent().catch(() => `tab-${t}`);
                console.log(`   📑 Clicking tab: "${tabText?.trim()}"`);

                await tab.click();
                await page.waitForTimeout(2000);

                const tabPageId = `submittal-detail-${i + 1}_tab_${sanitizeFilename(tabText || `tab-${t}`)}`;
                const tabDir = path.join(SCREENSHOT_DIR, tabPageId);

                if (!fs.existsSync(tabDir)) {
                  fs.mkdirSync(tabDir, { recursive: true });
                }

                await page.screenshot({ path: path.join(tabDir, "screenshot.png"), fullPage: true });
                fs.writeFileSync(
                  path.join(tabDir, "metadata.json"),
                  JSON.stringify({ parentPage: `submittal-detail-${i + 1}`, tabName: tabText?.trim(), timestamp: new Date().toISOString() }, null, 2)
                );
              }
            } catch (err) {
              // Continue to next tab
            }
          }
        }
      }
    }

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

crawlSubmittals().catch(console.error);
