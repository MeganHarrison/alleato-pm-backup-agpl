import { createSupabaseAdminClient } from './supabase';

const TEST_EMAIL = "test1@mail.com";

async function debugUserAccess() {
  const supabase = createSupabaseAdminClient();

  console.log('=== DEBUG USER ACCESS ===');
  console.log(`Test email: ${TEST_EMAIL}`);

  // 1. Check if user exists in auth
  const { data: users } = await supabase.auth.admin.listUsers();
  const authUser = users?.users?.find(u => u.email === TEST_EMAIL);

  if (!authUser) {
    console.log('❌ User not found in auth');
    return;
  }

  console.log(`✅ Auth user found: ${authUser.id}`);

  // 2. Check if user has a users_auth link
  const { data: authLink } = await supabase
    .from('users_auth')
    .select('person_id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (!authLink) {
    console.log('❌ No users_auth link found');
    return;
  }

  console.log(`✅ Users_auth link found, person_id: ${authLink.person_id}`);

  // 3. Check project memberships
  const { data: memberships } = await supabase
    .from('project_directory_memberships')
    .select(`
      project_id,
      status,
      projects (
        id,
        name,
        archived
      )
    `)
    .eq('person_id', authLink.person_id);

  if (!memberships || memberships.length === 0) {
    console.log('❌ No project memberships found');
  } else {
    console.log(`✅ Found ${memberships.length} project memberships:`);
    memberships.forEach(m => {
      console.log(`  - Project ${m.project_id}: ${(m.projects as any)?.name} (status: ${m.status})`);
    });
  }

  // 4. Check user profile admin status
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', authUser.id)
    .maybeSingle();

  console.log(`Admin status: ${profile?.is_admin ? 'YES' : 'NO'}`);

  // 5. Check total projects in database
  const { count: totalProjects } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true });

  console.log(`Total projects in database: ${totalProjects}`);

  // 6. Try to get projects via the API logic
  let allowedProjectIds: number[] = [];
  const isAdmin = profile?.is_admin === true;

  if (!isAdmin && authLink?.person_id) {
    const { data: membershipProjects } = await supabase
      .from('project_directory_memberships')
      .select('project_id')
      .eq('person_id', authLink.person_id)
      .eq('status', 'active');

    allowedProjectIds = membershipProjects?.map(m => m.project_id) ?? [];
  }

  console.log(`Allowed project IDs for test user: [${allowedProjectIds.join(', ')}]`);

  // 7. Check which of the hardcoded test project IDs exist
  const testProjectIds = [47, 60, 67, 118, 123, 24105];
  const { data: existingProjects } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', testProjectIds);

  console.log(`Test project IDs that exist in database:`);
  if (existingProjects?.length) {
    existingProjects.forEach(p => {
      const hasAccess = isAdmin || allowedProjectIds.includes(p.id);
      console.log(`  - ${p.id}: ${p.name} (access: ${hasAccess ? 'YES' : 'NO'})`);
    });
  } else {
    console.log('  - None of the hardcoded test project IDs exist');
  }
}

debugUserAccess().catch(console.error);