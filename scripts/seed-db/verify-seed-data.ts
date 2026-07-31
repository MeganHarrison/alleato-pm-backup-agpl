#!/usr/bin/env tsx
/**
 * Verify Seed Data
 *
 * Verifies that the direct costs seed data was created successfully
 */

import { createClient } from '@supabase/supabase-js';
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
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verify() {
  console.log('🔍 Verifying seeded data...\n');

  // Count vendor companies
  const { count: vendorCount } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });
  console.log(`✓ Vendor Companies: ${vendorCount}`);

  // Get sample vendor companies
  const { data: vendors } = await supabase
    .from('companies')
    .select('name, contact_name, is_vendor')
    .eq('is_vendor', true)
    .limit(3);
  console.log('  Sample vendors:', vendors?.map(v => v.name).join(', '));

  // Count budget codes
  const { count: budgetCodeCount } = await supabase
    .from('project_budget_codes')
    .select('*', { count: 'exact', head: true });
  console.log(`\n✓ Project Budget Codes: ${budgetCodeCount}`);

  // Count direct costs
  const { count: directCostCount } = await supabase
    .from('direct_costs')
    .select('*', { count: 'exact', head: true });
  console.log(`\n✓ Direct Costs: ${directCostCount}`);

  // Get sample direct costs with details
  const { data: directCosts } = await supabase
    .from('direct_costs')
    .select('cost_type, status, description, total_amount')
    .limit(5);
  console.log('  Sample direct costs:');
  directCosts?.forEach(dc => {
    console.log(`    - ${dc.cost_type} (${dc.status}): ${dc.description} - $${dc.total_amount}`);
  });

  // Count line items
  const { count: lineItemCount } = await supabase
    .from('direct_cost_line_items')
    .select('*', { count: 'exact', head: true });
  console.log(`\n✓ Direct Cost Line Items: ${lineItemCount}`);

  // Get sample line items
  const { data: lineItems } = await supabase
    .from('direct_cost_line_items')
    .select('description, quantity, uom, unit_cost, line_total')
    .limit(5);
  console.log('  Sample line items:');
  lineItems?.forEach(li => {
    console.log(`    - ${li.description}: ${li.quantity} ${li.uom} @ $${li.unit_cost?.toFixed(2)} = $${li.line_total?.toFixed(2)}`);
  });

  // Verify foreign key relationships
  const { data: costsWithVendors } = await supabase
    .from('direct_costs')
    .select('id, companies(name)')
    .eq('cost_type', 'Invoice')
    .limit(3);
  console.log('\n✓ Foreign Keys (Direct Costs → Vendors):');
  costsWithVendors?.forEach(dc => {
    const vendorName = (dc.companies as any)?.name || 'N/A';
    console.log(`    - Direct Cost ${dc.id.substring(0, 8)}... → Vendor: ${vendorName}`);
  });

  // Summary
  console.log('\n📊 Summary:');
  console.log(`- Total Vendor Companies: ${vendorCount}`);
  console.log(`- Total Budget Codes: ${budgetCodeCount}`);
  console.log(`- Total Direct Costs: ${directCostCount}`);
  console.log(`- Total Line Items: ${lineItemCount}`);

  console.log('\n✅ Verification complete!');
}

verify().catch(console.error);
