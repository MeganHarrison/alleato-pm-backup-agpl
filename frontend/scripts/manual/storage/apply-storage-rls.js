const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = fs.readFileSync('../supabase/migrations/20260201000002_add_storage_rls_policies.sql', 'utf8');

(async () => {
  console.log('Applying storage RLS policies...\n');

  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;

    console.log(`Executing statement ${i + 1}/${statements.length}...`);

    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: statement + ';'
    }).catch(async () => {
      // If rpc doesn't exist, try direct query
      return await supabase.from('_').select('*').limit(0).then(() => {
        // Use pg admin if available
        return { data: null, error: new Error('Cannot execute SQL - need to use Supabase admin') };
      });
    });

    if (error) {
      console.error(`  ✗ Error:`, error.message);
      if (!error.message.includes('already exists') && !error.message.includes('does not exist')) {
        console.error('Full error:', error);
        process.exit(1);
      }
    } else {
      console.log(`  ✓ Success`);
    }
  }

  console.log('\n✓ All policies applied successfully');
})();
