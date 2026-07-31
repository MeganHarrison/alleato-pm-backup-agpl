import fs from 'fs';
import path from 'path';

const CRAWL_DIR = './procore-budget-crawl';
const PAGES_DIR = path.join(CRAWL_DIR, 'pages');
const OUTPUT_FILE = path.join(CRAWL_DIR, 'IMPLEMENTATION-TASKS.md');

// Read all page metadata
function loadAllMetadata() {
  const pages = [];
  const pagesDirs = fs.readdirSync(PAGES_DIR);

  for (const dir of pagesDirs) {
    const metadataPath = path.join(PAGES_DIR, dir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        pages.push(metadata);
      } catch (err) {
        console.warn(`Could not read metadata for ${dir}`);
      }
    }
  }

  return pages;
}

// Extract unique features from all pages
function extractFeatures(pages) {
  const features = {
    tables: new Set(),
    buttons: new Set(),
    forms: new Set(),
    dropdowns: new Set(),
    tabs: new Set(),
    views: new Set(),
    workflows: new Set(),
    integrations: new Set(),
    permissions: new Set(),
    dataModels: new Set()
  };

  pages.forEach(page => {
    // Extract table features
    if (page.analysis?.tables) {
      page.analysis.tables.forEach(table => {
        if (table.headers && table.headers.length > 0) {
          table.headers.forEach(header => {
            if (header && header.trim()) {
              features.tables.add(header);
            }
          });
        }
      });
    }

    // Extract button features
    if (page.clickableDetails) {
      page.clickableDetails.forEach(btn => {
        const text = btn.text?.trim();
        if (text && text.length > 0 && text.length < 50) {
          features.buttons.add(text);
        }
      });
    }

    // Extract dropdown features
    if (page.dropdownDetails) {
      page.dropdownDetails.forEach(dd => {
        const text = dd.text?.trim();
        if (text && text.length > 0 && text.length < 50) {
          features.dropdowns.add(text);
        }
      });
    }

    // Extract page-level features
    const pageName = page.pageName || '';
    if (pageName.includes('template')) features.views.add('Templates');
    if (pageName.includes('integration')) features.integrations.add(pageName);
    if (pageName.includes('permission') || pageName.includes('access')) features.permissions.add(pageName);
    if (pageName.includes('forecast')) features.workflows.add('Forecasting');
    if (pageName.includes('migration')) features.workflows.add('Budget Migration');
    if (pageName.includes('change')) features.workflows.add('Change Management');
  });

  return features;
}

// Generate database schema tasks
function generateSchemaTask(features) {
  const tableColumns = Array.from(features.tables);

  return {
    category: 'Database Schema',
    priority: 'P0 - Critical',
    tasks: [
      {
        title: 'Design Core Budget Schema',
        description: 'Create database tables for budget management',
        subtasks: [
          'Create `budgets` table with columns: id, project_id, name, status, created_at, updated_at',
          'Create `budget_lines` table for individual budget line items',
          'Create `budget_views` table for custom view configurations',
          'Create `budget_templates` table for reusable budget templates',
          'Create `budget_snapshots` table for point-in-time captures',
          'Create `budget_changes` table for change tracking',
          'Add columns discovered: ' + tableColumns.slice(0, 10).join(', ') + '...',
        ],
        acceptance: 'All tables created with proper indexes and foreign keys'
      },
      {
        title: 'Create Budget Column Configuration System',
        description: 'Allow users to configure which columns appear in budget views',
        subtasks: [
          'Create `budget_view_columns` junction table',
          'Support column ordering and visibility settings',
          'Store column width preferences',
          'Support calculated columns',
          `Support these column types: ${Array.from(features.tables).join(', ')}`
        ],
        acceptance: 'Users can customize budget view columns'
      },
      {
        title: 'Add Cost Code Integration',
        description: 'Link budgets to cost codes and cost types',
        subtasks: [
          'Create `cost_codes` table if not exists',
          'Create `cost_types` table if not exists',
          'Add foreign keys to budget_lines',
          'Support hierarchical cost code structure',
          'Add WBS (Work Breakdown Structure) support'
        ],
        acceptance: 'Budget lines can be organized by cost codes'
      }
    ]
  };
}

// Generate UI component tasks
function generateUITask(features) {
  const buttons = Array.from(features.buttons).filter(b => b.length > 0);

  return {
    category: 'UI Components',
    priority: 'P0 - Critical',
    tasks: [
      {
        title: 'Build Budget Table Component',
        description: 'Create a data table for displaying budget line items',
        subtasks: [
          'Implement sortable columns',
          'Add filtering capability',
          'Support inline editing',
          'Add row selection',
          'Implement virtual scrolling for large datasets',
          'Add column resizing',
          'Support frozen columns',
          'Add totals/summary row',
          'Implement grouping by cost code',
        ],
        acceptance: 'Budget table displays with all interactive features'
      },
      {
        title: 'Create Budget Actions Toolbar',
        description: 'Implement action buttons for budget operations',
        subtasks: buttons.slice(0, 15).map(btn => `Add "${btn}" button functionality`),
        acceptance: 'All discovered buttons are implemented'
      },
      {
        title: 'Build Budget View Selector',
        description: 'Dropdown to switch between budget views',
        subtasks: [
          'Create view selector dropdown',
          'Load available views from database',
          'Support "Current" and "Original" snapshots',
          'Add view creation modal',
          'Implement view editing',
          'Support view deletion with confirmation'
        ],
        acceptance: 'Users can switch between different budget views'
      },
      {
        title: 'Implement Filter and Group Controls',
        description: 'Allow users to filter and group budget data',
        subtasks: [
          'Add "Add Filter" dropdown',
          'Add "Add Group" dropdown',
          'Support multiple filter criteria',
          'Support nested grouping',
          'Save filter preferences per user',
          'Add "Clear Filters" button'
        ],
        acceptance: 'Budget data can be filtered and grouped'
      }
    ]
  };
}

// Generate CRUD operations tasks
function generateCRUDTask() {
  return {
    category: 'CRUD Operations',
    priority: 'P0 - Critical',
    tasks: [
      {
        title: 'Create Budget Line Items',
        description: 'Allow users to add new budget line items',
        subtasks: [
          'Build "Create" button with dropdown menu',
          'Create budget line form with all fields',
          'Support bulk import from Excel/CSV',
          'Validate required fields',
          'Auto-calculate totals',
          'Add to database and refresh table'
        ],
        acceptance: 'Users can create budget lines manually or via import'
      },
      {
        title: 'Update Budget Line Items',
        description: 'Allow inline editing of budget values',
        subtasks: [
          'Enable cell editing on click',
          'Validate numeric fields',
          'Auto-save changes',
          'Show saving indicator',
          'Track change history',
          'Support undo/redo'
        ],
        acceptance: 'Budget lines can be edited inline with validation'
      },
      {
        title: 'Delete Budget Line Items',
        description: 'Allow removal of budget lines',
        subtasks: [
          'Add delete action to row menu',
          'Show confirmation dialog',
          'Soft delete vs hard delete',
          'Update totals after deletion',
          'Log deletion in audit trail'
        ],
        acceptance: 'Budget lines can be safely deleted'
      },
      {
        title: 'Read/List Budget Data',
        description: 'Fetch and display budget information',
        subtasks: [
          'Create API endpoint for budget list',
          'Support pagination for large budgets',
          'Implement search functionality',
          'Add sorting by any column',
          'Cache frequently accessed data',
          'Optimize query performance'
        ],
        acceptance: 'Budget data loads quickly with filtering/sorting'
      }
    ]
  };
}

// Generate import/export tasks
function generateImportExportTask() {
  return {
    category: 'Import/Export',
    priority: 'P1 - High',
    tasks: [
      {
        title: 'Implement Budget Import',
        description: 'Allow users to import budgets from files',
        subtasks: [
          'Add "Import" dropdown button',
          'Support Excel (.xlsx) import',
          'Support CSV import',
          'Validate imported data',
          'Show preview before import',
          'Handle errors gracefully',
          'Map columns to budget fields',
          'Support cost code matching',
          'Show import progress',
          'Create import history log'
        ],
        acceptance: 'Users can import budgets from Excel/CSV files'
      },
      {
        title: 'Implement Budget Export',
        description: 'Allow users to export budgets to files',
        subtasks: [
          'Add "Export" dropdown button',
          'Export to Excel (.xlsx)',
          'Export to CSV',
          'Export to PDF',
          'Include all visible columns',
          'Respect current filters/grouping',
          'Add export date/user metadata',
          'Support custom templates',
          'Optimize for large datasets'
        ],
        acceptance: 'Users can export budgets in multiple formats'
      },
      {
        title: 'Build Budget Templates',
        description: 'Create reusable budget templates',
        subtasks: [
          'Design template creation UI',
          'Save column configuration',
          'Save default cost codes',
          'Share templates across projects',
          'Import from template',
          'Version templates',
          'Template marketplace/library'
        ],
        acceptance: 'Users can create and reuse budget templates'
      }
    ]
  };
}

// Generate budget views configuration tasks
function generateViewsTask() {
  return {
    category: 'Budget Views Configuration',
    priority: 'P1 - High',
    tasks: [
      {
        title: 'Build Budget View Configuration Page',
        description: 'Allow admins to configure budget views',
        subtasks: [
          'Create view list table',
          'Show view name, description, projects, created by, date',
          'Add "Create New View" button',
          'Implement view editing modal',
          'Support view deletion',
          'Allow column selection',
          'Configure column descriptions',
          'Set default view per project',
          'Share views across company'
        ],
        acceptance: 'Admins can configure multiple budget views'
      },
      {
        title: 'Implement Column Configuration',
        description: 'Allow customization of available columns',
        subtasks: [
          'Display available columns table',
          'Show column name and description',
          'Enable/disable columns',
          'Reorder columns via drag-drop',
          'Set column widths',
          'Configure column formatting (currency, percent, etc)',
          'Add calculated column support',
          'Save configuration to database'
        ],
        acceptance: 'Column configuration is fully customizable'
      },
      {
        title: 'Add Financial Views',
        description: 'Support different financial perspectives',
        subtasks: [
          'Create "Financial Views" dropdown',
          'Support Budget vs Actual view',
          'Support Forecast view',
          'Support Variance Analysis view',
          'Support Cash Flow view',
          'Support Cost to Complete view',
          'Allow custom financial views'
        ],
        acceptance: 'Multiple financial views are available'
      }
    ]
  };
}

// Generate calculations and formulas tasks
function generateCalculationsTask(features) {
  const calculationColumns = Array.from(features.tables).filter(col =>
    col.includes('Budget') || col.includes('Cost') || col.includes('Total') ||
    col.includes('Variance') || col.includes('Projected') || col.includes('Committed')
  );

  return {
    category: 'Calculations & Formulas',
    priority: 'P1 - High',
    tasks: [
      {
        title: 'Implement Budget Calculations',
        description: 'Auto-calculate budget values',
        subtasks: [
          'Calculate: Revised Budget = Original Budget + Budget Modifications',
          'Calculate: Projected Budget = Revised Budget + Pending Budget Changes',
          'Calculate: Projected Costs = Direct Costs + Committed Costs + Pending Cost Changes',
          'Calculate: Variance = Revised Budget - Projected Costs',
          'Calculate: Cost to Complete = Projected Costs - Job to Date Cost',
          'Calculate: Percent Complete = (Job to Date Cost / Projected Costs) * 100',
          'Support Unit Qty × Unit Cost calculations',
          'Auto-update grand totals',
          'Recalculate on any field change'
        ],
        acceptance: 'All budget calculations work correctly'
      },
      {
        title: 'Add Variance Analysis',
        description: 'Implement budget variance tracking',
        subtasks: [
          'Add "Analyze Variance" feature',
          'Calculate favorable/unfavorable variances',
          'Color-code variances (red for over, green for under)',
          'Show variance as amount and percentage',
          'Support variance thresholds/alerts',
          'Generate variance reports',
          'Track variance over time'
        ],
        acceptance: 'Variance analysis provides insights'
      },
      {
        title: 'Support Multiple Calculation Methods',
        description: 'Different ways to calculate budget values',
        subtasks: [
          'Support "Unit Price" method (Qty × Unit Cost)',
          'Support "Lump Sum" method',
          'Support "Percentage of Total" method',
          'Support "Formula" method with custom expressions',
          'Allow method selection per line item',
          'Validate calculations based on method'
        ],
        acceptance: 'Multiple calculation methods are supported'
      }
    ]
  };
}

// Generate change management tasks
function generateChangeManagementTask() {
  return {
    category: 'Change Management',
    priority: 'P2 - Medium',
    tasks: [
      {
        title: 'Track Budget Changes',
        description: 'Log all modifications to budget',
        subtasks: [
          'Create change history table',
          'Log user, timestamp, old value, new value',
          'Show "Change History" tab',
          'Support change approval workflow',
          'Create "Pending Budget Changes" column',
          'Implement change request form',
          'Add change rejection/approval',
          'Notify stakeholders of changes'
        ],
        acceptance: 'All budget changes are tracked and auditable'
      },
      {
        title: 'Budget Change Migration',
        description: 'Migrate budget changes between versions',
        subtasks: [
          'Build migration tool UI',
          'Support bulk change migration',
          'Validate data before migration',
          'Preview migration impact',
          'Rollback support',
          'Migration history log'
        ],
        acceptance: 'Budget changes can be migrated safely'
      },
      {
        title: 'Implement Budget Locking',
        description: 'Prevent changes to locked budgets',
        subtasks: [
          'Add "Lock Budget" button',
          'Create budget lock status field',
          'Disable editing when locked',
          'Require unlock permission',
          'Log lock/unlock events',
          'Show lock indicator in UI',
          'Support partial locking (lock specific lines)'
        ],
        acceptance: 'Budgets can be locked to prevent changes'
      }
    ]
  };
}

// Generate snapshot/versioning tasks
function generateSnapshotTask() {
  return {
    category: 'Snapshots & Versioning',
    priority: 'P2 - Medium',
    tasks: [
      {
        title: 'Implement Budget Snapshots',
        description: 'Capture point-in-time budget states',
        subtasks: [
          'Create snapshot on budget save',
          'Add "Snapshot" selector dropdown',
          'Support "Current" vs historical snapshots',
          'Show snapshot date/time',
          'Allow snapshot comparison',
          'Support snapshot restore',
          'Auto-create snapshots on major changes',
          'Retain snapshots for audit'
        ],
        acceptance: 'Budget snapshots preserve history'
      },
      {
        title: 'Project Status Snapshots',
        description: 'Link budgets to project milestones',
        subtasks: [
          'Create snapshots at project milestones',
          'Tag snapshots with project status',
          'Compare budget across project phases',
          'Generate status reports'
        ],
        acceptance: 'Budget snapshots tied to project status'
      }
    ]
  };
}

// Generate forecasting tasks
function generateForecastingTask() {
  return {
    category: 'Forecasting',
    priority: 'P2 - Medium',
    tasks: [
      {
        title: 'Build Forecasting Module',
        description: 'Predict future budget performance',
        subtasks: [
          'Add "Forecasting" tab',
          'Create forecast templates',
          'Support manual forecast entry',
          'Auto-calculate forecast based on trends',
          'Show forecast vs actual comparison',
          'Adjust forecast based on committed costs',
          'Generate forecast reports',
          'Alert on forecast overruns'
        ],
        acceptance: 'Budget forecasting provides predictions'
      },
      {
        title: 'Forecast Templates',
        description: 'Reusable forecasting configurations',
        subtasks: [
          'Create forecast template page',
          'Define forecast calculation rules',
          'Share templates across projects',
          'Version forecast templates'
        ],
        acceptance: 'Forecast templates can be reused'
      }
    ]
  };
}

// Generate integration tasks
function generateIntegrationTask() {
  return {
    category: 'Integrations',
    priority: 'P3 - Low',
    tasks: [
      {
        title: 'ERP Integration',
        description: 'Sync budgets with ERP systems',
        subtasks: [
          'Build ERP integration page',
          'Support common ERP systems (QuickBooks, Sage, etc)',
          'Map budget fields to ERP fields',
          'Two-way sync support',
          'Handle sync conflicts',
          'Log sync history',
          'Schedule automatic syncs'
        ],
        acceptance: 'Budgets sync with ERP systems'
      },
      {
        title: 'Cost Code Integration',
        description: 'Link to company cost code master list',
        subtasks: [
          'Import cost codes from master list',
          'Auto-populate cost code dropdowns',
          'Validate cost codes on entry',
          'Support cost code hierarchy',
          'Sync changes from master list'
        ],
        acceptance: 'Budget uses company cost codes'
      }
    ]
  };
}

// Generate permissions tasks
function generatePermissionsTask() {
  return {
    category: 'Permissions & Security',
    priority: 'P1 - High',
    tasks: [
      {
        title: 'Implement Budget Permissions',
        description: 'Role-based access control for budgets',
        subtasks: [
          'Define permission levels (View, Edit, Admin)',
          'Check permissions before any operation',
          'Support project-level permissions',
          'Support company-level permissions',
          'Hide/disable UI based on permissions',
          'Log permission violations',
          'Support custom permission groups'
        ],
        acceptance: 'Budget access is properly controlled'
      },
      {
        title: 'Field-Level Security',
        description: 'Control access to specific budget fields',
        subtasks: [
          'Mark sensitive fields (e.g., Unit Cost)',
          'Hide fields based on user role',
          'Support read-only fields',
          'Audit access to sensitive data'
        ],
        acceptance: 'Sensitive budget data is protected'
      }
    ]
  };
}

// Generate testing tasks
function generateTestingTask() {
  return {
    category: 'Testing & Quality',
    priority: 'P0 - Critical',
    tasks: [
      {
        title: 'Unit Tests',
        description: 'Test individual functions',
        subtasks: [
          'Test all calculation functions',
          'Test data validation',
          'Test permission checks',
          'Test import/export logic',
          'Achieve 80%+ code coverage'
        ],
        acceptance: 'All unit tests pass'
      },
      {
        title: 'Integration Tests',
        description: 'Test component interactions',
        subtasks: [
          'Test CRUD operations end-to-end',
          'Test import workflow',
          'Test export workflow',
          'Test view switching',
          'Test snapshot creation/restore'
        ],
        acceptance: 'All integration tests pass'
      },
      {
        title: 'E2E Tests with Playwright',
        description: 'Test complete user workflows',
        subtasks: [
          'Test budget creation workflow',
          'Test budget editing workflow',
          'Test import/export workflows',
          'Test view configuration',
          'Test change approval workflow',
          'Test budget locking',
          'Visual regression testing'
        ],
        acceptance: 'All E2E tests pass consistently'
      }
    ]
  };
}

// Generate API tasks
function generateAPITask() {
  return {
    category: 'API Development',
    priority: 'P0 - Critical',
    tasks: [
      {
        title: 'Budget REST API',
        description: 'Create RESTful endpoints for budgets',
        subtasks: [
          'GET /api/budgets - List budgets',
          'GET /api/budgets/:id - Get budget details',
          'POST /api/budgets - Create budget',
          'PUT /api/budgets/:id - Update budget',
          'DELETE /api/budgets/:id - Delete budget',
          'GET /api/budgets/:id/lines - Get budget lines',
          'POST /api/budgets/:id/lines - Create budget line',
          'PUT /api/budgets/:id/lines/:lineId - Update line',
          'DELETE /api/budgets/:id/lines/:lineId - Delete line',
          'POST /api/budgets/:id/import - Import data',
          'GET /api/budgets/:id/export - Export data',
          'GET /api/budgets/:id/snapshots - List snapshots',
          'POST /api/budgets/:id/lock - Lock budget',
          'POST /api/budgets/:id/unlock - Unlock budget'
        ],
        acceptance: 'All API endpoints work with proper validation'
      },
      {
        title: 'Budget Views API',
        description: 'Endpoints for view configuration',
        subtasks: [
          'GET /api/budget-views - List available views',
          'POST /api/budget-views - Create view',
          'PUT /api/budget-views/:id - Update view',
          'DELETE /api/budget-views/:id - Delete view',
          'GET /api/budget-views/:id/columns - Get column config'
        ],
        acceptance: 'View configuration API complete'
      }
    ]
  };
}

// Generate main task document
function generateTaskDocument(pages) {
  const features = extractFeatures(pages);

  const sections = [
    generateSchemaTask(features),
    generateAPITask(),
    generateUITask(features),
    generateCRUDTask(),
    generateCalculationsTask(features),
    generateImportExportTask(),
    generateViewsTask(),
    generateChangeManagementTask(),
    generateSnapshotTask(),
    generateForecastingTask(),
    generatePermissionsTask(),
    generateIntegrationTask(),
    generateTestingTask()
  ];

  let markdown = `# Budget Module Implementation Task List

**Generated from Procore Budget Crawl Data**
**Date:** ${new Date().toISOString().split('T')[0]}
**Source:** ${pages.length} pages analyzed

---

## Executive Summary

This document contains a comprehensive task list for implementing Procore-like budget functionality based on actual screen captures and DOM analysis.

### Total Task Categories: ${sections.length}
### Estimated Total Tasks: ${sections.reduce((sum, section) => sum + section.tasks.length, 0)}

---

## Priority Legend

- **P0 - Critical**: Must-have for MVP, core functionality
- **P1 - High**: Important features, needed for full functionality
- **P2 - Medium**: Nice-to-have, enhances user experience
- **P3 - Low**: Future enhancements, can be deferred

---

`;

  sections.forEach((section, index) => {
    markdown += `## ${index + 1}. ${section.category}\n\n`;
    markdown += `**Priority:** ${section.priority}\n\n`;

    section.tasks.forEach((task, taskIndex) => {
      markdown += `### ${index + 1}.${taskIndex + 1} ${task.title}\n\n`;
      markdown += `**Description:** ${task.description}\n\n`;
      markdown += `**Subtasks:**\n\n`;

      task.subtasks.forEach((subtask, subIndex) => {
        markdown += `- [ ] ${subtask}\n`;
      });

      markdown += `\n**Acceptance Criteria:** ${task.acceptance}\n\n`;
      markdown += `---\n\n`;
    });
  });

  // Add discovered features appendix
  markdown += `## Appendix A: Discovered Features\n\n`;
  markdown += `### Table Columns Found (${features.tables.size})\n\n`;
  Array.from(features.tables).slice(0, 50).forEach(col => {
    markdown += `- ${col}\n`;
  });

  markdown += `\n### Buttons Found (${features.buttons.size})\n\n`;
  Array.from(features.buttons).slice(0, 50).forEach(btn => {
    markdown += `- ${btn}\n`;
  });

  markdown += `\n### Dropdowns Found (${features.dropdowns.size})\n\n`;
  Array.from(features.dropdowns).slice(0, 50).forEach(dd => {
    markdown += `- ${dd}\n`;
  });

  // Add implementation roadmap
  markdown += `\n## Appendix B: Suggested Implementation Roadmap\n\n`;
  markdown += `### Phase 1: Foundation (Weeks 1-2)
- Database Schema
- API Development
- Basic CRUD Operations
- Authentication/Permissions

### Phase 2: Core Features (Weeks 3-4)
- Budget Table UI
- View Configuration
- Calculations & Formulas
- Import/Export

### Phase 3: Advanced Features (Weeks 5-6)
- Change Management
- Snapshots & Versioning
- Forecasting
- Variance Analysis

### Phase 4: Polish & Testing (Week 7-8)
- E2E Testing
- Performance Optimization
- UI/UX Refinements
- Documentation

### Phase 5: Integrations (Week 9+)
- ERP Integration
- Cost Code Sync
- Third-party Tools
`;

  return markdown;
}

// Main execution
console.log('📊 Analyzing crawled data...');
const pages = loadAllMetadata();
console.log(`✅ Loaded ${pages.length} pages`);

console.log('🔍 Extracting features and generating tasks...');
const taskDocument = generateTaskDocument(pages);

console.log('💾 Writing task document...');
fs.writeFileSync(OUTPUT_FILE, taskDocument);

console.log(`✅ Task list generated: ${OUTPUT_FILE}`);
console.log(`📋 Total pages analyzed: ${pages.length}`);

// Generate summary stats
const lines = taskDocument.split('\n');
const checkboxes = lines.filter(l => l.includes('- [ ]')).length;
console.log(`📝 Total subtasks identified: ${checkboxes}`);
