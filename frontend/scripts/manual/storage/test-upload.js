const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// First try with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Then try with anon key + auth
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  console.log('=== Testing Storage Upload ===\n');

  // Create a test file
  const testContent = '%PDF-1.4 test content';
  const testFile = new Blob([testContent], { type: 'application/pdf' });
  const testPath = `31/specifications/${Date.now()}_test.pdf`;

  // Test 1: Admin upload (should always work)
  console.log('Test 1: Admin upload');
  const { data: adminData, error: adminError } = await supabaseAdmin.storage
    .from('project-files')
    .upload(testPath, testFile, {
      cacheControl: '3600',
      upsert: false
    });

  if (adminError) {
    console.log('  ✗ Admin upload failed:', adminError.message);
  } else {
    console.log('  ✓ Admin upload succeeded');
    // Clean up
    await supabaseAdmin.storage.from('project-files').remove([testPath]);
  }

  // Test 2: Get auth state from test file
  console.log('\nTest 2: Authenticated user upload');
  try {
    const authState = JSON.parse(fs.readFileSync('tests/.auth/user.json', 'utf8'));
    const cookies = authState.cookies;
    const authCookie = cookies.find(c => c.name.includes('auth-token'));

    if (!authCookie) {
      console.log('  ✗ No auth cookie found in test file');
      return;
    }

    // Extract access token
    const tokenData = JSON.parse(decodeURIComponent(authCookie.value));
    const accessToken = tokenData.access_token || tokenData[0];

    console.log('  Found access token:', accessToken ? 'YES' : 'NO');

    // Set session
    const { data: sessionData, error: sessionError } = await supabaseAnon.auth.setSession({
      access_token: accessToken,
      refresh_token: tokenData.refresh_token || tokenData[1]
    });

    if (sessionError) {
      console.log('  ✗ Session error:', sessionError.message);
      return;
    }

    console.log('  Session set:', sessionData.session ? 'YES' : 'NO');
    console.log('  User ID:', sessionData.session?.user?.id);

    // Try upload
    const testPath2 = `31/specifications/${Date.now()}_test2.pdf`;
    const { data: userData, error: userError } = await supabaseAnon.storage
      .from('project-files')
      .upload(testPath2, testFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (userError) {
      console.log('  ✗ User upload failed:', userError.message);
      console.log('  Error details:', JSON.stringify(userError, null, 2));
    } else {
      console.log('  ✓ User upload succeeded');
      // Clean up
      await supabaseAnon.storage.from('project-files').remove([testPath2]);
    }
  } catch (err) {
    console.log('  ✗ Error:', err.message);
  }
})();
