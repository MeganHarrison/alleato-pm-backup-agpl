import fs from 'fs';
import path from 'path';

const CRAWL_DIR = './procore-prime-contracts-crawl';
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
    formFields: new Set()
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

    // Extract form fields
    if (page.analysis?.formFields) {
      page.analysis.formFields.forEach(field => {
        if (field.label) features.formFields.add(field.label);
        if (field.placeholder) features.formFields.add(field.placeholder);
      });
    }

    // Extract page-level features
    const pageName = page.pageName || '';
    if (pageName.includes('template')) features.views.add('Templates');
    if (pageName.includes('integration')) features.integrations.add(pageName);
    if (pageName.includes('permission') || pageName.includes('access')) features.permissions.add(pageName);
    if (pageName.includes('change_order')) features.workflows.add('Change Orders');
    if (pageName.includes('billing')) features.workflows.add('Billing');
    if (pageName.includes('payment')) features.workflows.add('Payments');
  });

  return features;
}

// Generate database schema tasks
function generateSchemaTask(features) {
  return {
    category: 'Database Schema',
    priority: 'P0 - Critical',
    tasks: [
      {
        title: 'Design Core Prime Contracts Schema',
        description: 'Create database tables for prime contract management',
        subtasks: [
          'Create `prime_contracts` table with columns: id, project_id, contract_number, title, status, vendor_id, created_at, updated_at',
          'Create `contract_line_items` table for individual contract items',
          'Create `contract_billing_periods` table for billing schedules',
          'Create `contract_change_orders` table for change order tracking',
          'Create `contract_payments` table for payment tracking',
          'Create `contract_snapshots` table for point-in-time captures',
          'Create `contract_documents` table for document management',
          'Add foreign keys and relationships'
        ],
        acceptance: 'All tables created with proper indexes and foreign keys'
      },
      {
        title: 'Create Contract Column Configuration System',
        description: 'Allow users to configure which columns appear in contract views',
        subtasks: [
          'Create `contract_view_columns` junction table',
          'Support column ordering and visibility settings',
          'Store column width preferences',
          'Support calculated columns',
          'Add support for custom fields'
        ],
        acceptance: 'Users can customize contract view columns'
      },
      {
        title: 'Add Vendor Integration',
        description: 'Link contracts to vendors and subcontractors',
        subtasks: [
          'Create `vendors` table if not exists',
          'Use `companies` for subcontractor companies',
          'Add company foreign keys to prime_contracts',
          'Support vendor contact information',
          'Track vendor insurance and certifications'
        ],
        acceptance: 'Contracts can be linked to vendors'
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
        title: 'Build Prime Contracts Table Component',
        description: 'Create a data table for displaying prime contracts',
        subtasks: [
          'Implement sortable columns',
          'Add filtering capability',
          'Support inline editing',
          'Add row selection',
          'Implement pagination for large datasets',
          'Add column resizing',
          'Support frozen columns',
          'Add totals/summary row',
          'Implement grouping by vendor/status'
        ],
        acceptance: 'Contract table displays with all interactive features'
      },
      {
        title: 'Create Contract Actions Toolbar',
        description: 'Implement action buttons for contract operations',
        subtasks: buttons.slice(0, 15).map(btn => `Add "${btn}" button functionality`),
        acceptance: 'All discovered buttons are implemented'
      },
      {
        title: 'Build Contract Detail View',
        description: 'Detailed view for individual contracts',
        subtasks: [
          'Create contract header with key details',
          'Add tabbed interface (Details, Line Items, Change Orders, Billing, Documents)',
          'Implement contract status workflow',
          'Add edit mode for contract fields',
          'Support contract attachments',
          'Show contract history timeline'
        ],
        acceptance: 'Users can view and edit full contract details'
      },
      {
        title: 'Implement Filter and Search Controls',
        description: 'Allow users to filter and search contracts',
        subtasks: [
          'Add "Add Filter" dropdown',
          'Support filtering by status, vendor, date range',
          'Implement quick search by contract number/title',
          'Support advanced search with multiple criteria',
          'Save filter preferences per user',
          'Add "Clear Filters" button'
        ],
        acceptance: 'Contract data can be filtered and searched'
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
        title: 'Create Prime Contracts',
        description: 'Allow users to create new prime contracts',
        subtasks: [
          'Build "Create Contract" form with all required fields',
          'Support contract template selection',
          'Validate required fields',
          'Auto-generate contract numbers',
          'Support document upload',
          'Add to database and refresh table'
        ],
        acceptance: 'Users can create contracts manually or from templates'
      },
      {
        title: 'Update Prime Contracts',
        description: 'Allow editing of contract information',
        subtasks: [
          'Enable field editing in detail view',
          'Validate contract data',
          'Auto-save changes',
          'Show saving indicator',
          'Track change history',
          'Support version control'
        ],
        acceptance: 'Contracts can be edited with validation'
      },
      {
        title: 'Delete Prime Contracts',
        description: 'Allow removal of contracts',
        subtasks: [
          'Add delete action with confirmation',
          'Show confirmation dialog',
          'Soft delete vs hard delete',
          'Handle related records (line items, change orders)',
          'Log deletion in audit trail'
        ],
        acceptance: 'Contracts can be safely deleted'
      },
      {
        title: 'Read/List Contract Data',
        description: 'Fetch and display contract information',
        subtasks: [
          'Create API endpoint for contract list',
          'Support pagination for large datasets',
          'Implement search functionality',
          'Add sorting by any column',
          'Cache frequently accessed data',
          'Optimize query performance'
        ],
        acceptance: 'Contract data loads quickly with filtering/sorting'
      }
    ]
  };
}

// Generate change order tasks
function generateChangeOrderTask() {
  return {
    category: 'Change Orders',
    priority: 'P1 - High',
    tasks: [
      {
        title: 'Implement Change Order Management',
        description: 'Track and manage contract change orders',
        subtasks: [
          'Create change order form',
          'Support change order approval workflow',
          'Calculate impact on contract value',
          'Track change order status',
          'Link change orders to budget impacts',
          'Generate change order documents',
          'Notify stakeholders of changes'
        ],
        acceptance: 'Change orders can be created and tracked'
      },
      {
        title: 'Change Order Approval Workflow',
        description: 'Multi-step approval process for change orders',
        subtasks: [
          'Define approval roles and permissions',
          'Implement approval routing',
          'Support approval comments',
          'Track approval history',
          'Send notifications at each stage',
          'Support bulk approvals'
        ],
        acceptance: 'Change orders follow defined approval process'
      }
    ]
  };
}

// Generate billing tasks
function generateBillingTask() {
  return {
    category: 'Billing & Payments',
    priority: 'P1 - High',
    tasks: [
      {
        title: 'Implement Billing Periods',
        description: 'Track billing schedules and periods',
        subtasks: [
          'Create billing period configuration',
          'Support multiple billing schedules',
          'Track billed vs unbilled amounts',
          'Generate billing summaries',
          'Link to payment applications',
          'Calculate retention amounts'
        ],
        acceptance: 'Billing periods are properly tracked'
      },
      {
        title: 'Payment Application Management',
        description: 'Manage payment applications and invoices',
        subtasks: [
          'Create payment application form',
          'Calculate amounts due',
          'Track payment status',
          'Support payment approvals',
          'Generate payment reports',
          'Link to accounting system'
        ],
        acceptance: 'Payment applications can be created and tracked'
      },
      {
        title: 'Retention Tracking',
        description: 'Track retention amounts and releases',
        subtasks: [
          'Configure retention percentages',
          'Calculate retention withheld',
          'Track retention releases',
          'Generate retention reports',
          'Support partial retention release'
        ],
        acceptance: 'Retention is properly calculated and tracked'
      }
    ]
  };
}

// Generate document management tasks
function generateDocumentTask() {
  return {
    category: 'Document Management',
    priority: 'P2 - Medium',
    tasks: [
      {
        title: 'Contract Document Storage',
        description: 'Store and manage contract-related documents',
        subtasks: [
          'Integrate with Supabase Storage',
          'Support document upload',
          'Categorize documents by type',
          'Version control for documents',
          'Document access permissions',
          'Full-text search in documents'
        ],
        acceptance: 'Contract documents are securely stored and accessible'
      },
      {
        title: 'Document Generation',
        description: 'Auto-generate contract documents',
        subtasks: [
          'Create contract PDF templates',
          'Generate change order PDFs',
          'Generate payment application PDFs',
          'Support custom templates',
          'Include digital signatures'
        ],
        acceptance: 'Contract documents can be auto-generated'
      }
    ]
  };
}

// Generate integration tasks
function generateIntegrationTask() {
  return {
    category: 'Integrations',
    priority: 'P2 - Medium',
    tasks: [
      {
        title: 'Budget Integration',
        description: 'Link prime contracts to budget',
        subtasks: [
          'Connect contracts to budget line items',
          'Track contract value vs budget',
          'Update budget on contract changes',
          'Show contract commitments in budget',
          'Sync change orders to budget modifications'
        ],
        acceptance: 'Contracts are linked to budget system'
      },
      {
        title: 'Accounting System Integration',
        description: 'Sync with accounting/ERP systems',
        subtasks: [
          'Export contract data to QuickBooks/Sage',
          'Sync payment applications',
          'Map contract accounts',
          'Handle sync conflicts',
          'Schedule automatic syncs'
        ],
        acceptance: 'Contracts sync with accounting system'
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
        title: 'Implement Contract Permissions',
        description: 'Role-based access control for contracts',
        subtasks: [
          'Define permission levels (View, Edit, Admin, Approve)',
          'Check permissions before any operation',
          'Support project-level permissions',
          'Support company-level permissions',
          'Hide/disable UI based on permissions',
          'Log permission violations'
        ],
        acceptance: 'Contract access is properly controlled'
      },
      {
        title: 'Field-Level Security',
        description: 'Control access to specific contract fields',
        subtasks: [
          'Mark sensitive fields (e.g., Contract Value)',
          'Hide fields based on user role',
          'Support read-only fields',
          'Audit access to sensitive data'
        ],
        acceptance: 'Sensitive contract data is protected'
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
          'Test contract calculations',
          'Test data validation',
          'Test permission checks',
          'Test workflow logic',
          'Achieve 80%+ code coverage'
        ],
        acceptance: 'All unit tests pass'
      },
      {
        title: 'Integration Tests',
        description: 'Test component interactions',
        subtasks: [
          'Test CRUD operations end-to-end',
          'Test change order workflow',
          'Test billing workflow',
          'Test document management',
          'Test budget integration'
        ],
        acceptance: 'All integration tests pass'
      },
      {
        title: 'E2E Tests with Playwright',
        description: 'Test complete user workflows',
        subtasks: [
          'Test contract creation workflow',
          'Test contract editing workflow',
          'Test change order workflow',
          'Test billing workflow',
          'Test approval workflows',
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
        title: 'Prime Contracts REST API',
        description: 'Create RESTful endpoints for prime contracts',
        subtasks: [
          'GET /api/prime-contracts - List contracts',
          'GET /api/prime-contracts/:id - Get contract details',
          'POST /api/prime-contracts - Create contract',
          'PUT /api/prime-contracts/:id - Update contract',
          'DELETE /api/prime-contracts/:id - Delete contract',
          'GET /api/prime-contracts/:id/line-items - Get line items',
          'POST /api/prime-contracts/:id/line-items - Create line item',
          'GET /api/prime-contracts/:id/change-orders - Get change orders',
          'POST /api/prime-contracts/:id/change-orders - Create change order',
          'GET /api/prime-contracts/:id/billing - Get billing info',
          'POST /api/prime-contracts/:id/billing - Create billing period',
          'GET /api/prime-contracts/:id/documents - List documents',
          'POST /api/prime-contracts/:id/documents - Upload document'
        ],
        acceptance: 'All API endpoints work with proper validation'
      },
      {
        title: 'Change Orders API',
        description: 'Endpoints for change order management',
        subtasks: [
          'GET /api/change-orders - List all change orders',
          'GET /api/change-orders/:id - Get change order details',
          'POST /api/change-orders/:id/approve - Approve change order',
          'POST /api/change-orders/:id/reject - Reject change order',
          'GET /api/change-orders/:id/history - Get approval history'
        ],
        acceptance: 'Change order API complete'
      }
    ]
  };
}

// Generate calculations tasks
function generateCalculationsTask() {
  return {
    category: 'Calculations & Formulas',
    priority: 'P1 - High',
    tasks: [
      {
        title: 'Implement Contract Calculations',
        description: 'Auto-calculate contract values',
        subtasks: [
          'Calculate: Original Contract Value',
          'Calculate: Approved Change Orders Total',
          'Calculate: Revised Contract Value = Original + Approved COs',
          'Calculate: Pending Change Orders Total',
          'Calculate: Billed to Date',
          'Calculate: Remaining Contract Value',
          'Calculate: Retention Withheld',
          'Calculate: Percent Complete',
          'Auto-update all totals on changes'
        ],
        acceptance: 'All contract calculations work correctly'
      },
      {
        title: 'Billing Calculations',
        description: 'Calculate billing amounts',
        subtasks: [
          'Calculate current period billing amount',
          'Calculate retention percentage',
          'Calculate materials stored',
          'Calculate previous billings',
          'Calculate total earned to date',
          'Calculate balance to finish'
        ],
        acceptance: 'Billing calculations are accurate'
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
    generateChangeOrderTask(),
    generateBillingTask(),
    generateCalculationsTask(),
    generateDocumentTask(),
    generateIntegrationTask(),
    generatePermissionsTask(),
    generateTestingTask()
  ];

  let markdown = `# Prime Contracts Module Implementation Task List

**Generated from Procore Prime Contracts Crawl Data**
**Date:** ${new Date().toISOString().split('T')[0]}
**Source:** ${pages.length} pages analyzed

---

## Executive Summary

This document contains a comprehensive task list for implementing Procore-like prime contracts functionality based on actual screen captures and DOM analysis.

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

  markdown += `\n### Form Fields Found (${features.formFields.size})\n\n`;
  Array.from(features.formFields).slice(0, 50).forEach(field => {
    markdown += `- ${field}\n`;
  });

  // Add implementation roadmap
  markdown += `\n## Appendix B: Suggested Implementation Roadmap\n\n`;
  markdown += `### Phase 1: Foundation (Weeks 1-2)
- Database Schema
- API Development
- Basic CRUD Operations
- Authentication/Permissions

### Phase 2: Core Features (Weeks 3-4)
- Contract Table UI
- Contract Detail View
- Line Items Management
- Basic Calculations

### Phase 3: Advanced Features (Weeks 5-6)
- Change Order Management
- Billing & Payments
- Document Management
- Budget Integration

### Phase 4: Polish & Testing (Week 7-8)
- E2E Testing
- Performance Optimization
- UI/UX Refinements
- Documentation

### Phase 5: Integrations (Week 9+)
- Accounting Integration
- Advanced Workflows
- Reporting & Analytics
`;

  return markdown;
}

// Main execution
console.log('📊 Analyzing crawled prime contracts data...');
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
