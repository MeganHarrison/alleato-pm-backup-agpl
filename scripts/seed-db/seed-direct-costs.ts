#!/usr/bin/env tsx
/**
 * Seed Direct Costs Data
 *
 * Creates test data for the Direct Costs feature:
 * - Vendor companies
 * - Budget codes (project_budget_codes)
 * - Direct costs with line items
 *
 * Usage:
 *   tsx scripts/seed-direct-costs.ts
 *   tsx scripts/seed-direct-costs.ts --clear  # Clear existing data first
 */

import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from frontend/.env.local
const envPath = path.join(__dirname, '../frontend/.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✓' : '✗');
  console.error('\nPlease ensure frontend/.env.local exists with these variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ============================================================================
// Data Generators
// ============================================================================

const vendorNames = [
  'Acme Supply Co',
  'BuildMart Materials',
  'Construction Depot',
  'ABC Materials & Supplies',
  'XYZ Equipment Rental',
  'ProBuild Distributors',
  'Premier Supply Chain',
  'Quality Construction Materials',
  'FastTrack Equipment',
  'Reliable Vendors Inc'
];

const generateVendor = (_companyId: string, name: string) => ({
  name,
  contact_name: faker.person.fullName(),
  contact_email: faker.internet.email(),
  contact_phone: faker.phone.number(),
  address: faker.location.streetAddress(),
  city: faker.location.city(),
  state: faker.location.state({ abbreviated: true }),
  zip_code: faker.location.zipCode(),
  country: 'USA',
  tax_id: faker.string.numeric(9),
  is_vendor: true,
  status: 'active',
  notes: faker.helpers.arrayElement([
    null,
    'Preferred vendor',
    'Net 30 terms',
    'Volume discount available'
  ])
});

const costCodeDescriptions = [
  'Concrete & Masonry',
  'Steel & Structural',
  'Carpentry & Framing',
  'Electrical Work',
  'Plumbing & HVAC',
  'Finish Carpentry',
  'Painting & Coating',
  'Roofing & Waterproofing',
  'Site Work & Excavation',
  'General Conditions',
  'Equipment & Tools',
  'Safety & PPE',
  'Permits & Fees',
  'Testing & Inspection',
  'Miscellaneous Expenses'
];

const generateBudgetCode = (
  projectId: number,
  costCodeId: string,
  costTypeId: string,
  description: string,
  createdBy: string
) => ({
  project_id: projectId,
  cost_code_id: costCodeId,
  cost_type_id: costTypeId,
  description,
  description_mode: 'concatenated',
  is_active: true,
  created_by: createdBy
});

const directCostDescriptions = {
  Expense: [
    'Office supplies for site trailer',
    'Safety equipment and PPE',
    'Tools and small equipment',
    'Vehicle fuel and maintenance',
    'Miscellaneous site expenses',
    'Employee travel expenses',
    'Site utilities payment',
    'Equipment rental fees'
  ],
  Invoice: [
    'Concrete delivery - Foundation pour',
    'Structural steel fabrication',
    'Lumber and framing materials',
    'Electrical materials package',
    'Plumbing fixtures and materials',
    'Roofing materials delivery',
    'HVAC equipment supply',
    'Finish materials package',
    'Site preparation and grading',
    'Drywall and insulation materials'
  ]
};

const generateDirectCost = (
  projectId: number,
  vendorId: string | null,
  employeeId: number | null,
  costType: 'Expense' | 'Invoice',
  status: 'Draft' | 'Approved' | 'Rejected' | 'Paid',
  createdByUserId: string
) => {
  const descriptions = directCostDescriptions[costType];
  const description = faker.helpers.arrayElement(descriptions);
  const date = faker.date.recent({ days: 90 });
  const receivedDate = costType === 'Invoice' ?
    faker.date.between({ from: date, to: new Date() }) : null;
  const paidDate = (status === 'Paid' && receivedDate) ?
    faker.date.between({ from: receivedDate, to: new Date() }) : null;

  return {
    project_id: projectId,
    cost_type: costType,
    date: date.toISOString().split('T')[0],
    vendor_id: vendorId,
    employee_id: employeeId,
    invoice_number: costType === 'Invoice' ? `INV-${faker.string.numeric(6)}` : null,
    status,
    description,
    terms: costType === 'Invoice' ?
      faker.helpers.arrayElement(['Net 30', 'Net 45', 'Net 60', 'Due on Receipt']) : null,
    received_date: receivedDate ? receivedDate.toISOString().split('T')[0] : null,
    paid_date: paidDate ? paidDate.toISOString().split('T')[0] : null,
    total_amount: 0, // Will be calculated from line items
    created_by_user_id: createdByUserId,
    updated_by_user_id: createdByUserId,
    is_deleted: false
  };
};

const lineItemDescriptions = [
  'Labor - General',
  'Labor - Skilled',
  'Materials - Bulk',
  'Materials - Specialty',
  'Equipment Rental',
  'Equipment Purchase',
  'Subcontractor Work',
  'Freight and Delivery',
  'Disposal and Waste',
  'Permits and Fees'
];

const generateLineItem = (
  directCostId: string,
  budgetCodeId: string,
  lineOrder: number
) => {
  const quantity = faker.number.float({ min: 1, max: 100, fractionDigits: 2 });
  const unitCost = faker.number.float({ min: 10, max: 5000, fractionDigits: 2 });

  return {
    direct_cost_id: directCostId,
    budget_code_id: budgetCodeId,
    description: faker.helpers.arrayElement(lineItemDescriptions),
    quantity,
    uom: faker.helpers.arrayElement(['EA', 'LF', 'SF', 'CY', 'TON', 'HR', 'LOT']),
    unit_cost: unitCost,
    line_order: lineOrder
    // NOTE: line_total is a GENERATED column - do NOT insert it
  };
};

// ============================================================================
// Seeding Functions
// ============================================================================

async function clearDirectCostsData() {
  console.log('🧹 Clearing existing direct costs data...');

  // Clear in reverse order of dependencies
  const { error: lineItemsError } = await supabase
    .from('direct_cost_line_items')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (lineItemsError) {
    console.warn('Warning clearing line items:', lineItemsError.message);
  }

  const { error: directCostsError } = await supabase
    .from('direct_costs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (directCostsError) {
    console.warn('Warning clearing direct costs:', directCostsError.message);
  }

  const { error: vendorsError } = await supabase
    .from('companies')
    .delete()
    .eq('is_vendor', true)
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (vendorsError) {
    console.warn('Warning clearing vendors:', vendorsError.message);
  }

  console.log('✅ Existing data cleared');
}

async function seedDirectCostsData() {
  console.log('🌱 Starting direct costs data seeding...\n');

  try {
    // ========================================================================
    // Step 1: Get or Create Company for Vendors
    // ========================================================================
    console.log('📋 Step 1: Getting/creating company for vendors...');

    let company;
    const { data: existingCompanies } = await supabase
      .from('companies')
      .select('id, name')
      .limit(1);

    if (existingCompanies && existingCompanies.length > 0) {
      company = existingCompanies[0];
      console.log(`✓ Using existing company: ${company.name}`);
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: 'General Contractors Inc',
          type: 'general_contractor',
          status: 'active'
        })
        .select()
        .single();

      if (companyError) throw companyError;
      company = newCompany;
      console.log(`✓ Created new company: ${company.name}`);
    }

    // ========================================================================
    // Step 2: Create Vendors
    // ========================================================================
    console.log('\n📋 Step 2: Creating vendor companies...');

    const vendors = vendorNames.map(name => generateVendor(company.id, name));

    const { data: insertedVendors, error: vendorsError } = await supabase
      .from('companies')
      .insert(vendors)
      .select();

    if (vendorsError) throw vendorsError;
    console.log(`✓ Created ${insertedVendors.length} vendors`);

    // ========================================================================
    // Step 3: Get Existing Projects
    // ========================================================================
    console.log('\n📋 Step 3: Getting existing projects...');

    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name')
      .limit(3);

    if (projectsError) throw projectsError;

    if (!projects || projects.length === 0) {
      console.error('❌ No projects found. Please create projects first.');
      process.exit(1);
    }

    console.log(`✓ Found ${projects.length} projects`);
    projects.forEach(p => console.log(`  - ${p.name} (ID: ${p.id})`));

    // ========================================================================
    // Step 4: Get or Create Cost Codes and Cost Types
    // ========================================================================
    console.log('\n📋 Step 4: Getting/creating cost codes...');

    // Get or create cost code divisions
    let costCodeDivisions;
    const { data: existingDivisions } = await supabase
      .from('cost_code_divisions')
      .select('id, title')
      .limit(5);

    if (existingDivisions && existingDivisions.length > 0) {
      costCodeDivisions = existingDivisions;
      console.log(`✓ Using ${existingDivisions.length} existing cost code divisions`);
    } else {
      const divisions = [
        { id: '01', title: 'General Requirements' },
        { id: '03', title: 'Concrete' },
        { id: '05', title: 'Metals' },
        { id: '06', title: 'Wood, Plastics, and Composites' },
        { id: '09', title: 'Finishes' }
      ];

      const { data: newDivisions, error: divisionsError } = await supabase
        .from('cost_code_divisions')
        .insert(divisions)
        .select();

      if (divisionsError) throw divisionsError;
      costCodeDivisions = newDivisions;
      console.log(`✓ Created ${newDivisions.length} cost code divisions`);
    }

    // Get or create cost codes
    let costCodes;
    const { data: existingCostCodes } = await supabase
      .from('cost_codes')
      .select('id, division_id, title')
      .limit(15);

    if (existingCostCodes && existingCostCodes.length >= 10) {
      costCodes = existingCostCodes;
      console.log(`✓ Using ${existingCostCodes.length} existing cost codes`);
    } else {
      const newCostCodes = costCodeDivisions.flatMap((division, idx) =>
        Array.from({ length: 3 }, (_, i) => ({
          id: `${division.id}-${(i + 1).toString().padStart(3, '0')}`,
          division_id: division.id,
          title: `${division.title} - Item ${i + 1}`,
          status: 'active'
        }))
      );

      const { data: insertedCostCodes, error: costCodesError } = await supabase
        .from('cost_codes')
        .insert(newCostCodes)
        .select();

      if (costCodesError) throw costCodesError;
      costCodes = insertedCostCodes;
      console.log(`✓ Created ${insertedCostCodes.length} cost codes`);
    }

    // Get or create cost types
    let costTypes;
    const { data: existingCostTypes } = await supabase
      .from('cost_code_types')
      .select('id, code, description')
      .limit(5);

    if (existingCostTypes && existingCostTypes.length >= 4) {
      costTypes = existingCostTypes;
      console.log(`✓ Using ${existingCostTypes.length} existing cost types`);
    } else {
      const newCostTypes = [
        { code: 'LAB', description: 'Labor', category: 'Direct' },
        { code: 'MAT', description: 'Materials', category: 'Direct' },
        { code: 'EQP', description: 'Equipment', category: 'Direct' },
        { code: 'SUB', description: 'Subcontractors', category: 'Direct' }
      ];

      const { data: insertedCostTypes, error: costTypesError } = await supabase
        .from('cost_code_types')
        .insert(newCostTypes)
        .select();

      if (costTypesError) throw costTypesError;
      costTypes = insertedCostTypes;
      console.log(`✓ Created ${insertedCostTypes.length} cost types`);
    }

    // ========================================================================
    // Step 5: Get Auth User for created_by_user_id
    // ========================================================================
    console.log('\n📋 Step 5: Getting auth user...');

    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) throw usersError;

    if (!users || users.length === 0) {
      console.error('❌ No auth users found. Please create a user first.');
      process.exit(1);
    }

    const authUser = users[0];
    console.log(`✓ Using auth user: ${authUser.email}`);

    // ========================================================================
    // Step 6: Get Employees
    // ========================================================================
    console.log('\n📋 Step 6: Getting employees...');

    const { data: employees } = await supabase
      .from('people')
      .select('id, name')
      .limit(5);

    if (employees && employees.length > 0) {
      console.log(`✓ Found ${employees.length} employees`);
    } else {
      console.log('⚠ No employees found - will use null for employee_id');
    }

    // ========================================================================
    // Step 7: Create Project Budget Codes
    // ========================================================================
    console.log('\n📋 Step 7: Creating project budget codes...');

    const budgetCodes = [];
    for (const project of projects) {
      for (let i = 0; i < Math.min(5, costCodeDescriptions.length); i++) {
        budgetCodes.push(
          generateBudgetCode(
            project.id,
            costCodes[i % costCodes.length].id,
            costTypes[i % costTypes.length].id,
            costCodeDescriptions[i],
            authUser.id
          )
        );
      }
    }

    const { data: insertedBudgetCodes, error: budgetCodesError } = await supabase
      .from('project_budget_codes')
      .insert(budgetCodes)
      .select();

    if (budgetCodesError) throw budgetCodesError;
    console.log(`✓ Created ${insertedBudgetCodes.length} project budget codes`);

    // ========================================================================
    // Step 8: Create Direct Costs with Line Items
    // ========================================================================
    console.log('\n📋 Step 8: Creating direct costs with line items...');

    let totalDirectCosts = 0;
    let totalLineItems = 0;

    for (const project of projects) {
      const projectBudgetCodes = insertedBudgetCodes.filter(
        bc => bc.project_id === project.id
      );

      // Create 5-7 direct costs per project
      const numDirectCosts = faker.number.int({ min: 5, max: 7 });

      for (let i = 0; i < numDirectCosts; i++) {
        const costType = faker.helpers.arrayElement(['Expense', 'Invoice', 'Invoice']);
        const status = faker.helpers.weightedArrayElement([
          { weight: 2, value: 'Draft' },
          { weight: 3, value: 'Approved' },
          { weight: 1, value: 'Paid' }
        ]);

        const vendorId = costType === 'Invoice' ?
          insertedVendors[i % insertedVendors.length].id : null;

        const employeeId = costType === 'Expense' && employees && employees.length > 0 ?
          employees[i % employees.length].id : null;

        const directCost = generateDirectCost(
          project.id,
          vendorId,
          employeeId,
          costType as 'Expense' | 'Invoice',
          status as 'Draft' | 'Approved' | 'Rejected' | 'Paid',
          authUser.id
        );

        // Insert direct cost
        const { data: insertedDirectCost, error: directCostError } = await supabase
          .from('direct_costs')
          .insert(directCost)
          .select()
          .single();

        if (directCostError) throw directCostError;
        totalDirectCosts++;

        // Create 2-5 line items for each direct cost
        const numLineItems = faker.number.int({ min: 2, max: 5 });
        const lineItems = [];

        for (let j = 0; j < numLineItems; j++) {
          const budgetCodeId = projectBudgetCodes[j % projectBudgetCodes.length].id;
          lineItems.push(
            generateLineItem(insertedDirectCost.id, budgetCodeId, j + 1)
          );
        }

        const { data: insertedLineItems, error: lineItemsError } = await supabase
          .from('direct_cost_line_items')
          .insert(lineItems)
          .select();

        if (lineItemsError) throw lineItemsError;
        totalLineItems += insertedLineItems.length;

        // Calculate total from line items and update direct cost
        const calculatedTotal = insertedLineItems.reduce(
          (sum, item) => sum + (item.line_total || 0),
          0
        );

        await supabase
          .from('direct_costs')
          .update({ total_amount: calculatedTotal })
          .eq('id', insertedDirectCost.id);
      }
    }

    console.log(`✓ Created ${totalDirectCosts} direct costs`);
    console.log(`✓ Created ${totalLineItems} line items`);

    // ========================================================================
    // Summary
    // ========================================================================
    console.log('\n🎉 Direct costs data seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`- Vendors: ${insertedVendors.length}`);
    console.log(`- Cost Code Divisions: ${costCodeDivisions.length}`);
    console.log(`- Cost Codes: ${costCodes.length}`);
    console.log(`- Cost Types: ${costTypes.length}`);
    console.log(`- Project Budget Codes: ${insertedBudgetCodes.length}`);
    console.log(`- Direct Costs: ${totalDirectCosts}`);
    console.log(`- Line Items: ${totalLineItems}`);
    console.log(`- Projects Used: ${projects.length}`);

  } catch (error) {
    console.error('❌ Error seeding direct costs data:', error);
    throw error;
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const shouldClear = args.includes('--clear');

  try {
    if (shouldClear) {
      await clearDirectCostsData();
    }

    await seedDirectCostsData();
  } catch (error) {
    console.error('\n❌ Failed to seed direct costs data:', error);
    process.exit(1);
  }
}

// Run if called directly (ES module compatible)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}

export { seedDirectCostsData, clearDirectCostsData };
