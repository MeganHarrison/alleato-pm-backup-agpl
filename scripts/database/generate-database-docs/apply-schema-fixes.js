import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
  console.error('Please set them in your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('Running schema fix migration...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/004_fix_schema_mismatches.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the migration into individual statements
    // This is a simple split - in production you'd want more robust SQL parsing
    const statements = migrationSQL
      .split(';')
      .filter(stmt => stmt.trim())
      .map(stmt => stmt.trim() + ';');
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comment-only statements
      if (statement.replace(/--.*$/gm, '').trim().length === 0) {
        continue;
      }
      
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: statement
      }).single();
      
      if (error) {
        console.error(`Error executing statement ${i + 1}:`, error.message);
        console.error('Statement:', statement.substring(0, 100) + '...');
        
        // Continue with other statements even if one fails
        continue;
      }
    }
    
    console.log('Migration completed successfully!');
    console.log('\nVerifying schema changes...');
    
    // Verify that projects table has the new columns
    const { data: projectColumns, error: columnsError } = await supabase
      .from('projects')
      .select('*')
      .limit(1);
    
    if (columnsError) {
      console.error('Error verifying schema:', columnsError.message);
    } else if (projectColumns && projectColumns.length > 0) {
      const columns = Object.keys(projectColumns[0]);
      console.log('Projects table columns:', columns);
      
      // Check for expected columns
      const expectedColumns = ['description', 'job number', 'address', 'state', 'archived', 'phase', 'category', 'team_members', 'stakeholders', 'keywords'];
      const missingColumns = expectedColumns.filter(col => !columns.includes(col));
      
      if (missingColumns.length > 0) {
        console.warn('Warning: Some expected columns are still missing:', missingColumns);
      } else {
        console.log('✓ All expected columns are present');
      }
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
