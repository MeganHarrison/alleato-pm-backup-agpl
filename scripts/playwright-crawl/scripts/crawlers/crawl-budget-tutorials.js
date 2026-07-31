import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./procore-support-crawl";
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Starting URL - Budget Tutorials
const START_URL = "https://support.procore.com/products/online/user-guide/project-level/budget/tutorials";

// Create directories
[OUTPUT_DIR, SCREENSHOT_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Store all page information
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

// Extract all relevant tutorial links
async function extractBudgetLinks(page, currentUrl) {
  return await page.evaluate((baseUrl) => {
    const links = [];

    // Extract all anchor links
    document.querySelectorAll('a[href]').forEach((link, index) => {
      const href = link.href;
      const text = link.textContent.trim();

      // Only include budget-related support documentation links
      const isBudgetRelated = href.includes('/budget/') ||
                             href.includes('budget') ||
                             text.toLowerCase().includes('budget');
      const isSupportDoc = href.includes('support.procore.com');
      const isNotHash = !href.includes('#') && !href.includes('javascript:');

      if (isSupportDoc && isBudgetRelated && isNotHash && href !== baseUrl) {
        links.push({
          href,
          text,
          classes: link.className,
          id: link.id || null,
          index,
          category: href.includes('tutorials') ? 'tutorial' :
                   href.includes('faq') ? 'faq' :
                   href.includes('references') ? 'reference' :
                   'documentation'
        });
      }
    });

    // Remove duplicates
    const uniqueLinks = [];
    const seen = new Set();
    links.forEach(link => {
      if (!seen.has(link.href)) {
        seen.add(link.href);
        uniqueLinks.push(link);
      }
    });

    return uniqueLinks;
  }, currentUrl);
}

// Capture a single page with comprehensive analysis
async function capturePage(page, url, pageName, category = "tutorial") {
  try {
    console.log(`\n📸 Capturing: ${pageName}`);
    console.log(`   URL: ${url}`);

    // Navigate to page
    await page.goto(url, {
      waitUntil: "networkidle",
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

    // Extract budget-related links
    const links = await extractBudgetLinks(page, url);

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
      screenshotPath: path.relative(OUTPUT_DIR, screenshotPath)
    };

    fs.writeFileSync(
      path.join(pageDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    siteMap.push(metadata);
    console.log(`   ✅ Captured: ${links.length} budget-related links found`);
    console.log(`   📊 Tables: ${analysis.tables.length}, Images: ${analysis.components.images}, Headings: ${analysis.components.headings.h2}`);

    // Add new links to queue
    links.forEach(link => {
      if (!visitedUrls.has(link.href) && !urlQueue.includes(link.href)) {
        urlQueue.push(link.href);
        console.log(`   📌 Queued: ${link.text.substring(0, 50)}...`);
      }
    });

    return metadata;
  } catch (error) {
    console.error(`   ❌ Error capturing ${pageName}:`, error.message);
    return null;
  }
}

// Generate comprehensive report
function generateReport() {
  console.log('\n📊 Generating Budget Tutorials Report...');

  const successfulCaptures = siteMap.filter(v => v !== null);

  let report = `# Budget Tutorials Crawl Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  report += `**Starting URL:** ${START_URL}\n\n`;

  report += `## Summary\n\n`;
  report += `- **Total Pages Captured:** ${successfulCaptures.length}\n`;
  report += `- **Total Links Found:** ${siteMap.reduce((sum, p) => sum + p.links, 0)}\n`;
  report += `- **Total Images:** ${siteMap.reduce((sum, p) => sum + (p.analysis.components.images || 0), 0)}\n`;
  report += `- **Total Tables:** ${siteMap.reduce((sum, p) => sum + (p.analysis.tables?.length || 0), 0)}\n\n`;

  // Group by category
  const byCategory = {};
  successfulCaptures.forEach(page => {
    byCategory[page.category] = byCategory[page.category] || [];
    byCategory[page.category].push(page);
  });

  report += `## Pages by Category\n\n`;
  Object.entries(byCategory).forEach(([category, pages]) => {
    report += `### ${category.charAt(0).toUpperCase() + category.slice(1)} (${pages.length})\n\n`;
    report += `| Page | Title | Tables | Images | Links |\n`;
    report += `|------|-------|--------|--------|-------|\n`;
    pages.forEach(page => {
      const relPath = page.screenshotPath.replace(/\\/g, '/');
      report += `| [${page.pageName}](../${relPath}) | ${page.analysis.h1 || page.analysis.title} | ${page.analysis.tables?.length || 0} | ${page.analysis.components.images} | ${page.links} |\n`;
    });
    report += `\n`;
  });

  report += `\n---\n\n`;

  // Detailed listing
  report += `## Detailed Page Information\n\n`;

  successfulCaptures.forEach((page, index) => {
    report += `### ${index + 1}. ${page.pageName}\n\n`;
    report += `- **URL:** ${page.url}\n`;
    report += `- **Category:** ${page.category}\n`;
    report += `- **Title:** ${page.analysis.h1 || page.analysis.title}\n`;
    if (page.analysis.metaDescription) {
      report += `- **Description:** ${page.analysis.metaDescription}\n`;
    }

    if (page.analysis.breadcrumbs && page.analysis.breadcrumbs.length > 0) {
      report += `\n**Breadcrumbs:** ${page.analysis.breadcrumbs.map(bc => bc.text).join(' > ')}\n`;
    }

    if (page.analysis.articleContent && page.analysis.articleContent.headings.length > 0) {
      report += `\n**Content Structure:**\n`;
      page.analysis.articleContent.headings.slice(0, 10).forEach(heading => {
        const indent = heading.level === 'h2' ? '' : '  ';
        report += `${indent}- ${heading.text}\n`;
      });
      if (page.analysis.articleContent.headings.length > 10) {
        report += `  - _(${page.analysis.articleContent.headings.length - 10} more sections...)_\n`;
      }
    }

    if (page.analysis.tables && page.analysis.tables.length > 0) {
      report += `\n**Tables Found:** ${page.analysis.tables.length}\n`;
      page.analysis.tables.forEach((table, idx) => {
        report += `  - Table ${idx + 1}: ${table.headers.length} columns, ${table.rows} rows\n`;
        if (table.headers.length > 0 && table.headers.length <= 10) {
          report += `    - Headers: ${table.headers.join(', ')}\n`;
        }
      });
    }

    report += `\n**Screenshot:** [View](../${page.screenshotPath.replace(/\\/g, '/')})\n`;
    report += `\n---\n\n`;
  });

  // Save reports
  const reportPath = path.join(REPORTS_DIR, "budget-tutorials-report.md");
  fs.writeFileSync(reportPath, report);
  console.log(`✅ Report saved to: ${reportPath}`);

  const jsonPath = path.join(REPORTS_DIR, "budget-tutorials-data.json");
  fs.writeFileSync(jsonPath, JSON.stringify(successfulCaptures, null, 2));
  console.log(`✅ JSON data saved to: ${jsonPath}`);

  // Save link map
  const linkMap = {
    totalPages: successfulCaptures.length,
    totalLinks: siteMap.reduce((sum, p) => sum + p.links, 0),
    pages: successfulCaptures.map(page => ({
      name: page.pageName,
      url: page.url,
      category: page.category,
      title: page.analysis.h1 || page.analysis.title,
      links: page.linkDetails.map(l => ({
        text: l.text,
        href: l.href,
        category: l.category
      }))
    }))
  };

  const linkMapPath = path.join(REPORTS_DIR, "budget-tutorials-link-map.json");
  fs.writeFileSync(linkMapPath, JSON.stringify(linkMap, null, 2));
  console.log(`✅ Link map saved to: ${linkMapPath}`);
}

// Main crawler
async function crawlBudgetTutorials() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('🚀 Starting Budget Tutorials Crawl...');
    console.log(`📍 Starting URL: ${START_URL}`);

    // Start with the tutorials index page
    urlQueue.push(START_URL);

    let pageCount = 0;
    const maxPages = 150; // Generous limit for all budget tutorials

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
      const category = currentUrl.includes('tutorials') ? 'tutorial' :
                      currentUrl.includes('faq') ? 'faq' :
                      currentUrl.includes('references') ? 'reference' :
                      'documentation';

      console.log(`\n[${pageCount}/${maxPages}] Processing: ${pageName}`);
      console.log(`   Queue: ${urlQueue.length} remaining`);

      // Capture the page
      await capturePage(page, currentUrl, pageName, category);

      // Brief pause between captures
      await page.waitForTimeout(1000);
    }

    // Generate final reports
    generateReport();

    console.log('\n✅ Budget Tutorials Crawl Complete!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`📊 Total pages captured: ${siteMap.length}`);
    console.log(`🔗 Total unique links: ${visitedUrls.size}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the crawler
crawlBudgetTutorials().catch(console.error);
