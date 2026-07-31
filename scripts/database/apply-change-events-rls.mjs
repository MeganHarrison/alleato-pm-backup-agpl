#!/usr/bin/env node
/**
 * Apply Change Events RLS Policies to Supabase Database
 * This script manually applies the RLS migration that couldn't be pushed via CLI
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Read the migration file
const migrationPath = join(
  __dirname,
  '../supabase/migrations/20260110142750_add_change_events_rls.sql'
);

console.log('📖 Reading migration file...');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

console.log('🚀 Applying Change Events RLS Policies...\n');

// Split into individual statements
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

let successCount = 0;
let failCount = 0;

for (const [index, statement] of statements.entries()) {
  // Skip comments-only statements
  if (statement.match(/^--/) || statement.trim().length === 0) {
    continue;
  }

  const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
  console.log(`\n[${index + 1}/${statements.length}] ${preview}...`);

  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: statement + ';',
    });

    if (error) {
      if (
        error.message?.includes("Could not find the function") ||
        error.message?.includes("exec_sql")
      ) {
        console.error(
          "  ❌ Failed: exec_sql RPC is unavailable in this environment; apply the SQL file manually in Supabase SQL Editor.",
        );
      } else {
        console.error(`  ❌ Failed: ${error.message}`);
      }
      failCount++;
    } else {
      console.log('  ✅ Applied');
      successCount++;
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
    failCount++;
  }

  // Small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 100));
}

console.log('\n' + '='.repeat(60));
console.log(`✅ Success: ${successCount} statements`);
console.log(`❌ Failed: ${failCount} statements`);
console.log('='.repeat(60));

if (failCount > 0) {
  console.log('\n⚠️  Some statements failed.');
  console.log('This is normal if RPC exec_sql is not available.');
  console.log('Please apply the migration manually via Supabase SQL Editor:');
  console.log(`  File: ${migrationPath}`);
  process.exit(1);
}

console.log('\n✅ RLS Migration Complete!');
console.log('\nNext step: Mark migration as applied:');
console.log('  npx supabase migration repair --status applied 20260110142750');
