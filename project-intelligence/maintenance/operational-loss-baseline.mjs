#!/usr/bin/env node

import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { buildAppDatabaseConnectionString, getRagDatabaseUrl } from "../../scripts/verify/app-db-connection.mjs";

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.join(process.cwd(), "frontend/.env.local"), quiet: true });

const since = process.argv[2] ?? "2026-01-15T00:00:00.000Z";
const until = process.argv[3] ?? "2026-07-15T00:00:00.000Z";
if (!Number.isFinite(Date.parse(since)) || !Number.isFinite(Date.parse(until))) {
  throw new Error("Usage: operational-loss-baseline.mjs [since ISO] [until ISO]");
}

function sourceClass(row) {
  const type = String(row.type ?? "").toLowerCase();
  const category = String(row.category ?? "").toLowerCase();
  const source = String(row.source ?? "").toLowerCase();
  const system = String(row.source_system ?? "").toLowerCase();
  if (type === "meeting" || source.includes("fireflies") || system.includes("fireflies")) return "meeting";
  if (category === "email" || type === "email" || system === "outlook_email") return "email";
  if (category === "teams_message" || type.startsWith("teams_") || system.startsWith("teams_")) return "teams";
  return "document";
}

function occurrenceDate(row) {
  if (row.received_at) return new Date(row.received_at);
  const meta = row.source_metadata ?? {};
  for (const value of [meta.latest_message_at, meta.source_day, meta.lastModifiedDateTime, meta.modified_at, meta.created_at]) {
    if (value && Number.isFinite(Date.parse(value))) return new Date(value);
  }
  if (sourceClass(row) === "meeting") {
    const match = String(row.content ?? "").match(/^\*\*Date:\*\*\s*([^\n]+)/m);
    if (match && Number.isFinite(Date.parse(match[1].trim()))) return new Date(match[1].trim());
  }
  return new Date(row.created_at);
}

function weekStart(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0, 10);
}

function coverageLabel(activeWeeks, totalWeeks, latestLagDays) {
  const ratio = activeWeeks / totalWeeks;
  if (ratio >= 0.75 && latestLagDays <= 7) return "observed";
  if (ratio >= 0.35 && latestLagDays <= 21) return "partially_observed";
  return "under_observed";
}

function lineageLabel(projectAssignmentCoverage) {
  if (projectAssignmentCoverage >= 0.7) return "observed";
  if (projectAssignmentCoverage >= 0.4) return "partially_observed";
  return "under_observed";
}

function weekBucketCount(start, end) {
  const buckets = new Set();
  for (let cursor = new Date(start); cursor < end; cursor = new Date(cursor.getTime() + 86400000)) {
    buckets.add(weekStart(cursor));
  }
  return buckets.size;
}

const rawUrl = getRagDatabaseUrl();
if (!rawUrl) throw new Error("RAG_DATABASE_URL is required");
const client = new pg.Client({
  connectionString: await buildAppDatabaseConnectionString(rawUrl, { includeSslMode: false }),
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const result = await client.query(
    `
      select
        d.id, d.project_id, d.title, d.type, d.category, d.source, d.source_system,
        d.content, d.raw_text, d.summary, d.source_metadata, d.created_at,
        oi.received_at,
        exists(select 1 from public.document_chunks c where c.document_id = d.id) as has_chunk
      from public.rag_document_metadata d
      left join public.outlook_email_intake oi on oi.document_metadata_id = d.id and oi.deleted_at is null
      where lower(coalesce(d.type, '')) <> 'ai_memory'
        and lower(coalesce(d.category, '')) <> 'ai_memory'
    `,
  );

  const start = new Date(since);
  const end = new Date(until);
  const rows = result.rows
    .map((row) => ({ ...row, occurrence: occurrenceDate(row), sourceClass: sourceClass(row) }))
    .filter((row) => row.occurrence >= start && row.occurrence < end);
  const totalWeeks = weekBucketCount(start, end);
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.sourceClass)) grouped.set(row.sourceClass, []);
    grouped.get(row.sourceClass).push(row);
  }
  const sources = [...grouped.entries()].sort().map(([name, items]) => {
    const weeks = new Map();
    for (const item of items) {
      const week = weekStart(item.occurrence);
      const value = weeks.get(week) ?? { documents: 0, withContent: 0, withChunks: 0, projectAssigned: 0 };
      value.documents += 1;
      value.withContent += Boolean(item.content || item.raw_text || item.summary) ? 1 : 0;
      value.withChunks += item.has_chunk ? 1 : 0;
      value.projectAssigned += item.project_id === null ? 0 : 1;
      weeks.set(week, value);
    }
    const latest = new Date(Math.max(...items.map((item) => item.occurrence.getTime())));
    const latestLagDays = Math.max(0, Math.floor((end - latest) / 86400000));
    const projectAssignmentCoverage = Number((items.filter((item) => item.project_id !== null).length / items.length).toFixed(4));
    return {
      source: name,
      status: coverageLabel(weeks.size, totalWeeks, latestLagDays),
      projectLineageStatus: lineageLabel(projectAssignmentCoverage),
      documents: items.length,
      activeWeeks: weeks.size,
      totalWeeks,
      latestOccurrence: latest.toISOString(),
      latestLagDays,
      contentCoverage: Number((items.filter((item) => item.content || item.raw_text || item.summary).length / items.length).toFixed(4)),
      chunkCoverage: Number((items.filter((item) => item.has_chunk).length / items.length).toFixed(4)),
      projectAssignmentCoverage,
      weekly: Object.fromEntries([...weeks.entries()].sort()),
    };
  });
  const output = {
    generatedAt: new Date().toISOString(),
    window: { since, until, totalWeeks },
    analyticalUnit: "structured_episode",
    discoveryIndex: "Daily Deep Read and normalized RAG sources",
    caveats: [
      "Document volume is not episode frequency.",
      "Under-observed windows cannot be interpreted as no operational loss.",
      "Fireflies source dates are parsed from the canonical transcript header when metadata is absent.",
      "Project assignment coverage describes source lineage quality, not project performance."
    ],
    sources,
  };
  console.log(JSON.stringify(output, null, 2));
} finally {
  await client.end();
}
