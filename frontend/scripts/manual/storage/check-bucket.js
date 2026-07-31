const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error:', error);
  } else {
    const projectFiles = data.find(b => b.name === 'project-files');
    if (projectFiles) {
      console.log('✓ project-files bucket EXISTS');
      console.log('  Public:', projectFiles.public);
      console.log('  ID:', projectFiles.id);
    } else {
      console.log('✗ project-files bucket NOT FOUND');
      console.log('Available buckets:', data.map(b => b.name).join(', '));
    }
  }
})();
