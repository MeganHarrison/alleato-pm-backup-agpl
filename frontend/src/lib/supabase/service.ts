import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Database as RagDatabase } from "@/types/rag-database.types";
import type { AsrsDatabase } from "@/types/asrs-database.types";

/**
 * Supabase Admin Client (Service Role)
 *
 * This client bypasses Row Level Security (RLS) policies.
 * Use ONLY in server-side API routes where you need admin access.
 *
 * ⚠️ NEVER expose this client or service role key to the client-side ⚠️
 */
export function createServiceClient(): SupabaseClient<Database> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable",
    );
  }

  if (!supabaseServiceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
        "This is required for server-side admin operations.",
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isRagDatabaseReadsEnabled() {
  return (
    (process.env.RAG_DATABASE_READS_ENABLED ?? "").trim().toLowerCase() ===
    "true"
  );
}

export function isRagDatabaseWritesEnabled() {
  return (
    (process.env.RAG_DATABASE_WRITES_ENABLED ?? "").trim().toLowerCase() ===
    "true"
  );
}

export function isBackendApiOnly() {
  return (
    (process.env.BACKEND_API_ONLY ?? "").trim().toLowerCase() === "true"
  );
}

/**
 * Service-role client for the **ASRS project** (`vqnnvpnoitqhijkztyhq`) — the third
 * Supabase project, home of the FM Global 8-34 corpus (`fm_*` / `asrs_*` tables) and
 * its lookup RPCs.
 *
 * The dedicated project now has its own checked-in type boundary. Official type
 * generation is permission-blocked for this project, so the boundary is deliberately
 * narrow and based on live schema readback rather than pretending the PM APP copy is
 * still identical.
 *
 * Not routed through `serviceDb`: that router's registry is a closed two-project map
 * with type-level completeness checks, and widening it to a third project is a larger
 * change than this repair. FM Global access is overwhelmingly `.rpc()`, which the
 * router documents as the legitimate direct-factory case.
 */
export function createAsrsServiceClient(): SupabaseClient<AsrsDatabase> {
  const supabaseUrl = process.env.SUPABASE_ASRS_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_ASRS_SECRET_KEY ??
    process.env.SUPABASE_ASRS_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing SUPABASE_ASRS_URL environment variable. " +
        "This is required to reach the FM Global / ASRS corpus.",
    );
  }

  if (!supabaseServiceKey) {
    throw new Error(
      "Missing SUPABASE_ASRS_SECRET_KEY environment variable. " +
        "This is required to reach the FM Global / ASRS corpus.",
    );
  }

  return createClient<AsrsDatabase>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * @deprecated Prefer `serviceDb.from(table)` from `@/lib/supabase/service-db`,
 * which routes each table to the right project by construction. Reach for this
 * factory directly only for RAG `.rpc()` calls or when you genuinely need the
 * whole client. Picking a client by hand is the leak the router exists to close.
 */
export function createRagServiceClient(): SupabaseClient<RagDatabase> {
  const supabaseUrl = process.env.RAG_SUPABASE_URL;
  const supabaseServiceKey = process.env.RAG_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing RAG_SUPABASE_URL environment variable. " +
        "This is required when RAG_DATABASE_READS_ENABLED=true.",
    );
  }

  if (!supabaseServiceKey) {
    throw new Error(
      "Missing RAG_SUPABASE_SERVICE_ROLE_KEY environment variable. " +
        "This is required when RAG_DATABASE_READS_ENABLED=true.",
    );
  }

  return createClient<RagDatabase>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * @deprecated Prefer `serviceDb.from("outlook_email_intake" | ...)` from
 * `@/lib/supabase/service-db`, which routes to the AI Database with the correct
 * `RagDatabase` typing. This factory connects to the AI Database but is typed as
 * `<Database>` (PM APP) — the router removes the need for this workaround.
 */
export function createOutlookIntakeServiceClient(): SupabaseClient<Database> {
  // Outlook intake tables (`outlook_email_intake*`) physically live in the AI
  // database. Falling back to the PM App database makes the inbox look empty
  // even when sync is healthy, so require the canonical RAG client here.
  const supabaseUrl = process.env.RAG_SUPABASE_URL;
  const supabaseServiceKey = process.env.RAG_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing RAG_SUPABASE_URL environment variable. " +
        "This is required for Outlook intake reads.",
    );
  }

  if (!supabaseServiceKey) {
    throw new Error(
      "Missing RAG_SUPABASE_SERVICE_ROLE_KEY environment variable. " +
        "This is required for Outlook intake reads.",
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
