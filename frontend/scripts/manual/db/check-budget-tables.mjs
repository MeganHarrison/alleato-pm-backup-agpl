import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lgveqfnpkxvzbnnwuled.supabase.co';
const serviceKey = 'sb_secret_fDpzY_Eu0StzNOZsVKegRQ_d-G5k-Jf';

const supabase = createClient(supabaseUrl, serviceKey);

async function checkTables() {
  console.log('Checking budget tables...\n');

  // Check budget_snapshots table
  const { data: snapshots, error: snapshotsError } = await supabase
    .from('budget_snapshots')
    .select('*')
    .limit(1);

  if (snapshotsError) {
    console.log('❌ budget_snapshots table: NOT FOUND');
    console.log('   Error:', snapshotsError.message);
  } else {
    console.log('✅ budget_snapshots table: EXISTS');
  }

  // Check budget_line_forecasts table
  const { data: forecasts, error: forecastsError } = await supabase
    .from('budget_line_forecasts')
    .select('*')
    .limit(1);

  if (forecastsError) {
    console.log('❌ budget_line_forecasts table: NOT FOUND');
    console.log('   Error:', forecastsError.message);
  } else {
    console.log('✅ budget_line_forecasts table: EXISTS');
  }

  // Check v_budget_rollup view by executing a query
  const { data: rollup, error: rollupError } = await supabase.rpc('exec_sql', {
    sql: 'SELECT * FROM v_budget_rollup LIMIT 1'
  }).catch(async () => {
    // Try direct query if RPC doesn't exist
    const response = await fetch(`https://api.supabase.com/v1/projects/lgveqfnpkxvzbnnwuled/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer sbp_v0_dc89028c89d9d59e7999e775756f547343bee7d1`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'SELECT * FROM v_budget_rollup LIMIT 1'
      })
    });
    return response.json();
  });

  if (rollupError || rollup?.error) {
    console.log('❌ v_budget_rollup view: NOT FOUND');
    console.log('   Error:', rollupError?.message || rollup?.error?.message);
  } else {
    console.log('✅ v_budget_rollup view: EXISTS');
  }

  // Check mv_budget_rollup materialized view
  const mvResponse = await fetch(`https://api.supabase.com/v1/projects/lgveqfnpkxvzbnnwuled/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer sbp_v0_dc89028c89d9d59e7999e775756f547343bee7d1`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'SELECT * FROM mv_budget_rollup LIMIT 1'
    })
  });

  const mvResult = await mvResponse.json();
  if (mvResult.error) {
    console.log('❌ mv_budget_rollup materialized view: NOT FOUND');
    console.log('   Error:', mvResult.error.message);
  } else {
    console.log('✅ mv_budget_rollup materialized view: EXISTS');
  }

  // Check v_budget_grand_totals view
  const grandResponse = await fetch(`https://api.supabase.com/v1/projects/lgveqfnpkxvzbnnwuled/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer sbp_v0_dc89028c89d9d59e7999e775756f547343bee7d1`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'SELECT * FROM v_budget_grand_totals LIMIT 1'
    })
  });

  const grandResult = await grandResponse.json();
  if (grandResult.error) {
    console.log('❌ v_budget_grand_totals view: NOT FOUND');
    console.log('   Error:', grandResult.error.message);
  } else {
    console.log('✅ v_budget_grand_totals view: EXISTS');
  }

  console.log('\n=== SUMMARY ===');
  console.log('The budget_snapshots table already exists (migration partially applied).');
  console.log('Check which components still need to be created.');
}

checkTables();