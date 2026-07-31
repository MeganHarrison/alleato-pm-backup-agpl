import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function updateTestUserPermissions() {
  const testUserId = 'd995c8a8-d839-498a-8d32-4affa72f2dc5';
  const projectId = 118;

  console.log('Updating test user permissions...');
  console.log(`User: ${testUserId}`);
  console.log(`Project: ${projectId}`);

  // Check if user is already a member
  const { data: existingMember, error: checkError } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', testUserId);

  if (checkError) {
    console.error('Error checking membership:', checkError);
    return;
  }

  console.log(`Existing membership:`, existingMember);

  if (existingMember && existingMember.length > 0) {
    // Update existing membership
    console.log(`Current access: ${existingMember[0].access}`);

    const { data, error } = await supabase
      .from('project_members')
      .update({ access: 'admin' })
      .eq('project_id', projectId)
      .eq('user_id', testUserId)
      .select();

    if (error) {
      console.error('Error updating permissions:', error);
      return;
    }

    console.log('✓ Successfully updated to admin access');
    console.log('Updated record:', data);
  } else {
    // Create new membership
    console.log('User is not a member. Creating new membership with admin access...');

    const { data, error } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: testUserId,
        access: 'admin',
      })
      .select();

    if (error) {
      console.error('Error creating membership:', error);
      return;
    }

    console.log('✓ Successfully created admin membership');
    console.log('Created record:', data);
  }
}

updateTestUserPermissions();
