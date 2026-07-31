import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import type { Database } from "@/types/database.types";

let client: SupabaseClient<Database> | undefined;

/**
 * Creates a singleton Supabase client for browser environments.
 * This prevents memory leaks by reusing the same client instance.
 *
 * @returns The Supabase client instance
 */
export function createClient(): SupabaseClient<Database> {
  if (!client) {
    const { url, anonKey } = getSupabaseConfig();
    client = createBrowserClient<Database>(url, anonKey);
  }
  return client;
}

/**
 * Force reset the client instance.
 * Useful for testing or when auth state needs to be completely reset.
 */
export function resetClient(): void {
  client = undefined;
}
