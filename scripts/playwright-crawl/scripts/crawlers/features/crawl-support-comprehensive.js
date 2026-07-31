import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./procore-support-crawl";
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Starting URL - Procore Support Documentation
const START_URL = "https://support.procore.com/products/online";

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

// Enhanced page analysis for documentation pages
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
      cards: document.querySelectorAll('.card, .panel, .widget, .article').length,
      lists: document.querySelectorAll('ul, ol').length,
      tabs: document.querySelectorAll('[role="tab"], .tab, .tabs li').length,
      dropdowns: document.querySelectorAll('select, .dropdown').length,
      icons: document.querySelectorAll('i[class*="icon"], .icon, svg').length,
      headings: {
        h1: document.querySelectorAll('h1').length,
        h2: document.querySelectorAll('h2').length,
        h3: document.querySelectorAll('h3').length,
        h4: document.querySelectorAll('h4').length
      },
      codeBlocks: document.querySelectorAll('pre, code').length,
      images: document.querySelectorAll('img').length,
      videos: document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length
    };

    // Extract article/documentation structure
    const articleContent = {
      title: document.querySelector('h1')?.textContent.trim() || document.title,
      headings: Array.from(document.querySelectorAll('h2, h3')).map(h => ({
        level: h.tagName.toLowerCase(),
        text: h.textContent.trim(),
        id: h.id || null
      })),
      paragraphs: document.querySelectorAll('p').length,
      sections: document.querySelectorAll('section, article, .section').length
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

    // Extract navigation breadcrumbs
    const breadcrumbs = Array.from(
      document.querySelectorAll('[class*="breadcrumb"] a, .breadcrumbs a, nav[aria-label*="breadcrumb"] a')
    ).map(link => ({
      text: link.textContent.trim(),
      href: link.href
    }));

    return {
      components,
      articleContent,
      tables,
      breadcrumbs,
      title: document.title,
      h1: document.querySelector('h1')?.textContent.trim() || null,
      metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || null
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
      const isExternal = !href.includes('support.procore.com');
      const isSupportDoc = href.includes('support.procore.com');

      // Only include internal support documentation links
      if (isSupportDoc && !isExternal && href !== baseUrl && !href.includes('javascript:') && !href.includes('#')) {
        links.push({
          href,
          text,
          classes: link.className,
          id: link.id || null,
          index,
          category: href.includes('/products/') ? 'product' :
                   href.includes('/faq') ? 'faq' :
                   href.includes('/references') ? 'reference' :
                   'general'
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

    // Extract dropdown menus and expandable sections
    const expandables = [];
    document.querySelectorAll('[class*="accordion"], [class*="collaps"], [class*="expand"], details').forEach((el, index) => {
      expandables.push({
        text: el.textContent.trim().substring(0, 100),
        type: el.tagName.toLowerCase(),
        classes: el.className,
        id: el.id || null,
        isExpanded: el.hasAttribute('open') || el.className.includes('expanded') || el.className.includes('active'),
        index
      });
    });

    return { links, clickables, expandables };
  }, currentUrl);
}

// Capture a single page with comprehensive analysis
async function capturePage(page, url, pageName, category = "documentation") {
  try {
    console.log(`\n📸 Capturing: ${pageName}`);
    console.log(`   URL: ${url}`);

    // Navigate to page
    await page.goto(url, {
      waitUntil: "load",
      timeout: 120000
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
    const { links, clickables, expandables } = await extractLinks(page, url);

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
      expandables: expandables.length,
      expandableDetails: expandables,
      screenshotPath: path.relative(OUTPUT_DIR, screenshotPath)
    };

    fs.writeFileSync(
      path.join(pageDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    siteMap.push(metadata);
    console.log(`   ✅ Captured: ${links.length} links, ${clickables.length} clickables, ${expandables.length} expandables`);

    // Add new links to queue (only from same domain)
    links.forEach(link => {
      if (!visitedUrls.has(link.href) && !urlQueue.includes(link.href)) {
        urlQueue.push(link.href);
      }
    });

    return { metadata, links, clickables, expandables };
  } catch (error) {
    console.error(`   ❌ Error capturing ${pageName}:`, error.message);
    return null;
  }
}

// Expand and capture accordion/expandable sections
async function captureExpandables(page, pageUrl, pageName) {
  console.log(`\n🎯 Looking for expandable sections on: ${pageName}`);

  // Configuration: Set to false to skip expandable captures entirely
  const CAPTURE_EXPANDABLES = false;
  const MIN_REVEALED_CONTENT_LENGTH = 100; // Minimum content length to save

  if (!CAPTURE_EXPANDABLES) {
    console.log(`   ⏭️  Skipping expandables (disabled in config)`);
    return;
  }

  try {
    // Look for expandable elements
    const expandableSelectors = [
      'details',
      '[class*="accordion"]',
      '[class*="collaps"]',
      '[class*="expand"]',
      '[data-toggle="collapse"]',
      '[aria-expanded="false"]'
    ];

    for (const selector of expandableSelectors) {
      const elements = await page.$$(selector);

      for (let i = 0; i < elements.length; i++) {
        try {
          const element = elements[i];
          const isVisible = await element.isVisible();

          if (!isVisible) continue;

          const text = await element.textContent();
          console.log(`   🔍 Found expandable: "${text?.trim().substring(0, 50) || 'unlabeled'}"`);

          // Expand the section
          await element.click();
          await page.waitForTimeout(1000);

          // Extract revealed content BEFORE deciding to save
          const revealedContent = await page.evaluate(() => {
            const content = [];
            document.querySelectorAll('[class*="shown"], [class*="expanded"], [open]').forEach(item => {
              content.push({
                text: item.textContent.trim().substring(0, 200),
                type: item.tagName.toLowerCase(),
                classes: item.className
              });
            });
            return content;
          });

          // Calculate total revealed content length
          const totalContentLength = revealedContent.reduce((sum, item) => sum + item.text.length, 0);

          // Only save if there's significant content
          if (totalContentLength >= MIN_REVEALED_CONTENT_LENGTH && revealedContent.length > 0) {
            console.log(`   📋 Found ${revealedContent.length} revealed items (${totalContentLength} chars) - saving...`);

            // Capture the expanded state
            const expandedPageId = generatePageId(pageUrl, `${pageName}_expanded_${i}`);
            const expandedDir = path.join(SCREENSHOT_DIR, expandedPageId);
            if (!fs.existsSync(expandedDir)) {
              fs.mkdirSync(expandedDir, { recursive: true });
            }

            // Save screenshot
            await page.screenshot({
              path: path.join(expandedDir, "screenshot.png"),
              fullPage: true
            });

            // Save DOM (THIS WAS MISSING!)
            const htmlContent = await page.content();
            fs.writeFileSync(path.join(expandedDir, "dom.html"), htmlContent);

            // Save expandable metadata
            fs.writeFileSync(
              path.join(expandedDir, "metadata.json"),
              JSON.stringify({
                parentPage: pageName,
                parentUrl: pageUrl,
                expandableIndex: i,
                revealedContent,
                totalContentLength,
                timestamp: new Date().toISOString()
              }, null, 2)
            );
          } else {
            console.log(`   ⏭️  Skipping save - insufficient content (${totalContentLength} chars)`);
          }

          // Collapse it back
          await element.click();
          await page.waitForTimeout(500);

        } catch (err) {
          console.error(`   ⚠️  Error with expandable ${i}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ Error capturing expandables:`, error.message);
  }
}

// Generate comprehensive sitemap report
function generateSitemapReport() {
  console.log('\n📊 Generating comprehensive sitemap report...');

  // Generate sitemap markdown table
  let sitemapContent = `# Procore Support Documentation Sitemap\n\n`;
  sitemapContent += `**Generated:** ${new Date().toISOString()}\n\n`;
  sitemapContent += `**Starting URL:** ${START_URL}\n\n`;
  sitemapContent += `**Total Pages Captured:** ${siteMap.length}\n\n`;

  // Summary statistics
  const stats = {
    totalLinks: siteMap.reduce((sum, page) => sum + page.links, 0),
    totalClickables: siteMap.reduce((sum, page) => sum + page.clickables, 0),
    totalExpandables: siteMap.reduce((sum, page) => sum + page.expandables, 0),
    totalImages: siteMap.reduce((sum, page) => sum + (page.analysis.components.images || 0), 0),
    totalCodeBlocks: siteMap.reduce((sum, page) => sum + (page.analysis.components.codeBlocks || 0), 0),
    categories: {}
  };

  siteMap.forEach(page => {
    stats.categories[page.category] = (stats.categories[page.category] || 0) + 1;
  });

  sitemapContent += `## Statistics\n\n`;
  sitemapContent += `- **Total Links Found:** ${stats.totalLinks}\n`;
  sitemapContent += `- **Total Interactive Elements:** ${stats.totalClickables}\n`;
  sitemapContent += `- **Total Expandable Sections:** ${stats.totalExpandables}\n`;
  sitemapContent += `- **Total Images:** ${stats.totalImages}\n`;
  sitemapContent += `- **Total Code Blocks:** ${stats.totalCodeBlocks}\n\n`;

  sitemapContent += `## Categories\n\n`;
  Object.entries(stats.categories).forEach(([category, count]) => {
    sitemapContent += `- **${category}:** ${count} pages\n`;
  });
  sitemapContent += `\n---\n\n`;

  // Table of contents
  sitemapContent += `## Table of Contents\n\n`;
  sitemapContent += `| # | Page Name | Category | Links | Interactive | Expandables | Screenshot |\n`;
  sitemapContent += `|---|-----------|----------|-------|-------------|-------------|------------|\n`;

  siteMap.forEach((page, index) => {
    const relPath = page.screenshotPath.replace(/\\/g, '/');
    const pageNum = index + 1;
    sitemapContent += `| ${pageNum} | ${page.pageName} | ${page.category} | ${page.links} | ${page.clickables} | ${page.expandables} | [View](../${relPath}) |\n`;
  });

  sitemapContent += `\n---\n\n`;

  // Detailed page listing
  sitemapContent += `## Detailed Page Listings\n\n`;

  siteMap.forEach((page, index) => {
    const pageNum = index + 1;
    sitemapContent += `### ${pageNum}. ${page.pageName}\n\n`;
    sitemapContent += `- **URL:** ${page.url}\n`;
    sitemapContent += `- **Category:** ${page.category}\n`;
    sitemapContent += `- **Title:** ${page.analysis.title}\n`;
    if (page.analysis.metaDescription) {
      sitemapContent += `- **Description:** ${page.analysis.metaDescription}\n`;
    }
    sitemapContent += `- **Captured:** ${page.timestamp}\n`;
    sitemapContent += `\n**Page Structure:**\n`;
    sitemapContent += `- Links: ${page.links}\n`;
    sitemapContent += `- Interactive Elements: ${page.clickables}\n`;
    sitemapContent += `- Expandable Sections: ${page.expandables}\n`;
    sitemapContent += `- Images: ${page.analysis.components.images}\n`;
    sitemapContent += `- Code Blocks: ${page.analysis.components.codeBlocks}\n`;
    sitemapContent += `- Tables: ${page.analysis.components.tables}\n`;

    if (page.analysis.breadcrumbs && page.analysis.breadcrumbs.length > 0) {
      sitemapContent += `\n**Breadcrumbs:**\n`;
      page.analysis.breadcrumbs.forEach(bc => {
        sitemapContent += `- ${bc.text}\n`;
      });
    }

    if (page.analysis.articleContent && page.analysis.articleContent.headings.length > 0) {
      sitemapContent += `\n**Content Structure:**\n`;
      page.analysis.articleContent.headings.slice(0, 10).forEach(heading => {
        const indent = heading.level === 'h2' ? '' : '  ';
        sitemapContent += `${indent}- ${heading.text}\n`;
      });
      if (page.analysis.articleContent.headings.length > 10) {
        sitemapContent += `  - _(${page.analysis.articleContent.headings.length - 10} more headings...)_\n`;
      }
    }

    sitemapContent += `\n**Screenshot:** [View](../${page.screenshotPath.replace(/\\/g, '/')})\n`;
    sitemapContent += `\n---\n\n`;
  });

  fs.writeFileSync(
    path.join(REPORTS_DIR, "sitemap.md"),
    sitemapContent
  );

  console.log('✅ Sitemap generated:', path.join(REPORTS_DIR, "sitemap.md"));
}

// Generate comprehensive reports
function generateReports() {
  console.log('\n📊 Generating comprehensive reports...');

  // Generate sitemap
  generateSitemapReport();

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
      category: page.category,
      outgoingLinks: page.linkDetails.map(l => ({
        href: l.href,
        text: l.text,
        category: l.category
      }))
    }))
  };

  fs.writeFileSync(
    path.join(REPORTS_DIR, "link-graph.json"),
    JSON.stringify(linkGraph, null, 2)
  );

  // Generate summary statistics
  const summary = {
    crawlDate: new Date().toISOString(),
    startUrl: START_URL,
    totalPages: siteMap.length,
    statistics: {
      totalLinks: siteMap.reduce((sum, page) => sum + page.links, 0),
      totalClickables: siteMap.reduce((sum, page) => sum + page.clickables, 0),
      totalExpandables: siteMap.reduce((sum, page) => sum + page.expandables, 0),
      totalImages: siteMap.reduce((sum, page) => sum + (page.analysis.components.images || 0), 0),
      totalCodeBlocks: siteMap.reduce((sum, page) => sum + (page.analysis.components.codeBlocks || 0), 0),
      totalTables: siteMap.reduce((sum, page) => sum + page.analysis.components.tables, 0)
    },
    categories: {},
    topPages: siteMap
      .sort((a, b) => b.links - a.links)
      .slice(0, 10)
      .map(page => ({
        name: page.pageName,
        url: page.url,
        links: page.links,
        category: page.category
      }))
  };

  siteMap.forEach(page => {
    summary.categories[page.category] = (summary.categories[page.category] || 0) + 1;
  });

  fs.writeFileSync(
    path.join(REPORTS_DIR, "crawl-summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log('✅ Reports generated in:', REPORTS_DIR);
  console.log('   - sitemap.md (comprehensive sitemap with all details)');
  console.log('   - detailed-report.json (full JSON data)');
  console.log('   - link-graph.json (page relationships)');
  console.log('   - crawl-summary.json (statistics summary)');
}

// Main crawler
async function crawlSupportDocs() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('🚀 Starting Procore Support Documentation Crawl...');
    console.log(`📍 Starting URL: ${START_URL}`);

    // Start with the main support page
    urlQueue.push(START_URL);

    let pageCount = 0;
    const maxPages = 100; // Increased limit for documentation site

    while (urlQueue.length > 0 && pageCount < maxPages) {
      const currentUrl = urlQueue.shift();

      if (visitedUrls.has(currentUrl)) {
        continue;
      }

      visitedUrls.add(currentUrl);
      pageCount++;

      // Determine page name and category from URL
      const urlParts = currentUrl.split('/');
      const pageName = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'index';
      const category = currentUrl.includes('/products/') ? 'product' :
                      currentUrl.includes('/faq') ? 'faq' :
                      currentUrl.includes('/references') ? 'reference' :
                      'documentation';

      // Capture the page
      const result = await capturePage(page, currentUrl, pageName, category);

      if (result) {
        // Look for and capture expandable sections
        await captureExpandables(page, currentUrl, pageName);
      }

      console.log(`\n📊 Progress: ${pageCount}/${maxPages} pages captured, ${urlQueue.length} in queue`);
    }

    // Generate final reports
    generateReports();

    console.log('\n✅ Crawl complete!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`📊 Total pages captured: ${siteMap.length}`);
    console.log(`🔗 Total links discovered: ${siteMap.reduce((sum, p) => sum + p.links, 0)}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await browser.close();
  }
}

// Run the crawler
crawlSupportDocs().catch(console.error);
