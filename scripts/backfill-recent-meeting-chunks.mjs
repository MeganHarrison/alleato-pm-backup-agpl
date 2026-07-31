#!/usr/bin/env node

/**
 * Backfill document_chunks for recent Fireflies meetings that already have
 * document_metadata.content but no chunk rows.
 *
 * This is intentionally loud: provider failures abort, and the script exits
 * non-zero if any selected meeting could not be chunked and embedded.
 */

import dotenv from "dotenv";
import { createHash } from "crypto";
import postgres from "postgres";

dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: "frontend/.env.local", override: true, quiet: true });

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const ragDatabaseUrl = process.env.RAG_DATABASE_URL;
const ragWritesEnabled = String(process.env.RAG_DATABASE_WRITES_ENABLED ?? "").toLowerCase() === "true";
const appRestUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const appRestKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;
const ragRestUrl = process.env.RAG_SUPABASE_URL;
const ragRestKey = process.env.RAG_SUPABASE_SERVICE_ROLE_KEY;
const aiGatewayKey = process.env.AI_GATEWAY_API_KEY;
const openAiKey = process.env.OPENAI_API_KEY;
const days = Number(process.argv.find((arg) => arg.startsWith("--days="))?.split("=")[1] ?? 14);
const limit = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 500);
const dryRun = process.argv.includes("--dry-run");

if (!databaseUrl) {
  console.error("[FATAL] DATABASE_URL or SUPABASE_DB_URL is required.");
  process.exit(1);
}

if (ragWritesEnabled && !ragDatabaseUrl) {
  console.error("[FATAL] RAG_DATABASE_WRITES_ENABLED=true but RAG_DATABASE_URL is not set.");
  process.exit(1);
}

if (!aiGatewayKey && !openAiKey) {
  console.error("[FATAL] AI_GATEWAY_API_KEY or OPENAI_API_KEY is required.");
  process.exit(1);
}

if ((!databaseUrl || !ragDatabaseUrl) && (!appRestUrl || !appRestKey || !ragRestUrl || !ragRestKey)) {
  console.error(
    "[FATAL] Direct DB URLs are missing and REST fallback is not fully configured. " +
      "Need SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY and RAG_SUPABASE_URL/RAG_SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, ssl: "require" });
const ragSql = ragWritesEnabled
  ? postgres(ragDatabaseUrl, { max: 1, ssl: "require", prepare: false })
  : sql;
const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMS = 3072;
const CHUNK_TARGET_CHARS = 3000;
const CHUNK_OVERLAP_CHARS = 500;
const EXCLUDED_DOCUMENT_STATUSES = new Set([
  "intentionally_excluded",
  "deleted_no_transcript",
  "metadata_only",
  "not_vectorizable",
  "skipped_low_content",
]);

function hashContent(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

function chunkText(text) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= CHUNK_TARGET_CHARS) return [normalized];

  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_TARGET_CHARS, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf("\n\n", end);
      if (boundary > start + 1000) end = boundary;
    }
    chunks.push(normalized.slice(start, end).trim());
    if (end >= normalized.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP_CHARS);
  }
  return chunks.filter((chunk) => chunk.length >= 100);
}

function isExcludedMeeting(row) {
  const status = String(row.status ?? "").trim();
  if (EXCLUDED_DOCUMENT_STATUSES.has(status)) return true;

  const titleSignal = `${row.title ?? ""} ${row.category ?? ""} ${row.type ?? ""}`.toLowerCase();
  return titleSignal.includes("interview") || titleSignal.includes("inteview");
}

async function embed(texts) {
  const errors = [];
  const attempts = [
    aiGatewayKey
      ? {
          label: "AI Gateway",
          url: "https://ai-gateway.vercel.sh/v1/embeddings",
          key: aiGatewayKey,
          model: `openai/${EMBEDDING_MODEL}`,
        }
      : null,
    openAiKey
      ? {
          label: "OpenAI direct",
          url: "https://api.openai.com/v1/embeddings",
          key: openAiKey,
          model: EMBEDDING_MODEL,
        }
      : null,
  ].filter(Boolean);

  for (const attempt of attempts) {
    const response = await fetch(attempt.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${attempt.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: attempt.model,
        input: texts.map((text) => text.slice(0, 8000)),
        dimensions: EMBEDDING_DIMS,
      }),
    });

    if (!response.ok) {
      errors.push(`${attempt.label}: ${response.status} ${(await response.text()).slice(0, 300)}`);
      continue;
    }

    const data = await response.json();
    if (data.data.length !== texts.length) {
      errors.push(`${attempt.label}: expected ${texts.length} embeddings, got ${data.data.length}`);
      continue;
    }
    return data.data.map((item) => item.embedding);
  }

  throw new Error(`Embedding failed across all providers: ${errors.join(" | ")}`);
}

async function restSelect(baseUrl, key, path, { timeoutMs = 30_000 } = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      Prefer: "count=exact",
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${text.slice(0, 300)}`);
  }
  return {
    data: JSON.parse(text || "[]"),
    count: Number((response.headers.get("content-range") || "0/0").split("/").pop() || 0),
  };
}

async function restUpsert(baseUrl, key, path, records, { timeoutMs = 120_000 } = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(records),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${text.slice(0, 300)}`);
  }
}

function buildRagMetadataRow(row, baseText, sourceType) {
  const contentHash = hashContent(baseText);
  return {
    id: row.id,
    app_document_id: row.id,
    project_id: row.project_id ?? null,
    source: "fireflies",
    source_system: "fireflies",
    source_item_id: row.fireflies_id || row.id,
    fireflies_id: row.fireflies_id || row.id,
    title: row.title || "Untitled Meeting",
    type: sourceType === "meeting_transcript" ? "meeting_transcript" : "meeting",
    category: "meeting",
    content: baseText,
    raw_text: baseText,
    content_hash: contentHash,
    content_length: baseText.length,
    parsing_status: "complete",
    embedding_status: "embedded",
    source_metadata: {
      file_date: row.date ?? row.captured_at ?? row.created_at ?? null,
      participants_array: row.participants_array ?? [],
      backfill_source: "backfill-recent-meeting-chunks",
    },
    processing_metadata: {
      ingest_path: "backfill-recent-meeting-chunks",
      repair_guardrail: "writes rag_document_metadata before document_chunks",
    },
    last_synced_at: new Date().toISOString(),
    last_content_loaded_at: new Date().toISOString(),
    last_indexed_at: new Date().toISOString(),
  };
}

async function fetchRestCandidates() {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const rows = await restSelect(
    appRestUrl,
    appRestKey,
      "document_metadata?" +
      "select=id,title,date,project_id,participants_array,content,summary,overview,source,type,category,status,fireflies_id,captured_at,created_at" +
      `&or=${encodeURIComponent("(source.eq.fireflies,type.eq.meeting,type.eq.meeting_transcript,category.eq.meeting,fireflies_id.not.is.null)")}` +
      `&or=${encodeURIComponent("(deleted_at.is.null,deleted_at.is.null)")}` +
      `&created_at=gte.${encodeURIComponent(since)}` +
      "&limit=1000"
  );

  return rows.data
    .filter((row) => {
      const effectiveAt = row.captured_at || row.date || row.created_at;
      const contentLength = String(row.content || row.summary || row.overview || "").trim().length;
      return (
        !isExcludedMeeting(row) &&
        Boolean(effectiveAt) &&
        new Date(effectiveAt).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000 &&
        contentLength >= 100
      );
    })
    .sort((a, b) => {
      const aTime = new Date(a.captured_at || a.date || a.created_at || 0).getTime();
      const bTime = new Date(b.captured_at || b.date || b.created_at || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, limit);
}

async function fetchExistingChunkDocumentIdsViaRest(rows) {
  if (rows.length === 0) return new Set();
  const idFilter = `(${rows.map((row) => `"${row.id}"`).join(",")})`;
  const chunkRows = await restSelect(
    ragRestUrl,
    ragRestKey,
    `document_chunks?select=document_id&document_id=in.${encodeURIComponent(idFilter)}&embedding=not.is.null&limit=${rows.length * 10}`
  );
  return new Set(chunkRows.data.map((row) => String(row.document_id)));
}

async function processRows(rows, insertRecords) {
  console.log(`Recent meetings missing chunks: ${rows.length}`);
  if (dryRun || rows.length === 0) {
    if (dryRun) console.log("Dry run: no writes performed.");
    process.exit(0);
  }

  let inserted = 0;
  let failed = 0;

  for (const row of rows) {
    const baseText = String(row.content || row.summary || row.overview || "").trim();
    const chunks = chunkText(baseText);
    if (chunks.length === 0) {
      console.error(`[FAIL] ${row.id}: no usable chunk text`);
      failed++;
      continue;
    }

    const embeddingTexts = chunks.map((chunk) => {
      const date = row.date ? new Date(row.date).toISOString() : "Unknown date";
      return `[Meeting: "${row.title || "Untitled Meeting"}" | ${date}]\n\n${chunk}`;
    });
    const embeddings = await embed(embeddingTexts);

    const sourceType = baseText.includes("## Transcript") ? "meeting_transcript" : "meeting_summary";
    const metadataRecord = buildRagMetadataRow(row, baseText, sourceType);
    const records = chunks.map((chunk, index) => {
      const contentHash = hashContent(chunk);
      return {
        chunk_id: `${row.id}__recent_meeting_${index}_${contentHash}`,
        document_id: row.id,
        chunk_index: index,
        text: chunk,
        metadata: {
          doc_type: "meeting_content",
          title: row.title,
          file_date: row.date,
          project_id: row.project_id,
          participants: row.participants_array ?? [],
          content_hash: contentHash,
          backfill_source: "backfill-recent-meeting-chunks",
        },
        content_hash: contentHash,
        embedding: JSON.stringify(embeddings[index]),
        source_type: sourceType,
      };
    });

    await insertRecords(records, [metadataRecord]);
    inserted += records.length;
    process.stdout.write(`\rInserted chunks: ${inserted}, failed meetings: ${failed}`);
  }

  console.log(`\nDone. Inserted chunks: ${inserted}. Failed meetings: ${failed}.`);
  if (failed > 0) process.exit(1);
}

async function runRestFallback(originalError) {
  if (!appRestUrl || !appRestKey || !ragRestUrl || !ragRestKey) {
    throw originalError;
  }

  console.warn(
    `[WARN] Direct Postgres path failed (${originalError.code || originalError.message}); ` +
      "falling back to Supabase REST for meeting chunk backfill."
  );

  const candidates = await fetchRestCandidates();
  const existingChunkDocumentIds = await fetchExistingChunkDocumentIdsViaRest(candidates);
  const rows = candidates.filter((row) => !existingChunkDocumentIds.has(String(row.id)));

  await processRows(rows, async (records, metadataRecords) => {
    await restUpsert(ragRestUrl, ragRestKey, "rag_document_metadata?on_conflict=id", metadataRecords);
    await restUpsert(ragRestUrl, ragRestKey, "document_chunks?on_conflict=chunk_id", records);
  });
}

try {
  const candidates = await sql`
    select dm.id, dm.title, dm.date, dm.project_id, dm.participants_array, dm.content, dm.summary, dm.overview,
           dm.status, dm.type, dm.category, dm.fireflies_id
    from public.document_metadata dm
    where (dm.source = 'fireflies'
       or dm.type in ('meeting', 'meeting_transcript')
       or dm.category = 'meeting'
       or dm.fireflies_id is not null)
      and coalesce(dm.captured_at, dm.date, dm.created_at::timestamptz) >= now() - (${days} || ' days')::interval
      and length(coalesce(dm.content, dm.summary, dm.overview, '')) >= 100
      and coalesce(dm.status, '') not in ('intentionally_excluded', 'deleted_no_transcript', 'metadata_only', 'not_vectorizable', 'skipped_low_content')
      and lower(coalesce(dm.title, '') || ' ' || coalesce(dm.category, '') || ' ' || coalesce(dm.type, '')) not like '%interview%'
      and lower(coalesce(dm.title, '') || ' ' || coalesce(dm.category, '') || ' ' || coalesce(dm.type, '')) not like '%inteview%'
    order by coalesce(dm.captured_at, dm.date, dm.created_at::timestamptz) desc nulls last
    limit ${limit}
  `;
  const existingChunkRows = candidates.length
    ? await ragSql`
        select distinct document_id
        from public.document_chunks
        where embedding is not null
          and document_id in ${ragSql(candidates.map((row) => row.id))}
      `
    : [];
  const existingChunkDocumentIds = new Set(existingChunkRows.map((row) => String(row.document_id)));
  const rows = candidates.filter((row) => !existingChunkDocumentIds.has(String(row.id)));

  await processRows(rows, async (records, metadataRecords) => {
    await ragSql`
      insert into public.rag_document_metadata ${ragSql(metadataRecords)}
      on conflict (id) do update set
        project_id = coalesce(excluded.project_id, public.rag_document_metadata.project_id),
        source = excluded.source,
        source_system = excluded.source_system,
        source_item_id = excluded.source_item_id,
        fireflies_id = excluded.fireflies_id,
        title = excluded.title,
        type = excluded.type,
        category = excluded.category,
        content = excluded.content,
        raw_text = excluded.raw_text,
        content_hash = excluded.content_hash,
        content_length = excluded.content_length,
        parsing_status = excluded.parsing_status,
        embedding_status = excluded.embedding_status,
        source_metadata = public.rag_document_metadata.source_metadata || excluded.source_metadata,
        processing_metadata = public.rag_document_metadata.processing_metadata || excluded.processing_metadata,
        last_synced_at = excluded.last_synced_at,
        last_content_loaded_at = excluded.last_content_loaded_at,
        last_indexed_at = excluded.last_indexed_at,
        updated_at = now()
    `;
    await ragSql`
      insert into public.document_chunks ${ragSql(records)}
      on conflict (chunk_id) do update set
        text = excluded.text,
        metadata = excluded.metadata,
        content_hash = excluded.content_hash,
        embedding = excluded.embedding,
        source_type = excluded.source_type,
        updated_at = now()
    `;
  });
} catch (error) {
  await runRestFallback(error);
} finally {
  await sql.end();
  if (ragSql !== sql) await ragSql.end();
}
