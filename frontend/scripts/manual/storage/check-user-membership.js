const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.info('Checking test user project membership...\n');

  // Get test user from auth state
  const authState = JSON.parse(fs.readFileSync('tests/.auth/user.json', 'utf8'));

  // Extract user ID from cookie
  const authCookie = authState.cookies.find(c => c.name.includes('auth-token'));
  if (!authCookie) {
    console.error('ERROR: No auth token cookie found');
    return;
  }

  // Decode the base64 token
  const tokenValue = authCookie.value.replace('base64-', '');
  const decoded = JSON.parse(Buffer.from(tokenValue, 'base64').toString('utf-8'));
  const userId = decoded.user?.id;

  if (!userId) {
    console.error('ERROR: Could not extract user ID from token');
    return;
  }

  console.info('OK: Found user ID:', userId);
  console.info('  Email:', decoded.user.email);

  // Check if user has person record
  const { data: person, error: personError } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .eq('auth_user_id', userId)
    .single();

  if (personError) {
    console.error('ERROR: No person record found for user:', personError.message);
    console.error('\nCRITICAL: Test user needs a person record');
    return;
  }

  console.info('OK: Person record found:', person.first_name, person.last_name);
  console.info('  Person ID:', person.id);

  // Check project memberships
  const { data: memberships, error: memberError } = await supabase
    .from('project_directory_memberships')
    .select('project_id, projects(name)')
    .eq('person_id', person.id);

  if (memberError) {
    console.error('ERROR: Error checking memberships:', memberError.message);
    return;
  }

  console.info('\nProject memberships:');
  if (memberships.length === 0) {
    console.error('  ERROR: NO PROJECT MEMBERSHIPS FOUND');
    console.error('  CRITICAL: This is why uploads fail. User has no project access.');
  } else {
    memberships.forEach(m => {
      console.info(`  - Project ${m.project_id}: ${m.projects?.name || 'Unknown'}`);
    });

    const hasProject31 = memberships.some(m => m.project_id === 31);
    if (hasProject31) {
      console.info('\nOK: User HAS access to project 31');
    } else {
      console.error('\nERROR: User DOES NOT have access to project 31');
      console.error('  CRITICAL: This is why uploads to project 31 fail');
      console.error('  Even with RLS policies, uploads need project membership.');
    }
  }
})();
