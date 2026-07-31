#!/usr/bin/env node

/**
 * AI Assistant Eval Suite Runner
 * ------------------------------
 * Loads the prompt corpus from docs/ai-plan/evals/assistant-eval-suite.json,
 * POSTs each prompt to /api/ai-assistant/chat using the saved Playwright auth
 * cookies, drains the SSE stream, then queries chat_history.metadata.tool_trace
 * to score tool coverage and answer-quality assertions.
 *
 * Usage:
 *   node scripts/verify/verify_ai_assistant_eval_suite.mjs              # full suite
 *   node scripts/verify/verify_ai_assistant_eval_suite.mjs --case <id>  # single case
 *   node scripts/verify/verify_ai_assistant_eval_suite.mjs --bundle <name>
 *   node scripts/verify/verify_ai_assistant_eval_suite.mjs --filter <regex>
 *   node scripts/verify/verify_ai_assistant_eval_suite.mjs --suite <path>
 *   node scripts/verify/verify_ai_assistant_eval_suite.mjs --no-publish-index
 *   AI_EVAL_BASE_URL=https://alleato.example.com node ... # remote target
 *
 * Outputs:
 *   docs/ai-plan/evals/runs/<timestamp>/results.json
 *   docs/ai-plan/evals/runs/<timestamp>/summary.md
 *   docs/ai-plan/evals/runs/<timestamp>/<case-id>.json (per-case full trace)
 */

import fs from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { setDefaultResultOrder } from "node:dns";
import { lookup } from "node:dns/promises";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import {
  compareCollectionAuditParity,
  evaluateCollectionAudit,
} from "./collection-audit-lib.mjs";

setDefaultResultOrder("ipv4first");

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({
  path: path.join(repoRoot, "frontend/.env.local"),
  quiet: true,
});

const SUITE_PATH_CANDIDATES = ["docs/ai-plan/evals/assistant-eval-suite.json"];
const AUTH_PATH = path.join(repoRoot, "frontend/tests/.auth/user.json");
const PUBLISHED_ASSISTANT_EVAL_RUNS_PATH = path.join(
  repoRoot,
  "frontend/src/data/assistant-eval-runs.json",
);
const BASE_URL = process.env.AI_EVAL_BASE_URL || "http://localhost:3000";
const CHAT_ENDPOINT = `${BASE_URL}/api/ai-assistant/chat`;
const CASE_TIMEOUT_MS = Number(process.env.AI_EVAL_CASE_TIMEOUT_MS ?? 90_000);
const POLL_INTERVAL_MS = 750;
const POLL_MAX_MS = 15_000;
const DEFAULT_WARN_DURATION_MS = Number(
  suiteSafeNumber(process.env.AI_EVAL_WARN_DURATION_MS) ?? 30_000,
);
const JUDGE_ENABLED = process.env.AI_EVAL_JUDGE_ENABLED !== "false";
const JUDGE_MODEL = process.env.AI_EVAL_JUDGE_MODEL || "openai/gpt-5.4-mini";
const JUDGE_TIMEOUT_MS = Number(process.env.AI_EVAL_JUDGE_TIMEOUT_MS ?? 45_000);

const JUDGE_RUBRICS = {
  strategic_advisor: {
    label: "Strategic Advisor Quality",
    minScore: 4,
    dimensions: [
      "Leads with a clear executive point of view instead of a neutral data recap.",
      "Connects evidence into business implications, tradeoffs, or second-order risks.",
      "Gives specific, operational next steps with owners/timing when supported.",
      "Surfaces what the user did not ask but should be thinking about.",
      "Sounds like a high-level strategist who knows the business, not a document retriever.",
      "Stays honest about missing or weak evidence and does not fabricate details.",
      "Keeps project-specific claims anchored to the requested project and labels adjacent-project or generic source material as background only.",
    ],
  },
  email_operator: {
    label: "Email Operator Quality",
    minScore: 4,
    dimensions: [
      "Separates urgent/critical email from normal inbox noise.",
      "Identifies who needs a response, why it matters, and what could happen if ignored.",
      "Summarizes email threads efficiently without dumping raw message data.",
      "Recommends a concrete response path: reply now, delegate, watch, draft, or ignore.",
      "For draft requests, sounds short, direct, and practical enough for Brandon to review and send.",
      "Never claims an email was sent and never invents thread details not present in the answer.",
      "Separates confirmed user-owned actions from inbox items that merely exist or look interesting.",
      "Labels suspicious, phishing, urgency, or ignore recommendations as evidence-backed judgments instead of unsupported certainty.",
    ],
  },
};

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const args = process.argv.slice(2);
function flagValue(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
const onlyCase = flagValue("--case");
const bundleName = flagValue("--bundle");
const filterPattern = flagValue("--filter");
const explicitSuitePath = flagValue("--suite");
const publishRunIndex = !args.includes("--no-publish-index");

function suiteSafeNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// ───────────────────────────────────────────────────────────── Suite load
const suitePathCandidates = explicitSuitePath
  ? [path.resolve(repoRoot, explicitSuitePath)]
  : SUITE_PATH_CANDIDATES.map((candidate) => path.join(repoRoot, candidate));
const suitePath = suitePathCandidates.find((candidatePath) =>
  existsSync(candidatePath),
);
if (!suitePath) {
  console.error(
    `Missing assistant eval suite. Looked for: ${suitePathCandidates.join(", ")}`,
  );
  process.exit(1);
}
const suiteRaw = await fs.readFile(suitePath, "utf8");
const suite = JSON.parse(suiteRaw);
applyCurrentContractOverrides(suite);
const bundle = bundleName ? suite.evalBundles?.[bundleName] : null;
if (bundleName && !bundle) {
  console.error(`Unknown eval bundle: ${bundleName}`);
  console.error("Available bundles:");
  for (const name of Object.keys(suite.evalBundles ?? {}))
    console.error(`  - ${name}`);
  process.exit(1);
}
const effectiveFilterPattern = filterPattern ?? bundle?.filter;
const allCases = suite.cases ?? [];
const cases = allCases.filter((c) => {
  if (onlyCase && c.id !== onlyCase) return false;
  if (effectiveFilterPattern && !new RegExp(effectiveFilterPattern).test(c.id))
    return false;
  return true;
});
if (cases.length === 0) {
  console.error("No cases matched. Available case IDs:");
  for (const c of allCases) console.error(`  - ${c.id}`);
  process.exit(1);
}

function applyCurrentContractOverrides(loadedSuite) {
  const cases = Array.isArray(loadedSuite?.cases) ? loadedSuite.cases : [];
  const meetingSourceCase = cases.find(
    (testCase) => testCase?.id === "source-lookup-meetings",
  );
  if (meetingSourceCase) {
    meetingSourceCase.expectedToolFamilies = ["meetings"];
    meetingSourceCase.expectedToolNames = ["sourceSpecificRagRetrieval"];
  }

  loadedSuite.toolFamilyMap ??= {};
  const meetingTools = Array.isArray(loadedSuite.toolFamilyMap.meetings)
    ? loadedSuite.toolFamilyMap.meetings
    : [];
  if (!meetingTools.includes("sourceSpecificRagRetrieval")) {
    loadedSuite.toolFamilyMap.meetings = [
      "sourceSpecificRagRetrieval",
      ...meetingTools,
    ];
  }
}

// ───────────────────────────────────────────────────────── Auth + run dir
const authState = existsSync(AUTH_PATH)
  ? JSON.parse(await fs.readFile(AUTH_PATH, "utf8"))
  : { cookies: [], origins: [] };
let cookieHeader = (authState.cookies ?? [])
  .map((c) => `${c.name}=${c.value}`)
  .join("; ");

// ─────────────────────────────────────────────────────── Auth refresh
const SUPABASE_URL =
  process.env.AI_EVAL_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.AI_EVAL_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CONFIGURED_SUPABASE_EMAIL =
  process.env.AI_EVAL_SUPABASE_EMAIL || process.env.TEST_USER_1;
const CONFIGURED_SUPABASE_PASSWORD =
  process.env.AI_EVAL_SUPABASE_PASSWORD || process.env.TEST_PASSWORD_1;
const REQUIRE_CONFIGURED_AUTH =
  process.env.AI_EVAL_REQUIRE_CONFIGURED_AUTH === "true";
const SUPABASE_EMAIL = CONFIGURED_SUPABASE_EMAIL || "test1@mail.com";
const SUPABASE_PASSWORD = CONFIGURED_SUPABASE_PASSWORD || "test12026!!!";
const SUPABASE_COOKIE_NAME = "sb-lgveqfnpkxvzbnnwuled-auth-token";
const SUPABASE_PROJECT_REF = "lgveqfnpkxvzbnnwuled";
const SUPABASE_POOLER_HOST = "aws-1-us-east-2.pooler.supabase.com";
const REFRESH_BUFFER_SEC = 5 * 60; // refresh if expiring within 5 minutes
const AUTH_REFRESH_RETRIES = 3;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Missing Supabase auth refresh config. Set AI_EVAL_SUPABASE_URL/SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and AI_EVAL_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
  process.exit(1);
}
if (
  REQUIRE_CONFIGURED_AUTH &&
  (!CONFIGURED_SUPABASE_EMAIL || !CONFIGURED_SUPABASE_PASSWORD)
) {
  console.error(
    "Configured eval auth is required. Set AI_EVAL_SUPABASE_EMAIL/AI_EVAL_SUPABASE_PASSWORD or TEST_USER_1/TEST_PASSWORD_1.",
  );
  process.exit(1);
}

function getCookieExpiry(header) {
  // Find the auth cookie in the header string and decode its expiry.
  // Cookie value format: base64-<base64-encoded-JSON>
  // The JSON contains { expires_at: <unix-seconds> }
  const match = header.match(new RegExp(`${SUPABASE_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    let value = match[1];
    if (value.startsWith("base64-")) value = value.slice("base64-".length);
    const decoded = Buffer.from(value, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return typeof parsed.expires_at === "number" ? parsed.expires_at : null;
  } catch {
    return null;
  }
}

async function refreshAuthIfNeeded() {
  const expiresAt = getCookieExpiry(cookieHeader);
  const nowSec = Math.floor(Date.now() / 1000);

  if (expiresAt !== null && expiresAt - nowSec > REFRESH_BUFFER_SEC) {
    // Token still valid with enough headroom — nothing to do.
    return cookieHeader;
  }

  // Token is missing, expired, or expiring soon — fetch a fresh one.
  if (!cookieHeader) {
    console.log(
      `[auth] Auth state missing or empty at ${AUTH_PATH}; creating a fresh eval session.`,
    );
  }
  let res = null;
  let lastAuthError = null;
  for (let attempt = 1; attempt <= AUTH_REFRESH_RETRIES; attempt += 1) {
    try {
      res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: SUPABASE_EMAIL,
          password: SUPABASE_PASSWORD,
        }),
      });
      if (res.ok || res.status < 500 || attempt === AUTH_REFRESH_RETRIES) break;
      lastAuthError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastAuthError = error;
      if (attempt === AUTH_REFRESH_RETRIES) break;
    }
    const backoffMs = 500 * attempt;
    console.warn(
      `[auth] Refresh attempt ${attempt} failed; retrying in ${backoffMs}ms.`,
    );
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }

  if (!res?.ok) {
    const text = res
      ? await res.text().catch(() => "")
      : String(lastAuthError?.message ?? "unknown error");
    throw new Error(
      `Auth refresh failed (HTTP ${res?.status ?? "unknown"}): ${text.slice(0, 200)}`,
    );
  }

  const session = await res.json();
  const {
    access_token,
    token_type,
    expires_in,
    expires_at: newExpiresAt,
    refresh_token,
    user,
  } = session;

  // Encode new cookie value in the same format Supabase sets via the browser.
  const payload = JSON.stringify({
    access_token,
    token_type,
    expires_in,
    expires_at: newExpiresAt,
    refresh_token,
    user,
  });
  const encoded = `base64-${Buffer.from(payload).toString("base64")}`;

  // Patch the in-memory authState and persist it back to the file.
  const existingCookieIndex = (authState.cookies ?? []).findIndex(
    (c) => c.name === SUPABASE_COOKIE_NAME,
  );
  const newCookie = {
    name: SUPABASE_COOKIE_NAME,
    value: encoded,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  };
  if (existingCookieIndex >= 0) {
    authState.cookies[existingCookieIndex] = {
      ...authState.cookies[existingCookieIndex],
      value: encoded,
    };
  } else {
    authState.cookies = [...(authState.cookies ?? []), newCookie];
  }
  mkdirSync(path.dirname(AUTH_PATH), { recursive: true });
  await fs.writeFile(AUTH_PATH, JSON.stringify(authState, null, 2));

  // Rebuild the cookie header string.
  cookieHeader = authState.cookies
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const expiryIso = newExpiresAt
    ? new Date(newExpiresAt * 1000).toISOString()
    : "(unknown)";
  console.log(`[auth] Token refreshed, expires ${expiryIso}`);

  return cookieHeader;
}

const runStamp = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const runDir = path.join(repoRoot, "docs/ai-plan/evals/runs", runStamp);
mkdirSync(runDir, { recursive: true });

// ─────────────────────────────────────────────────────────────── DB pool
async function buildDatabaseConnectionString() {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.delete("sslmode");

  if (url.hostname === `db.${SUPABASE_PROJECT_REF}.supabase.co`) {
    url.hostname = SUPABASE_POOLER_HOST;
    url.port = url.port || "5432";
    if (url.username === "postgres") {
      url.username = `postgres.${SUPABASE_PROJECT_REF}`;
    }
  }

  if (!/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
    try {
      const { address, family } = await lookup(url.hostname, { family: 4 });
      if (family === 4) url.hostname = address;
    } catch (error) {
      console.warn(
        `[db] IPv4 hostname lookup failed for ${url.hostname}: ${error.message}`,
      );
    }
  }

  return url.toString();
}

const pool = new pg.Pool({
  connectionString: await buildDatabaseConnectionString(),
  ssl: { rejectUnauthorized: false },
  max: 2,
});

// ───────────────────────────────────────────────────────── Helpers
function tokenizeUserId() {
  // Decode the supabase auth cookie to extract the user id for chat_history filtering.
  const cookie = (authState.cookies ?? []).find(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
  );
  if (!cookie) return null;
  try {
    let value = cookie.value;
    if (value.startsWith("base64-")) value = value.slice("base64-".length);
    const decoded = Buffer.from(value, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed?.user?.id ?? parsed?.access_token_payload?.sub ?? null;
  } catch (error) {
    return null;
  }
}
async function postPromptAndDrain(testCase, sessionId, messageId) {
  const currentCookieHeader = await refreshAuthIfNeeded();
  const messages =
    Array.isArray(testCase.messages) && testCase.messages.length > 0
      ? testCase.messages.map((message, index) => ({
          id:
            message.id ??
            (index === testCase.messages.length - 1 ? messageId : randomUUID()),
          role: message.role,
          parts: [
            { type: "text", text: message.content ?? message.text ?? "" },
          ],
        }))
      : [
          {
            id: messageId,
            role: "user",
            parts: [{ type: "text", text: testCase.prompt }],
          },
        ];

  const body = {
    id: sessionId,
    selectedProjectId: testCase.selectedProjectId,
    messages,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CASE_TIMEOUT_MS);
  const startedAt = Date.now();

  let response;
  try {
    response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: currentCookieHeader,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    return {
      httpStatus: 0,
      streamText: "",
      streamEvents: [],
      streamError: error.message,
      durationMs: Date.now() - startedAt,
    };
  }

  if (!response.ok) {
    clearTimeout(timer);
    const text = await response.text().catch(() => "");
    return {
      httpStatus: response.status,
      streamText: text,
      streamEvents: [],
      streamError: `HTTP ${response.status}: ${text.slice(0, 400)}`,
      durationMs: Date.now() - startedAt,
    };
  }

  const reader = response.body?.getReader();
  if (!reader) {
    clearTimeout(timer);
    return {
      httpStatus: response.status,
      streamText: "",
      streamEvents: [],
      streamError: "No readable stream",
      durationMs: Date.now() - startedAt,
    };
  }

  const decoder = new TextDecoder();
  const streamEvents = [];
  let buffer = "";
  let textAccumulator = "";
  let midStreamError = null;
  try {
    while (true) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (error) {
        midStreamError = `stream read error: ${error.message ?? String(error)}`;
        break;
      }
      const { done, value } = chunk;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line || !line.startsWith("data:")) continue;
        const payload = line.slice("data:".length).trim();
        if (payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          streamEvents.push(evt);
          if (evt.type === "text-delta" && typeof evt.delta === "string") {
            textAccumulator += evt.delta;
          } else if (evt.type === "text" && typeof evt.text === "string") {
            textAccumulator += evt.text;
          }
        } catch {
          // Non-JSON SSE frame; ignore.
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }

  return {
    httpStatus: response.status,
    streamText: textAccumulator,
    streamEvents,
    streamError: midStreamError,
    durationMs: Date.now() - startedAt,
  };
}

async function fetchPersistedAssistantMessage(sessionId) {
  const deadline = Date.now() + POLL_MAX_MS;
  let lastLookupError = null;
  while (Date.now() < deadline) {
    try {
      const result = await pool.query(
        `select id, role, content, metadata, sources, created_at
         from public.chat_history
         where session_id = $1 and role = 'assistant'
         order by created_at desc
         limit 1`,
        [sessionId],
      );
      if (result.rows.length > 0) return result.rows[0];
    } catch (error) {
      lastLookupError = error;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  if (lastLookupError) {
    console.warn(
      `\n[warn] persisted assistant lookup failed for session ${sessionId}: ${lastLookupError.message}`,
    );
  }
  return null;
}

function extractToolNames(metadata) {
  const trace = metadata?.tool_trace;
  if (!Array.isArray(trace)) return [];
  return trace
    .map((entry) => entry?.tool ?? entry?.toolName ?? entry?.name)
    .filter((name) => typeof name === "string");
}

function extractStreamToolNames(streamEvents) {
  if (!Array.isArray(streamEvents)) return [];
  const toolNames = streamEvents
    .map((event) => event?.toolName)
    .filter((name) => typeof name === "string");
  const retrievalToolMap = {
    recent_emails: "getRecentEmails",
    source_specific_rag: "sourceSpecificRagRetrieval",
    semantic_search: "semanticSearch",
    project_snapshot: "getProjectBriefingSnapshot",
    intelligence_packet: "loadIntelligencePacket",
    brandon_daily: "generateDailyBrief",
  };
  for (const event of streamEvents) {
    const durations = event?.data?.durations;
    if (!durations || typeof durations !== "object") continue;
    for (const source of Object.keys(durations)) {
      const mapped = retrievalToolMap[source];
      if (mapped) toolNames.push(mapped);
    }
  }
  return toolNames;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string"))];
}

function metadataPath(metadata, pathExpression) {
  return String(pathExpression)
    .split(".")
    .filter(Boolean)
    .reduce((value, key) => {
      if (value == null) return undefined;
      if (Array.isArray(value) && /^\d+$/.test(key)) return value[Number(key)];
      if (typeof value === "object") return value[key];
      return undefined;
    }, metadata);
}

function findToolTrace(metadata, toolName) {
  const trace = metadata?.tool_trace;
  if (!Array.isArray(trace)) return null;
  return (
    trace.find((entry) => {
      const name = entry?.tool ?? entry?.toolName ?? entry?.name;
      return name === toolName;
    }) ?? null
  );
}

function collectTraceSources(value, sources = []) {
  if (!value || typeof value !== "object") return sources;
  if (Array.isArray(value)) {
    for (const item of value) collectTraceSources(item, sources);
    return sources;
  }
  if (typeof value.source === "string") sources.push(value.source);
  for (const nested of Object.values(value)) collectTraceSources(nested, sources);
  return sources;
}

function traceSourcesForTool(metadata, toolName) {
  const trace = metadata?.tool_trace;
  if (!Array.isArray(trace)) return [];
  return uniqueStrings(
    trace
      .filter((entry) => {
        const name = entry?.tool ?? entry?.toolName ?? entry?.name;
        return name === toolName;
      })
      .flatMap((entry) => collectTraceSources(entry)),
  );
}

function extractBackendDeepAgentMemory(metadata) {
  const backend = metadata?.backend_deep_agent;
  if (!backend || typeof backend !== "object") {
    return { candidateCount: 0, candidates: [] };
  }
  const rawCandidates = Array.isArray(backend.memory_candidates)
    ? backend.memory_candidates
    : [];
  const candidateCount =
    typeof backend.memory_candidate_count === "number"
      ? backend.memory_candidate_count
      : rawCandidates.length;
  return {
    candidateCount,
    candidates: rawCandidates.filter(
      (candidate) => candidate && typeof candidate === "object",
    ),
  };
}

function extractSkillUsage(metadata) {
  const usage = metadata?.skill_usage;
  if (!usage || typeof usage !== "object") {
    return {
      totalSelected: 0,
      selectionSurface: null,
      skills: [],
    };
  }

  const skills = Array.isArray(usage.skills)
    ? usage.skills.filter((skill) => skill && typeof skill === "object")
    : [];

  return {
    totalSelected:
      typeof usage.totalSelected === "number" ? usage.totalSelected : skills.length,
    selectionSurface:
      typeof usage.selectionSurface === "string"
        ? usage.selectionSurface
        : null,
    skills,
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsForbiddenPhrase(text, phrase) {
  const normalizedPhrase = String(phrase);
  if (/^[A-Za-z0-9]+$/.test(normalizedPhrase)) {
    return new RegExp(`\\b${escapeRegExp(normalizedPhrase)}\\b`, "i").test(
      text,
    );
  }
  return text.toLowerCase().includes(normalizedPhrase.toLowerCase());
}

const qualityRank = { low: 1, medium: 2, high: 3 };

function getJudgeConfig() {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (gatewayKey && process.env.AI_PROVIDER_PATH !== "openai") {
    return {
      apiKey: gatewayKey,
      baseUrl: "https://ai-gateway.vercel.sh/v1",
      model: JUDGE_MODEL.includes("/") ? JUDGE_MODEL : `openai/${JUDGE_MODEL}`,
      provider: "vercel_gateway",
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return {
      apiKey: openAiKey,
      baseUrl: "https://api.openai.com/v1",
      model: JUDGE_MODEL.replace(/^openai\//, ""),
      provider: "openai",
    };
  }

  return null;
}

function getJudgeRubric(testCase) {
  const rubricName = testCase.judgeRubric ?? bundle?.judgeRubric;
  if (!rubricName) return null;
  const rubric = JUDGE_RUBRICS[rubricName];
  if (!rubric) {
    return {
      name: rubricName,
      error: `Unknown judge rubric: ${rubricName}`,
    };
  }
  return {
    name: rubricName,
    ...rubric,
    minScore:
      suiteSafeNumber(testCase.minJudgeScore) ??
      suiteSafeNumber(bundle?.minJudgeScore) ??
      rubric.minScore,
  };
}

function extractJsonObject(text) {
  const trimmed = String(text ?? "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Judge did not return parseable JSON.");
  }
}

async function evaluateWithJudge(testCase, score) {
  const rubric = getJudgeRubric(testCase);
  if (!rubric) return null;
  if (rubric.error) {
    return {
      status: "error",
      rubric: rubric.name,
      score: 0,
      minScore: 0,
      summary: rubric.error,
      strengths: [],
      weaknesses: [rubric.error],
      dimensionScores: {},
      provider: null,
      model: JUDGE_MODEL,
    };
  }
  if (!JUDGE_ENABLED) {
    return {
      status: "skipped",
      rubric: rubric.name,
      score: null,
      minScore: rubric.minScore,
      summary: "Judge disabled with AI_EVAL_JUDGE_ENABLED=false.",
      strengths: [],
      weaknesses: [],
      dimensionScores: {},
      provider: null,
      model: JUDGE_MODEL,
    };
  }

  const config = getJudgeConfig();
  if (!config) {
    return {
      status: "error",
      rubric: rubric.name,
      score: 0,
      minScore: rubric.minScore,
      summary:
        "AI_EVAL_JUDGE_MODEL requires AI_GATEWAY_API_KEY or OPENAI_API_KEY.",
      strengths: [],
      weaknesses: ["No judge provider key configured."],
      dimensionScores: {},
      provider: null,
      model: JUDGE_MODEL,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: [
              "You are an unforgiving evaluator for a construction-business AI assistant.",
              "Return only JSON. Do not reward generic fluent writing.",
              "A high score requires business judgment, specificity, and honest evidence handling.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `Rubric: ${rubric.label}`,
              `Minimum passing score: ${rubric.minScore}/5`,
              "",
              "Score each dimension from 1 to 5:",
              ...rubric.dimensions.map(
                (dimension, index) => `${index + 1}. ${dimension}`,
              ),
              "",
              "Case prompt:",
              testCase.prompt,
              "",
              `Intent: ${testCase.intent}`,
              `Tools fired: ${score.toolNames.join(", ") || "(none)"}`,
              "",
              "Assistant answer:",
              score.finalText || "(empty)",
              "",
              "Return JSON with this exact shape:",
              '{"score": number, "passes": boolean, "summary": string, "strengths": string[], "weaknesses": string[], "dimensionScores": {"dimension_name": number}}',
            ].join("\n"),
          },
        ],
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${raw.slice(0, 300)}`);
    }

    const payload = JSON.parse(raw);
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = extractJsonObject(content);
    const judgeScore = Number(parsed.score);
    const passes =
      parsed.passes === true &&
      Number.isFinite(judgeScore) &&
      judgeScore >= rubric.minScore;

    return {
      status: passes ? "pass" : "fail",
      rubric: rubric.name,
      score: Number.isFinite(judgeScore) ? judgeScore : 0,
      minScore: rubric.minScore,
      summary: String(parsed.summary ?? ""),
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.map(String).slice(0, 5)
        : [],
      weaknesses: Array.isArray(parsed.weaknesses)
        ? parsed.weaknesses.map(String).slice(0, 5)
        : [],
      dimensionScores:
        parsed.dimensionScores && typeof parsed.dimensionScores === "object"
          ? parsed.dimensionScores
          : {},
      provider: config.provider,
      model: config.model,
    };
  } catch (error) {
    return {
      status: "error",
      rubric: rubric.name,
      score: 0,
      minScore: rubric.minScore,
      summary: error instanceof Error ? error.message : String(error),
      strengths: [],
      weaknesses: [error instanceof Error ? error.message : String(error)],
      dimensionScores: {},
      provider: config.provider,
      model: config.model,
    };
  } finally {
    clearTimeout(timer);
  }
}

function scoreCase(testCase, runOutput, persisted) {
  const failures = [];
  const warnings = [];
  const observations = [];

  const finalText = (
    persisted?.content && typeof persisted.content === "string"
      ? persisted.content
      : runOutput.streamText
  ).trim();

  if (runOutput.streamError) {
    failures.push(`stream error: ${runOutput.streamError}`);
  }
  if (runOutput.httpStatus && runOutput.httpStatus !== 200) {
    failures.push(`HTTP ${runOutput.httpStatus}`);
  }

  const persistedToolNames = extractToolNames(persisted?.metadata);
  const streamToolNames = extractStreamToolNames(runOutput.streamEvents);
  const toolNames = uniqueStrings([...persistedToolNames, ...streamToolNames]);
  observations.push(`tools fired: ${toolNames.join(", ") || "(none)"}`);
  const backendMemory = extractBackendDeepAgentMemory(persisted?.metadata);
  if (metadataPath(persisted?.metadata, "backend_deep_agent") != null) {
    observations.push(
      `backend Deep Agents memory candidates: ${backendMemory.candidateCount}`,
    );
  }
  const metadata = persisted?.metadata ?? {};
  const skillUsage = extractSkillUsage(metadata);
  const collectionAudit = evaluateCollectionAudit(
    testCase.collectionAudit,
    persisted,
  );

  if (!persisted) {
    failures.push("assistant message was not persisted to chat_history");
  }
  if (collectionAudit) {
    failures.push(
      ...collectionAudit.failures.map(
        (failure) => `collection audit: ${failure}`,
      ),
    );
    observations.push(...collectionAudit.observations);
  }

  // Tool coverage check (any-of semantics — passes if at least one of the
  // expected tools fired). Empty expectedToolNames means no expectation.
  const expectedTools = testCase.expectedToolNames ?? [];
  if (expectedTools.length > 0) {
    const hit = expectedTools.some((name) => toolNames.includes(name));
    if (!hit) {
      failures.push(
        `expected at least one of [${expectedTools.join(", ")}] to fire — none did`,
      );
    }
  }

  // Required tool check (all-of semantics). Use this for action safety,
  // planner, source-health, and task-management gates where any-of is too weak.
  const expectedAllTools = testCase.expectedAllToolNames ?? [];
  for (const name of expectedAllTools) {
    if (!toolNames.includes(name)) {
      failures.push(`expected required tool '${name}' to fire`);
    }
  }

  for (const name of testCase.forbiddenToolNames ?? []) {
    if (toolNames.includes(name)) {
      failures.push(`forbidden tool fired: '${name}'`);
    }
  }

  // Source-of-truth guardrail: fail the case if any tool trace's `source` field
  // matches a forbidden value. Prevents a tool from silently answering from a
  // stale cache when the case requires a live source (e.g., Microsoft Graph
  // inbox reads must not fall back to outlook_email_intake). Catches the data
  // flow, not just the tool name, covering tools we have not yet enumerated.
  const forbiddenSources = testCase.forbiddenToolSources ?? [];
  if (forbiddenSources.length > 0) {
    const traceEntries = Array.isArray(metadata?.tool_trace)
      ? metadata.tool_trace
      : [];
    for (const entry of traceEntries) {
      const traceSources = collectTraceSources(entry);
      const forbiddenHit = traceSources.find((source) =>
        forbiddenSources.includes(source),
      );
      if (forbiddenHit) {
        const toolLabel =
          entry?.tool ?? entry?.toolName ?? entry?.name ?? "(unknown)";
        failures.push(
          `forbidden tool source '${forbiddenHit}' returned by '${toolLabel}'`,
        );
      }
    }
  }

  // Family coverage — soft signal
  const expectedFamilies = testCase.expectedToolFamilies ?? [];
  const familyMap = suite.toolFamilyMap ?? {};
  const familiesHit = new Set();
  for (const [family, names] of Object.entries(familyMap)) {
    if (names.some((n) => toolNames.includes(n))) familiesHit.add(family);
  }
  for (const family of expectedFamilies) {
    if (!familiesHit.has(family)) {
      warnings.push(`expected family '${family}' not represented`);
    }
  }

  // Substring assertions
  const lower = finalText.toLowerCase();
  for (const phrase of testCase.mustInclude ?? []) {
    if (!lower.includes(phrase.toLowerCase())) {
      failures.push(`mustInclude missing: "${phrase}"`);
    }
  }
  for (const anyGroup of testCase.mustIncludeAny ?? []) {
    const options = Array.isArray(anyGroup) ? anyGroup : [anyGroup];
    const hit = options.some((phrase) =>
      lower.includes(String(phrase).toLowerCase()),
    );
    if (!hit) {
      failures.push(
        `mustIncludeAny missing one of: ${options.map((p) => `"${p}"`).join(", ")}`,
      );
    }
  }
  for (const phrase of testCase.mustExclude ?? []) {
    if (lower.includes(phrase.toLowerCase())) {
      failures.push(`mustExclude present: "${phrase}"`);
    }
  }
  for (const phrase of suite.globalForbiddenPhrases ?? []) {
    if (containsForbiddenPhrase(finalText, phrase)) {
      warnings.push(`global forbidden phrase: "${phrase}"`);
    }
  }

  if (testCase.minAnswerLength && finalText.length < testCase.minAnswerLength) {
    failures.push(
      `answer length ${finalText.length} < min ${testCase.minAnswerLength}`,
    );
  }

  const warnDurationMs =
    suiteSafeNumber(testCase.warnDurationMs) ??
    suiteSafeNumber(bundle?.warnDurationMs) ??
    suiteSafeNumber(suite.defaultWarnDurationMs) ??
    DEFAULT_WARN_DURATION_MS;
  const maxDurationMs =
    suiteSafeNumber(testCase.maxDurationMs) ??
    suiteSafeNumber(bundle?.maxDurationMs) ??
    suiteSafeNumber(suite.defaultMaxDurationMs);
  if (warnDurationMs && runOutput.durationMs > warnDurationMs) {
    warnings.push(
      `duration ${runOutput.durationMs}ms exceeded warning budget ${warnDurationMs}ms`,
    );
  }
  if (maxDurationMs && runOutput.durationMs > maxDurationMs) {
    failures.push(
      `duration ${runOutput.durationMs}ms exceeded max budget ${maxDurationMs}ms`,
    );
  }

  for (const pathExpression of testCase.requiredMetadataPaths ?? []) {
    if (metadataPath(metadata, pathExpression) == null) {
      failures.push(`required metadata missing: ${pathExpression}`);
    }
  }

  if (testCase.requireSkillUsage === true && skillUsage.skills.length === 0) {
    failures.push("required skill_usage missing selected skills");
  }

  if (testCase.expectedSkillSurface) {
    if (skillUsage.selectionSurface !== testCase.expectedSkillSurface) {
      failures.push(
        `skill_usage.selectionSurface ${skillUsage.selectionSurface ?? "(missing)"} did not match required ${testCase.expectedSkillSurface}`,
      );
    }
  }

  for (const category of testCase.expectedSkillCategories ?? []) {
    const hit = skillUsage.skills.some((skill) => skill?.category === category);
    if (!hit) {
      failures.push(`expected skill category '${category}' was not selected`);
    }
  }

  for (const category of testCase.forbiddenSkillCategories ?? []) {
    const hit = skillUsage.skills.some((skill) => skill?.category === category);
    if (hit) {
      failures.push(`forbidden skill category selected: '${category}'`);
    }
  }

  for (const riskLevel of testCase.expectedSkillRiskLevels ?? []) {
    const hit = skillUsage.skills.some((skill) => skill?.riskLevel === riskLevel);
    if (!hit) {
      failures.push(`expected skill risk level '${riskLevel}' was not selected`);
    }
  }

  if (testCase.highRiskSkillDraftOnly === true) {
    const selectedHighRisk = skillUsage.skills.some(
      (skill) => skill?.riskLevel === "high",
    );
    if (!selectedHighRisk) {
      failures.push("highRiskSkillDraftOnly expected a high-risk skill selection");
    }
    const unsafeWriteTools = [
      "createTask",
      "createGeneratedTask",
      "updateGeneratedTask",
      "deleteGeneratedTask",
      "createRFI",
      "createChangeOrder",
      "createChangeEvent",
      "createInitiativeCard",
      "createCommitment",
      "captureFeatureRequest",
      "draftOutlookEmail",
      "createOutlookCalendarInvite",
    ];
    for (const name of unsafeWriteTools) {
      if (toolNames.includes(name)) {
        failures.push(`high-risk draft-only case fired write tool: '${name}'`);
      }
    }
    const draftLanguage = /\b(draft|recommend|review|preview|confirm|approval|before sending|not sent|not created)\b/i.test(
      finalText,
    );
    if (!draftLanguage) {
      failures.push("high-risk draft-only case did not expose draft/review/approval language");
    }
  }

  if (testCase.requiredRecentEmailMailbox) {
    const trace = findToolTrace(metadata, "getRecentEmails");
    const actual =
      trace?.output?.appliedFilter?.email ??
      trace?.input?.mailbox ??
      trace?.appliedFilter?.email;
    const expected = String(testCase.requiredRecentEmailMailbox).toLowerCase();
    if (String(actual ?? "").toLowerCase() !== expected) {
      failures.push(
        `getRecentEmails mailbox ${actual ?? "(missing)"} did not match required ${expected}`,
      );
    }
    if (!trace?.output?.dataCutoffNote && !trace?.output?.error) {
      failures.push("getRecentEmails missing sync cutoff or error evidence");
    }
  }

  if (testCase.requiredRecentEmailSource) {
    const trace = findToolTrace(metadata, "getRecentEmails");
    const actual =
      trace?.output?.source ??
      trace?.source ??
      trace?.output?.graphLive?.source;
    const expected = String(testCase.requiredRecentEmailSource);
    if (actual !== expected) {
      failures.push(
        `getRecentEmails source ${actual ?? "(missing)"} did not match required ${expected}`,
      );
    }
  }

  for (const requirement of testCase.requiredToolTraceSources ?? []) {
    const toolName = requirement?.toolName;
    const expectedSource = requirement?.source;
    if (typeof toolName !== "string" || typeof expectedSource !== "string") {
      failures.push("invalid requiredToolTraceSources entry");
      continue;
    }
    const sources = traceSourcesForTool(metadata, toolName);
    if (!sources.includes(expectedSource)) {
      failures.push(
        `${toolName} trace sources [${sources.join(", ") || "(none)"}] did not include required ${expectedSource}`,
      );
    }
  }

  const responseQuality = metadata.response_quality ?? {};
  if (
    typeof testCase.minResponseQualityScore === "number" &&
    typeof responseQuality.score === "number" &&
    responseQuality.score < testCase.minResponseQualityScore
  ) {
    failures.push(
      `response_quality.score ${responseQuality.score} < ${testCase.minResponseQualityScore}`,
    );
  } else if (
    typeof testCase.minResponseQualityScore === "number" &&
    responseQuality.score == null
  ) {
    failures.push("response_quality.score missing");
  }

  if (testCase.minSourceQuality) {
    const actual = responseQuality.sourceQuality;
    if (
      !actual ||
      qualityRank[actual] < qualityRank[testCase.minSourceQuality]
    ) {
      failures.push(
        `response_quality.sourceQuality ${actual ?? "(missing)"} < ${testCase.minSourceQuality}`,
      );
    }
  }

  if (testCase.minConfidence) {
    const actual = responseQuality.confidence;
    if (!actual || qualityRank[actual] < qualityRank[testCase.minConfidence]) {
      failures.push(
        `response_quality.confidence ${actual ?? "(missing)"} < ${testCase.minConfidence}`,
      );
    }
  }

  return {
    status: failures.length === 0 ? "pass" : "fail",
    failures,
    warnings,
    observations,
    toolNames,
    familiesHit: [...familiesHit],
    finalTextLength: finalText.length,
    finalText,
    backendDeepAgentMemory: backendMemory,
    skillUsage,
    collectionAudit,
    latencyBudget: {
      warnDurationMs,
      maxDurationMs: maxDurationMs ?? null,
      durationMs: runOutput.durationMs,
    },
  };
}

function toPublishedRun(result, runId) {
  const cases = Array.isArray(result.results)
    ? result.results.map((testCase) => {
        const score = testCase.score ?? {};
        return {
          id: String(testCase.id ?? ""),
          prompt: String(testCase.prompt ?? ""),
          intent: typeof testCase.intent === "string" ? testCase.intent : null,
          status: typeof score.status === "string" ? score.status : "unknown",
          durationMs:
            typeof testCase.durationMs === "number"
              ? testCase.durationMs
              : null,
          streamEventCount:
            typeof testCase.streamEventCount === "number"
              ? testCase.streamEventCount
              : null,
          toolNames: Array.isArray(score.toolNames)
            ? score.toolNames.filter((tool) => typeof tool === "string")
            : [],
          failures: Array.isArray(score.failures)
            ? score.failures.filter((failure) => typeof failure === "string")
            : [],
          warnings: Array.isArray(score.warnings)
            ? score.warnings.filter((warning) => typeof warning === "string")
            : [],
          observations: Array.isArray(score.observations)
            ? score.observations.filter(
                (observation) => typeof observation === "string",
              )
            : [],
          collectionAudit:
            score.collectionAudit && typeof score.collectionAudit === "object"
              ? score.collectionAudit
              : null,
          collectionAuditParity:
            score.collectionAuditParity &&
            typeof score.collectionAuditParity === "object"
              ? score.collectionAuditParity
              : null,
          backendDeepAgentMemory:
            score.backendDeepAgentMemory &&
            typeof score.backendDeepAgentMemory === "object"
              ? {
                  candidateCount:
                    typeof score.backendDeepAgentMemory.candidateCount ===
                    "number"
                      ? score.backendDeepAgentMemory.candidateCount
                      : 0,
                  candidates: Array.isArray(
                    score.backendDeepAgentMemory.candidates,
                  )
                    ? score.backendDeepAgentMemory.candidates
                    : [],
                }
              : { candidateCount: 0, candidates: [] },
          judge:
            score.judge && typeof score.judge === "object"
              ? {
                  status:
                    typeof score.judge.status === "string"
                      ? score.judge.status
                      : "unknown",
                  rubric:
                    typeof score.judge.rubric === "string"
                      ? score.judge.rubric
                      : null,
                  score:
                    typeof score.judge.score === "number"
                      ? score.judge.score
                      : null,
                  minScore:
                    typeof score.judge.minScore === "number"
                      ? score.judge.minScore
                      : null,
                  summary:
                    typeof score.judge.summary === "string"
                      ? score.judge.summary
                      : "",
                  strengths: Array.isArray(score.judge.strengths)
                    ? score.judge.strengths
                    : [],
                  weaknesses: Array.isArray(score.judge.weaknesses)
                    ? score.judge.weaknesses
                    : [],
                }
              : null,
          finalText: typeof score.finalText === "string" ? score.finalText : "",
          latencyBudget:
            score.latencyBudget && typeof score.latencyBudget === "object"
              ? {
                  warnDurationMs:
                    typeof score.latencyBudget.warnDurationMs === "number"
                      ? score.latencyBudget.warnDurationMs
                      : null,
                  maxDurationMs:
                    typeof score.latencyBudget.maxDurationMs === "number"
                      ? score.latencyBudget.maxDurationMs
                      : null,
                  durationMs:
                    typeof score.latencyBudget.durationMs === "number"
                      ? score.latencyBudget.durationMs
                      : null,
                }
              : null,
        };
      })
    : [];

  return {
    runId,
    generatedAt:
      typeof result.generatedAt === "string" ? result.generatedAt : null,
    baseUrl: typeof result.baseUrl === "string" ? result.baseUrl : null,
    bundle:
      result.bundle && typeof result.bundle === "object"
        ? (result.bundle.name ?? null)
        : typeof result.bundle === "string"
          ? result.bundle
          : null,
    filter: typeof result.filter === "string" ? result.filter : null,
    totalCases:
      typeof result.totalCases === "number" ? result.totalCases : cases.length,
    passed:
      typeof result.passed === "number"
        ? result.passed
        : cases.filter((testCase) => testCase.status === "pass").length,
    failed:
      typeof result.failed === "number"
        ? result.failed
        : cases.filter((testCase) => testCase.status === "fail").length,
    warningCount:
      typeof result.warningCount === "number"
        ? result.warningCount
        : cases.reduce(
            (count, testCase) => count + testCase.warnings.length,
            0,
          ),
    slowestCases: Array.isArray(result.slowestCases)
      ? result.slowestCases
      : [...cases]
          .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
          .slice(0, 10)
          .map((testCase) => ({
            id: testCase.id,
            intent: testCase.intent,
            durationMs: testCase.durationMs,
            status: testCase.status,
            warnings: testCase.warnings,
          })),
    cases,
  };
}

async function refreshPublishedAssistantEvalRuns() {
  const runsDir = path.join(repoRoot, "docs/ai-plan/evals/runs");
  let runIds = [];
  try {
    runIds = (await fs.readdir(runsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse()
      .slice(0, 20);
  } catch {
    runIds = [];
  }

  const runs = [];
  for (const runId of runIds) {
    try {
      const resultRaw = await fs.readFile(
        path.join(runsDir, runId, "results.json"),
        "utf8",
      );
      runs.push(toPublishedRun(JSON.parse(resultRaw), runId));
    } catch {
      // Ignore incomplete run directories.
    }
  }

  await fs.mkdir(path.dirname(PUBLISHED_ASSISTANT_EVAL_RUNS_PATH), {
    recursive: true,
  });
  await fs.writeFile(
    PUBLISHED_ASSISTANT_EVAL_RUNS_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "scripts/verify/verify_ai_assistant_eval_suite.mjs",
        runs,
      },
      null,
      2,
    ) + "\n",
  );
}

// ─────────────────────────────────────────────────────────── Run loop
// Always start with a fresh token so we don't begin the run with a stale one.
await refreshAuthIfNeeded();
const userId = tokenizeUserId();

console.log(`AI Assistant eval suite — ${cases.length} cases`);
console.log(`Endpoint: ${CHAT_ENDPOINT}`);
console.log(`Suite: ${path.relative(repoRoot, suitePath)}`);
console.log(`Publish run index: ${publishRunIndex ? "yes" : "no"}`);
console.log(`User id: ${userId ?? "(unknown)"}`);
if (bundleName) console.log(`Bundle: ${bundleName}`);
console.log(`Run dir: ${path.relative(repoRoot, runDir)}`);
console.log("");

const results = [];
const toolCoverage = new Map();
let collectionAuditBaseline = null;

for (const [index, testCase] of cases.entries()) {
  // chat_history.session_id is a UUID column, so we generate a proper UUID
  // and persist the human-readable label separately for the artifact only.
  const sessionId = randomUUID();
  const sessionLabel = `eval-${runStamp}-${testCase.id}`;
  const messageId = randomUUID();
  const label = `[${index + 1}/${cases.length}] ${testCase.id}`;
  process.stdout.write(`${label} … `);

  const startedAt = new Date().toISOString();
  const runOutput = await postPromptAndDrain(testCase, sessionId, messageId);
  const persisted = await fetchPersistedAssistantMessage(sessionId);
  const score = scoreCase(testCase, runOutput, persisted);
  if (bundle?.requireCollectionSourceParity === true) {
    if (!score.collectionAudit) {
      score.failures.push(
        "collection parity requires collectionAudit evidence for every case",
      );
    } else if (!collectionAuditBaseline) {
      collectionAuditBaseline = score.collectionAudit;
      score.collectionAuditParity = {
        status: "baseline",
        failures: [],
        observations: ["canonical source fingerprint recorded as bundle baseline"],
      };
      score.observations.push(...score.collectionAuditParity.observations);
    } else {
      score.collectionAuditParity = compareCollectionAuditParity(
        collectionAuditBaseline,
        score.collectionAudit,
      );
      score.failures.push(...score.collectionAuditParity.failures);
      score.observations.push(...score.collectionAuditParity.observations);
    }
    score.status = score.failures.length === 0 ? "pass" : "fail";
  }
  const judge = await evaluateWithJudge(testCase, score);
  if (judge) {
    score.judge = judge;
    score.observations.push(
      `judge ${judge.rubric}: ${judge.status}${typeof judge.score === "number" ? ` (${judge.score}/${judge.minScore})` : ""}`,
    );
    if (judge.status === "fail") {
      score.failures.push(
        `judge ${judge.rubric} score ${judge.score} < ${judge.minScore}: ${judge.summary}`,
      );
    } else if (judge.status === "error") {
      score.failures.push(`judge ${judge.rubric} error: ${judge.summary}`);
    } else if (judge.status === "skipped") {
      score.warnings.push(`judge ${judge.rubric} skipped: ${judge.summary}`);
    }
    score.status = score.failures.length === 0 ? "pass" : "fail";
  }
  const finishedAt = new Date().toISOString();

  for (const tool of score.toolNames) {
    toolCoverage.set(tool, (toolCoverage.get(tool) ?? 0) + 1);
  }

  const artifactScore = testCase.redactResponseContentInArtifacts
    ? { ...score, finalText: "", finalTextRedacted: true }
    : score;
  const record = {
    id: testCase.id,
    intent: testCase.intent,
    prompt: testCase.prompt,
    selectedProjectId: testCase.selectedProjectId ?? null,
    sessionId,
    sessionLabel,
    startedAt,
    finishedAt,
    durationMs: runOutput.durationMs,
    httpStatus: runOutput.httpStatus,
    streamError: runOutput.streamError,
    streamEventCount: runOutput.streamEvents.length,
    persistedFound: Boolean(persisted),
    score: artifactScore,
    expectedToolNames: testCase.expectedToolNames ?? [],
    expectedToolFamilies: testCase.expectedToolFamilies ?? [],
  };
  results.push(record);

  await fs.writeFile(
    path.join(runDir, `${testCase.id}.json`),
    JSON.stringify(
      {
        ...record,
        streamEvents: testCase.redactResponseContentInArtifacts
          ? []
          : runOutput.streamEvents,
        streamEventsRedacted:
          testCase.redactResponseContentInArtifacts === true,
        persistedMetadata: testCase.redactResponseContentInArtifacts
          ? null
          : (persisted?.metadata ?? null),
      },
      null,
      2,
    ),
  );

  const symbol = score.status === "pass" ? "✓" : "✗";
  console.log(
    `${symbol} ${score.status} (${runOutput.durationMs}ms, ${score.toolNames.length} tools)`,
  );
  if (score.failures.length > 0) {
    for (const f of score.failures) console.log(`    ! ${f}`);
  }
  if (score.warnings.length > 0) {
    for (const w of score.warnings) console.log(`    ⚠ ${w}`);
  }
}

// ─────────────────────────────────────────────────────────── Reporting
const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  bundle: bundleName
    ? {
        name: bundleName,
        description: bundle.description ?? "",
        criteria: bundle.criteria ?? [],
      }
    : null,
  filter: effectiveFilterPattern ?? null,
  totalCases: results.length,
  passed: results.filter((r) => r.score.status === "pass").length,
  failed: results.filter((r) => r.score.status === "fail").length,
  warningCount: results.reduce(
    (count, r) => count + r.score.warnings.length,
    0,
  ),
  backendDeepAgentMemoryCandidateCount: results.reduce(
    (count, r) => count + (r.score.backendDeepAgentMemory?.candidateCount ?? 0),
    0,
  ),
  judge: {
    enabled: JUDGE_ENABLED,
    model: JUDGE_MODEL,
    judgedCases: results.filter((r) => r.score.judge).length,
    passed: results.filter((r) => r.score.judge?.status === "pass").length,
    failed: results.filter((r) => r.score.judge?.status === "fail").length,
    errors: results.filter((r) => r.score.judge?.status === "error").length,
    averageScore: (() => {
      const judged = results
        .map((r) => r.score.judge?.score)
        .filter((score) => typeof score === "number" && Number.isFinite(score));
      if (judged.length === 0) return null;
      return Number(
        (judged.reduce((sum, score) => sum + score, 0) / judged.length).toFixed(
          2,
        ),
      );
    })(),
  },
  slowestCases: [...results]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      intent: r.intent,
      durationMs: r.durationMs,
      status: r.score.status,
      warnings: r.score.warnings,
    })),
  toolCoverage: Object.fromEntries(
    [...toolCoverage.entries()].sort((a, b) => b[1] - a[1]),
  ),
  intentDistribution: results.reduce((acc, r) => {
    acc[r.intent] = (acc[r.intent] ?? 0) + 1;
    return acc;
  }, {}),
  results,
};

await fs.writeFile(
  path.join(runDir, "results.json"),
  JSON.stringify(summary, null, 2),
);

const md = [
  `# AI Assistant Eval Suite — ${runStamp}`,
  "",
  `- Endpoint: \`${CHAT_ENDPOINT}\``,
  ...(summary.bundle
    ? [
        `- Bundle: \`${summary.bundle.name}\``,
        `- Bundle description: ${summary.bundle.description}`,
      ]
    : []),
  ...(summary.filter ? [`- Filter: \`${summary.filter}\``] : []),
  `- Total: ${summary.totalCases}`,
  `- Passed: ${summary.passed}`,
  `- Failed: ${summary.failed}`,
  `- Warnings: ${summary.warningCount}`,
  `- Backend Deep Agents memory candidates: ${summary.backendDeepAgentMemoryCandidateCount}`,
  `- Judge: ${summary.judge.judgedCases} judged, ${summary.judge.passed} passed, ${summary.judge.failed} failed, ${summary.judge.errors} errors, avg ${summary.judge.averageScore ?? "n/a"} (${summary.judge.model})`,
  "",
  "## Slowest Cases",
  "",
  "| Case | Intent | Status | Duration | Warnings |",
  "|---|---|---|---|---|",
  ...summary.slowestCases.map(
    (r) =>
      `| ${r.id} | ${r.intent} | ${r.status === "pass" ? "✅" : "❌"} | ${r.durationMs}ms | ${r.warnings.join("; ") || "—"} |`,
  ),
  "",
  ...(summary.bundle?.criteria?.length
    ? [
        "## Bundle Criteria",
        "",
        ...summary.bundle.criteria.map((criterion) => `- ${criterion}`),
        "",
      ]
    : []),
  "## Per-case results",
  "",
  "| Case | Intent | Status | Duration | Judge | Memory candidates | Tools fired | Failures |",
  "|---|---|---|---|---|---|---|---|",
  ...results.map(
    (r) =>
      `| ${r.id} | ${r.intent} | ${r.score.status === "pass" ? "✅" : "❌"} | ${r.durationMs}ms | ${r.score.judge ? `${r.score.judge.rubric}: ${r.score.judge.status} (${r.score.judge.score ?? "n/a"}/${r.score.judge.minScore ?? "n/a"})` : "—"} | ${r.score.backendDeepAgentMemory?.candidateCount ?? 0} | ${r.score.toolNames.join(", ") || "(none)"} | ${r.score.failures.join("; ") || "—"} |`,
  ),
  "",
  ...(summary.judge.judgedCases > 0
    ? [
        "## Judge notes",
        "",
        ...results
          .filter((r) => r.score.judge)
          .flatMap((r) => [
            `### ${r.id}`,
            "",
            `- Rubric: \`${r.score.judge.rubric}\``,
            `- Score: ${r.score.judge.score ?? "n/a"} / ${r.score.judge.minScore ?? "n/a"} (${r.score.judge.status})`,
            `- Summary: ${r.score.judge.summary || "—"}`,
            `- Weaknesses: ${r.score.judge.weaknesses?.join("; ") || "—"}`,
            "",
          ]),
      ]
    : []),
  "## Tool coverage across the suite",
  "",
  "| Tool | Hits |",
  "|---|---|",
  ...Object.entries(summary.toolCoverage).map(
    ([tool, hits]) => `| \`${tool}\` | ${hits} |`,
  ),
  "",
  "## Tools defined but never fired in this run",
  "",
];

const allKnownTools = new Set(
  Object.values(suite.toolFamilyMap ?? {}).flatMap((arr) => arr),
);
const missed = [...allKnownTools].filter((t) => !toolCoverage.has(t)).sort();
if (missed.length === 0) {
  md.push("All catalogued tools fired at least once. 🎯");
} else {
  for (const t of missed) md.push(`- \`${t}\``);
}

await fs.writeFile(path.join(runDir, "summary.md"), md.join("\n") + "\n");
if (publishRunIndex) {
  await refreshPublishedAssistantEvalRuns();
}

await pool.end();

console.log("");
console.log(`Results: ${path.relative(repoRoot, runDir)}/results.json`);
console.log(`Summary: ${path.relative(repoRoot, runDir)}/summary.md`);
console.log(`Pass: ${summary.passed}/${summary.totalCases}`);

process.exit(summary.failed > 0 ? 1 : 0);
