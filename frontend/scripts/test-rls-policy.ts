import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function testRLSPolicy() {
  console.log('Testing RLS policy...\n');

  // Create admin client and regular client
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Authenticate as test user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'testpassword123',
  });

  if (authError) {
    console.error('❌ Auth error:', authError);
    return;
  }

  console.log('✓ Authenticated as:', authData.user.email);

  // Get first project
  const { data: projects } = await supabaseAdmin.from('projects').select('id').limit(1);
  if (!projects || projects.length === 0) {
    console.error('❌ No projects found');
    return;
  }

  const projectId = projects[0].id;
  console.log(`✓ Using project ID: ${projectId}\n`);

  // Create a contract using admin client (bypasses RLS)
  const contractNumber = `PC-RLS-TEST-${Date.now()}`;
  const { data: contract, error: createError } = await supabaseAdmin
    .from('prime_contracts')
    .insert({
      project_id: projectId,
      contract_number: contractNumber,
      title: 'RLS Test Contract',
      original_contract_value: 100000,
      revised_contract_value: 100000,
      status: 'active',
    })
    .select()
    .single();

  if (createError) {
    console.error('❌ Create error:', createError);
    return;
  }

  console.log(`✓ Created contract: ${contract.id}`);
  console.log(`  Number: ${contract.contract_number}\n`);

  // Try to fetch it as authenticated user (subject to RLS)
  console.log('Testing authenticated user access...');
  const { data: userContract, error: userError } = await supabase
    .from('prime_contracts')
    .select('*')
    .eq('id', contract.id)
    .eq('project_id', projectId)
    .single();

  if (userError) {
    console.error('❌ User query error:', userError);
    console.log('This means RLS is BLOCKING the user from seeing the contract\n');
  } else if (userContract) {
    console.log('✓ User CAN see the contract');
    console.log(`  Title: ${userContract.title}\n`);
  }

  // Check if user is a project member
  console.log('Checking project membership...');
  const { data: membership } = await supabaseAdmin
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', authData.user.id)
    .single();

  if (membership) {
    console.log('✓ User IS a project member');
    console.log(`  Access level: ${membership.access}\n`);
  } else {
    console.log('❌ User is NOT a project member\n');
    console.log('This is why RLS is blocking access!\n');
  }

  // Clean up
  await supabaseAdmin.from('prime_contracts').delete().eq('id', contract.id);
  console.log('✓ Cleaned up test contract');
}

testRLSPolicy();
