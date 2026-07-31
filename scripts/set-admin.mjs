#!/usr/bin/env node
/**
 * Script to set super admin access for a user
 * Usage: node scripts/set-admin.mjs <email>
 * Example: node scripts/set-admin.mjs megan@megankharrison.com
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from frontend/.env.local
config({ path: resolve(process.cwd(), 'frontend/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in frontend/.env.local');
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error('❌ Error: Email address required');
  console.error('Usage: node scripts/set-admin.mjs <email>');
  console.error('Example: node scripts/set-admin.mjs megan@megankharrison.com');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setAdminAccess() {
  console.log(`\n🔍 Checking for user: ${email}\n`);

  // Check if user exists
  const { data: existingUser, error: fetchError } = await supabase
    .from('user_profiles')
    .select('id, email, is_admin')
    .eq('email', email)
    .maybeSingle();

  if (fetchError) {
    console.error('❌ Error fetching user:', fetchError.message);
    process.exit(1);
  }

  if (!existingUser) {
    console.error(`❌ User not found: ${email}`);
    console.error('Make sure the user has logged in at least once to create their profile.');
    process.exit(1);
  }

  console.log('📋 Current status:');
  console.log(`   Email: ${existingUser.email}`);
  console.log(`   Admin: ${existingUser.is_admin ? 'Yes ✅' : 'No ❌'}`);

  if (existingUser.is_admin) {
    console.log('\n✅ User is already a super admin!');
    return;
  }

  // Update user to admin
  console.log('\n🔧 Setting admin access...');
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ is_admin: true, updated_at: new Date().toISOString() })
    .eq('email', email);

  if (updateError) {
    console.error('❌ Error setting admin access:', updateError.message);
    process.exit(1);
  }

  console.log('✅ Admin access granted!');
  console.log('\n📋 Updated status:');
  console.log(`   Email: ${email}`);
  console.log(`   Admin: Yes ✅`);
  console.log('\n🎉 User can now access all projects without individual memberships!');
}

setAdminAccess().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
