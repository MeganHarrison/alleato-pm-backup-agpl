#!/usr/bin/env node

/**
 * Live Graph conversation chunk ownership guardrail.
 *
 * Source sync can succeed while a downstream generic embedder corrupts
 * document_chunks.source_type. This check reads the RAG database and fails if
 * Microsoft Graph-owned Outlook/Teams conversation documents have generic or
 * cross-source chunks.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const allowedSourceTypes = {
  outlook: ["email"],
  teams_dm: ["teams_dm"],
  teams_channel: ["teams_channel", "teams_message"],
};

const genericSourceTypes = ["document", "meeting_summary", "meeting_segment_summary"];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
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

function parseArgs(argv) {
  const args = new Map();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    args.set(key, rest.length ? rest.join("=") : "true");
  }
  return args;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function mdTable(headers, rows) {
  const line = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell ?? "")).join(" | ")} |`);
  return [line, sep, ...body].join("\n");
}

async function connect() {
  const connectionString = process.env.RAG_DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing RAG_DATABASE_URL.");
  }
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslkey");
  url.searchParams.delete("sslrootcert");
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    statement_timeout: 60000,
    application_name: "alleato-graph-conversation-chunk-ownership",
    allowExitOnIdle: true,
  });
  await client.connect();
  return client;
}

async function readSummary(client, { days }) {
  const windowSql = days > 0 ? "and m.updated_at >= now() - ($1::int * interval '1 day')" : "";
  const params = days > 0 ? [days] : [];
  const { rows } = await client.query(
    `
    with graph_docs as (
      select m.id,
             m.title,
             m.type,
             m.category,
             m.source,
             m.source_system,
             m.embedding_status,
             m.updated_at,
             case
               when coalesce(m.source_metadata->>'document_kind', '') = 'outlook_conversation'
                 or m.type = 'outlook_conversation'
                 or m.id like 'outlook_conversation_%'
                 then 'outlook'
               when coalesce(m.source_metadata->>'document_kind', '') = 'teams_dm_conversation'
                 or m.type = 'teams_dm_conversation'
                 or m.id like 'teamsdm_%'
                 then 'teams_dm'
               when coalesce(m.source_metadata->>'document_kind', '') in ('teams_channel_thread', 'teams_message')
                 or m.type = 'teams_message'
                 or m.id like 'teams_%'
                 then 'teams_channel'
               else null
             end as graph_kind
      from public.rag_document_metadata m
      where m.source = 'microsoft_graph'
        ${windowSql}
        and (
          coalesce(m.source_metadata->>'document_kind', '') in (
            'outlook_conversation',
            'teams_dm_conversation',
            'teams_channel_thread',
            'teams_message'
          )
          or m.type in ('outlook_conversation', 'teams_dm_conversation', 'teams_message')
          or m.id like 'outlook_conversation_%'
          or m.id like 'teamsdm_%'
          or m.id like 'teams_%'
        )
    )
    select d.graph_kind,
           count(distinct d.id)::int as docs,
           count(c.chunk_id)::int as chunks,
           count(c.chunk_id) filter(where c.embedding is not null)::int as embedded_chunks,
           count(distinct d.id) filter(where c.chunk_id is null)::int as docs_without_chunks,
           count(distinct d.id) filter(where c.chunk_id is null and d.embedding_status = 'embedded')::int as embedded_docs_without_chunks,
           array_remove(array_agg(distinct c.source_type order by c.source_type), null) as source_types,
           max(d.updated_at) as newest_doc
    from graph_docs d
    left join public.document_chunks c on c.document_id = d.id
    where d.graph_kind is not null
    group by d.graph_kind
    order by d.graph_kind
    `,
    params,
  );
  return rows;
}

async function readBadChunks(client, { days }) {
  const windowSql = days > 0 ? "and m.updated_at >= now() - ($1::int * interval '1 day')" : "";
  const params = days > 0 ? [days] : [];
  const { rows } = await client.query(
    `
    with graph_docs as (
      select m.id,
             left(coalesce(m.title, m.id), 90) as title,
             m.type,
             m.embedding_status,
             m.updated_at,
             case
               when coalesce(m.source_metadata->>'document_kind', '') = 'outlook_conversation'
                 or m.type = 'outlook_conversation'
                 or m.id like 'outlook_conversation_%'
                 then 'outlook'
               when coalesce(m.source_metadata->>'document_kind', '') = 'teams_dm_conversation'
                 or m.type = 'teams_dm_conversation'
                 or m.id like 'teamsdm_%'
                 then 'teams_dm'
               when coalesce(m.source_metadata->>'document_kind', '') in ('teams_channel_thread', 'teams_message')
                 or m.type = 'teams_message'
                 or m.id like 'teams_%'
                 then 'teams_channel'
               else null
             end as graph_kind
      from public.rag_document_metadata m
      where m.source = 'microsoft_graph'
        ${windowSql}
        and (
          coalesce(m.source_metadata->>'document_kind', '') in (
            'outlook_conversation',
            'teams_dm_conversation',
            'teams_channel_thread',
            'teams_message'
          )
          or m.type in ('outlook_conversation', 'teams_dm_conversation', 'teams_message')
          or m.id like 'outlook_conversation_%'
          or m.id like 'teamsdm_%'
          or m.id like 'teams_%'
        )
    )
    select d.graph_kind,
           d.id as document_id,
           d.title,
           d.type,
           d.embedding_status,
           array_agg(distinct c.source_type order by c.source_type) as source_types,
           count(c.chunk_id)::int as chunks,
           count(c.chunk_id) filter(where c.embedding is not null)::int as embedded_chunks,
           max(c.updated_at) as newest_chunk
    from graph_docs d
    join public.document_chunks c on c.document_id = d.id
    where d.graph_kind is not null
      and (
        (d.graph_kind = 'outlook' and c.source_type <> all($${params.length + 1}::text[]))
        or (d.graph_kind = 'teams_dm' and c.source_type <> all($${params.length + 2}::text[]))
        or (d.graph_kind = 'teams_channel' and c.source_type <> all($${params.length + 3}::text[]))
        or c.source_type is null
      )
    group by d.graph_kind, d.id, d.title, d.type, d.embedding_status
    order by max(c.updated_at) desc nulls last, d.id
    limit 25
    `,
    [
      ...params,
      allowedSourceTypes.outlook,
      allowedSourceTypes.teams_dm,
      allowedSourceTypes.teams_channel,
    ],
  );
  return rows;
}

async function readGenericChunkCounts(client, { days }) {
  const windowSql = days > 0 ? "and m.updated_at >= now() - ($2::int * interval '1 day')" : "";
  const params = days > 0 ? [genericSourceTypes, days] : [genericSourceTypes];
  const { rows } = await client.query(
    `
    select c.source_type,
           count(distinct m.id)::int as docs,
           count(c.chunk_id)::int as chunks,
           max(c.updated_at) as newest_chunk
    from public.rag_document_metadata m
    join public.document_chunks c on c.document_id = m.id
    where m.source = 'microsoft_graph'
      ${windowSql}
      and c.source_type = any($1::text[])
      and (
        coalesce(m.source_metadata->>'document_kind', '') in (
          'outlook_conversation',
          'teams_dm_conversation',
          'teams_channel_thread',
          'teams_message'
        )
        or m.type in ('outlook_conversation', 'teams_dm_conversation', 'teams_message')
        or m.id like 'outlook_conversation_%'
        or m.id like 'teamsdm_%'
        or m.id like 'teams_%'
      )
    group by c.source_type
    order by chunks desc, c.source_type
    `,
    params,
  );
  return rows;
}

async function main() {
  loadEnvFile(path.join(repoRoot, ".env"));
  loadEnvFile(path.join(repoRoot, "frontend/.env.local"));

  const args = parseArgs(process.argv.slice(2));
  const days = Number(args.get("days") || 0);
  const strictMissingChunks = args.get("strict-missing-chunks") === "true";

  const client = await connect();
  try {
    const summary = await readSummary(client, { days });
    const badChunks = await readBadChunks(client, { days });
    const genericCounts = await readGenericChunkCounts(client, { days });

    console.log(`# Graph Conversation Chunk Ownership${days > 0 ? ` (${days}d)` : ""}`);
    console.log("");
    if (summary.length === 0) {
      console.log("No Graph conversation documents matched the verifier scope.");
    } else {
      console.log(mdTable(
        [
          "Kind",
          "Docs",
          "Chunks",
          "Embedded Chunks",
          "Docs Without Chunks",
          "Embedded Docs Without Chunks",
          "Source Types",
          "Newest Doc",
        ],
        summary.map((row) => [
          row.graph_kind,
          formatNumber(row.docs),
          formatNumber(row.chunks),
          formatNumber(row.embedded_chunks),
          formatNumber(row.docs_without_chunks),
          formatNumber(row.embedded_docs_without_chunks),
          (row.source_types || []).join(", "),
          row.newest_doc?.toISOString?.() || row.newest_doc,
        ]),
      ));
    }

    const failures = [];
    const warnings = [];

    if (badChunks.length > 0) {
      failures.push("Graph-owned conversation docs have chunks with disallowed source_type values.");
      console.error("\nDisallowed Graph conversation chunks:");
      console.error(mdTable(
        ["Kind", "Document", "Status", "Type", "Chunks", "Embedded", "Source Types", "Newest Chunk"],
        badChunks.map((row) => [
          row.graph_kind,
          row.document_id,
          row.embedding_status,
          row.type,
          formatNumber(row.chunks),
          formatNumber(row.embedded_chunks),
          (row.source_types || []).join(", "),
          row.newest_chunk?.toISOString?.() || row.newest_chunk,
        ]),
      ));
    }

    if (genericCounts.length > 0) {
      failures.push("Generic document/meeting source types exist on Graph-owned conversation docs.");
      console.error("\nGeneric source type counts on Graph conversations:");
      console.error(mdTable(
        ["Source Type", "Docs", "Chunks", "Newest Chunk"],
        genericCounts.map((row) => [
          row.source_type,
          formatNumber(row.docs),
          formatNumber(row.chunks),
          row.newest_chunk?.toISOString?.() || row.newest_chunk,
        ]),
      ));
    }

    const embeddedWithoutChunks = summary.reduce(
      (total, row) => total + Number(row.embedded_docs_without_chunks || 0),
      0,
    );
    if (embeddedWithoutChunks > 0) {
      const message = `${formatNumber(embeddedWithoutChunks)} embedded Graph conversation doc(s) have no chunks.`;
      if (strictMissingChunks) failures.push(message);
      else warnings.push(message);
    }

    if (warnings.length > 0) {
      console.log("\nWarnings:");
      for (const warning of warnings) console.log(`- ${warning}`);
    }

    if (failures.length > 0) {
      console.error("\nGraph conversation chunk ownership: FAIL");
      for (const failure of failures) console.error(`- ${failure}`);
      process.exitCode = 1;
      return;
    }

    console.log("\nGraph conversation chunk ownership: PASS");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
