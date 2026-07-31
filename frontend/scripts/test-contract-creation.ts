import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testContractCreation() {
  console.log('Testing contract creation...\n');

  // Get test project
  const { data: projects, error: projectsError } = await supabaseAdmin
    .from('projects')
    .select('id')
    .limit(1);

  if (projectsError) {
    console.error('Error fetching projects:', projectsError);
    return;
  }

  if (!projects || projects.length === 0) {
    console.error('No projects found');
    return;
  }

  const testProjectId = projects[0].id;
  console.log(`Using project ID: ${testProjectId}`);

  // Try to create a test contract
  const contractData = {
    project_id: testProjectId,
    contract_number: `PC-TEST-${Date.now()}`,
    title: 'Test Contract',
    original_contract_value: 100000,
    revised_contract_value: 100000,
    status: 'active',
  };

  console.log('\nAttempting to create contract with data:', contractData);

  const { data: contract, error: contractError } = await supabaseAdmin
    .from('prime_contracts')
    .insert(contractData)
    .select()
    .single();

  if (contractError) {
    console.error('\n❌ Error creating contract:', contractError);
    return;
  }

  if (!contract) {
    console.error('\n❌ No contract returned');
    return;
  }

  console.log('\n✓ Successfully created contract:');
  console.log(`  ID: ${contract.id}`);
  console.log(`  Number: ${contract.contract_number}`);
  console.log(`  Title: ${contract.title}`);

  // Clean up
  console.log('\nCleaning up...');
  const { error: deleteError } = await supabaseAdmin
    .from('prime_contracts')
    .delete()
    .eq('id', contract.id);

  if (deleteError) {
    console.error('Error deleting contract:', deleteError);
  } else {
    console.log('✓ Successfully deleted test contract');
  }
}

testContractCreation();
