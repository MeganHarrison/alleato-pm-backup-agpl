#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseDays(argv) {
  const text = argv.join(" ").trim().toLowerCase();
  if (!text) return 1;
  const words = new Map([
    ["one", 1],
    ["two", 2],
    ["three", 3],
    ["four", 4],
    ["five", 5],
    ["six", 6],
    ["seven", 7],
    ["fourteen", 14],
    ["thirty", 30],
  ]);
  const numeric = text.match(/\d+/);
  if (numeric) return Math.max(1, Number(numeric[0]));
  for (const [word, value] of words.entries()) {
    if (text.includes(word)) return value;
  }
  throw new Error(`Could not parse day window from: ${text}`);
}

function fmt(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-US").format(n);
}

function pct(numerator, denominator) {
  const total = Number(denominator || 0);
  if (!total) return "n/a";
  return `${Math.round((Number(numerator || 0) / total) * 100)}%`;
}

function isoShort(value) {
  if (!value) return "none";
  return new Date(value).toISOString().replace(".000Z", "Z");
}

function mdTable(headers, rows) {
  const line = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell ?? "")).join(" | ")} |`);
  return [line, sep, ...body].join("\n");
}

async function connect(connectionString, label) {
  if (!connectionString) {
    throw new Error(`Missing ${label}. Expected it in .env or frontend/.env.local.`);
  }
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslkey");
  url.searchParams.delete("sslrootcert");
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    statement_timeout: 30000,
    application_name: "alleato-rag-stats",
    allowExitOnIdle: true,
  });
  await client.connect();
  return client;
}

const families = [
  {
    label: "Meeting Transcripts",
    metadataWhere:
      "(source = 'fireflies' OR fireflies_id IS NOT NULL OR type IN ('meeting', 'meeting_transcript', 'Interview'))",
    sourceTypes: [
      "meeting_transcript",
      "meeting_summary",
      "meeting_segment_summary",
      "meeting_section",
      "meeting_summary_embed",
      "meeting_notes",
      "zapier",
    ],
    syncSources: ["fireflies"],
  },
  {
    label: "Emails",
    metadataWhere: "source = 'microsoft_graph' AND type = 'email'",
    sourceTypes: ["email"],
    syncSources: ["outlook_email"],
  },
  {
    label: "Teams",
    metadataWhere:
      "source = 'microsoft_graph' AND (category = 'teams_message' OR type IN ('teams_dm', 'teams_dm_conversation', 'teams_message'))",
    sourceTypes: ["teams_dm", "teams_channel"],
    syncSources: ["teams_message", "teams_chat_export"],
  },
  {
    label: "OneDrive Files",
    metadataWhere: "source = 'microsoft_graph' AND type = 'document'",
    sourceTypes: ["onedrive_document", "document", "microsoft_graph"],
    syncSources: ["onedrive_file", "sharepoint_file"],
  },
  {
    label: "Email Attachments",
    metadataWhere:
      "source = 'microsoft_graph' AND type = 'email' AND COALESCE((source_metadata->>'has_attachments')::boolean, false)",
    sourceTypes: [],
    syncSources: ["outlook_email"],
    chunkNote: "included in Emails",
  },
];

async function metadataRows(appDb, whereClause, days) {
  const result = await appDb.query(
    `
      select
        count(*)::int as synced,
        count(*) filter (where status in ('raw_ingested', 'processed', 'segmented', 'error'))::int as needs_embedding
      from public.document_metadata
      where ${whereClause}
        and coalesce(captured_at, date, source_last_modified_at, created_at::timestamptz) >= now() - ($1::int * interval '1 day')
    `,
    [days],
  );
  return result.rows[0] || { synced: 0, needs_embedding: 0 };
}

async function chunkCoverageByFamily(ragDb, days) {
  const sourceRows = families.flatMap((family, familyIndex) =>
    family.sourceTypes.map((sourceType) => [familyIndex, sourceType]),
  );
  if (!sourceRows.length) return new Map();

  const familyIndexes = sourceRows.map(([familyIndex]) => familyIndex);
  const sourceTypes = sourceRows.map(([, sourceType]) => sourceType);
  const result = await ragDb.query(
    `
      with family_sources as (
        select *
        from unnest($1::int[], $2::text[]) as source(family_index, source_type)
      )
      select
        family_index,
        count(*)::int as chunks,
        count(*) filter (where embedding is not null)::int as embedded_chunks,
        count(distinct document_id)::int as chunked_docs,
        count(distinct document_id) filter (where embedding is not null)::int as embedded_docs
      from public.document_chunks
      join family_sources using (source_type)
      where created_at >= now() - ($3::int * interval '1 day')
      group by family_index
    `,
    [familyIndexes, sourceTypes, days],
  );
  return new Map(
    result.rows.map((row) => [
      Number(row.family_index),
      {
        chunks: Number(row.chunks || 0),
        embeddedChunks: Number(row.embedded_chunks || 0),
        chunkedDocs: Number(row.chunked_docs || 0),
        embeddedDocs: Number(row.embedded_docs || 0),
      },
    ]),
  );
}

async function meetingTranscriptCoverage(appDb, ragDb, days) {
  const metadata = await appDb.query(
    `
      select
        id::text as id,
        coalesce(source_metadata->'transcript_chunk_backfill'->>'status', 'unclassified') as backfill_status
      from public.document_metadata
      where (source = 'fireflies' OR fireflies_id IS NOT NULL OR type IN ('meeting', 'meeting_transcript', 'Interview'))
        and coalesce(captured_at, date, source_last_modified_at, created_at::timestamptz) >= now() - ($1::int * interval '1 day')
        and deleted_at is null
    `,
    [days],
  );
  const ids = metadata.rows.map((row) => row.id);
  if (!ids.length) {
    return {
      sourceDocs: 0,
      withEmbeddedTranscriptChunks: 0,
      missingEmbeddedTranscriptChunks: 0,
      transcriptChunks: 0,
      embeddedTranscriptChunks: 0,
      statuses: [],
    };
  }

  const chunks = await ragDb.query(
    `
      select
        count(*)::int as transcript_chunks,
        count(*) filter (where embedding is not null)::int as embedded_transcript_chunks,
        count(distinct document_id) filter (where embedding is not null)::int as docs_with_embedded_transcript_chunks
      from public.document_chunks
      where document_id = any($1::text[])
        and source_type = 'meeting_transcript'
    `,
    [ids],
  );

  const statusCounts = new Map();
  for (const row of metadata.rows) {
    const status = row.backfill_status || "unclassified";
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }

  const chunkRow = chunks.rows[0] || {};
  const withEmbeddedTranscriptChunks = Number(chunkRow.docs_with_embedded_transcript_chunks || 0);
  return {
    sourceDocs: ids.length,
    withEmbeddedTranscriptChunks,
    missingEmbeddedTranscriptChunks: ids.length - withEmbeddedTranscriptChunks,
    transcriptChunks: Number(chunkRow.transcript_chunks || 0),
    embeddedTranscriptChunks: Number(chunkRow.embedded_transcript_chunks || 0),
    statuses: Array.from(statusCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => `${status}: ${fmt(count)}`),
  };
}

async function syncSummary(appDb, syncSources, days) {
  const result = await appDb.query(
    `
      select
        max(finished_at) as last_finished_at,
        count(*)::int as runs,
        count(*) filter (where status = 'succeeded')::int as succeeded,
        count(*) filter (where status = 'warning')::int as warnings,
        count(*) filter (where status = 'failed')::int as failed,
        coalesce(sum(items_synced), 0)::int as items_synced,
        coalesce(sum(items_failed), 0)::int as items_failed
      from public.source_sync_runs
      where source = any($1::text[])
        and started_at >= now() - ($2::int * interval '1 day')
    `,
    [syncSources, days],
  );
  return result.rows[0] || {};
}

async function simpleRows(appDb, ragDb, days) {
  const rows = [];
  const chunkCoverage = await chunkCoverageByFamily(ragDb, days);
  for (const [index, family] of families.entries()) {
    const metadata = await metadataRows(appDb, family.metadataWhere, days);
    const coverage = chunkCoverage.get(index) || {
      chunkedDocs: 0,
      embeddedDocs: 0,
      chunks: 0,
      embeddedChunks: 0,
    };
    const sync = await syncSummary(appDb, family.syncSources, days);
    rows.push([
      family.label,
      fmt(metadata.synced),
      family.chunkNote || `${fmt(coverage.chunkedDocs)} docs / ${fmt(coverage.chunks)} chunks`,
      family.chunkNote || `${fmt(coverage.embeddedDocs)} docs / ${fmt(coverage.embeddedChunks)} chunks`,
      fmt(metadata.needs_embedding),
      pct(metadata.needs_embedding, metadata.synced),
      isoShort(sync.last_finished_at),
      `${fmt(sync.succeeded)} ok, ${fmt(sync.warnings)} warn, ${fmt(sync.failed)} fail`,
    ]);
  }
  return rows;
}

async function compilerStats(appDb, days) {
  const latestRun = await appDb.query(
    `
      select status, finished_at, items_seen, items_synced, items_failed, error_message
      from public.source_sync_runs
      where source = 'intelligence_compiler'
      order by started_at desc
      limit 1
    `,
  );
  const statuses = await appDb.query(
    `
      select coalesce(source_metadata->'teams_compiler'->>'status', status, 'unknown') as status, count(*)::int as count
      from public.document_metadata
      where source = 'microsoft_graph'
        and type = 'teams_dm_conversation'
        and coalesce(captured_at, date, created_at::timestamptz) >= now() - ($1::int * interval '1 day')
      group by 1
      order by count desc
    `,
    [days],
  );
  return { latestRun: latestRun.rows[0] || null, statuses: statuses.rows };
}

async function projectIntelligenceStats(appDb, days) {
  const result = await appDb.query(
    `
      select
        max(generated_at) as last_generated_at,
        count(*) filter (where generated_at >= now() - ($1::int * interval '1 day'))::int as packets_in_window,
        count(*) filter (
          where freshness_status = 'fresh'
            and generated_at >= now() - ($1::int * interval '1 day')
        )::int as fresh_packets,
        count(*) filter (
          where freshness_status = 'stale'
            and generated_at >= now() - ($1::int * interval '1 day')
        )::int as stale_packets
      from public.intelligence_packets
    `,
    [days],
  );
  return result.rows[0] || {};
}

async function backlogStats(appDb, ragDb, days) {
  const metadata = await appDb.query(
    `
      select
        count(*) filter (where status in ('raw_ingested', 'processed', 'segmented'))::int as pending_like,
        count(*) filter (where status = 'error')::int as metadata_errors,
        count(*) filter (where status = 'not_vectorizable')::int as not_vectorizable
      from public.document_metadata
      where coalesce(captured_at, date, source_last_modified_at, created_at::timestamptz) >= now() - ($1::int * interval '1 day')
    `,
    [days],
  );
  const fireflies = await ragDb.query(
    `
      select
        count(*) filter (where stage = 'error')::int as fireflies_errors,
        count(*) filter (where stage not in ('done', 'embedded'))::int as fireflies_not_done
      from public.fireflies_ingestion_jobs
      where updated_at >= now() - ($1::int * interval '1 day')
    `,
    [days],
  );
  return { ...(metadata.rows[0] || {}), ...(fireflies.rows[0] || {}) };
}

async function main() {
  loadEnvFile(path.join(repoRoot, ".env"));
  loadEnvFile(path.join(repoRoot, "frontend/.env.local"));

  const days = parseDays(process.argv.slice(2));
  const appDb = await connect(process.env.DATABASE_URL, "DATABASE_URL");
  const ragDb = await connect(process.env.RAG_DATABASE_URL, "RAG_DATABASE_URL");

  try {
    const [rows, transcriptCoverage, compiler, intelligence, backlog] = await Promise.all([
      simpleRows(appDb, ragDb, days),
      meetingTranscriptCoverage(appDb, ragDb, days),
      compilerStats(appDb, days),
      projectIntelligenceStats(appDb, days),
      backlogStats(appDb, ragDb, days),
    ]);

    console.log(`# RAG Stats (${days} day${days === 1 ? "" : "s"})`);
    console.log("");
    console.log(
      "Synced = source rows in app DB. Chunked/Embedded = vector activity created in the split RAG DB during the window.",
    );
    console.log("Metadata Backlog = synced rows still in raw/processed/segmented/error states.");
    console.log("");
    console.log(
      mdTable(
        [
          "Source",
          "Synced",
          "Chunked",
          "Embedded",
          "Metadata Backlog",
          "Backlog %",
          "Last Sync",
          "Runs",
        ],
        rows,
      ),
    );

    console.log("\n## Full Meeting Transcript Coverage");
    console.log(
      mdTable(
        [
          "Fireflies Docs",
          "With Embedded Transcript Chunks",
          "Missing Transcript Chunks",
          "Coverage",
          "Transcript Chunks",
          "Backfill Statuses",
        ],
        [
          [
            fmt(transcriptCoverage.sourceDocs),
            fmt(transcriptCoverage.withEmbeddedTranscriptChunks),
            fmt(transcriptCoverage.missingEmbeddedTranscriptChunks),
            pct(
              transcriptCoverage.withEmbeddedTranscriptChunks,
              transcriptCoverage.sourceDocs,
            ),
            `${fmt(transcriptCoverage.embeddedTranscriptChunks)} embedded / ${fmt(transcriptCoverage.transcriptChunks)} total`,
            transcriptCoverage.statuses.join(", ") || "none",
          ],
        ],
      ),
    );

    const latestCompiler = compiler.latestRun;
    console.log("\n## Teams Compiler");
    console.log(
      mdTable(
        ["Last Ran", "Status", "Items Seen", "Items Synced", "Items Failed", "Recent Conversation Statuses"],
        [
          [
            isoShort(latestCompiler?.finished_at),
            latestCompiler?.status || "none",
            fmt(latestCompiler?.items_seen),
            fmt(latestCompiler?.items_synced),
            fmt(latestCompiler?.items_failed),
            compiler.statuses.map((row) => `${row.status}: ${fmt(row.count)}`).join(", ") || "none",
          ],
        ],
      ),
    );

    console.log("\n## Project Intelligence");
    console.log(
      mdTable(
        ["Last Updated", "Packets In Window", "Fresh Packets", "Stale Packets"],
        [
          [
            isoShort(intelligence.last_generated_at),
            fmt(intelligence.packets_in_window),
            fmt(intelligence.fresh_packets),
            fmt(intelligence.stale_packets),
          ],
        ],
      ),
    );

    console.log("\n## Backlog / Health Flags");
    console.log(
      mdTable(
        ["Pending Metadata", "Metadata Errors", "Not Vectorizable", "Fireflies Errors", "Fireflies Not Done"],
        [
          [
            fmt(backlog.pending_like),
            fmt(backlog.metadata_errors),
            fmt(backlog.not_vectorizable),
            fmt(backlog.fireflies_errors),
            fmt(backlog.fireflies_not_done),
          ],
        ],
      ),
    );
  } finally {
    await Promise.allSettled([endClient(appDb), endClient(ragDb)]);
  }
}

function endClient(client) {
  return Promise.race([
    client.end(),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`rag-stats failed: ${error.message}`);
    process.exit(1);
  });
