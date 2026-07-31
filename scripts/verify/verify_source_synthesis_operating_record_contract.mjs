#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
  getRagDatabaseUrl,
} from "./app-db-connection.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

const expected = {
  rag: {
    tables: {
      source_syntheses: {
        columns: [
          "id",
          "source_document_id",
          "source_family",
          "project_id",
          "source_occurred_at",
          "source_title",
          "source_url",
          "full_source_hash",
          "synthesis_model",
          "synthesis_status",
          "executive_summary",
          "what_changed",
          "decisions",
          "risks",
          "commitments",
          "tasks",
          "financial_signals",
          "schedule_signals",
          "change_event_signals",
          "daily_log_signals",
          "progress_report_signals",
          "confidence",
          "confidence_notes",
          "source_quotes",
          "token_usage",
          "error_code",
          "error_message",
          "metadata",
          "completed_at",
          "created_at",
          "updated_at",
        ],
        checks: {
          source_family: [
            "fireflies",
            "outlook_email",
            "teams",
            "onedrive_document",
            "sharepoint_document",
            "email_attachment",
            "daily_log",
            "photo",
            "database_snapshot",
            "acumatica_sync",
            "other",
          ],
          synthesis_status: [
            "pending",
            "running",
            "succeeded",
            "failed_retryable",
            "failed_permanent",
            "skipped_no_content",
            "skipped_unchanged",
            "needs_project_review",
          ],
          confidence: ["high", "medium", "low", "unknown"],
        },
      },
      project_daily_deltas: {
        columns: [
          "id",
          "project_id",
          "business_date",
          "status",
          "source_synthesis_ids",
          "database_snapshot_id",
          "headline",
          "what_changed",
          "decisions",
          "risks",
          "issues",
          "milestones",
          "financial_changes",
          "schedule_changes",
          "change_event_candidates",
          "task_candidates",
          "daily_report_draft",
          "progress_report_updates",
          "source_coverage",
          "confidence",
          "confidence_notes",
          "model",
          "token_usage",
          "error_code",
          "error_message",
          "metadata",
          "completed_at",
          "created_at",
          "updated_at",
        ],
        checks: {
          status: ["pending", "running", "succeeded", "failed", "superseded", "skipped_no_sources"],
          confidence: ["high", "medium", "low", "unknown"],
        },
      },
    },
  },
  app: {
    tables: {
      project_operating_snapshots: {
        columns: [
          "id",
          "project_id",
          "snapshot_at",
          "source_delta_id",
          "source_coverage",
          "financial_snapshot",
          "schedule_snapshot",
          "database_counts",
          "project_info",
          "acumatica_sync_at",
          "freshness",
          "warnings",
          "confidence",
          "created_at",
        ],
        checks: {
          confidence: ["high", "medium", "low", "unknown"],
        },
      },
      project_current_state: {
        columns: [
          "project_id",
          "current_summary",
          "health_status",
          "what_changed_since_last_update",
          "needs_attention",
          "open_decisions",
          "active_risks",
          "financial_read",
          "schedule_read",
          "field_read",
          "source_confidence",
          "last_delta_id",
          "last_snapshot_id",
          "updated_at",
        ],
        checks: {
          health_status: ["on_track", "watch", "at_risk", "critical", "unknown"],
        },
      },
      project_intelligence_timeline_events: {
        columns: [
          "id",
          "project_id",
          "event_at",
          "event_type",
          "title",
          "summary",
          "why_it_matters",
          "current_status",
          "owner_label",
          "priority",
          "source_synthesis_id",
          "source_document_id",
          "related_event_ids",
          "related_record_type",
          "related_record_id",
          "confidence",
          "metadata",
          "created_at",
          "updated_at",
        ],
        checks: {
          event_type: [
            "decision",
            "risk",
            "issue",
            "milestone",
            "idea",
            "cost_exposure",
            "schedule_impact",
            "change_event_signal",
            "client_concern",
            "daily_log",
            "progress_update",
            "rfi",
            "submittal",
            "drawing",
            "commitment",
            "financial",
            "document",
            "email",
            "meeting",
          ],
          current_status: ["open", "monitoring", "needs_decision", "resolved", "converted", "dismissed", "superseded"],
          priority: ["urgent", "high", "medium", "low"],
          confidence: ["high", "medium", "low", "unknown"],
        },
      },
      project_intelligence_timeline_event_sources: {
        columns: [
          "id",
          "timeline_event_id",
          "source_synthesis_id",
          "source_document_id",
          "source_family",
          "source_title",
          "source_excerpt",
          "source_url",
          "source_occurred_at",
          "confidence",
          "metadata",
          "created_at",
        ],
        checks: {
          confidence: ["high", "medium", "low", "unknown"],
        },
      },
      change_event_candidates: {
        columns: [
          "id",
          "project_id",
          "title",
          "description",
          "reason",
          "potential_cost_impact",
          "potential_schedule_impact",
          "source_synthesis_ids",
          "timeline_event_ids",
          "confidence",
          "missing_information",
          "status",
          "created_change_event_id",
          "metadata",
          "created_at",
          "updated_at",
        ],
        checks: {
          status: ["candidate", "reviewing", "draft_created", "converted", "dismissed"],
          confidence: ["high", "medium", "low", "unknown"],
        },
      },
      project_report_suggestions: {
        columns: [
          "id",
          "project_id",
          "report_type",
          "business_date",
          "week_start_date",
          "source_delta_id",
          "source_snapshot_id",
          "title",
          "suggestion_payload",
          "source_timeline_event_ids",
          "status",
          "applied_record_type",
          "applied_record_id",
          "reviewed_by",
          "reviewed_at",
          "confidence",
          "metadata",
          "created_at",
          "updated_at",
        ],
        checks: {
          report_type: ["executive_daily_brief", "project_daily_report", "field_daily_log", "weekly_progress_report"],
          status: ["suggested", "reviewing", "applied", "partially_applied", "dismissed", "superseded"],
          confidence: ["high", "medium", "low", "unknown"],
        },
      },
    },
  },
};

function fail(message, details) {
  return { ok: false, message, details };
}

async function getPool(label) {
  const rawUrl = label === "app" ? getAppDatabaseUrl() : getRagDatabaseUrl();
  if (!rawUrl) {
    throw new Error(`${label === "app" ? "DATABASE_URL/SUPABASE_DB_URL" : "RAG_DATABASE_URL"} is required.`);
  }
  const warnings = [];
  const connectionString = await buildAppDatabaseConnectionString(rawUrl, {
    warnings,
    includeSslMode: false,
  });
  return {
    warnings,
    pool: new pg.Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 1,
    }),
  };
}

async function loadTableState(client, tableNames) {
  const { rows: columns } = await client.query(
    `
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any($1::text[])
    order by table_name, ordinal_position
    `,
    [tableNames],
  );

  const { rows: constraints } = await client.query(
    `
    select
      c.relname as table_name,
      a.attname as column_name,
      pg_get_constraintdef(con.oid) as constraint_def
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    left join unnest(con.conkey) with ordinality as ck(attnum, ord) on true
    left join pg_attribute a on a.attrelid = con.conrelid and a.attnum = ck.attnum
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any($1::text[])
      and con.contype = 'c'
    order by c.relname, a.attname
    `,
    [tableNames],
  );

  const { rows: rls } = await client.query(
    `
    select relname as table_name, relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any($1::text[])
    `,
    [tableNames],
  );

  return { columns, constraints, rls };
}

function verifyDataset(label, contract, state) {
  const findings = [];
  const columnMap = new Map();
  for (const row of state.columns) {
    const values = columnMap.get(row.table_name) ?? new Set();
    values.add(row.column_name);
    columnMap.set(row.table_name, values);
  }

  const rlsMap = new Map(state.rls.map((row) => [row.table_name, row.relrowsecurity]));

  for (const [tableName, tableContract] of Object.entries(contract.tables)) {
    const actualColumns = columnMap.get(tableName);
    if (!actualColumns) {
      findings.push(fail(`${label}.${tableName} table is missing`));
      continue;
    }

    for (const column of tableContract.columns) {
      if (!actualColumns.has(column)) {
        findings.push(fail(`${label}.${tableName}.${column} column is missing`));
      }
    }

    if (!rlsMap.get(tableName)) {
      findings.push(fail(`${label}.${tableName} must have RLS enabled`));
    }

    for (const [column, values] of Object.entries(tableContract.checks ?? {})) {
      const defs = state.constraints
        .filter((row) => row.table_name === tableName && row.column_name === column)
        .map((row) => row.constraint_def)
        .join("\n");
      const missing = values.filter((value) => !defs.includes(`'${value}'::text`) && !defs.includes(`'${value}'`));
      if (missing.length > 0) {
        findings.push(
          fail(`${label}.${tableName}.${column} check constraint is missing expected values`, {
            missing,
            constraint: defs || null,
          }),
        );
      }
    }
  }

  return findings;
}

const report = {
  status: "pass",
  app: null,
  rag: null,
  warnings: [],
  findings: [],
};

for (const label of ["app", "rag"]) {
  let pool;
  try {
    const connection = await getPool(label);
    pool = connection.pool;
    report.warnings.push(...connection.warnings.map((warning) => `${label}: ${warning}`));
    const tableNames = Object.keys(expected[label].tables);
    const client = await pool.connect();
    try {
      const state = await loadTableState(client, tableNames);
      const findings = verifyDataset(label, expected[label], state);
      report.findings.push(...findings);
      report[label] = {
        expectedTables: tableNames.length,
        discoveredTables: new Set(state.columns.map((row) => row.table_name)).size,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    report.findings.push(fail(`${label} contract verification failed to run`, { error: error.message }));
  } finally {
    if (pool) await pool.end();
  }
}

if (report.findings.length > 0) {
  report.status = "fail";
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
