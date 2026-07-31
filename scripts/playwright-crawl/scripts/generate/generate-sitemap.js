import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const EXISTING_CRAWL_DIR = "./procore-sitemap"; // Directory with existing crawl data
const OUTPUT_DIR = "./sitemap-only"; // Directory for sitemap-only output
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function loadExistingData(crawlDir) {
  const siteMap = [];
  
  if (!fs.existsSync(crawlDir)) {
    console.log(`⚠️  Crawl directory ${crawlDir} not found. Creating empty sitemap.`);
    return siteMap;
  }
  
  const pagesDir = path.join(crawlDir, "pages");
  
  if (!fs.existsSync(pagesDir)) {
    console.log(`⚠️  Pages directory not found in ${crawlDir}`);
    return siteMap;
  }
  
  const pageFolders = fs.readdirSync(pagesDir).filter(item => 
    fs.statSync(path.join(pagesDir, item)).isDirectory()
  );
  
  console.log(`📂 Found ${pageFolders.length} existing page folders`);
  
  for (const folder of pageFolders) {
    const folderPath = path.join(pagesDir, folder);
    const metadataPath = path.join(folderPath, "metadata.json");
    
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        console.log(`  📄 Loaded: ${metadata.name || folder}`);
        siteMap.push(metadata);
      } catch (error) {
        console.log(`  ⚠️  Failed to load metadata for ${folder}: ${error.message}`);
        
        // Create basic entry from folder structure
        const basicData = {
          id: folder,
          name: folder.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          url: `Unknown (${folder})`,
          category: "Unknown",
          timestamp: "Unknown",
          screenshotPath: fs.existsSync(path.join(folderPath, "screenshot.png")) ? `pages/${folder}/screenshot.png` : null,
          domPath: fs.existsSync(path.join(folderPath, "dom.html")) ? `pages/${folder}/dom.html` : null,
          analysisPath: fs.existsSync(path.join(folderPath, "analysis.md")) ? `pages/${folder}/analysis.md` : null,
          linkCount: 0,
          componentCount: 0,
          tableCount: 0,
          formCount: 0,
          error: "Metadata not available"
        };
        siteMap.push(basicData);
      }
    }
  }
  
  return siteMap;
}

function generateSitemapTable(siteMap, sourceDir = EXISTING_CRAWL_DIR) {
  const successfulPages = siteMap.filter(p => !p.error);
  const failedPages = siteMap.filter(p => p.error);
  
  let tableContent = `# Procore Complete Sitemap with Analysis\n\n`;
  tableContent += `Generated: ${new Date().toISOString()}\n`;
  tableContent += `Source: ${path.resolve(sourceDir)}\n\n`;
  
  // Site Overview
  tableContent += `## Site Overview\n`;
  tableContent += `- Total Pages: ${siteMap.length}\n`;
  tableContent += `- Successful Captures: ${successfulPages.length}\n`;
  tableContent += `- Failed Captures: ${failedPages.length}\n`;
  
  if (successfulPages.length > 0) {
    tableContent += `- Total Components Analyzed: ${successfulPages.reduce((sum, p) => sum + (p.componentCount || 0), 0)}\n`;
    tableContent += `- Pages with Tables: ${successfulPages.filter(p => (p.tableCount || 0) > 0).length}\n`;
    tableContent += `- Pages with Forms: ${successfulPages.filter(p => (p.formCount || 0) > 0).length}\n`;
  }
  
  tableContent += `\n## Complete Sitemap Table\n\n`;
  tableContent += `| Page Name | Category | URL | Links | Components | Tables | Forms | Screenshot | DOM | Analysis | Status |\n`;
  tableContent += `|-----------|----------|-----|-------|------------|--------|-------|------------|-----|----------|--------|\n`;

  siteMap.forEach(page => {
    const status = page.error ? `❌ ${page.error}` : "✅ Success";
    const screenshot = page.screenshotPath ? `[📸](../${page.screenshotPath})` : "❌";
    const dom = page.domPath ? `[📄](../${page.domPath})` : "❌";
    const analysis = page.analysisPath ? `[📋](../${page.analysisPath})` : "❌";
    const components = page.componentCount || 0;
    const tables = page.tableCount || 0;
    const forms = page.formCount || 0;
    const links = page.linkCount || 0;
    const url = page.url || page.originalUrl || "Unknown";
    
    tableContent += `| ${page.name} | ${page.category} | [${url}](${url}) | ${links} | ${components} | ${tables} | ${forms} | ${screenshot} | ${dom} | ${analysis} | ${status} |\n`;
  });

  return tableContent;
}

function generateMarkdownList(siteMap) {
  let listContent = `# Procore Sitemap - Page List\n\n`;
  listContent += `Generated: ${new Date().toISOString()}\n\n`;

  // Group by category
  const categories = {};
  siteMap.forEach(page => {
    const cat = page.category || "Unknown";
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(page);
  });

  // Generate list for each category
  listContent += `## Pages by Category\n\n`;
  Object.keys(categories).sort().forEach(category => {
    const pages = categories[category];
    const successCount = pages.filter(p => !p.error).length;
    
    listContent += `### ${category} (${successCount}/${pages.length} successful)\n\n`;
    
    pages.forEach(page => {
      const status = page.error ? " ❌" : " ✅";
      const url = page.url || page.originalUrl || "Unknown";
      const components = page.componentCount ? ` (${page.componentCount} components)` : "";
      listContent += `- [${page.name}](${url})${components}${status}\n`;
    });
    listContent += `\n`;
  });

  listContent += `## All Pages (Alphabetical)\n\n`;
  
  // Alphabetical list
  siteMap
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .forEach(page => {
      const status = page.error ? " ❌" : " ✅";
      const url = page.url || page.originalUrl || "Unknown";
      const components = page.componentCount ? ` (${page.componentCount} components)` : "";
      listContent += `- [${page.name}](${url})${components}${status}\n`;
    });

  return listContent;
}

function generateDetailedReport(siteMap) {
  const successfulPages = siteMap.filter(p => !p.error);
  
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalPages: siteMap.length,
      successfulCaptures: successfulPages.length,
      failedCaptures: siteMap.filter(p => p.error).length,
      categories: [...new Set(siteMap.map(p => p.category))].sort(),
    },
    pages: siteMap,
    linkAnalysis: {
      totalUniqueLinks: 0,
      mostLinkedPages: []
    },
    componentAnalysis: {
      mostComponentRichPages: [],
      pagesWithTables: [],
      pagesWithForms: [],
      categoryBreakdown: []
    }
  };
  
  if (successfulPages.length > 0) {
    // Add analysis if component data exists
    report.metadata.totalComponents = successfulPages.reduce((sum, p) => sum + (p.componentCount || 0), 0);
    report.metadata.totalTables = successfulPages.reduce((sum, p) => sum + (p.tableCount || 0), 0);
    report.metadata.totalForms = successfulPages.reduce((sum, p) => sum + (p.formCount || 0), 0);
    
    // Link analysis
    const allLinks = successfulPages.flatMap(p => (p.links || []).map(l => l.href)).filter(Boolean);
    report.linkAnalysis.totalUniqueLinks = [...new Set(allLinks)].length;
    report.linkAnalysis.mostLinkedPages = successfulPages
      .sort((a, b) => (b.linkCount || 0) - (a.linkCount || 0))
      .slice(0, 10)
      .map(p => ({ name: p.name, url: p.url, linkCount: p.linkCount || 0 }));
      
    // Component analysis
    report.componentAnalysis.mostComponentRichPages = successfulPages
      .sort((a, b) => (b.componentCount || 0) - (a.componentCount || 0))
      .slice(0, 10)
      .map(p => ({ name: p.name, url: p.url, componentCount: p.componentCount || 0 }));
      
    report.componentAnalysis.pagesWithTables = successfulPages.filter(p => (p.tableCount || 0) > 0)
      .map(p => ({ name: p.name, tableCount: p.tableCount, category: p.category }));
      
    report.componentAnalysis.pagesWithForms = successfulPages.filter(p => (p.formCount || 0) > 0)
      .map(p => ({ name: p.name, formCount: p.formCount, category: p.category }));
      
    // Category breakdown
    report.componentAnalysis.categoryBreakdown = [...new Set(siteMap.map(p => p.category))].map(category => {
      const categoryPages = siteMap.filter(p => p.category === category && !p.error);
      const totalComponents = categoryPages.reduce((sum, p) => sum + (p.componentCount || 0), 0);
      const avgComponents = categoryPages.length > 0 ? Math.round(totalComponents / categoryPages.length) : 0;
      
      return {
        category,
        pageCount: siteMap.filter(p => p.category === category).length,
        successfulPages: categoryPages.length,
        avgComponents,
        totalTables: categoryPages.reduce((sum, p) => sum + (p.tableCount || 0), 0),
        totalForms: categoryPages.reduce((sum, p) => sum + (p.formCount || 0), 0)
      };
    });
  }

  return report;
}

function generateSitemapSummary(siteMap, sourceDir, outputDir) {
  const successfulPages = siteMap.filter(p => !p.error);
  const totalComponents = successfulPages.reduce((sum, p) => sum + (p.componentCount || 0), 0);
  const totalTables = successfulPages.reduce((sum, p) => sum + (p.tableCount || 0), 0);
  const totalForms = successfulPages.reduce((sum, p) => sum + (p.formCount || 0), 0);

  const summary = `# Procore Sitemap Generation Summary

Generated: ${new Date().toISOString()}

## Source Data
- **Source Directory**: \`${path.resolve(sourceDir)}\`
- **Output Directory**: \`${path.resolve(outputDir)}\`

## Results Overview
- 📊 **Total Pages Found**: ${siteMap.length}
- ✅ **Successful Pages**: ${successfulPages.length}
- ❌ **Failed/Incomplete Pages**: ${siteMap.filter(p => p.error).length}

${totalComponents > 0 ? `## Analysis Summary
- 🧩 **Total UI Components**: ${totalComponents}
- 📊 **Total Tables**: ${totalTables}
- 📝 **Total Forms**: ${totalForms}
- 🔗 **Total Links**: ${siteMap.reduce((sum, p) => sum + (p.linkCount || 0), 0)}` : ''}

## Generated Files
- 📋 **Sitemap Table**: \`${path.join(REPORTS_DIR, "sitemap-table.md")}\`
- 📝 **Page List**: \`${path.join(REPORTS_DIR, "sitemap-list.md")}\`
- 📊 **Detailed Report**: \`${path.join(REPORTS_DIR, "detailed-report.json")}\`

## Category Breakdown
${[...new Set(siteMap.map(p => p.category))].map(category => {
  const categoryPages = siteMap.filter(p => p.category === category);
  const successfulInCategory = categoryPages.filter(p => !p.error);
  const categoryComponents = successfulInCategory.reduce((sum, p) => sum + (p.componentCount || 0), 0);
  return `- **${category}**: ${successfulInCategory.length}/${categoryPages.length} pages${categoryComponents > 0 ? `, ${categoryComponents} components` : ''}`;
}).join('\n')}

## Usage
- Open **sitemap-table.md** for a complete overview with links
- Use **sitemap-list.md** for a categorized page listing
- Check **detailed-report.json** for programmatic access to all data

## File Structure
\`\`\`
${path.basename(outputDir)}/
├── README.md                    # This summary
└── reports/
    ├── sitemap-table.md        # Complete table format
    ├── sitemap-list.md         # List by category
    └── detailed-report.json    # Complete data export
\`\`\`

${successfulPages.length > 0 ? `
## Quick Stats
- Most component-rich page: **${successfulPages.sort((a, b) => (b.componentCount || 0) - (a.componentCount || 0))[0]?.name}** (${successfulPages.sort((a, b) => (b.componentCount || 0) - (a.componentCount || 0))[0]?.componentCount} components)
- Most linked page: **${successfulPages.sort((a, b) => (b.linkCount || 0) - (a.linkCount || 0))[0]?.name}** (${successfulPages.sort((a, b) => (b.linkCount || 0) - (a.linkCount || 0))[0]?.linkCount} links)
- Pages with tables: ${successfulPages.filter(p => (p.tableCount || 0) > 0).length}
- Pages with forms: ${successfulPages.filter(p => (p.formCount || 0) > 0).length}
` : ''}
*Generated using the Procore Sitemap Generator*
`;

  return summary;
}

// ============================================
// MAIN SCRIPT
// ============================================
(async () => {
  console.log("🗺️  Procore Sitemap Generator");
  console.log("=============================\n");

  // Check for command line arguments
  const args = process.argv.slice(2);
  const sourceDir = args[0] || EXISTING_CRAWL_DIR;
  
  console.log(`📂 Source directory: ${path.resolve(sourceDir)}`);
  console.log(`📤 Output directory: ${path.resolve(OUTPUT_DIR)}\n`);

  // Load existing data
  console.log("📊 Loading existing crawl data...");
  const siteMap = loadExistingData(sourceDir);
  
  if (siteMap.length === 0) {
    console.log("❌ No data found to generate sitemap from.");
    console.log("💡 Run the crawler first or specify a different source directory:");
    console.log("   node scripts/generate-sitemap.js /path/to/crawl/data");
    process.exit(1);
  }

  console.log(`\n🏗️  Generating sitemap reports...`);

  // Generate sitemap table (markdown)
  const sitemapTable = generateSitemapTable(siteMap, sourceDir);
  const tableFile = path.join(REPORTS_DIR, "sitemap-table.md");
  fs.writeFileSync(tableFile, sitemapTable);
  console.log(`  ✅ Table format: ${tableFile}`);

  // Generate markdown list
  const markdownList = generateMarkdownList(siteMap);
  const listFile = path.join(REPORTS_DIR, "sitemap-list.md");
  fs.writeFileSync(listFile, markdownList);
  console.log(`  ✅ List format: ${listFile}`);

  // Generate detailed JSON report
  const detailedReport = generateDetailedReport(siteMap);
  const reportFile = path.join(REPORTS_DIR, "detailed-report.json");
  fs.writeFileSync(reportFile, JSON.stringify(detailedReport, null, 2));
  console.log(`  ✅ JSON report: ${reportFile}`);

  // Generate summary
  const summary = generateSitemapSummary(siteMap, sourceDir, OUTPUT_DIR);
  const summaryFile = path.join(OUTPUT_DIR, "README.md");
  fs.writeFileSync(summaryFile, summary);
  console.log(`  ✅ Summary: ${summaryFile}`);

  console.log("\n🎉 SITEMAP GENERATION COMPLETE!");
  console.log("===============================");
  console.log(`📁 Results saved to: ${path.resolve(OUTPUT_DIR)}`);
  console.log(`📊 Processed ${siteMap.length} pages`);
  console.log(`✅ Successful: ${siteMap.filter(p => !p.error).length}`);
  console.log(`❌ Failed: ${siteMap.filter(p => p.error).length}`);
  console.log(`🔍 View README.md for complete summary`);
})().catch(error => {
  console.error("❌ Sitemap generation failed:", error);
  process.exit(1);
});