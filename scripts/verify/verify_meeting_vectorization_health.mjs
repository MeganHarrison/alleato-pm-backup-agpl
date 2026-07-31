#!/usr/bin/env node

/**
 * Meeting Vectorization Health Check — fails LOUDLY.
 *
 * This script is the canary for the AI Strategist's meeting recall path.
 * It MUST exit non-zero on any of the following:
 *   1. No embeddings exist at all
 *   2. Recent meetings (last 14 days) exist with zero summary embeddings
 *   3. The newest meeting is more than 7 days ahead of the newest embedding
 *   4. Recent meetings have poor chunk coverage for broad semanticSearch
 *   5. The OpenAI / AI Gateway embedding endpoint cannot embed a probe string
 *   6. The DB retrieval RPCs return zero results for known-good probe vectors
 *
 * Why this exists: silent failures in the embedding pipeline (quota, RPC bugs,
 * mis-configured workers) caused the strategist to silently degrade to keyword
 * search for weeks. The cost was invisible until a human noticed.
 *
 * Run:  npm run rag:verify:meetings
 */

import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: "frontend/.env.local", override: true, quiet: true });

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const ragDatabaseUrl = process.env.RAG_DATABASE_URL;
const appRestUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const appRestKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;
const ragRestUrl = process.env.RAG_SUPABASE_URL;
const ragRestKey = process.env.RAG_SUPABASE_SERVICE_ROLE_KEY;
const aiGatewayKey = process.env.AI_GATEWAY_API_KEY;
const openAiKey = process.env.OPENAI_API_KEY;

if (!databaseUrl && (!appRestUrl || !appRestKey)) {
  console.error("[FATAL] DATABASE_URL/SUPABASE_DB_URL or SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY is required.");
  process.exit(1);
}
if (!ragDatabaseUrl && (!ragRestUrl || !ragRestKey)) {
  console.error("[FATAL] RAG_DATABASE_URL or RAG_SUPABASE_URL/RAG_SUPABASE_SERVICE_ROLE_KEY is required. document_chunks and fireflies_ingestion_jobs live in the AI/RAG database.");
  process.exit(1);
}

const STALENESS_DAYS = 7;
const RECENT_WINDOW_DAYS = 14;
const FIREFLIES_BACKLOG_CONCERN_WINDOW_DAYS = 60;
const MEETING_SIGNAL_LIMIT = 2_000;
const RECENT_MIN_EMBEDDED_RATIO = 1;
const RECENT_MIN_CHUNK_RATIO = 1;
const RECENT_MIN_TRANSCRIPT_CHUNK_RATIO = 1;
const MEETING_CHUNK_SOURCE_TYPES = [
  "meeting_transcript",
  "meeting_summary",
  "meeting_segment_summary",
  "meeting_notes",
  "meeting_section",
];
const EXCLUDED_DOCUMENT_STATUSES = [
  "intentionally_excluded",
  "deleted_no_transcript",
  "metadata_only",
  "not_vectorizable",
  "skipped_low_content",
];

const appSql = databaseUrl ? postgres(databaseUrl, { max: 1, ssl: "require" }) : null;
const ragSql = ragDatabaseUrl ? postgres(ragDatabaseUrl, { max: 1, ssl: "require", prepare: false }) : null;

const failures = [];
const warnings = [];

function fail(msg) {
  failures.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function isExcludedMeeting(row) {
  const value = `${row.title ?? ""} ${row.category ?? ""} ${row.type ?? ""}`.toLowerCase();
  return value.includes("interview") || value.includes("inteview");
}

function isNotActionable(row) {
  return EXCLUDED_DOCUMENT_STATUSES.includes(String(row.status ?? ""));
}

function hasTranscriptLikeContent(row) {
  const text = `${row.raw_text ?? ""}\n${row.content ?? ""}`;
  return /\[\d{1,2}:\d{2}(?::\d{2})?\]/.test(text) || text.length >= 5_000;
}

async function restSelect(baseUrl, key, path, { timeoutMs = 30_000 } = {}) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      Prefer: "count=exact",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return {
    data: JSON.parse(text || "[]"),
    count: Number((res.headers.get("content-range") || "0/0").split("/").pop() || 0),
  };
}

async function restRpc(baseUrl, key, name, body, { timeoutMs = 30_000 } = {}) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`rpc/${name} returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text || "[]");
}

async function probeDocumentChunkSearchRpc() {
  const sample = await restSelect(
    ragRestUrl,
    ragRestKey,
    "document_chunks?select=embedding" +
      "&source_type=eq.meeting_transcript" +
      "&embedding=not.is.null" +
      "&limit=1"
  );
  const queryEmbedding = sample.data[0]?.embedding;
  if (!queryEmbedding) {
    fail("No embedded meeting transcript chunk exists to use as a search_document_chunks probe.");
    return {
      result_count: 0,
      max_similarity: null,
      source: "rest-rpc",
    };
  }

  const rows = await restRpc(ragRestUrl, ragRestKey, "search_document_chunks", {
    query_embedding: queryEmbedding,
    filter_source_types: ["meeting_transcript"],
    filter_project_id: null,
    match_count: 5,
    match_threshold: 0.1,
  });
  const maxSimilarity = rows.reduce(
    (max, row) => Math.max(max, Number(row.similarity ?? 0)),
    0
  );
  if (!rows.some((row) => row.source_type === "meeting_transcript")) {
    fail("RPC search_document_chunks returned no meeting_transcript results for a known-good probe vector.");
  }
  return {
    result_count: rows.length,
    max_similarity: maxSimilarity,
    source: "rest-rpc",
  };
}

async function runRestFallback(originalError) {
  if (!appRestUrl || !appRestKey || !ragRestUrl || !ragRestKey) {
    throw originalError;
  }

  warn(
    `Direct Postgres verification failed (${originalError.code || originalError.message}); ` +
      "using Supabase REST for coverage and retrieval verification."
  );

  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const recentRows = await restSelect(
    appRestUrl,
    appRestKey,
    `document_metadata?select=id,title,type,category,source,status,created_at,content,raw_text` +
      `&created_at=gte.${encodeURIComponent(since)}` +
      `&source=eq.fireflies&deleted_at=is.null&order=created_at.desc&limit=1000`
  );
  const recentMeetings = recentRows.data.filter((row) => !isExcludedMeeting(row) && !isNotActionable(row));
  const transcriptExpectedMeetingIds = new Set(
    recentMeetings.filter(hasTranscriptLikeContent).map((row) => row.id)
  );
  const sourceTypeFilter = `(${MEETING_CHUNK_SOURCE_TYPES.map((type) => `"${type}"`).join(",")})`;

  const chunkRows = [];
  for (const meeting of recentMeetings) {
    const chunksForMeeting = await restSelect(
      ragRestUrl,
      ragRestKey,
      `document_chunks?select=chunk_id,source_type` +
        `&document_id=eq.${encodeURIComponent(meeting.id)}` +
        `&source_type=in.${encodeURIComponent(sourceTypeFilter)}` +
        `&embedding=not.is.null&limit=1`
    );
    const transcriptChunksForMeeting = await restSelect(
      ragRestUrl,
      ragRestKey,
      `document_chunks?select=chunk_id,source_type` +
        `&document_id=eq.${encodeURIComponent(meeting.id)}` +
        `&source_type=eq.meeting_transcript` +
        `&embedding=not.is.null&limit=1`
    );
    chunkRows.push({
      document_id: meeting.id,
      embedded_chunk_count: chunksForMeeting.count,
      embedded_transcript_chunk_count: transcriptChunksForMeeting.count,
    });
  }

  const chunkByDocumentId = new Map(chunkRows.map((row) => [row.document_id, row]));
  const recentChunkCoverage = {
    recent_meetings: recentMeetings.length,
    recent_meetings_with_embedded_chunks: recentMeetings.filter(
      (row) => (chunkByDocumentId.get(row.id)?.embedded_chunk_count ?? 0) > 0
    ).length,
    transcript_expected_meetings: transcriptExpectedMeetingIds.size,
    transcript_expected_meetings_with_embedded_transcript_chunks: recentMeetings.filter(
      (row) =>
        transcriptExpectedMeetingIds.has(row.id) &&
        (chunkByDocumentId.get(row.id)?.embedded_transcript_chunk_count ?? 0) > 0
    ).length,
    recent_embedded_chunks: chunkRows.reduce((sum, row) => sum + Number(row.embedded_chunk_count ?? 0), 0),
  };

  const ratio =
    recentMeetings.length > 0
      ? recentChunkCoverage.recent_meetings_with_embedded_chunks / recentMeetings.length
      : 1;
  const transcriptRatio =
    transcriptExpectedMeetingIds.size > 0
      ? recentChunkCoverage.transcript_expected_meetings_with_embedded_transcript_chunks /
        transcriptExpectedMeetingIds.size
      : 1;

  if (ratio < RECENT_MIN_EMBEDDED_RATIO) {
    fail(
      `Only ${recentChunkCoverage.recent_meetings_with_embedded_chunks} of ${recentMeetings.length} ` +
        `eligible Fireflies meetings from the last ${RECENT_WINDOW_DAYS} days have embedded chunks.`
    );
  }
  if (transcriptRatio < RECENT_MIN_TRANSCRIPT_CHUNK_RATIO) {
    fail(
      `Only ${recentChunkCoverage.transcript_expected_meetings_with_embedded_transcript_chunks} of ` +
        `${transcriptExpectedMeetingIds.size} transcript-bearing Fireflies meetings from the last ` +
        `${RECENT_WINDOW_DAYS} days have embedded transcript chunks.`
    );
  }

  const rawIngestedJobs = await restSelect(
    ragRestUrl,
    ragRestKey,
    `fireflies_ingestion_jobs?select=id&stage=eq.raw_ingested&updated_at=gte.${encodeURIComponent(since)}&limit=1`
  );
  const quotaErrorJobs = await restSelect(
    ragRestUrl,
    ragRestKey,
    `fireflies_ingestion_jobs?select=id&stage=eq.error&error_message=ilike.*quota*` +
      `&updated_at=gte.${encodeURIComponent(since)}&limit=1`
  );
  if (rawIngestedJobs.count > 100) {
    fail(`${rawIngestedJobs.count} Fireflies ingestion jobs are stuck at raw_ingested.`);
  }
  if (quotaErrorJobs.count > 0) {
    fail(`${quotaErrorJobs.count} Fireflies ingestion jobs failed with quota/provider errors.`);
  }

  const [provider, documentChunkSearch] = await Promise.all([
    probeEmbeddingProvider(),
    probeDocumentChunkSearchRpc(),
  ]);
  const result = {
    mode: "rest-rpc-fallback",
    metadata: {
      total_meetings: recentMeetings.length,
      latest_meeting_at: recentMeetings[0]?.created_at ?? null,
    },
    recent: {
      recent_meetings: recentMeetings.length,
      excluded_recent_fireflies: recentRows.data.length - recentMeetings.length,
    },
    recentChunkCoverage,
    pipelineJobs: {
      raw_ingested_recent: rawIngestedJobs.count,
      quota_error_recent: quotaErrorJobs.count,
    },
    probes: {
      documentChunkSearch,
      embeddingProvider: provider,
    },
    warnings,
    failures,
  };

  console.log(JSON.stringify(result, null, 2));
  printAndExit();
  process.exit(0);
}

function printAndExit() {
  if (warnings.length > 0) {
    console.error("\nWARNINGS:");
    for (const w of warnings) console.error(`   - ${w}`);
  }

  if (failures.length > 0) {
    console.error("\nMEETING VECTORIZATION HEALTH: FAIL");
    console.error("The AI Strategist is degraded or about to be. Fix these now:\n");
    for (const f of failures) console.error(`   FAIL: ${f}`);
    console.error("");
    process.exit(1);
  }

  console.log("\nMeeting vectorization health: PASS");
}

async function probeEmbeddingProvider() {
  const successes = [];

  if (aiGatewayKey) {
    try {
      const res = await fetch("https://ai-gateway.vercel.sh/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiGatewayKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/text-embedding-3-large",
          input: "alleato meeting health probe",
          dimensions: 3072,
        }),
      });
      if (res.ok) {
        successes.push("ai-gateway");
      } else {
        const text = await res.text();
        warn(`AI Gateway embedding probe returned ${res.status}: ${text.slice(0, 200)}`);
      }
    } catch (err) {
      warn(`AI Gateway embedding probe threw: ${err.message}`);
    }
  } else {
    warn("AI_GATEWAY_API_KEY not set — falling back to direct OpenAI.");
  }

  if (!openAiKey) {
    if (successes.length === 0) {
      fail("Neither AI_GATEWAY_API_KEY nor OPENAI_API_KEY can produce embeddings — ingestion is dead.");
    } else {
      warn("OPENAI_API_KEY not set — AI Gateway is the only working embedding provider.");
    }
    return { ok: successes.length > 0, providers: successes };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-large",
        input: "alleato meeting health probe",
        dimensions: 3072,
      }),
    });
    if (res.ok) {
      successes.push("openai-direct");
    } else {
      const text = await res.text();
      const message =
        `Direct OpenAI embedding probe returned ${res.status}. ` +
        `Body: ${text.slice(0, 300)}. ` +
        `Check OpenAI billing/quota.`;
      if (successes.length > 0) {
        warn(`${message} AI Gateway is currently the working provider; direct OpenAI should not be treated as the primary path.`);
      } else {
        fail(
          `Embedding provider is FAILING. ${message} ` +
            `New Fireflies meetings will NOT be embedded. ` +
            `Set AI_GATEWAY_API_KEY or fix OpenAI billing/quota.`
        );
      }
    }
  } catch (err) {
    if (successes.length > 0) {
      warn(`Direct OpenAI embedding probe threw: ${err.message}. AI Gateway is currently the working provider; direct OpenAI should not be treated as the primary path.`);
    } else {
      fail(`Direct OpenAI embedding probe threw: ${err.message}`);
    }
  }

  return { ok: successes.length > 0, providers: successes };
}

try {
  if (!appSql || !ragSql) {
    throw new Error("Direct Postgres URL missing");
  }

  await appSql`set statement_timeout = '45s'`;
  await ragSql`set statement_timeout = '45s'`;

  const recentMeetings = await appSql`
    select
      id::text,
      title,
      coalesce(captured_at, date, created_at::timestamptz) as meeting_at,
      (
        coalesce(raw_text, content, '') ~ '\\[[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?\\]'
        or length(coalesce(raw_text, content, '')) >= 5000
      ) as has_transcript_like_content
    from public.document_metadata
    where (
      source = 'fireflies'
      or type in ('meeting', 'meeting_transcript')
      or category = 'meeting'
      or fireflies_id is not null
    )
      and coalesce(status, '') not in ${appSql(EXCLUDED_DOCUMENT_STATUSES)}
      and lower(coalesce(title, '')) not like '%interview%'
      and lower(coalesce(title, '')) not like '%inteview%'
      and lower(coalesce(category, '')) not like '%interview%'
      and lower(coalesce(category, '')) not like '%inteview%'
      and lower(coalesce(type, '')) not like '%interview%'
      and lower(coalesce(type, '')) not like '%inteview%'
      and coalesce(captured_at, date, created_at::timestamptz) >= now() - (${RECENT_WINDOW_DAYS} || ' days')::interval
    order by meeting_at desc
  `;
  const recentMeetingIds = recentMeetings.map((row) => row.id).filter(Boolean);
  const transcriptExpectedMeetingIds = new Set(
    recentMeetings.filter((row) => row.has_transcript_like_content === true).map((row) => row.id),
  );

  const [metadata] = await appSql`
    with meeting_ids as materialized (
      select id from (
        select id from public.document_metadata
        where source = 'fireflies'
          and coalesce(status, '') not in ${appSql(EXCLUDED_DOCUMENT_STATUSES)}
          and lower(coalesce(title, '')) not like '%interview%'
          and lower(coalesce(title, '')) not like '%inteview%'
          and lower(coalesce(category, '')) not like '%interview%'
          and lower(coalesce(category, '')) not like '%inteview%'
          and lower(coalesce(type, '')) not like '%interview%'
          and lower(coalesce(type, '')) not like '%inteview%'
        order by created_at desc
        limit ${MEETING_SIGNAL_LIMIT}
      ) source_rows
      union
      select id from (
        select id from public.document_metadata
        where type in ('meeting', 'meeting_transcript')
          and coalesce(status, '') not in ${appSql(EXCLUDED_DOCUMENT_STATUSES)}
          and lower(coalesce(title, '')) not like '%interview%'
          and lower(coalesce(title, '')) not like '%inteview%'
          and lower(coalesce(category, '')) not like '%interview%'
          and lower(coalesce(category, '')) not like '%inteview%'
          and lower(coalesce(type, '')) not like '%interview%'
          and lower(coalesce(type, '')) not like '%inteview%'
        order by created_at desc
        limit ${MEETING_SIGNAL_LIMIT}
      ) type_rows
      union
      select id from (
        select id from public.document_metadata
        where category = 'meeting'
          and coalesce(status, '') not in ${appSql(EXCLUDED_DOCUMENT_STATUSES)}
          and lower(coalesce(title, '')) not like '%interview%'
          and lower(coalesce(title, '')) not like '%inteview%'
          and lower(coalesce(category, '')) not like '%interview%'
          and lower(coalesce(category, '')) not like '%inteview%'
          and lower(coalesce(type, '')) not like '%interview%'
          and lower(coalesce(type, '')) not like '%inteview%'
        order by created_at desc
        limit ${MEETING_SIGNAL_LIMIT}
      ) category_rows
      union
      select id from (
        select id from public.document_metadata
        where fireflies_id is not null
          and coalesce(status, '') not in ${appSql(EXCLUDED_DOCUMENT_STATUSES)}
          and lower(coalesce(title, '')) not like '%interview%'
          and lower(coalesce(title, '')) not like '%inteview%'
          and lower(coalesce(category, '')) not like '%interview%'
          and lower(coalesce(category, '')) not like '%inteview%'
          and lower(coalesce(type, '')) not like '%interview%'
          and lower(coalesce(type, '')) not like '%inteview%'
        order by created_at desc
        limit ${MEETING_SIGNAL_LIMIT}
      ) fireflies_rows
    )
    select
      count(*)::int as total_meetings,
      max(coalesce(captured_at, date, created_at::timestamptz)) as latest_meeting_at
    from public.document_metadata
    where id in (select id from meeting_ids)
  `;

  const recent = {
    recent_meetings: recentMeetings.length,
  };

  const [summaryMetadata] = await ragSql`
    select
      count(*)::int as total_rag_metadata,
      count(*) filter (where summary_embedding is not null)::int as embedded_summaries,
      max(updated_at) filter (where summary_embedding is not null) as latest_summary_embedding_at
    from public.rag_document_metadata
  `;

  const [chunks] = await ragSql`
    select
      count(*)::int as total_chunks,
      count(*) filter (where dc.embedding is not null)::int as embedded_chunks,
      count(distinct dc.document_id) filter (where dc.embedding is not null)::int as docs_with_embedded_chunks,
      max(dc.updated_at) as latest_chunk_embedding_at
    from public.document_chunks dc
    where dc.source_type in ('meeting_transcript', 'meeting_summary', 'meeting_segment_summary', 'meeting_notes', 'meeting_section')
  `;

  let recentChunkRows = [];
  if (recentMeetingIds.length > 0) {
    recentChunkRows = await ragSql`
      select
        dc.document_id::text,
        count(dc.chunk_id)::int as chunk_count,
        count(dc.chunk_id) filter (where dc.embedding is not null)::int as embedded_chunk_count,
        count(dc.chunk_id) filter (where dc.source_type = 'meeting_transcript' and dc.embedding is not null)::int as embedded_transcript_chunk_count,
        max(dc.updated_at) as latest_chunk_embedding_at
      from public.document_chunks dc
      where dc.document_id = any(${recentMeetingIds})
      group by dc.document_id
    `;
  }
  const chunkByDocumentId = new Map(recentChunkRows.map((row) => [row.document_id, row]));
  const recentChunkCoverage = {
    recent_meetings: recentMeetingIds.length,
    recent_meetings_with_chunks: recentMeetings.filter((row) => (chunkByDocumentId.get(row.id)?.chunk_count ?? 0) > 0).length,
    recent_meetings_with_embedded_chunks: recentMeetings.filter((row) => (chunkByDocumentId.get(row.id)?.embedded_chunk_count ?? 0) > 0).length,
    transcript_expected_meetings: transcriptExpectedMeetingIds.size,
    transcript_expected_meetings_with_embedded_transcript_chunks: recentMeetings.filter(
      (row) =>
        transcriptExpectedMeetingIds.has(row.id) &&
        (chunkByDocumentId.get(row.id)?.embedded_transcript_chunk_count ?? 0) > 0,
    ).length,
    recent_chunks: recentChunkRows.reduce((sum, row) => sum + Number(row.chunk_count ?? 0), 0),
    recent_embedded_chunks: recentChunkRows.reduce((sum, row) => sum + Number(row.embedded_chunk_count ?? 0), 0),
    latest_recent_chunk_embedding_at: recentChunkRows.reduce((latest, row) => {
      if (!row.latest_chunk_embedding_at) return latest;
      if (!latest || new Date(row.latest_chunk_embedding_at) > new Date(latest)) return row.latest_chunk_embedding_at;
      return latest;
    }, null),
  };

  const [chunkProbe] = await ragSql`
    with q as (
      select dc.embedding
      from public.document_chunks dc
      where dc.embedding is not null
        and dc.source_type in ('meeting_transcript', 'meeting_summary', 'meeting_segment_summary', 'meeting_notes', 'meeting_section')
      order by dc.updated_at desc nulls last
      limit 1
    )
    select count(*)::int as result_count, max(similarity) as max_similarity
    from q, public.search_document_chunks(
      q.embedding,
      array['meeting_transcript', 'meeting_summary', 'meeting_segment_summary'],
      null,
      5,
      0.3
    )
  `;

  const pipelineJobs = await ragSql`
    select
      j.stage,
      count(*)::int as count,
      min(j.created_at) as oldest_created_at,
      max(j.updated_at) as newest_updated_at
    from public.fireflies_ingestion_jobs j
    join public.rag_document_metadata r on r.id = j.metadata_id
    where j.created_at >= now() - (${FIREFLIES_BACKLOG_CONCERN_WINDOW_DAYS} || ' days')::interval
      and (
        r.source = 'fireflies'
        or r.fireflies_id is not null
        or r.type in ('meeting', 'meeting_transcript')
        or r.category = 'meeting'
      )
    group by j.stage
    order by count desc
  `;

  const quotaErrorJobs = await ragSql`
    select count(*)::int as count
    from public.fireflies_ingestion_jobs j
    join public.rag_document_metadata r on r.id = j.metadata_id
    where j.stage = 'error'
      and j.error_message ilike '%quota%'
      and j.created_at >= now() - (${FIREFLIES_BACKLOG_CONCERN_WINDOW_DAYS} || ' days')::interval
      and (
        r.source = 'fireflies'
        or r.fireflies_id is not null
        or r.type in ('meeting', 'meeting_transcript')
        or r.category = 'meeting'
      )
  `;

  const provider = await probeEmbeddingProvider();

  if (summaryMetadata.embedded_summaries === 0 && chunks.embedded_chunks === 0) {
    fail("No meeting summary or chunk embeddings exist at all. The strategist is keyword-only.");
  }

  if (recent.recent_meetings > 0) {
    const ratio = recentChunkCoverage.recent_meetings_with_embedded_chunks / recent.recent_meetings;
    if (ratio < RECENT_MIN_EMBEDDED_RATIO) {
      fail(
        `Only ${recentChunkCoverage.recent_meetings_with_embedded_chunks} of ${recent.recent_meetings} ` +
          `meetings from the last ${RECENT_WINDOW_DAYS} days have embedded chunks ` +
          `(${(ratio * 100).toFixed(1)}%, required ≥${RECENT_MIN_EMBEDDED_RATIO * 100}%). ` +
          `New meetings are NOT being vectorized. AI Strategist is missing recent context.`
      );
    }

    const chunkRatio =
      recentChunkCoverage.recent_meetings_with_embedded_chunks / recent.recent_meetings;
    if (chunkRatio < RECENT_MIN_CHUNK_RATIO) {
      fail(
        `Only ${recentChunkCoverage.recent_meetings_with_embedded_chunks} of ` +
          `${recent.recent_meetings} meetings from the last ${RECENT_WINDOW_DAYS} days ` +
          `have embedded document_chunks (${(chunkRatio * 100).toFixed(1)}%, ` +
          `required ≥${RECENT_MIN_CHUNK_RATIO * 100}%). ` +
          `AI Strategist semanticSearch is missing recent meeting context.`
      );
    }

    const transcriptRatio =
      recentChunkCoverage.transcript_expected_meetings > 0
        ? recentChunkCoverage.transcript_expected_meetings_with_embedded_transcript_chunks /
          recentChunkCoverage.transcript_expected_meetings
        : 1;
    if (transcriptRatio < RECENT_MIN_TRANSCRIPT_CHUNK_RATIO) {
      fail(
        `Only ${recentChunkCoverage.transcript_expected_meetings_with_embedded_transcript_chunks} of ` +
          `${recentChunkCoverage.transcript_expected_meetings} transcript-bearing meetings from the last ${RECENT_WINDOW_DAYS} days ` +
          `have embedded full-transcript chunks (${(transcriptRatio * 100).toFixed(1)}%, ` +
          `required ≥${RECENT_MIN_TRANSCRIPT_CHUNK_RATIO * 100}%). ` +
          `Meeting summaries may exist, but full-transcript RAG coverage is incomplete.`
      );
    }
  }

  if (metadata.latest_meeting_at && recentChunkCoverage.latest_recent_chunk_embedding_at) {
    const meetingMs = new Date(metadata.latest_meeting_at).getTime();
    const embedMs = new Date(recentChunkCoverage.latest_recent_chunk_embedding_at).getTime();
    const lagDays = (meetingMs - embedMs) / (1000 * 60 * 60 * 24);
    if (lagDays > STALENESS_DAYS) {
      fail(
        `Newest meeting (${new Date(metadata.latest_meeting_at).toISOString().slice(0, 10)}) is ` +
          `${lagDays.toFixed(1)} days ahead of newest recent chunk embedding ` +
          `(${new Date(recentChunkCoverage.latest_recent_chunk_embedding_at).toISOString().slice(0, 10)}). ` +
          `Threshold: ${STALENESS_DAYS} days. Embedding pipeline is stalled.`
      );
    }
  } else if (metadata.latest_meeting_at && !recentChunkCoverage.latest_recent_chunk_embedding_at) {
    fail("Meetings exist but ZERO recent meeting chunks have embeddings. Pipeline never ran.");
  }

  if (chunkProbe.result_count === 0) {
    fail("RPC search_document_chunks returned no meeting chunk results for a known-good probe vector. Retrieval is broken.");
  }

  const rawIngestedJobs = pipelineJobs.find((job) => job.stage === "raw_ingested")?.count ?? 0;
  const errorJobs = pipelineJobs.find((job) => job.stage === "error")?.count ?? 0;
  if (rawIngestedJobs > 100) {
    fail(
      `${rawIngestedJobs} Fireflies ingestion jobs are stuck at raw_ingested. ` +
        `They have not completed segmentation/chunking/embedding and are not reliable RAG context.`
    );
  }
  if ((quotaErrorJobs[0]?.count ?? 0) > 0) {
    fail(
      `${quotaErrorJobs[0].count} Fireflies ingestion jobs failed with quota/provider errors. ` +
        `Retry them through the AI Gateway-backed pipeline after backend config is deployed.`
    );
  } else if (errorJobs > 100) {
    warn(
      `${errorJobs} Fireflies ingestion jobs created in the last ` +
        `${FIREFLIES_BACKLOG_CONCERN_WINDOW_DAYS} days are in error stage; ` +
        `inspect grouped error messages before relying on meeting recall.`
    );
  }

  const result = {
    policy: {
      recentMeetingCoverageWindowDays: RECENT_WINDOW_DAYS,
      firefliesBacklogConcernWindowDays: FIREFLIES_BACKLOG_CONCERN_WINDOW_DAYS,
    },
    metadata,
    summaryMetadata,
    recent,
    chunks,
    recentChunkCoverage,
    pipelineJobs,
    probes: {
      documentChunkSearch: chunkProbe,
      embeddingProvider: provider,
    },
    warnings,
    failures,
  };

  console.log(JSON.stringify(result, null, 2));
  printAndExit();
} catch (err) {
  await runRestFallback(err);
} finally {
  await appSql?.end();
  await ragSql?.end();
}
