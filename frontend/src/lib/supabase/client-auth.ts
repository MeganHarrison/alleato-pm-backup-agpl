import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import type { Database } from "@/types/database.types";

/**
 * Creates a fresh Supabase client for authentication operations.
 * Unlike the singleton client, this creates a new instance each time
 * to ensure auth state is current.
 *
 * Use this for:
 * - Login/logout operations
 * - Password reset flows
 * - Session refresh operations
 *
 * For general data fetching, use the singleton client from client.ts
 */
export function createAuthClient(): SupabaseClient<Database> {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}