import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkTestContracts() {
  console.log('Checking for test contracts...\n');

  // Check for test contracts
  const { data: contracts, error } = await supabase
    .from('prime_contracts')
    .select('id, contract_number, title, project_id, status, created_at')
    .like('contract_number', 'PC-CO-TEST%')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching contracts:', error);
    return;
  }

  console.log(`Found ${contracts?.length ?? 0} test contracts:`);
  contracts?.forEach(contract => {
    console.log(`- ID: ${contract.id}`);
    console.log(`  Number: ${contract.contract_number}`);
    console.log(`  Title: ${contract.title}`);
    console.log(`  Project: ${contract.project_id}`);
    console.log(`  Status: ${contract.status}`);
    console.log(`  Created: ${contract.created_at}\n`);
  });
}

checkTestContracts();
