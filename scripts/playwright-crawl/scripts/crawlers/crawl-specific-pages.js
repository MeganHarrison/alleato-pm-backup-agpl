import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./procore-support-crawl";
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");

// Specific URLs to crawl
const TARGET_URLS = [
  "https://support.procore.com/faq/which-calculation-method-should-i-choose-when-using-the-forecast-to-complete-feature"
];

// Create directories
[OUTPUT_DIR, SCREENSHOT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .substring(0, 150);
}

function generatePageId(url) {
  const urlParts = url.split('/');
  const pageName = urlParts[urlParts.length - 1] || 'index';
  return sanitizeFilename(pageName);
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

// Capture a single page with comprehensive analysis
async function capturePage(page, url) {
  try {
    const pageId = generatePageId(url);
    console.log(`\n📸 Capturing: ${pageId}`);
    console.log(`   URL: ${url}`);

    // Navigate to page
    await page.goto(url, {
      waitUntil: "load",
      timeout: 120000
    });

    await page.waitForTimeout(WAIT_TIME);

    // Create page directory
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

    // Save metadata
    const metadata = {
      url,
      pageId,
      timestamp: new Date().toISOString(),
      analysis,
      screenshotPath: path.relative(OUTPUT_DIR, screenshotPath)
    };

    fs.writeFileSync(
      path.join(pageDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`   ✅ Captured successfully`);
    console.log(`   📊 Stats: ${analysis.components.images} images, ${analysis.components.codeBlocks} code blocks, ${analysis.components.tables} tables`);

    return metadata;
  } catch (error) {
    console.error(`   ❌ Error capturing page:`, error.message);
    return null;
  }
}

// Main crawler
async function crawlSpecificPages() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  const results = [];

  try {
    console.log('🚀 Starting Specific Pages Crawl...');
    console.log(`📋 Total URLs to crawl: ${TARGET_URLS.length}`);

    for (let i = 0; i < TARGET_URLS.length; i++) {
      const url = TARGET_URLS[i];
      console.log(`\n[${i + 1}/${TARGET_URLS.length}]`);

      const result = await capturePage(page, url);
      if (result) {
        results.push(result);
      }
    }

    // Generate summary report
    const summary = {
      crawlDate: new Date().toISOString(),
      totalUrls: TARGET_URLS.length,
      successfulCaptures: results.length,
      failedCaptures: TARGET_URLS.length - results.length,
      pages: results
    };

    const summaryPath = path.join(OUTPUT_DIR, "specific-pages-summary.json");
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log('\n✅ Crawl complete!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`📊 Successfully captured: ${results.length}/${TARGET_URLS.length} pages`);
    console.log(`📄 Summary report: ${summaryPath}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await browser.close();
  }
}

// Run the crawler
crawlSpecificPages().catch(console.error);
