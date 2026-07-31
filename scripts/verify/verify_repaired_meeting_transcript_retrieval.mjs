#!/usr/bin/env node

/**
 * Retrieval spot check for repaired Fireflies meeting transcript chunks.
 *
 * This verifies the end-to-end path used by semanticSearch:
 * query embedding -> search_document_chunks RPC -> meeting_transcript results.
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

const EMBEDDING_DIMS = 3072;
const EMBEDDING_MODEL = "text-embedding-3-large";
const AI_GATEWAY_BASE = "https://ai-gateway.vercel.sh/v1";
const OPENAI_BASE = "https://api.openai.com/v1";

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

function fmt(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function mdTable(headers, rows) {
  const line = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell ?? "")).join(" | ")} |`);
  return [line, sep, ...body].join("\n");
}

function normalizeQuery(text) {
  return String(text || "")
    .replace(/^## Transcript\s*/i, "")
    .replace(/\[[0-9]{2}:[0-9]{2}\]\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

async function connect(connectionString, applicationName) {
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
    application_name: applicationName,
    allowExitOnIdle: true,
  });
  await client.connect();
  return client;
}

async function embed(text) {
  const providers = [
    process.env.AI_GATEWAY_API_KEY
      ? {
          label: "AI Gateway",
          base: AI_GATEWAY_BASE,
          key: process.env.AI_GATEWAY_API_KEY,
          model: `openai/${EMBEDDING_MODEL}`,
        }
      : null,
    process.env.OPENAI_API_KEY
      ? {
          label: "OpenAI direct",
          base: OPENAI_BASE,
          key: process.env.OPENAI_API_KEY,
          model: EMBEDDING_MODEL,
        }
      : null,
  ].filter(Boolean);

  if (!providers.length) throw new Error("AI_GATEWAY_API_KEY or OPENAI_API_KEY is required.");

  const errors = [];
  for (const provider of providers) {
    const response = await fetch(`${provider.base}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        dimensions: EMBEDDING_DIMS,
        input: text,
      }),
    });
    if (!response.ok) {
      errors.push(`${provider.label}: ${response.status} ${(await response.text()).slice(0, 240)}`);
      continue;
    }
    const json = await response.json();
    const embedding = json.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMS) {
      errors.push(`${provider.label}: invalid embedding dimensions`);
      continue;
    }
    return embedding;
  }
  throw new Error(`Embedding failed: ${errors.join(" | ")}`);
}

async function selectProbes(client, limit) {
  const { rows } = await client.query(
    `
    with repaired_docs as (
      select m.id,
             m.title,
             max(c.chunk_index)::int as max_chunk_index,
             count(c.chunk_id)::int as chunks
      from public.rag_document_metadata m
      join public.document_chunks c on c.document_id = m.id
      where c.source_type = 'meeting_transcript'
        and c.embedding is not null
        and m.processing_metadata->'transcript_chunk_backfill'->>'script' = 'backfill-fireflies-transcript-chunks-from-storage'
        and m.processing_metadata->'transcript_chunk_backfill'->>'content_source' in (
          'fireflies_api_fallback',
          'document_metadata.raw_text'
        )
      group by m.id, m.title
      having count(c.chunk_id) >= 5
      order by max(length(m.raw_text)) desc nulls last
      limit $1
    ),
    selected_chunks as (
      select d.id,
             d.title,
             d.chunks,
             greatest(0, floor(d.max_chunk_index * 0.6))::int as target_chunk_index
      from repaired_docs d
    )
    select s.id as document_id,
           s.title,
           s.chunks,
           c.chunk_index,
           c.text
    from selected_chunks s
    join public.document_chunks c
      on c.document_id = s.id
     and c.source_type = 'meeting_transcript'
     and c.chunk_index = s.target_chunk_index
    order by s.chunks desc, s.title
    `,
    [limit],
  );
  return rows.map((row) => ({
    ...row,
    query: normalizeQuery(row.text),
  })).filter((row) => row.query.length >= 80);
}

async function search(client, embedding) {
  const embeddingLiteral = `[${embedding.join(",")}]`;
  const { rows } = await client.query(
    `
    select document_id,
           source_type,
           chunk_index,
           similarity,
           left(regexp_replace(chunk_text, '\\s+', ' ', 'g'), 180) as preview
    from public.search_document_chunks(
      $1::halfvec(3072),
      array['meeting_transcript'],
      null,
      8,
      0.1
    )
    `,
    [embeddingLiteral],
  );
  return rows;
}

async function main() {
  loadEnvFile(path.join(repoRoot, ".env"));
  loadEnvFile(path.join(repoRoot, "frontend/.env.local"));

  const client = await connect(
    process.env.RAG_DATABASE_URL,
    "alleato-repaired-transcript-retrieval",
  );
  try {
    const probes = await selectProbes(client, 5);
    if (!probes.length) throw new Error("No repaired meeting transcript probes were available.");

    const results = [];
    const failures = [];
    for (const probe of probes) {
      const embedding = await embed(probe.query);
      const rows = await search(client, embedding);
      const rank = rows.findIndex((row) => row.document_id === probe.document_id) + 1;
      const top = rows[0];
      const passed = rank > 0 && rank <= 3 && top?.source_type === "meeting_transcript";
      if (!passed) {
        failures.push({
          document_id: probe.document_id,
          title: probe.title,
          expected_chunk: probe.chunk_index,
          rank: rank || "missing",
          top_document: top?.document_id || "none",
          top_source: top?.source_type || "none",
        });
      }
      results.push({
        title: probe.title,
        document_id: probe.document_id,
        chunks: probe.chunks,
        expected_chunk: probe.chunk_index,
        rank: rank || "missing",
        top_similarity: top?.similarity == null ? "none" : Number(top.similarity).toFixed(3),
        top_source: top?.source_type || "none",
      });
    }

    console.log("# Repaired Meeting Transcript Retrieval");
    console.log("");
    console.log(mdTable(
      ["Title", "Document", "Chunks", "Probe Chunk", "Expected Rank", "Top Similarity", "Top Source"],
      results.map((row) => [
        row.title,
        row.document_id,
        fmt(row.chunks),
        row.expected_chunk,
        row.rank,
        row.top_similarity,
        row.top_source,
      ]),
    ));

    if (failures.length) {
      console.error("\nRetrieval failures:");
      console.error(mdTable(
        ["Title", "Document", "Probe Chunk", "Rank", "Top Document", "Top Source"],
        failures.map((row) => [
          row.title,
          row.document_id,
          row.expected_chunk,
          row.rank,
          row.top_document,
          row.top_source,
        ]),
      ));
      console.error("\nRepaired meeting transcript retrieval: FAIL");
      process.exitCode = 1;
      return;
    }

    console.log("\nRepaired meeting transcript retrieval: PASS");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
