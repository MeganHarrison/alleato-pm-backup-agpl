import { requireDeveloper } from "@/app/api/admin/_shared";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { serviceDb } from "@/lib/supabase/service-db";
import { extractLangfuseTraceIdFromMetadata } from "@/lib/ai/langfuse-feedback";

export const dynamic = "force-dynamic";

const WHERE = "api.admin.ai-chat-history#GET";
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

export type AiChatHistoryToolView = {
  name: string;
  status: "success" | "preview" | "failed" | "unknown";
  writeKind: "read" | "write" | "unknown";
  input: JsonObject | null;
  output: unknown;
  error: string | null;
};

export type AiChatHistoryScoreView = {
  name: string;
  value: number | boolean | string;
  comment: string | null;
};

export type AiChatHistoryWriteStatus =
  | "no_write_tools"
  | "preview_only"
  | "confirmed"
  | "failed"
  | "unknown";

export type AiChatHistoryItemView = {
  id: string;
  sessionId: string;
  conversationTitle: string;
  userId: string | null;
  createdAt: string | null;
  traceId: string | null;
  traceUrl: string | null;
  model: string | null;
  providerPath: string | null;
  finishReason: string | null;
  contentPreview: string;
  contentLength: number;
  tokenUsage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  scores: AiChatHistoryScoreView[];
  tools: AiChatHistoryToolView[];
  writeStatus: AiChatHistoryWriteStatus;
  writeStatusReason: string;
  sourcesCount: number;
};

export type AiChatHistoryResponse = {
  generatedAt: string;
  items: AiChatHistoryItemView[];
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

function parseLimit(request: Request): number {
  const raw = new URL(request.url).searchParams.get("limit");
  const parsed = raw ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
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
  const output = tool.output;
  return isRecord(output) ? output : null;
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
): AiChatHistoryToolView["status"] {
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

function normalizeTool(tool: unknown): AiChatHistoryToolView | null {
  if (!isRecord(tool)) return null;
  const name = toolName(tool);
  const input = isRecord(tool.input) ? tool.input : null;
  const writeCandidate = isWriteToolName(name) || input?.confirmed !== undefined;
  const status = toolStatus(tool, writeCandidate);
  const writeKind =
    writeCandidate
      ? "write"
      : name === "unknown_tool"
        ? "unknown"
        : "read";

  return {
    name,
    status,
    writeKind,
    input,
    output: tool.output ?? null,
    error: errorMessage(tool),
  };
}

export function inferWriteStatus(
  tools: AiChatHistoryToolView[],
): Pick<AiChatHistoryItemView, "writeStatus" | "writeStatusReason"> {
  const writeTools = tools.filter((tool) => tool.writeKind === "write");
  if (writeTools.length === 0) {
    return {
      writeStatus: "no_write_tools",
      writeStatusReason: "No write-capable tools were called.",
    };
  }

  if (writeTools.some((tool) => tool.status === "failed")) {
    return {
      writeStatus: "failed",
      writeStatusReason: "At least one write-capable tool returned an error.",
    };
  }

  if (writeTools.some((tool) => tool.status === "success")) {
    return {
      writeStatus: "confirmed",
      writeStatusReason: "At least one write-capable tool returned success.",
    };
  }

  if (writeTools.every((tool) => tool.status === "preview")) {
    return {
      writeStatus: "preview_only",
      writeStatusReason: "Write-capable tools only returned preview output.",
    };
  }

  return {
    writeStatus: "unknown",
    writeStatusReason: "Write-capable tool metadata was incomplete.",
  };
}

function normalizeScores(metadata: JsonObject): AiChatHistoryScoreView[] {
  const scores: AiChatHistoryScoreView[] = [];
  const responseQuality = isRecord(metadata.response_quality)
    ? metadata.response_quality
    : null;
  if (responseQuality) {
    const score = toNumberValue(responseQuality.score);
    if (score !== null) {
      const reasons = Array.isArray(responseQuality.reasons)
        ? responseQuality.reasons.filter((item): item is string => typeof item === "string")
        : [];
      scores.push({
        name: "response_quality",
        value: score,
        comment: reasons.join("; ") || null,
      });
    }
  }

  return scores;
}

function traceUrl(traceId: string | null): string | null {
  if (!traceId) return null;
  const host = LANGFUSE_HOST.replace(/\/$/, "");
  return `${host}/project/${LANGFUSE_PROJECT_ID}/traces/${traceId}`;
}

export function mapChatHistoryRows(
  rows: ChatHistoryRow[],
  conversations: ConversationRow[],
): AiChatHistoryItemView[] {
  const conversationBySession = new Map(
    conversations.map((conversation) => [conversation.session_id, conversation]),
  );

  return rows.map((row) => {
    const metadata = isRecord(row.metadata) ? row.metadata : {};
    const usage = isRecord(metadata.usage) ? metadata.usage : {};
    const tools = Array.isArray(metadata.tool_trace)
      ? metadata.tool_trace.map(normalizeTool).filter((tool): tool is AiChatHistoryToolView => Boolean(tool))
      : [];
    let writeStatus = inferWriteStatus(tools);
    const traceId = extractLangfuseTraceIdFromMetadata(metadata);
    const content = row.content ?? "";
    if (
      writeStatus.writeStatus === "unknown" &&
      /\b(reply\s+\*?\*?confirm|preview)\b/i.test(content)
    ) {
      writeStatus = {
        writeStatus: "preview_only",
        writeStatusReason:
          "Assistant response presented this as a confirmation preview; persisted write output was incomplete.",
      };
    }

    return {
      id: row.id,
      sessionId: row.session_id,
      conversationTitle:
        conversationBySession.get(row.session_id)?.title ?? "Untitled conversation",
      userId: row.user_id,
      createdAt: row.created_at,
      traceId,
      traceUrl: traceUrl(traceId),
      model: toStringValue(metadata.model) ?? toStringValue(metadata.synthesis_model),
      providerPath: toStringValue(metadata.provider_path),
      finishReason: toStringValue(metadata.finish_reason),
      contentPreview: content.replace(/\s+/g, " ").trim().slice(0, 260),
      contentLength: content.length,
      tokenUsage: {
        inputTokens: toNumberValue(usage.inputTokens),
        outputTokens: toNumberValue(usage.outputTokens),
        totalTokens: toNumberValue(usage.totalTokens),
      },
      scores: normalizeScores(metadata),
      tools,
      ...writeStatus,
      sourcesCount: Array.isArray(row.sources) ? row.sources.length : 0,
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
    throw new Error(`chat_history trace query failed: ${error.message}`);
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
      `conversations trace query failed: ${conversations.error.message}`,
    );
  }

  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      items: mapChatHistoryRows(
        (rows ?? []) as ChatHistoryRow[],
        (conversations.data ?? []) as ConversationRow[],
      ),
    } satisfies AiChatHistoryResponse,
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
});
