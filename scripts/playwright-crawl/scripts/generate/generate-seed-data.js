#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { faker } from '@faker-js/faker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generate seed data SQL for Procore Financial Modules
 * Creates realistic test data for all financial tables
 */

// Configuration
const CONFIG = {
  numProjects: 3,
  numCompanies: 20,
  numUsersPerCompany: 5,
  numCostCodesPerProject: 50,
  numBudgetItemsPerProject: 40,
  numContractsPerProject: 15,
  numChangeOrdersPerContract: 3,
  numInvoicesPerContract: 5
};

// Helper functions
function generateUUID() {
  return faker.string.uuid();
}

function formatMoney(amount) {
  return `${amount.toFixed(2)}`;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Data generators
class SeedDataGenerator {
  constructor() {
    this.companies = [];
    this.users = [];
    this.projects = [];
    this.costCodes = [];
    this.budgets = [];
    this.contracts = [];
    this.sql = [];
  }

  async generate() {
    console.log('Generating seed data for Procore Financial Modules...\n');

    // Add header
    this.sql.push('-- Procore Financial Modules Seed Data');
    this.sql.push('-- Generated on ' + new Date().toISOString());
    this.sql.push('-- This script creates test data for all financial tables\n');
    
    // Generate data in dependency order
    await this.generateCompanies();
    await this.generateUsers();
    await this.generateProjects();
    await this.generateCostCodes();
    await this.generateBudgets();
    await this.generateContracts();
    await this.generateChangeOrders();
    await this.generateInvoices();
    
    // Write to file
    const outputPath = path.join(__dirname, '../supabase/seed.sql');
    await fs.writeFile(outputPath, this.sql.join('\n'));
    
    console.log(`\nSeed data generated successfully!`);
    console.log(`Output: ${outputPath}`);
    console.log(`\nSummary:`);
    console.log(`- Companies: ${this.companies.length}`);
    console.log(`- Users: ${this.users.length}`);
    console.log(`- Projects: ${this.projects.length}`);
    console.log(`- Cost Codes: ${this.costCodes.length}`);
    console.log(`- Budgets: ${this.budgets.length}`);
    console.log(`- Contracts: ${this.contracts.length}`);
  }

  async generateCompanies() {
    console.log('Generating companies...');
    
    this.sql.push('\n-- Companies');
    this.sql.push('INSERT INTO companies (id, name, company_type, address_line_1, city, state, zip, phone, is_active) VALUES');
    
    const values = [];
    
    // Create owner company
    const ownerId = generateUUID();
    this.companies.push({
      id: ownerId,
      name: 'ABC Development Group',
      type: 'owner'
    });
    values.push(`('${ownerId}', 'ABC Development Group', 'owner', '123 Main St', 'San Francisco', 'CA', '94105', '415-555-0100', true)`);
    
    // Create general contractor
    const gcId = generateUUID();
    this.companies.push({
      id: gcId,
      name: 'BuildCo General Contractors',
      type: 'general_contractor'
    });
    values.push(`('${gcId}', 'BuildCo General Contractors', 'general_contractor', '456 Construction Way', 'San Francisco', 'CA', '94107', '415-555-0200', true)`);
    
    // Create subcontractors and vendors
    for (let i = 0; i < CONFIG.numCompanies - 2; i++) {
      const id = generateUUID();
      const type = faker.helpers.arrayElement(['subcontractor', 'vendor', 'architect', 'engineer']);
      const name = faker.company.name();
      
      this.companies.push({ id, name, type });
      
      values.push(`('${id}', '${name}', '${type}', '${faker.location.streetAddress()}', '${faker.location.city()}', '${faker.location.state({ abbreviated: true })}', '${faker.location.zipCode()}', '${faker.phone.number()}', true)`);
    }
    
    this.sql.push(values.join(',\n') + ';');
  }

  async generateUsers() {
    console.log('Generating users...');
    
    this.sql.push('\n-- Users');
    this.sql.push('INSERT INTO auth.users (id, email) VALUES');
    const authValues = [];
    
    for (const company of this.companies) {
      const numUsers = company.type === 'owner' || company.type === 'general_contractor' ? CONFIG.numUsersPerCompany : 2;
      
      for (let i = 0; i < numUsers; i++) {
        const id = generateUUID();
        const email = faker.internet.email({ provider: company.name.toLowerCase().replace(/\s+/g, '') + '.com' });
        
        this.users.push({
          id,
          email,
          companyId: company.id,
          companyType: company.type
        });
        
        authValues.push(`('${id}', '${email}')`);
      }
    }
    
    this.sql.push(authValues.join(',\n') + ';');
  }

  async generateProjects() {
    console.log('Generating projects...');
    
    this.sql.push('\n-- Projects');
    this.sql.push('INSERT INTO projects (id, name, job_number, company_id, status, project_type, start_date, end_date, address_line_1, city, state, zip) VALUES');
    
    const values = [];
    const projectTypes = ['commercial', 'residential', 'industrial', 'infrastructure'];
    const projectStatuses = ['active', 'active', 'active', 'bidding', 'complete'];
    
    for (let i = 0; i < CONFIG.numProjects; i++) {
      const id = generateUUID();
      const name = faker.helpers.arrayElement([
        'Downtown Office Tower',
        'Riverside Apartments',
        'Tech Campus Expansion',
        'Medical Center Renovation',
        'Shopping Center Development'
      ]) + ` - Phase ${i + 1}`;
      
      const jobNumber = `${new Date().getFullYear()}-${String(100 + i).padStart(3, '0')}`;
      const gcCompany = this.companies.find(c => c.type === 'general_contractor');
      
      this.projects.push({
        id,
        name,
        jobNumber,
        companyId: gcCompany.id
      });
      
      const startDate = faker.date.recent({ days: 365 });
      const endDate = faker.date.future({ years: 2, refDate: startDate });
      
      values.push(`('${id}', '${name}', '${jobNumber}', '${gcCompany.id}', '${faker.helpers.arrayElement(projectStatuses)}', '${faker.helpers.arrayElement(projectTypes)}', '${formatDate(startDate)}', '${formatDate(endDate)}', '${faker.location.streetAddress()}', '${faker.location.city()}', '${faker.location.state({ abbreviated: true })}', '${faker.location.zipCode()}')`);
    }
    
    this.sql.push(values.join(',\n') + ';');
  }

  async generateCostCodes() {
    console.log('Generating cost codes...');
    
    this.sql.push('\n-- Cost Codes');
    
    for (const project of this.projects) {
      this.sql.push(`\n-- Cost codes for project: ${project.name}`);
      this.sql.push('INSERT INTO cost_codes (id, project_id, code, description, parent_path, sort_order) VALUES');
      
      const values = [];
      const divisions = [
        { code: '01', desc: 'General Requirements' },
        { code: '02', desc: 'Existing Conditions' },
        { code: '03', desc: 'Concrete' },
        { code: '04', desc: 'Masonry' },
        { code: '05', desc: 'Metals' },
        { code: '06', desc: 'Wood & Plastics' },
        { code: '07', desc: 'Thermal & Moisture Protection' },
        { code: '08', desc: 'Doors & Windows' },
        { code: '09', desc: 'Finishes' },
        { code: '10', desc: 'Specialties' },
        { code: '11', desc: 'Equipment' },
        { code: '12', desc: 'Furnishings' },
        { code: '13', desc: 'Special Construction' },
        { code: '14', desc: 'Conveying Systems' },
        { code: '21', desc: 'Fire Suppression' },
        { code: '22', desc: 'Plumbing' },
        { code: '23', desc: 'HVAC' },
        { code: '26', desc: 'Electrical' }
      ];
      
      let sortOrder = 0;
      
      for (const div of divisions) {
        const divId = generateUUID();
        values.push(`('${divId}', '${project.id}', '${div.code}-000', '${div.desc}', '${div.code}', ${sortOrder++})`);
        
        this.costCodes.push({
          id: divId,
          projectId: project.id,
          code: `${div.code}-000`,
          description: div.desc
        });
        
        // Add sub-items
        const numSubItems = faker.number.int({ min: 2, max: 5 });
        for (let i = 1; i <= numSubItems; i++) {
          const subId = generateUUID();
          const subCode = `${div.code}-${String(i * 100).padStart(3, '0')}`;
          const subDesc = faker.commerce.productName();
          
          values.push(`('${subId}', '${project.id}', '${subCode}', '${subDesc}', '${div.code}.${subCode}', ${sortOrder++})`);
          
          this.costCodes.push({
            id: subId,
            projectId: project.id,
            code: subCode,
            description: subDesc,
            divisionCode: div.code
          });
        }
      }
      
      this.sql.push(values.join(',\n') + ';');
    }
  }

  async generateBudgets() {
    console.log('Generating budgets and budget items...');
    
    this.sql.push('\n-- Budgets');
    this.sql.push('INSERT INTO budgets (id, project_id, name, revision_number, is_active) VALUES');
    
    const budgetValues = [];
    
    for (const project of this.projects) {
      const budgetId = generateUUID();
      this.budgets.push({
        id: budgetId,
        projectId: project.id
      });
      
      budgetValues.push(`('${budgetId}', '${project.id}', 'Original Budget', 0, true)`);
    }
    
    this.sql.push(budgetValues.join(',\n') + ';');
    
    // Budget line items
    this.sql.push('\n-- Budget Line Items');
    
    for (const budget of this.budgets) {
      const projectCostCodes = this.costCodes.filter(cc => cc.projectId === budget.projectId && cc.divisionCode);
      
      this.sql.push(`\n-- Budget items for project ID: ${budget.projectId}`);
      this.sql.push('INSERT INTO budget_line_items (id, budget_id, cost_code_id, original_budget, notes) VALUES');
      
      const values = [];
      const selectedCodes = faker.helpers.arrayElements(projectCostCodes, CONFIG.numBudgetItemsPerProject);
      
      for (const costCode of selectedCodes) {
        const id = generateUUID();
        const amount = faker.number.float({ min: 10000, max: 500000, precision: 0.01 });
        
        values.push(`('${id}', '${budget.id}', '${costCode.id}', ${formatMoney(amount)}, 'Initial budget allocation')`);
      }
      
      this.sql.push(values.join(',\n') + ';');
    }
  }

  async generateContracts() {
    console.log('Generating contracts...');
    
    // Prime contracts
    this.sql.push('\n-- Prime Contracts');
    
    for (const project of this.projects) {
      const ownerCompany = this.companies.find(c => c.type === 'owner');
      const architectCompany = this.companies.find(c => c.type === 'architect');
      
      const primeId = generateUUID();
      const contractDate = faker.date.recent({ days: 180 });
      const amount = faker.number.float({ min: 5000000, max: 50000000, precision: 0.01 });
      
      this.contracts.push({
        id: primeId,
        type: 'prime_contract',
        projectId: project.id,
        amount
      });
      
      this.sql.push(`\n-- Prime contract for ${project.name}`);
      this.sql.push(`INSERT INTO prime_contracts (id, project_id, number, title, owner_id, architect_id, contract_date, status, original_amount) VALUES`);
      this.sql.push(`('${primeId}', '${project.id}', 'PC-${project.jobNumber}', 'Prime Contract - ${project.name}', ${ownerCompany ? `'${ownerCompany.id}'` : 'NULL'}, ${architectCompany ? `'${architectCompany.id}'` : 'NULL'}, '${formatDate(contractDate)}', 'executed', ${formatMoney(amount)});`);
      
      // Prime contract line items
      const projectCostCodes = this.costCodes.filter(cc => cc.projectId === project.id && !cc.divisionCode);
      
      if (projectCostCodes.length > 0) {
        this.sql.push(`\nINSERT INTO contract_line_items (id, contract_id, contract_type, cost_code_id, line_number, description, scheduled_value) VALUES`);
        
        const lineValues = [];
        let lineNumber = 1;
        
        for (const costCode of projectCostCodes.slice(0, 10)) {
          const lineId = generateUUID();
          const lineAmount = amount / 10;
          
          lineValues.push(`('${lineId}', '${primeId}', 'prime_contract', '${costCode.id}', ${lineNumber++}, '${costCode.description}', ${formatMoney(lineAmount)})`);
        }
        
        this.sql.push(lineValues.join(',\n') + ';');
      }
    }
    
    // Commitments (subcontracts and POs)
    this.sql.push('\n-- Commitments');
    
    for (const project of this.projects) {
      const subcontractors = this.companies.filter(c => c.type === 'subcontractor' || c.type === 'vendor');
      const selectedSubs = faker.helpers.arrayElements(subcontractors, CONFIG.numContractsPerProject - 1);
      
      for (let i = 0; i < selectedSubs.length; i++) {
        const commitmentId = generateUUID();
        const vendor = selectedSubs[i];
        const commitmentType = vendor.type === 'vendor' ? 'purchase_order' : 'subcontract';
        const contractDate = faker.date.recent({ days: 120 });
        const amount = faker.number.float({ min: 50000, max: 2000000, precision: 0.01 });
        
        this.contracts.push({
          id: commitmentId,
          type: 'commitment',
          projectId: project.id,
          vendorId: vendor.id,
          amount
        });
        
        this.sql.push(`\nINSERT INTO commitments (id, project_id, number, title, type, company_id, contract_date, status, original_amount, retention_percentage) VALUES`);
        this.sql.push(`('${commitmentId}', '${project.id}', '${commitmentType === 'purchase_order' ? 'PO' : 'SC'}-${project.jobNumber}-${String(i + 1).padStart(3, '0')}', '${vendor.name} - ${faker.commerce.department()}', '${commitmentType}', '${vendor.id}', '${formatDate(contractDate)}', '${faker.helpers.arrayElement(['pending', 'executed'])}', ${formatMoney(amount)}, ${commitmentType === 'subcontract' ? '10.00' : '0.00'});`);
        
        // Commitment line items
        const projectCostCodes = this.costCodes.filter(cc => cc.projectId === project.id && cc.divisionCode);
        const selectedCostCodes = faker.helpers.arrayElements(projectCostCodes, faker.number.int({ min: 1, max: 5 }));
        
        if (selectedCostCodes.length > 0) {
          this.sql.push(`\nINSERT INTO contract_line_items (id, contract_id, contract_type, cost_code_id, line_number, description, scheduled_value) VALUES`);
          
          const lineValues = [];
          let lineNumber = 1;
          const lineAmount = amount / selectedCostCodes.length;
          
          for (const costCode of selectedCostCodes) {
            const lineId = generateUUID();
            
            lineValues.push(`('${lineId}', '${commitmentId}', 'commitment', '${costCode.id}', ${lineNumber++}, '${costCode.description}', ${formatMoney(lineAmount)})`);
          }
          
          this.sql.push(lineValues.join(',\n') + ';');
        }
      }
    }
  }

  async generateChangeOrders() {
    console.log('Generating change events and change orders...');
    
    // Change events
    this.sql.push('\n-- Change Events');
    
    let changeEventId = 0;
    const changeEvents = [];
    
    for (const project of this.projects) {
      const numEvents = faker.number.int({ min: 5, max: 15 });
      
      for (let i = 0; i < numEvents; i++) {
        const eventId = generateUUID();
        const eventNumber = i + 1;
        const origin = faker.helpers.arrayElement(['owner', 'architect', 'field', 'unforeseen']);
        const reason = faker.helpers.arrayElement(['design_change', 'site_condition', 'owner_request', 'code_requirement']);
        const status = faker.helpers.arrayElement(['open', 'open', 'pending', 'closed', 'void']);
        
        changeEvents.push({
          id: eventId,
          projectId: project.id,
          number: eventNumber
        });
        
        this.sql.push(`INSERT INTO change_events (id, project_id, number, title, description, origin, reason, status, rough_order_magnitude) VALUES`);
        this.sql.push(`('${eventId}', '${project.id}', ${eventNumber}, 'PCO-${String(eventNumber).padStart(3, '0')}: ${faker.company.catchPhrase()}', '${faker.lorem.sentence()}', '${origin}', '${reason}', '${status}', ${formatMoney(faker.number.float({ min: 5000, max: 100000, precision: 0.01 }))});`);
      }
    }
    
    // Change orders
    this.sql.push('\n-- Change Orders');
    
    for (const contract of this.contracts) {
      const projectEvents = changeEvents.filter(e => e.projectId === contract.projectId);
      const numCOs = faker.number.int({ min: 0, max: CONFIG.numChangeOrdersPerContract });
      
      for (let i = 0; i < numCOs; i++) {
        const coId = generateUUID();
        const coNumber = `CO-${String(i + 1).padStart(3, '0')}`;
        const event = faker.helpers.arrayElement(projectEvents);
        const status = faker.helpers.arrayElement(['draft', 'pending', 'approved', 'approved']);
        const amount = faker.number.float({ min: -50000, max: 200000, precision: 0.01 });
        
        this.sql.push(`\nINSERT INTO change_orders (id, project_id, change_event_id, contract_id, contract_type, number, title, status, total_amount, schedule_impact_days) VALUES`);
        this.sql.push(`('${coId}', '${contract.projectId}', ${event ? `'${event.id}'` : 'NULL'}, '${contract.id}', '${contract.type}', '${coNumber}', 'Change Order ${i + 1} - ${faker.company.buzzPhrase()}', '${status}', ${formatMoney(amount)}, ${faker.number.int({ min: 0, max: 30 })});`);
        
        // Change order line items
        const projectCostCodes = this.costCodes.filter(cc => cc.projectId === contract.projectId);
        const numLines = faker.number.int({ min: 1, max: 5 });
        const selectedCostCodes = faker.helpers.arrayElements(projectCostCodes, numLines);
        
        if (selectedCostCodes.length > 0) {
          this.sql.push(`\nINSERT INTO change_order_line_items (id, change_order_id, cost_code_id, line_number, description, amount) VALUES`);
          
          const lineValues = [];
          let remainingAmount = amount;
          
          for (let j = 0; j < selectedCostCodes.length; j++) {
            const lineId = generateUUID();
            const costCode = selectedCostCodes[j];
            const isLastLine = j === selectedCostCodes.length - 1;
            const lineAmount = isLastLine ? remainingAmount : amount / selectedCostCodes.length;
            
            lineValues.push(`('${lineId}', '${coId}', '${costCode.id}', ${j + 1}, '${faker.commerce.productDescription()}', ${formatMoney(lineAmount)})`);
            
            remainingAmount -= lineAmount;
          }
          
          this.sql.push(lineValues.join(',\n') + ';');
        }
      }
    }
  }

  async generateInvoices() {
    console.log('Generating billing periods and invoices...');
    
    // Billing periods
    this.sql.push('\n-- Billing Periods');
    
    const billingPeriods = [];
    
    for (const project of this.projects) {
      const startDate = faker.date.recent({ days: 365 });
      
      for (let i = 0; i < 12; i++) {
        const periodId = generateUUID();
        const periodStart = new Date(startDate);
        periodStart.setMonth(periodStart.getMonth() + i);
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(periodEnd.getDate() - 1);
        
        billingPeriods.push({
          id: periodId,
          projectId: project.id,
          periodNumber: i + 1,
          periodStart,
          periodEnd
        });
        
        const status = i < 6 ? 'closed' : i === 6 ? 'open' : 'future';
        
        this.sql.push(`INSERT INTO billing_periods (id, project_id, period_number, period_name, period_start, period_end, status) VALUES`);
        this.sql.push(`('${periodId}', '${project.id}', ${i + 1}, '${periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}', '${formatDate(periodStart)}', '${formatDate(periodEnd)}', '${status}');`);
      }
    }
    
    // Invoices
    this.sql.push('\n-- Invoices');
    
    for (const contract of this.contracts) {
      const projectPeriods = billingPeriods.filter(bp => bp.projectId === contract.projectId && bp.periodNumber <= 6);
      const numInvoices = Math.min(projectPeriods.length, CONFIG.numInvoicesPerContract);
      
      let previousPayments = 0;
      
      for (let i = 0; i < numInvoices; i++) {
        const invoiceId = generateUUID();
        const period = projectPeriods[i];
        const applicationNumber = i + 1;
        const invoiceNumber = `${contract.type === 'prime_contract' ? 'INV' : 'APP'}-${faker.number.int({ min: 1000, max: 9999 })}`;
        const percentComplete = (i + 1) * (100 / 12);
        const totalCompleted = contract.amount * (percentComplete / 100);
        const thisPayment = totalCompleted - previousPayments;
        const retentionAmount = contract.type === 'commitment' ? totalCompleted * 0.1 : 0;
        const status = faker.helpers.arrayElement(['draft', 'submitted', 'approved', 'paid']);
        
        this.sql.push(`\nINSERT INTO invoices (id, project_id, billing_period_id, contract_id, contract_type, invoice_number, application_number, invoice_date, period_to, status, work_complete_percent, scheduled_value, work_completed_from_previous, work_completed_this_period, retention_percent, retention_amount, previous_payments) VALUES`);
        this.sql.push(`('${invoiceId}', '${contract.projectId}', '${period.id}', '${contract.id}', '${contract.type}', '${invoiceNumber}', ${applicationNumber}, '${formatDate(period.periodEnd)}', '${formatDate(period.periodEnd)}', '${status}', ${percentComplete.toFixed(2)}, ${formatMoney(contract.amount)}, ${formatMoney(previousPayments)}, ${formatMoney(thisPayment)}, ${contract.type === 'commitment' ? '10.00' : '0.00'}, ${formatMoney(retentionAmount)}, ${formatMoney(previousPayments)});`);
        
        previousPayments = totalCompleted;
        
        // Invoice line items (simplified - just use contract line items)
        this.sql.push(`\nINSERT INTO invoice_line_items (invoice_id, contract_line_item_id, line_number, description, cost_code_id, scheduled_value, work_completed_from_previous, work_completed_this_period, retention_amount)`);
        this.sql.push(`SELECT '${invoiceId}', cli.id, cli.line_number, cli.description, cli.cost_code_id, cli.scheduled_value, `);
        this.sql.push(`  CASE WHEN ${i} > 0 THEN cli.scheduled_value * ${((i) * (100 / 12) / 100).toFixed(4)} ELSE 0 END,`);
        this.sql.push(`  cli.scheduled_value * ${(((100 / 12) / 100)).toFixed(4)},`);
        this.sql.push(`  CASE WHEN '${contract.type}' = 'commitment' THEN (cli.scheduled_value * ${(percentComplete / 100).toFixed(4)}) * 0.10 ELSE 0 END`);
        this.sql.push(`FROM contract_line_items cli`);
        this.sql.push(`WHERE cli.contract_id = '${contract.id}' AND cli.contract_type = '${contract.type}';`);
      }
    }
    
    // Add some lien waivers
    this.sql.push('\n-- Lien Waivers (sample)');
    this.sql.push(`INSERT INTO lien_waivers (invoice_id, waiver_type, waiver_period, amount, through_date, status, company_id)`);
    this.sql.push(`SELECT i.id, 'conditional', 'progress', i.current_payment_due, i.period_to, 'received', c.company_id`);
    this.sql.push(`FROM invoices i`);
    this.sql.push(`JOIN commitments c ON i.contract_id = c.id`);
    this.sql.push(`WHERE i.contract_type = 'commitment' AND i.status IN ('approved', 'paid')`);
    this.sql.push(`LIMIT 20;`);
  }
}

// Run the generator
async function main() {
  try {
    const generator = new SeedDataGenerator();
    await generator.generate();
  } catch (error) {
    console.error('Error generating seed data:', error);
    process.exit(1);
  }
}

// Execute
main();