import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

interface DevRpcClient {
  rpc: (
    fn: string,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Dev-only RPC helpers for RPCs that exist in the database but are not part of
 * the generated Database types. These RPCs typically require admin role and/or
 * are used for schema introspection on dev/admin pages.
 *
 * NOTE: The `as unknown as DevRpcClient` cast here is the one place in
 * this codebase where bypassing the generated RPC types is acceptable. The RPC
 * genuinely exists in the database but is not present in
 * `frontend/src/types/database.types.ts` (likely due to permissions at
 * generation time). If/when `get_public_tables` is added to the generated
 * types, this helper can be simplified to drop the cast.
 */

export interface GetPublicTablesRow {
  table_name: string;
}

export async function getPublicTables(
  supabase: SupabaseClient<Database>,
): Promise<GetPublicTablesRow[]> {
  // Safe cast: get_public_tables RPC exists in the database but is not in the
  // generated Database types. Any consumer that depends on the return shape
  // must validate the returned rows match GetPublicTablesRow.
  const untypedClient = supabase as unknown as DevRpcClient;
  const { data, error } = await untypedClient.rpc("get_public_tables");
  if (error) {
    throw new Error(`get_public_tables RPC failed: ${error.message}`);
  }
  if (!Array.isArray(data)) return [];
  return (data as Array<{ table_name?: unknown }>)
    .map((row) => ({ table_name: typeof row?.table_name === "string" ? row.table_name : "" }))
    .filter((row) => row.table_name.length > 0);
}
