/**
 * RLS Regression Test - Persona Probe
 *
 * Signs in as a test persona and runs a fixed probe set against the DB.
 * Writes a JSON snapshot to tests/rls-regression/snapshots/{dir}/{persona}.json
 *
 * Run: tsx tests/rls-regression/probe.ts <persona-key> <snapshot-dir>
 *   persona-key:   admin | member-67 | member-none | external
 *   snapshot-dir:  before | after  (defaults to "before")
 *
 * Example:
 *   tsx tests/rls-regression/probe.ts admin before
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.");
  process.exit(1);
}

const PERSONA_EMAILS: Record<string, string> = {
  admin: "rls-test-admin@alleato.test",
  "member-67": "rls-test-member-67@alleato.test",
  "member-none": "rls-test-member-none@alleato.test",
  external: "rls-test-external@alleato.test",
};

// Env var names use underscores (dashes are invalid in env var names)
const PERSONA_PASSWORD_KEYS: Record<string, string> = {
  admin: "RLS_TEST_ADMIN_PASSWORD",
  "member-67": "RLS_TEST_MEMBER_67_PASSWORD",
  "member-none": "RLS_TEST_MEMBER_NONE_PASSWORD",
  external: "RLS_TEST_EXTERNAL_PASSWORD",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CountResult = { count: number } | { error: string } | { skipped: string };
type IdListResult = { ids: (string | number)[] } | { error: string } | { skipped: string };

interface ProbeSnapshot {
  persona: string;
  email: string;
  timestamp: string;
  supabase_project: string;
  counts: Record<string, CountResult>;
  sample_ids: Record<string, IdListResult>;
}

// ---------------------------------------------------------------------------
// Probe helpers
// ---------------------------------------------------------------------------

async function probeCount(
  client: ReturnType<typeof createClient>,
  table: string,
  label?: string
): Promise<CountResult> {
  const queryLabel = label ?? table;
  try {
    // Use Prefer: count=exact via PostgREST directly.
    // Supabase-js head:true can return error:{message:""} with count:null on
    // HTTP 206 due to a supabase-js/postgrest-js quirk with certain RLS setups.
    // Using head:false with limit:1 avoids this while still getting exact count.
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact" })
      .limit(1);

    if (error) {
      // Table may not exist (e.g. documents dropped in Wave 2 Task F)
      const msg = error.message ?? "";
      if (
        msg.includes("does not exist") ||
        msg.includes("relation") ||
        error.code === "42P01"
      ) {
        return { skipped: `table ${table} does not exist` };
      }
      // Empty message with null count = supabase-js 206 quirk; try parsing count
      if (msg === "" && count !== null) {
        return { count };
      }
      const detail = `${msg || "(no message)"} [code=${(error as Record<string, unknown>)["code"] ?? "?"}, hint=${(error as Record<string, unknown>)["hint"] ?? "none"}]`;
      return { error: detail };
    }

    return { count: count ?? 0 };
  } catch (err) {
    return { error: String(err) };
  }
}

async function probeSampleIds(
  client: ReturnType<typeof createClient>,
  table: string,
  idColumn = "id",
  limit = 5
): Promise<IdListResult> {
  try {
    const { data, error } = await client
      .from(table)
      .select(idColumn)
      .order(idColumn, { ascending: true })
      .limit(limit);

    if (error) {
      if (
        error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.code === "42P01"
      ) {
        return { skipped: `table ${table} does not exist` };
      }
      return { error: error.message };
    }

    return { ids: (data ?? []).map((row: Record<string, unknown>) => row[idColumn] as string | number) };
  } catch (err) {
    return { error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const personaKey = process.argv[2];
  const snapshotDir = process.argv[3] ?? "before";

  if (!personaKey || !PERSONA_EMAILS[personaKey]) {
    console.error(
      `Usage: tsx tests/rls-regression/probe.ts <persona-key> [before|after]`
    );
    console.error(`  persona-key: ${Object.keys(PERSONA_EMAILS).join(" | ")}`);
    process.exit(1);
  }

  const email = PERSONA_EMAILS[personaKey];
  const passwordKey = PERSONA_PASSWORD_KEYS[personaKey];

  // Load password from .env.local
  const envLocalPath = path.join(__dirname, ".env.local");
  if (!fs.existsSync(envLocalPath)) {
    console.error("tests/rls-regression/.env.local not found — run setup.ts first.");
    process.exit(1);
  }
  dotenv.config({ path: envLocalPath });

  const password = process.env[passwordKey];
  if (!password) {
    console.error(`Password key ${passwordKey} not found in .env.local`);
    process.exit(1);
  }

  console.log(`Probing as: ${personaKey} <${email}>`);

  // Sign in with user credentials (uses anon key — RLS is enforced)
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (authErr || !authData.session) {
    console.error(`Sign-in failed for ${email}: ${authErr?.message ?? "no session"}`);
    process.exit(1);
  }

  console.log(`  Signed in — user ID: ${authData.user.id}`);

  // Build a client with the user's JWT
  const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${authData.session.access_token}`,
      },
    },
  });

  // -------------------------------------------------------------------------
  // Run probes
  // -------------------------------------------------------------------------
  console.log("  Running probes...");

  const counts: Record<string, CountResult> = {};

  // Count probes
  // Note: the app uses "commitments_unified" (view) — there is no plain "commitments" table
  const countProbes: Array<[string, string]> = [
    ["projects", "projects"],
    ["commitments_unified", "commitments"],
    ["documents", "documents"],           // may be dropped — handled gracefully
    ["document_metadata", "document_metadata"],
    ["insight_cards", "insight_cards"],
    ["rfis", "rfis"],
    ["change_orders", "change_orders"],
    ["prime_contracts", "prime_contracts"],
    ["owner_invoices", "owner_invoices"],
  ];

  for (const [table, label] of countProbes) {
    const result = await probeCount(authedClient, table, label);
    counts[label] = result;
    const display =
      "count" in result
        ? `${result.count} rows`
        : "skipped" in result
        ? `SKIPPED (${result.skipped})`
        : `ERROR: ${result.error}`;
    console.log(`    ${label.padEnd(22)} ${display}`);
  }

  // Sample ID probes
  const idProbes: Array<[string, string]> = [
    ["projects", "id"],
    ["commitments_unified", "id"],
    ["insight_cards", "id"],
  ];

  const sampleIdsResult: Record<string, IdListResult> = {};
  for (const [table, idCol] of idProbes) {
    const result = await probeSampleIds(authedClient, table, idCol, 5);
    sampleIdsResult[table] = result;
  }

  // -------------------------------------------------------------------------
  // Build snapshot
  // -------------------------------------------------------------------------
  const snapshot: ProbeSnapshot = {
    persona: personaKey,
    email,
    timestamp: new Date().toISOString(),
    supabase_project: "lgveqfnpkxvzbnnwuled",
    counts,
    sample_ids: sampleIdsResult,
  };

  // Write to snapshots/{dir}/{persona}.json
  const snapshotsBase = path.join(__dirname, "snapshots", snapshotDir);
  if (!fs.existsSync(snapshotsBase)) {
    fs.mkdirSync(snapshotsBase, { recursive: true });
  }

  const outPath = path.join(snapshotsBase, `${personaKey}.json`);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n", "utf-8");

  console.log(`  Snapshot written → ${outPath}`);
  console.log("");

  // Also print JSON to stdout so run.sh can redirect it
  process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");

  await client.auth.signOut();
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
