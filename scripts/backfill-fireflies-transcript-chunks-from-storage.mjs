#!/usr/bin/env node

/**
 * Backfill full Fireflies transcript chunks from Supabase Storage markdown.
 *
 * This repairs rows where document_metadata has summary/segment chunks but no
 * source_type='meeting_transcript' chunks. It can also rebuild transcript
 * chunks from storage and force document_metadata.content to the full stored
 * markdown. It does not call Fireflies.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

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

loadEnvFile(path.join(repoRoot, ".env"));
loadEnvFile(path.join(repoRoot, "frontend/.env.local"));

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("--"))
    .map((arg) => {
      const [key, ...rest] = arg.slice(2).split("=");
      return [key, rest.length ? rest.join("=") : "true"];
    }),
);

const year = Number(args.get("year") || "2026");
const limit = Number(args.get("limit") || "10000");
const scanLimit = Number(args.get("scan-limit") || "10000");
const dryRun = args.get("dry-run") === "true";
const onlyId = args.get("id");
const rebuildExisting = args.get("rebuild-existing") === "true";
const contentOnly = args.get("content-only") === "true";
const skipAppContentUpdate = args.get("skip-app-content-update") === "true";
const allowFirefliesApiFallback = args.get("allow-fireflies-api-fallback") === "true";
const chunkTargetChars = Number(args.get("chunk-chars") || "3000");
const chunkOverlapChars = Number(args.get("chunk-overlap") || "500");
const embedBatchSize = Number(args.get("embed-batch-size") || "32");
const insertBatchSize = Number(args.get("insert-batch-size") || "250");

const databaseUrl =
  process.env.APP_METADATA_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL;
const ragDatabaseUrl = process.env.RAG_DATABASE_URL;
const ragWritesEnabled = String(process.env.RAG_DATABASE_WRITES_ENABLED || "").toLowerCase() === "true";
const aiGatewayKey = process.env.AI_GATEWAY_API_KEY;
const openAiKey = process.env.OPENAI_API_KEY;
const firefliesApiKey = process.env.FIREFLIES_API_KEY;

if (!databaseUrl) throw new Error("APP_METADATA_DATABASE_URL, DATABASE_URL, or SUPABASE_DB_URL is required.");
if (!ragDatabaseUrl) throw new Error("RAG_DATABASE_URL is required.");
if (!aiGatewayKey && !openAiKey) throw new Error("AI_GATEWAY_API_KEY or OPENAI_API_KEY is required.");
if (allowFirefliesApiFallback && !firefliesApiKey) {
  throw new Error("FIREFLIES_API_KEY is required when --allow-fireflies-api-fallback=true.");
}
if (!dryRun && !ragWritesEnabled) {
  throw new Error("RAG_DATABASE_WRITES_ENABLED=true is required for writes.");
}

const sql = postgres(databaseUrl, { max: 1, ssl: "require", idle_timeout: 5 });
const ragSql = postgres(ragDatabaseUrl, {
  max: 1,
  ssl: "require",
  idle_timeout: 5,
  prepare: false,
});

const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMS = 3072;

function hashContent(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

function chunkText(text) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= chunkTargetChars) return [normalized];
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + chunkTargetChars, normalized.length);
    if (end < normalized.length) {
      const paragraph = normalized.lastIndexOf("\n\n", end);
      const line = normalized.lastIndexOf("\n", end);
      const boundary = paragraph > start + 1000 ? paragraph : line;
      if (boundary > start + 1000) end = boundary;
    }
    chunks.push(normalized.slice(start, end).trim());
    if (end >= normalized.length) break;
    start = Math.max(0, end - chunkOverlapChars);
  }
  return chunks.filter((chunk) => chunk.length >= 100);
}

function transcriptText(markdown) {
  const marker = markdown.match(/^##\s+Transcript\s*$/im);
  if (!marker) return "";
  return markdown.slice(marker.index).trim();
}

function isTruncatedTranscriptExport(value) {
  return /showing\s+50\s+of\s+\d+\s+sentences/i.test(String(value || ""));
}

function hasTranscriptMarker(value) {
  return /^##\s+Transcript\s*$/im.test(String(value || ""));
}

function preferRawText(row, markdown) {
  const rawText = String(row.raw_text || "").trim();
  if (!rawText || !hasTranscriptMarker(rawText)) return null;
  if (!isTruncatedTranscriptExport(rawText) && (isTruncatedTranscriptExport(markdown) || rawText.length > String(markdown || "").length * 2)) {
    return rawText;
  }
  return null;
}

async function embed(texts) {
  const providers = [
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

  const errors = [];
  for (const provider of providers) {
    const response = await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        input: texts.map((text) => text.slice(0, 8000)),
        dimensions: EMBEDDING_DIMS,
      }),
    });
    if (!response.ok) {
      errors.push(`${provider.label}: ${response.status} ${(await response.text()).slice(0, 300)}`);
      continue;
    }
    const json = await response.json();
    if (!Array.isArray(json.data) || json.data.length !== texts.length) {
      errors.push(`${provider.label}: expected ${texts.length} embeddings, got ${json.data?.length}`);
      continue;
    }
    return json.data.map((item) => item.embedding);
  }
  throw new Error(`Embedding failed: ${errors.join(" | ")}`);
}

async function fetchMarkdown(row) {
  let markdown = "";
  const url = row.url || row.source_web_url;
  if (url && /\/storage\/v1\/object\//.test(url)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`storage URL ${response.status}`);
    markdown = await response.text();
  } else if (row.file_path) {
    const bucket = row.storage_bucket || process.env.SUPABASE_MEETINGS_BUCKET || "meetings";
    const base = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
    const objectUrl = `${base}/storage/v1/object/${bucket}/${encodeURI(row.file_path)}`;
    const response = await fetch(objectUrl, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`,
      },
    });
    if (!response.ok) throw new Error(`storage object ${response.status}`);
    markdown = await response.text();
  }

  const rawText = preferRawText(row, markdown);
  if (rawText) return { markdown: rawText, source: "document_metadata.raw_text" };

  if (markdown && (!isTruncatedTranscriptExport(markdown) || !allowFirefliesApiFallback)) {
    return { markdown, source: "supabase_storage_markdown" };
  }

  if (allowFirefliesApiFallback && (row.fireflies_id || row.id)) {
    const transcript = await fetchFirefliesTranscript(row.fireflies_id || row.id);
    return {
      markdown: formatFirefliesTranscriptMarkdown(transcript),
      source: "fireflies_api_fallback",
    };
  }

  if (markdown) return { markdown, source: "supabase_storage_markdown" };
  throw new Error("missing storage URL/file_path");
}

async function fetchFirefliesTranscript(transcriptId) {
  const query = `
    query Transcript($transcriptId: String!) {
      transcript(id: $transcriptId) {
        id
        title
        date
        dateString
        duration
        host_email
        organizer_email
        transcript_url
        participants
        fireflies_users
        workspace_users
        audio_url
        video_url
        meeting_link
        calendar_type
        summary {
          overview
          short_summary
          bullet_gist
          action_items
          keywords
          topics_discussed
          transcript_chapters
        }
        sentences {
          index
          speaker_name
          text
          start_time
        }
      }
    }
  `;
  const response = await fetch("https://api.fireflies.ai/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firefliesApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { transcriptId } }),
  });
  if (!response.ok) throw new Error(`Fireflies API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const payload = await response.json();
  if (payload.errors) throw new Error(`Fireflies GraphQL error: ${JSON.stringify(payload.errors).slice(0, 300)}`);
  const transcript = payload.data?.transcript;
  if (!transcript) throw new Error(`Fireflies transcript not found: ${transcriptId}`);
  return transcript;
}

function appendTextSection(lines, title, value) {
  if (!value) return;
  lines.push(`## ${title}`, "", String(value).trim(), "");
}

function appendListSection(lines, title, value) {
  const items = Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
  if (!items.length) return;
  lines.push(`## ${title}`, "");
  for (const item of items) lines.push(`- ${String(item).trim()}`);
  lines.push("");
}

function secondsToMmss(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatFirefliesTranscriptMarkdown(transcript) {
  const lines = [`# ${transcript.title || "Untitled Meeting"}`, ""];
  const date = transcript.dateString || transcript.date;
  if (date) lines.push(`**Date:** ${date}`);
  if (transcript.duration != null) lines.push(`**Duration:** ${Math.round(Number(transcript.duration))} minutes`);
  if (transcript.organizer_email) lines.push(`**Organizer Email:** ${transcript.organizer_email}`);
  if (transcript.host_email) lines.push(`**Host Email:** ${transcript.host_email}`);
  if (Array.isArray(transcript.participants) && transcript.participants.length) {
    lines.push(`**Participants:** ${transcript.participants.join(", ")}`);
  }
  if (Array.isArray(transcript.fireflies_users) && transcript.fireflies_users.length) {
    lines.push(`**Fireflies Users:** ${transcript.fireflies_users.join(", ")}`);
  }
  if (Array.isArray(transcript.workspace_users) && transcript.workspace_users.length) {
    lines.push(`**Workspace Users:** ${transcript.workspace_users.join(", ")}`);
  }
  if (transcript.transcript_url) lines.push(`**Fireflies Link:** ${transcript.transcript_url}`);
  if (transcript.audio_url) lines.push(`**Audio:** ${transcript.audio_url}`);
  if (transcript.video_url) lines.push(`**Video:** ${transcript.video_url}`);
  if (transcript.meeting_link) lines.push(`**Meeting Link:** ${transcript.meeting_link}`);
  if (transcript.calendar_type) lines.push(`**Calendar Type:** ${transcript.calendar_type}`);
  lines.push(`**Fireflies ID:** ${transcript.id}`, "");

  const summary = transcript.summary || {};
  appendTextSection(lines, "Summary", summary.overview);
  appendTextSection(lines, "Short Summary", summary.short_summary);
  appendTextSection(lines, "Bullet Gist", summary.bullet_gist);
  appendListSection(lines, "Keywords", summary.keywords);
  appendListSection(lines, "Topics Discussed", summary.topics_discussed);
  appendListSection(lines, "Transcript Chapters", summary.transcript_chapters);
  appendListSection(lines, "Action Items", summary.action_items);

  const sentences = Array.isArray(transcript.sentences) ? transcript.sentences : [];
  if (sentences.length) {
    lines.push("## Transcript", "");
    for (const sentence of sentences) {
      const text = String(sentence?.text || "").trim();
      if (!text) continue;
      lines.push(`[${secondsToMmss(sentence.start_time)}] **${sentence.speaker_name || "Unknown"}**: ${text}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

async function candidateRows() {
  const start = `${year}-01-01T00:00:00Z`;
  const end = `${year + 1}-01-01T00:00:00Z`;
  const whereId = onlyId ? sql`and dm.id = ${onlyId}` : sql``;
  const rows = await sql`
    select
      dm.id,
      dm.title,
      dm.date,
      dm.captured_at,
      dm.created_at,
      dm.project_id,
      dm.source,
      dm.source_system,
      dm.type,
      dm.category,
      dm.summary,
      dm.overview,
      dm.fireflies_id,
      dm.fireflies_link,
      dm.meeting_link,
      dm.file_name,
      dm.participants_array,
      dm.content,
      dm.raw_text,
      dm.storage_bucket,
      dm.file_path,
      dm.url,
      dm.source_web_url,
      dm.source_metadata
    from public.document_metadata dm
    where (dm.source = 'fireflies'
       or dm.fireflies_id is not null
       or dm.type in ('meeting', 'meeting_transcript', 'Interview'))
      and position('interview' in lower(coalesce(dm.title, ''))) = 0
      and coalesce(dm.date, dm.captured_at, dm.created_at::timestamptz) >= ${start}::timestamptz
      and coalesce(dm.date, dm.captured_at, dm.created_at::timestamptz) < ${end}::timestamptz
      and dm.deleted_at is null
      and coalesce(dm.source_metadata->'transcript_chunk_backfill'->>'status', '') not in (
        'missing_storage',
        'no_transcript_marker'
      )
      ${whereId}
    order by coalesce(dm.date, dm.captured_at, dm.created_at::timestamptz) desc nulls last
    limit ${scanLimit}
  `;

  if (!rows.length) return [];
  const existing = await ragSql`
    select distinct document_id
    from public.document_chunks
    where source_type = 'meeting_transcript'
      and embedding is not null
      and document_id in ${ragSql(rows.map((row) => row.id))}
  `;
  const withTranscriptChunks = new Set(existing.map((row) => String(row.document_id)));
  const existingRagMetadata = await ragSql`
    select id, content
    from public.rag_document_metadata
    where id in ${ragSql(rows.map((row) => row.id))}
  `;
  const ragContentById = new Map(
    existingRagMetadata.map((row) => [String(row.id), String(row.content || "")]),
  );
  return rows
    .map((row) => ({
      ...row,
      has_embedded_transcript_chunks: withTranscriptChunks.has(String(row.id)),
      content_has_transcript: hasTranscriptMarker(row.content),
      rag_content_has_transcript: hasTranscriptMarker(ragContentById.get(String(row.id))),
    }))
    .filter(
      (row) =>
        rebuildExisting ||
        contentOnly ||
        !row.has_embedded_transcript_chunks ||
        !row.content_has_transcript ||
        !row.rag_content_has_transcript,
    )
    .slice(0, limit);
}

async function upsertChunks(records) {
  for (let index = 0; index < records.length; index += insertBatchSize) {
    const batch = records.slice(index, index + insertBatchSize);
    await ragSql`
      insert into public.document_chunks ${ragSql(batch)}
      on conflict (chunk_id) do update set
        text = excluded.text,
        metadata = excluded.metadata,
        content_hash = excluded.content_hash,
        embedding = excluded.embedding,
        source_type = excluded.source_type,
        updated_at = now()
    `;
  }
}

async function deleteExistingTranscriptChunks(documentId) {
  await ragSql`
    delete from public.document_chunks
    where document_id = ${documentId}
      and source_type = 'meeting_transcript'
  `;
}

async function markBackfillStatus(row, status, message = null) {
  const metadata = {
    ...(row.source_metadata || {}),
    transcript_chunk_backfill: {
      status,
      message,
      checked_at: new Date().toISOString(),
      script: "backfill-fireflies-transcript-chunks-from-storage",
    },
  };
  await sql`
    update public.document_metadata
    set source_metadata = ${sql.json(metadata)}
    where id = ${row.id}
  `;
}

async function upsertRagDocumentMetadata(row, markdown, transcript, records, contentSource) {
  const contentHash = hashContent(markdown);
  const indexed = records.length > 0 || row.has_embedded_transcript_chunks;
  const sourceMetadata = {
    ...(row.source_metadata || {}),
    fireflies_id: row.fireflies_id || row.source_metadata?.fireflies_id || null,
    fireflies_link: row.fireflies_link || null,
    meeting_link: row.meeting_link || null,
  };
  const processingMetadata = {
    transcript_chunk_backfill: {
      checked_at: new Date().toISOString(),
      script: "backfill-fireflies-transcript-chunks-from-storage",
      content_source: contentSource,
      transcript_chars: transcript.length,
      transcript_chunks_written: records.length,
      had_existing_embedded_transcript_chunks: row.has_embedded_transcript_chunks,
      app_content_had_transcript: row.content_has_transcript,
    },
  };

  const payload = {
    id: row.id,
    app_document_id: row.id,
    project_id: row.project_id == null ? null : Number(row.project_id),
    source: row.source || "fireflies",
    source_system: row.source_system || "fireflies",
    source_item_id: row.fireflies_id || row.source_metadata?.fireflies_id || row.id,
    fireflies_id: row.fireflies_id || row.source_metadata?.fireflies_id || null,
    title: row.title,
    type: row.type || "meeting_transcript",
    category: row.category || "meeting",
    source_web_url: row.source_web_url || row.url || row.fireflies_link || row.meeting_link || null,
    url: row.url || row.source_web_url || null,
    storage_bucket: row.storage_bucket || process.env.SUPABASE_MEETINGS_BUCKET || "meetings",
    storage_path: row.file_path || null,
    file_name: row.file_name || null,
    content: markdown,
    raw_text: transcript,
    content_hash: contentHash,
    content_length: markdown.length,
    summary: row.summary || null,
    overview: row.overview || null,
    parsing_status: "parsed",
    embedding_status: indexed ? "embedded" : "content_loaded",
    processing_metadata: processingMetadata,
    source_metadata: sourceMetadata,
    last_synced_at: row.date || row.captured_at || row.created_at || null,
    last_content_loaded_at: new Date().toISOString(),
    last_indexed_at: indexed ? new Date().toISOString() : null,
    created_at: row.created_at || new Date().toISOString(),
  };

  await ragSql`
    insert into public.rag_document_metadata ${ragSql([payload])}
    on conflict (id) do update set
      app_document_id = excluded.app_document_id,
      project_id = excluded.project_id,
      source = excluded.source,
      source_system = excluded.source_system,
      source_item_id = excluded.source_item_id,
      fireflies_id = excluded.fireflies_id,
      title = excluded.title,
      type = excluded.type,
      category = excluded.category,
      source_web_url = excluded.source_web_url,
      url = excluded.url,
      storage_bucket = excluded.storage_bucket,
      storage_path = excluded.storage_path,
      file_name = excluded.file_name,
      content = excluded.content,
      raw_text = excluded.raw_text,
      content_hash = excluded.content_hash,
      content_length = excluded.content_length,
      summary = excluded.summary,
      overview = excluded.overview,
      parsing_status = excluded.parsing_status,
      embedding_status = excluded.embedding_status,
      processing_metadata = excluded.processing_metadata,
      source_metadata = excluded.source_metadata,
      last_synced_at = excluded.last_synced_at,
      last_content_loaded_at = excluded.last_content_loaded_at,
      last_indexed_at = excluded.last_indexed_at
  `;
}

async function main() {
  const rows = await candidateRows();
  console.log(`Fireflies ${year} meetings selected for storage transcript repair: ${rows.length}`);
  if (dryRun) {
    let storageWithTranscript = 0;
    let storageMissingTranscript = 0;
    let contentMissingTranscript = 0;
    let ragContentMissingTranscript = 0;
    let missingEmbeddedTranscriptChunks = 0;
    for (const row of rows) {
      if (!row.content_has_transcript) contentMissingTranscript += 1;
      if (!row.rag_content_has_transcript) ragContentMissingTranscript += 1;
      if (!row.has_embedded_transcript_chunks) missingEmbeddedTranscriptChunks += 1;
      try {
        const fetched = await fetchMarkdown(row);
        const markdown = fetched.markdown;
        if (transcriptText(markdown)) storageWithTranscript += 1;
        else storageMissingTranscript += 1;
      } catch {
        storageMissingTranscript += 1;
      }
    }
    console.log(
      `Dry run: storage with transcript marker=${storageWithTranscript}, ` +
        `missing/unreadable=${storageMissingTranscript}, ` +
        `content missing transcript marker=${contentMissingTranscript}, ` +
        `rag metadata missing transcript marker=${ragContentMissingTranscript}, ` +
        `missing embedded transcript chunks=${missingEmbeddedTranscriptChunks}`,
    );
    return;
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let insertedChunks = 0;
  for (const row of rows) {
    try {
      const fetched = await fetchMarkdown(row);
      const markdown = fetched.markdown;
      const contentSource = fetched.source;
      const transcript = transcriptText(markdown);
      if (!transcript) {
        skipped += 1;
        await markBackfillStatus(row, "no_transcript_marker", "Storage markdown has no ## Transcript section.");
        console.error(`[SKIP] ${row.id}: storage markdown has no ## Transcript marker`);
        continue;
      }
      const chunks = chunkText(transcript);
      if (!chunks.length) {
        skipped += 1;
        await markBackfillStatus(row, "no_usable_transcript_chunks", "Transcript section produced no usable chunks.");
        console.error(`[SKIP] ${row.id}: transcript produced no usable chunks`);
        continue;
      }

      if (!skipAppContentUpdate && row.content !== markdown) {
        await sql`
          update public.document_metadata
          set content = ${markdown}
          where id = ${row.id}
        `;
      }

      let records = [];
      if (!contentOnly && (rebuildExisting || !row.has_embedded_transcript_chunks)) {
        const embeddings = [];
        for (let index = 0; index < chunks.length; index += embedBatchSize) {
          const batch = chunks.slice(index, index + embedBatchSize);
          const embeddingTexts = batch.map((chunk, offset) => {
            const chunkNumber = index + offset;
            const date = row.date || row.captured_at || row.created_at || "unknown date";
            return `[Meeting transcript: "${row.title || "Untitled"}" | ${date} | chunk ${chunkNumber}]\n\n${chunk}`;
          });
          embeddings.push(...(await embed(embeddingTexts)));
        }

        records = chunks.map((chunk, index) => {
          const contentHash = hashContent(chunk);
          return {
            chunk_id: `${row.id}__storage_transcript_${index}_${contentHash}`,
            document_id: row.id,
            chunk_index: index,
            text: chunk,
            metadata: {
              doc_type: "meeting_transcript",
              chunk_index: index,
              title: row.title,
              file_date: row.date || row.captured_at || row.created_at,
              project_id: row.project_id,
              participants: row.participants_array || [],
              content_hash: contentHash,
              backfill_source: "backfill-fireflies-transcript-chunks-from-storage",
              transcript_source: "document_metadata.storage_markdown",
            },
            content_hash: contentHash,
            embedding: JSON.stringify(embeddings[index]),
            source_type: "meeting_transcript",
          };
        });
        if (rebuildExisting) await deleteExistingTranscriptChunks(row.id);
        await upsertChunks(records);
      }
      await upsertRagDocumentMetadata(row, markdown, transcript, records, contentSource);

      processed += 1;
      insertedChunks += records.length;
      const status = contentOnly ? "content_synced" : "embedded";
      const message = contentOnly
        ? `content synced from storage markdown; transcript chars=${transcript.length}.`
        : `${records.length} transcript chunks written; transcript chars=${transcript.length}.`;
      await markBackfillStatus(row, status, message);
      console.log(`[OK] ${row.id}: ${records.length} transcript chunks, transcript chars=${transcript.length}`);
    } catch (error) {
      if (error.message === "missing storage URL/file_path") {
        skipped += 1;
        await markBackfillStatus(row, "missing_storage", error.message);
        console.error(`[SKIP] ${row.id}: ${error.message}`);
      } else {
        failed += 1;
        console.error(`[FAIL] ${row.id}: ${error.message}`);
      }
    }
  }

  console.log(`Done. processed=${processed}, skipped=${skipped}, failed=${failed}, transcript_chunks=${insertedChunks}`);
  if (failed > 0) process.exitCode = 1;
}

try {
  await main();
} finally {
  await Promise.allSettled([sql.end(), ragSql.end()]);
}
