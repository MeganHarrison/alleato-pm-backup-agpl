import fs from 'fs';
import path from 'path';

const ANALYSIS_DIR = './outputs/analysis';
const REPORTS_DIR = './outputs/reports';

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function generateConsolidatedReport() {
  console.log('📊 Generating Consolidated Report...\n');
  
  // Read all JSON analysis files
  const analysisFiles = fs.readdirSync(ANALYSIS_DIR)
    .filter(file => file.endsWith('.json') && file !== 'summary.json');
  
  const allAnalyses = analysisFiles.map(file => {
    const content = fs.readFileSync(path.join(ANALYSIS_DIR, file), 'utf-8');
    return JSON.parse(content);
  });
  
  // Extract common patterns
  const patterns = {
    // UI Components
    commonActions: extractCommonActions(allAnalyses),
    navigationPatterns: extractNavigationPatterns(allAnalyses),
    formPatterns: extractFormPatterns(allAnalyses),
    tablePatterns: extractTablePatterns(allAnalyses),
    
    // Technical patterns
    cssFrameworks: extractCSSFrameworks(allAnalyses),
    apiEndpoints: extractAPIPatterns(allAnalyses),
    componentTypes: extractComponentTypes(allAnalyses),
    
    // Data patterns
    dataModels: extractDataModels(allAnalyses),
    
    // Page statistics
    pageStats: generatePageStats(allAnalyses)
  };
  
  // Generate the report
  const report = generateMarkdownReport(patterns, allAnalyses);
  
  // Save the report
  const reportPath = path.join(REPORTS_DIR, 'consolidated-patterns-report.md');
  fs.writeFileSync(reportPath, report);
  
  // Also save as JSON for programmatic use
  const jsonReportPath = path.join(REPORTS_DIR, 'consolidated-patterns.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(patterns, null, 2));
  
  console.log(`✅ Report generated: ${reportPath}`);
  console.log(`📄 JSON data saved: ${jsonReportPath}`);
}

function extractCommonActions(analyses) {
  const actionCounts = {};
  
  analyses.forEach(analysis => {
    if (analysis.actions && Array.isArray(analysis.actions)) {
      analysis.actions.forEach(action => {
        const text = action.text.trim();
        if (text) {
          actionCounts[text] = (actionCounts[text] || 0) + 1;
        }
      });
    }
  });
  
  // Sort by frequency
  return Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([action, count]) => ({ action, count, percentage: (count / analyses.length * 100).toFixed(1) }));
}

function extractNavigationPatterns(analyses) {
  const navItems = {};
  const breadcrumbPatterns = [];
  
  analyses.forEach(analysis => {
    if (analysis.navigation) {
      // Main navigation items
      if (analysis.navigation.mainNav) {
        analysis.navigation.mainNav.forEach(nav => {
          const text = nav.text.trim();
          if (text) {
            navItems[text] = (navItems[text] || 0) + 1;
          }
        });
      }
      
      // Breadcrumb patterns
      if (analysis.navigation.breadcrumbs && analysis.navigation.breadcrumbs.length > 0) {
        breadcrumbPatterns.push({
          page: analysis.fileName,
          breadcrumbs: analysis.navigation.breadcrumbs.map(b => b.text)
        });
      }
    }
  });
  
  return {
    commonNavItems: Object.entries(navItems)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([item, count]) => ({ item, count })),
    breadcrumbPatterns
  };
}

function extractFormPatterns(analyses) {
  const fieldTypes = {};
  const fieldNames = {};
  const formStructures = [];
  
  analyses.forEach(analysis => {
    if (analysis.forms && analysis.forms.length > 0) {
      analysis.forms.forEach(form => {
        // Track form structure
        formStructures.push({
          page: analysis.fileName,
          fieldCount: form.fields.length,
          method: form.method || 'GET',
          fields: form.fields.map(f => ({
            type: f.type,
            name: f.name,
            required: f.required
          }))
        });
        
        // Track field types and names
        form.fields.forEach(field => {
          if (field.type) {
            fieldTypes[field.type] = (fieldTypes[field.type] || 0) + 1;
          }
          if (field.name) {
            fieldNames[field.name] = (fieldNames[field.name] || 0) + 1;
          }
        });
      });
    }
  });
  
  return {
    commonFieldTypes: Object.entries(fieldTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count })),
    commonFieldNames: Object.entries(fieldNames)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count })),
    formStructures
  };
}

function extractTablePatterns(analyses) {
  const headerPatterns = {};
  const tableStats = [];
  
  analyses.forEach(analysis => {
    if (analysis.tables && analysis.tables.length > 0) {
      analysis.tables.forEach(table => {
        // Track table statistics
        tableStats.push({
          page: analysis.fileName,
          headers: table.headers,
          rowCount: table.rowCount,
          hasActions: table.hasActions
        });
        
        // Track common headers
        table.headers.forEach(header => {
          if (header) {
            headerPatterns[header] = (headerPatterns[header] || 0) + 1;
          }
        });
      });
    }
  });
  
  return {
    commonHeaders: Object.entries(headerPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([header, count]) => ({ header, count })),
    tableStats,
    averageColumns: tableStats.length > 0 
      ? (tableStats.reduce((sum, t) => sum + t.headers.length, 0) / tableStats.length).toFixed(1)
      : 0
  };
}

function extractCSSFrameworks(analyses) {
  const frameworks = {};
  
  analyses.forEach(analysis => {
    if (analysis.cssFramework && Array.isArray(analysis.cssFramework)) {
      analysis.cssFramework.forEach(framework => {
        frameworks[framework] = (frameworks[framework] || 0) + 1;
      });
    }
  });
  
  return Object.entries(frameworks)
    .sort((a, b) => b[1] - a[1])
    .map(([framework, count]) => ({ 
      framework, 
      count, 
      percentage: (count / analyses.length * 100).toFixed(1) 
    }));
}

function extractAPIPatterns(analyses) {
  const endpoints = {};
  const endpointPatterns = {
    restful: [],
    graphql: [],
    other: []
  };
  
  analyses.forEach(analysis => {
    if (analysis.apiEndpoints && Array.isArray(analysis.apiEndpoints)) {
      analysis.apiEndpoints.forEach(endpoint => {
        endpoints[endpoint] = (endpoints[endpoint] || 0) + 1;
        
        // Categorize endpoints
        if (endpoint.includes('/api/') || endpoint.includes('/v1/') || endpoint.includes('/v2/')) {
          endpointPatterns.restful.push(endpoint);
        } else if (endpoint.includes('/graphql')) {
          endpointPatterns.graphql.push(endpoint);
        } else {
          endpointPatterns.other.push(endpoint);
        }
      });
    }
  });
  
  return {
    allEndpoints: Object.entries(endpoints)
      .sort((a, b) => b[1] - a[1])
      .map(([endpoint, count]) => ({ endpoint, count })),
    patterns: {
      restful: [...new Set(endpointPatterns.restful)],
      graphql: [...new Set(endpointPatterns.graphql)],
      other: [...new Set(endpointPatterns.other)]
    }
  };
}

function extractComponentTypes(analyses) {
  const components = {
    forms: 0,
    tables: 0,
    modals: 0,
    navigation: 0,
    actions: 0
  };
  
  analyses.forEach(analysis => {
    if (analysis.forms && analysis.forms.length > 0) components.forms++;
    if (analysis.tables && analysis.tables.length > 0) components.tables++;
    if (analysis.modals && analysis.modals.length > 0) components.modals++;
    if (analysis.navigation && analysis.navigation.mainNav && analysis.navigation.mainNav.length > 0) components.navigation++;
    if (analysis.actions && analysis.actions.length > 0) components.actions++;
  });
  
  return Object.entries(components)
    .map(([type, count]) => ({
      type,
      count,
      percentage: (count / analyses.length * 100).toFixed(1)
    }))
    .sort((a, b) => b.count - a.count);
}

function extractDataModels(analyses) {
  // Extract common data patterns from AI insights
  const models = new Set();
  const relationships = new Set();
  
  analyses.forEach(analysis => {
    if (analysis.aiInsights) {
      // Look for model definitions in AI insights
      const modelMatches = analysis.aiInsights.match(/\*\*(\w+)\*\*.*?Attributes:([^*]+)/g) || [];
      modelMatches.forEach(match => {
        const modelName = match.match(/\*\*(\w+)\*\*/)?.[1];
        if (modelName) models.add(modelName);
      });
      
      // Look for foreign key relationships
      const fkMatches = analysis.aiInsights.match(/foreign key|Foreign Key/gi) || [];
      if (fkMatches.length > 0) {
        const lines = analysis.aiInsights.split('\n');
        lines.forEach(line => {
          if (line.toLowerCase().includes('foreign key')) {
            relationships.add(line.trim());
          }
        });
      }
    }
  });
  
  return {
    identifiedModels: Array.from(models),
    relationships: Array.from(relationships)
  };
}

function generatePageStats(analyses) {
  return {
    totalPages: analyses.length,
    pagesWithForms: analyses.filter(a => a.forms && a.forms.length > 0).length,
    pagesWithTables: analyses.filter(a => a.tables && a.tables.length > 0).length,
    pagesWithNavigation: analyses.filter(a => a.navigation && a.navigation.mainNav && a.navigation.mainNav.length > 0).length,
    pagesWithAPIEndpoints: analyses.filter(a => a.apiEndpoints && a.apiEndpoints.length > 0).length,
    averageActionsPerPage: (analyses.reduce((sum, a) => sum + (a.actions?.length || 0), 0) / analyses.length).toFixed(1)
  };
}

function generateMarkdownReport(patterns, analyses) {
  let report = `# Procore UI Patterns - Consolidated Report
Generated: ${new Date().toLocaleString()}

## Executive Summary

This report analyzes ${patterns.pageStats.totalPages} Procore pages to identify common UI patterns, components, and architectural decisions.

### Key Statistics
- **Total Pages Analyzed**: ${patterns.pageStats.totalPages}
- **Pages with Forms**: ${patterns.pageStats.pagesWithForms} (${(patterns.pageStats.pagesWithForms / patterns.pageStats.totalPages * 100).toFixed(1)}%)
- **Pages with Tables**: ${patterns.pageStats.pagesWithTables} (${(patterns.pageStats.pagesWithTables / patterns.pageStats.totalPages * 100).toFixed(1)}%)
- **Pages with Navigation**: ${patterns.pageStats.pagesWithNavigation} (${(patterns.pageStats.pagesWithNavigation / patterns.pageStats.totalPages * 100).toFixed(1)}%)
- **Average Actions per Page**: ${patterns.pageStats.averageActionsPerPage}

## 🎨 CSS Frameworks Detected
`;

  patterns.cssFrameworks.forEach(fw => {
    report += `- **${fw.framework}**: Used in ${fw.count} pages (${fw.percentage}%)\n`;
  });

  report += `
## 🔘 Common UI Actions

These are the most frequently used action buttons across all pages:

| Action | Occurrences | Present in % of Pages |
|--------|-------------|----------------------|
`;

  patterns.commonActions.slice(0, 15).forEach(action => {
    report += `| ${action.action} | ${action.count} | ${action.percentage}% |\n`;
  });

  report += `
## 🧭 Navigation Patterns

### Most Common Navigation Items
`;

  patterns.navigationPatterns.commonNavItems.slice(0, 10).forEach(nav => {
    report += `- **${nav.item}**: Found in ${nav.count} pages\n`;
  });

  report += `
## 📊 Table Patterns

### Common Table Headers
The following headers appear most frequently across tables:

| Header | Occurrences |
|--------|------------|
`;

  patterns.tablePatterns.commonHeaders.slice(0, 15).forEach(header => {
    report += `| ${header.header} | ${header.count} |\n`;
  });

  report += `
**Average Columns per Table**: ${patterns.tablePatterns.averageColumns}

## 📝 Form Patterns

### Common Input Types
| Type | Count |
|------|-------|
`;

  patterns.formPatterns.commonFieldTypes.forEach(field => {
    report += `| ${field.type} | ${field.count} |\n`;
  });

  report += `
### Most Common Field Names
`;

  patterns.formPatterns.commonFieldNames.slice(0, 10).forEach(field => {
    report += `- **${field.name}**: Used ${field.count} times\n`;
  });

  report += `
## 🔧 Component Usage Statistics

| Component Type | Pages Using | Percentage |
|----------------|-------------|------------|
`;

  patterns.componentTypes.forEach(comp => {
    report += `| ${comp.type} | ${comp.count} | ${comp.percentage}% |\n`;
  });

  report += `
## 📡 API Patterns

### Endpoint Categories
- **RESTful APIs**: ${patterns.apiEndpoints.patterns.restful.length} unique endpoints
- **GraphQL**: ${patterns.apiEndpoints.patterns.graphql.length} endpoints
- **Other**: ${patterns.apiEndpoints.patterns.other.length} endpoints

### Sample RESTful Endpoints
`;

  patterns.apiEndpoints.patterns.restful.slice(0, 10).forEach(endpoint => {
    report += `- \`${endpoint}\`\n`;
  });

  report += `
## 💾 Data Models Identified

Based on AI analysis, the following data models were consistently identified:

### Core Entities
`;

  patterns.dataModels.identifiedModels.forEach(model => {
    report += `- **${model}**\n`;
  });

  report += `
### Relationships
`;

  patterns.dataModels.relationships.forEach(rel => {
    report += `- ${rel}\n`;
  });

  report += `
## 🏗️ Recommended Component Library

Based on the patterns identified, here's a recommended component structure for rebuilding:

### Core Components
1. **Table Component**
   - Sortable headers
   - Action buttons in rows
   - Pagination
   - Bulk actions

2. **Form Components**
   - Text inputs with validation
   - Select dropdowns
   - Date pickers
   - File upload
   - Form groups with labels

3. **Navigation Components**
   - Top navigation bar
   - Breadcrumbs
   - Tab navigation
   - Sidebar menu

4. **Action Components**
   - Primary/Secondary buttons
   - Dropdown menus
   - Icon buttons
   - Bulk action toolbar

5. **Layout Components**
   - Page header with actions
   - Content containers
   - Grid layouts
   - Modal dialogs

## 🚀 Implementation Recommendations

1. **UI Framework**: Based on Tailwind CSS detection, continue using Tailwind for consistency
2. **Component Library**: Build on top of shadcn/ui or similar for rapid development
3. **State Management**: Use Zustand or Redux Toolkit for complex state
4. **Data Fetching**: Implement React Query for API calls and caching
5. **Forms**: Use React Hook Form with Zod validation
6. **Tables**: Consider TanStack Table for complex data grids

## 📋 Next Steps

1. Create a shared component library with the identified patterns
2. Establish a consistent API client with the endpoint patterns
3. Build reusable form and table components first (highest usage)
4. Implement navigation components for consistent UX
5. Create page templates based on common layouts
`;

  return report;
}

// Run the report generation
generateConsolidatedReport();