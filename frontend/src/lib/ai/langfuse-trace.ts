import { Langfuse } from "langfuse";
import { startObservation } from "@langfuse/tracing";

import { computeTraceScores } from "@/lib/ai/score-response-quality";
import { judgeChatResponse, shouldRunJudge } from "@/lib/ai/llm-judge";
import { maskLangfuse } from "@/lib/ai/langfuse-mask";

let _client: Langfuse | null = null;

export type ChatGenerationObservation = {
  complete(params: {
    output: string;
    finishReason?: string;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
    toolCallNames?: string[];
  }): void;
  fail(message: string): void;
};

function numericUsage(
  usage: Parameters<ChatGenerationObservation["complete"]>[0]["usage"],
): Record<string, number> | undefined {
  const entries = Object.entries({
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    totalTokens: usage?.totalTokens,
  }).filter((entry): entry is [string, number] => typeof entry[1] === "number");
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * AI SDK v7 telemetry is emitted through a diagnostics channel in this runtime,
 * which the Langfuse OTel processor does not currently turn into observations.
 * Keep a single manual GENERATION child under the active chat root so each trace
 * remains inspectable without creating a second top-level trace.
 */
export function startChatGenerationObservation(params: {
  model: string;
  input: string;
  maxOutputTokens: number;
  intent: string;
  planReason: string;
}): ChatGenerationObservation {
  if (!process.env.LANGFUSE_SECRET_KEY?.trim() || !process.env.LANGFUSE_PUBLIC_KEY?.trim()) {
    return { complete: () => undefined, fail: () => undefined };
  }

  const observation = startObservation(
    "ai-assistant-generation",
    {
      model: params.model,
      input: params.input,
      modelParameters: { maxOutputTokens: params.maxOutputTokens },
      metadata: {
        intent: params.intent,
        planReason: params.planReason,
        instrumentation: "manual-ai-sdk-v7-generation",
      },
    },
    { asType: "generation" },
  );
  let finalized = false;

  const finalize = (attributes: Parameters<typeof observation.update>[0]) => {
    if (finalized) return;
    finalized = true;
    observation.update(attributes);
    observation.end();
  };

  return {
    complete: ({ output, finishReason, usage, toolCallNames }) =>
      finalize({
        output,
        usageDetails: numericUsage(usage),
        metadata: {
          finishReason: finishReason ?? "unknown",
          toolCallNames: toolCallNames ?? [],
          instrumentation: "manual-ai-sdk-v7-generation",
        },
      }),
    fail: (message) =>
      finalize({
        level: "ERROR",
        statusMessage: message.slice(0, 800),
        metadata: { instrumentation: "manual-ai-sdk-v7-generation" },
      }),
  };
}

function getClient(): Langfuse | null {
  if (!process.env.LANGFUSE_SECRET_KEY) return null;
  if (!_client) {
    _client = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? "https://us.cloud.langfuse.com",
      flushAt: 1,
      // Redact PII (emails / SSN / card / phone) before egress to us.cloud.
      mask: maskLangfuse,
    });
  }
  return _client;
}

type TraceParams = {
  userId: string;
  sessionId: string;
  modelId: string;
  input: string;
  output: string;
  generationName?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    inputTokenDetails?: { cacheReadTokens?: number };
  };
  intent?: string;
  qualityScore?: number;
  qualityReasons?: string[];
  wasRetried?: boolean;
  retryReason?: string;
  stepCount?: number;
  toolCallNames?: string[];
  selectedProjectId?: number | null;
  /**
   * Full tool trace (with per-call `output`/`error`) when available. Enables the
   * rich response-quality score and the `tool_failure` score. Omit it and the
   * scores fall back to a lightweight estimate from output + tool names.
   */
  toolTrace?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
};

export type TraceToolCall = {
  name: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  durationMs?: number;
  error?: string;
};

/**
 * Attach derived quality scores to an EXISTING Langfuse trace by id — used for the
 * streamText synthesis path, where the trace, generation, tool spans, model, and
 * token usage are already captured automatically by the `@langfuse/otel` span
 * processor (via AI SDK telemetry). This function therefore creates no
 * trace and no generation; it only scores, which avoids the duplicate-trace
 * problem the old `traceChatCompletion` would cause on the OTel path.
 *
 * `traceId` comes from `getActiveTraceId()` captured inside the active root span.
 * When Langfuse is not configured (or no active trace), this is a safe no-op.
 *
 * Scores mirror `traceChatCompletion`: `response_quality` (NUMERIC 0–1),
 * `answered` (BOOLEAN), and `tool_failure` (BOOLEAN, only with a rich `toolTrace`).
 * Quality that the legacy path expressed as tags (`deflected`, `low_quality`,
 * `high_quality`) is intentionally represented as scores here — scores are the
 * filterable/alertable primitive, and trace tags on an OTel-owned trace can only
 * be set at span-creation time via `propagateAttributes`.
 */
export async function scoreChatTrace(params: {
  traceId: string | undefined;
  output: string;
  toolCallNames?: string[];
  toolTrace?: Array<Record<string, unknown>>;
}): Promise<void> {
  const lf = getClient();
  if (!lf || !params.traceId) return;

  const scores = computeTraceScores({
    output: params.output,
    toolCallNames: params.toolCallNames,
    toolTrace: params.toolTrace,
  });
  const comment = scores.reasons.join("; ").slice(0, 500);

  lf.score({
    traceId: params.traceId,
    name: "response_quality",
    value: scores.responseQuality,
    dataType: "NUMERIC",
    comment,
  });
  lf.score({
    traceId: params.traceId,
    name: "answered",
    value: scores.answered ? 1 : 0,
    dataType: "BOOLEAN",
    comment: scores.answered
      ? "substantive answer"
      : "empty response or meta-commentary deflection",
  });
  if (scores.toolFailure !== null) {
    lf.score({
      traceId: params.traceId,
      name: "tool_failure",
      value: scores.toolFailure ? 1 : 0,
      dataType: "BOOLEAN",
      comment,
    });
  }

  await lf.flushAsync();
}

/**
 * Run the code-owned LLM judge on a SAMPLE of responses and attach its scores to
 * an existing trace by id. Gated by `shouldRunJudge()` (env flag + sample rate),
 * so this is a safe no-op until explicitly enabled. Best-effort: judge failures
 * are swallowed and never affect the response.
 *
 * Scores: `llm_relevance`, `llm_specificity`, `llm_completeness` (all NUMERIC 0–1).
 * `llm_relevance` is the semantic counterpart to the heuristic `answered` score —
 * it catches deflection/off-topic answers the keyword check can't see.
 */
export async function maybeJudgeAndScore(params: {
  traceId: string | undefined;
  question: string;
  answer: string;
}): Promise<void> {
  const lf = getClient();
  if (!lf || !params.traceId || !params.answer.trim()) return;
  if (!shouldRunJudge()) return;

  try {
    const result = await judgeChatResponse({
      question: params.question,
      answer: params.answer,
    });
    const comment = result.reasoning.slice(0, 500);
    for (const [name, value] of [
      ["llm_relevance", result.relevance],
      ["llm_specificity", result.specificity],
      ["llm_completeness", result.completeness],
    ] as const) {
      lf.score({ traceId: params.traceId, name, value, dataType: "NUMERIC", comment });
    }
    await lf.flushAsync();
  } catch (error) {
    console.warn(
      "[langfuse] LLM judge failed (non-fatal)",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Mirror a user thumbs-up/down onto its originating Langfuse trace as a
 * `user_feedback` BOOLEAN score (1 = up, 0 = down). Best-effort no-op when
 * Langfuse is unconfigured or no trace id is known.
 */
export async function scoreUserFeedback(params: {
  traceId: string;
  feedback: "up" | "down";
  comment?: string | null;
}): Promise<void> {
  const lf = getClient();
  if (!lf || !params.traceId) return;
  try {
    lf.score({
      traceId: params.traceId,
      name: "user_feedback",
      value: params.feedback === "up" ? 1 : 0,
      dataType: "BOOLEAN",
      comment: params.comment ?? undefined,
    });
    await lf.flushAsync();
  } catch (error) {
    console.warn(
      "[langfuse] user_feedback score failed (non-fatal)",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function traceChatCompletion(params: TraceParams): Promise<void> {
  const lf = getClient();
  if (!lf) return;

  // Derived scores (no extra LLM calls) attached to every trace below so
  // production traffic is continuously scored, not just observed.
  const scores = computeTraceScores({
    output: params.output,
    toolCallNames: params.toolCallNames,
    toolTrace: params.toolTrace,
  });
  // Prefer a contract-owned quality score (0–100) when a specialized response
  // path has already validated semantics. Generic tool/citation activity is
  // only a fallback; it cannot prove that an executive synthesis is useful.
  const qualityScore = Math.max(
    0,
    Math.min(100, params.qualityScore ?? scores.responseQuality * 100),
  );
  const qualityReasons = params.qualityReasons ?? scores.reasons;

  const tags: string[] = [];
  if (params.intent) tags.push(`intent:${params.intent}`);
  if (params.wasRetried) tags.push("retried");
  if (!scores.answered) tags.push("deflected");
  if (qualityScore < 60) tags.push("low_quality");
  if (qualityScore >= 80) tags.push("high_quality");

  const traceMetadata: Record<string, unknown> = {
    intent: params.intent ?? "unknown",
    qualityScore,
    qualityReasons,
    wasRetried: params.wasRetried ?? false,
    retryReason: params.retryReason,
    stepCount: params.stepCount,
    toolCallNames: params.toolCallNames,
    selectedProjectId: params.selectedProjectId,
    ...params.metadata,
  };

  const trace = lf.trace({
    name: "ai-assistant-chat",
    userId: params.userId,
    sessionId: params.sessionId,
    input: params.input,
    output: params.output || null,
    tags,
    metadata: traceMetadata,
  });

  trace.generation({
    name: params.generationName ?? "streamText",
    model: params.modelId,
    input: params.input,
    output: params.output || null,
    usage: {
      input: params.usage?.inputTokens,
      output: params.usage?.outputTokens,
      unit: "TOKENS",
    },
    metadata: {
      cachedInputTokens: params.usage?.inputTokenDetails?.cacheReadTokens,
      stepCount: params.stepCount,
      toolCallNames: params.toolCallNames,
      intent: params.intent,
      ...params.metadata,
    },
  });

  // Attach the strongest available quality evidence so specialized validated
  // paths do not get overwritten by the generic activity heuristic.
  const scoreComment = qualityReasons.join("; ").slice(0, 500);
  trace.score({
    name: "response_quality",
    value: qualityScore / 100,
    dataType: "NUMERIC",
    comment: scoreComment,
  });
  trace.score({
    name: "answered",
    value: scores.answered ? 1 : 0,
    dataType: "BOOLEAN",
    comment: scores.answered
      ? "substantive answer"
      : "empty response or meta-commentary deflection",
  });
  if (scores.toolFailure !== null) {
    trace.score({
      name: "tool_failure",
      value: scores.toolFailure ? 1 : 0,
      dataType: "BOOLEAN",
      comment: scoreComment,
    });
  }

  await lf.flushAsync();
}
