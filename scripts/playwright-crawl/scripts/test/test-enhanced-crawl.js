import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./test-procore-sitemap";
const USER_DATA_DIR = path.join(process.cwd(), "user-data");
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

// Create directories
[OUTPUT_DIR, SCREENSHOT_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Store all page information for sitemap generation
const siteMap = [];

function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9\-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .toLowerCase()
    .substring(0, 150); // Limit length
}

function generatePageId(url, name) {
  // Create a unique, readable page ID
  const sanitized = sanitizeFilename(name || url);
  return sanitized || "unknown_page";
}

// Enhanced page analysis functions
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
      images: document.querySelectorAll('img').length,
      icons: document.querySelectorAll('i[class*="icon"], .icon, svg').length
    };

    // Analyze tables structure
    const tables = Array.from(document.querySelectorAll('table')).map((table, index) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = table.querySelectorAll('tbody tr').length;
      const hasActions = table.querySelector('td button, td a') || 
                        Array.from(table.querySelectorAll('th')).some(th => th.textContent.toLowerCase().includes('action'));
      
      return {
        index: index + 1,
        headers,
        rows,
        hasActions,
        classes: table.className,
        id: table.id || null
      };
    });

    // Extract navigation patterns
    const navigation = Array.from(document.querySelectorAll('nav a, .nav a, .navigation a')).map(link => ({
      text: link.textContent.trim(),
      href: link.href,
      isActive: link.classList.contains('active') || link.classList.contains('selected')
    }));

    // Analyze form structure
    const forms = Array.from(document.querySelectorAll('form')).map((form, index) => {
      const inputs = Array.from(form.querySelectorAll('input, textarea, select')).map(input => ({
        type: input.type || input.tagName.toLowerCase(),
        name: input.name || input.id,
        placeholder: input.placeholder || '',
        required: input.required
      }));
      
      return {
        index: index + 1,
        action: form.action,
        method: form.method || 'GET',
        inputs
      };
    });

    // Analyze color palette
    const colorElements = document.querySelectorAll('[style*="color"], [class*="color"], [class*="bg-"]');
    const colors = new Set();
    colorElements.forEach(el => {
      const style = getComputedStyle(el);
      if (style.color && style.color !== 'rgba(0, 0, 0, 0)') colors.add(style.color);
      if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') colors.add(style.backgroundColor);
    });

    // Detect interactive elements
    const interactive = {
      clickable: document.querySelectorAll('button, a, [onclick], [role="button"]').length,
      hoverable: document.querySelectorAll('[onmouseover], [title]').length,
      focusable: document.querySelectorAll('input, textarea, select, button, a[href]').length
    };

    // Layout analysis
    const layout = {
      hasHeader: !!document.querySelector('header, .header'),
      hasFooter: !!document.querySelector('footer, .footer'),
      hasSidebar: !!document.querySelector('.sidebar, .side-nav, aside'),
      hasMainContent: !!document.querySelector('main, .main-content, .content'),
      gridSystem: !!document.querySelector('[class*="grid"], [class*="col-"]'),
      flexbox: !!document.querySelector('[class*="flex"], [style*="display: flex"]')
    };

    return {
      components,
      tables,
      navigation,
      forms,
      colors: Array.from(colors).slice(0, 20), // Limit to 20 colors
      interactive,
      layout,
      title: document.title,
      headings: {
        h1: document.querySelectorAll('h1').length,
        h2: document.querySelectorAll('h2').length,
        h3: document.querySelectorAll('h3').length
      }
    };
  });
}

function generateInsights(pageInfo, analysis) {
  const insights = [];
  
  // Component insights
  if (analysis.components.tables > 3) {
    insights.push('📊 Data-heavy page with multiple tables - likely used for reporting/management');
  }
  if (analysis.components.forms > 2) {
    insights.push('📝 Form-intensive page - primary function is data entry/editing');
  }
  if (analysis.components.buttons > 10) {
    insights.push('🔘 Action-heavy interface with many interactive elements');
  }
  if (analysis.components.modals > 0) {
    insights.push('🪟 Uses modal dialogs for secondary workflows');
  }
  if (analysis.components.tabs > 0) {
    insights.push('📑 Tabbed interface for organizing related content');
  }
  
  // Table insights
  if (analysis.tables.length > 0) {
    const hasActions = analysis.tables.some(t => t.hasActions);
    if (hasActions) {
      insights.push('⚡ Tables include action buttons - supports CRUD operations');
    }
    const maxRows = Math.max(...analysis.tables.map(t => t.rows), 0);
    if (maxRows > 50) {
      insights.push('📈 Large datasets - likely needs pagination/filtering');
    }
  }
  
  // Layout insights
  if (analysis.layout.hasSidebar) {
    insights.push('📱 Sidebar navigation pattern for main navigation');
  }
  if (analysis.layout.gridSystem) {
    insights.push('🎯 Uses grid system for responsive layout');
  }
  
  return insights;
}

function generateMarkdownAnalysis(pageInfo, analysis) {
  const insights = generateInsights(pageInfo, analysis);
  
  let markdown = `# ${pageInfo.name} - Page Analysis\n\n`;
  markdown += `**Generated:** ${new Date().toISOString()}\n`;
  markdown += `**Category:** ${pageInfo.category}\n`;
  markdown += `**URL:** [${pageInfo.url}](${pageInfo.url})\n\n`;
  
  // Summary
  markdown += `## 📋 Summary\n\n`;
  const componentCount = Object.values(analysis.components).reduce((a, b) => a + b, 0);
  markdown += `This ${pageInfo.category} page contains ${componentCount} total UI components with ${analysis.tables.length} tables and ${analysis.forms.length} forms. `;
  
  if (analysis.tables.length > 0) {
    markdown += `Primary function appears to be data management and reporting. `;
  }
  if (analysis.forms.length > 0) {
    markdown += `Includes data entry capabilities. `;
  }
  
  markdown += `\n\n`;
  
  // Important Insights
  if (insights.length > 0) {
    markdown += `## 💡 Important Insights\n\n`;
    insights.forEach(insight => {
      markdown += `- ${insight}\n`;
    });
    markdown += `\n`;
  }
  
  // Components Used
  markdown += `## 🧩 Components Inventory\n\n`;
  markdown += `| Component Type | Count | Notes |\n`;
  markdown += `|----------------|-------|-------|\n`;
  
  Object.entries(analysis.components).forEach(([component, count]) => {
    if (count > 0) {
      let notes = '';
      if (component === 'tables' && count > 2) notes = 'Data-heavy interface';
      if (component === 'forms' && count > 1) notes = 'Multi-form workflow';
      if (component === 'buttons' && count > 10) notes = 'Action-rich interface';
      if (component === 'modals' && count > 0) notes = 'Overlay workflows';
      
      markdown += `| ${component.charAt(0).toUpperCase() + component.slice(1)} | ${count} | ${notes} |\n`;
    }
  });
  
  markdown += `\n`;
  
  // Tables Analysis
  if (analysis.tables.length > 0) {
    markdown += `## 📊 Tables Needed\n\n`;
    analysis.tables.forEach((table, index) => {
      markdown += `### Table ${index + 1}\n`;
      markdown += `- **Headers:** ${table.headers.join(', ')}\n`;
      markdown += `- **Rows:** ${table.rows}\n`;
      markdown += `- **Has Actions:** ${table.hasActions ? 'Yes' : 'No'}\n`;
      if (table.id) markdown += `- **ID:** ${table.id}\n`;
      markdown += `\n`;
    });
  }
  
  // Related Tables/Data
  markdown += `## 🔗 Related Tables & Data Relationships\n\n`;
  
  // Infer relationships based on page type and content
  const relatedTables = [];
  
  if (pageInfo.category === 'Test Page') {
    relatedTables.push('projects', 'users', 'companies', 'documents');
  }
  
  const uniqueRelated = [...new Set(relatedTables)];
  if (uniqueRelated.length > 0) {
    markdown += `**Likely Related Tables:**\n`;
    uniqueRelated.forEach(table => {
      markdown += `- \`${table}\`\n`;
    });
  } else {
    markdown += `*Analysis would suggest related tables based on page content*\n`;
  }
  
  markdown += `\n`;
  
  // Development Recommendations
  markdown += `## 🚀 Development Recommendations\n\n`;
  
  if (analysis.components.tables > 0) {
    markdown += `- **Data Grid Component**: Implement reusable table with sorting, filtering, pagination\n`;
  }
  if (analysis.components.forms > 0) {
    markdown += `- **Form Validation**: Implement client and server-side validation\n`;
  }
  if (analysis.components.modals > 0) {
    markdown += `- **Modal System**: Create reusable modal/dialog component\n`;
  }
  
  markdown += `- **Responsive Design**: Ensure mobile compatibility\n`;
  markdown += `- **Accessibility**: Add ARIA labels and keyboard navigation\n`;
  
  markdown += `\n---\n\n`;
  markdown += `*Analysis generated automatically from DOM structure and page content*`;
  
  return markdown;
}

async function capturePageData(page, pageInfo) {
  const { url, name, category } = pageInfo;
  const pageId = generatePageId(url, name);
  const pageDir = path.join(SCREENSHOT_DIR, pageId);
  
  // Create individual page directory
  if (!fs.existsSync(pageDir)) {
    fs.mkdirSync(pageDir, { recursive: true });
  }

  try {
    // Take screenshot
    const screenshotPath = path.join(pageDir, "screenshot.png");
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    // Save DOM snapshot
    const html = await page.content();
    const domPath = path.join(pageDir, "dom.html");
    fs.writeFileSync(domPath, html);

    // Extract additional metadata
    const title = await page.title();
    const currentUrl = page.url();
    
    // Get page links for sitemap analysis
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors.map(a => ({
        text: a.textContent.trim(),
        href: a.href,
        rel: a.rel || ""
      })).filter(link => link.text && link.href);
    });

    // Perform detailed page analysis
    console.log(`    🔍 Analyzing page structure...`);
    const analysis = await analyzePageStructure(page);
    
    // Generate comprehensive markdown analysis
    const markdownAnalysis = generateMarkdownAnalysis(pageInfo, analysis);
    const analysisPath = path.join(pageDir, "analysis.md");
    fs.writeFileSync(analysisPath, markdownAnalysis);
    
    // Enhanced page data with analysis
    const enhancedPageData = {
      id: pageId,
      name: name || title,
      url: currentUrl,
      originalUrl: url,
      category: category || "Test Page",
      title,
      timestamp: new Date().toISOString(),
      screenshotPath: `pages/${pageId}/screenshot.png`,
      domPath: `pages/${pageId}/dom.html`,
      analysisPath: `pages/${pageId}/analysis.md`,
      linkCount: links.length,
      componentCount: Object.values(analysis.components).reduce((a, b) => a + b, 0),
      tableCount: analysis.tables.length,
      formCount: analysis.forms.length,
      analysis: {
        components: analysis.components,
        tableHeaders: analysis.tables.map(t => t.headers),
        hasModals: analysis.components.modals > 0,
        hasGridSystem: analysis.layout.gridSystem,
        colorCount: analysis.colors.length
      }
    };
    
    // Save individual page metadata with analysis
    const metadataPath = path.join(pageDir, "metadata.json");
    fs.writeFileSync(metadataPath, JSON.stringify({
      ...enhancedPageData,
      links, // Include all links in individual metadata
      fullAnalysis: analysis // Complete analysis data
    }, null, 2));

    siteMap.push(enhancedPageData);

    console.log(`  ✓ Captured: ${name} (${links.length} links, ${enhancedPageData.componentCount} components, ${enhancedPageData.tableCount} tables)`);
    return enhancedPageData;

  } catch (error) {
    console.error(`  ✗ Failed to capture ${name}: ${error.message}`);
    return null;
  }
}

// Test with a simple page
async function testAnalysisFeatures() {
  console.log("🧪 Testing Enhanced Analysis Features");
  console.log("====================================\n");

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 
  });
  
  const page = await browser.newPage();

  // Test with a simple HTML page to demonstrate functionality
  const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Procore-style Page</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #007acc; color: white; padding: 10px; }
        .sidebar { width: 200px; float: left; background: #f5f5f5; padding: 10px; }
        .main { margin-left: 220px; padding: 10px; }
        .card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; }
        .btn { background: #007acc; color: white; padding: 8px 16px; border: none; cursor: pointer; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Project Management Dashboard</h1>
        <nav>
          <a href="/projects">Projects</a> | 
          <a href="/budget">Budget</a> | 
          <a href="/reports">Reports</a>
        </nav>
      </div>
      
      <div class="sidebar">
        <ul>
          <li><a href="/home">Dashboard</a></li>
          <li><a href="/directory">Directory</a></li>
          <li><a href="/commitments">Commitments</a></li>
          <li><a href="/rfis">RFIs</a></li>
        </ul>
      </div>
      
      <div class="main">
        <div class="card">
          <h2>Recent Commitments</h2>
          <table>
            <thead>
              <tr>
                <th>Commitment #</th>
                <th>Vendor</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>COM-001</td>
                <td>ABC Construction</td>
                <td>$125,000</td>
                <td>Approved</td>
                <td><button class="btn">View</button> <button class="btn">Edit</button></td>
              </tr>
              <tr>
                <td>COM-002</td>
                <td>XYZ Electrical</td>
                <td>$85,000</td>
                <td>Pending</td>
                <td><button class="btn">View</button> <button class="btn">Edit</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="card">
          <h2>Add New Commitment</h2>
          <form>
            <p>
              <label>Vendor:</label><br>
              <select name="vendor" required>
                <option>Select Vendor</option>
                <option>ABC Construction</option>
                <option>XYZ Electrical</option>
              </select>
            </p>
            <p>
              <label>Amount:</label><br>
              <input type="number" name="amount" placeholder="Enter amount" required>
            </p>
            <p>
              <label>Description:</label><br>
              <textarea name="description" rows="3" placeholder="Enter description"></textarea>
            </p>
            <p>
              <button type="submit" class="btn">Create Commitment</button>
              <button type="button" class="btn">Cancel</button>
            </p>
          </form>
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(testHtml);
  await page.waitForTimeout(1000);

  // Test the analysis functionality
  const testPageInfo = {
    url: "http://test.procore.example/commitments",
    name: "Test Commitments Page",
    category: "Financials"
  };

  console.log("🔍 Testing page analysis...");
  await capturePageData(page, testPageInfo);

  await browser.close();

  // Generate reports
  console.log("\n📊 Generating test reports...");

  // Simple sitemap table
  let tableContent = `# Test Sitemap with Analysis\n\n`;
  tableContent += `Generated: ${new Date().toISOString()}\n\n`;
  tableContent += `## Test Results\n`;
  tableContent += `- Total Pages: ${siteMap.length}\n`;
  tableContent += `- Total Components: ${siteMap.reduce((sum, p) => sum + (p.componentCount || 0), 0)}\n`;
  tableContent += `- Total Tables: ${siteMap.reduce((sum, p) => sum + (p.tableCount || 0), 0)}\n`;
  tableContent += `- Total Forms: ${siteMap.reduce((sum, p) => sum + (p.formCount || 0), 0)}\n\n`;
  
  tableContent += `| Page Name | Category | Components | Tables | Forms | Screenshot | DOM | Analysis |\n`;
  tableContent += `|-----------|----------|------------|--------|-------|------------|-----|----------|\n`;
  
  siteMap.forEach(page => {
    const screenshot = page.screenshotPath ? `[📸](${page.screenshotPath})` : "❌";
    const dom = page.domPath ? `[📄](${page.domPath})` : "❌";
    const analysis = page.analysisPath ? `[📋](${page.analysisPath})` : "❌";
    
    tableContent += `| ${page.name} | ${page.category} | ${page.componentCount || 0} | ${page.tableCount || 0} | ${page.formCount || 0} | ${screenshot} | ${dom} | ${analysis} |\n`;
  });

  fs.writeFileSync(path.join(REPORTS_DIR, "test-results.md"), tableContent);

  console.log("\n🎉 TEST COMPLETE!");
  console.log("==================");
  console.log(`📁 Results saved to: ${path.resolve(OUTPUT_DIR)}`);
  console.log(`📋 Test report: ${path.join(REPORTS_DIR, "test-results.md")}`);
  console.log(`🔍 Check the analysis.md file in the page folder!`);
}

// Run the test
testAnalysisFeatures().catch(error => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});