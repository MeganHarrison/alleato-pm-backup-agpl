import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client for use in tests.
 * Uses environment variables for configuration.
 */
export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-key";

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
    );
  }

  return createClient<Database>(supabaseUrl, supabaseKey);
}

/**
 * Creates a Supabase admin client for use in tests that need elevated permissions.
 * Uses the service role key for full database access.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase admin environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Helper to clean up test data in a transaction-like manner.
 * Wraps multiple delete operations and handles errors gracefully.
 */
export async function cleanupTestData(
  supabase: ReturnType<typeof createSupabaseClient>,
  operations: Array<() => Promise<any>>
) {
  const errors: Error[] = [];

  for (const operation of operations) {
    try {
      await operation();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  if (errors.length > 0) {
    console.warn("Some cleanup operations failed:", errors);
  }
}

/**
 * Helper to create test users with proper authentication setup.
 */
export async function createTestUser(
  email: string,
  password: string = "TestPassword123!"
) {
  const supabase = createSupabaseAdminClient();

  // Create auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    throw new Error(`Failed to create test user: ${authError.message}`);
  }

  return authUser.user;
}

/**
 * Helper to delete test users completely (auth + database records).
 */
export async function deleteTestUser(email: string) {
  const supabase = createSupabaseAdminClient();

  // First get the user ID from auth
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users?.find((u) => u.email === email);

  if (user) {
    // Delete from auth
    await supabase.auth.admin.deleteUser(user.id);
  }

  // Also delete from people table if exists
  await supabase.from("people").delete().eq("email", email);
}

/**
 * Helper to create a test project.
 */
export async function createTestProject(name: string) {
  const supabase = createSupabaseClient();
  const creationRunId = `playwright-supabase-helper:${crypto.randomUUID()}`;

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      status: "active",
      start_date: new Date().toISOString(),
      created_by: null,
      created_via: "automation",
      creation_request_id: null,
      creation_run_id: creationRunId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test project: ${error.message}`);
  }

  return data;
}

/**
 * Helper to delete a test project and all related data.
 */
export async function deleteTestProject(projectId: number) {
  const supabase = createSupabaseAdminClient();

  // Delete in reverse order of foreign key dependencies
  const tables = [
    "project_directory_memberships",
    "distribution_groups",
    "project_companies",
    "projects",
  ];

  for (const table of tables) {
    await supabase.from(table).delete().eq("project_id", projectId);
  }
}
