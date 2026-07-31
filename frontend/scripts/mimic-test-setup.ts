import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function mimicTestSetup() {
  console.log('Mimicking test setup...\n');

  // Initialize clients
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Authenticate
  console.log('1. Authenticating...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'testpassword123',
  });

  if (authError) {
    console.error('❌ Auth error:', authError);
    return;
  }

  console.log('✓ Authenticated');
  console.log(`User ID: ${authData.user?.id}`);
  console.log(`Session: ${authData.session?.access_token.substring(0, 20)}...`);

  // Get test project
  console.log('\n2. Getting test project...');
  const { data: projects, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id')
    .limit(1);

  if (projectError) {
    console.error('❌ Project error:', projectError);
    return;
  }

  if (!projects || projects.length === 0) {
    console.error('❌ No projects found');
    return;
  }

  const testProjectId = projects[0].id;
  console.log(`✓ Got project ID: ${testProjectId}`);

  // Create test contract
  console.log('\n3. Creating test contract...');
  const contractData = {
    project_id: testProjectId,
    contract_number: `PC-MIMIC-${Date.now()}`,
    title: 'Test Contract from Mimic Script',
    original_contract_value: 100000,
    revised_contract_value: 100000,
    status: 'active',
  };

  console.log('Contract data:', contractData);

  const { data: contract, error: contractError } = await supabaseAdmin
    .from('prime_contracts')
    .insert(contractData)
    .select()
    .single();

  if (contractError) {
    console.error('❌ Contract error:', contractError);
    return;
  }

  if (!contract) {
    console.error('❌ No contract returned');
    return;
  }

  console.log('✓ Created contract:');
  console.log(`ID: ${contract.id}`);
  console.log(`Number: ${contract.contract_number}`);

  // Try to fetch it via API
  console.log('\n4. Testing API access...');
  const apiUrl = `http://localhost:3000/api/projects/${testProjectId}/contracts/${contract.id}`;
  console.log(`URL: ${apiUrl}`);

  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${authData.session?.access_token}`,
    },
  });

  console.log(`Status: ${response.status}`);

  if (response.ok) {
    const data = await response.json();
    console.log('✓ API returned:', data);
  } else {
    const text = await response.text();
    console.error('❌ API error:', text.substring(0, 200));
  }

  // Clean up
  console.log('\n5. Cleaning up...');
  await supabaseAdmin
    .from('prime_contracts')
    .delete()
    .eq('id', contract.id);

  console.log('✓ Done!');
}

mimicTestSetup();
