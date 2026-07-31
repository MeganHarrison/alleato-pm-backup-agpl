import fs from "fs";
import path from "path";

const OUTPUT_DIR = "./procore-support-crawl";
const PAGES_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Read all metadata files
const siteMap = [];

function loadMetadata() {
  console.log('📂 Loading metadata files...');

  const pageDirectories = fs.readdirSync(PAGES_DIR).filter(file => {
    const fullPath = path.join(PAGES_DIR, file);
    return fs.statSync(fullPath).isDirectory();
  });

  console.log(`   Found ${pageDirectories.length} page directories`);

  pageDirectories.forEach(dir => {
    const metadataPath = path.join(PAGES_DIR, dir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        siteMap.push(metadata);
      } catch (error) {
        console.error(`   ⚠️  Error reading ${dir}/metadata.json:`, error.message);
      }
    }
  });

  console.log(`   Loaded ${siteMap.length} metadata files\n`);
}

function generateSitemapReport() {
  console.log('📊 Generating comprehensive sitemap report...');

  const START_URL = "https://support.procore.com/products/online";

  // Generate sitemap markdown table
  let sitemapContent = `# Procore Support Documentation Sitemap\n\n`;
  sitemapContent += `**Generated:** ${new Date().toISOString()}\n\n`;
  sitemapContent += `**Starting URL:** ${START_URL}\n\n`;
  sitemapContent += `**Total Pages Captured:** ${siteMap.length}\n\n`;

  // Summary statistics
  const stats = {
    totalLinks: siteMap.reduce((sum, page) => sum + (page.links || 0), 0),
    totalClickables: siteMap.reduce((sum, page) => sum + (page.clickables || 0), 0),
    totalExpandables: siteMap.reduce((sum, page) => sum + (page.expandables || 0), 0),
    totalImages: siteMap.reduce((sum, page) => sum + (page.analysis?.components?.images || 0), 0),
    totalCodeBlocks: siteMap.reduce((sum, page) => sum + (page.analysis?.components?.codeBlocks || 0), 0),
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
    const relPath = page.screenshotPath ? page.screenshotPath.replace(/\\/g, '/') : 'N/A';
    const pageNum = index + 1;
    const screenshot = page.screenshotPath ? `[View](../${relPath})` : 'N/A';
    sitemapContent += `| ${pageNum} | ${page.pageName} | ${page.category} | ${page.links || 0} | ${page.clickables || 0} | ${page.expandables || 0} | ${screenshot} |\n`;
  });

  sitemapContent += `\n---\n\n`;

  // Detailed page listing
  sitemapContent += `## Detailed Page Listings\n\n`;

  siteMap.forEach((page, index) => {
    const pageNum = index + 1;
    sitemapContent += `### ${pageNum}. ${page.pageName}\n\n`;
    sitemapContent += `- **URL:** ${page.url}\n`;
    sitemapContent += `- **Category:** ${page.category}\n`;
    sitemapContent += `- **Title:** ${page.analysis?.title || 'N/A'}\n`;
    if (page.analysis?.metaDescription) {
      sitemapContent += `- **Description:** ${page.analysis.metaDescription}\n`;
    }
    sitemapContent += `- **Captured:** ${page.timestamp}\n`;
    sitemapContent += `\n**Page Structure:**\n`;
    sitemapContent += `- Links: ${page.links || 0}\n`;
    sitemapContent += `- Interactive Elements: ${page.clickables || 0}\n`;
    sitemapContent += `- Expandable Sections: ${page.expandables || 0}\n`;
    sitemapContent += `- Images: ${page.analysis?.components?.images || 0}\n`;
    sitemapContent += `- Code Blocks: ${page.analysis?.components?.codeBlocks || 0}\n`;
    sitemapContent += `- Tables: ${page.analysis?.components?.tables || 0}\n`;

    if (page.analysis?.breadcrumbs && page.analysis.breadcrumbs.length > 0) {
      sitemapContent += `\n**Breadcrumbs:**\n`;
      page.analysis.breadcrumbs.forEach(bc => {
        sitemapContent += `- ${bc.text}\n`;
      });
    }

    if (page.analysis?.articleContent && page.analysis.articleContent.headings?.length > 0) {
      sitemapContent += `\n**Content Structure:**\n`;
      page.analysis.articleContent.headings.slice(0, 10).forEach(heading => {
        const indent = heading.level === 'h2' ? '' : '  ';
        sitemapContent += `${indent}- ${heading.text}\n`;
      });
      if (page.analysis.articleContent.headings.length > 10) {
        sitemapContent += `  - _(${page.analysis.articleContent.headings.length - 10} more headings...)_\n`;
      }
    }

    if (page.screenshotPath) {
      sitemapContent += `\n**Screenshot:** [View](../${page.screenshotPath.replace(/\\/g, '/')})\n`;
    }
    sitemapContent += `\n---\n\n`;
  });

  fs.writeFileSync(
    path.join(REPORTS_DIR, "sitemap.md"),
    sitemapContent
  );

  console.log('✅ Sitemap generated:', path.join(REPORTS_DIR, "sitemap.md"));
}

function generateReports() {
  console.log('\n📊 Generating all reports...\n');

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
    totalLinks: siteMap.reduce((sum, page) => sum + (page.links || 0), 0),
    totalClickables: siteMap.reduce((sum, page) => sum + (page.clickables || 0), 0),
    pages: siteMap.map(page => ({
      name: page.pageName,
      url: page.url,
      category: page.category,
      outgoingLinks: (page.linkDetails || []).map(l => ({
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
    startUrl: "https://support.procore.com/products/online",
    totalPages: siteMap.length,
    statistics: {
      totalLinks: siteMap.reduce((sum, page) => sum + (page.links || 0), 0),
      totalClickables: siteMap.reduce((sum, page) => sum + (page.clickables || 0), 0),
      totalExpandables: siteMap.reduce((sum, page) => sum + (page.expandables || 0), 0),
      totalImages: siteMap.reduce((sum, page) => sum + (page.analysis?.components?.images || 0), 0),
      totalCodeBlocks: siteMap.reduce((sum, page) => sum + (page.analysis?.components?.codeBlocks || 0), 0),
      totalTables: siteMap.reduce((sum, page) => sum + (page.analysis?.components?.tables || 0), 0)
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
  console.log('\n📊 Summary Statistics:');
  console.log(`   - Total Pages: ${summary.totalPages}`);
  console.log(`   - Total Links: ${summary.statistics.totalLinks}`);
  console.log(`   - Total Images: ${summary.statistics.totalImages}`);
  console.log(`   - Total Code Blocks: ${summary.statistics.totalCodeBlocks}`);
}

// Run the generator
loadMetadata();
generateReports();
