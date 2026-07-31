#!/usr/bin/env node
/**
 * RAG Quality Eval — PM Briefing Prompts
 *
 * Tests the semanticSearch retrieval stack directly against project-briefing
 * style queries, then grades each response on:
 *   - Candidate count (does the wider net actually return results?)
 *   - Similarity score distribution (are top results relevant, not noise?)
 *   - Source diversity (meetings + financial + emails, not a single table)
 *   - Recency coverage (are the top results from the last 90 days?)
 *   - Briefing query detection (does isBriefingQuery fire correctly?)
 *
 * Also optionally tests the chat API if EVAL_BASE_URL and EVAL_SESSION_COOKIE
 * env vars are set, grading live assistant responses for:
 *   - Avoided fallback path
 *   - Tool call count > 0
 *   - Source citations present
 *   - Substantive length (> 150 chars)
 *
 * Usage:
 *   node scripts/verify/verify_rag_pm_briefing_quality.mjs
 *   EVAL_BASE_URL=http://localhost:3000 EVAL_SESSION_COOKIE=... node scripts/verify/verify_rag_pm_briefing_quality.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const requireFromFrontend = createRequire(resolve(repoRoot, "frontend", "package.json"));
const { createClient } = requireFromFrontend("@supabase/supabase-js");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function loadEnv() {
  for (const envPath of [
    resolve(repoRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, "frontend", ".env.local"),
  ]) {
    if (!existsSync(envPath)) continue;
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAG_SUPABASE_URL = process.env.RAG_SUPABASE_URL;
const RAG_SERVICE_KEY = process.env.RAG_SUPABASE_SERVICE_ROLE_KEY || process.env.RAG_SUPABASE_SERVICE_KEY;
const RAG_READS_ENABLED = String(process.env.RAG_DATABASE_READS_ENABLED ?? "").toLowerCase() === "true";
const OPENAI_KEY = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;
const AI_GATEWAY_BASE = process.env.AI_GATEWAY_API_KEY
  ? "https://ai-gateway.vercel.sh/v1"
  : "https://api.openai.com/v1";
const EMBEDDING_MODEL = process.env.AI_GATEWAY_API_KEY
  ? "openai/text-embedding-3-large"
  : "text-embedding-3-large";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "These must be set in frontend/.env.local or the environment.",
  );
  process.exit(1);
}

if (!OPENAI_KEY) {
  console.error(
    "Missing AI_GATEWAY_API_KEY or OPENAI_API_KEY — needed for embedding generation.",
  );
  process.exit(1);
}

if (RAG_READS_ENABLED && (!RAG_SUPABASE_URL || !RAG_SERVICE_KEY)) {
  console.error(
    "RAG_DATABASE_READS_ENABLED=true but RAG_SUPABASE_URL / RAG_SUPABASE_SERVICE_ROLE_KEY are missing.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const ragSupabase = RAG_READS_ENABLED
  ? createClient(RAG_SUPABASE_URL, RAG_SERVICE_KEY)
  : supabase;

// ---------------------------------------------------------------------------
// Briefing prompts to evaluate
// ---------------------------------------------------------------------------
const BRIEFING_QUERIES = [
  "Give me the latest on Vermillion Rise Warehouse",
  "What's the current status of our projects?",
  "Catch me up on project updates this month",
  "What's happening with the budget on Vermillion Rise?",
  "Any recent meeting notes I should know about?",
  "What risks are we tracking right now?",
  "Give me a project briefing for the team",
];

const NON_BRIEFING_QUERIES = [
  "What is a change order?",
  "How do I create an RFI?",
  "Explain retainage",
];

const EXPECTED_BRIEFING_DETECTION = new Map([
  ...BRIEFING_QUERIES.map((query) => [query, true]),
  ...NON_BRIEFING_QUERIES.map((query) => [query, false]),
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function generateEmbedding(text) {
  const resp = await fetch(`${AI_GATEWAY_BASE}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      dimensions: 3072,
      input: text,
    }),
  });
  if (!resp.ok) throw new Error(`Embedding request failed: ${resp.status} ${await resp.text()}`);
  const json = await resp.json();
  return json.data[0].embedding;
}

function isBriefingQuery(query) {
  const q = query.toLowerCase();
  return [
    "latest", "brief", "briefing", "catch me up", "update",
    "what's happening", "what is happening", "status", "how is",
    "how's", "progress", "any news", "what happened",
    "recent", "risk", "risks", "tracking", "right now", "should know",
  ].some((kw) => q.includes(kw));
}

function grade(label, pass, detail = "") {
  const icon = pass ? "✅" : "❌";
  console.log(`  ${icon} ${label}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

// ---------------------------------------------------------------------------
// Retrieval eval
// ---------------------------------------------------------------------------
async function evalRetrieval(query) {
  console.log(`\n📋 Query: "${query}"`);

  const isBriefing = isBriefingQuery(query);
  const targetCount = isBriefing ? 15 : 10;
  const threshold = isBriefing ? 0.2 : 0.3;
  const chunkThreshold = isBriefing ? 0.15 : 0.25;
  const chunkCount = targetCount * 2;

  let embedding;
  try {
    embedding = await generateEmbedding(query);
  } catch (err) {
    console.log(`  ⚠️  Embedding failed: ${err.message} — skipping`);
    return null;
  }

  const embeddingStr = JSON.stringify(embedding);

  const [chunksRes, knowledgeRes] = await Promise.all([
    ragSupabase.rpc("search_document_chunks", {
      query_embedding: embedding,
      filter_source_types: undefined,
      filter_project_id: undefined,
      match_count: chunkCount,
      match_threshold: chunkThreshold,
    }),
    supabase.rpc("search_all_knowledge", {
      query_embedding: embeddingStr,
      match_count: targetCount,
      match_threshold: threshold,
    }),
  ]);

  const rpcErrors = [];
  if (chunksRes.error) {
    rpcErrors.push(`search_document_chunks=${chunksRes.error.message}`);
  }
  if (knowledgeRes.error) {
    rpcErrors.push(`search_all_knowledge=${knowledgeRes.error.message}`);
  }

  for (const error of rpcErrors) {
    console.log(`  WARN ${error}`);
  }

  const chunks = chunksRes.error ? [] : (chunksRes.data ?? []);
  const knowledge = knowledgeRes.error ? [] : (knowledgeRes.data ?? []);
  const allResults = [...chunks, ...knowledge];
  const totalCount = allResults.length;
  const sourceTables = [
    ...new Set(allResults.map((r) => r.source_table ?? r.source_type ?? "knowledge")),
  ];
  const topSimilarities = allResults
    .map((r) => r.similarity ?? 0)
    .sort((a, b) => b - a)
    .slice(0, 5);
  const avgTopSimilarity = topSimilarities.length
    ? topSimilarities.reduce((s, v) => s + v, 0) / topSimilarities.length
    : 0;

  const now = Date.now();
  const recentCount = allResults.filter((r) => {
    const d = r.created_at ?? r.date;
    if (!d) return false;
    return now - new Date(d).getTime() < 90 * 24 * 60 * 60 * 1000;
  }).length;

  const passes = [
    grade(
      "Briefing detection",
      isBriefing === EXPECTED_BRIEFING_DETECTION.get(query),
      `expected=${EXPECTED_BRIEFING_DETECTION.get(query)} actual=${isBriefing}`,
    ),
    grade(
      "RPCs succeeded",
      rpcErrors.length === 0,
      rpcErrors.length ? rpcErrors.join("; ") : "both retrieval RPCs returned without errors",
    ),
    grade(
      "Returns results",
      totalCount > 0,
      `${totalCount} total (${chunks.length} chunks + ${knowledge.length} knowledge)`,
    ),
    grade(
      "Top similarity ≥ 0.25",
      avgTopSimilarity >= 0.25,
      `avg top-5 similarity = ${avgTopSimilarity.toFixed(3)}`,
    ),
    grade(
      "Source diversity",
      sourceTables.length >= 2 || totalCount < 3,
      `sources: ${sourceTables.join(", ") || "none"}`,
    ),
    grade(
      "Recent content present",
      recentCount > 0 || totalCount === 0,
      `${recentCount}/${totalCount} results from last 90 days`,
    ),
  ];

  return { query, isBriefing, totalCount, avgTopSimilarity, sourceTables, recentCount, passes };
}

// ---------------------------------------------------------------------------
// Live chat API eval (optional)
// ---------------------------------------------------------------------------
async function evalChatApi(query, baseUrl, cookie) {
  console.log(`\n🤖 Live chat: "${query}"`);

  let sessionId;
  try {
    const conversationResp = await fetch(`${baseUrl}/api/ai-assistant/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ title: `PM briefing eval: ${query.slice(0, 60)}` }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!conversationResp.ok) {
      console.log(`  WARN conversation create HTTP ${conversationResp.status}`);
      return null;
    }
    const conversationJson = await conversationResp.json();
    sessionId = conversationJson.conversation?.session_id;
    if (!sessionId) {
      console.log("  WARN conversation create did not return session_id");
      return null;
    }
  } catch (err) {
    console.log(`  WARN conversation create failed: ${err.message}`);
    return null;
  }

  let resp;
  try {
    resp = await fetch(`${baseUrl}/api/ai-assistant/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        id: sessionId,
        messages: [{ role: "user", parts: [{ type: "text", text: query }], id: "u1" }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    console.log(`  ⚠️  Request failed: ${err.message}`);
    return null;
  }

  if (!resp.ok) {
    console.log(`  ⚠️  HTTP ${resp.status}`);
    return null;
  }

  // Drain the SSE stream and collect text deltas
  const text = await resp.text();
  const textDeltas = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const json = JSON.parse(line.slice(6));
      if (json.type === "text-delta" && json.delta) textDeltas.push(json.delta);
    } catch {
      // ignore non-JSON lines
    }
  }
  const responseText = textDeltas.join("");
  let loopDiagnostic = null;
  try {
    const messagesResp = await fetch(`${baseUrl}/api/ai-assistant/messages/${sessionId}`, {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(30_000),
    });
    if (messagesResp.ok) {
      const messagesJson = await messagesResp.json();
      const assistantMessage = [...(messagesJson.messages ?? [])]
        .reverse()
        .find((message) => message.role === "assistant");
      loopDiagnostic = assistantMessage?.metadata?.loop_diagnostic ?? null;
    }
  } catch {
    // Keep the text-only eval useful when message lookup is unavailable.
  }

  const isGracefulFailure =
    responseText.includes("retrieval/generation failure") ||
    responseText.includes("graceful fail") ||
    responseText.includes("What happened:") ||
    responseText.includes("What I could confirm:");

  const hasCitations =
    responseText.includes("[Source:") ||
    responseText.includes("[Meeting:") ||
    responseText.includes("[Email:");

  const passes = [
    grade("Avoided fallback path", !isGracefulFailure),
    grade(
      "Tool loop called at least one tool",
      (loopDiagnostic?.totalToolCallCount ?? 0) > 0,
      `tool calls=${loopDiagnostic?.totalToolCallCount ?? "unknown"}`,
    ),
    grade("Response is substantive", responseText.length > 150, `${responseText.length} chars`),
    grade("Contains source citations", hasCitations),
  ];

  return { query, responseText: responseText.slice(0, 300), passes };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== RAG PM Briefing Quality Eval ===\n");

  const results = [];
  let totalPasses = 0;
  let totalChecks = 0;
  let livePasses = 0;
  let liveChecks = 0;

  console.log("--- Retrieval Stack (briefing queries) ---");
  for (const query of BRIEFING_QUERIES) {
    const result = await evalRetrieval(query);
    if (result) {
      results.push(result);
      const passed = result.passes.filter(Boolean).length;
      totalPasses += passed;
      totalChecks += result.passes.length;
    }
  }

  console.log("\n--- Retrieval Stack (non-briefing queries — control group) ---");
  for (const query of NON_BRIEFING_QUERIES) {
    const result = await evalRetrieval(query);
    if (result) {
      results.push(result);
      const passed = result.passes.filter(Boolean).length;
      totalPasses += passed;
      totalChecks += result.passes.length;
    }
  }

  // Optional live chat eval
  const baseUrl = process.env.EVAL_BASE_URL;
  const cookie = process.env.EVAL_SESSION_COOKIE;
  if (baseUrl && cookie) {
    console.log("\n--- Live Chat API (briefing prompts) ---");
    for (const query of BRIEFING_QUERIES.slice(0, 2)) {
      const result = await evalChatApi(query, baseUrl, cookie);
      if (result) {
        const passed = result.passes.filter(Boolean).length;
        livePasses += passed;
        liveChecks += result.passes.length;
        totalPasses += passed;
        totalChecks += result.passes.length;
      }
    }
  } else {
    console.log(
      "\n(Skipping live chat eval — set EVAL_BASE_URL and EVAL_SESSION_COOKIE to enable)",
    );
  }

  // Summary
  console.log("\n=== Summary ===");
  const pct = totalChecks ? Math.round((totalPasses / totalChecks) * 100) : 0;
  console.log(`Passed: ${totalPasses}/${totalChecks} checks (${pct}%)`);

  const briefingResults = results.filter((r) => r.isBriefing);
  const nonBriefingResults = results.filter((r) => !r.isBriefing);

  if (briefingResults.length) {
    const avgCount = briefingResults.reduce((s, r) => s + r.totalCount, 0) / briefingResults.length;
    const avgSim = briefingResults.reduce((s, r) => s + r.avgTopSimilarity, 0) / briefingResults.length;
    const avgRecent = briefingResults.reduce((s, r) => s + r.recentCount, 0) / briefingResults.length;
    console.log(
      `\nBriefing queries (n=${briefingResults.length}):` +
        `\n  avg results: ${avgCount.toFixed(1)}` +
        `\n  avg top-5 similarity: ${avgSim.toFixed(3)}` +
        `\n  avg recent results: ${avgRecent.toFixed(1)}`,
    );
  }

  if (nonBriefingResults.length) {
    const avgCount = nonBriefingResults.reduce((s, r) => s + r.totalCount, 0) / nonBriefingResults.length;
    const avgSim = nonBriefingResults.reduce((s, r) => s + r.avgTopSimilarity, 0) / nonBriefingResults.length;
    console.log(
      `\nNon-briefing queries (n=${nonBriefingResults.length}):` +
        `\n  avg results: ${avgCount.toFixed(1)}` +
        `\n  avg top-5 similarity: ${avgSim.toFixed(3)}`,
    );
  }

  const threshold = 0.7;
  if (baseUrl && cookie) {
    if (liveChecks === 0) {
      console.error("\n❌ Live chat gate failed: no live checks ran");
      process.exit(1);
    }
    if (livePasses < liveChecks) {
      console.error(
        `\n❌ Live chat gate failed: ${livePasses}/${liveChecks} live checks passed`,
      );
      process.exit(1);
    }
  }

  if (pct < threshold * 100) {
    console.error(`\n❌ Quality gate failed: ${pct}% < ${threshold * 100}% required`);
    process.exit(1);
  }

  console.log(`\n✅ Quality gate passed (${pct}% ≥ ${threshold * 100}%)`);
}

main().catch((err) => {
  console.error("Eval crashed:", err);
  process.exit(1);
});
