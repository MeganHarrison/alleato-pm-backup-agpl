import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'present' : 'missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'present' : 'missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const userId = '6ae4299f-6c21-4e99-b6a1-ccb1fe5aa7f6';
const projectId = 60;

console.log(`Adding user ${userId} to project ${projectId}...`);

const { data, error } = await supabase
  .from('project_members')
  .upsert({
    project_id: projectId,
    user_id: userId,
    access: 'admin',
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'project_id,user_id'
  })
  .select();

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log('✅ Success! User added to project:', data);
