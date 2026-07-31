/**
 * Test Data Cleanup System
 *
 * Automatically removes test data created during form testing.
 * Ensures database remains clean after test runs.
 *
 * @module test-data-cleanup
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Test data record for cleanup tracking
 */
export interface TestDataRecord {
  type: string;
  id: string;
  tableName?: string;
}

/**
 * Cleanup result
 */
export interface CleanupResult {
  success: boolean;
  cleaned: number;
  failed: number;
  errors: string[];
}

/**
 * Get Supabase client with service role for cleanup operations
 *
 * @returns Supabase client with admin privileges
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is not set');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Map form type to database table name
 *
 * @param formType - Type of form (e.g., "Create Project")
 * @returns Database table name
 */
function getTableName(formType: string): string {
  const tableMap: Record<string, string> = {
    'Create Project': 'projects',
    'Create Prime Contract': 'contracts',
    'Edit Contract': 'contracts',
    'Invoice Form': 'invoices',
    'Purchase Order Form': 'purchase_orders',
    'Subcontract Form': 'subcontracts',
    'RFI Form': 'rfis',
    'ClientFormDialog': 'clients',
    'ContactFormDialog': 'contacts',
    'CompanyFormDialog': 'companies',
    'UserFormDialog': 'users',
    'BulkAddUsersDialog': 'users',
    'DistributionGroupFormDialog': 'distribution_groups',
    'BudgetLineItemModal': 'budget_lines',
    'BudgetLineItemModalAnimated': 'budget_lines',
    'BudgetModificationModal': 'budget_modifications',
    'OriginalBudgetEditModal': 'budgets',
    'DocumentMetadataModal': 'documents',
    'EditMeetingModal': 'meetings',
    'ChangeEventForm': 'change_events',
    'EditProjectDialog': 'projects',
    'InlineTeamMemberForm': 'project_members',
    'BudgetLineItemForm': 'budget_lines'
  };

  return tableMap[formType] || 'unknown';
}

/**
 * Clean up test data from database
 *
 * Called after each test suite completes.
 * Deletes records created during testing.
 *
 * @param records - Array of test data records to clean up
 * @returns Cleanup result with statistics
 */
export async function cleanupTestData(records: TestDataRecord[]): Promise<CleanupResult> {
  const supabase = getSupabaseClient();
  const errors: string[] = [];
  let cleaned = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const tableName = record.tableName || getTableName(record.type);

      if (tableName === 'unknown') {
        console.warn(`No cleanup handler for form type: ${record.type}`);
        errors.push(`Unknown form type: ${record.type}`);
        failed++;
        continue;
      }

      // Delete record from database
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', record.id);

      if (error) {
        console.error(`Failed to cleanup ${record.type} ${record.id}:`, error);
        errors.push(`Failed to delete ${record.type} (${record.id}): ${error.message}`);
        failed++;
      } else {
        console.log(`✓ Cleaned up ${record.type} (${record.id})`);
        cleaned++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error cleaning up ${record.type} ${record.id}:`, errorMessage);
      errors.push(`Exception during cleanup of ${record.type}: ${errorMessage}`);
      failed++;
    }
  }

  return {
    success: failed === 0,
    cleaned,
    failed,
    errors
  };
}

/**
 * Generate test data prefix for identification
 *
 * Adds prefix to names so they're identifiable in database.
 * Format: E2E_TEST_[timestamp]_
 *
 * @returns Test data prefix string
 */
export function generateTestDataPrefix(): string {
  return `E2E_TEST_${Date.now()}_`;
}

/**
 * Generate unique test email
 *
 * Creates unique email address for test users.
 * Format: e2e-test-[timestamp]@example.com
 *
 * @returns Test email address
 */
export function generateTestEmail(): string {
  return `e2e-test-${Date.now()}@example.com`;
}

/**
 * Generate unique test name
 *
 * Creates unique name with test prefix.
 *
 * @param baseName - Base name (e.g., "Project", "Contact")
 * @returns Unique test name
 */
export function generateTestName(baseName: string): string {
  return `${generateTestDataPrefix()}${baseName}`;
}

/**
 * Clean up orphaned test data
 *
 * Removes any test data older than specified hours.
 * Safety net for tests that didn't clean up properly.
 *
 * @param maxAgeHours - Maximum age in hours (default: 24)
 * @returns Cleanup result with statistics
 */
export async function cleanupOrphanedTestData(maxAgeHours: number = 24): Promise<CleanupResult> {
  const supabase = getSupabaseClient();
  const errors: string[] = [];
  let cleaned = 0;
  let failed = 0;

  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);
  const cutoffIso = cutoffDate.toISOString();

  // Tables that may contain test data
  const tables = [
    'projects',
    'contracts',
    'invoices',
    'purchase_orders',
    'subcontracts',
    'rfis',
    'clients',
    'contacts',
    'companies',
    'users',
    'distribution_groups',
    'budget_lines',
    'budget_modifications',
    'documents',
    'meetings',
    'change_events',
    'project_members'
  ];

  console.log(`\n🧹 Cleaning up orphaned test data older than ${maxAgeHours} hours (before ${cutoffIso})...\n`);

  for (const table of tables) {
    try {
      // Try to delete test records by name pattern
      const { data, error } = await supabase
        .from(table)
        .delete()
        .like('name', 'E2E_TEST_%')
        .lt('created_at', cutoffIso)
        .select('id');

      if (error) {
        // Table might not have 'name' or 'created_at' column
        if (error.message.includes('column') || error.message.includes('does not exist')) {
          console.log(`  ⊘ Skipping ${table} (no name/created_at column)`);
          continue;
        }

        console.error(`  ✗ Failed to cleanup ${table}:`, error.message);
        errors.push(`Failed to cleanup ${table}: ${error.message}`);
        failed++;
      } else {
        const count = data?.length || 0;
        if (count > 0) {
          console.log(`  ✓ Cleaned ${count} orphaned records from ${table}`);
          cleaned += count;
        } else {
          console.log(`  ○ No orphaned records in ${table}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Error cleaning ${table}:`, errorMessage);
      errors.push(`Exception during cleanup of ${table}: ${errorMessage}`);
      failed++;
    }
  }

  console.log(`\n✓ Orphan cleanup complete: ${cleaned} cleaned, ${failed} failed\n`);

  return {
    success: failed === 0,
    cleaned,
    failed,
    errors
  };
}

/**
 * Clean up test data by name pattern
 *
 * Removes all records matching the test data pattern.
 * Useful for bulk cleanup after test runs.
 *
 * @param pattern - Name pattern to match (default: 'E2E_TEST_%')
 * @returns Cleanup result with statistics
 */
export async function cleanupTestDataByPattern(pattern: string = 'E2E_TEST_%'): Promise<CleanupResult> {
  const supabase = getSupabaseClient();
  const errors: string[] = [];
  let cleaned = 0;
  let failed = 0;

  const tables = [
    'projects',
    'contracts',
    'invoices',
    'purchase_orders',
    'subcontracts',
    'rfis',
    'clients',
    'contacts',
    'companies',
    'users',
    'distribution_groups',
    'budget_lines',
    'budget_modifications',
    'documents',
    'meetings',
    'change_events',
    'project_members'
  ];

  console.log(`\n🧹 Cleaning up test data matching pattern: ${pattern}...\n`);

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .delete()
        .like('name', pattern)
        .select('id');

      if (error) {
        if (error.message.includes('column') || error.message.includes('does not exist')) {
          continue;
        }

        console.error(`  ✗ Failed to cleanup ${table}:`, error.message);
        errors.push(`Failed to cleanup ${table}: ${error.message}`);
        failed++;
      } else {
        const count = data?.length || 0;
        if (count > 0) {
          console.log(`  ✓ Cleaned ${count} records from ${table}`);
          cleaned += count;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Error cleaning ${table}:`, errorMessage);
      errors.push(`Exception during cleanup of ${table}: ${errorMessage}`);
      failed++;
    }
  }

  console.log(`\n✓ Pattern cleanup complete: ${cleaned} cleaned, ${failed} failed\n`);

  return {
    success: failed === 0,
    cleaned,
    failed,
    errors
  };
}

/**
 * Verify cleanup was successful
 *
 * Checks if test data records still exist in database.
 *
 * @param records - Array of test data records to verify
 * @returns True if all records were successfully deleted
 */
export async function verifyCleanup(records: TestDataRecord[]): Promise<boolean> {
  const supabase = getSupabaseClient();

  for (const record of records) {
    try {
      const tableName = record.tableName || getTableName(record.type);

      if (tableName === 'unknown') {
        continue;
      }

      const { data, error } = await supabase
        .from(tableName)
        .select('id')
        .eq('id', record.id)
        .single();

      if (data && !error) {
        console.error(`✗ Record still exists: ${record.type} (${record.id})`);
        return false;
      }
    } catch (error) {
      // Error likely means record doesn't exist, which is good
      continue;
    }
  }

  return true;
}
