#!/usr/bin/env ts-node

/**
 * Cleanup Orphaned Test Data Script
 *
 * Removes test data older than specified hours from the database.
 * Safety net for tests that didn't clean up properly.
 *
 * Usage:
 *   npx ts-node frontend/tests/helpers/cleanup-orphaned-data.ts
 *   npx ts-node frontend/tests/helpers/cleanup-orphaned-data.ts --max-age 48
 */

import { cleanupOrphanedTestData } from './test-data-cleanup';

/**
 * Parse command line arguments
 */
function parseArgs(): { maxAgeHours: number } {
  const args = process.argv.slice(2);
  let maxAgeHours = 24; // Default: 24 hours

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-age' && args[i + 1]) {
      maxAgeHours = parseInt(args[i + 1], 10);
      if (isNaN(maxAgeHours) || maxAgeHours < 1) {
        console.error('Error: --max-age must be a positive number');
        process.exit(1);
      }
    }
  }

  return { maxAgeHours };
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🧹 Orphaned Test Data Cleanup\n');

  const { maxAgeHours } = parseArgs();

  console.log(`Configuration:`);
  console.log(`  Max Age: ${maxAgeHours} hours`);
  console.log(`  Pattern: E2E_TEST_%`);
  console.log(`  Database: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);

  // Verify environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL not set');
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not set');
    process.exit(1);
  }

  try {
    const result = await cleanupOrphanedTestData(maxAgeHours);

    if (result.success) {
      console.log(`\n✅ Cleanup complete!`);
      console.log(`   Records cleaned: ${result.cleaned}`);
      console.log(`   Failed: ${result.failed}`);
      process.exit(0);
    } else {
      console.error(`\n⚠️  Cleanup completed with errors`);
      console.error(`   Records cleaned: ${result.cleaned}`);
      console.error(`   Failed: ${result.failed}`);
      console.error(`   Errors: ${result.errors.join(', ')}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Cleanup failed with exception:`);
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main };
