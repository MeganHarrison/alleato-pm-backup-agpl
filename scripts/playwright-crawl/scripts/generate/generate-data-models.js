#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generates data models and database schema from analyzed Procore features
 */
class DataModelGenerator {
  constructor() {
    this.inputDir = path.join(__dirname, '../outputs/analysis');
    this.outputDir = path.join(__dirname, '../../../planning');
    this.entityInventory = null;
    this.featureAnalysis = null;
    this.fieldInventory = null;
    this.schema = {
      enums: {},
      tables: {},
      views: {},
      relationships: []
    };
  }

  async generate() {
    console.log('🗂️  Starting Data Model Generation...\n');

    // Load analysis data
    await this.loadAnalysisData();
    
    // Load entity inventory
    await this.loadEntityInventory();
    
    // Generate core tables
    this.generateCoreTables();
    
    // Generate financial tables
    this.generateFinancialTables();
    
    // Generate enumerations
    this.generateEnums();
    
    // Generate views
    this.generateViews();
    
    // Generate relationships
    this.generateRelationships();
    
    // Output schema
    await this.outputSchema();
    
    console.log('\n✅ Data model generation complete!');
  }

  async loadAnalysisData() {
    try {
      this.fieldInventory = JSON.parse(
        await fs.readFile(path.join(this.inputDir, 'field-inventory.json'), 'utf-8')
      );
      
      this.featureAnalysis = JSON.parse(
        await fs.readFile(path.join(this.inputDir, 'module-summary.json'), 'utf-8')
      );
      
      console.log('Loaded analysis data from automated extraction');
    } catch (error) {
      console.error('Could not load analysis data:', error.message);
    }
  }

  async loadEntityInventory() {
    try {
      const inventoryPath = path.join(__dirname, '../../../planning/financial-entity-inventory.md');
      const content = await fs.readFile(inventoryPath, 'utf-8');
      this.entityInventory = content;
      console.log('Loaded entity inventory from manual analysis');
    } catch (error) {
      console.error('Could not load entity inventory:', error.message);
    }
  }

  generateCoreTables() {
    // Projects table
    this.schema.tables.projects = {
      name: 'projects',
      description: 'Core project entity',
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        company_id: { type: 'uuid', references: 'companies.id', nullable: false },
        name: { type: 'varchar(255)', nullable: false },
        job_number: { type: 'varchar(50)', unique: true },
        address: { type: 'text' },
        city: { type: 'varchar(100)' },
        state: { type: 'varchar(50)' },
        zip: { type: 'varchar(20)' },
        phone: { type: 'varchar(50)' },
        status: { type: 'project_status', default: "'active'" },
        phase: { type: 'varchar(100)' },
        category: { type: 'varchar(100)' },
        archived: { type: 'boolean', default: 'false' },
        summary: { type: 'text' },
        summary_metadata: { type: 'jsonb' },
        created_at: { type: 'timestamp with time zone', default: 'now()' },
        updated_at: { type: 'timestamp with time zone', default: 'now()' },
        created_by: { type: 'uuid', references: 'auth.users.id' },
        updated_by: { type: 'uuid', references: 'auth.users.id' }
      },
      indexes: [
        'CREATE INDEX idx_projects_company_id ON projects(company_id)',
        'CREATE INDEX idx_projects_status ON projects(status)',
        'CREATE INDEX idx_projects_archived ON projects(archived)'
      ]
    };

    // Companies table
    this.schema.tables.companies = {
      name: 'companies',
      description: 'Company/Vendor entities',
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        name: { type: 'varchar(255)', nullable: false },
        type: { type: 'company_type', default: "'vendor'" },
        address: { type: 'text' },
        city: { type: 'varchar(100)' },
        state: { type: 'varchar(50)' },
        zip: { type: 'varchar(20)' },
        phone: { type: 'varchar(50)' },
        email: { type: 'varchar(255)' },
        website: { type: 'varchar(255)' },
        active: { type: 'boolean', default: 'true' },
        created_at: { type: 'timestamp with time zone', default: 'now()' },
        updated_at: { type: 'timestamp with time zone', default: 'now()' },
        created_by: { type: 'uuid', references: 'auth.users.id' },
        updated_by: { type: 'uuid', references: 'auth.users.id' }
      },
      indexes: [
        'CREATE INDEX idx_companies_type ON companies(type)',
        'CREATE INDEX idx_companies_active ON companies(active)'
      ]
    };

    // Cost Codes table
    this.schema.tables.cost_codes = {
      name: 'cost_codes',
      description: 'Cost code hierarchy',
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        project_id: { type: 'uuid', references: 'projects.id', nullable: false },
        code: { type: 'varchar(50)', nullable: false },
        description: { type: 'text' },
        parent_id: { type: 'uuid', references: 'cost_codes.id' },
        path: { type: 'ltree' },
        active: { type: 'boolean', default: 'true' },
        created_at: { type: 'timestamp with time zone', default: 'now()' },
        updated_at: { type: 'timestamp with time zone', default: 'now()' },
        created_by: { type: 'uuid', references: 'auth.users.id' },
        updated_by: { type: 'uuid', references: 'auth.users.id' }
      },
      constraints: [
        'CONSTRAINT uk_project_cost_code UNIQUE(project_id, code)'
      ],
      indexes: [
        'CREATE INDEX idx_cost_codes_project_id ON cost_codes(project_id)',
        'CREATE INDEX idx_cost_codes_parent_id ON cost_codes(parent_id)',
        'CREATE INDEX idx_cost_codes_path ON cost_codes USING gist(path)'
      ]
    };
  }

  generateFinancialTables() {
    // Budgets table
    this.schema.tables.budgets = {
      name: 'budgets',
      description: 'Project budgets',
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        project_id: { type: 'uuid', references: 'projects.id', nullable: false, unique: true },
        name: { type: 'varchar(255)', default: "'Budget'" },
        status: { type: 'budget_status', default: "'unlocked'" },
        erp_sync_status: { type: 'erp_sync_status', default: "'pending'" },
        locked_at: { type: 'timestamp with time zone' },
        locked_by: { type: 'uuid', references: 'auth.users.id' },
        created_at: { type: 'timestamp with time zone', default: 'now()' },
        updated_at: { type: 'timestamp with time zone', default: 'now()' },
        created_by: { type: 'uuid', references: 'auth.users.id' },
        updated_by: { type: 'uuid', references: 'auth.users.id' }
      },
      indexes: [
        'CREATE INDEX idx_budgets_project_id ON budgets(project_id)',
        'CREATE INDEX idx_budgets_status ON budgets(status)'
      ]
    };

    // Budget Line Items table
    this.schema.tables.budget_line_items = {
      name: 'budget_line_items',
      description: 'Budget line items',
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        budget_id: { type: 'uuid', references: 'budgets.id', nullable: false },
        cost_code_id: { type: 'uuid', references: 'cost_codes.id', nullable: false },
        calculation_method: { type: 'calculation_method', default: "'unit_price'" },
        unit_qty: { type: 'decimal(12,2)' },
        uom: { type: 'varchar(50)' },
        unit_cost: { type: 'money' },
        original_budget: { type: 'money', nullable: false, default: '0' },
        revised_budget: { type: 'money' },
        forecast_to_complete: { type: 'money' },
        created_at: { type: 'timestamp with time zone', default: 'now()' },
        updated_at: { type: 'timestamp with time zone', default: 'now()' }
      },
      indexes: [
        'CREATE INDEX idx_budget_line_items_budget_id ON budget_line_items(budget_id)',
        'CREATE INDEX idx_budget_line_items_cost_code_id ON budget_line_items(cost_code_id)'
      ]
    };

    // Prime Contracts table
    this.schema.tables.prime_contracts = {
      name: 'prime_contracts',
      description: 'Prime contracts with owners',
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        project_id: { type: 'uuid', references: 'projects.id', nullable: false },
        number: { type: 'varchar(50)', nullable: false },
        title: { type: 'varchar(255)', nullable: false },
        owner_id: { type: 'uuid', references: 'companies.id' },
        architect_id: { type: 'uuid', references: 'companies.id' },
        contract_date: { type: 'date' },
        status: { type: 'contract_status', default: "'draft'" },
        original_amount: { type: 'money', default: '0' },
        erp_sync_status: { type: 'erp_sync_status', default: "'pending'" },
        created_at: { type: 'timestamp with time zone', default: 'now()' },
        updated_at: { type: 'timestamp with time zone', default: 'now()' },
        created_by: { type: 'uuid', references: 'auth.users.id' },
        updated_by: { type: 'uuid', references: 'auth.users.id' }
      },
      constraints: [
        'CONSTRAINT uk_project_prime_number UNIQUE(project_id, number)'
      ],
      indexes: [
        'CREATE INDEX idx_prime_contracts_project_id ON prime_contracts(project_id)',
        'CREATE INDEX idx_prime_contracts_status ON prime_contracts(status)'
      ]
    };

    // Commitments table
    this.schema.tables.commitments = {
      name: 'commitments',
      description: 'Subcontracts and purchase orders',
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        project_id: { type: 'uuid', references: 'projects.id', nullable: false },
        number: { type: 'varchar(50)', nullable: false },
        title: { type: 'varchar(255)', nullable: false },
        type: { type: 'commitment_type', default: "'subcontract'" },
        company_id: { type: 'uuid', references: 'companies.id', nullable: false },
        contract_date: { type: 'date' },
        status: { type: 'contract_status', default: "'draft'" },
        original_amount: { type: 'money', default: '0' },
        created_at: { type: 'timestamp with time zone', default: 'now()' },
        updated_at: { type: 'timestamp with time zone', default: 'now()' },
        created_by: { type: 'uuid', references: 'auth.users.id' },
        updated_by: { type: 'uuid', references: 'auth.users.id' }
      },
      constraints: [
        'CONSTRAINT uk_project_commitment_number UNIQUE(project_id, number)'
      ],
      indexes: [
        'CREATE INDEX idx_commitments_project_id ON commitments(project_id)',
        'CREATE INDEX idx_commitments_company_id ON commitments(company_id)',
        'CREATE INDEX idx_commitments_status ON commitments(status)',
        'CREATE INDEX idx_commitments_type ON commitments(type)'
      ]
    };

    // Contract Line Items table (shared between prime contracts and commitments)
    this.schema.tables.contract_line_items = {
      name: 'contract_line_items',
      description: 'Line items for contracts',
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        contract_id: { type: 'uuid', nullable: false },
        contract_type: { type: 'contract_type', nullable: false },
        cost_code_id: { type: 'uuid', references: 'cost_codes.id' },
        line_number: { type: 'integer' },
        description: { type: 'text' },
        amount: { type: 'money', nullable: false, default: '0' },
        created_at: { type: 'timestamp with time zone', default: 'now()' },
        updated_at: { type: 'timestamp with time zone', default: 'now()' }
      },
      indexes: [
        'CREATE INDEX idx_contract_line_items_contract ON contract_line_items(contract_id, contract_type)',
        'CREATE INDEX idx_contract_line_items_cost_code ON contract_line_items(cost_code_id)'
      ]
    };

    // Change Events table
    this.schema.tables.change_events = {
      name: 'change_events',
      description: 'Potential change events',
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        project_id: { type: 'uuid', references: 'projects.id', nullable: false },
        number: { type: 'integer', nullable: false },
        title: { type: 'varchar(255)', nullable: false },
        description: { type: 'text' },
        status: { type: 'change_event_status', default: "'open'" },
        created_at: { type: 'timestamp with time zone', default: 'now()' },
        updated_at: { type: 'timestamp with time zone', default: 'now()' },
        created_by: { type: 'uuid', references: 'auth.users.id' },
        updated_by: { type: 'uuid', references: 'auth.users.id' }
      },
      constraints: [
        'CONSTRAINT uk_project_change_event_number UNIQUE(project_id, number)'
      ],
      indexes: [
        'CREATE INDEX idx_change_events_project_id ON change_events(project_id)',
        'CREATE INDEX idx_change_events_status ON change_events(status)'
      ]
    };

    // Change Orders table
    this.schema.tables.change_orders = {
      name: 'change_orders',
      description: 'Change orders linked to contracts',
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        project_id: { type: 'uuid', references: 'projects.id', nullable: false },
        change_event_id: { type: 'uuid', references: 'change_events.id' },
        contract_id: { type: 'uuid', nullable: false },
        contract_type: { type: 'contract_type', nullable: false },
        number: { type: 'varchar(50)', nullable: false },
        title: { type: 'varchar(255)', nullable: false },
        status: { type: 'change_order_status', default: "'draft'" },
        amount: { type: 'money', nullable: false, default: '0' },
        approved_date: { type: 'date' },
        created_at: { type: 'timestamp with time zone', default: 'now()' },
        updated_at: { type: 'timestamp with time zone', default: 'now()' },
        created_by: { type: 'uuid', references: 'auth.users.id' },
        updated_by: { type: 'uuid', references: 'auth.users.id' }
      },
      constraints: [
        'CONSTRAINT uk_contract_change_order_number UNIQUE(contract_id, contract_type, number)'
      ],
      indexes: [
        'CREATE INDEX idx_change_orders_project_id ON change_orders(project_id)',
        'CREATE INDEX idx_change_orders_change_event_id ON change_orders(change_event_id)',
        'CREATE INDEX idx_change_orders_contract ON change_orders(contract_id, contract_type)',
        'CREATE INDEX idx_change_orders_status ON change_orders(status)'
      ]
    };

    // Billing Periods table
    this.schema.tables.billing_periods = {
      name: 'billing_periods',
      description: 'Billing periods for invoicing',
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        project_id: { type: 'uuid', references: 'projects.id', nullable: false },
        period_number: { type: 'integer', nullable: false },
        period_start: { type: 'date', nullable: false },
        period_end: { type: 'date', nullable: false },
        status: { type: 'billing_period_status', default: "'open'" },
        created_at: { type: 'timestamp with time zone', default: 'now()' },
        updated_at: { type: 'timestamp with time zone', default: 'now()' }
      },
      constraints: [
        'CONSTRAINT uk_project_billing_period UNIQUE(project_id, period_number)'
      ],
      indexes: [
        'CREATE INDEX idx_billing_periods_project_id ON billing_periods(project_id)',
        'CREATE INDEX idx_billing_periods_status ON billing_periods(status)'
      ]
    };

    // Invoices table
    this.schema.tables.invoices = {
      name: 'invoices',
      description: 'Invoices for contracts',
      columns: {
        id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
        project_id: { type: 'uuid', references: 'projects.id', nullable: false },
        billing_period_id: { type: 'uuid', references: 'billing_periods.id' },
        contract_id: { type: 'uuid', nullable: false },
        contract_type: { type: 'contract_type', nullable: false },
        invoice_number: { type: 'varchar(50)', nullable: false },
        invoice_date: { type: 'date', nullable: false },
        amount: { type: 'money', nullable: false },
        status: { type: 'invoice_status', default: "'draft'" },
        paid_amount: { type: 'money', default: '0' },
        paid_date: { type: 'date' },
        created_at: { type: 'timestamp with time zone', default: 'now()' },
        updated_at: { type: 'timestamp with time zone', default: 'now()' },
        created_by: { type: 'uuid', references: 'auth.users.id' },
        updated_by: { type: 'uuid', references: 'auth.users.id' }
      },
      constraints: [
        'CONSTRAINT uk_invoice_number UNIQUE(project_id, invoice_number)'
      ],
      indexes: [
        'CREATE INDEX idx_invoices_project_id ON invoices(project_id)',
        'CREATE INDEX idx_invoices_billing_period_id ON invoices(billing_period_id)',
        'CREATE INDEX idx_invoices_contract ON invoices(contract_id, contract_type)',
        'CREATE INDEX idx_invoices_status ON invoices(status)'
      ]
    };
  }

  generateEnums() {
    this.schema.enums = {
      project_status: ['active', 'inactive', 'complete'],
      company_type: ['vendor', 'subcontractor', 'owner', 'architect', 'other'],
      budget_status: ['locked', 'unlocked'],
      erp_sync_status: ['pending', 'synced', 'failed', 'resyncing'],
      calculation_method: ['unit_price', 'lump_sum', 'percentage'],
      contract_status: ['draft', 'pending', 'executed', 'closed', 'terminated'],
      commitment_type: ['subcontract', 'purchase_order', 'service_order'],
      contract_type: ['prime_contract', 'commitment'],
      change_event_status: ['open', 'closed'],
      change_order_status: ['draft', 'pending', 'approved', 'void'],
      billing_period_status: ['open', 'closed', 'approved'],
      invoice_status: ['draft', 'pending', 'approved', 'paid', 'void']
    };
  }

  generateViews() {
    // Budget Summary View
    this.schema.views.budget_summary_view = {
      name: 'budget_summary_view',
      description: 'Aggregated budget data with commitments and costs',
      sql: `
CREATE VIEW budget_summary_view AS
SELECT 
  b.id AS budget_id,
  b.project_id,
  bli.cost_code_id,
  cc.code AS cost_code,
  cc.description AS cost_code_description,
  bli.original_budget,
  COALESCE(bli.revised_budget, bli.original_budget) AS revised_budget,
  COALESCE(comm.committed_amount, 0) AS committed_amount,
  COALESCE(co.pending_changes, 0) AS pending_changes,
  COALESCE(co.approved_changes, 0) AS approved_changes,
  COALESCE(inv.invoiced_amount, 0) AS invoiced_amount,
  COALESCE(bli.revised_budget, bli.original_budget) - 
    COALESCE(comm.committed_amount, 0) - 
    COALESCE(co.approved_changes, 0) AS remaining_budget
FROM budgets b
JOIN budget_line_items bli ON b.id = bli.budget_id
JOIN cost_codes cc ON bli.cost_code_id = cc.id
LEFT JOIN (
  SELECT 
    cli.cost_code_id,
    c.project_id,
    SUM(cli.amount) AS committed_amount
  FROM commitments c
  JOIN contract_line_items cli ON c.id = cli.contract_id AND cli.contract_type = 'commitment'
  WHERE c.status IN ('pending', 'executed')
  GROUP BY cli.cost_code_id, c.project_id
) comm ON comm.cost_code_id = bli.cost_code_id AND comm.project_id = b.project_id
LEFT JOIN (
  SELECT 
    co.project_id,
    cc.id AS cost_code_id,
    SUM(CASE WHEN co.status = 'pending' THEN co.amount ELSE 0 END) AS pending_changes,
    SUM(CASE WHEN co.status = 'approved' THEN co.amount ELSE 0 END) AS approved_changes
  FROM change_orders co
  JOIN contract_line_items cli ON co.id = cli.contract_id
  JOIN cost_codes cc ON cli.cost_code_id = cc.id
  GROUP BY co.project_id, cc.id
) co ON co.cost_code_id = bli.cost_code_id AND co.project_id = b.project_id
LEFT JOIN (
  SELECT 
    i.project_id,
    cli.cost_code_id,
    SUM(i.amount) AS invoiced_amount
  FROM invoices i
  JOIN contract_line_items cli ON i.contract_id = cli.contract_id AND i.contract_type = cli.contract_type
  WHERE i.status IN ('approved', 'paid')
  GROUP BY i.project_id, cli.cost_code_id
) inv ON inv.cost_code_id = bli.cost_code_id AND inv.project_id = b.project_id;
`
    };

    // Contract Summary View
    this.schema.views.contract_summary_view = {
      name: 'contract_summary_view',
      description: 'Summary of all contracts with changes and billing',
      sql: `
CREATE VIEW contract_summary_view AS
WITH contracts_union AS (
  SELECT 
    id AS contract_id,
    'prime_contract' AS contract_type,
    project_id,
    number,
    title,
    status,
    original_amount
  FROM prime_contracts
  UNION ALL
  SELECT 
    id AS contract_id,
    'commitment' AS contract_type,
    project_id,
    number,
    title,
    status,
    original_amount
  FROM commitments
)
SELECT 
  cu.*,
  COALESCE(co.approved_changes, 0) AS approved_changes,
  COALESCE(co.pending_changes, 0) AS pending_changes,
  cu.original_amount + COALESCE(co.approved_changes, 0) AS revised_amount,
  COALESCE(inv.invoiced_amount, 0) AS invoiced_amount,
  COALESCE(inv.paid_amount, 0) AS paid_amount,
  cu.original_amount + COALESCE(co.approved_changes, 0) - COALESCE(inv.invoiced_amount, 0) AS remaining_to_invoice,
  ROUND(
    CASE 
      WHEN cu.original_amount + COALESCE(co.approved_changes, 0) > 0 
      THEN (COALESCE(inv.invoiced_amount, 0) * 100.0) / (cu.original_amount + COALESCE(co.approved_changes, 0))
      ELSE 0
    END, 2
  ) AS percent_invoiced
FROM contracts_union cu
LEFT JOIN (
  SELECT 
    contract_id,
    contract_type,
    SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) AS approved_changes,
    SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending_changes
  FROM change_orders
  GROUP BY contract_id, contract_type
) co ON co.contract_id = cu.contract_id AND co.contract_type = cu.contract_type
LEFT JOIN (
  SELECT 
    contract_id,
    contract_type,
    SUM(amount) AS invoiced_amount,
    SUM(paid_amount) AS paid_amount
  FROM invoices
  WHERE status IN ('approved', 'paid')
  GROUP BY contract_id, contract_type
) inv ON inv.contract_id = cu.contract_id AND inv.contract_type = cu.contract_type;
`
    };
  }

  generateRelationships() {
    this.schema.relationships = [
      // Core relationships
      { from: 'projects.company_id', to: 'companies.id', type: 'many-to-one' },
      { from: 'cost_codes.project_id', to: 'projects.id', type: 'many-to-one' },
      { from: 'cost_codes.parent_id', to: 'cost_codes.id', type: 'self-reference' },
      
      // Budget relationships
      { from: 'budgets.project_id', to: 'projects.id', type: 'one-to-one' },
      { from: 'budget_line_items.budget_id', to: 'budgets.id', type: 'many-to-one', cascade: 'delete' },
      { from: 'budget_line_items.cost_code_id', to: 'cost_codes.id', type: 'many-to-one' },
      
      // Contract relationships
      { from: 'prime_contracts.project_id', to: 'projects.id', type: 'many-to-one' },
      { from: 'prime_contracts.owner_id', to: 'companies.id', type: 'many-to-one' },
      { from: 'prime_contracts.architect_id', to: 'companies.id', type: 'many-to-one' },
      { from: 'commitments.project_id', to: 'projects.id', type: 'many-to-one' },
      { from: 'commitments.company_id', to: 'companies.id', type: 'many-to-one' },
      { from: 'contract_line_items.cost_code_id', to: 'cost_codes.id', type: 'many-to-one' },
      
      // Change management relationships
      { from: 'change_events.project_id', to: 'projects.id', type: 'many-to-one' },
      { from: 'change_orders.project_id', to: 'projects.id', type: 'many-to-one' },
      { from: 'change_orders.change_event_id', to: 'change_events.id', type: 'many-to-one' },
      
      // Billing relationships
      { from: 'billing_periods.project_id', to: 'projects.id', type: 'many-to-one' },
      { from: 'invoices.project_id', to: 'projects.id', type: 'many-to-one' },
      { from: 'invoices.billing_period_id', to: 'billing_periods.id', type: 'many-to-one' }
    ];
  }

  async outputSchema() {
    // Generate SQL migrations
    const migrations = this.generateMigrations();
    await fs.writeFile(
      path.join(this.outputDir, 'generated-schema.sql'),
      migrations
    );
    
    // Generate JSON schema
    await fs.writeFile(
      path.join(this.outputDir, 'data-model-schema.json'),
      JSON.stringify(this.schema, null, 2)
    );
    
    // Generate ERD markdown
    const erd = this.generateERD();
    await fs.writeFile(
      path.join(this.outputDir, 'entity-relationship-diagram.md'),
      erd
    );
    
    console.log('\nGenerated files:');
    console.log('  - planning/generated-schema.sql');
    console.log('  - planning/data-model-schema.json');
    console.log('  - planning/entity-relationship-diagram.md');
  }

  generateMigrations() {
    let sql = '-- Procore Financial Suite Database Schema\n';
    sql += '-- Generated: ' + new Date().toISOString() + '\n\n';
    
    // Create extensions
    sql += '-- Enable required extensions\n';
    sql += 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n';
    sql += 'CREATE EXTENSION IF NOT EXISTS "ltree";\n\n';
    
    // Create enums
    sql += '-- Create enumerated types\n';
    Object.entries(this.schema.enums).forEach(([name, values]) => {
      sql += `CREATE TYPE ${name} AS ENUM (${values.map(v => `'${v}'`).join(', ')});\n`;
    });
    sql += '\n';
    
    // Create tables
    sql += '-- Create tables\n';
    Object.values(this.schema.tables).forEach(table => {
      sql += `-- ${table.description}\n`;
      sql += `CREATE TABLE ${table.name} (\n`;
      
      const columnDefs = Object.entries(table.columns).map(([name, def]) => {
        let colDef = `  ${name} ${def.type}`;
        if (def.primaryKey) colDef += ' PRIMARY KEY';
        if (def.default) colDef += ` DEFAULT ${def.default}`;
        if (def.nullable === false) colDef += ' NOT NULL';
        if (def.unique) colDef += ' UNIQUE';
        if (def.references) colDef += ` REFERENCES ${def.references}`;
        return colDef;
      });
      
      sql += columnDefs.join(',\n');
      
      if (table.constraints) {
        sql += ',\n' + table.constraints.map(c => `  ${c}`).join(',\n');
      }
      
      sql += '\n);\n\n';
      
      if (table.indexes) {
        table.indexes.forEach(index => {
          sql += `${index};\n`;
        });
        sql += '\n';
      }
    });
    
    // Create views
    sql += '-- Create views\n';
    Object.values(this.schema.views).forEach(view => {
      sql += `-- ${view.description}\n`;
      sql += view.sql.trim() + '\n\n';
    });
    
    // Create triggers for updated_at
    sql += '-- Create updated_at triggers\n';
    sql += `CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';\n\n`;
    
    Object.keys(this.schema.tables).forEach(tableName => {
      const table = this.schema.tables[tableName];
      if (table.columns.updated_at) {
        sql += `CREATE TRIGGER update_${tableName}_updated_at BEFORE UPDATE ON ${tableName} 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();\n`;
      }
    });
    
    return sql;
  }

  generateERD() {
    let md = '# Entity Relationship Diagram\n\n';
    md += 'Generated from Procore UI analysis\n\n';
    
    md += '## Core Tables\n\n';
    md += '```mermaid\nerDiagram\n';
    
    // Core tables ERD
    const coreTables = ['projects', 'companies', 'cost_codes'];
    coreTables.forEach(tableName => {
      const table = this.schema.tables[tableName];
      md += `  ${tableName} {\n`;
      Object.entries(table.columns).forEach(([col, def]) => {
        const type = def.type.split('(')[0].replace(' with time zone', '');
        md += `    ${type} ${col}`;
        if (def.primaryKey) md += ' PK';
        if (def.references) md += ' FK';
        md += '\n';
      });
      md += '  }\n';
    });
    
    // Add relationships
    md += '\n';
    this.schema.relationships
      .filter(rel => coreTables.includes(rel.from.split('.')[0]) && coreTables.includes(rel.to.split('.')[0]))
      .forEach(rel => {
        const [fromTable, fromCol] = rel.from.split('.');
        const [toTable, toCol] = rel.to.split('.');
        md += `  ${fromTable} ||--o{ ${toTable} : "${fromCol}"\n`;
      });
    
    md += '```\n\n';
    
    md += '## Financial Tables\n\n';
    md += '```mermaid\nerDiagram\n';
    
    // Financial tables ERD
    const financialTables = ['budgets', 'budget_line_items', 'prime_contracts', 'commitments', 'change_orders', 'invoices'];
    financialTables.forEach(tableName => {
      const table = this.schema.tables[tableName];
      if (!table) return;
      md += `  ${tableName} {\n`;
      Object.entries(table.columns).slice(0, 8).forEach(([col, def]) => { // Limit fields for readability
        const type = def.type.split('(')[0].replace(' with time zone', '');
        md += `    ${type} ${col}`;
        if (def.primaryKey) md += ' PK';
        if (def.references) md += ' FK';
        md += '\n';
      });
      md += '  }\n';
    });
    
    md += '```\n\n';
    
    // List all relationships
    md += '## Relationships\n\n';
    this.schema.relationships.forEach(rel => {
      md += `- ${rel.from} → ${rel.to} (${rel.type})\n`;
    });
    
    return md;
  }
}

// Run the generator
const generator = new DataModelGenerator();
generator.generate().catch(console.error);