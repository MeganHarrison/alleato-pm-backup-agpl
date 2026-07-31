import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://lgveqfnpkxvzbnnwuled.supabase.co';
const serviceKey = 'sb_secret_fDpzY_Eu0StzNOZsVKegRQ_d-G5k-Jf';

const supabase = createClient(supabaseUrl, serviceKey);

async function applyMigration() {
  console.log('Applying budget migration...');

  // Read the migration file
  const migrationSQL = fs.readFileSync(
    '../supabase/migrations/20260131115801_add_budget_snapshots_and_forecasts.sql',
    'utf-8'
  );

  try {
    // Since we can't execute raw SQL directly, let's use the management API
    const url = `https://api.supabase.com/v1/projects/lgveqfnpkxvzbnnwuled/database/query`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer sbp_v0_dc89028c89d9d59e7999e775756f547343bee7d1`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${error}`);
    }

    const result = await response.json();
    console.log('Migration applied successfully!');
    console.log('Result:', result);
  } catch (err) {
    console.error('Failed to apply migration:', err.message);
    console.log('\n=== MANUAL APPLICATION REQUIRED ===');
    console.log('Please copy the migration file and run it in the Supabase SQL editor:');
    console.log('1. Go to https://supabase.com/dashboard/project/lgveqfnpkxvzbnnwuled/sql');
    console.log('2. Copy the contents of:');
    console.log('   supabase/migrations/20260131115801_add_budget_snapshots_and_forecasts.sql');
    console.log('3. Paste and execute in the SQL editor');
  }
}

applyMigration();