import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PostgrestClientOptions,
  PostgrestQueryBuilder,
} from "@supabase/postgrest-js";
import type { Database } from "@/types/database.types";
import type { Database as RagDatabase } from "@/types/rag-database.types";
import { createRagServiceClient, createServiceClient } from "./service";

/**
 * Service data router — the one module that owns "for this table, which Supabase
 * project, which service-role client, and which generated-types generic?".
 *
 * Use `serviceDb.from(table)` instead of picking `createServiceClient()` (PM APP)
 * vs `createRagServiceClient()` (AI Database) by hand. The router selects the
 * client AND calls `.from()` itself, returning the native Supabase query builder
 * already bound to the right project — so the table you route on IS the table you
 * query, and querying the wrong project is unrepresentable. The same map drives
 * the return type, so a builder can no longer be typed for the wrong project.
 *
 * Scope: the **service-role** surface only. The AI Database is reached exclusively
 * via service-role (there is no anon/cookie RAG client), so RLS cookie/browser
 * paths are always PM APP, already correct, and are NOT routed here — keep using
 * `@/lib/supabase/server` and `@/lib/supabase/client` for those.
 *
 * See CONTEXT.md → "Data access / Supabase project routing".
 */

/** Every table key that physically lives in the AI Database (RAG project). */
export type RagTableName = keyof RagDatabase["public"]["Tables"];
type PmTableName = keyof Database["public"]["Tables"] & string;
type PmSchema = Database["public"];
type RagSchema = RagDatabase["public"];

type PmQueryBuilder<T extends PmTableName> = PostgrestQueryBuilder<
  PostgrestClientOptions,
  PmSchema,
  PmSchema["Tables"][T],
  T
>;

type RagQueryBuilder<T extends RagTableName> = PostgrestQueryBuilder<
  PostgrestClientOptions,
  RagSchema,
  RagSchema["Tables"][T],
  T
>;

/**
 * The RAG table registry — the single source of truth for which tables live in
 * the AI Database. Replaces the scattered copies (the `KNOWN_EXTERNAL_TABLES`
 * lint array, the `CLAUDE.md` rule-of-thumb prose, and developer memory).
 *
 * `satisfies readonly RagTableName[]` rejects any typo or table that is not in
 * the AI-DB generated types. The `_registryIsComplete` check below rejects any
 * AI-DB table that is MISSING from this list. Together they pin the registry to
 * `RagDatabase["public"]["Tables"]` exactly, so regenerating the RAG types breaks
 * the build until the registry is updated.
 */
export const RAG_TABLE_NAMES = [
  "document_attribution_candidates",
  "document_chunks",
  "fireflies_ingestion_jobs",
  "graph_subscriptions",
  "graph_sync_state",
  "outlook_email_intake",
  "outlook_email_intake_attachments",
  "outlook_email_skip_audit",
  "ingestion_dead_letter",
  "ingestion_jobs",
  "packet_refresh_jobs",
  "rag_document_metadata",
  "rag_pipeline_state",
  "source_intelligence_jobs",
  "source_processing_jobs",
  "source_signal_candidates",
  "source_sync_health_snapshots",
  "source_sync_runs",
] as const satisfies readonly RagTableName[];

// Compile-time completeness guard: if the AI-DB types gain a table that is not in
// RAG_TABLE_NAMES, `MissingFromRegistry` stops being `never` and this errors,
// naming the tables to add. This is the guardrail against silent registry drift.
type MissingFromRegistry = Exclude<RagTableName, (typeof RAG_TABLE_NAMES)[number]>;
const _registryIsComplete: [MissingFromRegistry] extends [never]
  ? true
  : { error: "Add these tables to RAG_TABLE_NAMES"; missing: MissingFromRegistry } = true;
void _registryIsComplete;

export const RAG_TABLE_REGISTRY: ReadonlySet<RagTableName> = new Set(RAG_TABLE_NAMES);

/** Type guard: does this table live in the AI Database? */
export function isRagTable(table: string): table is RagTableName {
  return (RAG_TABLE_REGISTRY as ReadonlySet<string>).has(table);
}

// Two adapters behind the seam, constructed once. Both already throw loudly on
// missing env — so routing a RAG table with `RAG_SUPABASE_URL` unset throws
// rather than silently falling back to PM APP (which is what makes a synced inbox
// look empty). That drift check is satisfied by construction: RAG tables can only
// ever reach the RAG client.
let pmClient: SupabaseClient<Database> | null = null;
let ragClient: SupabaseClient<RagDatabase> | null = null;

function getPmClient(): SupabaseClient<Database> {
  return (pmClient ??= createServiceClient());
}

function getRagClient(): SupabaseClient<RagDatabase> {
  return (ragClient ??= createRagServiceClient());
}

/** @internal Reset the memoized clients. Test-only. */
export function __resetServiceDbClientsForTests(): void {
  pmClient = null;
  ragClient = null;
}

// The public `from` reuses Supabase's own two `from` return types (rather than
// reconstructing PostgrestQueryBuilder's generics), so it stays correct across
// supabase-js versions. Declared as overloads over one broad implementation —
// the RAG overload is listed first, so tables that exist in both projects (the
// legacy `document_chunks` / `rag_pipeline_state`) type as, and route to, the
// RAG project, matching the runtime. No casts: the implementation signature
// returns `unknown`, which every overload return is assignable to.
function serviceDbFrom<T extends RagTableName>(
  table: T,
): RagQueryBuilder<T>;
function serviceDbFrom<T extends PmTableName>(table: T): PmQueryBuilder<T>;
function serviceDbFrom(relation: string): unknown {
  if (isRagTable(relation)) {
    return getRagClient().from(relation);
  }
  return getPmClient().from(relation as keyof Database["public"]["Tables"] & string);
}

export const serviceDb = { from: serviceDbFrom };
