import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// ========= CONFIG ===========
const OUTPUT_DIR = "./procore-sitemap";
const USER_DATA_DIR = path.join(process.cwd(), "user-data");
const WAIT_TIME = 2000;
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "pages");
const REPORTS_DIR = path.join(OUTPUT_DIR, "reports");

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
  
  // Category-specific insights
  if (pageInfo.category === 'Financials') {
    insights.push('💰 Financial data requires careful validation and audit trails');
  }
  if (pageInfo.category === 'Project Management') {
    insights.push('🏗️ Core project functionality - high user interaction expected');
  }
  if (pageInfo.category === 'Quality & Safety') {
    insights.push('🛡️ Safety-critical data - compliance and documentation important');
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
  
  if (pageInfo.category === 'Financials') {
    relatedTables.push('projects', 'contracts', 'budgets', 'line_items', 'vendors', 'cost_codes');
  } else if (pageInfo.category === 'Project Management') {
    relatedTables.push('projects', 'users', 'companies', 'documents', 'activities');
  } else if (pageInfo.category === 'Quality & Safety') {
    relatedTables.push('projects', 'inspections', 'issues', 'users', 'photos');
  } else if (pageInfo.category === 'Design Coordination') {
    relatedTables.push('projects', 'drawings', 'submittals', 'rfis', 'users', 'companies');
  }
  
  // Add form-based relationships
  analysis.forms.forEach(form => {
    form.inputs.forEach(input => {
      if (input.name && input.name.includes('project')) relatedTables.push('projects');
      if (input.name && input.name.includes('user')) relatedTables.push('users');
      if (input.name && input.name.includes('company')) relatedTables.push('companies');
    });
  });
  
  const uniqueRelated = [...new Set(relatedTables)];
  if (uniqueRelated.length > 0) {
    markdown += `**Likely Related Tables:**\n`;
    uniqueRelated.forEach(table => {
      markdown += `- \`${table}\`\n`;
    });
  } else {
    markdown += `*No obvious table relationships detected*\n`;
  }
  
  markdown += `\n`;
  
  // Forms Analysis
  if (analysis.forms.length > 0) {
    markdown += `## 📝 Forms Analysis\n\n`;
    analysis.forms.forEach((form, index) => {
      markdown += `### Form ${index + 1}\n`;
      markdown += `- **Method:** ${form.method}\n`;
      if (form.action) markdown += `- **Action:** ${form.action}\n`;
      markdown += `- **Fields:** ${form.inputs.length}\n`;
      
      if (form.inputs.length > 0) {
        markdown += `\n**Field Details:**\n`;
        form.inputs.forEach(input => {
          markdown += `- ${input.type}: ${input.name || 'unnamed'}${input.required ? ' (required)' : ''}\n`;
        });
      }
      markdown += `\n`;
    });
  }
  
  // Technical Implementation
  markdown += `## ⚙️ Technical Implementation Notes\n\n`;
  markdown += `### Layout & Structure\n`;
  markdown += `- **Has Header:** ${analysis.layout.hasHeader}\n`;
  markdown += `- **Has Sidebar:** ${analysis.layout.hasSidebar}\n`;
  markdown += `- **Grid System:** ${analysis.layout.gridSystem}\n`;
  markdown += `- **Flexbox:** ${analysis.layout.flexbox}\n\n`;
  
  markdown += `### Interactive Elements\n`;
  markdown += `- **Clickable Elements:** ${analysis.interactive.clickable}\n`;
  markdown += `- **Focusable Elements:** ${analysis.interactive.focusable}\n\n`;
  
  // Color Analysis
  if (analysis.colors.length > 0) {
    markdown += `### Color Palette (Sample)\n`;
    analysis.colors.slice(0, 10).forEach(color => {
      markdown += `- \`${color}\`\n`;
    });
    markdown += `\n`;
  }
  
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
  if (analysis.interactive.clickable > 10) {
    markdown += `- **Loading States**: Implement loading indicators for actions\n`;
  }
  
  markdown += `- **Responsive Design**: Ensure mobile compatibility\n`;
  markdown += `- **Accessibility**: Add ARIA labels and keyboard navigation\n`;
  markdown += `- **Performance**: Optimize for ${analysis.tables.reduce((sum, t) => sum + t.rows, 0)} total table rows\n`;
  
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
      category: category || "Unknown",
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
    
    // Still record the attempt in sitemap
    const failedPageData = {
      id: pageId,
      name: name || "Unknown",
      url: url,
      originalUrl: url,
      category: category || "Unknown",
      title: "Failed to load",
      timestamp: new Date().toISOString(),
      screenshotPath: null,
      domPath: null,
      linkCount: 0,
      links: [],
      error: error.message
    };
    
    siteMap.push(failedPageData);
    return failedPageData;
  }
}

async function performProocreLogin(page) {
  console.log("🔐 Performing automatic Procore login...");
  
  try {
    // Go to Procore login page
    await page.goto("https://login.procore.com");
    await page.waitForTimeout(2000);

    // Fill in email
    console.log("  📧 Entering email...");
    await page.fill('input[name="email"], input[type="email"], #email', PROCORE_EMAIL);
    await page.waitForTimeout(1000);

    // Fill in password
    console.log("  🔒 Entering password...");
    await page.fill('input[name="password"], input[type="password"], #password', PROCORE_PASSWORD);
    await page.waitForTimeout(1000);

    // Submit the form
    console.log("  🚀 Submitting login form...");
    await page.click('button[type="submit"], input[type="submit"], .btn-primary');

    // Wait for redirect away from login page
    console.log("  ⏳ Waiting for login to complete...");
    await page.waitForFunction(
      () => !window.location.href.includes('login.procore.com'),
      { timeout: 60000 }
    );

    console.log("  ✅ Login successful!");
    return true;

  } catch (error) {
    console.error(`  ❌ Login failed: ${error.message}`);
    console.log("  ℹ️ You may need to log in manually in the browser window.");
    return false;
  }
}

// ============================================
// MAIN SCRIPT
// ============================================
(async () => {
  console.log("🚀 Starting Enhanced Procore Sitemap Generation");
  console.log("================================================\n");

  // Create user-data directory if it doesn't exist
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  // Use persistent browser context
  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    slowMo: 100,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized"
    ],
    viewport: { width: 1500, height: 900 }
  });

  const page = browser.pages()[0] || await browser.newPage();

  // Check if we need to login
  console.log("🔐 Checking authentication...");
  await page.goto("https://login.procore.com");
  await page.waitForTimeout(2000);

  // If we're on login page, attempt automatic login
  if (page.url().includes("login.procore.com")) {
    const loginSuccess = await performProocreLogin(page);
    
    if (!loginSuccess) {
      console.log("\n🔄 Automatic login failed. Waiting for manual login...");
      console.log("Please complete login manually in the browser window.");
      
      // Wait for manual login with longer timeout
      await page.waitForFunction(
        () => !window.location.href.includes('login.procore.com'),
        { timeout: 300000 } // 5 minutes for manual login
      );
    }
    
    console.log("✅ Authentication complete!\n");
  } else {
    console.log("✅ Using existing session - skipping login.\n");
  }

  // Navigate to main Procore page to establish base URL
  await page.goto("https://us02.procore.com");
  await page.waitForTimeout(2000);
  
  // Use the hardcoded base URL for comprehensive crawl
  const baseUrl = "https://us02.procore.com/562949954728542";

  console.log(`📍 Base URL: ${baseUrl}`);
  console.log("🕷️  Starting comprehensive crawl...\n");

  // Define all pages to crawl with categories
  const pagesToCrawl = [
    // Project Management
    { url: `${baseUrl}/project/home`, name: "Project Home", category: "Project Management" },
    { url: `${baseUrl}/project/directory`, name: "Directory", category: "Project Management" },
    { url: `${baseUrl}/project/schedule`, name: "Schedule", category: "Project Management" },
    { url: `${baseUrl}/project/daily_log`, name: "Daily Log", category: "Project Management" },
    { url: `${baseUrl}/project/drawings`, name: "Drawings", category: "Project Management" },
    { url: `${baseUrl}/project/photos`, name: "Photos", category: "Project Management" },
    { url: `${baseUrl}/project/meetings`, name: "Meetings", category: "Project Management" },
    { url: `${baseUrl}/project/correspondence`, name: "Correspondence", category: "Project Management" },
    { url: `${baseUrl}/project/forms`, name: "Forms", category: "Project Management" },

    // Quality & Safety
    { url: `${baseUrl}/project/punch_list`, name: "Punch List", category: "Quality & Safety" },
    { url: `${baseUrl}/project/inspections`, name: "Inspections", category: "Quality & Safety" },
    { url: `${baseUrl}/project/incidents`, name: "Incidents", category: "Quality & Safety" },
    { url: `${baseUrl}/project/observations`, name: "Observations", category: "Quality & Safety" },

    // Design Coordination
    { url: `${baseUrl}/project/rfis`, name: "RFIs", category: "Design Coordination" },
    { url: `${baseUrl}/project/submittals`, name: "Submittals", category: "Design Coordination" },
    { url: `${baseUrl}/project/coordination_issues`, name: "Coordination Issues", category: "Design Coordination" },

    // Financials
    { url: `${baseUrl}/project/prime_contracts`, name: "Prime Contracts", category: "Financials" },
    { url: `${baseUrl}/project/prime_contract_change_orders`, name: "Prime Contract Change Orders", category: "Financials" },
    { url: `${baseUrl}/project/commitments`, name: "Commitments", category: "Financials" },
    { url: `${baseUrl}/project/commitment_change_orders`, name: "Commitment Change Orders", category: "Financials" },
    { url: `${baseUrl}/project/budget`, name: "Project Budget", category: "Financials" },
    { url: `${baseUrl}/project/change_events`, name: "Change Events", category: "Financials" },
    { url: `${baseUrl}/project/invoicing`, name: "Invoicing", category: "Financials" },

    // Company Level
    { url: `${baseUrl}/company/home/list`, name: "Company - Project List", category: "Company" },
    { url: `${baseUrl}/company/home/portfolio`, name: "Company - Portfolio", category: "Company" },
    { url: `${baseUrl}/company/home/thumbnail`, name: "Company - Thumbnail View", category: "Company" },
    { url: `${baseUrl}/company/home/map`, name: "Company - Map View", category: "Company" },
    { url: `${baseUrl}/company/home/executive_dashboard`, name: "Company - Executive Dashboard", category: "Company" },
    { url: `${baseUrl}/company/home/health_dashboard`, name: "Company - Health Dashboard", category: "Company" },
    { url: `${baseUrl}/company/home/my_open_items`, name: "Company - My Open Items", category: "Company" },
    { url: `${baseUrl}/company/home/budgeting_report`, name: "Company - Budgeting Report", category: "Company" },
    { url: `${baseUrl}/company/home/project_variance_report`, name: "Company - Project Variance Report", category: "Company" },
    { url: `${baseUrl}/company/home/job_cost_summary`, name: "Company - Job Cost Summary", category: "Company" },
    { url: `${baseUrl}/company/home/committed_costs`, name: "Company - Committed Costs", category: "Company" },
    { url: `${baseUrl}/company/directory`, name: "Company Directory", category: "Company" },
    { url: `${baseUrl}/company/admin`, name: "Company Admin", category: "Company" }
  ];

  // Crawl selected pages
  let completed = 0;
  for (const pageInfo of pagesToCrawl) {
    completed++;
    try {
      console.log(`[${completed}/${pagesToCrawl.length}] 📑 ${pageInfo.name}`);
      await page.goto(pageInfo.url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(WAIT_TIME);
      
      await capturePageData(page, pageInfo);
      
    } catch (error) {
      console.error(`  ✗ Failed to crawl ${pageInfo.name}: ${error.message}`);
    }
  }

  console.log("\n🎉 ENHANCED CRAWL COMPLETE!");
  console.log("===========================");
  console.log(`📁 Results saved to: ${path.resolve(OUTPUT_DIR)}`);
  console.log(`📊 ${siteMap.filter(p => !p.error).length} pages successfully captured`);

  await browser.close();
})().catch(error => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});