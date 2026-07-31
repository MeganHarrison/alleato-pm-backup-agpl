#!/usr/bin/env node

/**
 * RAG chunk integrity guardrail.
 *
 * This catches the failure mode where upstream exports save only a preview,
 * such as "... (showing 50 of N sentences)", and those preview chunks are
 * embedded as if they were complete source content.
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

const fatalPatterns = [
  {
    label: "low-content placeholder chunk",
    sql: "text ~* '^Minimal extract for .*Parsed content was only [0-9]+ characters and may require OCR or a different source format'",
  },
  {
    label: "Fireflies preview transcript marker",
    sql: "text ~* '\\\\.\\\\.\\\\. \\\\(showing 50 of [0-9]+ sentences\\\\)'",
  },
  {
    label: "generic preview transcript marker",
    sql: "text ~* 'showing 50 of [0-9]+ sentences'",
  },
];

const suspiciousPatterns = [
  {
    label: "generic showing-count wording",
    sql: "text ~* 'showing [0-9]+ of [0-9]+'",
  },
  {
    label: "truncated wording",
    sql: "text ~* '\\\\btruncated\\\\b'",
  },
];

const metadataRequiredSourceTypes = [
  "document",
  "email",
  "meeting_segment_summary",
  "meeting_summary",
  "meeting_transcript",
  "vision_page_summary",
];

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

function mdTable(headers, rows) {
  const line = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell ?? "")).join(" | ")} |`);
  return [line, sep, ...body].join("\n");
}

function fmt(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

async function connect() {
  const connectionString = process.env.RAG_DATABASE_URL;
  if (!connectionString) throw new Error("Missing RAG_DATABASE_URL.");
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslkey");
  url.searchParams.delete("sslrootcert");
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    statement_timeout: 60000,
    application_name: "alleato-rag-chunk-integrity",
    allowExitOnIdle: true,
  });
  await client.connect();
  return client;
}

async function sourceSummary(client, whereSql) {
  const { rows } = await client.query(`
    select source_type,
           count(distinct document_id)::int as docs,
           count(*)::int as chunks,
           count(*) filter(where embedding is not null)::int as embedded_chunks,
           count(*) filter(where embedding is null)::int as missing_embedding_chunks,
           count(*) filter(where length(coalesce(text, '')) < 100)::int as short_chunks
    from public.document_chunks
    ${whereSql}
    group by source_type
    order by source_type
  `);
  return rows;
}

async function patternCounts(client, patterns, whereSql) {
  const rows = [];
  for (const pattern of patterns) {
    const result = await client.query(`
      select source_type,
             count(distinct document_id)::int as docs,
             count(*)::int as chunks
      from public.document_chunks
      ${whereSql}
      ${whereSql ? "and" : "where"} ${pattern.sql}
      group by source_type
      order by chunks desc, source_type
    `);
    for (const row of result.rows) {
      rows.push({
        pattern: pattern.label,
        source_type: row.source_type,
        docs: row.docs,
        chunks: row.chunks,
      });
    }
  }
  return rows;
}

async function sequentialFailures(client, whereSql) {
  const { rows } = await client.query(`
    with grouped as (
      select source_type,
             document_id,
             array_agg(chunk_index order by chunk_index) as indexes,
             count(*)::int as chunks,
             count(distinct chunk_index)::int as distinct_indexes,
             min(chunk_index)::int as min_index,
             max(chunk_index)::int as max_index
      from public.document_chunks
      ${whereSql}
      group by source_type, document_id
    )
    select source_type,
           count(*)::int as docs
    from grouped
    where min_index <> 0
       or distinct_indexes <> chunks
       or max_index <> chunks - 1
    group by source_type
    order by docs desc, source_type
  `);
  return rows;
}

async function orphanMetadataFailures(client, whereSql) {
  const chunkWhereSql = whereSql.replace(/\bupdated_at\b/g, "c.updated_at");
  const wherePrefix = chunkWhereSql ? `${chunkWhereSql} and` : "where";
  const { rows } = await client.query(`
    select c.source_type,
           count(distinct c.document_id)::int as docs,
           count(*)::int as chunks,
           max(c.updated_at) as newest_chunk
    from public.document_chunks c
    left join public.rag_document_metadata m on m.id = c.document_id
    ${wherePrefix} c.source_type = any($1::text[])
      and m.id is null
    group by c.source_type
    order by chunks desc, c.source_type
  `, [metadataRequiredSourceTypes]);
  return rows;
}

async function examples(client, patternSql, whereSql) {
  const { rows } = await client.query(`
    select source_type,
           document_id,
           chunk_index,
           left(regexp_replace(text, '\\s+', ' ', 'g'), 220) as preview
    from public.document_chunks
    ${whereSql}
    ${whereSql ? "and" : "where"} ${patternSql}
    order by updated_at desc nulls last, created_at desc nulls last
    limit 10
  `);
  return rows;
}

async function orphanMetadataExamples(client, whereSql) {
  const chunkWhereSql = whereSql.replace(/\bupdated_at\b/g, "c.updated_at");
  const wherePrefix = chunkWhereSql ? `${chunkWhereSql} and` : "where";
  const { rows } = await client.query(`
    select c.source_type,
           c.document_id,
           count(*)::int as chunks,
           count(*) filter(where c.embedding is not null)::int as embedded_chunks,
           max(c.updated_at) as newest_chunk
    from public.document_chunks c
    left join public.rag_document_metadata m on m.id = c.document_id
    ${wherePrefix} c.source_type = any($1::text[])
      and m.id is null
    group by c.source_type, c.document_id
    order by newest_chunk desc nulls last
    limit 10
  `, [metadataRequiredSourceTypes]);
  return rows;
}

async function repairOrphanMetadata(client, whereSql) {
  const chunkWhereSql = whereSql.replace(/\bupdated_at\b/g, "c.updated_at");
  const wherePrefix = chunkWhereSql ? `${chunkWhereSql} and` : "where";
  const { rows } = await client.query(`
    with orphan_docs as (
      select c.document_id,
             min(c.source_type) as source_type,
             min(c.created_at) as created_at,
             max(c.updated_at) as updated_at,
             string_agg(c.text, E'\n\n' order by c.chunk_index) as content,
             max(c.content_hash) as content_hash,
             max(nullif(c.metadata->>'title', '')) as title,
             max(nullif(c.metadata->>'file_date', '')) as file_date,
             max(nullif(c.metadata->>'project_id', '')) as project_id_text,
             jsonb_object_agg(c.chunk_index::text, coalesce(c.metadata, '{}'::jsonb)) as chunk_metadata
      from public.document_chunks c
      left join public.rag_document_metadata m on m.id = c.document_id
      ${wherePrefix} c.source_type = any($1::text[])
        and m.id is null
      group by c.document_id
    )
    insert into public.rag_document_metadata (
      id,
      app_document_id,
      project_id,
      source,
      source_system,
      source_item_id,
      title,
      type,
      category,
      content,
      raw_text,
      content_hash,
      content_length,
      parsing_status,
      embedding_status,
      processing_metadata,
      source_metadata,
      last_synced_at,
      last_content_loaded_at,
      last_indexed_at,
      created_at,
      updated_at
    )
    select document_id,
           document_id,
           case when project_id_text ~ '^[0-9]+$' then project_id_text::int else null end,
           case
             when source_type like 'meeting%' then 'fireflies'
             when source_type = 'email' then 'outlook'
             when source_type = 'vision_page_summary' then 'document_vision'
             else source_type
           end,
           case
             when source_type like 'meeting%' then 'fireflies'
             when source_type = 'email' then 'outlook'
             else source_type
           end,
           document_id,
           coalesce(title, document_id),
           case
             when source_type in ('meeting_summary', 'meeting_transcript', 'meeting_segment_summary') then 'meeting'
             when source_type = 'vision_page_summary' then 'vision_page_summary'
             else source_type
           end,
           case
             when source_type like 'meeting%' then 'meeting'
             when source_type = 'email' then 'email'
             else 'document'
           end,
           content,
           content,
           content_hash,
           length(coalesce(content, '')),
           'complete',
           'embedded',
           jsonb_build_object(
             'repair_source', 'verify_rag_chunk_integrity',
             'repair_reason', 'document_chunks existed without rag_document_metadata',
             'repaired_at', now()
           ),
           jsonb_build_object(
             'source_type', source_type,
             'file_date', file_date,
             'chunk_metadata', chunk_metadata
           ),
           updated_at,
           updated_at,
           updated_at,
           created_at,
           now()
    from orphan_docs
    on conflict (id) do nothing
    returning id, source_system, type, category
  `, [metadataRequiredSourceTypes]);
  return rows;
}

async function main() {
  loadEnvFile(path.join(repoRoot, ".env"));
  loadEnvFile(path.join(repoRoot, "frontend/.env.local"));

  const args = parseArgs(process.argv.slice(2));
  const days = Number(args.get("days") || 0);
  const strictIndexes = args.get("strict-indexes") === "true";
  const repairOrphans = args.get("repair-orphan-metadata") === "true";
  const whereSql = Number.isFinite(days) && days > 0
    ? `where updated_at >= now() - interval '${Math.floor(days)} days'`
    : "";

  const client = await connect();
  try {
    if (repairOrphans) {
      const repaired = await repairOrphanMetadata(client, whereSql);
      console.log(`Repaired orphan rag_document_metadata rows: ${fmt(repaired.length)}`);
    }

    const summary = await sourceSummary(client, whereSql);
    const fatal = await patternCounts(client, fatalPatterns, whereSql);
    const suspicious = await patternCounts(client, suspiciousPatterns, whereSql);
    const nonSequential = await sequentialFailures(client, whereSql);
    const orphanMetadata = await orphanMetadataFailures(client, whereSql);
    const missingEmbedding = summary.filter((row) => row.missing_embedding_chunks > 0);

    console.log(`# RAG Chunk Integrity${days > 0 ? ` (${days}d)` : ""}`);
    console.log("");
    console.log(mdTable(
      ["Source", "Docs", "Chunks", "Embedded", "Missing Embeddings", "Short Chunks"],
      summary.map((row) => [
        row.source_type,
        fmt(row.docs),
        fmt(row.chunks),
        fmt(row.embedded_chunks),
        fmt(row.missing_embedding_chunks),
        fmt(row.short_chunks),
      ]),
    ));

    if (suspicious.length) {
      console.log("\nSuspicious text matches, review only:");
      console.log(mdTable(
        ["Pattern", "Source", "Docs", "Chunks"],
        suspicious.map((row) => [row.pattern, row.source_type, fmt(row.docs), fmt(row.chunks)]),
      ));
    }
    if (nonSequential.length) {
      const heading = strictIndexes
        ? "\nNon-sequential documents:"
        : "\nNon-sequential documents, warning only:";
      console.log(heading);
      console.log(mdTable(
        ["Source", "Docs"],
        nonSequential.map((row) => [row.source_type, fmt(row.docs)]),
      ));
    }

    const failures = [];
    if (fatal.length) {
      failures.push("Fatal truncated-export markers found in document_chunks.");
      console.error("\nFatal truncated-export matches:");
      console.error(mdTable(
        ["Pattern", "Source", "Docs", "Chunks"],
        fatal.map((row) => [row.pattern, row.source_type, fmt(row.docs), fmt(row.chunks)]),
      ));
      const firstPattern = fatalPatterns[0]?.sql || fatalPatterns[1].sql;
      const sampleRows = await examples(client, firstPattern, whereSql);
      if (sampleRows.length) {
        console.error("\nExamples:");
        console.error(mdTable(
          ["Source", "Document", "Chunk", "Preview"],
          sampleRows.map((row) => [row.source_type, row.document_id, row.chunk_index, row.preview]),
        ));
      }
    }
    if (missingEmbedding.length) {
      failures.push("Chunks missing embeddings found.");
      console.error("\nMissing embeddings:");
      console.error(mdTable(
        ["Source", "Chunks"],
        missingEmbedding.map((row) => [row.source_type, fmt(row.missing_embedding_chunks)]),
      ));
    }
    if (strictIndexes && nonSequential.length) {
      failures.push("Non-sequential or duplicate chunk indexes found.");
      console.error("\nNon-sequential documents:");
      console.error(mdTable(
        ["Source", "Docs"],
        nonSequential.map((row) => [row.source_type, fmt(row.docs)]),
      ));
    }
    if (orphanMetadata.length) {
      failures.push("Document-like chunks without rag_document_metadata rows found.");
      console.error("\nOrphan chunk metadata:");
      console.error(mdTable(
        ["Source", "Docs", "Chunks", "Newest Chunk"],
        orphanMetadata.map((row) => [
          row.source_type,
          fmt(row.docs),
          fmt(row.chunks),
          row.newest_chunk,
        ]),
      ));
      const orphanExamples = await orphanMetadataExamples(client, whereSql);
      if (orphanExamples.length) {
        console.error("\nOrphan metadata examples:");
        console.error(mdTable(
          ["Source", "Document", "Chunks", "Embedded", "Newest Chunk"],
          orphanExamples.map((row) => [
            row.source_type,
            row.document_id,
            fmt(row.chunks),
            fmt(row.embedded_chunks),
            row.newest_chunk,
          ]),
        ));
      }
    }

    if (failures.length) {
      console.error("\nRAG chunk integrity: FAIL");
      for (const failure of failures) console.error(`- ${failure}`);
      process.exitCode = 1;
      return;
    }

    console.log("\nRAG chunk integrity: PASS");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
