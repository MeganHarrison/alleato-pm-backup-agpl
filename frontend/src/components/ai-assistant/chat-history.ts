import type { UIMessage } from "@ai-sdk/react";
import {
  extractLangfuseTraceIdFromMetadata,
  metadataMessageIds,
} from "@/lib/ai/langfuse-feedback";
import type { ResponseQuality } from "./chat-area";
import type { MemoryUsage } from "./memory-usage-disclosure";
import type { SkillUsage } from "./skill-usage-disclosure";
import type { AssistantTraceDiagnostics, ToolTraceItem } from "./trace-panel";

/**
 * Shared parsing for persisted AI-assistant chat history. Used by both the
 * full `/ai` page (`rag-chat-page`) and the global floating widget
 * (`widget-ai-chat`) so the DB-row → UI-message mapping cannot diverge.
 */

type PersistedDataPart = {
  type: `data-${string}`;
  id?: string;
  data: unknown;
};

export interface ChatHistoryMessage {
  id: string;
  role: string;
  content: string;
  sources: unknown[] | null;
  metadata?: {
    tool_trace?: ToolTraceItem[];
    response_quality?: ResponseQuality;
    provider_path?: string;
    model?: string;
    provider_decision?: Record<string, unknown> | null;
    loop_diagnostic?: Record<string, unknown> | null;
    data_parts?: PersistedDataPart[];
    // memory_usage / skill_usage are read by their dedicated extractors
    memory_usage?: MemoryUsage;
    skill_usage?: SkillUsage;
    response_message_id?: unknown;
    langfuse_trace_id?: unknown;
  } | null;
  created_at: string | null;
}

function normalizePersistedDataParts(
  message: ChatHistoryMessage,
): PersistedDataPart[] {
  const parts = message.metadata?.data_parts;
  if (!Array.isArray(parts)) return [];

  return parts.filter((part): part is PersistedDataPart => {
    if (!part || typeof part !== "object") return false;
    const record = part as Record<string, unknown>;
    return typeof record.type === "string" && record.type.startsWith("data-");
  });
}

export function dbMessageToUIMessage(msg: ChatHistoryMessage): UIMessage {
  return {
    id: msg.id,
    role: msg.role as "user" | "assistant",
    parts: [
      ...normalizePersistedDataParts(msg),
      ...(msg.content ? [{ type: "text" as const, text: msg.content }] : []),
    ],
  };
}

export function extractToolTraces(
  messages: ChatHistoryMessage[],
): Record<string, ToolTraceItem[]> {
  const tracesByMessageId: Record<string, ToolTraceItem[]> = {};
  messages.forEach((msg) => {
    const traces = msg.metadata?.tool_trace;
    if (Array.isArray(traces) && traces.length > 0) {
      tracesByMessageId[msg.id] = traces;
    }
  });
  return tracesByMessageId;
}

export function extractSources(
  messages: ChatHistoryMessage[],
): Record<string, unknown[]> {
  const sourcesByMessageId: Record<string, unknown[]> = {};
  messages.forEach((msg) => {
    if (Array.isArray(msg.sources) && msg.sources.length > 0) {
      sourcesByMessageId[msg.id] = msg.sources;
    }
  });
  return sourcesByMessageId;
}

export function extractResponseQuality(
  messages: ChatHistoryMessage[],
): Record<string, ResponseQuality> {
  const byMessageId: Record<string, ResponseQuality> = {};
  messages.forEach((msg) => {
    const quality = msg.metadata?.response_quality;
    if (quality) {
      byMessageId[msg.id] = quality;
    }
  });
  return byMessageId;
}

export function extractTraceDiagnostics(
  messages: ChatHistoryMessage[],
): Record<string, AssistantTraceDiagnostics> {
  const byMessageId: Record<string, AssistantTraceDiagnostics> = {};
  messages.forEach((msg) => {
    const metadata = msg.metadata;
    if (!metadata) return;

    const diagnostics: AssistantTraceDiagnostics = {
      providerPath: metadata.provider_path ?? null,
      model: metadata.model ?? null,
      providerDecision: metadata.provider_decision ?? null,
      loopDiagnostic: metadata.loop_diagnostic ?? null,
    };

    if (
      diagnostics.providerPath ||
      diagnostics.model ||
      diagnostics.providerDecision ||
      diagnostics.loopDiagnostic
    ) {
      byMessageId[msg.id] = diagnostics;
    }
  });
  return byMessageId;
}

export function extractLangfuseTraceIds(
  messages: ChatHistoryMessage[],
): Record<string, string> {
  const byMessageId: Record<string, string> = {};
  messages.forEach((msg) => {
    const traceId = extractLangfuseTraceIdFromMetadata(msg.metadata);
    if (!traceId) return;
    for (const messageId of metadataMessageIds(msg)) {
      byMessageId[messageId] = traceId;
    }
  });
  return byMessageId;
}
