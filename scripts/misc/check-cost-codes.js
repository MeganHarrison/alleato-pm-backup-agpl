import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCostCodes() {
  console.log('Checking cost_codes table...\n');

  const { data, error, count } = await supabase
    .from('cost_codes')
    .select('*', { count: 'exact' })
    .limit(10);

  if (error) {
    console.error('Error querying cost_codes:', error);
    return;
  }

  console.log(`Total cost codes: ${count}`);
  console.log('\nFirst 10 records:');
  console.log(JSON.stringify(data, null, 2));
}

checkCostCodes();
