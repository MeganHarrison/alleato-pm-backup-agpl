const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('Checking storage.objects policies...\n');

  const { data, error } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('schemaname', 'storage')
    .eq('tablename', 'objects');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Found', data.length, 'policies:');
    data.forEach((policy) => {
      console.log('\n- Policy:', policy.policyname);
      console.log('  Command:', policy.cmd);
      console.log('  Roles:', policy.roles);
    });

    const hasUploadPolicy = data.some(p => p.policyname.includes('upload') || p.policyname.includes('insert'));
    if (!hasUploadPolicy) {
      console.log('\n✗ NO UPLOAD POLICY FOUND! This is why uploads are failing.');
    }
  }
})();
