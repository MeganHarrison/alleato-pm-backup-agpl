#!/usr/bin/env node
/**
 * Detect under-embedded documents in the RAG store.
 *
 * Failure mode this guards against (see docs/architecture/AI-RAG-ARCHITECTURE.md §6):
 * a document can be marked `embedded` yet have only ONE chunk (the summary) because
 * Stage-1 segmentation left 0 rows in `meeting_segments`. Its transcript body
 * (often 20k–50k chars, living in rag_document_metadata.content) never gets chunked,
 * so it is effectively invisible to semantic search.
 *
 * This scans the most recent `--scan` documents, counts each one's chunks in the AI
 * Database `document_chunks` table (keyed by document_id, PK = chunk_id — NOT id),
 * and flags any doc whose content is large but chunk count is <= 1.
 *
 * Usage:
 *   node scripts/rag/detect-under-embedded-docs.mjs
 *   node scripts/rag/detect-under-embedded-docs.mjs --scan 3000 --min-content 4000
 *   node scripts/rag/detect-under-embedded-docs.mjs --category "Annual Review"
 *   node scripts/rag/detect-under-embedded-docs.mjs --fix          # re-embed flagged docs
 *
 * Exit code 1 if any under-embedded doc is found (so CI/monitors fail loudly).
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: "frontend/.env.local", override: true, quiet: true });

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const has = (name) => args.includes(`--${name}`);

const SCAN = parseInt(flag("scan", "1500"), 10);
const MIN_CONTENT = parseInt(flag("min-content", "4000"), 10); // chars of content that should yield >1 chunk
const MAX_CHUNKS = parseInt(flag("max-chunks", "1"), 10); // flag docs with <= this many chunks
const CATEGORY = flag("category", null);
const SINCE = flag("since", null); // ISO date (YYYY-MM-DD); only scan docs created on/after this
const DO_FIX = has("fix");
const CONCURRENCY = 8;
const WORKFLOW_SECRET =
  process.env.RAG_PIPELINE_WORKFLOW_SECRET?.trim();

// Statuses that mean "deliberately not embedded" — NOT under-embedding bugs.
// `intentionally_excluded` covers interview titles (see embedder `_is_interview_title`);
// low-content statuses are docs with genuinely too little text to chunk.
const EXCLUDED_STATUSES = new Set([
  "intentionally_excluded",
  "low_content",
  "low_content_no_embeddable_text",
]);

const PM_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const PM_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;
const RAG_URL = process.env.RAG_SUPABASE_URL;
const RAG_KEY = process.env.RAG_SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = (
  process.env.ALLEATO_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://projects.alleatogroup.com"
).replace(/\/+$/, "");

if (!PM_URL || !PM_KEY || !RAG_URL || !RAG_KEY) {
  console.error(
    "Missing env. Need SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY and RAG_SUPABASE_URL/RAG_SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(2);
}

async function rest(baseUrl, key, path, { headers = {} } = {}) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...headers },
  });
  if (!res.ok) {
    throw new Error(`REST ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
  }
  return res;
}

/** Count chunks for a document_id. NOTE: PK is chunk_id, not id. */
async function chunkCount(documentId) {
  const res = await rest(
    RAG_URL,
    RAG_KEY,
    `document_chunks?select=chunk_id&document_id=eq.${documentId}&limit=1`,
    { headers: { Prefer: "count=exact", "Range-Unit": "items", Range: "0-0" } },
  );
  const range = res.headers.get("content-range") || "*/0";
  return parseInt(range.split("/")[1] || "0", 10);
}

/** rag_document_metadata.content length (falls back to raw_text). */
async function ragContentLen(documentId) {
  const res = await rest(
    RAG_URL,
    RAG_KEY,
    `rag_document_metadata?select=content,raw_text&id=eq.${documentId}&limit=1`,
  );
  const row = (await res.json())[0];
  if (!row) return 0;
  return (row.content || row.raw_text || "").length;
}

async function reembed(documentId) {
  if (!WORKFLOW_SECRET) {
    throw new Error(
      "RAG_PIPELINE_WORKFLOW_SECRET not set — cannot --fix",
    );
  }
  const res = await fetch(`${APP_URL}/api/rag-pipeline/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WORKFLOW_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ documentId }),
  });
  if (!res.ok) throw new Error(`reembed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  // Pull the most recent N docs to scan (id,title,category,status,created_at).
  const catFilter = CATEGORY ? `&category=ilike.*${encodeURIComponent(CATEGORY)}*` : "";
  const sinceFilter = SINCE ? `&created_at=gte.${encodeURIComponent(SINCE)}` : "";
  // PostgREST caps a single response at ~1000 rows, so page through until we
  // reach SCAN or run out of matching docs.
  const PAGE = 1000;
  const docs = [];
  for (let offset = 0; offset < SCAN; offset += PAGE) {
    const limit = Math.min(PAGE, SCAN - offset);
    const page = await rest(
      PM_URL,
      PM_KEY,
      `document_metadata?select=id,title,category,status,created_at${catFilter}${sinceFilter}&order=created_at.desc&offset=${offset}&limit=${limit}`,
    ).then((r) => r.json());
    docs.push(...page);
    if (page.length < limit) break;
  }
  const scope = [
    SINCE ? `since ${SINCE}` : "most recent",
    CATEGORY ? `category ~ "${CATEGORY}"` : null,
  ].filter(Boolean).join(", ");
  console.log(
    `Scanning ${docs.length} documents (${scope}) · flagging content > ${MIN_CONTENT} chars with <= ${MAX_CHUNKS} chunk(s)...\n`,
  );

  const counts = await mapLimit(docs, CONCURRENCY, (d) => chunkCount(d.id));
  const excludedByStatus = docs.filter(
    (d, idx) => counts[idx] <= MAX_CHUNKS && EXCLUDED_STATUSES.has((d.status || "").toLowerCase()),
  );
  const suspects = docs.filter(
    (d, idx) => counts[idx] <= MAX_CHUNKS && !EXCLUDED_STATUSES.has((d.status || "").toLowerCase()),
  );

  const flagged = [];
  await mapLimit(suspects, CONCURRENCY, async (d) => {
    const len = await ragContentLen(d.id);
    if (len > MIN_CONTENT) {
      const chunks = counts[docs.indexOf(d)];
      flagged.push({ id: d.id, title: d.title, status: d.status, contentLen: len, chunks });
    }
  });

  flagged.sort((a, b) => b.contentLen - a.contentLen);

  if (excludedByStatus.length) {
    console.log(
      `ℹ️  Skipped ${excludedByStatus.length} doc(s) that are intentionally not embedded (interview titles / low-content) — not bugs.\n`,
    );
  }

  if (flagged.length === 0) {
    console.log("✅ No under-embedded documents found in the scanned window.");
    process.exit(0);
  }

  console.log(`❌ ${flagged.length} under-embedded document(s):\n`);
  for (const f of flagged) {
    console.log(
      `  chunks=${f.chunks} contentLen=${f.contentLen} status=${f.status} | ${f.id} | ${(f.title || "").slice(0, 50)}`,
    );
  }

  if (DO_FIX) {
    console.log(`\nRe-embedding ${flagged.length} doc(s) via ${APP_URL}/api/rag-pipeline/process ...`);
    for (const f of flagged) {
      try {
        await reembed(f.id);
        console.log(`  queued ${f.id}`);
      } catch (e) {
        console.log(`  FAILED ${f.id}: ${e.message}`);
      }
    }
    console.log("Re-embed queued. Re-run this script in a few minutes to confirm chunk counts recovered.");
  } else {
    console.log(`\nTo re-embed all flagged docs: node scripts/rag/detect-under-embedded-docs.mjs --fix`);
  }

  process.exit(1);
}

main().catch((e) => {
  console.error("detect-under-embedded-docs failed:", e.message);
  process.exit(2);
});
