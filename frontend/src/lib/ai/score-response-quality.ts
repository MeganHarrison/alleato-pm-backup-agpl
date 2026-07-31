/**
 * Response quality scoring for the RAG chat pipeline.
 *
 * Extracted from route.ts for independent unit-testability.
 * @see agents/alleato-assistant — production AI Assistant runtime
 */

export type ResponseQuality = {
  confidence: "high" | "medium" | "low";
  sourceQuality: "high" | "medium" | "low";
  score: number;
  reasons: string[];
  hasMetaCommentary: boolean;
};

/**
 * Phrases that indicate the AI is stalling instead of answering.
 * Array.some() — a single occurrence is enough to flag the response.
 */
export const META_COMMENTARY_PHRASES = [
  "let me search for",
  "let me look that up",
  "let me find",
  "let me check on", // was: "let me check" — too broad (matches "Let me check: [actual data]")
  "i'll search for",
  "i'll look that up",
  "i'll look into",
  "i'll find",
  "i can look it up",
  "i searched broadly",
  "tell me the project name",
  "give me the project name",
  "provide the project name",
  "searching for that", // was: "searching for" — too broad (matches "I found what you were searching for")
  "looking that up",
  "give me a moment",
  "one moment while i", // was: also had broader "one moment" below — removed as it caused false positives
  "pulling that information",
  "retrieving that for you",
  "give me a second",
  "let me pull up",
];

const SOURCE_BEARING_TOOLS = new Set([
  "clientProjectIntelligencePacket",
  "sourceSpecificRagRetrieval",
  "semanticSearch",
  "searchMeetingsByTopic",
  "searchTeamsMessages",
  "searchEmails",
  "searchExternalDocuments",
  "getProjectBriefingSnapshot",
  "cachedProjectBriefingSnapshot",
  "cachedExecutiveRetrievalPacket",
  "backendDeepAgentExecutiveBriefing",
  "backendDeepAgentProjectStatus",
  "backendDeepAgentResearch",
  "deepagents_runtime",
  "meetingCollectionAnalysis",
]);

const NON_EVIDENCE_ACTIVITY_TOOLS = new Set(["mcpToolDiscovery"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numericCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function arrayCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function countSourceBearingRecords(entry: Record<string, unknown>): number {
  if (isFailedTraceEntry(entry)) return 0;
  const toolName = traceToolName(entry);
  if (!SOURCE_BEARING_TOOLS.has(toolName)) return 0;

  const output = asRecord(entry.output);
  if (!output) return 0;

  const directCount = Math.max(
    numericCount(output.cardCount),
    numericCount(output.rowCount),
    numericCount(output.totalResults),
    numericCount(output.resultCount),
    arrayCount(output.rows),
    arrayCount(output.results),
    numericCount(asRecord(output.coverage)?.retrieved),
    arrayCount(output.records),
  );

  if (directCount > 0) return directCount;

  const sources = Array.isArray(output.sources) ? output.sources : [];
  return sources.reduce((count, source) => {
    const sourceRecord = asRecord(source);
    const sourceOutput = asRecord(sourceRecord?.output);
    return count + Math.max(
      numericCount(sourceRecord?.resultCount),
      numericCount(sourceOutput?.totalResults),
      arrayCount(sourceOutput?.results),
      arrayCount(sourceOutput?.rows),
    );
  }, 0);
}

function traceToolName(entry: Record<string, unknown>): string {
  return typeof entry.toolName === "string"
    ? entry.toolName
    : typeof entry.tool === "string"
      ? entry.tool
      : "";
}

function isFailedTraceEntry(entry: Record<string, unknown>): boolean {
  const status = typeof entry.status === "string" ? entry.status.toLowerCase() : "";
  const output = asRecord(entry.output);
  return Boolean(
    entry.error ||
      output?.error ||
      status === "failed" ||
      status === "error",
  );
}

function isIncompleteCollectionEntry(entry: Record<string, unknown>): boolean {
  if (traceToolName(entry) !== "meetingCollectionAnalysis") return false;
  const output = asRecord(entry.output);
  const coverage = asRecord(output?.coverage);
  return (
    isFailedTraceEntry(entry) ||
    output?.status !== "complete" ||
    coverage?.exhaustive !== true ||
    numericCount(coverage?.failed) > 0
  );
}

export function scoreResponseQuality(params: {
  toolTrace: Array<Record<string, unknown>>;
  content: string;
}): ResponseQuality {
  const reasons: string[] = [];
  const trace = params.toolTrace;
  const successfulToolCalls = trace.filter(
    (entry) =>
      !isFailedTraceEntry(entry) &&
      !NON_EVIDENCE_ACTIVITY_TOOLS.has(traceToolName(entry)),
  ).length;
  const failedToolCalls = trace.filter(isFailedTraceEntry).length;
  const hasIncompleteCollection = trace.some(isIncompleteCollectionEntry);
  const sourceRefsInText = (params.content.match(/\[Source:/g) ?? []).length;
  const sourceBearingRecordCount = trace.reduce(
    (count, entry) => count + countSourceBearingRecords(entry),
    0,
  );
  const hasCompiledPacket = trace.some((entry) => {
    if (entry.tool !== "clientProjectIntelligencePacket" || entry.error) return false;
    const output = entry.output as { cardCount?: unknown } | undefined;
    return typeof output?.cardCount === "number" && output.cardCount >= 3;
  });

  const normalizedContent = params.content.toLowerCase();
  const hasMetaCommentary = META_COMMENTARY_PHRASES.some((phrase) =>
    normalizedContent.includes(phrase),
  );

  let score = 50;

  if (hasCompiledPacket) {
    score += 25;
    reasons.push("compiled intelligence packet with multiple evidence cards");
  } else if (successfulToolCalls >= 3) {
    score += 25;
    reasons.push("multiple successful tool calls");
  } else if (successfulToolCalls >= 1) {
    score += 12;
    reasons.push("at least one successful tool call");
  } else {
    reasons.push("no successful tool calls");
  }

  if (sourceRefsInText >= 2) {
    score += 15;
    reasons.push("multiple source citations");
  } else if (sourceRefsInText === 1) {
    score += 8;
    reasons.push("single source citation");
  } else if (sourceBearingRecordCount > 0) {
    reasons.push(
      `retrieval trace included ${sourceBearingRecordCount} source-bearing record(s) without inline citations`,
    );
  } else {
    reasons.push("no source citations in final response");
  }

  if (failedToolCalls > 0) {
    score -= Math.min(20, failedToolCalls * 5);
    reasons.push(`${failedToolCalls} tool call failure(s)`);
  }

  if (hasMetaCommentary) {
    score -= 30;
    reasons.push("meta-commentary detected: model narrated intent instead of answering");
  }

  if (hasIncompleteCollection) {
    score = Math.min(score, 25);
    reasons.push(
      "collection retrieval or synthesis was incomplete; quality score capped",
    );
  }

  score = Math.max(0, Math.min(100, score));

  const confidence: ResponseQuality["confidence"] =
    score >= 80 ? "high" : score >= 60 ? "medium" : "low";
  const sourceQuality: ResponseQuality["sourceQuality"] = hasIncompleteCollection
    ? "low"
    : sourceRefsInText >= 2 || sourceBearingRecordCount >= 2
      ? "high"
      : sourceRefsInText === 1 || sourceBearingRecordCount === 1
        ? "medium"
        : "low";

  return { confidence, sourceQuality, score, reasons, hasMetaCommentary };
}

/**
 * Scores derived for a single assistant response, ready to push to Langfuse as
 * trace scores. All are computed WITHOUT extra LLM calls from data the pipeline
 * already produces, so every production trace can be scored for free.
 *
 * - `responseQuality` (0–1): normalized {@link scoreResponseQuality} score when a
 *   rich tool trace is available, else a lightweight estimate from output + tool
 *   names. Drives quality dashboards/alerting.
 * - `answered` (boolean): false when the model returned nothing or stalled with
 *   meta-commentary instead of answering. The cheap guardrail against the
 *   "deflected / empty answer" failure class.
 * - `toolFailure` (boolean | null): whether any tool call errored. `null` when no
 *   rich tool trace was provided (we can't tell from names alone).
 */
export type TraceScores = {
  responseQuality: number;
  answered: boolean;
  toolFailure: boolean | null;
  reasons: string[];
};

export function computeTraceScores(params: {
  output: string;
  toolCallNames?: string[];
  toolTrace?: Array<Record<string, unknown>>;
}): TraceScores {
  const output = (params.output ?? "").trim();
  const normalized = output.toLowerCase();
  const hasMetaCommentary = META_COMMENTARY_PHRASES.some((phrase) =>
    normalized.includes(phrase),
  );
  const answered = output.length > 0 && !hasMetaCommentary;

  // Rich path: reuse the full heuristic scorer when a real tool trace exists.
  if (params.toolTrace && params.toolTrace.length > 0) {
    const rich = scoreResponseQuality({ toolTrace: params.toolTrace, content: output });
    return {
      responseQuality: rich.score / 100,
      answered,
      toolFailure: params.toolTrace.some(isFailedTraceEntry),
      reasons: rich.reasons,
    };
  }

  // Lightweight fallback from output + tool names only (no error info available).
  const reasons: string[] = [];
  let score = 50;
  const toolCount = params.toolCallNames?.length ?? 0;
  if (toolCount >= 3) {
    score += 25;
    reasons.push("multiple tool calls");
  } else if (toolCount >= 1) {
    score += 12;
    reasons.push("at least one tool call");
  } else {
    reasons.push("no tool calls");
  }

  const citationCount =
    (output.match(/\[Source:/g) ?? []).length + (output.match(/https?:\/\//g) ?? []).length;
  if (citationCount >= 2) {
    score += 15;
    reasons.push("multiple citations");
  } else if (citationCount === 1) {
    score += 8;
    reasons.push("single citation");
  } else {
    reasons.push("no citations");
  }

  if (hasMetaCommentary) {
    score -= 30;
    reasons.push("meta-commentary detected: model narrated intent instead of answering");
  }
  if (output.length === 0) {
    score = 0;
    reasons.push("empty response");
  }

  return {
    responseQuality: Math.max(0, Math.min(100, score)) / 100,
    answered,
    toolFailure: null,
    reasons,
  };
}
