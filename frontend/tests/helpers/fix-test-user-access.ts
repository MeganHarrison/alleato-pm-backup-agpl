import { createSupabaseAdminClient } from './supabase';

const TEST_EMAIL = "test1@mail.com";
const TEST_PROJECT_IDS = [47, 60, 67, 118, 123, 24105]; // Common test project IDs

async function fixTestUserAccess() {
  const supabase = createSupabaseAdminClient();

  console.log('=== FIXING TEST USER ACCESS ===');

  // 1. Get the test user
  const { data: users } = await supabase.auth.admin.listUsers();
  const authUser = users?.users?.find(u => u.email === TEST_EMAIL);

  if (!authUser) {
    console.log('❌ User not found in auth');
    return;
  }

  console.log(`✅ Found auth user: ${authUser.id}`);

  // 2. Get their person_id
  const { data: authLink } = await supabase
    .from('users_auth')
    .select('person_id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (!authLink) {
    console.log('❌ No users_auth link found');
    return;
  }

  const personId = authLink.person_id;
  console.log(`✅ Person ID: ${personId}`);

  // 3. Check which test projects exist
  const { data: existingProjects } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', TEST_PROJECT_IDS);

  if (!existingProjects?.length) {
    console.log('❌ No test projects found');
    return;
  }

  console.log(`Found ${existingProjects.length} test projects:`);
  existingProjects.forEach(p => console.log(`  - ${p.id}: ${p.name}`));

  // 4. Check existing memberships
  const { data: existingMemberships } = await supabase
    .from('project_directory_memberships')
    .select('project_id')
    .eq('person_id', personId)
    .in('project_id', existingProjects.map(p => p.id));

  const existingProjectIds = existingMemberships?.map(m => m.project_id) || [];
  console.log(`Existing memberships: [${existingProjectIds.join(', ')}]`);

  // 5. Add memberships for missing projects
  const missingProjectIds = existingProjects
    .map(p => p.id)
    .filter(id => !existingProjectIds.includes(id));

  if (missingProjectIds.length === 0) {
    console.log('✅ User already has access to all test projects');
    return;
  }

  console.log(`Adding memberships for projects: [${missingProjectIds.join(', ')}]`);

  // Create memberships for missing projects
  const membershipsToCreate = missingProjectIds.map(projectId => ({
    project_id: projectId,
    person_id: personId,
    status: 'active',
    role: 'Project Manager', // Give them a role that should have full access
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: membershipError } = await supabase
    .from('project_directory_memberships')
    .insert(membershipsToCreate);

  if (membershipError) {
    console.log(`❌ Failed to add memberships: ${membershipError.message}`);
    return;
  }

  console.log(`✅ Added ${missingProjectIds.length} new project memberships`);

  // 6. Verify the fix
  const { data: finalMemberships } = await supabase
    .from('project_directory_memberships')
    .select(`
      project_id,
      status,
      projects (
        id,
        name
      )
    `)
    .eq('person_id', personId)
    .in('project_id', existingProjects.map(p => p.id));

  console.log('Final memberships:');
  finalMemberships?.forEach(m => {
    console.log(`  ✅ Project ${m.project_id}: ${(m.projects as any)?.name} (status: ${m.status})`);
  });

  console.log('\n🎉 Test user access has been fixed!');
}

fixTestUserAccess().catch(console.error);