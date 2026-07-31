#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const route = readFileSync(
  resolve(repoRoot, "frontend/src/app/api/ai-assistant/chat/route.ts"),
  "utf8",
);
const handler = readFileSync(
  resolve(repoRoot, "frontend/src/app/api/ai-assistant/chat/handler-v2.ts"),
  "utf8",
);
const planner = readFileSync(
  resolve(repoRoot, "frontend/src/lib/ai/retrieval/planner.ts"),
  "utf8",
);
const executor = readFileSync(
  resolve(repoRoot, "frontend/src/lib/ai/retrieval/executor.ts"),
  "utf8",
);
const detector = readFileSync(
  resolve(repoRoot, "frontend/src/lib/ai/detect-rag-request.ts"),
  "utf8",
);
const sourceSpecificRag = readFileSync(
  resolve(repoRoot, "frontend/src/lib/ai/retrieval/source-specific-rag.ts"),
  "utf8",
);
const contractSource = `${route}\n${handler}\n${planner}\n${executor}\n${detector}\n${sourceSpecificRag}`;

const requiredFragments = [
  "detectSourceSpecificRagRequest",
  "parseExplicitDateRange",
  "detectSourceLookupRecentTeamsRequest",
  "buildSourceSpecificRagAnswer",
  "sourceSpecificRagRetrieval",
  "shouldUseDirectSourceSpecificFastPath",
  "direct-source-specific-rag",
  "source-specific-recent-teams",
  "source-specific-recent-meetings",
  "Meeting source answer returned",
  "groupTeamsRows",
  "conversation/day bucket",
  "teams rag",
  "using only teams",
  "chat/thread",
  "thread titles",
  "recent_teams_discussions",
  "Recent Teams messages",
  "Recent Teams source answer returned",
  "gte(\"date\", `${request.startDate}T00:00:00.000Z`)",
  "lte(\"date\", `${request.endDate}T23:59:59.999Z`)",
  ".eq(\"category\", \"teams_message\")",
  ".eq(\"source\", \"microsoft_graph\")",
];

const failures = requiredFragments
  .filter((fragment) => !contractSource.includes(fragment))
  .map((fragment) => `chat implementation missing source-specific RAG contract fragment: ${fragment}`);

const aprilRangePattern =
  /april/i.test(contractSource) &&
  /may/i.test(contractSource) &&
  /june/i.test(contractSource) &&
  /through\|to\|until/.test(contractSource) &&
  /\(\?:through\|to\|until/.test(contractSource) &&
  /20\\d\{2\}/.test(contractSource);

if (!aprilRangePattern) {
  failures.push("chat route does not parse natural-language month date ranges for source-specific RAG prompts");
}

const plannerSourceSpecificIndex = planner.indexOf("if (sourceSpecific)");
const plannerSourceLookupIndex = planner.indexOf(
  "if (intent === \"source_lookup\")",
  Math.max(plannerSourceSpecificIndex, 0),
);
const plannerOrderingOk =
  plannerSourceSpecificIndex > -1 &&
  plannerSourceLookupIndex > -1 &&
  plannerSourceSpecificIndex < plannerSourceLookupIndex &&
  planner.includes('responseFormat: "source_specific_rag"') &&
  planner.includes("sourceSpecificRag: { kind: sourceSpecific.kind }");

if (!plannerOrderingOk) {
  failures.push("retrieval planner must route source-specific RAG before generic source_lookup vector search");
}

const executorSourceSpecificIndex = executor.indexOf("if (plan.sources.sourceSpecificRag)");
const executorRunIndex = executor.indexOf(
  "result.sourceSpecificRagAnswer = (await deps.runSourceSpecificRag(kind, message))",
  Math.max(executorSourceSpecificIndex, 0),
);
const executorOrderingOk =
  executorSourceSpecificIndex > -1 &&
  executorRunIndex > -1 &&
  executorSourceSpecificIndex < executorRunIndex &&
  executor.includes('time("source_specific_rag"');

if (!executorOrderingOk) {
  failures.push("retrieval executor must prefetch source-specific RAG into retrieval context before model synthesis");
}

const directTeamsFastPathIndex = handler.indexOf("if (shouldUseDirectSourceSpecificFastPath({ plan, retrievalCtx }))");
const streamTextIndex = handler.indexOf(
  "streamText",
  Math.max(directTeamsFastPathIndex, 0),
);
const directTeamsBeforeStreamText =
  directTeamsFastPathIndex > -1 &&
  streamTextIndex > -1 &&
  directTeamsFastPathIndex < streamTextIndex;

if (!directTeamsBeforeStreamText) {
  failures.push("recent Teams source-specific RAG fast path must run before streamText model synthesis");
}

const handlerMetadataOk =
  handler.includes("sourceSpecificRagRetrieval") &&
  handler.includes("source_specific_rag") &&
  handler.includes("sourceSpecificRagAnswer?.rows") &&
  handler.includes("provider_path: \"direct-source-specific-rag\"");

if (!handlerMetadataOk) {
  failures.push("chat handler must expose source-specific RAG retrieval traces and direct-path metadata");
}

const detectorTeamsIndex = detector.indexOf("const asksForRecentTeams");
const detectorReturnIndex = detector.indexOf(
  'kind: "recent_teams_discussions"',
  Math.max(detectorTeamsIndex, 0),
);
const detectorOrderingOk =
  detectorTeamsIndex > -1 &&
  detectorReturnIndex > -1 &&
  detectorTeamsIndex < detectorReturnIndex &&
  detector.includes("const explicitRange = parseExplicitDateRange(message)") &&
  detector.includes("startDate: explicitRange?.startDate ?? recentRange.startDate") &&
  detector.includes("endDate: explicitRange?.endDate ?? recentRange.endDate");

if (!detectorOrderingOk) {
  failures.push("source-specific detector must preserve explicit date ranges for recent Teams discussions");
}

const sourceSpecificRetrievalOk =
  sourceSpecificRag.includes("fetchRecentTeamsMessagesFromGraph") &&
  sourceSpecificRag.includes("listOutlookInboxMessages") &&
  sourceSpecificRag.includes("document_metadata/document_chunks-backed Teams index") &&
  sourceSpecificRag.includes("document_metadata/document_chunks-backed email index") &&
  sourceSpecificRag.includes("Retrieved ${rows.length} Teams row(s)");

if (!sourceSpecificRetrievalOk) {
  failures.push("source-specific retrieval must check live Microsoft sources and indexed Supabase fallback with explicit observability");
}

const routeUsesHandler = route.includes("handleAiAssistantChatV2") || route.includes("handler-v2");
if (!routeUsesHandler) {
  failures.push("chat route must delegate to the current handler-v2 implementation inspected by this contract");
}

const staleHandlerPathReferenced = contractSource.includes("frontend/src/lib/ai/chat-handler.ts");
if (staleHandlerPathReferenced) {
  failures.push("source-specific contract still references retired frontend/src/lib/ai/chat-handler.ts path");
}

const oldOrderingProbePresent =
  contractSource.includes("sourceSpecificRagRequest &&") ||
  contractSource.includes("sourceLookupRecentTeamsRequest");
if (oldOrderingProbePresent) {
  failures.push("source-specific contract still relies on retired route-local sourceSpecificRagRequest probes");
}

const sourceLookupIndex = planner.indexOf(
  'responseFormat: "source_lookup"',
  Math.max(plannerSourceSpecificIndex, 0),
);
if (sourceLookupIndex > -1 && sourceLookupIndex < plannerSourceSpecificIndex) {
  failures.push("generic source_lookup appears before source-specific RAG in planner");
}

if (failures.length > 0) {
  console.error("AI source-specific RAG contract verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("AI source-specific RAG contract verification passed.");
