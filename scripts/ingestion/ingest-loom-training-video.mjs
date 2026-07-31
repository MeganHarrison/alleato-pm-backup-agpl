#!/usr/bin/env node
/**
 * Ingest a Loom training recording into the database.
 *
 * Writes three places:
 *   1. training_docs (PM APP)          — canonical record of the training itself
 *   2. document_metadata (PM APP)      — metadata-only row (no body; see supabase_helpers)
 *   3. rag_document_metadata + document_chunks (AI DB) — embedded transcript, so the
 *      assistant can actually retrieve the content
 *
 * Transcript is pulled from the signed CDN URL embedded in the public Loom share page,
 * so this works for any Loom link without Loom API credentials.
 *
 * Usage:
 *   node scripts/ingestion/ingest-loom-training-video.mjs <loom-share-url> [--dry-run]
 *
 * Env: DATABASE_URL, RAG_DATABASE_URL, RAG_DATABASE_WRITES_ENABLED=true,
 *      AI_GATEWAY_API_KEY or OPENAI_API_KEY
 */

import { createHash } from "node:crypto";
import dotenv from "dotenv";
import postgres from "postgres";

const CHUNK_TARGET_CHARS = 3_000;
const CHUNK_OVERLAP_CHARS = 500;
const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMS = 3_072;
const SOURCE_TYPE = "training_video";

// ---------------------------------------------------------------- env

function loadEnv() {
  dotenv.config({ path: ".env", quiet: true });
  dotenv.config({ path: "frontend/.env.local", override: true, quiet: true });
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// ---------------------------------------------------------------- loom

async function fetchLoomVideo(shareUrl) {
  const id = shareUrl.match(/loom\.com\/share\/([a-f0-9]{32})/i)?.[1];
  if (!id) throw new Error(`Not a Loom share URL: ${shareUrl}`);

  const response = await fetch(shareUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
  });
  if (!response.ok) throw new Error(`Loom page fetch failed: HTTP ${response.status}`);
  const html = await response.text();

  const unescape = (value) =>
    value.replace(/&amp;/g, "&").replace(/\\u0026/g, "&").replace(/\\\//g, "/");

  const pick = (pattern) => html.match(pattern)?.[1]?.trim() ?? null;

  const transcriptUrl = html.match(
    /https:\/\/cdn\.loom\.com\/mediametadata\/transcription\/[^"]+/,
  )?.[0];
  if (!transcriptUrl) {
    throw new Error(
      "No transcript URL on the Loom page — the video may not be transcribed yet, " +
        "or the share link is private.",
    );
  }

  const transcriptResponse = await fetch(unescape(transcriptUrl), {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!transcriptResponse.ok) {
    throw new Error(`Transcript fetch failed: HTTP ${transcriptResponse.status}`);
  }
  const { phrases } = await transcriptResponse.json();
  if (!Array.isArray(phrases) || phrases.length === 0) {
    throw new Error("Loom returned an empty transcript.");
  }

  // ISO-8601 duration on the schema.org block is the authoritative runtime.
  const isoDuration = pick(/"duration":\s*"PT([\d.]+)S"/);

  return {
    id,
    shareUrl,
    title: pick(/<meta property="og:title" content="([^"]+)"/) ?? `Loom ${id}`,
    description: pick(/<meta property="og:description" content="([^"]+)"/),
    author: pick(/"display_name":"([^"]+)"/),
    recordedAt: pick(/"createdAt":"([^"]+)"/),
    durationSeconds: isoDuration ? Number(isoDuration) : null,
    phrases,
  };
}

/**
 * Build a readable, navigable transcript: timestamped paragraphs separated by blank
 * lines. The blank lines matter — the chunker snaps to "\n\n" boundaries, so chunks
 * break between paragraphs rather than mid-sentence.
 */
function buildTranscript(phrases) {
  const stamp = (seconds) => {
    const total = Math.floor(seconds);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  const paragraphs = [];
  let current = null;

  for (const phrase of phrases) {
    const text = (phrase.value ?? "").trim();
    if (!text) continue;
    if (!current) current = { ts: phrase.ts ?? 0, parts: [] };
    current.parts.push(text);
    if (current.parts.join(" ").length >= 700) {
      paragraphs.push(`[${stamp(current.ts)}] ${current.parts.join(" ")}`);
      current = null;
    }
  }
  if (current) paragraphs.push(`[${stamp(current.ts)}] ${current.parts.join(" ")}`);

  return paragraphs.join("\n\n");
}

// ---------------------------------------------------------------- chunk + embed

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

const hashContent = (text) => createHash("sha256").update(text).digest("hex").slice(0, 24);

async function embedTexts(texts) {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const providers = [
    gatewayKey && {
      label: "AI Gateway",
      url: "https://ai-gateway.vercel.sh/v1/embeddings",
      key: gatewayKey,
      model: `openai/${EMBEDDING_MODEL}`,
    },
    openAiKey && {
      label: "OpenAI direct",
      url: "https://api.openai.com/v1/embeddings",
      key: openAiKey,
      model: EMBEDDING_MODEL,
    },
  ].filter(Boolean);

  if (providers.length === 0) {
    throw new Error("No embedding provider: set AI_GATEWAY_API_KEY or OPENAI_API_KEY.");
  }

  const errors = [];
  for (const provider of providers) {
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.key}`,
        },
        body: JSON.stringify({
          model: provider.model,
          input: texts.map((text) => text.slice(0, 8000)),
          dimensions: EMBEDDING_DIMS,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
      }
      const payload = await response.json();
      return payload.data.map((row) => row.embedding);
    } catch (error) {
      errors.push(`${provider.label}: ${error.message}`);
    }
  }
  throw new Error(`All embedding providers failed —\n  ${errors.join("\n  ")}`);
}

// ---------------------------------------------------------------- main

async function main() {
  loadEnv();

  const shareUrl = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!shareUrl) {
    console.error("Usage: node scripts/ingestion/ingest-loom-training-video.mjs <loom-url> [--dry-run]");
    process.exit(1);
  }

  if (!dryRun && process.env.RAG_DATABASE_WRITES_ENABLED !== "true") {
    throw new Error("RAG_DATABASE_WRITES_ENABLED must be 'true' to write to the AI database.");
  }

  console.log(`Fetching Loom video…`);
  const video = await fetchLoomVideo(shareUrl);

  // embedder.py purges any document whose title contains "interview". Fail loudly
  // here rather than let the pipeline silently delete the chunks later.
  if (/inte?rview/i.test(video.title)) {
    throw new Error(
      `Title "${video.title}" contains "interview" — the embedding pipeline would ` +
        `silently purge these chunks. Retitle before ingesting.`,
    );
  }

  const transcript = buildTranscript(video.phrases);
  const slug = video.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const metadataId = `training_loom_${video.id}`;
  const chunks = chunkText(transcript);

  console.log(`  title:      ${video.title}`);
  console.log(`  author:     ${video.author ?? "(unknown)"}`);
  console.log(`  recorded:   ${video.recordedAt ?? "(unknown)"}`);
  console.log(`  duration:   ${video.durationSeconds ? `${Math.round(video.durationSeconds / 60)} min` : "(unknown)"}`);
  console.log(`  transcript: ${transcript.length.toLocaleString()} chars → ${chunks.length} chunks`);

  if (dryRun) {
    console.log(`\n--- transcript preview ---\n${transcript.slice(0, 1200)}…\n`);
    console.log("Dry run — nothing written.");
    return;
  }

  const app = postgres(requireEnv("DATABASE_URL"), { max: 1, ssl: "require" });
  const rag = postgres(requireEnv("RAG_DATABASE_URL"), {
    max: 1,
    ssl: "require",
    prepare: false,
  });

  const now = new Date().toISOString();
  const recordedAt = video.recordedAt ?? now;
  const durationMinutes = video.durationSeconds
    ? Math.round(video.durationSeconds / 60)
    : null;

  try {
    // 1. training_docs — the canonical record of the training itself.
    console.log("Writing training_docs…");
    const [trainingDoc] = await app`
      insert into public.training_docs ${app({
        title: video.title,
        slug,
        summary: video.description,
        body_markdown: `# ${video.title}\n\n${video.description ?? ""}\n\n## Transcript\n\n${transcript}\n`,
        audience: "internal",
        status: "published",
        metadata: {
          loom_url: video.shareUrl,
          loom_id: video.id,
          presenter: video.author,
          recorded_at: recordedAt,
          duration_seconds: video.durationSeconds,
          document_metadata_id: metadataId,
          ingested_by: "ingest-loom-training-video",
        },
      })}
      on conflict (slug) do update set
        title = excluded.title, summary = excluded.summary,
        body_markdown = excluded.body_markdown, status = excluded.status,
        metadata = public.training_docs.metadata || excluded.metadata,
        updated_at = now()
      returning id
    `;

    // 2. document_metadata (PM APP) — metadata only. The transcript body deliberately
    //    lives in rag_document_metadata, matching upsert_document_metadata()'s split.
    console.log("Writing document_metadata…");
    await app`
      insert into public.document_metadata ${app({
        id: metadataId,
        title: video.title,
        category: "training",
        type: "training_video",
        source: "loom",
        status: "embedded",
        access_level: "team",
        date: recordedAt,
        video: video.shareUrl,
        meeting_link: video.shareUrl,
        duration_minutes: durationMinutes,
        overview: video.description,
        participants: video.author,
        tags: `training,loom,video,${slug}`,
        content_hash: hashContent(transcript),
        captured_at: now,
      })}
      on conflict (id) do update set
        title = excluded.title, category = excluded.category, type = excluded.type,
        source = excluded.source, status = excluded.status, date = excluded.date,
        video = excluded.video, meeting_link = excluded.meeting_link,
        duration_minutes = excluded.duration_minutes, overview = excluded.overview,
        participants = excluded.participants, tags = excluded.tags,
        content_hash = excluded.content_hash, captured_at = excluded.captured_at
    `;

    // 3. RAG side. rag_document_metadata MUST land before document_chunks.
    console.log("Writing rag_document_metadata…");
    await rag`
      insert into public.rag_document_metadata ${rag({
        id: metadataId,
        // Not-null FK-style link back to the PM APP document_metadata row.
        app_document_id: metadataId,
        source: "loom",
        source_system: "loom",
        source_item_id: video.id,
        title: video.title,
        type: "training_video",
        category: "training",
        content: transcript,
        raw_text: transcript,
        content_hash: hashContent(transcript),
        content_length: transcript.length,
        parsing_status: "complete",
        embedding_status: "complete",
        source_metadata: {
          loom_url: video.shareUrl,
          presenter: video.author,
          recorded_at: recordedAt,
          duration_seconds: video.durationSeconds,
          training_doc_id: trainingDoc.id,
        },
        processing_metadata: {
          ingested_by: "ingest-loom-training-video",
          ingested_at: now,
        },
        last_synced_at: now,
        last_content_loaded_at: now,
        last_indexed_at: now,
      })}
      on conflict (id) do update set
        title = excluded.title, type = excluded.type, category = excluded.category,
        content = excluded.content, raw_text = excluded.raw_text,
        content_hash = excluded.content_hash, content_length = excluded.content_length,
        parsing_status = excluded.parsing_status, embedding_status = excluded.embedding_status,
        source_metadata = public.rag_document_metadata.source_metadata || excluded.source_metadata,
        processing_metadata = public.rag_document_metadata.processing_metadata || excluded.processing_metadata,
        last_synced_at = excluded.last_synced_at,
        last_content_loaded_at = excluded.last_content_loaded_at,
        last_indexed_at = excluded.last_indexed_at, updated_at = now()
    `;

    console.log(`Embedding ${chunks.length} chunks…`);
    const embeddings = await embedTexts(
      chunks.map(
        (chunk) =>
          `[Training video: "${video.title}" | presented by ${video.author ?? "unknown"} | ${recordedAt}]\n\n${chunk}`,
      ),
    );

    console.log("Writing document_chunks…");
    const records = chunks.map((chunk, index) => {
      const contentHash = hashContent(chunk);
      return {
        chunk_id: `${metadataId}__training_video_${index}_${contentHash}`,
        document_id: metadataId,
        chunk_index: index,
        text: chunk,
        content_hash: contentHash,
        source_type: SOURCE_TYPE,
        // postgres.js needs the vector as a string; a raw JS array breaks halfvec.
        embedding: JSON.stringify(embeddings[index]),
        metadata: {
          doc_type: "training_video",
          title: video.title,
          presenter: video.author,
          file_date: recordedAt,
          loom_url: video.shareUrl,
          training_doc_id: trainingDoc.id,
          content_hash: contentHash,
          ingest_source: "ingest-loom-training-video",
        },
      };
    });

    await rag`
      insert into public.document_chunks ${rag(records)}
      on conflict (chunk_id) do update set
        text = excluded.text, metadata = excluded.metadata,
        content_hash = excluded.content_hash, embedding = excluded.embedding,
        source_type = excluded.source_type, updated_at = now()
    `;

    console.log(
      `\nDone.\n  training_docs.id      ${trainingDoc.id}\n  document_metadata.id  ${metadataId}\n  chunks written        ${records.length}`,
    );
  } finally {
    await app.end({ timeout: 5 });
    await rag.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(`\nIngest failed: ${error.message}`);
  process.exit(1);
});
