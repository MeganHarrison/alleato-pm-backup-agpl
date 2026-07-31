import fs from 'fs';
import path from 'path';

const CRAWL_DIR = './procore-prime-contracts-crawl';
const PAGES_DIR = path.join(CRAWL_DIR, 'pages');
const REPORTS_DIR = path.join(CRAWL_DIR, 'reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Load all metadata
function loadAllMetadata() {
  const siteMap = [];
  const pagesDirs = fs.readdirSync(PAGES_DIR);

  for (const dir of pagesDirs) {
    const metadataPath = path.join(PAGES_DIR, dir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        siteMap.push(metadata);
      } catch (err) {
        console.warn(`Could not read metadata for ${dir}`);
      }
    }
  }

  return siteMap;
}

// Generate comprehensive report
function generateReport(siteMap) {
  console.log('\n📊 Generating comprehensive report...');

  // Generate sitemap table
  let tableContent = `# Procore Prime Contracts Crawl Sitemap\n\n`;
  tableContent += `**Generated:** ${new Date().toISOString()}\n\n`;
  tableContent += `**Total Pages:** ${siteMap.length}\n\n`;
  tableContent += `| Page Name | Category | Links | Clickables | Dropdowns | Screenshot |\n`;
  tableContent += `|-----------|----------|-------|------------|-----------|------------|\n`;

  siteMap
    .filter(page => page.pageName && page.pageName !== 'undefined')
    .forEach(page => {
      const relPath = page.screenshotPath ? page.screenshotPath.replace(/\\/g, '/') : `pages/${page.pageId}/screenshot.png`;
      tableContent += `| ${page.pageName} | ${page.category} | ${page.links || 0} | ${page.clickables || 0} | ${page.dropdowns || 0} | [View](../${relPath}) |\n`;
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

  console.log('✅ Reports generated in:', REPORTS_DIR);
  console.log(`📊 Total pages: ${siteMap.length}`);
  console.log(`🔗 Total links: ${linkGraph.totalLinks}`);
  console.log(`🔘 Total clickables: ${linkGraph.totalClickables}`);
}

// Main execution
console.log('📊 Loading metadata from crawl...');
const siteMap = loadAllMetadata();
console.log(`✅ Loaded ${siteMap.length} pages`);

generateReport(siteMap);
