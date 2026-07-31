const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  console.log('Creating project-files bucket...');

  const { data, error } = await supabase.storage.createBucket('project-files', {
    public: false,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: ['application/pdf']
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('✓ Bucket already exists');
    } else {
      console.error('✗ Error creating bucket:', error);
    }
  } else {
    console.log('✓ Bucket created successfully:', data);
  }

  // Verify it exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Error listing buckets:', listError);
  } else {
    const projectFiles = buckets.find(b => b.name === 'project-files');
    if (projectFiles) {
      console.log('✓ Verified: project-files bucket exists');
    } else {
      console.log('✗ Bucket creation may have failed');
    }
  }
})();
