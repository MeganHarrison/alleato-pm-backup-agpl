import { generateText, type ModelMessage } from "ai";

export const CONTEXT_COMPACTION_SUMMARY_PREFIX =
  "[CONTEXT COMPACTION - REFERENCE ONLY]";
export const CONTEXT_COMPACTION_END_MARKER =
  "--- END OF CONTEXT SUMMARY - respond to the latest user message below, not this summary ---";

export const DEFAULT_THRESHOLD_TOKENS = 90_000;
export const DEFAULT_HARD_LIMIT_TOKENS = 120_000;
// Floor for the resolved hard limit. The `> 0` fallback already catches an
// unset / zero / NaN limit, but a fat-fingered *positive-but-tiny* value
// (e.g. AI_ASSISTANT_CONTEXT_COMPACTION_HARD_LIMIT_TOKENS=5000) would slip
// through and reject every normal short chat — the original WOMBAT incident
// was exactly this class (resolved limit of 0). Any model in use comfortably
// handles 48k tokens, so we never let the rejection threshold drop below it.
export const MIN_HARD_LIMIT_TOKENS = 48_000;
const DEFAULT_HEAD_MESSAGES = 4;
const DEFAULT_TAIL_MESSAGES = 12;
const DEFAULT_MAX_TOOL_RESULT_CHARS = 700;
const DEFAULT_SUMMARY_MODEL = "openai/gpt-4.1-mini";
export const CHARS_PER_TOKEN = 4;

/**
 * Why compaction failed. The two cases need different remedies and different
 * user-facing copy:
 *  - `conversation_over_limit` — the chat history is what pushed the request
 *    over the limit. Compacting / starting a fresh chat is the right fix.
 *  - `system_prompt_over_limit` — the INJECTED system context (intelligence
 *    packet, retrieval results, snapshot) alone is at/over the limit. Message
 *    compaction cannot help and a fresh chat re-injects the same giant prompt.
 *    This is a server-side context-assembly problem, not a long conversation.
 */
export type ContextCompactionFailureReason =
  | "conversation_over_limit"
  | "system_prompt_over_limit";

/**
 * Resolve the effective threshold / hard-limit token counts, treating any
 * non-finite or non-positive input as unset (so a stray `Number("")` === 0 or
 * NaN from an unset env var falls back to the real default instead of making
 * every chat look over-limit). Shared by the compactor and its callers so the
 * system-prompt budget can be derived from the SAME hard limit the compactor
 * enforces — they can never drift apart.
 */
export function resolveContextLimits(options: {
  thresholdTokens?: number;
  hardLimitTokens?: number;
}): { thresholdTokens: number; hardLimitTokens: number } {
  const thresholdTokens =
    Number.isFinite(options.thresholdTokens) &&
    (options.thresholdTokens as number) > 0
      ? (options.thresholdTokens as number)
      : DEFAULT_THRESHOLD_TOKENS;
  const configuredHardLimit =
    Number.isFinite(options.hardLimitTokens) &&
    (options.hardLimitTokens as number) > 0
      ? (options.hardLimitTokens as number)
      : DEFAULT_HARD_LIMIT_TOKENS;
  // Never let a misconfigured (positive but too-small) hard limit reject normal
  // short chats. Floor it so the rejection threshold can't drop into the range
  // of an ordinary system-prompt-sized request.
  const hardLimitTokens = Math.max(configuredHardLimit, MIN_HARD_LIMIT_TOKENS);
  // Keep the compaction threshold at or below the hard limit so a small custom
  // hard limit doesn't invert the two.
  return {
    thresholdTokens: Math.min(thresholdTokens, hardLimitTokens),
    hardLimitTokens,
  };
}

type SummarizeCompactionInput = {
  previousSummary: string | null;
  middleTranscript: string;
  maxOutputTokens: number;
  summaryModel?: string;
};

export type ContextCompactionMetadata = {
  enabled: boolean;
  status:
    | "disabled"
    | "under_threshold"
    | "compacted"
    | "failed_uncompacted";
  tokenEstimateBefore: number;
  tokenEstimateAfter: number;
  thresholdTokens: number;
  hardLimitTokens: number;
  headMessagesKept: number;
  tailMessagesKept: number;
  middleMessagesSummarized: number;
  previousSummaryRefreshed: boolean;
  bulkyToolResultsPruned: number;
  binaryReferencesReplaced: number;
  droppedMessages: number;
  failureReason?: string;
};

export type ContextCompactionResult = {
  messages: ModelMessage[];
  metadata: ContextCompactionMetadata;
};

export class ContextCompactionError extends Error {
  readonly code = "AI_CONTEXT_COMPACTION_FAILED";
  readonly reason: ContextCompactionFailureReason;

  constructor(
    message: string,
    reason: ContextCompactionFailureReason = "conversation_over_limit",
  ) {
    super(message);
    this.name = "ContextCompactionError";
    this.reason = reason;
  }
}

/**
 * Build the over-hard-limit error, choosing the reason from WHERE the tokens
 * actually live. If the injected system context alone is already at/over the
 * limit, the conversation is irrelevant — say so, instead of blaming the chat.
 */
function buildOverLimitError(args: {
  systemPromptTokens: number;
  messageTokens: number;
  hardLimitTokens: number;
  compactionEnabled: boolean;
  summarizerError?: string;
}): ContextCompactionError {
  const tokenEstimateBefore = args.systemPromptTokens + args.messageTokens;
  const suffix = args.summarizerError
    ? ` Summarizer error: ${args.summarizerError}`
    : "";

  if (args.systemPromptTokens >= args.hardLimitTokens) {
    return new ContextCompactionError(
      `Injected system context alone is ${args.systemPromptTokens} tokens, at/over the ` +
        `hard token limit (${args.hardLimitTokens}); the conversation contributes only ` +
        `${args.messageTokens} tokens. Message compaction cannot reduce the system prompt — ` +
        `this is an over-large retrieval/context-assembly payload, not a long conversation.${suffix}`,
      "system_prompt_over_limit",
    );
  }

  return new ContextCompactionError(
    `Request is over the hard token limit (${tokenEstimateBefore} >= ${args.hardLimitTokens}; ` +
      `system=${args.systemPromptTokens}, messages=${args.messageTokens})` +
      (args.compactionEnabled
        ? ` and compaction could not reduce it further.`
        : ` and compaction is disabled.`) +
      suffix,
    "conversation_over_limit",
  );
}

export type ContextCompactionOptions = {
  enabled: boolean;
  systemPrompt: string;
  thresholdTokens?: number;
  hardLimitTokens?: number;
  headMessages?: number;
  tailMessages?: number;
  maxToolResultChars?: number;
  maxSummaryTokens?: number;
  summaryModel?: string;
  summarize?: (input: SummarizeCompactionInput) => Promise<string>;
};

function estimateTokensFromText(value: string): number {
  return Math.ceil(value.length / CHARS_PER_TOKEN);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return "[unserializable]";
  }
}

function textFromContent(content: ModelMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (part.type === "text") return part.text;
      if (part.type === "reasoning") return part.text;
      if (part.type === "tool-call") {
        return `[tool-call:${part.toolName}] ${safeJson(part.input)}`;
      }
      if (part.type === "tool-result") {
        return `[tool-result:${part.toolName}] ${safeJson(part.output)}`;
      }
      if (part.type === "file") {
        return `[file:${part.filename ?? "unnamed"}:${part.mediaType}]`;
      }
      if (part.type === "image") {
        return `[image:${part.mediaType ?? "unknown"}]`;
      }
      if (part.type === "tool-approval-request") {
        return `[tool-approval-request:${part.toolCallId}]`;
      }
      if (part.type === "tool-approval-response") {
        return `[tool-approval-response:${part.approvalId}:${part.approved ? "approved" : "denied"}]`;
      }
      // Defensive fallback: the runtime may emit part types not yet in the SDK's
      // type union, at which point `part` narrows to `never` above.
      return `[${(part as { type: string }).type}]`;
    })
    .join("\n");
}

export function estimateModelMessagesTokens(messages: ModelMessage[]): number {
  return messages.reduce(
    (total, message) => total + estimateTokensFromText(textFromContent(message.content)),
    0,
  );
}

function isCompactionSummaryMessage(message: ModelMessage): boolean {
  return (
    message.role === "system" &&
    typeof message.content === "string" &&
    message.content.startsWith(CONTEXT_COMPACTION_SUMMARY_PREFIX)
  );
}

function summarizeToolOutput(output: unknown, maxChars: number): {
  output: unknown;
  pruned: boolean;
} {
  const serialized = safeJson(output);
  if (serialized.length <= maxChars) return { output, pruned: false };

  return {
    output: {
      type: "text",
      value: `[historical tool result pruned: ${serialized.length} chars, preview=${serialized
        .slice(0, maxChars)
        .replace(/\s+/g, " ")}]`,
    },
    pruned: true,
  };
}

function sanitizeHistoricalMessage(
  message: ModelMessage,
  maxToolResultChars: number,
): {
  message: ModelMessage;
  bulkyToolResultsPruned: number;
  binaryReferencesReplaced: number;
} {
  if (typeof message.content === "string" || !Array.isArray(message.content)) {
    return {
      message,
      bulkyToolResultsPruned: 0,
      binaryReferencesReplaced: 0,
    };
  }

  let bulkyToolResultsPruned = 0;
  let binaryReferencesReplaced = 0;
  const content = message.content.map((part) => {
    if (part.type === "file") {
      binaryReferencesReplaced += 1;
      return {
        type: "text" as const,
        text: `[historical file omitted: ${part.filename ?? "unnamed"} (${part.mediaType})]`,
      };
    }
    if (part.type === "image") {
      binaryReferencesReplaced += 1;
      return {
        type: "text" as const,
        text: `[historical image omitted: ${part.mediaType ?? "unknown media type"}]`,
      };
    }
    if (part.type === "tool-result") {
      const summarized = summarizeToolOutput(part.output, maxToolResultChars);
      if (summarized.pruned) bulkyToolResultsPruned += 1;
      return {
        ...part,
        output: summarized.output,
      };
    }
    return part;
  });

  return {
    message: { ...message, content } as ModelMessage,
    bulkyToolResultsPruned,
    binaryReferencesReplaced,
  };
}

function serializeForSummary(messages: ModelMessage[], maxToolResultChars: number): {
  transcript: string;
  bulkyToolResultsPruned: number;
  binaryReferencesReplaced: number;
} {
  let bulkyToolResultsPruned = 0;
  let binaryReferencesReplaced = 0;
  const transcript = messages
    .map((message, index) => {
      const sanitized = sanitizeHistoricalMessage(message, maxToolResultChars);
      bulkyToolResultsPruned += sanitized.bulkyToolResultsPruned;
      binaryReferencesReplaced += sanitized.binaryReferencesReplaced;
      return `[#${index + 1} ${sanitized.message.role}]\n${textFromContent(sanitized.message.content)}`;
    })
    .join("\n\n");

  return { transcript, bulkyToolResultsPruned, binaryReferencesReplaced };
}

async function defaultSummarizeCompaction({
  previousSummary,
  middleTranscript,
  maxOutputTokens,
  summaryModel,
}: SummarizeCompactionInput): Promise<string> {
  const { getLanguageModel } = await import("@/lib/ai/providers");
  const result = await generateText({
    model: getLanguageModel(summaryModel ?? DEFAULT_SUMMARY_MODEL),
    instructions: [
      "You summarize old AI assistant chat turns for future context.",
      "The summary is reference-only. Do not continue the conversation.",
      "Preserve decisions, file paths, commands, errors, project names, source facts, and unresolved blockers.",
      "Do not convert old user asks into active instructions.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          previousSummary
            ? `<previous-summary>\n${previousSummary}\n</previous-summary>\n\nRefresh that summary with these older turns.`
            : "Create a compact reference summary from these older turns.",
          "<older-turns>",
          middleTranscript,
          "</older-turns>",
        ].join("\n"),
      },
    ],
    maxOutputTokens,
  });

  return result.text.trim();
}

function createSummaryMessage(summary: string): ModelMessage {
  return {
    role: "system",
    content: [
      CONTEXT_COMPACTION_SUMMARY_PREFIX,
      "Earlier messages were compacted into the summary below. Treat it as background reference only. The latest user message after this summary is the active task.",
      "",
      summary,
      "",
      CONTEXT_COMPACTION_END_MARKER,
    ].join("\n"),
  };
}

/**
 * The message-index span [start, end] over which a single tool call's parts
 * appear — a `tool-call` (and any `tool-approval-*`) in one message and its
 * matching `tool-result` in a later message. A slice boundary that lands
 * strictly inside this span would orphan one half: summarizing the `tool-call`
 * to prose while keeping the `tool-result` (or vice-versa) makes the provider
 * reject the request with a hard 400 for an unmatched tool_use/tool_result.
 */
type ToolPairSpan = { start: number; end: number };

function toolCallIdOfPart(part: { type: string }): string | undefined {
  if (
    part.type === "tool-call" ||
    part.type === "tool-result" ||
    part.type === "tool-approval-request"
  ) {
    return (part as { toolCallId?: string }).toolCallId;
  }
  return undefined;
}

function collectToolPairSpans(messages: ModelMessage[]): ToolPairSpan[] {
  const idToRange = new Map<string, ToolPairSpan>();
  messages.forEach((message, index) => {
    const content = message.content;
    if (!Array.isArray(content)) return;
    for (const part of content) {
      const toolCallId = toolCallIdOfPart(part);
      if (!toolCallId) continue;
      const existing = idToRange.get(toolCallId);
      if (existing) {
        existing.start = Math.min(existing.start, index);
        existing.end = Math.max(existing.end, index);
      } else {
        idToRange.set(toolCallId, { start: index, end: index });
      }
    }
  });
  // Only spans that cross a message boundary can be split; a call+result in the
  // same message can never be orphaned by a slice.
  return [...idToRange.values()].filter((span) => span.end > span.start);
}

/**
 * `boundary` = the number of messages kept before the split point. A tool pair
 * straddles the boundary when `span.start < boundary <= span.end`. A boundary
 * of 0 or `messages.length` is always safe (one side is empty).
 */
function isSafeBoundary(boundary: number, spans: ToolPairSpan[]): boolean {
  return spans.every((span) => boundary <= span.start || boundary > span.end);
}

// Snap the head/middle boundary earlier (toward 0) until no pair straddles it.
// Moving it backward pushes a straddling pair fully into the summarized middle.
function snapHeadBoundary(desired: number, spans: ToolPairSpan[]): number {
  let boundary = desired;
  while (boundary > 0 && !isSafeBoundary(boundary, spans)) {
    boundary -= 1;
  }
  return boundary;
}

// Snap the middle/tail boundary later (toward the end) until no pair straddles
// it. Moving it forward pushes a straddling pair fully into the middle.
function snapTailBoundary(
  desired: number,
  total: number,
  spans: ToolPairSpan[],
): number {
  let boundary = desired;
  while (boundary < total && !isSafeBoundary(boundary, spans)) {
    boundary += 1;
  }
  return boundary;
}

export async function maybeCompactModelMessages(
  messages: ModelMessage[],
  options: ContextCompactionOptions,
): Promise<ContextCompactionResult> {
  // Defense-in-depth: a non-positive or non-finite limit is a misconfiguration,
  // not "the limit is zero". Treat it as unset and fall back to the default, so
  // a stray 0 (e.g. Number("") from an unset env var) can never make every chat
  // look "over the hard limit" and get rejected.
  const { thresholdTokens, hardLimitTokens } = resolveContextLimits(options);
  const headMessages = options.headMessages ?? DEFAULT_HEAD_MESSAGES;
  const tailMessages = options.tailMessages ?? DEFAULT_TAIL_MESSAGES;
  const maxToolResultChars =
    options.maxToolResultChars ?? DEFAULT_MAX_TOOL_RESULT_CHARS;
  const maxSummaryTokens = options.maxSummaryTokens ?? 1_500;
  // Keep the two budgets separate: compaction can only ever shrink the
  // conversation, never the injected system prompt. Tracking them apart lets us
  // attribute an over-limit request to the right cause (see buildOverLimitError).
  const systemPromptTokens = estimateTokensFromText(options.systemPrompt);
  const messageTokens = estimateModelMessagesTokens(messages);
  const tokenEstimateBefore = systemPromptTokens + messageTokens;

  const baseMetadata = {
    enabled: options.enabled,
    tokenEstimateBefore,
    tokenEstimateAfter: tokenEstimateBefore,
    thresholdTokens,
    hardLimitTokens,
    headMessagesKept: 0,
    tailMessagesKept: 0,
    middleMessagesSummarized: 0,
    previousSummaryRefreshed: false,
    bulkyToolResultsPruned: 0,
    binaryReferencesReplaced: 0,
    droppedMessages: 0,
  };

  if (!options.enabled) {
    if (tokenEstimateBefore >= hardLimitTokens) {
      // Compaction is the only thing that could bring this request under the
      // provider's limit. Forwarding it would earn a raw 400/413 — fail loudly
      // with a typed error instead of leaking a provider error to the user.
      throw buildOverLimitError({
        systemPromptTokens,
        messageTokens,
        hardLimitTokens,
        compactionEnabled: false,
      });
    }
    return { messages, metadata: { ...baseMetadata, status: "disabled" } };
  }

  if (tokenEstimateBefore < thresholdTokens) {
    return { messages, metadata: { ...baseMetadata, status: "under_threshold" } };
  }

  const existingSummaryIndex = messages.findIndex(isCompactionSummaryMessage);
  const existingSummary =
    existingSummaryIndex >= 0 && typeof messages[existingSummaryIndex]?.content === "string"
      ? (messages[existingSummaryIndex]?.content as string)
      : null;
  const withoutExistingSummary =
    existingSummaryIndex >= 0
      ? messages.filter((_, index) => index !== existingSummaryIndex)
      : messages;

  if (withoutExistingSummary.length < headMessages + tailMessages + 1) {
    return { messages, metadata: { ...baseMetadata, status: "under_threshold" } };
  }

  // Snap both slice boundaries so no tool-call/tool-result pair straddles them.
  // Both boundaries only ever move toward the middle, so the middle can only
  // grow — it can never become empty (the length guard above already proved at
  // least one middle message exists) and head/tail can never cross.
  const total = withoutExistingSummary.length;
  const toolPairSpans = collectToolPairSpans(withoutExistingSummary);
  const headBoundary = snapHeadBoundary(headMessages, toolPairSpans);
  const tailBoundary = snapTailBoundary(total - tailMessages, total, toolPairSpans);

  const head = withoutExistingSummary.slice(0, headBoundary);
  const tail = withoutExistingSummary.slice(tailBoundary);
  const middle = withoutExistingSummary.slice(headBoundary, tailBoundary);
  const serialized = serializeForSummary(middle, maxToolResultChars);

  try {
    const summarize = options.summarize ?? defaultSummarizeCompaction;
    const summary = await summarize({
      previousSummary: existingSummary,
      middleTranscript: serialized.transcript,
      maxOutputTokens: maxSummaryTokens,
      summaryModel: options.summaryModel,
    });
    const compactedMessages = [...head, createSummaryMessage(summary), ...tail];
    const tokenEstimateAfter =
      estimateTokensFromText(options.systemPrompt) +
      estimateModelMessagesTokens(compactedMessages);

    return {
      messages: compactedMessages,
      metadata: {
        ...baseMetadata,
        status: "compacted",
        tokenEstimateAfter,
        headMessagesKept: head.length,
        tailMessagesKept: tail.length,
        middleMessagesSummarized: middle.length,
        previousSummaryRefreshed: Boolean(existingSummary),
        bulkyToolResultsPruned: serialized.bulkyToolResultsPruned,
        binaryReferencesReplaced: serialized.binaryReferencesReplaced,
        droppedMessages: Math.max(0, messages.length - compactedMessages.length),
      },
    };
  } catch (error) {
    const failureReason =
      error instanceof Error ? error.message : "Unknown context compaction failure";
    if (tokenEstimateBefore >= hardLimitTokens) {
      throw buildOverLimitError({
        systemPromptTokens,
        messageTokens,
        hardLimitTokens,
        compactionEnabled: true,
        summarizerError: failureReason,
      });
    }

    return {
      messages,
      metadata: {
        ...baseMetadata,
        status: "failed_uncompacted",
        failureReason,
      },
    };
  }
}
