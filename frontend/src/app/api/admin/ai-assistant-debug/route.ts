import { requireDeveloper } from "@/app/api/admin/_shared";
import { extractLangfuseTraceIdFromMetadata } from "@/lib/ai/langfuse-feedback";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { serviceDb } from "@/lib/supabase/service-db";

export const dynamic = "force-dynamic";

const WHERE = "api.admin.ai-assistant-debug#GET";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const LANGFUSE_PROJECT_ID = "cmp1jdf0o06eead07m0eatqz2";
const LANGFUSE_HOST =
  process.env.LANGFUSE_HOST ??
  process.env.LANGFUSE_BASE_URL ??
  "https://us.cloud.langfuse.com";

type JsonObject = Record<string, unknown>;

type ChatHistoryRow = {
  id: string;
  session_id: string;
  user_id: string | null;
  role: string;
  content: string | null;
  sources: unknown;
  metadata: unknown;
  created_at: string | null;
};

type ConversationRow = {
  session_id: string;
  title: string | null;
  last_message_at: string | null;
};

export type AiAssistantDebugToolView = {
  name: string;
  status: "success" | "preview" | "failed" | "unknown";
  writeKind: "read" | "write" | "unknown";
  input: JsonObject | null;
  output: unknown;
  error: string | null;
};

export type AiAssistantDebugToolDiscoveryView = {
  server: string;
  status: "available" | "failed";
  discoveredToolCount: number | null;
  enabledToolCount: number | null;
  enabledTools: string[];
  deniedToolCount: number | null;
  error: string | null;
};

export type AiAssistantDebugScoreView = {
  score: number | null;
  reasons: string[];
};

export type AiAssistantDebugItemView = {
  id: string;
  sessionId: string;
  conversationTitle: string;
  userId: string | null;
  createdAt: string | null;
  userPromptPreview: string;
  assistantPreview: string;
  assistantContent: string;
  traceId: string | null;
  traceUrl: string | null;
  model: string | null;
  providerPath: string | null;
  finishReason: string | null;
  tokenUsage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  responseQuality: AiAssistantDebugScoreView | null;
  tools: AiAssistantDebugToolView[];
  toolDiscovery: AiAssistantDebugToolDiscoveryView[];
  rawToolTraceCount: number;
  expectedNativeTool: string | null;
  retrievalPlan: unknown;
  changeEventWorkflow: unknown;
  sourceDebug: unknown;
  backendDeepAgent: unknown;
  memoryUsage: unknown;
  sources: unknown[];
  missingInstrumentation: string[];
  rawMetadata: unknown;
};

export type AiAssistantDebugResponse = {
  generatedAt: string;
  items: AiAssistantDebugItemView[];
};

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function toNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function preview(value: string | null | undefined, length = 220): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, length);
}

function parseLimit(request: Request): number {
  const raw = new URL(request.url).searchParams.get("limit");
  const parsed = raw ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function traceUrl(traceId: string | null): string | null {
  if (!traceId) return null;
  const host = LANGFUSE_HOST.replace(/\/$/, "");
  return `${host}/project/${LANGFUSE_PROJECT_ID}/traces/${traceId}`;
}

function toolName(tool: JsonObject): string {
  return (
    toStringValue(tool.tool) ??
    toStringValue(tool.name) ??
    toStringValue(tool.toolName) ??
    "unknown_tool"
  );
}

function isWriteToolName(name: string): boolean {
  return /^(create|update|delete|send|draft|archive|assign|mark|save|write)/i.test(
    name,
  );
}

function outputRecord(tool: JsonObject): JsonObject | null {
  return isRecord(tool.output) ? tool.output : null;
}

function errorMessage(tool: JsonObject): string | null {
  const direct = toStringValue(tool.error);
  if (direct) return direct;
  const output = outputRecord(tool);
  return toStringValue(output?.error) ?? toStringValue(output?.message);
}

function toolStatus(
  tool: JsonObject,
  writeCandidate: boolean,
): AiAssistantDebugToolView["status"] {
  const explicit = toStringValue(tool.status)?.toLowerCase();
  const output = outputRecord(tool);
  const action = toStringValue(output?.action)?.toLowerCase();
  const input = isRecord(tool.input) ? tool.input : null;

  if (explicit === "failed" || explicit === "error") return "failed";
  if (input?.confirmed === false) return "preview";
  if (action === "preview") return "preview";
  if (output?.success === false || errorMessage(tool)) return "failed";
  if (output?.success === true) return "success";
  if (writeCandidate) return "unknown";
  if (explicit === "success") return "success";
  return "unknown";
}

function normalizeTool(tool: unknown): AiAssistantDebugToolView | null {
  if (!isRecord(tool)) return null;
  const name = toolName(tool);
  if (name === "mcpToolDiscovery") return null;
  const input = isRecord(tool.input) ? tool.input : null;
  const writeCandidate = isWriteToolName(name) || input?.confirmed !== undefined;

  return {
    name,
    status: toolStatus(tool, writeCandidate),
    writeKind: writeCandidate
      ? "write"
      : name === "unknown_tool"
        ? "unknown"
        : "read",
    input,
    output: tool.output ?? null,
    error: errorMessage(tool),
  };
}

function normalizeToolDiscovery(
  tool: unknown,
): AiAssistantDebugToolDiscoveryView | null {
  if (!isRecord(tool)) return null;
  if (toolName(tool) !== "mcpToolDiscovery") return null;

  const input = isRecord(tool.input) ? tool.input : {};
  const output = isRecord(tool.output) ? tool.output : {};
  const enabledTools = Array.isArray(output.enabledTools)
    ? output.enabledTools.filter((item): item is string => typeof item === "string")
    : [];
  const error = toStringValue(output.error);
  const deniedDescriptors = Array.isArray(output.deniedToolDescriptors)
    ? output.deniedToolDescriptors
    : null;

  return {
    server: toStringValue(input.server) ?? "unknown",
    status: error ? "failed" : "available",
    discoveredToolCount: toNumberValue(output.discoveredToolCount),
    enabledToolCount: toNumberValue(output.enabledToolCount),
    enabledTools,
    deniedToolCount: deniedDescriptors ? deniedDescriptors.length : null,
    error,
  };
}

function normalizeResponseQuality(
  metadata: JsonObject,
): AiAssistantDebugScoreView | null {
  const responseQuality = isRecord(metadata.response_quality)
    ? metadata.response_quality
    : null;
  if (!responseQuality) return null;

  return {
    score: toNumberValue(responseQuality.score),
    reasons: Array.isArray(responseQuality.reasons)
      ? responseQuality.reasons.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function expectedNativeTool(metadata: JsonObject): string | null {
  const retrievalPlan = isRecord(metadata.retrieval_plan)
    ? metadata.retrieval_plan
    : null;
  const intent = toStringValue(retrievalPlan?.intent);

  if (intent === "change_event_write") return "createChangeEvent";
  return null;
}

function missingInstrumentation(metadata: JsonObject, sources: unknown[]): string[] {
  const missing: string[] = [];

  if (!toStringValue(metadata.provider_path)) missing.push("provider_path");
  if (!toStringValue(metadata.model) && !toStringValue(metadata.synthesis_model)) {
    missing.push("model");
  }
  if (!isRecord(metadata.retrieval_plan)) missing.push("retrieval_plan");
  if (!Array.isArray(metadata.tool_trace)) missing.push("tool_trace");
  if (!isRecord(metadata.response_quality)) missing.push("response_quality");
  if (!isRecord(metadata.source_debug)) missing.push("source_debug");
  if (sources.length === 0) missing.push("sources");

  return missing;
}

function mostRecentUserPrompt(
  assistantRow: ChatHistoryRow,
  messagesBySession: Map<string, ChatHistoryRow[]>,
): string {
  const assistantTime = assistantRow.created_at
    ? new Date(assistantRow.created_at).getTime()
    : Number.POSITIVE_INFINITY;
  const sessionMessages = messagesBySession.get(assistantRow.session_id) ?? [];
  const userMessage = sessionMessages.find((message) => {
    if (message.role !== "user") return false;
    const messageTime = message.created_at
      ? new Date(message.created_at).getTime()
      : Number.NEGATIVE_INFINITY;
    return messageTime <= assistantTime;
  });

  return preview(userMessage?.content, 260);
}

export function mapRows(
  rows: ChatHistoryRow[],
  conversations: ConversationRow[],
  sessionMessages: ChatHistoryRow[],
): AiAssistantDebugItemView[] {
  const conversationBySession = new Map(
    conversations.map((conversation) => [conversation.session_id, conversation]),
  );
  const messagesBySession = new Map<string, ChatHistoryRow[]>();

  for (const message of sessionMessages) {
    const existing = messagesBySession.get(message.session_id) ?? [];
    existing.push(message);
    messagesBySession.set(message.session_id, existing);
  }

  return rows.map((row) => {
    const metadata = isRecord(row.metadata) ? row.metadata : {};
    const usage = isRecord(metadata.usage) ? metadata.usage : {};
    const sources = Array.isArray(row.sources) ? row.sources : [];
    const toolTrace = Array.isArray(metadata.tool_trace) ? metadata.tool_trace : [];
    const tools = toolTrace
      .map(normalizeTool)
      .filter((tool): tool is AiAssistantDebugToolView => Boolean(tool));
    const toolDiscovery = toolTrace
      .map(normalizeToolDiscovery)
      .filter((tool): tool is AiAssistantDebugToolDiscoveryView => Boolean(tool));
    const traceId = extractLangfuseTraceIdFromMetadata(metadata);

    return {
      id: row.id,
      sessionId: row.session_id,
      conversationTitle:
        conversationBySession.get(row.session_id)?.title ?? "Untitled conversation",
      userId: row.user_id,
      createdAt: row.created_at,
      userPromptPreview: mostRecentUserPrompt(row, messagesBySession),
      assistantPreview: preview(row.content),
      assistantContent: row.content ?? "",
      traceId,
      traceUrl: traceUrl(traceId),
      model: toStringValue(metadata.model) ?? toStringValue(metadata.synthesis_model),
      providerPath: toStringValue(metadata.provider_path),
      finishReason: toStringValue(metadata.finish_reason),
      tokenUsage: {
        inputTokens: toNumberValue(usage.inputTokens),
        outputTokens: toNumberValue(usage.outputTokens),
        totalTokens: toNumberValue(usage.totalTokens),
      },
      responseQuality: normalizeResponseQuality(metadata),
      tools,
      toolDiscovery,
      rawToolTraceCount: toolTrace.length,
      expectedNativeTool: expectedNativeTool(metadata),
      retrievalPlan: metadata.retrieval_plan ?? null,
      changeEventWorkflow: metadata.change_event_workflow ?? null,
      sourceDebug: metadata.source_debug ?? null,
      backendDeepAgent: metadata.backend_deep_agent ?? null,
      memoryUsage: metadata.memory_usage ?? null,
      sources,
      missingInstrumentation: missingInstrumentation(metadata, sources),
      rawMetadata: row.metadata ?? null,
    };
  });
}

export const GET = withApiGuardrails(WHERE, async ({ request }) => {
  await requireDeveloper(WHERE);

    const searchParams = new URL(request.url).searchParams;
  const sessionId = searchParams.get("sessionId")?.trim();
  const limit = parseLimit(request);

  let query = serviceDb.from("chat_history")
    .select("id, session_id, user_id, role, content, sources, metadata, created_at")
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data: rows, error } = await query;
  if (error) {
    throw new Error(`AI assistant debug query failed: ${error.message}`);
  }

  const sessionIds = Array.from(
    new Set((rows ?? []).map((row: ChatHistoryRow) => row.session_id)),
  );
  const conversations =
    sessionIds.length > 0
      ? await serviceDb.from("conversations")
          .select("session_id, title, last_message_at")
          .in("session_id", sessionIds)
      : { data: [], error: null };

  if (conversations.error) {
    throw new Error(
      `AI assistant debug conversation query failed: ${conversations.error.message}`,
    );
  }

  const messages =
    sessionIds.length > 0
      ? await serviceDb.from("chat_history")
          .select("id, session_id, user_id, role, content, sources, metadata, created_at")
          .in("session_id", sessionIds)
          .in("role", ["user", "assistant"])
          .order("created_at", { ascending: false })
          .limit(Math.min(sessionIds.length * 12, 500))
      : { data: [], error: null };

  if (messages.error) {
    throw new Error(
      `AI assistant debug message context query failed: ${messages.error.message}`,
    );
  }

  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      items: mapRows(
        (rows ?? []) as ChatHistoryRow[],
        (conversations.data ?? []) as ConversationRow[],
        (messages.data ?? []) as ChatHistoryRow[],
      ),
    } satisfies AiAssistantDebugResponse,
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
});
