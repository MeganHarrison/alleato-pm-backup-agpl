#!/usr/bin/env node

/**
 * Feature Crawler Template Generator
 *
 * Generates a custom Playwright crawl script for a specific Procore feature.
 *
 * Usage:
 *   node scripts/generate-crawler.js <feature-name> <start-url> [project-id]
 *
 * Example:
 *   node scripts/generate-crawler.js submittals https://us02.procore.com/562949954728542/project/submittals
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node generate-crawler.js <feature-name> <start-url> [project-id]");
  console.error("Example: node generate-crawler.js submittals https://us02.procore.com/562949954728542/project/submittals");
  process.exit(1);
}

const featureName = args[0];
const startUrl = args[1];
const projectId = args[2] || extractProjectId(startUrl) || "562949954728542";

// Extract project ID from URL if not provided
function extractProjectId(url) {
  const match = url.match(/\/(\d+)\//);
  return match ? match[1] : null;
}

// Sanitize feature name for file names
function sanitizeFeatureName(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const sanitizedFeatureName = sanitizeFeatureName(featureName);
const featureTitle = featureName.split("-").map(word =>
  word.charAt(0).toUpperCase() + word.slice(1)
).join(" ");

// Define output paths
const scriptPath = path.join(__dirname, `crawl-${sanitizedFeatureName}-comprehensive.js`);
const outputDir = `./documentation/*project-mgmt/in-progress/${sanitizedFeatureName}/crawl-${sanitizedFeatureName}`;

// Crawl script template
const crawlScriptTemplate = `import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "${outputDir}";
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Starting URLs
const START_URL = "${startUrl}";

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
    .replace(/[^a-z0-9\\-]/gi, "_")
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

    return {
      components,
      tables,
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
async function capturePage(page, url, pageName, category = "${sanitizedFeatureName}") {
  try {
    console.log(\`\\n📸 Capturing: \${pageName}\`);
    console.log(\`   URL: \${url}\`);

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
    console.log(\`   ✅ Captured: \${links.length} links, \${clickables.length} clickables, \${dropdowns.length} dropdowns\`);

    return { links, clickables, dropdowns };
  } catch (error) {
    console.error(\`   ❌ Error capturing \${pageName}:\`, error.message);
    return { links: [], clickables: [], dropdowns: [] };
  }
}

// Explore dropdown menus
async function exploreDropdowns(page, pageId, dropdowns) {
  console.log(\`   🔽 Exploring \${dropdowns.length} dropdowns...\`);

  for (let i = 0; i < Math.min(dropdowns.length, 5); i++) {
    try {
      const dropdown = dropdowns[i];
      const selector = dropdown.id ? \`#\${dropdown.id}\` : \`.\${dropdown.classes.split(' ')[0]}\`;

      await page.locator(selector).first().click();
      await page.waitForTimeout(1000);

      const dropdownPageId = \`\${pageId}_dropdown_\${i}\`;
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
        pageName: \`\${pageId} - Dropdown \${i + 1}\`,
        category: "${sanitizedFeatureName}",
        pageId: dropdownPageId,
        timestamp: new Date().toISOString(),
        dropdownIndex: i,
        dropdownInfo: dropdown
      };

      fs.writeFileSync(
        path.join(dropdownDir, "metadata.json"),
        JSON.stringify(metadata, null, 2)
      );

      console.log(\`      ✅ Captured dropdown \${i + 1}\`);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } catch (error) {
      console.log(\`      ⚠️  Could not capture dropdown \${i + 1}\`);
    }
  }
}

// Generate comprehensive reports
async function generateReports() {
  console.log(\`\\n📊 Generating reports...\`);

  // Sort sitemap by category and page name
  siteMap.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.pageName.localeCompare(b.pageName);
  });

  // Generate Markdown sitemap table
  let markdownTable = \`# ${featureTitle} Sitemap\\n\\n\`;
  markdownTable += \`**Generated:** \${new Date().toISOString()}\\n\`;
  markdownTable += \`**Total Pages:** \${siteMap.length}\\n\\n\`;
  markdownTable += \`| Page Name | URL | Screenshot | Links | Clickables | Dropdowns |\\n\`;
  markdownTable += \`|-----------|-----|------------|-------|------------|-----------|\\n\`;

  siteMap.forEach(page => {
    const screenshotLink = \`[View](../\${page.screenshotPath})\`;
    markdownTable += \`| \${page.pageName} | [\${page.url.substring(0, 50)}...](\${page.url}) | \${screenshotLink} | \${page.links} | \${page.clickables} | \${page.dropdowns} |\\n\`;
  });

  fs.writeFileSync(path.join(REPORTS_DIR, "sitemap-table.md"), markdownTable);

  // Generate detailed JSON report
  const detailedReport = {
    generatedAt: new Date().toISOString(),
    feature: "${featureTitle}",
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

  console.log(\`   ✅ Generated sitemap-table.md\`);
  console.log(\`   ✅ Generated detailed-report.json\`);
  console.log(\`   ✅ Generated link-graph.json\`);
}

// Main crawl execution
async function main() {
  console.log(\`\\n🚀 Starting ${featureTitle} Crawl...\\n\`);
  console.log(\`📍 Start URL: \${START_URL}\`);
  console.log(\`📁 Output: \${OUTPUT_DIR}\\n\`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login to Procore
    console.log("🔐 Logging in to Procore...");
    await page.goto("https://login.procore.com");
    await page.fill('input[name="email"]', PROCORE_EMAIL);
    await page.fill('input[name="password"]', PROCORE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 30000 });
    console.log("   ✅ Login successful\\n");

    // Start crawling
    urlQueue.push({ url: START_URL, name: "${sanitizedFeatureName}_main" });
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
      links.slice(0, 10).forEach(link => {
        if (!visitedUrls.has(link.href) && link.href.includes("${sanitizedFeatureName}")) {
          urlQueue.push({
            url: link.href,
            name: sanitizeFilename(link.text) || \`page_\${urlQueue.length}\`
          });
        }
      });

      console.log(\`   Progress: \${pagesProcessed}/\${maxPages} pages crawled\\n\`);
    }

    // Generate final reports
    await generateReports();

    console.log(\`\\n✅ Crawl Complete!\`);
    console.log(\`📊 Statistics:\`);
    console.log(\`   - Pages captured: \${visitedUrls.size}\`);
    console.log(\`   - Total captures: \${siteMap.length}\`);
    console.log(\`\\n📁 Output location: \${OUTPUT_DIR}\`);

  } catch (error) {
    console.error("\\n❌ Crawl failed:", error);
  } finally {
    await browser.close();
  }
}

main();
`;

// Write the crawl script
fs.writeFileSync(scriptPath, crawlScriptTemplate);
console.log(`✅ Generated crawl script: ${scriptPath}`);

// Generate README template
const readmeTemplate = `# Procore ${featureTitle} Crawler

This crawler captures comprehensive screenshots and data from Procore's ${featureTitle} functionality.

## Purpose

To document and analyze the ${featureTitle} feature in Procore, including:
- UI layout and components
- Data structures and table formats
- Available actions and workflows
- Export and reporting capabilities
- Integration points with other features

## Running the Crawler

From the \`scripts/screenshot-capture\` directory:

\`\`\`bash
cd /Users/meganharrison/Documents/github/alleato-procore/scripts/screenshot-capture
node scripts/crawl-${sanitizedFeatureName}-comprehensive.js
\`\`\`

## What It Does

1. **Logs into Procore** using configured credentials
2. **Navigates to the starting URL**: ${startUrl}
3. **Captures each page**:
   - Full-page screenshot (PNG)
   - Complete DOM structure (HTML)
   - Metadata (JSON) including:
     - Links found
     - Clickable elements
     - Dropdown menus
     - Table structures
     - UI components
4. **Explores dropdowns and menus**:
   - Clicks on "More" menus, export buttons, etc.
   - Captures the opened state
   - Records menu items
5. **Follows links** to related pages (up to 50 pages total)
6. **Generates reports**:
   - Sitemap table (Markdown)
   - Detailed report (JSON)
   - Link graph (JSON)

## Output Structure

\`\`\`
${outputDir}/
├── pages/
│   ├── ${sanitizedFeatureName}_main/
│   │   ├── screenshot.png
│   │   ├── dom.html
│   │   └── metadata.json
│   └── [more pages...]
└── reports/
    ├── sitemap-table.md
    ├── detailed-report.json
    └── link-graph.json
\`\`\`

## Configuration

Key settings in the script:

- \`OUTPUT_DIR\`: \`${outputDir}\`
- \`START_URL\`: ${startUrl}
- \`WAIT_TIME\`: 2000ms (2 seconds between actions)
- \`maxPages\`: 50 (safety limit to prevent infinite crawling)

## Safety Features

- Maximum page limit (50 pages)
- Visited URL tracking (no duplicate crawling)
- Error recovery (continues on failures)
- Timeout protection (60-second maximum per page)

## After Crawling

1. Review the generated screenshots in \`pages/\`
2. Check the reports in \`reports/\`
3. Update \`${featureTitle.toUpperCase().replace(/\s+/g, "-")}-CRAWL-STATUS.md\` with findings
4. Use the captured data to inform feature implementation

## Using the Data

### For UI Development
- Reference screenshots for layout and styling
- Identify components needed (tables, modals, dropdowns)
- Understand user workflows and interactions

### For Data Modeling
- Review table structures in metadata JSON files
- Identify required database fields
- Understand relationships between entities

### For Feature Planning
- Analyze available actions and workflows
- Document export and reporting capabilities
- Map integration points with other systems

## Troubleshooting

### Browser doesn't open
- Check that Playwright browsers are installed: \`npx playwright install\`

### Login fails
- Verify credentials are correct
- Check if 2FA is required
- Ensure network access to Procore

### Pages timeout
- Increase \`WAIT_TIME\` or page timeout values
- Check internet connection
- Verify Procore service is available

### Too many/few pages captured
- Adjust \`maxPages\` limit
- Review URL filtering logic in \`extractLinks()\`
- Check if authentication was successful
`;

// Output directory
const readmePath = path.join(process.cwd(), "../../../", outputDir, "README.md");
const readmeDir = path.dirname(readmePath);

if (!fs.existsSync(readmeDir)) {
  fs.mkdirSync(readmeDir, { recursive: true });
}

fs.writeFileSync(readmePath, readmeTemplate);
console.log(`✅ Generated README: ${readmePath}`);

// Print summary
console.log(`\n📋 Summary:`);
console.log(`   Feature: ${featureTitle}`);
console.log(`   Start URL: ${startUrl}`);
console.log(`   Project ID: ${projectId}`);
console.log(`   Output: ${outputDir}`);
console.log(`\n🚀 To run the crawler:`);
console.log(`   cd scripts/screenshot-capture`);
console.log(`   node scripts/crawl-${sanitizedFeatureName}-comprehensive.js`);
