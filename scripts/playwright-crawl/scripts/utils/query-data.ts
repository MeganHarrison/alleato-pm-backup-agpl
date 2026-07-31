#!/usr/bin/env npx ts-node
/**
 * CLI for querying Procore screenshot data in Supabase
 * 
 * Usage:
 *   npx ts-node scripts/query-data.ts modules       - List all modules
 *   npx ts-node scripts/query-data.ts progress      - Show capture progress
 *   npx ts-node scripts/query-data.ts estimate      - Show rebuild estimate
 *   npx ts-node scripts/query-data.ts screenshots   - List recent screenshots
 *   npx ts-node scripts/query-data.ts components    - Show component stats
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
);

async function listModules() {
  const { data, error } = await supabase
    .from('procore_modules')
    .select('*')
    .order('category')
    .order('priority');

  if (error) throw error;

  console.log('\n📦 PROCORE MODULES\n');
  console.log('─'.repeat(100));
  
  let currentCategory = '';
  for (const module of data) {
    if (module.category !== currentCategory) {
      currentCategory = module.category;
      console.log(`\n${currentCategory.toUpperCase()}`);
      console.log('─'.repeat(50));
    }
    
    const priorityIcons: Record<string, string> = {
      must_have: '🟢',
      nice_to_have: '🟡',
      skip: '⚪',
    };
    const priorityIcon = priorityIcons[module.priority] || '⚪';
    
    console.log(
      `  ${priorityIcon} ${module.display_name.padEnd(25)} ` +
      `${module.complexity?.padEnd(12) || ''.padEnd(12)} ` +
      `${module.estimated_build_weeks || '?'} weeks`
    );
  }
  
  console.log('\n');
}

async function showProgress() {
  const { data, error } = await supabase
    .from('procore_capture_summary')
    .select('*');

  if (error) throw error;

  console.log('\n📊 CAPTURE PROGRESS\n');
  console.log('─'.repeat(80));
  console.log(
    'Category'.padEnd(20) +
    'Module'.padEnd(25) +
    'Priority'.padEnd(12) +
    'Screenshots'.padEnd(12) +
    'Last Captured'
  );
  console.log('─'.repeat(80));

  for (const row of data || []) {
    const lastCaptured = row.last_captured 
      ? new Date(row.last_captured).toLocaleDateString()
      : 'Never';
    
    console.log(
      `${row.category?.padEnd(20) || ''.padEnd(20)}` +
      `${row.display_name?.padEnd(25) || ''.padEnd(25)}` +
      `${row.priority?.padEnd(12) || ''.padEnd(12)}` +
      `${String(row.screenshot_count || 0).padEnd(12)}` +
      `${lastCaptured}`
    );
  }
  
  console.log('\n');
}

async function showEstimate() {
  const { data, error } = await supabase
    .from('procore_rebuild_estimate')
    .select('*');

  if (error) throw error;

  console.log('\n📐 REBUILD ESTIMATE\n');
  console.log('─'.repeat(70));
  console.log(
    'Category'.padEnd(25) +
    'Modules'.padEnd(10) +
    'Must-Have'.padEnd(12) +
    'Nice-to-Have'.padEnd(14) +
    'Total Weeks'
  );
  console.log('─'.repeat(70));

  let totalMustHave = 0;
  let totalNiceToHave = 0;
  let totalWeeks = 0;

  for (const row of data || []) {
    console.log(
      `${row.category.padEnd(25)}` +
      `${String(row.module_count).padEnd(10)}` +
      `${String(row.must_have_weeks || 0).padEnd(12)}` +
      `${String(row.nice_to_have_weeks || 0).padEnd(14)}` +
      `${row.total_weeks || 0}`
    );
    
    totalMustHave += row.must_have_weeks || 0;
    totalNiceToHave += row.nice_to_have_weeks || 0;
    totalWeeks += row.total_weeks || 0;
  }

  console.log('─'.repeat(70));
  console.log(
    'TOTAL'.padEnd(25) +
    ''.padEnd(10) +
    `${totalMustHave}`.padEnd(12) +
    `${totalNiceToHave}`.padEnd(14) +
    `${totalWeeks}`
  );
  
  console.log('\n📌 RECOMMENDATIONS:');
  console.log(`   MVP (Must-Have only): ~${totalMustHave} weeks`);
  console.log(`   With 2 developers: ~${Math.ceil(totalMustHave / 1.5)} weeks`);
  console.log(`   Full rebuild: ~${totalWeeks} weeks`);
  console.log('\n');
}

async function listScreenshots() {
  const { data, error } = await supabase
    .from('procore_screenshots')
    .select('id, name, category, source_url, captured_at, file_size_bytes')
    .order('captured_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  console.log('\n📸 RECENT SCREENSHOTS\n');
  console.log('─'.repeat(100));

  for (const screenshot of data || []) {
    const size = screenshot.file_size_bytes 
      ? `${(screenshot.file_size_bytes / 1024).toFixed(1)} KB`
      : 'N/A';
    const date = new Date(screenshot.captured_at).toLocaleString();
    
    console.log(`  ${screenshot.category}/${screenshot.name}`);
    console.log(`    Size: ${size} | Captured: ${date}`);
    console.log(`    URL: ${screenshot.source_url}`);
    console.log('');
  }
}

async function componentStats() {
  const { data, error } = await supabase
    .from('procore_components')
    .select('component_type');

  if (error) throw error;

  // Count by type
  const counts: Record<string, number> = {};
  for (const component of data || []) {
    counts[component.component_type] = (counts[component.component_type] || 0) + 1;
  }

  console.log('\n🧩 COMPONENT STATISTICS\n');
  console.log('─'.repeat(40));
  console.log('Component Type'.padEnd(20) + 'Count');
  console.log('─'.repeat(40));

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sorted) {
    console.log(`${type.padEnd(20)}${count}`);
  }
  
  console.log('─'.repeat(40));
  console.log(`${'TOTAL'.padEnd(20)}${data?.length || 0}`);
  console.log('\n');
}

async function main() {
  const command = process.argv[2];

  if (!process.env.SUPABASE_URL) {
    console.error('❌ SUPABASE_URL environment variable not set');
    process.exit(1);
  }

  switch (command) {
    case 'modules':
      await listModules();
      break;
    case 'progress':
      await showProgress();
      break;
    case 'estimate':
      await showEstimate();
      break;
    case 'screenshots':
      await listScreenshots();
      break;
    case 'components':
      await componentStats();
      break;
    default:
      console.log(`
Procore Screenshot Data CLI

Usage:
  npx ts-node scripts/query-data.ts <command>

Commands:
  modules      List all Procore modules with complexity/priority
  progress     Show capture progress by module
  estimate     Show rebuild effort estimate
  screenshots  List recent screenshots
  components   Show detected component statistics
      `);
  }
}

main().catch(console.error);
