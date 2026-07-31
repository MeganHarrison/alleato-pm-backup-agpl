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

const sourceIdIndex = process.argv.indexOf("--id");
const sourceDocumentId = sourceIdIndex >= 0 ? process.argv[sourceIdIndex + 1] : null;
if (!sourceDocumentId) {
  console.error("Usage: node scripts/verify/verify_source_operating_record_projection.mjs --id <document_metadata_id>");
  process.exit(2);
}

async function poolFor(label) {
  const rawUrl = label === "app" ? getAppDatabaseUrl() : getRagDatabaseUrl();
  if (!rawUrl) throw new Error(`${label} database URL is missing`);
  const connectionString = await buildAppDatabaseConnectionString(rawUrl, {
    warnings: [],
    includeSslMode: false,
  });
  return new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 1 });
}

function fail(report, message, details = {}) {
  report.findings.push({ message, details });
}

const report = {
  status: "pass",
  sourceDocumentId,
  findings: [],
  rows: {},
};

const app = await poolFor("app");
const rag = await poolFor("rag");

try {
  const sourceSyntheses = await rag.query(
    `
    select id, project_id, synthesis_status, source_family, confidence, created_at
    from public.source_syntheses
    where source_document_id = $1
    order by created_at desc
    limit 5
    `,
    [sourceDocumentId],
  );
  report.rows.sourceSyntheses = sourceSyntheses.rows;
  const sourceSynthesis = sourceSyntheses.rows[0];
  if (!sourceSynthesis) {
    fail(report, "Missing source_syntheses row");
  } else if (sourceSynthesis.synthesis_status !== "succeeded") {
    fail(report, "Latest source_syntheses row did not succeed", sourceSynthesis);
  }

  const projectId = sourceSynthesis?.project_id;
  if (!projectId) {
    fail(report, "Source synthesis is missing project_id", sourceSynthesis || {});
  }

  const deltas = projectId
    ? await rag.query(
        `
        select id, project_id, business_date, status, source_synthesis_ids, source_coverage
        from public.project_daily_deltas
        where project_id = $1
          and $2::uuid = any(source_synthesis_ids)
        order by created_at desc
        limit 5
        `,
        [projectId, sourceSynthesis?.id],
      )
    : { rows: [] };
  report.rows.projectDailyDeltas = deltas.rows;
  const delta = deltas.rows[0];
  if (!delta) {
    fail(report, "Missing project_daily_deltas row linked to source synthesis", {
      projectId,
      sourceSynthesisId: sourceSynthesis?.id,
    });
  } else if (delta.status !== "succeeded") {
    fail(report, "Latest project_daily_deltas row did not succeed", delta);
  }

  const snapshots = projectId
    ? await app.query(
        `
        select id, project_id, source_delta_id, financial_snapshot, schedule_snapshot, database_counts, confidence
        from public.project_operating_snapshots
        where project_id = $1
          and source_delta_id = $2
        order by snapshot_at desc
        limit 5
        `,
        [projectId, delta?.id],
      )
    : { rows: [] };
  report.rows.projectOperatingSnapshots = snapshots.rows.map((row) => ({
    id: row.id,
    project_id: row.project_id,
    source_delta_id: row.source_delta_id,
    confidence: row.confidence,
    financialKeys: Object.keys(row.financial_snapshot || {}),
    countKeys: Object.keys(row.database_counts || {}),
  }));
  if (!snapshots.rows[0]) {
    fail(report, "Missing project_operating_snapshots row linked to daily delta", {
      projectId,
      deltaId: delta?.id,
    });
  }

  const currentState = projectId
    ? await app.query(
        `
        select project_id, last_delta_id, last_snapshot_id, current_summary, source_confidence
        from public.project_current_state
        where project_id = $1
        `,
        [projectId],
      )
    : { rows: [] };
  report.rows.projectCurrentState = currentState.rows;
  if (!currentState.rows[0]) {
    fail(report, "Missing project_current_state row", { projectId });
  } else if (currentState.rows[0].last_delta_id !== delta?.id) {
    fail(report, "project_current_state.last_delta_id does not point to latest verified delta", {
      expected: delta?.id,
      actual: currentState.rows[0].last_delta_id,
    });
  }

  const timelineEvents = projectId
    ? await app.query(
        `
        select id, project_id, source_synthesis_id, source_document_id, event_type, title, confidence
        from public.project_intelligence_timeline_events
        where project_id = $1
          and source_document_id = $2
          and source_synthesis_id = $3
        order by created_at desc
        limit 5
        `,
        [projectId, sourceDocumentId, sourceSynthesis?.id],
      )
    : { rows: [] };
  report.rows.projectIntelligenceTimelineEvents = timelineEvents.rows;
  if (!timelineEvents.rows[0]) {
    fail(report, "Missing project_intelligence_timeline_events row", {
      projectId,
      sourceDocumentId,
      sourceSynthesisId: sourceSynthesis?.id,
    });
  }

  const reportSuggestions = projectId
    ? await app.query(
        `
        select id, project_id, report_type, status, source_delta_id
        from public.project_report_suggestions
        where project_id = $1
          and source_delta_id = $2
        order by created_at desc
        `,
        [projectId, delta?.id],
      )
    : { rows: [] };
  report.rows.projectReportSuggestions = reportSuggestions.rows;
  const reportTypes = new Set(reportSuggestions.rows.map((row) => row.report_type));
  for (const expectedType of ["project_daily_report", "weekly_progress_report"]) {
    if (!reportTypes.has(expectedType)) {
      fail(report, `Missing ${expectedType} project_report_suggestions row`, {
        projectId,
        deltaId: delta?.id,
      });
    }
  }
} finally {
  await app.end();
  await rag.end();
}

if (report.findings.length > 0) {
  report.status = "fail";
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
