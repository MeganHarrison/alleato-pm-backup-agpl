import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========= CONFIG ===========
const OUTPUT_DIR = path.resolve(__dirname, "../../playwright-procore-crawl/procore-crawls/documents/crawl-documents");
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Starting URLs
const START_URL = "https://us02.procore.com/webclients/host/companies/562949953443325/projects/562949954728542/tools/documents";
const PROJECT_ID = "562949954728542";
const COMPANY_ID = "562949953443325";

function isRelevantUrl(url) {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();

  if (!url.includes("procore.com")) return false;
  if (lowerUrl.includes("login.procore.com")) return false;
  if (lowerUrl.includes("support.procore.com")) return false;
  if (lowerUrl.includes("help.procore.com")) return false;

  const inDocuments =
    lowerUrl.includes("/documents") ||
    lowerUrl.includes("tools/documents") ||
    lowerUrl.includes("folder") ||
    lowerUrl.includes("document") ||
    lowerUrl.includes("doc_files");

  const inProjectScope = lowerUrl.includes(PROJECT_ID) || lowerUrl.includes(COMPANY_ID);

  return inDocuments && inProjectScope;
}

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
      breadcrumbs: document.querySelectorAll('[class*="breadcrumb"], nav[aria-label*="Breadcrumb" i]').length,
      searchInputs: document.querySelectorAll('input[type="search"], input[placeholder*="search" i], [aria-label*="search" i]').length,
      uploadInputs: document.querySelectorAll('input[type="file"], [class*="upload"], [class*="dropzone"], [data-upload]').length,
      treeNodes: document.querySelectorAll('[role="treeitem"], [class*="tree"], [data-folder-id]').length
    };

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

    const breadcrumbTrail = Array.from(document.querySelectorAll('[class*="breadcrumb"] li, nav[aria-label*="Breadcrumb" i] a')).map(el => el.textContent.trim()).filter(Boolean);

    const folderNodes = Array.from(
      document.querySelectorAll('[data-folder-id], [data-qa*="folder"], [class*="folder"], [role="treeitem"]')
    )
      .slice(0, 50)
      .map(node => ({
        text: node.textContent.trim().substring(0, 80),
        id: node.getAttribute('data-folder-id') || node.id || null,
        expanded: node.getAttribute('aria-expanded') || null
      }));

    const fileRows = Array.from(document.querySelectorAll('[role="row"], table tbody tr'))
      .slice(0, 50)
      .map((row, index) => {
        const cells = Array.from(row.querySelectorAll('td, [role="gridcell"]')).map(cell => cell.textContent.trim().substring(0, 80));
        return {
          index,
          cells,
          classes: row.className
        };
      });

    return {
      components,
      tables,
      forms,
      breadcrumbTrail,
      folderNodes,
      fileRows,
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
async function capturePage(page, url, pageName, category = "documents") {
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

    return { links, clickables, dropdowns };
  } catch (error) {
    console.error(`   ❌ Error capturing ${pageName}:`, error.message);
    return { links: [], clickables: [], dropdowns: [] };
  }
}

// Explore dropdown menus
async function exploreDropdowns(page, pageId, dropdowns) {
  console.log(`   🔽 Exploring ${dropdowns.length} dropdowns...`);

  for (let i = 0; i < Math.min(dropdowns.length, 5); i++) {
    try {
      const dropdown = dropdowns[i];
      const selector = dropdown.id ? `#${dropdown.id}` : `.${dropdown.classes.split(' ')[0]}`;

      await page.locator(selector).first().click();
      await page.waitForTimeout(1000);

      const dropdownPageId = `${pageId}_dropdown_${i}`;
      const dropdownDir = path.join(SCREENSHOT_DIR, dropdownPageId);
      if (!fs.existsSync(dropdownDir)) {
        fs.mkdirSync(dropdownDir, { recursive: true });
      }

      await page.screenshot({
        path: path.join(dropdownDir, "screenshot.png"),
        fullPage: true
      });

      const metadata = {
        url: page.url(),
        pageName: `${pageId} - Dropdown ${i + 1}`,
        category: "documents",
        pageId: dropdownPageId,
        timestamp: new Date().toISOString(),
        dropdownIndex: i,
        dropdownInfo: dropdown
      };

      fs.writeFileSync(
        path.join(dropdownDir, "metadata.json"),
        JSON.stringify(metadata, null, 2)
      );

      console.log(`      ✅ Captured dropdown ${i + 1}`);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } catch (error) {
      console.log(`      ⚠️  Could not capture dropdown ${i + 1}`);
    }
  }
}

// Generate comprehensive reports
async function generateReports() {
  console.log(`\n📊 Generating reports...`);

  // Sort sitemap by category and page name
  siteMap.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.pageName.localeCompare(b.pageName);
  });

  // Generate Markdown sitemap table
  let markdownTable = `# Documents Sitemap\n\n`;
  markdownTable += `**Generated:** ${new Date().toISOString()}\n`;
  markdownTable += `**Total Pages:** ${siteMap.length}\n\n`;
  markdownTable += `| Page Name | URL | Screenshot | Links | Clickables | Dropdowns |\n`;
  markdownTable += `|-----------|-----|------------|-------|------------|-----------|\n`;

  siteMap.forEach(page => {
    const screenshotLink = `[View](../${page.screenshotPath})`;
    markdownTable += `| ${page.pageName} | [${page.url.substring(0, 50)}...](${page.url}) | ${screenshotLink} | ${page.links} | ${page.clickables} | ${page.dropdowns} |\n`;
  });

  fs.writeFileSync(path.join(REPORTS_DIR, "sitemap-table.md"), markdownTable);

  // Generate detailed JSON report
  const detailedReport = {
    generatedAt: new Date().toISOString(),
    feature: "Documents",
    startUrl: START_URL,
    totalPages: siteMap.length,
    pages: siteMap
  };

  fs.writeFileSync(
    path.join(REPORTS_DIR, "detailed-report.json"),
    JSON.stringify(detailedReport, null, 2)
  );

  // Generate link graph
  const linkGraph = {
    nodes: siteMap.map(page => ({
      id: page.pageId,
      name: page.pageName,
      url: page.url,
      links: page.links
    })),
    edges: []
  };

  siteMap.forEach(page => {
    page.linkDetails.forEach(link => {
      const targetPage = siteMap.find(p => p.url === link.href);
      if (targetPage) {
        linkGraph.edges.push({
          source: page.pageId,
          target: targetPage.pageId,
          text: link.text
        });
      }
    });
  });

  fs.writeFileSync(
    path.join(REPORTS_DIR, "link-graph.json"),
    JSON.stringify(linkGraph, null, 2)
  );

  console.log(`   ✅ Generated sitemap-table.md`);
  console.log(`   ✅ Generated detailed-report.json`);
  console.log(`   ✅ Generated link-graph.json`);
}

// Main crawl execution
async function main() {
  console.log(`\n🚀 Starting Documents Crawl...\n`);
  console.log(`📍 Start URL: ${START_URL}`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    let authenticated = false;

    try {
      const authPath = path.resolve(__dirname, "../auth.json");
      if (fs.existsSync(authPath)) {
        const authData = JSON.parse(fs.readFileSync(authPath, "utf8"));
        if (authData.cookies?.length) {
          await context.addCookies(authData.cookies);
          console.log("✅ Loaded cookies from auth.json");
        }
      }
    } catch (error) {
      console.log("⚠️  Could not load auth.json, continuing with login flow");
    }

    // Try navigating with stored cookies first
    await page.goto(START_URL, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    const loginVisible = await page.locator('input[name="email"]').first().isVisible().catch(() => false);

    if (!loginVisible) {
      authenticated = true;
      console.log("   ✅ Session valid via stored cookies\n");
    } else {
      console.log("🔐 Logging in to Procore...");
      await page.fill('input[name="email"]', PROCORE_EMAIL);
      await page.fill('input[name="password"]', PROCORE_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ timeout: 30000 });
      authenticated = true;
      console.log("   ✅ Login successful\n");
    }

    if (!authenticated) {
      throw new Error("Authentication failed");
    }

    // Start crawling
    urlQueue.push({ url: START_URL, name: "documents_main" });
    let pagesProcessed = 0;
    const maxPages = 50;

    while (urlQueue.length > 0 && pagesProcessed < maxPages) {
      const { url, name } = urlQueue.shift();

      if (visitedUrls.has(url)) continue;

      const { links, dropdowns } = await capturePage(page, url, name);
      await exploreDropdowns(page, name, dropdowns);

      visitedUrls.add(url);
      pagesProcessed++;

      // Queue discovered links (limit to same feature)
      links.slice(0, 15).forEach(link => {
        if (!visitedUrls.has(link.href) && isRelevantUrl(link.href)) {
          urlQueue.push({
            url: link.href,
            name: sanitizeFilename(link.text) || `page_${urlQueue.length}`
          });
        }
      });

      console.log(`   Progress: ${pagesProcessed}/${maxPages} pages crawled\n`);
    }

    // Generate final reports
    await generateReports();

    console.log(`\n✅ Crawl Complete!`);
    console.log(`📊 Statistics:`);
    console.log(`   - Pages captured: ${visitedUrls.size}`);
    console.log(`   - Total captures: ${siteMap.length}`);
    console.log(`\n📁 Output location: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error("\n❌ Crawl failed:", error);
  } finally {
    await browser.close();
  }
}

main();
