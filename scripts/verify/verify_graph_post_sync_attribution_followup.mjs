#!/usr/bin/env node

/**
 * Verify Microsoft Graph downstream runs persist communication attribution follow-up evidence.
 *
 * This reads the durable RAG DB `source_sync_runs` ledger, not Render logs. A
 * Graph downstream run that synced Outlook/Teams communications must record a
 * `metadata.project_backfill` result so ops can prove attribution/review
 * staging ran after source sync.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getRagDatabaseUrl,
} from "./app-db-connection.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), override: false, quiet: true });

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const raw = arg.slice(2);
  if (raw.includes("=")) {
    const [key, ...valueParts] = raw.split("=");
    args.set(key, valueParts.join("=") || "true");
    continue;
  }
  const next = process.argv[index + 1];
  if (next && !next.startsWith("--")) {
    args.set(raw, next);
    index += 1;
  } else {
    args.set(raw, "true");
  }
}

const lookbackHours = numberArg("hours", "GRAPH_POST_SYNC_ATTRIBUTION_VERIFY_HOURS", 24);
const requireRecent = args.get("require-recent") === "true";

function numberArg(name, envName, fallback) {
  const raw = args.get(name) ?? process.env[envName];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.error(`--${name} must be numeric.`);
    process.exit(1);
  }
  return value;
}

function compactRun(row) {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    status: row.status,
    started_at: row.started_at,
    finished_at: row.finished_at,
    communications_synced: Number(metadata.communications_synced ?? 0),
    project_backfill: metadata.project_backfill ?? null,
    error_message: row.error_message ?? null,
  };
}

const ragDatabaseUrl = getRagDatabaseUrl();
if (!ragDatabaseUrl) {
  console.error("RAG_DATABASE_URL is required for Graph post-sync attribution verification.");
  process.exit(1);
}

const ragPool = new pg.Pool({
  connectionString: await buildAppDatabaseConnectionString(ragDatabaseUrl, {
    includeSslMode: false,
    rewriteSupabaseDirectHost: false,
  }),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const client = await ragPool.connect();
try {
  const result = await client.query(
    `
      select id, source, resource_id, status, started_at, finished_at, error_message, metadata
      from public.source_sync_runs
      where source = 'microsoft_graph_downstream'
        and stage = 'downstream_enrichment'
        and started_at >= now() - ($1::text || ' hours')::interval
      order by started_at desc
      limit 50
    `,
    [lookbackHours],
  );

  const runs = result.rows.map(compactRun);
  const communicationRuns = runs.filter((run) => run.communications_synced > 0);
  const failures = [];

  if (runs.length === 0 && requireRecent) {
    failures.push({
      code: "missing_recent_graph_downstream_run",
      message: `No Microsoft Graph downstream runs found in the last ${lookbackHours} hour(s).`,
    });
  }

  for (const run of communicationRuns) {
    if (!run.project_backfill) {
      failures.push({
        code: "missing_project_backfill_metadata",
        message: "Graph downstream run synced communications but did not record project_backfill metadata.",
        run,
      });
      continue;
    }
    if (run.project_backfill.error || Number(run.project_backfill.failed ?? 0) > 0) {
      failures.push({
        code: "project_backfill_failed",
        message: "Graph downstream run recorded a failed communication project backfill.",
        run,
      });
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    lookbackHours,
    requireRecent,
    totalGraphDownstreamRuns: runs.length,
    communicationRuns: communicationRuns.length,
    latestRun: runs[0] ?? null,
    failures,
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exit(failures.length === 0 ? 0 : 1);
} finally {
  client.release();
  await ragPool.end();
}
