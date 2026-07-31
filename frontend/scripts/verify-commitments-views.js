#!/usr/bin/env node
/**
 * Verify that the required database views exist for the commitments API
 *
 * This script checks:
 * 1. If subcontracts_with_totals view exists
 * 2. If purchase_orders_with_totals view exists
 * 3. If all required columns are present in both views
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env files');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Columns that the API expects from the views
const REQUIRED_COLUMNS = {
  subcontracts_with_totals: [
    'id',
    'project_id',
    'contract_number',
    'title',
    'status',
    'executed',
    'contract_company_id',
    'company_name',
    'company_type',
    'description',
    'start_date',
    'contract_date',
    'default_retainage_percent',
    'created_at',
    'updated_at',
    'total_sov_amount',
    'total_billed_to_date',
    'total_amount_remaining',
    'sov_line_count',
    'is_private'
  ],
  purchase_orders_with_totals: [
    'id',
    'project_id',
    'contract_number',
    'title',
    'status',
    'executed',
    'contract_company_id',
    'company_name',
    'company_type',
    'description',
    'contract_date',
    'default_retainage_percent',
    'created_at',
    'updated_at',
    'total_sov_amount',
    'total_billed_to_date',
    'total_amount_remaining',
    'sov_line_count',
    'is_private'
  ]
};

async function checkViewExists(viewName) {
  console.log(`\n🔍 Checking view: ${viewName}`);

  try {
    // Try to query the view with limit 0 to just check existence
    const { data, error } = await supabase
      .from(viewName)
      .select('*')
      .limit(0);

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.error(`❌ View "${viewName}" does NOT exist`);
        return { exists: false, error: error.message };
      }
      console.error(`❌ Error checking view: ${error.message}`);
      return { exists: false, error: error.message };
    }

    console.log(`✅ View "${viewName}" exists`);
    return { exists: true };
  } catch (err) {
    console.error(`❌ Unexpected error: ${err.message}`);
    return { exists: false, error: err.message };
  }
}

async function checkColumns(viewName, requiredColumns) {
  console.log(`\n📋 Checking columns in ${viewName}...`);

  try {
    // Try to select all required columns
    const { data, error } = await supabase
      .from(viewName)
      .select(requiredColumns.join(','))
      .limit(1);

    if (error) {
      console.error(`❌ Column error: ${error.message}`);

      // Try to identify which column is missing
      for (const col of requiredColumns) {
        const { error: colError } = await supabase
          .from(viewName)
          .select(col)
          .limit(0);

        if (colError) {
          console.error(`   ❌ Missing or invalid column: ${col}`);
        }
      }

      return { valid: false, error: error.message };
    }

    console.log(`✅ All ${requiredColumns.length} required columns are present`);
    return { valid: true };
  } catch (err) {
    console.error(`❌ Unexpected error: ${err.message}`);
    return { valid: false, error: err.message };
  }
}

async function testActualQuery() {
  console.log('\n🧪 Testing actual commitments query...');

  try {
    // Test the actual query that the API uses
    const { data, error } = await supabase
      .from('subcontracts_with_totals')
      .select('id, project_id, contract_number, title')
      .limit(1);

    if (error) {
      console.error(`❌ Query failed: ${error.message}`);
      return { success: false, error: error.message };
    }

    console.log(`✅ Query successful, returned ${data.length} row(s)`);
    if (data.length > 0) {
      console.log('   Sample data:', JSON.stringify(data[0], null, 2));
    }

    return { success: true };
  } catch (err) {
    console.error(`❌ Unexpected error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Commitments Views Verification Script');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Database: ${supabaseUrl}`);

  let allPassed = true;

  // Check subcontracts_with_totals
  const scViewCheck = await checkViewExists('subcontracts_with_totals');
  if (!scViewCheck.exists) {
    allPassed = false;
  } else {
    const scColumnsCheck = await checkColumns('subcontracts_with_totals', REQUIRED_COLUMNS.subcontracts_with_totals);
    if (!scColumnsCheck.valid) allPassed = false;
  }

  // Check purchase_orders_with_totals
  const poViewCheck = await checkViewExists('purchase_orders_with_totals');
  if (!poViewCheck.exists) {
    allPassed = false;
  } else {
    const poColumnsCheck = await checkColumns('purchase_orders_with_totals', REQUIRED_COLUMNS.purchase_orders_with_totals);
    if (!poColumnsCheck.valid) allPassed = false;
  }

  // Test actual query
  const queryTest = await testActualQuery();
  if (!queryTest.success) allPassed = false;

  console.log('\n═══════════════════════════════════════════════════');
  if (allPassed) {
    console.log('✅ ALL CHECKS PASSED - Commitments API should work');
  } else {
    console.log('❌ CHECKS FAILED - See errors above');
    console.log('\nTo fix:');
    console.log('1. Run the migration: supabase/migrations/20260131_000001_schema.sql');
    console.log('2. Or apply it via Supabase dashboard SQL editor');
  }
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
