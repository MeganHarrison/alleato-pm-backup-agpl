#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

function hydrateEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = rawValue;
  }
}

hydrateEnv(path.join(process.cwd(), ".env"));
hydrateEnv(path.join(process.cwd(), "frontend", ".env.local"));
hydrateEnv(path.join(process.cwd(), "backend", ".env"));

const ragDatabaseUrl = process.env.RAG_DATABASE_URL;
const openaiKey = process.env.OPENAI_API_KEY;
const aiGatewayKey = process.env.AI_GATEWAY_API_KEY;

if (!ragDatabaseUrl) {
  console.error("FAIL: RAG_DATABASE_URL is required.");
  process.exit(1);
}

if (!aiGatewayKey && !openaiKey) {
  console.error("FAIL: AI_GATEWAY_API_KEY or OPENAI_API_KEY is required to embed the live eval query.");
  process.exit(1);
}

function keywordSet(value) {
  return new Set(
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 4)
      .slice(0, 8),
  );
}

function keywordHits(rows, keywords) {
  return rows
    .slice(0, 5)
    .reduce((count, row) => {
      const text = `${row.doc_title ?? ""} ${row.chunk_text ?? ""}`.toLowerCase();
      return count + [...keywords].filter((word) => text.includes(word)).length;
    }, 0);
}

async function embedQuery(query) {
  const gatewayEnabled = Boolean(aiGatewayKey);
  const response = await fetch(
    gatewayEnabled
      ? "https://ai-gateway.vercel.sh/v1/embeddings"
      : "https://api.openai.com/v1/embeddings",
    {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gatewayEnabled ? aiGatewayKey : openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: gatewayEnabled ? "openai/text-embedding-3-large" : "text-embedding-3-large",
      dimensions: 3072,
      input: query.slice(0, 8000),
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`embedding request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text);
  return `[${json.data[0].embedding.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

async function search(client, embedding, mode, queryText, telemetryEnabled) {
  const result = await client.query(
    `
      select *
      from public.search_document_chunks(
        $1::extensions.halfvec,
        null::text[],
        null::bigint,
        8,
        0.15,
        $2::text,
        $3::text,
        $4::boolean,
        $5::text,
        $6::text
      )
    `,
    [
      embedding,
      mode,
      queryText,
      telemetryEnabled,
      "hybrid-rag-ranking-eval",
      `verify_hybrid_rag_ranking:${mode}`,
    ],
  );
  return result.rows;
}

function pgConnectionStringWithoutSslMode(value) {
  const url = new URL(value);
  url.searchParams.delete("sslmode");
  return url.toString();
}

const client = new Client({
  connectionString: pgConnectionStringWithoutSslMode(ragDatabaseUrl),
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const sample = await client.query(`
    select chunk_id, text, metadata
    from public.document_chunks
    where embedding is not null
      and length(coalesce(text, '')) > 120
    order by created_at desc nulls last
    limit 1
  `);

  if (sample.rowCount === 0) {
    throw new Error("no embedded document_chunks rows available for eval");
  }

  const sampleText = String(sample.rows[0].text);
  const queryText = [...keywordSet(sampleText)].join(" ");
  if (!queryText) {
    throw new Error(`sample chunk ${sample.rows[0].chunk_id} did not produce eval keywords`);
  }

  const embedding = await embedQuery(queryText);
  const vectorRows = await search(client, embedding, "vector", queryText, false);
  const hybridRows = await search(client, embedding, "hybrid", queryText, true);

  if (vectorRows.length === 0 || hybridRows.length === 0) {
    throw new Error(`expected vector and hybrid results, got vector=${vectorRows.length}, hybrid=${hybridRows.length}`);
  }

  const keywords = keywordSet(queryText);
  const vectorHits = keywordHits(vectorRows, keywords);
  const hybridHits = keywordHits(hybridRows, keywords);
  const missingComponentRows = hybridRows.filter(
    (row) =>
      row.ranking_mode_used !== "hybrid" ||
      row.vector_score === null ||
      row.text_score === null ||
      row.recall_score === null ||
      row.recency_score === null ||
      row.hybrid_score === null,
  );

  if (missingComponentRows.length > 0) {
    throw new Error(`hybrid returned ${missingComponentRows.length} row(s) with missing score components`);
  }

  if (hybridHits < vectorHits) {
    throw new Error(`hybrid lexical coverage regressed: hybrid=${hybridHits}, vector=${vectorHits}`);
  }

  const telemetry = await client.query(
    `
      select coalesce(sum(recall_count), 0)::integer as recall_count
      from public.document_chunk_retrieval_telemetry
      where retrieval_mode = 'hybrid'
        and last_trace_id = 'verify_hybrid_rag_ranking:hybrid'
        and last_recalled_at > now() - interval '10 minutes'
    `,
  );

  if (Number(telemetry.rows[0]?.recall_count ?? 0) <= 0) {
    throw new Error("hybrid telemetry readback did not find recent recall rows");
  }

  console.log(
    JSON.stringify(
      {
        status: "pass",
        queryText,
        vectorTopChunk: vectorRows[0].chunk_id,
        hybridTopChunk: hybridRows[0].chunk_id,
        vectorHits,
        hybridHits,
        hybridTopScore: Number(hybridRows[0].hybrid_score).toFixed(4),
        telemetryRecallCount: Number(telemetry.rows[0].recall_count),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
