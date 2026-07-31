import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DOM_DIR = './outputs/dom';
const ANALYSIS_DIR = './outputs/analysis';

// Create analysis directory
if (!fs.existsSync(ANALYSIS_DIR)) {
  fs.mkdirSync(ANALYSIS_DIR, { recursive: true });
}

async function analyzeDOMFile(domPath) {
  const fileName = path.basename(domPath, '.html');
  console.log(`\n📄 Analyzing: ${fileName}`);
  
  try {
    // Read and parse HTML
    const html = fs.readFileSync(domPath, 'utf-8');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Extract structured data from DOM
    const analysis = {
      fileName,
      title: document.title,
      
      // Extract forms and their structure
      forms: Array.from(document.querySelectorAll('form')).map(form => ({
        action: form.action,
        method: form.method,
        fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
          type: field.type || field.tagName.toLowerCase(),
          name: field.name,
          id: field.id,
          placeholder: field.placeholder,
          required: field.required,
          value: field.value,
          options: field.tagName === 'SELECT' ? 
            Array.from(field.options).map(opt => opt.text) : undefined,
          classes: field.className
        }))
      })),
      
      // Extract tables and their structure
      tables: Array.from(document.querySelectorAll('table')).map(table => ({
        headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim()),
        rowCount: table.querySelectorAll('tbody tr').length,
        hasActions: !!table.querySelector('button, a[href*="edit"], a[href*="delete"]'),
        classes: table.className,
        dataAttributes: Array.from(table.attributes)
          .filter(attr => attr.name.startsWith('data-'))
          .map(attr => ({ name: attr.name, value: attr.value }))
      })),
      
      // Extract navigation structure
      navigation: {
        mainNav: Array.from(document.querySelectorAll('nav a, .nav a, [role="navigation"] a')).map(link => ({
          text: link.textContent.trim(),
          href: link.href,
          classes: link.className
        })),
        breadcrumbs: Array.from(document.querySelectorAll('.breadcrumb a, [aria-label*="breadcrumb"] a')).map(link => ({
          text: link.textContent.trim(),
          href: link.href
        }))
      },
      
      // Extract buttons and actions
      actions: Array.from(document.querySelectorAll('button, input[type="submit"], .btn, a.btn')).map(btn => ({
        text: btn.textContent.trim(),
        type: btn.type || 'link',
        classes: btn.className,
        dataAttributes: Array.from(btn.attributes)
          .filter(attr => attr.name.startsWith('data-'))
          .map(attr => ({ name: attr.name, value: attr.value }))
      })),
      
      // Extract any inline JavaScript data
      inlineData: extractInlineData(html),
      
      // Extract component patterns (React, Vue, etc.)
      componentPatterns: extractComponentPatterns(document),
      
      // Extract API endpoints
      apiEndpoints: extractApiEndpoints(html),
      
      // CSS Framework detection
      cssFramework: detectCSSFramework(document),
      
      // Extract modals and dialogs
      modals: Array.from(document.querySelectorAll('.modal, [role="dialog"], .dialog')).map(modal => ({
        id: modal.id,
        title: modal.querySelector('.modal-title, h2, h3')?.textContent.trim(),
        classes: modal.className
      }))
    };
    
    // Get AI insights on the extracted data
    const aiAnalysis = await getAIAnalysis(analysis, html);
    
    // Combine structured extraction with AI analysis
    const fullAnalysis = {
      ...analysis,
      aiInsights: aiAnalysis,
      timestamp: new Date().toISOString()
    };
    
    // Save analysis
    const outputPath = path.join(ANALYSIS_DIR, `${fileName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(fullAnalysis, null, 2));
    
    // Generate markdown summary
    const markdown = generateMarkdownSummary(fullAnalysis);
    fs.writeFileSync(
      path.join(ANALYSIS_DIR, `${fileName}.md`),
      markdown
    );
    
    console.log(`  ✅ Analysis saved: ${fileName}.json and ${fileName}.md`);
    
    return fullAnalysis;
    
  } catch (error) {
    console.error(`  ❌ Error analyzing ${fileName}:`, error.message);
    return null;
  }
}

function extractInlineData(html) {
  const dataPatterns = [
    /window\.(\w+)\s*=\s*({[\s\S]*?});/g,
    /data-props=['"]({.*?})['"]>/g,
    /<script[^>]*type=['"]application\/json['"][^>]*>([\s\S]*?)<\/script>/g
  ];
  
  const extractedData = [];
  
  dataPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1] || match[2]);
        extractedData.push(data);
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  });
  
  return extractedData;
}

function extractComponentPatterns(document) {
  const patterns = {
    react: {
      found: false,
      components: []
    },
    vue: {
      found: false,
      components: []
    }
  };
  
  // Check for React patterns
  const reactElements = document.querySelectorAll('[data-react-props], [data-reactroot]');
  if (reactElements.length > 0) {
    patterns.react.found = true;
    patterns.react.components = Array.from(reactElements).map(el => ({
      tag: el.tagName,
      props: el.getAttribute('data-react-props')
    }));
  }
  
  // Check for Vue patterns
  const vueElements = document.querySelectorAll('[v-if], [v-for], [v-model]');
  if (vueElements.length > 0) {
    patterns.vue.found = true;
  }
  
  return patterns;
}

function extractApiEndpoints(html) {
  const endpoints = new Set();
  
  // Look for API URLs in various places
  const patterns = [
    /['"]\/api\/[^'"]+['"]/g,
    /fetch\(['"]([^'"]+)['"]/g,
    /axios\.\w+\(['"]([^'"]+)['"]/g,
    /url:\s*['"]([^'"]+)['"]/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1] || match[0].slice(1, -1);
      if (url.includes('/api/') || url.includes('/v1/') || url.includes('/v2/')) {
        endpoints.add(url);
      }
    }
  });
  
  return Array.from(endpoints);
}

function detectCSSFramework(document) {
  const frameworks = {
    bootstrap: !!document.querySelector('.container, .row, .col-md-12, .btn-primary'),
    tailwind: !!document.querySelector('[class*="flex-"], [class*="grid-"], [class*="p-"], [class*="m-"]'),
    materialUI: !!document.querySelector('.MuiButton-root, .MuiPaper-root'),
    antDesign: !!document.querySelector('.ant-btn, .ant-layout'),
    custom: true
  };
  
  return Object.entries(frameworks)
    .filter(([_, found]) => found)
    .map(([name]) => name);
}

async function getAIAnalysis(structuredData, html) {
  try {
    // Take a sample of the HTML to stay within token limits
    const htmlSample = html.substring(0, 10000);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are analyzing the DOM structure of a Procore page to help rebuild it as a modern web application. Focus on:
1. Identifying the core functionality and purpose
2. Understanding data models and relationships
3. Identifying reusable component patterns
4. Suggesting modern implementation approaches`
        },
        {
          role: 'user',
          content: `Based on this extracted DOM data and HTML sample, provide insights:

Structured Data:
${JSON.stringify(structuredData, null, 2).substring(0, 3000)}

HTML Sample:
${htmlSample}

Provide:
1. Page purpose and functionality
2. Key data models/entities
3. Component suggestions for React/Next.js
4. Database schema recommendations
5. API endpoint patterns needed`
        }
      ],
      max_tokens: 1500,
    });
    
    return response.choices[0].message.content;
    
  } catch (error) {
    console.error('AI Analysis error:', error.message);
    return null;
  }
}

function generateMarkdownSummary(analysis) {
  let markdown = `# DOM Analysis: ${analysis.fileName}\n\n`;
  markdown += `**Page Title:** ${analysis.title}\n`;
  markdown += `**Analyzed:** ${new Date(analysis.timestamp).toLocaleString()}\n\n`;
  
  // Forms section
  if (analysis.forms.length > 0) {
    markdown += `## Forms (${analysis.forms.length})\n\n`;
    analysis.forms.forEach((form, i) => {
      markdown += `### Form ${i + 1}\n`;
      markdown += `- **Action:** ${form.action || 'N/A'}\n`;
      markdown += `- **Method:** ${form.method || 'GET'}\n`;
      markdown += `- **Fields:** ${form.fields.length}\n\n`;
      
      if (form.fields.length > 0) {
        markdown += `| Field | Type | Name | Required |\n`;
        markdown += `|-------|------|------|----------|\n`;
        form.fields.forEach(field => {
          markdown += `| ${field.placeholder || field.name || 'N/A'} | ${field.type} | ${field.name || 'N/A'} | ${field.required ? 'Yes' : 'No'} |\n`;
        });
        markdown += '\n';
      }
    });
  }
  
  // Tables section
  if (analysis.tables.length > 0) {
    markdown += `## Tables (${analysis.tables.length})\n\n`;
    analysis.tables.forEach((table, i) => {
      markdown += `### Table ${i + 1}\n`;
      markdown += `- **Rows:** ${table.rowCount}\n`;
      markdown += `- **Has Actions:** ${table.hasActions ? 'Yes' : 'No'}\n`;
      if (table.headers.length > 0) {
        markdown += `- **Headers:** ${table.headers.join(', ')}\n`;
      }
      markdown += '\n';
    });
  }
  
  // Navigation section
  if (analysis.navigation.mainNav.length > 0) {
    markdown += `## Navigation\n\n`;
    markdown += `**Main Navigation (${analysis.navigation.mainNav.length} items):**\n`;
    analysis.navigation.mainNav.slice(0, 10).forEach(nav => {
      markdown += `- ${nav.text}\n`;
    });
    if (analysis.navigation.mainNav.length > 10) {
      markdown += `- ... and ${analysis.navigation.mainNav.length - 10} more\n`;
    }
    markdown += '\n';
  }
  
  // Actions section
  if (analysis.actions.length > 0) {
    markdown += `## Actions/Buttons (${analysis.actions.length})\n\n`;
    const uniqueActions = [...new Set(analysis.actions.map(a => a.text))];
    uniqueActions.slice(0, 10).forEach(action => {
      markdown += `- ${action}\n`;
    });
    if (uniqueActions.length > 10) {
      markdown += `- ... and ${uniqueActions.length - 10} more\n`;
    }
    markdown += '\n';
  }
  
  // API Endpoints
  if (analysis.apiEndpoints.length > 0) {
    markdown += `## API Endpoints Found\n\n`;
    analysis.apiEndpoints.forEach(endpoint => {
      markdown += `- ${endpoint}\n`;
    });
    markdown += '\n';
  }
  
  // CSS Frameworks
  if (analysis.cssFramework.length > 0) {
    markdown += `## CSS Frameworks Detected\n\n`;
    analysis.cssFramework.forEach(framework => {
      markdown += `- ${framework}\n`;
    });
    markdown += '\n';
  }
  
  // AI Insights
  if (analysis.aiInsights) {
    markdown += `## AI Analysis\n\n${analysis.aiInsights}\n`;
  }
  
  return markdown;
}

// Main execution
async function analyzeAllDOMFiles() {
  console.log('🔍 Starting DOM Analysis\n');
  
  if (!fs.existsSync(DOM_DIR)) {
    console.error(`❌ DOM directory not found: ${DOM_DIR}`);
    console.log('Please run the crawl script first to capture DOM files.');
    return;
  }
  
  const domFiles = fs.readdirSync(DOM_DIR).filter(file => file.endsWith('.html'));
  console.log(`Found ${domFiles.length} DOM files to analyze\n`);
  
  const results = [];
  for (const file of domFiles) {
    const result = await analyzeDOMFile(path.join(DOM_DIR, file));
    if (result) {
      results.push(result);
    }
    
    // Add a small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Generate overall summary
  const summary = {
    totalPages: results.length,
    analyzedAt: new Date().toISOString(),
    pages: results.map(r => ({
      name: r.fileName,
      title: r.title,
      forms: r.forms.length,
      tables: r.tables.length,
      actions: r.actions.length,
      apiEndpoints: r.apiEndpoints.length
    }))
  };
  
  fs.writeFileSync(
    path.join(ANALYSIS_DIR, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );
  
  console.log(`\n✅ Analysis complete!`);
  console.log(`📊 Analyzed ${results.length} pages`);
  console.log(`📁 Results saved to: ${ANALYSIS_DIR}`);
}

// Run the analysis
analyzeAllDOMFiles().catch(console.error);