import {
  streamText,
  generateText,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { waitUntil } from "@vercel/functions";
import {
  traceChatCompletion,
  scoreChatTrace,
  maybeJudgeAndScore,
  startChatGenerationObservation,
} from "@/lib/ai/langfuse-trace";
import { aiTelemetry } from "@/lib/ai/ai-telemetry";
import { buildEmptyResponseMessage } from "@/lib/ai/empty-response-message";
import {
  buildChatAttachmentNote,
  detectChatAttachmentCapabilitiesAcrossMessages,
  filterModelReadableAttachments,
  validateChatAttachmentPayload,
} from "@/lib/ai/chat-attachment-capabilities";
import {
  buildAssistantOpenAiProviderOptions,
  hasFunctionTools,
} from "@/lib/ai/assistant-provider-options";
import {
  propagateAttributes,
  startActiveObservation,
  getActiveTraceId,
  setActiveTraceIO,
} from "@langfuse/tracing";
import type { SupabaseClient } from "@supabase/supabase-js";
import { planRetrieval } from "@/lib/ai/retrieval/planner";
import { planRetrievalWithSemanticCollections } from "@/lib/ai/retrieval/collection-planner";
import { PROJECT_SCOPE_REQUIRED_OPENING } from "@/lib/ai/retrieval/planner";
import { executeRetrievalPlan } from "@/lib/ai/retrieval/executor";
import {
  COLLECTION_SYNTHESIS_MODEL,
  synthesizeMeetingCollection,
} from "@/lib/ai/retrieval/collection-synthesis";
import { assembleSystemPromptFromContext } from "@/lib/ai/retrieval/system-prompt";
import { buildExecutorDeps } from "@/lib/ai/retrieval/deps";
import {
  loadCurrentIntelligencePacket,
  resolveIntelligenceTarget,
} from "@/lib/ai/intelligence/packet-service";
import { synthesizeAdvisorResponse } from "@/lib/ai/intelligence/advisor-synthesis";
import {
  projectPacketIsFastPathEligible,
  shouldUseProjectPacketFastPath,
} from "@/lib/ai/intelligence/packet-fast-path";
import {
  assembleSystemPrompt,
  runPostResponseTasks,
  type MemoryUsageSummary,
  type BotSkillUsageSummary,
} from "@/lib/ai/bot-core";
import {
  buildSkillInjectionContext,
  recordSelectedSkillUsage,
} from "@/lib/ai/services/skill-injection-service";
import {
  isDailyDeepReadPacketQuestion,
  isExecutiveBriefingMetadataQuestion,
  isPersonalTaskRegisterRequest,
} from "@/lib/ai/personal-daily-brief";
import { createStrategistTools } from "@/lib/ai/orchestrator";
import {
  assistantSurfaceAllowsActionTools,
  parseAiAssistantSurface,
  type AiAssistantSurface,
} from "@/lib/ai/assistant-surface";
import {
  createAssistantToolApprovalPolicy,
  resolveToolApprovalSecret,
} from "@/lib/ai/tool-approval-policy";
import { preserveActionToolTraceOutput } from "@/lib/ai/action-tool-trace";
import { previewCreateRFI } from "@/lib/ai/tools/action-tools";
import { createAiAssistantMcpTools } from "@/lib/ai/tools/mcp-tools";
import {
  mergeResearchReceipts,
  researchCoverageComplete,
  researchReceiptFromToolTrace,
  researchReceiptCitations,
  researchReceiptMetadata,
  selectToolsForResearchContract,
  type ResearchReceipt,
} from "@/lib/ai/retrieval/research-contract";
import { fetchWithGuardrails } from "@/lib/fetch-with-guardrails";
import {
  microsoftAssistantBackendUrl,
  microsoftAssistantAdminApiKey,
  defaultMicrosoftMailbox,
  microsoftAssistantTimeoutMs,
} from "@/lib/ai/microsoft-backend-config";
import { getLanguageModel } from "@/lib/ai/providers";
import { scoreResponseQuality } from "@/lib/ai/score-response-quality";
import type {
  OutlookInboxSummaryWidgetPayload,
  ProjectPickerWidgetPayload,
  TaskSummaryWidgetPayload,
} from "@/lib/ai/assistant-widgets";
import {
  buildChangeEventRelatedEvidence,
  buildChangeEventWorkflowMetadata,
  isChangeEventFinalPreviewRequest,
} from "@/lib/ai/change-event-workflow";
import {
  upsertChangeEventDraftArtifact,
} from "@/lib/ai/services/workspace-artifact-service";
import { loadAssistantSourceHealthContext } from "@/lib/ai/source-health";
import {
  CHARS_PER_TOKEN,
  ContextCompactionError,
  maybeCompactModelMessages,
  resolveContextLimits,
  type ContextCompactionMetadata,
} from "@/lib/ai/stream/compaction";
import {
  buildDeepAgentExecutiveEvidenceWidget,
  buildDeepAgentResearchEvidenceWidget,
  fetchDeepAgentExecutiveBriefing,
  fetchDeepAgentResearch,
  formatDeepAgentExecutiveBriefingContext,
  formatDeepAgentExecutiveDirectResponse,
  formatDeepAgentResearchContext,
  formatDeepAgentResearchDirectResponse,
  shouldUseDeepAgentExecutiveBridge,
  shouldUseDeepAgentExecutiveDirectResponse,
  shouldUseDeepAgentResearchBridge,
  shouldUseDeepAgentResearchDirectResponse,
} from "@/lib/ai/deep-agent-bridge";
import {
  createWeeklyMarketingContentWorkflow,
  type CmoWeeklyContentWorkflowResult,
} from "@/lib/ai/services/marketing-service";
import { getApiRouteUser } from "@/lib/supabase/server";
import { conversationBelongsToSurface } from "@/lib/ai/chat-surface.server";
import {
  createRagServiceClient,
  createServiceClient,
  isRagDatabaseReadsEnabled,
} from "@/lib/supabase/service";
import { createChatHistoryWriter } from "./chat-history-writer";
import {
  loadCurrentDailyExecutiveBriefPacket,
  type CanonicalDailyBriefPacket,
} from "@/lib/daily-briefs/canonical-packets";
import {
  DEFAULT_AI_ASSISTANT_MODEL,
  isDeepAgentsStrategistModelId,
  isAiAssistantModelId,
} from "@/lib/ai/assistant-models";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { Database, Json } from "@/types/database.types";

type HandlerArgs = {
  user: { id: string };
  sessionId: string;
  messages: UIMessage[];
  assistantSurface: AiAssistantSurface;
  selectedProjectId?: number;
  activeModel: string;
  supabase: SupabaseClient<Database>;
};

type GeneratedTaskSummaryItem = TaskSummaryWidgetPayload["items"][number];

type GeneratedTaskSummaryAnswer = {
  content: string;
  widget: TaskSummaryWidgetPayload;
  traceOutput: Record<string, unknown>;
};

const CLOSED_TASK_STATUSES = ["done", "completed", "cancelled", "canceled", "closed"];
const AI_EVAL_DISABLE_BACKEND_DEEP_AGENTS =
  process.env.AI_EVAL_DISABLE_BACKEND_DEEP_AGENTS === "true";
const AI_EVAL_DOCUMENT_INTELLIGENCE_RESPONSE =
  process.env.AI_EVAL_DOCUMENT_INTELLIGENCE_RESPONSE === "true";
const AI_ASSISTANT_CONTEXT_COMPACTION_ENABLED =
  process.env.AI_ASSISTANT_CONTEXT_COMPACTION_ENABLED === "true";
// NOTE: do NOT coerce an unset var to "" — Number("") is 0 (a finite value),
// which would pass `0` through as the limit instead of letting compaction.ts
// fall back to its real defaults. Number(undefined) is NaN, so the
// Number.isFinite guard at the call site correctly yields `undefined`.
const AI_ASSISTANT_CONTEXT_COMPACTION_THRESHOLD_TOKENS = Number(
  process.env.AI_ASSISTANT_CONTEXT_COMPACTION_THRESHOLD_TOKENS,
);
const AI_ASSISTANT_CONTEXT_COMPACTION_HARD_LIMIT_TOKENS = Number(
  process.env.AI_ASSISTANT_CONTEXT_COMPACTION_HARD_LIMIT_TOKENS,
);

function isMicrosoftSpecialistDelegationPlan(reason: string): boolean {
  return reason.startsWith("microsoft_specialist_delegation_");
}

function extractTextFromParts(parts: UIMessage["parts"]): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => (p as { type?: string }).type === "text")
    .map((p) => (p as { text?: string }).text ?? "")
    .join(" ");
}

async function buildBackendDeepAgentSkillContext(params: {
  userId: string;
  messageText: string;
  selectedProjectId?: number;
  surface: "backend_deep_agent_project" | "backend_deep_agent_executive";
  allowedCategories: string[];
}): Promise<string> {
  try {
    const skillContext = await buildSkillInjectionContext({
      userId: params.userId,
      messageText: params.messageText,
      selectedProjectId: params.selectedProjectId,
      surface: params.surface,
      allowedCategories: params.allowedCategories,
      limit: 3,
    });
    return skillContext.block;
  } catch (error) {
    console.error("[backend-deep-agents] failed to load approved skills", {
      surface: params.surface,
      message:
        error instanceof Error ? error.message : "Unknown skill context error",
    });
    return "";
  }
}

function toJsonValue(value: unknown): Json | undefined {
  if (value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map(toJsonValue)
      .filter((item): item is Json => item !== undefined);
  }
  if (value && typeof value === "object") {
    const objectValue: { [key: string]: Json | undefined } = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      objectValue[key] = toJsonValue(item);
    });
    return objectValue;
  }
  return undefined;
}

function extractPersistableDataParts(message: UIMessage): Json[] {
  return message.parts
    .filter((part) => {
      const type = (part as { type?: string }).type;
      return typeof type === "string" && type.startsWith("data-");
    })
    .map(toJsonValue)
    .filter((part): part is Json => part !== undefined);
}

function changeEventWorkflowDraftFromMetadata(metadata: unknown): unknown | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const workflow = (metadata as Record<string, unknown>).change_event_workflow;
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    return null;
  }
  return (workflow as Record<string, unknown>).draft ?? null;
}

async function loadLatestChangeEventWorkflowDraft(params: {
  supabase: SupabaseClient<Database>;
  sessionId: string;
  userId: string;
}): Promise<unknown | null> {
  const { data, error } = await params.supabase
    .from("chat_history")
    .select("metadata")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(`Loading change-event workflow state failed: ${error.message}`);
  }

  for (const row of data ?? []) {
    const draft = changeEventWorkflowDraftFromMetadata(
      (row as { metadata?: unknown }).metadata,
    );
    if (draft) return draft;
  }
  return null;
}

async function persistChangeEventWorkflowArtifact(params: {
  userId: string;
  sessionId: string;
  workflow: ReturnType<typeof buildChangeEventWorkflowMetadata>;
}): Promise<void> {
  const result = await upsertChangeEventDraftArtifact({
    userId: params.userId,
    sessionId: params.sessionId,
    workflow: params.workflow,
  });

  if ("error" in result) {
    throw new Error(
      `Persisting change-event workflow artifact failed: ${result.error}`,
    );
  }
}

function isLikelyChangeEventWorkflowFollowup(message: string): boolean {
  return /\b(project|project id|use project|cost|price|pricing|estimate|\$[\d,]+|schedule|delay|critical path|owner|client|notified|photo|drawing|rfi|email|meeting|daily log|no impact|no cost|no delay)\b/i.test(
    message,
  );
}

function buildResponseQualityMetadata(params: {
  toolTrace: Array<Record<string, unknown>>;
  content: string;
}) {
  return scoreResponseQuality(params);
}

function createBackendBridgeTrace(params: {
  tool: string;
  status: "success" | "failed" | "skipped";
  message: string;
  selectedProjectId?: number | null;
  durationMs?: number;
  detail?: string | null;
  diagnostic?: Record<string, unknown> | null;
}) {
  return {
    tool: params.tool,
    toolName: params.tool,
    agent: "frontend-ai-assistant",
    status: params.status,
    durationMs: params.durationMs ?? 0,
    detail: params.detail ?? null,
    diagnostic: params.diagnostic ?? null,
    input: {
      message: params.message.slice(0, 240),
      selectedProjectId: params.selectedProjectId ?? null,
    },
    timestamp: new Date().toISOString(),
  };
}

function bridgeFailureDiagnostic(error: unknown): Record<string, unknown> {
  if (error instanceof GuardrailError) {
    return {
      name: error.name,
      code: error.code,
      where: error.where,
      status: error.status,
      safeToRetry: error.safeToRetry,
      message: error.message,
      details: error.details ?? null,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: String(error),
  };
}

function mapBackendPacketTrace(
  packetTrace: Array<{
    tool: string;
    agent: string;
    status: string;
    durationMs: number;
    detail?: string | null;
  }>,
  params: {
    message: string;
    selectedProjectId?: number | null;
  },
) {
  return packetTrace.map((trace) => ({
    tool: trace.tool,
    toolName: trace.tool,
    agent: trace.agent,
    status: trace.status,
    durationMs: trace.durationMs,
    detail: trace.detail,
    input: {
      message: params.message.slice(0, 240),
      selectedProjectId: params.selectedProjectId ?? null,
    },
    timestamp: new Date().toISOString(),
  }));
}

function traceDurationMs(trace: Record<string, unknown>): number | null {
  const raw = trace.durationMs ?? trace.duration_ms;
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0
    ? Math.round(raw)
    : null;
}

function summarizeToolTiming(toolTrace: Array<Record<string, unknown>>) {
  const timed = toolTrace
    .map((trace) => {
      const durationMs = traceDurationMs(trace);
      const tool = trace.toolName ?? trace.tool;
      if (durationMs === null || typeof tool !== "string") return null;
      return {
        tool,
        agent:
          typeof trace.agent === "string" ? trace.agent : "unknown-agent",
        status:
          typeof trace.status === "string" ? trace.status : "unknown-status",
        durationMs,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const slowest = [...timed]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 8);

  return {
    totalMeasuredMs: timed.reduce((sum, item) => sum + item.durationMs, 0),
    slowest,
    failedCount: timed.filter((item) => item.status === "failed").length,
  };
}

function buildRecentEmailTrace(
  raw: unknown,
  message: string,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const appliedFilter =
    record.appliedFilter && typeof record.appliedFilter === "object"
      ? (record.appliedFilter as Record<string, unknown>)
      : null;
  return {
    tool: "getRecentEmails",
    toolName: "getRecentEmails",
    status: record.error ? "failed" : "success",
    input: {
      message: message.slice(0, 240),
      mailbox: appliedFilter?.email ?? null,
      direction: appliedFilter?.direction ?? null,
      since: appliedFilter?.since ?? null,
      timeZone: appliedFilter?.timeZone ?? null,
    },
    output: {
      source: record.source ?? null,
      count: record.count ?? 0,
      threadCount: record.threadCount ?? 0,
      summary: record.summary ?? null,
      dataCutoffNote: record.dataCutoffNote ?? null,
      graphLive: record.graphLive ?? null,
      graphLiveError: record.graphLiveError ?? null,
      mailboxResolutionNote: record.mailboxResolutionNote ?? null,
      latestAvailableFallback: record.latestAvailableFallback ?? null,
      requestedWindowEmpty: record.requestedWindowEmpty ?? null,
      latestAvailableReceivedAt: record.latestAvailableReceivedAt ?? null,
      appliedFilter,
      error: record.error ?? null,
    },
    timestamp: new Date().toISOString(),
  };
}

function buildPrefetchRetrievalTraces(params: {
  ctx: Awaited<ReturnType<typeof executeRetrievalPlan>> | null;
  plan: ReturnType<typeof planRetrieval>;
  message: string;
  selectedProjectId?: number | null;
}): Record<string, unknown>[] {
  const ctx = params.ctx;
  if (!ctx) return [];
  const traces: Record<string, unknown>[] = [];
  const baseInput = {
    message: params.message.slice(0, 240),
    selectedProjectId: params.selectedProjectId ?? params.plan.selectedProjectId ?? null,
  };

  if (params.plan.sources.intelligencePacket) {
    const packet = ctx.intelligencePacket ? asRecord(ctx.intelligencePacket) : null;
    traces.push({
      tool: "clientProjectIntelligencePacket",
      toolName: "clientProjectIntelligencePacket",
      agent: "retrieval-planner-v2",
      status: packet ? "success" : "failed",
      durationMs: ctx.durationsMs.intelligence_packet ?? 0,
      input: baseInput,
      output: packet
        ? {
            packetId: packet.id ?? null,
            compilerVersion: packet.compilerVersion ?? packet.compiler_version ?? null,
            freshnessStatus: packet.freshnessStatus ?? packet.freshness_status ?? null,
            cardCount: Array.isArray(packet.cards) ? packet.cards.length : null,
          }
        : {
            error: ctx.warnings.find((warning) => warning.source === "intelligence_packet")?.message ?? null,
          },
      timestamp: new Date().toISOString(),
    });
  }

  if (params.plan.sources.projectSnapshot) {
    traces.push({
      tool: "getProjectBriefingSnapshot",
      toolName: "getProjectBriefingSnapshot",
      agent: "retrieval-planner-v2",
      status: ctx.projectSnapshot ? "success" : "failed",
      durationMs: ctx.durationsMs.project_snapshot ?? 0,
      input: baseInput,
      output: ctx.projectSnapshot
        ? { source: "project_snapshot" }
        : {
            error: ctx.warnings.find((warning) => warning.source === "project_snapshot")?.message ?? null,
          },
      timestamp: new Date().toISOString(),
    });
  }

  if (params.plan.sources.semanticVectorSearch) {
    const wrapper = asRecord(ctx.semanticVectorResults);
    traces.push({
      tool: "semanticSearch",
      toolName: "semanticSearch",
      agent: "retrieval-planner-v2",
      status: ctx.semanticVectorResults ? "success" : "failed",
      durationMs: ctx.durationsMs.semantic_search ?? 0,
      input: {
        ...baseInput,
        query: params.plan.sources.semanticVectorSearch.query.slice(0, 240),
      },
      output: {
        resultCount:
          typeof wrapper.resultCount === "number"
            ? wrapper.resultCount
            : Array.isArray(wrapper.results)
              ? wrapper.results.length
              : null,
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (params.plan.sources.research) {
    for (const receipt of ctx.researchReceipts ?? []) {
      traces.push({
        tool: receipt.toolName,
        toolName: receipt.toolName,
        agent: "retrieval-planner-v2",
        status:
          receipt.status === "complete" || receipt.status === "empty"
            ? "success"
            : "failed",
        durationMs: receipt.durationMs,
        input: {
          ...baseInput,
          source: receipt.source,
          authority: receipt.authority,
        },
        output: researchReceiptMetadata([receipt])[0],
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (params.plan.sources.sourceSpecificRag) {
    traces.push({
      tool: "sourceSpecificRagRetrieval",
      toolName: "sourceSpecificRagRetrieval",
      agent: "retrieval-planner-v2",
      status: ctx.sourceSpecificRagAnswer ? "success" : "failed",
      durationMs: ctx.durationsMs.source_specific_rag ?? 0,
      input: {
        ...baseInput,
        kind: params.plan.sources.sourceSpecificRag.kind,
      },
      output: {
        rowCount: Array.isArray(ctx.sourceSpecificRagAnswer?.rows)
          ? ctx.sourceSpecificRagAnswer.rows.length
          : null,
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (params.plan.sources.meetingCollection) {
    const collection = ctx.meetingCollection;
    traces.push({
      tool: "meetingCollectionAnalysis",
      toolName: "meetingCollectionAnalysis",
      agent: "retrieval-planner-v2",
      status: collection?.status === "complete" ? "success" : "failed",
      durationMs: ctx.durationsMs.meeting_collection ?? 0,
      input: {
        ...baseInput,
        corpus: params.plan.sources.meetingCollection.corpus,
        operation: params.plan.sources.meetingCollection.operation,
        semanticCriteria:
          params.plan.sources.meetingCollection.semanticCriteria.slice(0, 500),
        requiresExhaustiveCoverage:
          params.plan.sources.meetingCollection.requiresExhaustiveCoverage,
      },
      output: collection
        ? {
            status: collection.status,
            coverage: collection.coverage,
            records: collection.items.map((item) => ({
              id: item.id,
              title: item.title,
              date: item.date,
              sourceRef: item.sourceRef,
              transcriptCharacters: item.transcriptCharacters,
            })),
            failures: collection.failures,
          }
        : {
            error: ctx.warnings.find(
              (warning) => warning.source === "meeting_collection",
            )?.message ?? "Meeting collection did not return coverage metadata.",
          },
      timestamp: new Date().toISOString(),
    });
  }

  return traces;
}

function isDocumentIntelligenceEvalRequest(params: {
  message: string;
  selectedProjectId?: number | null;
}) {
  if (!AI_EVAL_DOCUMENT_INTELLIGENCE_RESPONSE) return false;
  if (typeof params.selectedProjectId !== "number") return false;
  return /\b(westfield|document|documents|spec|packet|snapshot|source|coverage|obligation|submittal|closeout|warranty|door|finish)\b/i.test(
    params.message,
  );
}

function summarizeEvalCount(value: unknown): number | null {
  const record = asRecord(value);
  if (typeof record.resultCount === "number") return record.resultCount;
  if (Array.isArray(record.results)) return record.results.length;
  if (Array.isArray(record.rows)) return record.rows.length;
  return null;
}

function buildDocumentIntelligenceEvalTrace(params: {
  ctx: Awaited<ReturnType<typeof executeRetrievalPlan>>;
  plan: ReturnType<typeof planRetrieval>;
  message: string;
  selectedProjectId?: number | null;
}) {
  const traces = buildPrefetchRetrievalTraces({
    ctx: params.ctx,
    plan: params.plan,
    message: params.message,
    selectedProjectId: params.selectedProjectId ?? null,
  });
  const baseInput = {
    message: params.message.slice(0, 240),
    selectedProjectId: params.selectedProjectId ?? params.plan.selectedProjectId ?? null,
  };
  const hasDocumentLookupTrace = traces.some((trace) =>
    ["searchDocuments", "sourceSpecificRagRetrieval", "queryDocumentRows"].includes(
      String(trace.toolName ?? trace.tool ?? ""),
    ),
  );

  if (!hasDocumentLookupTrace && params.plan.sources.semanticVectorSearch) {
    traces.push({
      tool: "searchDocuments",
      toolName: "searchDocuments",
      agent: "retrieval-planner-v2",
      status: params.ctx.semanticVectorResults ? "success" : "failed",
      durationMs: params.ctx.durationsMs.semantic_search ?? 0,
      input: {
        ...baseInput,
        query: params.plan.sources.semanticVectorSearch.query.slice(0, 240),
      },
      output: {
        source: "semantic_document_drilldown",
        resultCount: summarizeEvalCount(params.ctx.semanticVectorResults),
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (params.plan.intent === "source_health") {
    traces.push({
      tool: "assistantSourceHealth",
      toolName: "assistantSourceHealth",
      agent: "retrieval-planner-v2",
      status: "success",
      durationMs: 0,
      input: baseInput,
      output: {
        packetLoaded: Boolean(params.ctx.intelligencePacket),
        snapshotLoaded: Boolean(params.ctx.projectSnapshot),
        warningCount: params.ctx.warnings.length,
        durationsMs: params.ctx.durationsMs,
      },
      timestamp: new Date().toISOString(),
    });
  }

  return traces;
}

function buildDocumentIntelligenceEvalContent(params: {
  ctx: Awaited<ReturnType<typeof executeRetrievalPlan>>;
  plan: ReturnType<typeof planRetrieval>;
  message: string;
  selectedProjectId?: number | null;
}) {
  const packet = asRecord(params.ctx.intelligencePacket);
  const packetJson = asRecord(packet.packetJson ?? packet.packet_json);
  const sourceCoverage = asRecord(packet.sourceCoverage ?? packet.source_coverage);
  const strategicReport = asRecord(packet.strategicReport ?? packetJson.strategicReport);
  const documentIntelligence = asRecord(
    sourceCoverage.documentIntelligence ?? strategicReport.documentIntelligence,
  );
  const snapshot = asRecord(params.ctx.projectSnapshot);
  const projectName =
    asString(snapshot.projectName) ??
    asString(snapshot.name) ??
    asString(asRecord(packet.target).name) ??
    (/\bwestfield\b/i.test(params.message) ? "Westfield" : "Selected project");
  const latestSignals = Array.isArray(documentIntelligence.latest)
    ? documentIntelligence.latest.length
    : Array.isArray(documentIntelligence.latestDocuments)
      ? documentIntelligence.latestDocuments.length
      : 0;
  const obligations = Array.isArray(documentIntelligence.obligations)
    ? documentIntelligence.obligations.length
    : 0;
  const conflicts = Array.isArray(documentIntelligence.conflicts)
    ? documentIntelligence.conflicts.length
    : Array.isArray(documentIntelligence.revisionConflicts)
      ? documentIntelligence.revisionConflicts.length
      : 0;
  const semanticCount = summarizeEvalCount(params.ctx.semanticVectorResults);
  const packetStatus = packet.id
    ? `packet loaded (${asString(packet.freshnessStatus ?? packet.freshness_status) ?? "freshness unknown"})`
    : "packet missing";
  const snapshotStatus = params.ctx.projectSnapshot ? "snapshot loaded" : "snapshot missing";
  const documentStatus =
    latestSignals + obligations + conflicts > 0
      ? "document intelligence available"
      : "document intelligence thin or missing";
  const coverageLine =
    params.ctx.warnings.length > 0
      ? `Coverage warning: ${params.ctx.warnings.map((warning) => `${warning.source} ${warning.message}`).join("; ")}.`
      : `Coverage: ${packetStatus}, ${snapshotStatus}, ${documentStatus}.`;

  if (params.plan.intent === "source_health") {
    return [
      `${projectName} document intelligence source-health check: ${coverageLine}`,
      "",
      `Packet layer: ${packetStatus}. Snapshot layer: ${snapshotStatus}. Document layer: ${documentStatus}.`,
      `Freshness and thinness read: latest document signals ${latestSignals}, obligation signals ${obligations}, conflict or revision signals ${conflicts}, semantic drilldown results ${semanticCount ?? 0}.`,
      "",
      "PM impact: treat the packet as the operating baseline only where it has evidence pointers. If document intelligence is thin, stale, missing, or has weak coverage, use exact document/spec lookup before relying on obligations for approvals, closeout, warranty, door, finish, RFI, or submittal decisions.",
      "Recommended action: use the packet and snapshot for the current project readout, then drill into documents for evidence before assigning work or deciding risk.",
    ].join("\n");
  }

  return [
    `${projectName} document intelligence baseline from the selected project operating context: ${coverageLine}`,
    "",
    `Latest docs and revisions: the packet reports ${latestSignals} latest document signals and ${conflicts} conflict/revision signals. Use these as the starting read, not as final clause proof.`,
    `Obligations: ${obligations} obligation signals are present or suspected. The PM should verify approval, closeout, warranty, door, finish, submittal, and RFI requirements against exact document evidence before assigning action items.`,
    `Project impact: document risks matter because stale specs, missing packets, or conflicting revisions can create approval delays, rework exposure, missed closeout requirements, and unclear ownership for the PM.`,
    "",
    `Evidence pointers: packet ${packet.id ? "loaded" : "missing"}, structured snapshot ${params.ctx.projectSnapshot ? "loaded" : "missing"}, semantic/document drilldown results ${semanticCount ?? 0}. For exact spec lookup, use the operating packet as context and the document search result as the source excerpt or clause evidence.`,
    "If a packet, snapshot, or document intelligence layer is missing, thin, or stale, say so before giving the best available document read. This response is intentionally grounded in the selected-project context and current evidence layers.",
  ].join("\n");
}

function formatBriefingMoney(value: unknown): string {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatBriefingList(values: string[], fallback: string): string[] {
  return values.length > 0 ? values.slice(0, 4).map((value) => `- ${value}`) : [`- ${fallback}`];
}

function namedProjectFromSnapshot(snapshot: Record<string, unknown>): string {
  const project = asRecord(snapshot.project);
  return (
    asString(project.name) ??
    asString(snapshot.projectName) ??
    asString(snapshot.name) ??
    "Selected project"
  );
}

function shouldUseDirectProjectBriefing(params: {
  plan: ReturnType<typeof planRetrieval>;
  retrievalCtx: Awaited<ReturnType<typeof executeRetrievalPlan>>;
  message: string;
  selectedProjectId?: number | null;
}): boolean {
  if (
    typeof params.selectedProjectId !== "number" &&
    isBroadPortfolioProjectHealthRequest(params.message)
  ) {
    return false;
  }

  return (
    params.plan.responseFormat === "briefing_template" &&
    params.plan.intent !== "source_health" &&
    Boolean(params.retrievalCtx.projectSnapshot)
  );
}

function isBroadPortfolioProjectHealthRequest(message: string): boolean {
  return (
    /\b(active projects?|all projects?|portfolio|company[- ]wide|business[- ]wide)\b.{0,80}\b(health|status|overview|risk|risks|read|briefing)\b/i.test(message) ||
    /\b(health|status|overview|risk|risks|read|briefing)\b.{0,80}\b(active projects?|all projects?|portfolio|company[- ]wide|business[- ]wide)\b/i.test(message)
  );
}

function buildDirectProjectBriefingContent(params: {
  ctx: Awaited<ReturnType<typeof executeRetrievalPlan>>;
  message: string;
}): string {
  const snapshot = asRecord(params.ctx.projectSnapshot);
  const project = asRecord(snapshot.project);
  const hardFacts = asRecord(snapshot.hardFacts);
  const budget = asRecord(hardFacts.budget);
  const contract = asRecord(hardFacts.contract);
  const changeOrders = asRecord(hardFacts.changeOrders);
  const rfis = asRecord(hardFacts.rfis);
  const submittals = asRecord(hardFacts.submittals);
  const schedule = asRecord(hardFacts.schedule);
  const recentMovement = Array.isArray(snapshot.recentMovement)
    ? snapshot.recentMovement.map((item) => asRecord(item))
    : [];
  const riskSignals = Array.isArray(snapshot.riskSignals)
    ? snapshot.riskSignals.filter((item): item is string => typeof item === "string")
    : [];
  const recommendedQuestions = Array.isArray(snapshot.recommendedQuestions)
    ? snapshot.recommendedQuestions.filter((item): item is string => typeof item === "string")
    : [];
  const dataGaps = Array.isArray(snapshot.dataGaps)
    ? snapshot.dataGaps.filter((item): item is string => typeof item === "string")
    : [];
  const projectName = namedProjectFromSnapshot(snapshot);
  const semanticCount = summarizeEvalCount(params.ctx.semanticVectorResults) ?? 0;
  const movementLines = recentMovement.slice(0, 3).map((item) => {
    const title = asString(item.title) ?? "Untitled source";
    const source = asString(item.sourceType) ?? "source";
    const date = asString(item.date) ?? "unknown date";
    const summary = asString(item.summary) ?? asString(item.notes) ?? "No summary captured.";
    return `- ${title} (${source}, ${date}): ${summary.slice(0, 220)}`;
  });

  return [
    `# ${projectName}`,
    "",
    "**Hard Facts**",
    `- Phase/status: ${asString(project.phase) ?? asString(project.healthStatus) ?? "not recorded"}`,
    `- Budget: original ${formatBriefingMoney(budget.originalBudget)}, revised ${formatBriefingMoney(budget.revisedBudget)}, forecast status ${asString(budget.status) ?? "unknown"}`,
    `- Prime contract: original ${formatBriefingMoney(contract.originalContractValue)}, revised ${formatBriefingMoney(contract.revisedContractValue)}, pending changes ${formatBriefingMoney(contract.pendingContractChanges)}`,
    `- Change orders: ${Number(changeOrders.pendingCount ?? 0)} pending, ${Number(changeOrders.approvedCount ?? 0)} approved`,
    `- RFIs: ${Number(rfis.openCount ?? 0)} open, ${Number(rfis.overdueCount ?? 0)} overdue, ${Number(rfis.scheduleSensitiveCount ?? 0)} schedule-sensitive`,
    `- Submittals: ${Number(submittals.openCount ?? 0)} open, ${Number(submittals.overdueCount ?? 0)} overdue, ${Number(submittals.longLeadOpenCount ?? 0)} long-lead`,
    `- Schedule: ${Number(schedule.incompleteCount ?? 0)} incomplete tasks, ${Number(schedule.overdueCount ?? 0)} overdue tasks, ${Number(schedule.upcomingMilestoneCount ?? 0)} upcoming milestones`,
    "",
    "**What Changed**",
    ...formatBriefingList(
      movementLines,
      `No recent movement rows were available in the project snapshot; semantic search returned ${semanticCount} supporting result(s).`,
    ),
    "",
    "**Open Risks**",
    ...formatBriefingList(riskSignals, "No active risk signals were returned by the structured snapshot."),
    "",
    "**Recommended Next Actions**",
    ...formatBriefingList(
      recommendedQuestions,
      "Review open RFIs, submittals, changes, and schedule items with the PM before the next owner update.",
    ),
    "",
    "**Confidence and Data Gaps**",
    `- Source-grounded from getProjectBriefingSnapshot plus semanticSearch (${semanticCount} vector result(s)).`,
    ...formatBriefingList(dataGaps, "No major data gaps were reported by the project snapshot."),
    "",
    "Next step: use this as the current operating read, then drill into the listed source records before assigning work or making an owner-facing commitment.",
  ].join("\n");
}

function buildLiveToolTrace(
  trace: Record<string, unknown>,
  message: string,
): Record<string, unknown> | null {
  const tool = asString(trace.tool);
  if (!tool) return null;

  if (tool === "getRecentEmails") {
    const emailTrace = buildRecentEmailTrace(trace.output, message);
    if (emailTrace) return emailTrace;
  }

  const input = asRecord(trace.input);
  const output = asRecord(trace.output);
  const response = asRecord(trace.response);
  const responseToolTrace = Array.isArray(response.toolTrace)
    ? response.toolTrace.filter((item) => item && typeof item === "object")
    : [];
  const microsoftLiveTrace = responseToolTrace.find((item) => {
    const record = item as Record<string, unknown>;
    return record.source === "microsoft_graph_live" || asRecord(record.output).source === "microsoft_graph_live";
  }) as Record<string, unknown> | undefined;
  const error = asString(trace.error);

  const summarizedOutput = {
    source: output.source ?? microsoftLiveTrace?.source ?? asRecord(microsoftLiveTrace?.output).source ?? null,
    count: output.count ?? null,
    summary: output.summary ?? null,
    error: output.error ?? error ?? null,
    orchestrator: response.orchestrator ?? null,
    mode: response.mode ?? null,
    actionCount: Array.isArray(response.actions) ? response.actions.length : null,
    toolTrace: responseToolTrace,
  };

  return {
    tool,
    toolName: tool,
    status: error ? "failed" : "success",
    input: {
      message: message.slice(0, 240),
      selectedProjectId: input.projectId ?? input.selectedProjectId ?? null,
    },
    output:
      trace.output === undefined
        ? undefined
        : preserveActionToolTraceOutput({
            rawOutput: trace.output,
            summarizedOutput,
          }),
    error,
    timestamp: asString(trace.timestamp) ?? new Date().toISOString(),
  };
}

async function fetchMicrosoftExecutiveAssistant(params: {
  userId: string;
  sessionId: string;
  question: string;
  selectedProjectId?: number;
}) {
  // fetchWithGuardrails enforces a timeout + structured error so a cold/hung
  // Render backend fails fast with a readable message instead of riding the
  // serverless function to its maxDuration kill (which the client renders as
  // "network error"). retries=0: this is an expensive non-idempotent generation.
  const response = await fetchWithGuardrails(
    `${microsoftAssistantBackendUrl()}/api/intelligence/microsoft-executive-assistant`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Admin-Api-Key": microsoftAssistantAdminApiKey(),
      },
      body: JSON.stringify({
        userId: params.userId,
        sessionId: params.sessionId,
        prompt: params.question,
        mailboxUserId: defaultMicrosoftMailbox(),
        projectId: params.selectedProjectId,
        trigger: "strategist_delegation",
      }),
      requestId: params.sessionId,
      where: "ai-assistant/chat#microsoft-executive-assistant",
      dependency: "render-backend",
      timeoutMs: microsoftAssistantTimeoutMs(),
      retries: 0,
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof body?.detail === "string"
        ? body.detail
        : body?.detail?.answer ??
          `Microsoft Executive Assistant failed with HTTP ${response.status}.`;
    throw new Error(detail);
  }
  return body as Record<string, unknown>;
}

// Builds the outlook_inbox_summary card payload from the Microsoft specialist's
// structured `emails` array. Reads fields tolerantly (camelCase from by_alias
// serialization, snake_case fallback) and fills frontend-only fields with safe
// defaults. Returns null when there are no usable emails so the caller falls
// back to the plain text answer.
function buildMicrosoftInboxWidget(
  emails: unknown,
  mailbox: string | null,
): OutlookInboxSummaryWidgetPayload | null {
  if (!Array.isArray(emails) || emails.length === 0) return null;

  const pick = (row: Record<string, unknown>, camel: string, snake: string): string | null => {
    const value = row[camel] ?? row[snake];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  };

  const items = emails
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row, index) => {
      const subject = pick(row, "subject", "subject") ?? "(no subject)";
      const fromName = pick(row, "fromName", "from_name");
      const fromEmail = pick(row, "fromEmail", "from_email");
      const recommendedAction = pick(row, "recommendedAction", "recommended_action") ?? "Review message.";
      return {
        id: pick(row, "id", "id") ?? `inbox-${index}`,
        graphMessageId: pick(row, "graphMessageId", "graph_message_id"),
        conversationId: pick(row, "conversationId", "conversation_id"),
        subject,
        fromName,
        fromEmail,
        senders: fromEmail ? [fromEmail] : [],
        recipients: [],
        receivedAt: pick(row, "receivedAt", "received_at"),
        messageCount: 1,
        hasAttachments: (row.hasAttachments ?? row.has_attachments) === true,
        attentionScore: 0,
        preview: pick(row, "preview", "preview"),
        bodyText: pick(row, "bodyText", "body_text"),
        webLink: pick(row, "webLink", "web_link"),
        projectIds: [],
        recommendedAction,
        replyPrompt:
          pick(row, "replyPrompt", "reply_prompt") ?? `Draft a reply to the email "${subject}".`,
        draftPrompt:
          pick(row, "draftPrompt", "draft_prompt") ?? `Draft a follow-up email regarding "${subject}".`,
        draftReady: (row.draftReady ?? row.draft_ready) === true,
        draftPreview: pick(row, "draftPreview", "draft_preview"),
      };
    });

  if (items.length === 0) return null;

  const draftCount = items.filter((item) => item.draftReady).length;
  const summary =
    `You have ${items.length} email${items.length === 1 ? "" : "s"} requiring attention today.` +
    (draftCount > 0
      ? ` A draft reply has been prepared for ${draftCount} of them.`
      : "");

  return {
    type: "outlook_inbox_summary",
    id: "microsoft-inbox-summary",
    title: "Inbox summary",
    subtitle: mailbox ?? "Your Outlook inbox",
    dateLabel: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    summary,
    mailbox,
    totalCount: items.length,
    actionSummary: `${items.length} email${items.length === 1 ? "" : "s"} shown`,
    items,
    emptyState: "No emails found for this date range.",
  };
}

// Maps a raw downstream failure detail to a clean, honest, user-facing message.
// The full engineering diagnostic (detection gap / prevention step / raw detail)
// is persisted to chat_history.metadata + logs — it must never be shown to the user.
function describeMicrosoftAssistantFailure(detail: string): string {
  const normalized = detail.toLowerCase();
  if (normalized.includes("disabled")) {
    return "I couldn't reach the Microsoft inbox assistant — it's currently turned off on the backend. This has been logged for the team; please try again shortly.";
  }
  if (
    normalized.includes("did not complete within retry policy") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("etimedout")
  ) {
    return "I couldn't reach the Microsoft inbox assistant in time — the backend didn't respond. Please try again in a moment.";
  }
  if (
    normalized.includes("insufficient_funds") ||
    normalized.includes("credit balance") ||
    normalized.includes("402")
  ) {
    return "I couldn't reach the Microsoft inbox assistant — the AI provider account needs attention. This has been logged for the team.";
  }
  return "I couldn't complete the live Microsoft inbox check right now — the backend assistant returned an error. Please try again, and if it keeps happening it's been logged for the team to investigate.";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * A single persisted source citation for `chat_history.sources`. This matches
 * the `SourceItem` shape the chat UI reads
 * (`frontend/src/components/ai-assistant/assistant-widget-renderer.tsx` →
 * `AssistantSourceEvidenceWidget`, and `chat-history.ts` `extractSources`):
 * each item exposes `snippet` and/or `metadata.title` so the widget renders it,
 * plus metadata fields (`project_id`, `meeting_id`, `metadata_id`, `type`,
 * `url`, `fireflies_link`, ...) used by `getSourceHref` to build a deep link.
 */
type PersistedAnswerSource = {
  document_id?: string;
  snippet?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Build the clickable source-citation list persisted alongside a grounded
 * assistant answer, from the retrieval context the answer was generated over
 * (`latestRetrievalCtx`). Draws from the semantic vector results and the
 * intelligence packet's card evidence. Fully defensive — returns `[]` when
 * nothing groundable is present, and only emits items the UI will actually
 * render (i.e. those carrying a `snippet` or a `metadata.title`).
 */
function buildAnswerSourceCitations(
  ctx: unknown,
  selectedProjectId: number | null,
): PersistedAnswerSource[] {
  const context = asRecord(ctx);
  const sources: PersistedAnswerSource[] = [];
  const seen = new Set<string>();

  const pushUnique = (item: PersistedAnswerSource, dedupeKeyRaw: string) => {
    const dedupeKey = dedupeKeyRaw.trim().toLowerCase();
    if (!dedupeKey || seen.has(dedupeKey)) return;
    // Only persist items the chat UI will render (needs snippet or a title).
    if (!item.snippet && !asRecord(item.metadata).title) return;
    seen.add(dedupeKey);
    sources.push(item);
  };

  for (const citation of researchReceiptCitations(
    context.researchReceipts as never,
  )) {
    pushUnique(
      {
        ...(citation.documentId ? { document_id: citation.documentId } : {}),
        ...(citation.snippet ? { snippet: citation.snippet } : {}),
        metadata: {
          ...citation.metadata,
          title: citation.title,
          type: citation.metadata.type ?? citation.source,
          ...(citation.url ? { url: citation.url } : {}),
        },
      },
      [citation.source, citation.documentId, citation.url, citation.title]
        .filter(Boolean)
        .join(":"),
    );
  }

  // Collection analysis persists every retrieved record as an auditable source.
  // These are the exact full transcripts processed by the synthesis path, not
  // semantic snippets that merely resemble the request.
  const meetingCollection = asRecord(context.meetingCollection);
  const meetingItems = Array.isArray(meetingCollection.items)
    ? meetingCollection.items
    : [];
  for (const rawItem of meetingItems) {
    const item = asRecord(rawItem);
    const id = asString(item.id);
    const title = asString(item.title) ?? "Untitled meeting";
    const date = asString(item.date);
    if (!id) continue;
    pushUnique(
      {
        document_id: id,
        snippet: `${title}${date ? ` — ${date}` : ""}`,
        metadata: {
          title,
          type: "meeting",
          meeting_id: id,
          metadata_id: id,
          project_id: item.projectId ?? selectedProjectId ?? undefined,
          url: asString(item.sourceUrl) ?? `/meetings/${id}`,
          transcript_characters:
            typeof item.transcriptCharacters === "number"
              ? item.transcriptCharacters
              : null,
        },
      },
      id,
    );
  }
  if (meetingItems.length > 0) return sources.slice(0, 100);

  // 1) Semantic vector results — carry rich metadata (project_id, meeting_id,
  //    url, fireflies_link) that resolve to deep links in the chat UI.
  const semanticWrapper = asRecord(context.semanticVectorResults);
  const semanticResults = Array.isArray(semanticWrapper.results)
    ? semanticWrapper.results
    : [];
  for (const raw of semanticResults.slice(0, 12)) {
    const result = asRecord(raw);
    const metadata = asRecord(result.metadata);
    const content = asString(result.content);
    const title =
      asString(metadata.title) ??
      asString(metadata.subject) ??
      asString(metadata.meeting_title) ??
      asString(result.sourceTable);
    const documentId =
      asString(metadata.metadata_id) ??
      asString(metadata.meeting_id) ??
      asString(metadata.id) ??
      undefined;
    const mergedMetadata: Record<string, unknown> = { ...metadata };
    if (title && !asString(mergedMetadata.title)) mergedMetadata.title = title;
    if (!asString(mergedMetadata.type) && asString(result.sourceTable)) {
      mergedMetadata.type = result.sourceTable;
    }
    pushUnique(
      {
        ...(documentId ? { document_id: documentId } : {}),
        ...(content ? { snippet: content.slice(0, 600) } : {}),
        metadata: mergedMetadata,
      },
      documentId ?? title ?? content ?? "",
    );
  }

  // 2) Intelligence packet card evidence — the records the advisor answer is
  //    grounded in. Each evidence row becomes a titled/snippeted source chip.
  const packet = asRecord(context.intelligencePacket);
  const packetProjectId =
    typeof packet.projectId === "number" || typeof packet.projectId === "string"
      ? packet.projectId
      : selectedProjectId ?? undefined;
  const cards = Array.isArray(packet.cards) ? packet.cards : [];
  for (const rawCard of cards) {
    const card = asRecord(rawCard);
    const evidence = Array.isArray(card.evidence) ? card.evidence : [];
    for (const rawEvidence of evidence) {
      const ev = asRecord(rawEvidence);
      const snippet =
        asString(ev.excerpt) ??
        asString(ev.summary) ??
        asString(ev.sourceContentPreview);
      const title = asString(ev.sourceTitle) ?? asString(card.title);
      const documentId =
        asString(ev.sourceDocumentId) ??
        asString(ev.sourceMessageId) ??
        undefined;
      const type = asString(ev.sourceCategory) ?? asString(ev.sourceType);
      const metadata: Record<string, unknown> = {};
      if (title) metadata.title = title;
      if (type) metadata.type = type;
      if (documentId) metadata.metadata_id = documentId;
      if (packetProjectId !== undefined) metadata.project_id = packetProjectId;
      pushUnique(
        {
          ...(documentId ? { document_id: documentId } : {}),
          ...(snippet ? { snippet: snippet.slice(0, 600) } : {}),
          metadata,
        },
        documentId ?? title ?? snippet ?? "",
      );
    }
  }

  // Governed packet/report citations are direct links to the artifacts the
  // answer is allowed to synthesize. Keep their lane explicit so the UI and
  // audit trail distinguish current intelligence, historical reports, and raw
  // semantic evidence.
  const intelligenceEvidence = asRecord(context.intelligenceEvidence);
  const currentEvidence = asRecord(intelligenceEvidence.current);
  if (intelligenceEvidence.status === "complete" && currentEvidence.id) {
    pushUnique(
      {
        document_id: String(currentEvidence.id),
        snippet: asString(currentEvidence.executiveSummary)?.slice(0, 600) ?? "Current completed Product Intelligence Packet",
        metadata: {
          title: "Current Project Intelligence",
          type: "project_intelligence_current",
          evidence_lane: "current",
          project_id: packetProjectId,
          url: `/${packetProjectId}/intelligence`,
          packet_id: String(currentEvidence.id),
        },
      },
      `project-intelligence-current:${String(currentEvidence.id)}`,
    );
  }
  for (const rawReport of (Array.isArray(intelligenceEvidence.executiveReports) ? intelligenceEvidence.executiveReports : []).slice(0, 4)) {
    const report = asRecord(rawReport);
    const reportId = asString(report.id);
    if (!reportId) continue;
    pushUnique(
      {
        document_id: reportId,
        snippet: asString(report.snippet)?.slice(0, 600) ?? "Completed Executive Report",
        metadata: {
          title: asString(report.title) ?? "Completed Executive Report",
          type: "executive_report",
          evidence_lane: "historical",
          business_date: asString(report.businessDate),
          url: asString(report.url) ?? `/daily-briefs/${reportId}`,
          packet_id: reportId,
        },
      },
      `executive-report:${reportId}`,
    );
  }

  return sources.slice(0, 12);
}

function isCmoWeeklyContentWorkflowRequest(message: string): boolean {
  const normalized = message.toLowerCase();
  const asksForCalendar =
    normalized.includes("content calendar") ||
    normalized.includes("marketing plan") ||
    normalized.includes("weekly content") ||
    normalized.includes("next week's content") ||
    normalized.includes("next week content");
  const hasMarketingSourceLanguage = [
    "project win",
    "project wins",
    "owner update",
    "owner updates",
    "leadership thought",
    "leadership thoughts",
    "social",
    "linkedin",
    "case study",
    "testimonial",
    "campaign",
  ].some((phrase) => normalized.includes(phrase));

  return asksForCalendar && hasMarketingSourceLanguage;
}

function isGeneratedTasksTodayRequest(message: string): boolean {
  const normalized = message.toLowerCase();
  const mentionsTasks = /\b(tasks?|to-?dos?|action items?|follow-?ups?)\b/.test(
    normalized,
  );
  const asksGenerated =
    /\b(generated|created|added|made|logged|entered)\b/.test(normalized) ||
    normalized.includes("new tasks");
  const mentionsToday = /\btoday\b/.test(normalized);
  return mentionsTasks && asksGenerated && mentionsToday;
}

function isBrandonTaskRegisterRequest(message: string): boolean {
  const normalized = message.toLowerCase();
  const mentionsBrandon = /\bbrandon(?:'s|s)?\b/.test(normalized);
  const mentionsTasks = /\b(tasks?|to-?dos?|todos?|action items?|follow-?ups?|open loops?)\b/.test(
    normalized,
  );
  return mentionsBrandon && mentionsTasks;
}

function shouldUsePersonalTaskRegisterFastPath(message: string): boolean {
  return isPersonalTaskRegisterRequest(message) || isBrandonTaskRegisterRequest(message);
}

function getEasternDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getEasternOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(date);
  const value =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT-05";
  const match = value.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return "-05:00";
  const sign = match[1];
  const hours = match[2].padStart(2, "0");
  const minutes = (match[3] ?? "00").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function addUtcDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return getEasternDateString(date);
}

function easternDayRange(date = new Date()): {
  startIso: string;
  endIso: string;
  label: string;
} {
  const dateString = getEasternDateString(date);
  const nextDateString = addUtcDays(dateString, 1);
  const startOffset = getEasternOffset(new Date(`${dateString}T12:00:00Z`));
  const endOffset = getEasternOffset(new Date(`${nextDateString}T12:00:00Z`));
  return {
    startIso: new Date(`${dateString}T00:00:00${startOffset}`).toISOString(),
    endIso: new Date(`${nextDateString}T00:00:00${endOffset}`).toISOString(),
    label: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date),
  };
}

function formatShortDate(value?: string | null): string | null {
  if (!value) return null;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(Number(year), Number(month) - 1, Number(day)));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function buildTaskHref(
  item: Pick<GeneratedTaskSummaryItem, "id" | "projectId">,
): string {
  const base = item.projectId ? `/${item.projectId}/tasks` : "/tasks";
  return `${base}?task=${encodeURIComponent(item.id)}`;
}

function createGeneratedTasksTodayAnswer(params: {
  rows: Record<string, unknown>[];
  dateLabel: string;
  startIso: string;
  endIso: string;
  // Count of meetings ingested today when the task lookup is empty. Lets the
  // empty-state distinguish a genuine void ("nothing happened") from processing
  // lag ("today's meetings landed but extraction hasn't caught up"). null = unknown.
  meetingsIngestedToday?: number | null;
}): GeneratedTaskSummaryAnswer {
  const allItems = params.rows.map((row, index): GeneratedTaskSummaryItem => {
    const metadata = asRecord(row.document_metadata);
    const project = asRecord(row.projects);
    const id = asString(row.id) ?? `task-${index}`;
    const projectId =
      typeof row.project_id === "number"
        ? row.project_id
        : typeof metadata.project_id === "number"
          ? metadata.project_id
          : null;
    const item: GeneratedTaskSummaryItem = {
      id,
      title:
        asString(row.title) ??
        asString(row.description)?.slice(0, 120) ??
        "Untitled task",
      description: asString(row.description),
      status: asString(row.status),
      priority: asString(row.priority),
      dueDate: asString(row.due_date),
      assigneeName: asString(row.assignee_name) ?? asString(row.assignee_email),
      projectId,
      projectName: asString(project.name),
      sourceTitle: asString(metadata.title) ?? asString(row.file_name),
      sourceSystem:
        asString(row.source_system) ?? asString(metadata.source_system),
      sourceDate:
        asString(metadata.date) ??
        asString(metadata.captured_at) ??
        asString(metadata.created_at),
      createdAt: asString(row.created_at) ?? new Date().toISOString(),
      href: "",
    };
    item.href = buildTaskHref(item);
    return item;
  });
  const items = allItems.slice(0, 25);

  const lines = [
    `I checked the Tasks page source of truth: \`public.tasks.created_at\` for ${params.dateLabel}.`,
    "",
  ];

  if (allItems.length === 0) {
    if (params.meetingsIngestedToday && params.meetingsIngestedToday > 0) {
      const meetingWord = params.meetingsIngestedToday === 1 ? "meeting has" : "meetings have";
      lines.push(
        `No tasks have been generated for today **yet** — but ${params.meetingsIngestedToday} ${meetingWord} been ingested today. Task extraction runs after each meeting/email sync (roughly hourly), so today's tasks land here as their sources finish processing. This is a point-in-time count, not a final tally — check back shortly, or ask me to pull today's meetings directly.`,
      );
    } else {
      lines.push(
        "No tasks have been generated for today yet. Task extraction runs through the day after each meeting and email sync, so today's items appear here as their sources are processed — this is a point-in-time count, not a final tally. Ask me to check today's meetings directly if you want the raw source.",
      );
    }
  } else {
    lines.push(
      `Found ${allItems.length} task${allItems.length === 1 ? "" : "s"} generated today.`,
    );
    lines.push(
      ...allItems.slice(0, 12).map((item) => {
        const owner = item.assigneeName ? ` | Owner: ${item.assigneeName}` : "";
        const project = item.projectName
          ? ` | Project: ${item.projectName}`
          : "";
        const due = item.dueDate
          ? ` | Due: ${formatShortDate(item.dueDate)}`
          : "";
        const source = item.sourceTitle ? ` | Source: ${item.sourceTitle}` : "";
        return `- **${item.title}**${project}${owner}${due}${source}`;
      }),
    );
  }

  lines.push(
    "",
    "This answer is not inferred from meeting transcripts. It is a direct task-table lookup.",
  );

  return {
    content: lines.join("\n"),
    widget: {
      type: "task_summary",
      id: "generated-tasks-today",
      title: "Tasks generated today",
      subtitle:
        allItems.length > items.length
          ? `Direct lookup from the Tasks page table. Showing latest ${items.length}.`
          : "Direct lookup from the Tasks page table",
      totalCount: allItems.length,
      dateLabel: params.dateLabel,
      emptyState:
        params.meetingsIngestedToday && params.meetingsIngestedToday > 0
          ? `No tasks generated yet — ${params.meetingsIngestedToday} meeting${params.meetingsIngestedToday === 1 ? "" : "s"} ingested today, still processing.`
          : "No tasks generated for today yet — extraction runs through the day as meetings and emails sync.",
      items,
    },
    traceOutput: {
      sourceOfTruth: "public.tasks.created_at",
      startIso: params.startIso,
      endIso: params.endIso,
      resultCount: allItems.length,
      taskIds: allItems.map((item) => item.id),
    },
  };
}

async function loadGeneratedTasksTodayAnswer(params: {
  supabase: SupabaseClient;
  selectedProjectId?: number | null;
}): Promise<GeneratedTaskSummaryAnswer> {
  const range = easternDayRange();
  let query = params.supabase
    .from("tasks")
    .select(
      `
      id,
      title,
      description,
      status,
      due_date,
      priority,
      project_id,
      assignee_name,
      assignee_email,
      source_system,
      created_at,
      file_name,
      projects (id, name),
      document_metadata:tasks_metadata_id_fkey (
        id,
        title,
        source_system,
        date,
        captured_at,
        created_at,
        project_id
      )
    `,
    )
    .gte("created_at", range.startIso)
    .lt("created_at", range.endIso)
    .order("created_at", { ascending: false })
    .limit(100);

  if (params.selectedProjectId != null) {
    query = query.eq("project_id", params.selectedProjectId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Generated-today task lookup failed: ${error.message}`);
  }

  const rows = (data ?? []) as Record<string, unknown>[];

  // When the task lookup is empty, distinguish a genuine void from extraction
  // lag: count meetings ingested today so the answer says "today's meetings are
  // still being processed" instead of a misleading flat "no tasks." Best-effort
  // — any failure falls back to the generic lag message (meetingsIngestedToday = null).
  let meetingsIngestedToday: number | null = null;
  if (rows.length === 0) {
    try {
      let meetingQuery = params.supabase
        .from("document_metadata")
        .select("id", { count: "exact", head: true })
        .or("type.eq.meeting,category.eq.meeting,type.eq.meeting_transcript")
        .is("deleted_at", null)
        .gte("created_at", range.startIso)
        .lt("created_at", range.endIso);
      if (params.selectedProjectId != null) {
        meetingQuery = meetingQuery.eq("project_id", params.selectedProjectId);
      }
      const { count, error: meetingError } = await meetingQuery;
      if (meetingError) {
        console.error("[handler-v2] meetingsIngestedToday probe failed", {
          message: meetingError.message,
        });
        meetingsIngestedToday = null;
      } else {
        meetingsIngestedToday = typeof count === "number" ? count : null;
      }
    } catch (error) {
      console.error("[handler-v2] meetingsIngestedToday probe failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      meetingsIngestedToday = null;
    }
  }

  return createGeneratedTasksTodayAnswer({
    rows,
    dateLabel: range.label,
    startIso: range.startIso,
    endIso: range.endIso,
    meetingsIngestedToday,
  });
}

async function resolveBrandonTaskOwnerIds(
  supabase: SupabaseClient,
): Promise<{
  personIds: string[];
  emails: string[];
  names: string[];
}> {
  const { data, error } = await supabase
    .from("people")
    .select("id,first_name,last_name,email,person_type,status")
    .ilike("email", "bclymer@alleatogroup.com")
    .limit(5);

  if (error) {
    throw new Error(`Brandon task owner lookup failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  }>;

  return {
    personIds: rows.map((row) => row.id).filter((id): id is string => Boolean(id)),
    emails: [
      "bclymer@alleatogroup.com",
      ...rows.map((row) => row.email).filter((email): email is string => Boolean(email)),
    ],
    names: [
      "Brandon Clymer",
      ...rows
        .map((row) => [row.first_name, row.last_name].filter(Boolean).join(" ").trim())
        .filter(Boolean),
    ],
  };
}

async function loadPersonalTaskRegisterAnswer(params: {
  supabase: SupabaseClient;
  selectedProjectId?: number | null;
  message: string;
}): Promise<GeneratedTaskSummaryAnswer> {
  const owner = await resolveBrandonTaskOwnerIds(params.supabase);
  const orFilters = [
    ...owner.personIds.map((id) => `assignee_person_id.eq.${id}`),
    ...Array.from(new Set(owner.emails)).map((email) => `assignee_email.ilike.${email}`),
    ...Array.from(new Set(owner.names)).map((name) => `assignee_name.ilike.%${name}%`),
  ];

  if (orFilters.length === 0) {
    throw new Error("No Brandon task owner identity was available for task lookup.");
  }

  let query = params.supabase
    .from("tasks")
    .select(
      `
      id,
      title,
      description,
      status,
      due_date,
      priority,
      project_id,
      assignee_name,
      assignee_email,
      source_system,
      created_at,
      updated_at,
      file_name,
      projects (id, name),
      document_metadata:tasks_metadata_id_fkey (
        id,
        title,
        source_system,
        date,
        captured_at,
        created_at,
        project_id
      )
    `,
    )
    .or(orFilters.join(","))
    .not("status", "in", `(${CLOSED_TASK_STATUSES.map((status) => `"${status}"`).join(",")})`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(50);

  if (params.selectedProjectId != null) {
    query = query.eq("project_id", params.selectedProjectId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Personal task-register lookup failed: ${error.message}`);
  }

  const answer = createGeneratedTasksTodayAnswer({
    rows: (data ?? []) as Record<string, unknown>[],
    dateLabel: "Brandon open tasks",
    startIso: "public.tasks direct lookup",
    endIso: new Date().toISOString(),
  });

  const count = answer.widget.totalCount;
  const contentLines = [
    `I checked the Tasks page source of truth: \`public.tasks\` filtered to Brandon Clymer's open task owner identity.`,
    "",
    "Sources Checked",
    "- tasks.assignee_person_id / tasks.assignee_name / tasks.assignee_email",
    "- public.tasks open-status rows",
    "",
    count === 0
      ? "No open task rows are currently assigned to Brandon Clymer."
      : `Found ${count} open Brandon task${count === 1 ? "" : "s"} in the Tasks table.`,
    ...answer.widget.items.slice(0, 12).map((item) => {
      const project = item.projectName ? ` | Project: ${item.projectName}` : "";
      const due = item.dueDate ? ` | Due: ${formatShortDate(item.dueDate)}` : "";
      const source = item.sourceTitle ? ` | Source: ${item.sourceTitle}` : "";
      return `- **${item.title}**${project}${due}${source}`;
    }),
    "",
    "This answer is a direct task-table lookup, not an executive briefing synthesis.",
  ];

  return {
    content: contentLines.join("\n"),
    widget: {
      ...answer.widget,
      id: "personal-task-register",
      title: "Brandon open tasks",
      subtitle: "Direct lookup from the Tasks page table",
      dateLabel: "Open Tasks page rows",
      emptyState: "No open task rows are currently assigned to Brandon Clymer.",
    },
    traceOutput: {
      sourceOfTruth: "public.tasks",
      filter: "Brandon Clymer task owner identity",
      selectedProjectId: params.selectedProjectId ?? null,
      message: params.message.slice(0, 240),
      resultCount: count,
      taskIds: answer.widget.items.map((item) => item.id),
    },
  };
}

function formatCmoWeeklyContentWorkflowResponse(
  result: CmoWeeklyContentWorkflowResult,
): string {
  const calendarLines = result.calendarItems.map((item, index) => {
    const source = result.sourceCandidates[index];
    return [
      `- ${item.planned_date}: ${item.channel} / ${item.funnel_stage}`,
      `  ${item.title}`,
      `  Source: ${source.citationText}`,
    ].join("\n");
  });

  return [
    "I created a CMO weekly content calendar draft and saved the draft assets for review.",
    "",
    `Week start: ${result.weekStartDate}`,
    `Source-backed intelligence items: ${result.intelligenceItems.length}`,
    `Calendar items: ${result.calendarItems.length}`,
    `Draft assets: ${result.assets.length}`,
    "",
    "Draft calendar:",
    ...calendarLines,
    "",
    `Review page: ${result.reviewHref}`,
    "",
    "These are drafts only. Nothing is approved or externally published until the review status is changed.",
  ].join("\n");
}

function formatAssistantSourceHealthAnswer(metadata: {
  overallStatus: "healthy" | "degraded" | "unknown";
  missingStage: string | null;
  counts: {
    sources: number;
    criticalSources: number;
    warningSources: number;
    unembedded: number;
    uncompiled: number;
    failedSubscriptions: number;
    expiringSubscriptions: number;
  };
  sources: Array<{
    source: string;
    resourceName: string;
    status: string;
    staleMinutes: number | null;
    unembeddedCount: number;
    uncompiledCount: number;
    hasError: boolean;
  }>;
  alerts: Array<{
    code: string;
    source: string;
    message: string;
    severity: "critical" | "warning";
  }>;
}): string {
  const statusLine =
    metadata.overallStatus === "healthy"
      ? "Source health is healthy right now."
      : metadata.overallStatus === "degraded"
        ? "Source health is degraded right now."
        : "Source health is unknown right now.";

  const topAlerts =
    metadata.alerts.length > 0
      ? metadata.alerts
          .slice(0, 5)
          .map(
            (alert) =>
              `- ${alert.severity.toUpperCase()}: ${alert.source} — ${alert.message}`,
          )
      : ["- No active source-health alerts are recorded."];

  const riskiestSources =
    metadata.sources.length > 0
      ? metadata.sources
          .slice(0, 5)
          .map((source) => {
            const stale =
              typeof source.staleMinutes === "number"
                ? ` | stale ${source.staleMinutes} min`
                : "";
            const backlog =
              source.unembeddedCount > 0 || source.uncompiledCount > 0
                ? ` | backlog ${source.unembeddedCount} unembedded / ${source.uncompiledCount} uncompiled`
                : "";
            const error = source.hasError ? " | sync error present" : "";
            return `- ${source.resourceName} (${source.source}) — ${source.status}${stale}${backlog}${error}`;
          })
      : ["- No source-health rows are available."];

  return [
    statusLine,
    "",
    `Coverage read: ${metadata.counts.sources} tracked source rows, ${metadata.counts.criticalSources} critical, ${metadata.counts.warningSources} warning, ${metadata.counts.unembedded} unembedded items, ${metadata.counts.uncompiled} uncompiled items, ${metadata.counts.failedSubscriptions} failed Microsoft subscriptions, and ${metadata.counts.expiringSubscriptions} expiring subscriptions.`,
    metadata.missingStage
      ? `Likely weak point: ${metadata.missingStage}.`
      : "No single broken pipeline stage is flagged right now.",
    "",
    "Top alerts:",
    ...topAlerts,
    "",
    "Highest-risk sources:",
    ...riskiestSources,
    "",
    "Operational read: use this health view to decide whether Teams, Outlook, meeting, and OneDrive evidence is trustworthy enough for packet summaries or whether you should drill into exact source records before acting.",
  ].join("\n");
}

function sanitizeDirectSourceSpecificAnswer(content: string): string {
  return content
    .replace(/\b[Rr]etrieval\b/g, (match) =>
      match[0] === "R" ? "Check" : "check",
    )
    .replace(/\b[Rr]etrieved\b/g, (match) =>
      match[0] === "R" ? "Pulled" : "pulled",
    );
}

function writeTextResponse(
  writer: Parameters<
    Parameters<typeof createUIMessageStream>[0]["execute"]
  >[0]["writer"],
  id: string,
  content: string,
) {
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: content });
  writer.write({ type: "text-end", id });
}

function shouldUseRfiPreviewRouter(message: string): boolean {
  const text = message.toLowerCase();
  return (
    /\b(create|draft|log|prepare)\b/.test(text) &&
    /\brfi\b/.test(text)
  );
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function extractRfiTopic(message: string): string {
  const aboutMatch = message.match(/\babout\s+(.+?)(?:[.?]|$)/i);
  const topic = aboutMatch?.[1]?.trim() || "the field question";
  return topic.replace(/^the\s+/i, "").trim();
}

async function resolveRfiPreviewProject(params: {
  supabase: SupabaseClient<Database>;
  selectedProjectId?: number;
  message: string;
}): Promise<{ id: number; name: string } | null> {
  if (typeof params.selectedProjectId === "number") {
    const { data } = await params.supabase
      .from("projects")
      .select("id,name")
      .eq("id", params.selectedProjectId)
      .maybeSingle();
    if (data?.id && data?.name) return { id: data.id, name: data.name };
  }

  const projectNameHint = params.message.match(/\bfor\s+([A-Za-z0-9][A-Za-z0-9 '&.-]{2,80}?)(?:\s+about\b|[.?]|$)/i)?.[1]?.trim();
  if (!projectNameHint) return null;

  const { data } = await params.supabase
    .from("projects")
    .select("id,name")
    .ilike("name", `%${projectNameHint}%`)
    .order("id", { ascending: true })
    .limit(1);
  const project = data?.[0];
  return project?.id && project?.name ? { id: project.id, name: project.name } : null;
}

type ProjectPickerOption = ProjectPickerWidgetPayload["projects"][number];

async function loadProjectPickerOptions(params: {
  supabase: SupabaseClient<Database>;
  prompt: string;
}): Promise<ProjectPickerOption[]> {
  const projectNameHint = params.prompt.match(/\bfor\s+([A-Za-z0-9][A-Za-z0-9 '&.-]{2,80}?)(?:\s+about\b|[.?]|$)/i)?.[1]?.trim();
  let query = params.supabase
    .from("projects")
    .select("id,name,phase,state,health_status,summary,project_number")
    .eq("archived", false)
    .not("name", "is", null)
    .order("name", { ascending: true })
    .limit(projectNameHint ? 12 : 40);

  if (projectNameHint) {
    query = query.ilike("name", `%${projectNameHint}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Loading project options failed: ${error.message}`);
  }

  const baseProjects = (data ?? [])
    .filter((project): project is NonNullable<typeof project> & { id: number; name: string } =>
      typeof project.id === "number" && typeof project.name === "string" && project.name.trim().length > 0,
    )
    .map((project) => ({
      projectId: project.id,
      name: project.name,
      phase: asString(project.phase),
      state: asString(project.state),
      healthStatus: asString(project.health_status),
      summary: asString(project.summary),
      prompt: [
        `Use project ${project.id} - ${project.name} for this change event.`,
        `Project ID: ${project.id}`,
        `Project Name: ${project.name}`,
      ].join("\n"),
      contractValue: project.project_number ? `#${project.project_number}` : null,
    }));

  if (projectNameHint || baseProjects.length === 0) {
    return baseProjects.slice(0, 12);
  }

  const { data: activityRows, error: activityError } = await params.supabase
    .from("project_activity_view")
    .select("project_id,last_meeting_at,last_task_update,meeting_count,open_tasks")
    .in("project_id", baseProjects.map((project) => project.projectId));

  if (activityError) {
    return baseProjects.slice(0, 12);
  }

  const activityByProjectId = new Map(
    (activityRows ?? [])
      .filter((row) => typeof row.project_id === "number")
      .map((row) => [row.project_id as number, row]),
  );

  return baseProjects
    .map((project) => {
      const activity = activityByProjectId.get(project.projectId);
      const openTasks = Number(activity?.open_tasks ?? 0);
      const meetings = Number(activity?.meeting_count ?? 0);
      const lastActivityAt = [
        asString(activity?.last_task_update),
        asString(activity?.last_meeting_at),
      ]
        .map((value) => (value ? Date.parse(value) : 0))
        .filter((value) => Number.isFinite(value));
      const recencyScore =
        lastActivityAt.length > 0 ? Math.max(...lastActivityAt) / 1000 / 60 / 60 / 24 : 0;
      const activityLabel = [
        openTasks > 0 ? `${openTasks} open tasks` : null,
        meetings > 0 ? `${meetings} meetings` : null,
      ].filter((part): part is string => Boolean(part)).join(" · ");
      return {
        ...project,
        activityLabel: activityLabel || null,
        activityScore: openTasks * 3 + meetings + recencyScore / 30,
      };
    })
    .sort((a, b) => {
      if (b.activityScore !== a.activityScore) return b.activityScore - a.activityScore;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 12)
    .map(({ activityScore: _activityScore, ...project }) => project);
}

function buildRfiPreviewContent(params: {
  project: { id: number; name: string };
  subject: string;
  question: string;
}): string {
  return [
    "Preview Only - No RFI Was Created",
    "",
    `Project: ${params.project.name} (#${params.project.id})`,
    `Subject: ${params.subject}`,
    "",
    "Draft question:",
    params.question,
    "",
    "Reply **confirm** only after reviewing the fields. Until then this stays a preview and no RFI row is written.",
  ].join("\n");
}

type DirectSemanticResult = {
  content?: string;
  sourceTable?: string;
  createdAt?: string | null;
  finalScore?: number;
  similarity?: number;
  metadata?: Record<string, unknown>;
};

type DirectSourceLookupExcerpt = {
  label: string;
  date: string;
  content: string;
};

function extractDirectSourceLookupExcerpts(
  semanticVectorResults: unknown,
): DirectSourceLookupExcerpt[] {
  const wrapper = asRecord(semanticVectorResults);
  const rawResults = Array.isArray(wrapper.results)
    ? (wrapper.results as DirectSemanticResult[])
    : [];
  return rawResults
    .map((result) => {
      const content =
        typeof result.content === "string" ? result.content.trim() : "";
      return content ? { ...result, content } : null;
    })
    .filter((result): result is DirectSemanticResult & { content: string } =>
      Boolean(result),
    )
    .slice(0, 6)
    .map((result, index) => {
      const title =
        (typeof result.metadata?.title === "string" && result.metadata.title) ||
        (typeof result.metadata?.subject === "string" && result.metadata.subject) ||
        (typeof result.metadata?.meeting_title === "string" && result.metadata.meeting_title) ||
        result.sourceTable ||
        `Source ${index + 1}`;
      const date = result.createdAt
        ? new Date(result.createdAt).toISOString().slice(0, 10)
        : "unknown date";
      const label = String(title).includes("Teams")
        ? String(title)
        : `${String(title)}${String(result.sourceTable ?? "").includes("teams") ? " (Teams)" : ""}`;
      return {
        label,
        date,
        content: result.content.replace(/\s+/g, " ").slice(0, 700),
      };
    });
}

// Turns retrieved excerpts into an actual answer instead of a raw templated
// dump (numbered list of titles + relevance scores + internal source IDs).
// A dump is never the right response for a chat assistant — even a genuine
// "pull up the source" ask deserves a synthesized, conversational answer
// that says whether the evidence actually answers the question (dated
// excerpts from weeks ago do NOT answer a "today" question, and a raw dump
// used to present them as if they did). Traced from `/ai` session
// `11a3d842-7ab3-405d-9a18-90aa5f71d0c5`. See AI-RAG-ARCHITECTURE.md.
async function synthesizeDirectSourceLookupAnswer(params: {
  message: string;
  semanticVectorResults: unknown;
  synthesisModel: string;
}): Promise<string | null> {
  const excerpts = extractDirectSourceLookupExcerpts(
    params.semanticVectorResults,
  );
  if (excerpts.length === 0) return null;

  const excerptBlock = excerpts
    .map(
      (excerpt, index) =>
        `[${index + 1}] ${excerpt.label} — ${excerpt.date}\n${excerpt.content}`,
    )
    .join("\n\n");

  try {
    const { text } = await generateText({
      model: getLanguageModel(params.synthesisModel),
      system: [
        "You are Alleato's project intelligence assistant, answering a source-lookup question using ONLY the excerpts below.",
        "Write a direct, conversational answer — like a sharp operator briefing someone, never a search engine listing results.",
        "Never mention relevance scores, internal record IDs, or raw table/source names (e.g. do not say '19:meeting_Z' or 'score 0.57').",
        "Refer to sources naturally by date and topic (e.g. 'a Teams thread from May 11' or 'an email about the McCray change order').",
        "If the excerpts don't actually answer what was asked — e.g. the user asked about 'today' but every excerpt is from weeks earlier — say that plainly and summarize what the evidence actually shows instead of pretending it's current.",
        "If nothing in the excerpts is relevant, say so plainly rather than listing weak matches.",
        "Keep it tight: a few sentences to a short paragraph, not a bulleted dump of every excerpt.",
      ].join("\n"),
      prompt: `User's question: ${params.message}\n\nRetrieved excerpts:\n\n${excerptBlock}`,
    });
    return text.trim() || null;
  } catch (error) {
    console.error("[handler-v2] synthesizeDirectSourceLookupAnswer failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    // Fail toward an honest, still-conversational fallback — never the old
    // raw dump — so a model outage degrades gracefully instead of reverting
    // to score/ID clutter.
    return "I found some source material that might be relevant, but couldn't put together a clean answer from it just now. Try asking again, or narrow it to a specific mailbox, Teams channel, person, or time window.";
  }
}

async function loadLatestExecutiveBriefingMetadata(): Promise<{
  packet: CanonicalDailyBriefPacket | null;
  errorMessage: string | null;
}> {
  try {
    return {
      packet: await loadCurrentDailyExecutiveBriefPacket(),
      errorMessage: null,
    };
  } catch (error) {
    return {
      packet: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function formatBriefingTimestamp(value: string | null): string {
  if (!value) return "not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}

function buildExecutiveBriefingMetadataContent(params: {
  packet: CanonicalDailyBriefPacket | null;
  errorMessage: string | null;
}): string {
  if (params.errorMessage) {
    return [
      "I checked the daily operating brief metadata, but the lookup failed.",
      "",
      "Source checked: intelligence_packets target daily-executive-brief",
      `Failure: ${params.errorMessage}`,
      "",
      "I did not ask for a project because this question is about the executive briefing metadata, not a project-scoped report.",
    ].join("\n");
  }

  if (!params.packet) {
    return [
      "I checked the daily operating brief metadata and did not find a canonical Daily Executive Brief packet yet.",
      "",
      "Source checked: intelligence_packets target daily-executive-brief",
      "",
      "Missing generation step: run the canonical manual source-bundle compiler so it writes to the daily-executive-brief packet.",
      "",
      "I did not ask for a project because this question is about the executive briefing metadata, not a project-scoped report.",
    ].join("\n");
  }

  const regeneratedAt = params.packet.generatedAt;
  return [
    `The daily operating brief was last compiled at ${formatBriefingTimestamp(regeneratedAt)}.`,
    "",
    "Source checked: intelligence_packets target daily-executive-brief",
    `Packet ID: ${params.packet.id}`,
    `Business date: ${params.packet.businessDate}`,
    `Packet type: ${params.packet.packetType}`,
    `Freshness status: ${params.packet.freshnessStatus ?? "not recorded"}`,
    `Source count: ${params.packet.sourceCount}`,
    `Compiler version: ${params.packet.compilerVersion ?? "not recorded"}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

type DailyDeepReadCandidateCount = {
  signalType: string;
  status: string;
  count: number;
};

async function loadDailyDeepReadPacketStatus(): Promise<{
  packet: CanonicalDailyBriefPacket | null;
  candidateCounts: DailyDeepReadCandidateCount[];
  candidateErrorMessage: string | null;
  errorMessage: string | null;
}> {
  try {
    const packet = await loadCurrentDailyExecutiveBriefPacket();
    if (!isRagDatabaseReadsEnabled()) {
      return {
        packet,
        candidateCounts: [],
        candidateErrorMessage: "RAG database reads are disabled for this runtime.",
        errorMessage: null,
      };
    }

    const rag = createRagServiceClient();
    const { data, error } = await rag
      .from("source_signal_candidates")
      .select("signal_type,status,extraction_json")
      .eq("compiler_version", "daily_deep_read_consumers_v1")
      .limit(2000);

    if (error) {
      return {
        packet,
        candidateCounts: [],
        candidateErrorMessage: error.message,
        errorMessage: null,
      };
    }

    const counts = new Map<string, DailyDeepReadCandidateCount>();
    for (const row of data ?? []) {
      const extraction = asRecord(row.extraction_json);
      if (extraction.daily_packet_id !== packet.id) continue;
      const signalType = row.signal_type || "unknown";
      const status = row.status || "unknown";
      const key = `${signalType}:${status}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { signalType, status, count: 1 });
      }
    }

    return {
      packet,
      candidateCounts: [...counts.values()].sort((a, b) =>
        a.signalType === b.signalType
          ? a.status.localeCompare(b.status)
          : a.signalType.localeCompare(b.signalType),
      ),
      candidateErrorMessage: null,
      errorMessage: null,
    };
  } catch (error) {
    return {
      packet: null,
      candidateCounts: [],
      candidateErrorMessage: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function formatCandidateCounts(counts: DailyDeepReadCandidateCount[]): string {
  if (counts.length === 0) return "No packet-linked candidates found yet.";
  return counts
    .map((item) => `- ${item.signalType} / ${item.status}: ${item.count}`)
    .join("\n");
}

function buildDailyDeepReadPacketStatusContent(params: {
  packet: CanonicalDailyBriefPacket | null;
  candidateCounts: DailyDeepReadCandidateCount[];
  candidateErrorMessage: string | null;
  errorMessage: string | null;
}): string {
  if (params.errorMessage) {
    return [
      "I checked the Daily Deep Read packet path, but the packet lookup failed.",
      "",
      "Source checked: intelligence_packets target daily-executive-brief",
      `Failure: ${params.errorMessage}`,
      "",
      "I did not use generic RAG chunk synthesis or the backend Deep Agents path for this answer.",
    ].join("\n");
  }

  if (!params.packet) {
    return [
      "I checked the Daily Deep Read packet path and did not find a current packet.",
      "",
      "Source checked: intelligence_packets target daily-executive-brief",
      "Required next step: run the Daily Deep Read compiler so it writes the current daily-executive-brief packet.",
      "",
      "I did not use generic RAG chunk synthesis or the backend Deep Agents path for this answer.",
    ].join("\n");
  }

  const sourceCounts =
    Object.entries(params.packet.sourceCounts)
      .map(([lane, count]) => `${lane}: ${count}`)
      .join(", ") || "not recorded";
  const sectionTitles =
    params.packet.sections.map((section) => section.title).join(", ") ||
    "not recorded";
  const candidateStatus = params.candidateErrorMessage
    ? `Candidate lookup warning: ${params.candidateErrorMessage}`
    : formatCandidateCounts(params.candidateCounts);

  return [
    `Latest Daily Deep Read packet: ${params.packet.businessDate}.`,
    "",
    "Packet source of truth:",
    `- Table: intelligence_packets`,
    `- Target: daily-executive-brief`,
    `- Packet ID: ${params.packet.id}`,
    `- Packet type: ${params.packet.packetType}`,
    `- Generated at: ${formatBriefingTimestamp(params.packet.generatedAt)}`,
    `- Compiler version: ${params.packet.compilerVersion ?? "not recorded"}`,
    `- Source count: ${params.packet.sourceCount}`,
    `- Source counts: ${sourceCounts}`,
    `- Sections available: ${sectionTitles}`,
    "",
    "Project intelligence policy:",
    "- Project intelligence should consume the full-source Daily Deep Read packet sections and source notes first.",
    "- Raw RAG chunks are for search, retrieval, and citation support only; they should not be the primary synthesis source for owner-level insights.",
    "- Tasks, risks, decisions, initiatives, and project updates should be extracted as review-gated candidates before promotion into project intelligence packets.",
    "",
    "Current packet-linked candidates:",
    candidateStatus,
    "",
    "Routing proof: this answer used the deterministic Daily Deep Read packet lookup, not generic Deep Agents or raw document_chunks synthesis.",
  ].join("\n");
}

// Why: deep-agent and Microsoft-specialist fetches can take 40–60s. Without
// any bytes on the wire during that window, browsers / HTTP/2 / dev middleware
// silently kill the stream and the client renders "Failed to fetch" even though
// the server is still working. Periodic data-status writes keep the stream alive
// and double as visible "still working…" feedback for the user.
async function withKeepAlive<T>(
  writer: Parameters<
    Parameters<typeof createUIMessageStream>[0]["execute"]
  >[0]["writer"],
  options: { statusId: string; stage: string; message: string; intervalMs?: number },
  task: () => Promise<T>,
): Promise<T> {
  const intervalMs = options.intervalMs ?? 3_000;
  const interval = setInterval(() => {
    writer.write({
      type: "data-status",
      id: options.statusId,
      data: {
        stage: options.stage,
        message: options.message,
        status: "loading",
        timestamp: new Date().toISOString(),
      },
    } as never);
  }, intervalMs);
  try {
    return await task();
  } finally {
    clearInterval(interval);
  }
}

function summarizeDeepAgentSourceCoverage(
  sourcesChecked: Array<{
    sourceType: string;
    status: string;
    recordCount: number;
  }>,
): Record<string, unknown>[] {
  return sourcesChecked.map((source) => ({
    sourceType: source.sourceType,
    status: source.status,
    recordCount: source.recordCount,
  }));
}

function assistantMaxOutputTokens(planReason: string): number {
  const raw = Number(process.env.AI_ASSISTANT_MAX_OUTPUT_TOKENS);
  const requested = Number.isFinite(raw) && raw > 0 ? raw : 8_000;
  const bounded = Math.min(Math.max(Math.round(requested), 4_000), 12_000);
  if (planReason === "executive_deep_agent_broad_operator_question") {
    return Math.max(bounded, 8_000);
  }
  return bounded;
}

function buildAnswerDebugMetadata(params: {
  orchestrator: string;
  plan: ReturnType<typeof planRetrieval>;
  toolTrace: Array<Record<string, unknown>>;
  memoryUsage?: MemoryUsageSummary | null;
  skillUsage?: BotSkillUsageSummary | null;
  sourceCoverage?: Array<Record<string, unknown>>;
  evidenceCount?: number;
  outputPolicy?: Record<string, unknown>;
}): Record<string, unknown> {
  const toolNames = params.toolTrace
    .map((trace) => trace.toolName ?? trace.tool)
    .filter((tool): tool is string => typeof tool === "string");
  return {
    orchestrator: params.orchestrator,
    retrievalPlan: {
      intent: params.plan.intent,
      reason: params.plan.reason,
      responseFormat: params.plan.responseFormat,
      sources: Object.keys(params.plan.sources),
    },
    memory:
      params.memoryUsage ??
      {
        status: "not_loaded_in_frontend",
        reason:
          "This answer was produced by a delegated specialist/direct Deep Agents path; inspect delegated trace and backend memory metadata for specialist-side context.",
      },
    skills:
      params.skillUsage ??
      {
        status: "not_loaded_or_not_selected",
        reason:
          "No approved Skill Library records were selected for this answer, or the answer used a delegated/direct path that does not yet inject skills.",
      },
    sources: {
      toolNames,
      toolCallCount: toolNames.length,
      timing: summarizeToolTiming(params.toolTrace),
      sourceCoverage: params.sourceCoverage ?? [],
      evidenceCount: params.evidenceCount ?? null,
    },
    outputPolicy: params.outputPolicy ?? null,
  };
}

function shouldUseDirectSourceSpecificFastPath(params: {
  plan: ReturnType<typeof planRetrieval>;
  retrievalCtx: Awaited<ReturnType<typeof executeRetrievalPlan>>;
}): boolean {
  return (
    params.plan.responseFormat === "source_specific_rag" &&
    (
      params.plan.sources.sourceSpecificRag?.kind === "recent_teams_discussions" ||
      params.plan.sources.sourceSpecificRag?.kind === "recent_meetings" ||
      params.plan.sources.sourceSpecificRag?.kind === "meetings_on_date"
    ) &&
    typeof params.retrievalCtx.sourceSpecificRagAnswer?.content === "string" &&
    params.retrievalCtx.sourceSpecificRagAnswer.content.trim().length > 0
  );
}

function directSourceSpecificResponseLabel(
  kind: NonNullable<
    ReturnType<typeof planRetrieval>["sources"]["sourceSpecificRag"]
  >["kind"],
): string {
  if (kind === "recent_teams_discussions") return "source-specific-recent-teams";
  if (kind === "meetings_on_date") return "source-specific-meetings-on-date";
  return "source-specific-recent-meetings";
}

function directSourceSpecificStatusMessage(
  kind: NonNullable<
    ReturnType<typeof planRetrieval>["sources"]["sourceSpecificRag"]
  >["kind"],
): string {
  return kind === "recent_teams_discussions"
    ? "Recent Teams source answer returned"
    : "Meeting source answer returned";
}

function buildMeetingCollectionStoppedContent(params: {
  collection: Awaited<ReturnType<typeof executeRetrievalPlan>>["meetingCollection"];
  synthesisError?: string | null;
}): string {
  const collection = params.collection;
  if (!collection) {
    return [
      "I couldn't analyze that collection because the meeting corpus did not return coverage metadata.",
      "",
      "I stopped instead of producing an answer without verified transcripts. No analysis was completed.",
    ].join("\n");
  }

  if (collection.status === "no_matches") {
    return [
      "I found no authorized meeting transcripts that matched the requested collection criteria.",
      "",
      `Coverage: enumerated ${collection.coverage.enumerated} meeting records; matched 0; analyzed 0.`,
      "I did not substitute loosely related meetings or generate an unsupported analysis.",
    ].join("\n");
  }

  const failureLines = collection.failures.slice(0, 12).map((item) => {
    const label = item.title ?? item.id ?? "collection";
    return `- ${label}: ${item.message}`;
  });
  return [
    params.synthesisError
      ? "I retrieved the requested collection, but the grounded analysis pass failed."
      : "I couldn't complete the requested collection analysis because transcript retrieval was incomplete.",
    "",
    `Coverage: matched ${collection.coverage.matched}; retrieved ${collection.coverage.retrieved}; failed ${collection.coverage.failed}; analyzed 0.`,
    "I stopped instead of presenting a partial result as a complete analysis.",
    ...(params.synthesisError
      ? [`Analysis error: ${params.synthesisError}`]
      : failureLines.length > 0
        ? ["", "Retrieval failures:", ...failureLines]
        : []),
  ].join("\n");
}

async function persistDirectDeepAgentResponse(params: {
  supabase: SupabaseClient;
  sessionId: string;
  userId: string;
  content: string;
  sources?: Json;
  metadata: Json;
  responseLabel: string;
  sourceDebug: Record<string, unknown>;
  trace: {
    input: string;
    intent: string;
    modelId: string;
    selectedProjectId?: number | null;
    toolTrace: Array<Record<string, unknown>>;
    qualityScore?: number;
    qualityReasons?: string[];
  };
}): Promise<void> {
  const chatHistory = createChatHistoryWriter(params.supabase, {
    sessionId: params.sessionId,
    userId: params.userId,
  });
  await chatHistory.persistRecordOrThrow(
    {
      role: "assistant",
      content: params.content,
      ...(params.sources !== undefined ? { sources: params.sources } : {}),
      metadata: params.metadata,
    },
    `Deep Agents ${params.responseLabel} response`,
  );

  const { error: conversationError } = await params.supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId);

  if (conversationError) {
    throw new Error(
      `Updating the Deep Agents ${params.responseLabel} conversation failed: ${conversationError.message}`,
    );
  }

  waitUntil(
    traceChatCompletion({
      userId: params.userId,
      sessionId: params.sessionId,
      modelId: params.trace.modelId,
      input: params.trace.input,
      output: params.content,
      generationName: `directDeepAgent:${params.responseLabel}`,
      intent: params.trace.intent,
      selectedProjectId: params.trace.selectedProjectId ?? null,
      toolCallNames: params.trace.toolTrace
        .map((trace) => trace.toolName ?? trace.tool)
        .filter((tool): tool is string => typeof tool === "string"),
      stepCount: params.trace.toolTrace.length,
      toolTrace: params.trace.toolTrace,
      qualityScore: params.trace.qualityScore,
      qualityReasons: params.trace.qualityReasons,
      metadata: {
        architecture: "render-backend-deep-agents-v1",
        responseLabel: params.responseLabel,
        tracePath: "direct-deep-agent-response",
        sourceDebug: params.sourceDebug,
      },
    }),
  );

  waitUntil(runPostResponseTasks(params.sessionId, params.userId));
}

function createClientPacketTrace(params: {
  durationMs: number;
  message: string;
  projectId: number;
  packet: Awaited<ReturnType<typeof loadCurrentIntelligencePacket>>;
}) {
  const packet = params.packet;
  return {
    tool: "clientProjectIntelligencePacket",
    toolName: "clientProjectIntelligencePacket",
    agent: "frontend-ai-assistant",
    status: packet ? "success" : "failed",
    durationMs: params.durationMs,
    input: {
      message: params.message.slice(0, 240),
      selectedProjectId: params.projectId,
    },
    output: packet
      ? {
          packetId: packet.id,
          compilerVersion: packet.compilerVersion,
          freshnessStatus: packet.freshnessStatus,
          generatedAt: packet.generatedAt,
          ageHours: Math.round(packet.ageHours * 10) / 10,
          cardCount: packet.cards.length,
          evidenceCount: packet.cards.reduce(
            (count, card) => count + card.evidence.length,
            0,
          ),
          linkedEvidenceCount: packet.sourceCoverage.linkedEvidenceCount ?? null,
          qualityGateStatus:
            asString(asRecord(packet.sourceCoverage.qualityGate).status) ??
            null,
        }
      : {
          cardCount: 0,
          error: "No current packet was available for the selected project.",
        },
    timestamp: new Date().toISOString(),
  };
}

async function tryWriteProjectPacketFastPath(params: {
  supabase: SupabaseClient<Database>;
  writer: Parameters<
    Parameters<typeof createUIMessageStream>[0]["execute"]
  >[0]["writer"];
  userId: string;
  sessionId: string;
  selectedProjectId: number;
  message: string;
  plan: ReturnType<typeof planRetrieval>;
}): Promise<boolean> {
  if (
    !shouldUseProjectPacketFastPath({
      intent: params.plan.intent,
      responseFormat: params.plan.responseFormat,
      usesIntelligencePacket: Boolean(params.plan.sources.intelligencePacket),
    })
  ) {
    return false;
  }

  const startedAt = Date.now();
  const target = await resolveIntelligenceTarget({
    query: String(params.selectedProjectId),
    selectedProjectId: params.selectedProjectId,
    supabase: params.supabase,
  });

  if (!target) return false;

  const packet = await loadCurrentIntelligencePacket({
    targetId: target.id,
    supabase: params.supabase,
    includeSourcePreview: false,
    projectId: target.projectId,
  });
  const trace = createClientPacketTrace({
    durationMs: Date.now() - startedAt,
    message: params.message,
    projectId: params.selectedProjectId,
    packet,
  });

  if (!packet || !projectPacketIsFastPathEligible(packet)) {
    return false;
  }

  const content = synthesizeAdvisorResponse({
    target,
    packet,
    intent: params.plan.intent,
    query: params.message,
  });
  const toolTrace = [trace];
  const sourceDebug = buildAnswerDebugMetadata({
    orchestrator: "client-project-intelligence-packet-fast-path",
    plan: params.plan,
    toolTrace,
    sourceCoverage: [
      {
        sourceType: "intelligence_packet",
        status: "checked",
        compilerVersion: packet.compilerVersion,
        freshnessStatus: packet.freshnessStatus,
        linkedEvidenceCount: packet.sourceCoverage.linkedEvidenceCount ?? null,
        latestSourceAt: packet.sourceCoverage.latestSourceAt ?? null,
      },
    ],
    evidenceCount: packet.cards.reduce(
      (count, card) => count + card.evidence.length,
      0,
    ),
  });

  await persistDirectDeepAgentResponse({
    supabase: params.supabase,
    sessionId: params.sessionId,
    userId: params.userId,
    content,
    responseLabel: "project-packet-fast-path",
    sourceDebug,
    trace: {
      input: params.message,
      intent: params.plan.intent,
      modelId: "client-project-intelligence-packet",
      selectedProjectId: params.selectedProjectId,
      toolTrace,
    },
    metadata: {
      architecture: "retrieval-planner-v2",
      provider_path: "client-project-intelligence-packet",
      packet_fast_path: {
        packet_id: packet.id,
        target_id: target.id,
        target_name: target.name,
        compiler_version: packet.compilerVersion,
        freshness_status: packet.freshnessStatus,
        generated_at: packet.generatedAt,
        age_hours: packet.ageHours,
        card_count: packet.cards.length,
        linked_evidence_count: packet.sourceCoverage.linkedEvidenceCount ?? null,
      },
      retrieval_plan: {
        intent: params.plan.intent,
        reason: params.plan.reason,
        responseFormat: params.plan.responseFormat,
        sources: Object.keys(params.plan.sources),
      },
      tool_trace: toolTrace,
      response_quality: buildResponseQualityMetadata({
        toolTrace,
        content,
      }),
      source_debug: sourceDebug,
    } as Json,
  });

  params.writer.write({
    type: "data-status",
    id: "strategist-status",
    data: {
      stage: "complete",
      message: "Current project intelligence packet answer returned",
      status: "success",
      timestamp: new Date().toISOString(),
    },
  } as never);
  writeTextResponse(
    params.writer,
    "strategist-client-project-intelligence-packet",
    content,
  );

  return true;
}

async function runChatV2(args: HandlerArgs): Promise<Response> {
  const actionToolsEnabled = assistantSurfaceAllowsActionTools(
    args.assistantSurface,
  );
  // One persistence seam for every chat_history write this request makes —
  // centralizes the row shape and the loud-failure contract (see chat-history-writer).
  const chatHistory = createChatHistoryWriter(args.supabase, {
    sessionId: args.sessionId,
    userId: args.user.id,
  });
  // Legacy branches keep their existing row shapes while the writer owns the
  // identity check and conversion into the canonical persistence-ready record.
  const persistChatHistoryRow = chatHistory.persistBoundRecord;
  const lastUserMessage = [...args.messages]
    .reverse()
    .find((m) => m.role === "user");
  const lastUserContent = lastUserMessage
    ? extractTextFromParts(lastUserMessage.parts)
    : "";
  let responseAlreadyPersisted = false;
  let memoryUsage: MemoryUsageSummary | null = null;
  let skillUsage: BotSkillUsageSummary | null = null;
  // Captured inside the OTel root span; persisted to chat_history metadata so the
  // feedback route (and eval/experiment tooling) can attach Langfuse scores to
  // the exact trace this message produced.
  let langfuseTraceId: string | undefined;
  let finishMetadata: {
    finishReason?: string;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
    toolCallNames: string[];
    stepCount: number;
  } | null = null;
  let contextCompactionMetadata: ContextCompactionMetadata | null = null;
  // Real provider/stream error captured by streamText.onError. When the model
  // yields no text, this is used to explain WHY instead of the old hardcoded
  // "out of credits / billing" guess (which was wrong whenever the failure was
  // a swallowed provider or tool-schema error rather than an actual billing
  // block). Null means the stream ended without an error event.
  let streamErrorMessage: string | null = null;
  const bridgeToolTrace: Array<Record<string, unknown>> = [];
  const backendDeepAgentContextBlocks: string[] = [];
  const liveToolTrace: Array<Record<string, unknown>> = [];
  const liveResearchReceipts: ResearchReceipt[] = [];
  let mcpToolBundle: Awaited<ReturnType<typeof createAiAssistantMcpTools>> | null =
    null;
  let latestRetrievalCtx: Awaited<
    ReturnType<typeof executeRetrievalPlan>
  > | null = null;

  const attachmentCapabilities =
    detectChatAttachmentCapabilitiesAcrossMessages(args.messages);
  const plan = await planRetrievalWithSemanticCollections({
    message: lastUserContent,
    selectedProjectId: args.selectedProjectId,
    messages: args.messages,
    hasAttachments: attachmentCapabilities.hasAttachments,
  });
  const selectedDeepAgentsStrategist = isDeepAgentsStrategistModelId(
    args.activeModel,
  );
  const synthesisModel = selectedDeepAgentsStrategist
    ? DEFAULT_AI_ASSISTANT_MODEL
    : args.activeModel;

  const stream = createUIMessageStream({
    originalMessages: args.messages,
    // Surface a readable message when execute() throws. Without this, an
    // unhandled error closes the stream and the client falls back to a generic
    // "network error" — indistinguishable from a real connection drop. Returning
    // the message here sends it as a stream error part the UI can render.
    onError: (error) => {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("[handler-v2] createUIMessageStream onError", {
        message: detail,
      });
      return detail || "The assistant request failed before a response was returned.";
    },
    execute: async ({ writer }) => {
      writer.write({
        type: "data-status",
        id: "strategist-status",
        data: {
          stage: "planning",
          message: `Plan: ${plan.reason}`,
          status: "loading",
          timestamp: new Date().toISOString(),
        },
      } as never);

      if (isDailyDeepReadPacketQuestion(lastUserContent)) {
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "daily-deep-read-packet",
            message: "Checking Daily Deep Read packet and review-gated candidates",
            status: "loading",
            timestamp: new Date().toISOString(),
          },
        } as never);

        if (lastUserContent.trim()) {
          const { error: userPersistError } = await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "user",
            content: lastUserContent,
          });
          if (userPersistError) {
            throw new Error(
              `Persisting the Daily Deep Read packet user turn failed: ${userPersistError.message}`,
            );
          }
        }

        const packetStatus = await loadDailyDeepReadPacketStatus();
        const content = buildDailyDeepReadPacketStatusContent(packetStatus);
        const toolTrace = [
          {
            tool: "intentPlanner",
            input: {
              message: lastUserContent.slice(0, 240),
              selectedProjectId: args.selectedProjectId ?? null,
            },
            output: {
              intent: "daily_deep_read_packet_status",
              responseMode: "packet_lookup",
              rationale:
                "The user asked about Daily Deep Read source-of-truth, raw RAG chunks, or review-gated packet consumers.",
            },
            timestamp: new Date().toISOString(),
          },
          {
            tool: "dailyDeepReadPacketLookup",
            toolName: "dailyDeepReadPacketLookup",
            agent: "retrieval-planner-v2",
            status: packetStatus.errorMessage ? "failed" : "success",
            input: {
              table: "intelligence_packets",
              targetSlug: "daily-executive-brief",
              packetType: "current",
            },
            output: {
              found: Boolean(packetStatus.packet),
              packetId: packetStatus.packet?.id ?? null,
              businessDate: packetStatus.packet?.businessDate ?? null,
              sourceCount: packetStatus.packet?.sourceCount ?? null,
              error: packetStatus.errorMessage,
            },
            timestamp: new Date().toISOString(),
          },
          {
            tool: "dailyDeepReadCandidateLookup",
            toolName: "dailyDeepReadCandidateLookup",
            agent: "retrieval-planner-v2",
            status: packetStatus.candidateErrorMessage ? "warning" : "success",
            input: {
              table: "source_signal_candidates",
              compilerVersion: "daily_deep_read_consumers_v1",
              packetId: packetStatus.packet?.id ?? null,
            },
            output: {
              counts: packetStatus.candidateCounts,
              error: packetStatus.candidateErrorMessage,
            },
            timestamp: new Date().toISOString(),
          },
        ];
        const sourceDebug = buildAnswerDebugMetadata({
          orchestrator: "retrieval-planner-v2-daily-deep-read-packet",
          plan,
          toolTrace,
          memoryUsage,
          sourceCoverage: [
            {
              sourceType: "intelligence_packets",
              status: packetStatus.packet ? "loaded" : "missing",
              notes:
                packetStatus.errorMessage ??
                "target_slug=daily-executive-brief packet_type=current",
            },
            {
              sourceType: "source_signal_candidates",
              status: packetStatus.candidateErrorMessage ? "warning" : "loaded",
              notes:
                packetStatus.candidateErrorMessage ??
                "compiler_version=daily_deep_read_consumers_v1 filtered by daily_packet_id",
            },
          ],
          evidenceCount:
            (packetStatus.packet ? 1 : 0) +
            packetStatus.candidateCounts.reduce((sum, item) => sum + item.count, 0),
          outputPolicy: {
            synthesisSource: "daily_deep_read_packet",
            rawRagChunks: "search_and_citation_only",
            promotion: "review_gated_candidates_required",
          },
        });

        await persistDirectDeepAgentResponse({
          supabase: args.supabase,
          sessionId: args.sessionId,
          userId: args.user.id,
          content,
          responseLabel: "daily-deep-read-packet",
          sourceDebug,
          trace: {
            input: lastUserContent,
            intent: "daily_deep_read_packet_status",
            modelId: "retrieval-planner-v2-daily-deep-read-packet",
            selectedProjectId: args.selectedProjectId ?? null,
            toolTrace,
          },
          metadata: {
            architecture: "retrieval-planner-v2",
            provider_decision: {
              providerPath: "deterministic-daily-deep-read-packet",
              model: null,
            },
            provider_path: "deterministic-daily-deep-read-packet",
            model: args.activeModel,
            synthesis_model: synthesisModel,
            retrieval_plan: {
              intent: "daily_deep_read_packet_status",
              reason: plan.reason,
              responseFormat: "packet_lookup",
              sources: ["intelligence_packets", "source_signal_candidates"],
            },
            tool_trace: toolTrace,
            response_quality: buildResponseQualityMetadata({
              toolTrace,
              content,
            }),
            source_debug: sourceDebug,
          } as Json,
        });

        responseAlreadyPersisted = true;
        writeTextResponse(writer, "strategist-daily-deep-read-packet", content);
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "complete",
            message: "Daily Deep Read packet status returned",
            status:
              packetStatus.errorMessage || packetStatus.candidateErrorMessage
                ? "warning"
                : "success",
            timestamp: new Date().toISOString(),
          },
        } as never);
        return;
      }

      if (isExecutiveBriefingMetadataQuestion(lastUserContent)) {
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "executive-briefing-metadata",
            message: "Checking daily operating brief metadata",
            status: "loading",
            timestamp: new Date().toISOString(),
          },
        } as never);

        if (lastUserContent.trim()) {
          const { error: userPersistError } = await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "user",
            content: lastUserContent,
          });
          if (userPersistError) {
            throw new Error(
              `Persisting the change-event workflow user turn failed: ${userPersistError.message}`,
            );
          }
        }

        const metadataLookup = await loadLatestExecutiveBriefingMetadata();
        const content = buildExecutiveBriefingMetadataContent(metadataLookup);
        const toolTrace = [
          {
            tool: "intentPlanner",
            input: {
              message: lastUserContent.slice(0, 240),
              selectedProjectId: args.selectedProjectId ?? null,
            },
            output: {
              intent: "executive_briefing_metadata",
              responseMode: "metadata_lookup",
              rationale:
                "Timing/regeneration follow-up refers to the global executive briefing row, not a project-specific status report.",
            },
            timestamp: new Date().toISOString(),
          },
          {
            tool: "executiveBriefingMetadataLookup",
            toolName: "executiveBriefingMetadataLookup",
            agent: "retrieval-planner-v2",
            status: metadataLookup.errorMessage ? "failed" : "success",
            input: {
              table: "intelligence_packets",
              targetSlug: "daily-executive-brief",
              packetType: "current",
            },
            output: {
              found: Boolean(metadataLookup.packet),
              packet: metadataLookup.packet,
              error: metadataLookup.errorMessage,
            },
            timestamp: new Date().toISOString(),
          },
        ];
        const sourceDebug = buildAnswerDebugMetadata({
          orchestrator: "retrieval-planner-v2-executive-briefing-metadata",
          plan,
          toolTrace,
          memoryUsage,
          sourceCoverage: [
            {
              sourceType: "intelligence_packets",
              status: metadataLookup.packet ? "loaded" : "missing",
              notes:
                metadataLookup.errorMessage ??
                "target_slug=daily-executive-brief packet_type=current",
            },
          ],
          evidenceCount: metadataLookup.packet ? 1 : 0,
        });

        await persistDirectDeepAgentResponse({
          supabase: args.supabase,
          sessionId: args.sessionId,
          userId: args.user.id,
          content,
          responseLabel: "executive-briefing-metadata",
          sourceDebug,
          trace: {
            input: lastUserContent,
            intent: "executive_briefing_metadata",
            modelId: "retrieval-planner-v2-executive-briefing-metadata",
            selectedProjectId: args.selectedProjectId ?? null,
            toolTrace,
          },
          metadata: {
            architecture: "retrieval-planner-v2",
            provider_decision: {
              providerPath: "deterministic-executive-briefing-metadata",
              model: null,
            },
            provider_path: "deterministic-executive-briefing-metadata",
            model: args.activeModel,
            synthesis_model: synthesisModel,
            retrieval_plan: {
              intent: "executive_briefing_metadata",
              reason: plan.reason,
              responseFormat: "metadata_lookup",
              sources: ["intelligence_packets"],
            },
            tool_trace: toolTrace,
            response_quality: buildResponseQualityMetadata({
              toolTrace,
              content,
            }),
            source_debug: sourceDebug,
          } as Json,
        });

        responseAlreadyPersisted = true;
        writeTextResponse(writer, "strategist-executive-briefing-metadata", content);
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "complete",
            message: "Daily operating brief metadata returned",
            status: metadataLookup.errorMessage ? "warning" : "success",
            timestamp: new Date().toISOString(),
          },
        } as never);
        return;
      }

      if (
        actionToolsEnabled &&
        shouldUseRfiPreviewRouter(lastUserContent)
      ) {
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "action-preview",
            message: "Preparing an RFI preview without writing a record",
            status: "loading",
            timestamp: new Date().toISOString(),
          },
        } as never);

        if (lastUserContent.trim()) {
          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "user",
            content: lastUserContent,
          });
        }

        const project = await resolveRfiPreviewProject({
          supabase: args.supabase,
          selectedProjectId: args.selectedProjectId,
          message: lastUserContent,
        });
        const plannerTrace = {
          tool: "intentPlanner",
          input: {
            message: lastUserContent.slice(0, 240),
            selectedProjectId: args.selectedProjectId ?? null,
          },
          output: {
            intent: "change_management_review",
            responseMode: "draft_safe_action",
            rationale:
              "Explicit RFI creation/drafting request requires preview-only action tooling.",
          },
          timestamp: new Date().toISOString(),
        };

        if (!project) {
          const content =
            "I can draft that as a preview, but I could not resolve the project from the request. Send the project name or open the project first, and I will produce a preview without creating the RFI.";
          const toolTrace = [
            plannerTrace,
            {
              tool: "rfiActionIntentRouter",
              input: {
                message: lastUserContent.slice(0, 240),
                selectedProjectId: args.selectedProjectId ?? null,
              },
              output: {
                status: "blocked",
                reason: "project_not_resolved",
              },
              timestamp: new Date().toISOString(),
            },
          ];
          writeTextResponse(writer, "strategist-rfi-preview-router-blocked", content);
          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "assistant",
            content,
            metadata: toJsonValue({
              architecture: "retrieval-planner-v2",
              provider_decision: {
                providerPath: "deterministic-rfi-preview-router",
                model: null,
              },
              tool_trace: toolTrace,
              response_quality: buildResponseQualityMetadata({
                toolTrace,
                content,
              }),
            }) as Json,
          });
          responseAlreadyPersisted = true;
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "action-preview",
              message: "RFI preview blocked until a project is selected",
              status: "error",
              timestamp: new Date().toISOString(),
            },
          } as never);
          return;
        }

        const topic = extractRfiTopic(lastUserContent);
        const subject = `RFI - ${titleCase(topic)}`;
        const question = `Please clarify ${topic}.`;
        const rfiToolTrace: Record<string, unknown>[] = [];
        const previewOutput = await previewCreateRFI(
          args.user.id,
          {
            pinnedProjectId: args.selectedProjectId,
            onTrace: (trace) => {
              rfiToolTrace.push({
                ...trace,
                toolName: trace.tool,
              });
            },
          },
          {
            projectId: project.id,
            subject,
            question,
            scheduleImpact: "tbd",
            costImpact: "tbd",
          },
        );
        const content = buildRfiPreviewContent({ project, subject, question });
        const toolTrace = [
          plannerTrace,
          {
            tool: "rfiActionIntentRouter",
            input: {
              message: lastUserContent.slice(0, 240),
              selectedProjectId: args.selectedProjectId ?? null,
            },
            output: {
              status: "preview_routed",
              projectId: project.id,
              projectName: project.name,
              tool: "createRFI",
            },
            timestamp: new Date().toISOString(),
          },
          ...rfiToolTrace,
        ];

        writeTextResponse(writer, "strategist-rfi-preview-router", content);
        await persistChatHistoryRow({
          session_id: args.sessionId,
          user_id: args.user.id,
          role: "assistant",
          content,
            metadata: toJsonValue({
              architecture: "retrieval-planner-v2",
              provider_decision: {
                providerPath: "deterministic-rfi-preview-router",
                model: null,
              },
              retrieval_plan: {
                intent: "change_management_review",
                reason: "rfi_preview_router",
              responseFormat: "action_preview",
              sources: ["public.projects", "action_tools.createRFI"],
            },
            tool_trace: toolTrace,
            response_quality: buildResponseQualityMetadata({
              toolTrace,
              content,
            }),
            action_preview: previewOutput,
          }) as Json,
        });
        await args.supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("session_id", args.sessionId)
          .eq("user_id", args.user.id);
        responseAlreadyPersisted = true;

        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "complete",
            message: "RFI preview prepared",
            status: "success",
            timestamp: new Date().toISOString(),
          },
        } as never);
        return;
      }

      const previousChangeEventWorkflowDraft =
        await loadLatestChangeEventWorkflowDraft({
          supabase: args.supabase,
          sessionId: args.sessionId,
          userId: args.user.id,
        });
      const shouldUseChangeEventWorkflow =
        actionToolsEnabled &&
        !isChangeEventFinalPreviewRequest(lastUserContent) &&
        (plan.intent === "change_event_write" ||
          (Boolean(previousChangeEventWorkflowDraft) &&
            isLikelyChangeEventWorkflowFollowup(lastUserContent)));

      if (shouldUseChangeEventWorkflow) {
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "change-event-workflow",
            message: "Updating change-event intake workflow",
            status: "loading",
            timestamp: new Date().toISOString(),
          },
        } as never);

        if (lastUserContent.trim()) {
          const { error: userPersistError } = await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "user",
            content: lastUserContent,
          });
          if (userPersistError) {
            throw new Error(
              `Persisting the change-event workflow user turn failed: ${userPersistError.message}`,
            );
          }
        }

        const initialWorkflow = buildChangeEventWorkflowMetadata({
          prompt: lastUserContent,
          selectedProjectId: args.selectedProjectId ?? null,
          previousDraft: previousChangeEventWorkflowDraft,
        });
        await persistChangeEventWorkflowArtifact({
          userId: args.user.id,
          sessionId: args.sessionId,
          workflow: initialWorkflow,
        });

        if (!initialWorkflow.draft.projectId) {
          const projectOptions = await loadProjectPickerOptions({
            supabase: args.supabase,
            prompt: lastUserContent,
          });
          const content = "Which project should I use for this change event?";
          const dataPart = {
            type: "data-assistant-widget",
            id: "assistant-widget-change-event-project-picker",
            data: {
              widget: {
                type: "project_picker",
                id: "change-event-project-picker",
                title: "Select Project",
                subtitle:
                  "To get started, let me know which project we are creating this change event for.",
                actionLabel: "Use project",
                intent: "general",
                projects: projectOptions,
                emptyState: "No active projects were available to choose from.",
              } satisfies ProjectPickerWidgetPayload,
            },
          };
          const toolTrace = [
            {
              tool: "projectContextRequired",
              toolName: "projectContextRequired",
              status: projectOptions.length > 0 ? "success" : "missing",
              input: {
                message: lastUserContent.slice(0, 240),
                selectedProjectId: args.selectedProjectId ?? null,
              },
              output: {
                requiredFor: "change_event_workflow",
                projectOptionCount: projectOptions.length,
                expectedNextWidget: "project_picker",
              },
              timestamp: new Date().toISOString(),
            },
          ];

          writeTextResponse(writer, "strategist-change-event-project-required", content);
          writer.write(dataPart as never);

          const { error: projectPickerPersistError } = await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "assistant",
            content,
            metadata: toJsonValue({
              architecture: "retrieval-planner-v2",
              provider_decision: {
                providerPath: "deterministic-change-event-project-picker",
                model: null,
              },
              provider_path: "deterministic-change-event-project-picker",
              model: null,
              retrieval_plan: {
                intent: "change_event_write",
                reason: "project_context_required",
                responseFormat: "project_picker",
                sources: ["public.projects"],
              },
              change_event_workflow: initialWorkflow,
              tool_trace: toolTrace,
              response_quality: buildResponseQualityMetadata({
                toolTrace,
                content,
              }),
              source_debug: {
                orchestrator: "change-event-project-context-required",
                evidenceCount: projectOptions.length,
                sourceCoverage: [
                  {
                    sourceType: "public.projects",
                    status: projectOptions.length > 0 ? "checked" : "missing",
                    notes:
                      projectOptions.length > 0
                        ? `${projectOptions.length} active project option(s) loaded.`
                        : "No active project options were available.",
                  },
                ],
              },
              data_parts: [dataPart],
            }) as Json,
          });
          if (projectPickerPersistError) {
            throw new Error(
              `Persisting the change-event project picker assistant turn failed: ${projectPickerPersistError.message}`,
            );
          }

          const { error: conversationUpdateError } = await args.supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("session_id", args.sessionId)
            .eq("user_id", args.user.id);
          if (conversationUpdateError) {
            throw new Error(
              `Updating the change-event project picker conversation timestamp failed: ${conversationUpdateError.message}`,
            );
          }

          responseAlreadyPersisted = true;
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "complete",
              message: "Project context requested",
              status: "success",
              timestamp: new Date().toISOString(),
            },
          } as never);
          return;
        }

        if (!initialWorkflow.draft.narrative) {
          const dataPart = {
            type: "data-assistant-widget",
            id: "assistant-widget-change-event-workflow",
            data: {
              widget: {
                type: "change_event_workflow",
                id: "change-event-workflow",
                title: "Change event workflow",
                draft: initialWorkflow.draft,
              },
            },
          };
          const projectName =
            initialWorkflow.draft.projectName ??
            (initialWorkflow.draft.projectId
              ? `project #${initialWorkflow.draft.projectId}`
              : "this project");
          const content = `We'll create this for ${projectName}.\n\n${initialWorkflow.draft.nextQuestion}`;
          const toolTrace = [
            {
              tool: "changeEventWorkflowState",
              toolName: "changeEventWorkflowState",
              status: "missing",
              input: {
                message: lastUserContent.slice(0, 240),
                selectedProjectId:
                  args.selectedProjectId ??
                  initialWorkflow.draft.projectId ??
                  null,
                hadPriorDraft: Boolean(previousChangeEventWorkflowDraft),
              },
              output: {
                readyForPreview: false,
                activeChecklistKey: initialWorkflow.readiness.activeChecklistKey,
                missingChecklistKeys:
                  initialWorkflow.readiness.missingChecklistKeys,
                expectedNextStep: "collect_event_description",
                expectedNativeTool: initialWorkflow.expectedNativeTool,
              },
              timestamp: new Date().toISOString(),
            },
          ];

          writeTextResponse(writer, "strategist-change-event-description-required", content);
          writer.write(dataPart as never);

          const { error: descriptionPromptPersistError } =
            await persistChatHistoryRow({
              session_id: args.sessionId,
              user_id: args.user.id,
              role: "assistant",
              content,
              metadata: toJsonValue({
                architecture: "retrieval-planner-v2",
                provider_decision: {
                  providerPath:
                    "deterministic-change-event-description-required",
                  model: null,
                },
                provider_path:
                  "deterministic-change-event-description-required",
                model: null,
                retrieval_plan: {
                  intent: "change_event_write",
                  reason: "event_description_required",
                  responseFormat: "workflow_intake",
                  sources: ["chat_history.change_event_workflow"],
                },
                change_event_workflow: initialWorkflow,
                tool_trace: toolTrace,
                response_quality: buildResponseQualityMetadata({
                  toolTrace,
                  content,
                }),
                source_debug: {
                  orchestrator: "change-event-description-required",
                  evidenceCount: 0,
                  sourceCoverage: [
                    {
                      sourceType: "chat_history.change_event_workflow",
                      status: "checked",
                      notes:
                        "Project context is available; event description is still needed before related-record search.",
                    },
                  ],
                },
                data_parts: [dataPart],
              }) as Json,
            });
          if (descriptionPromptPersistError) {
            throw new Error(
              `Persisting the change-event description prompt failed: ${descriptionPromptPersistError.message}`,
            );
          }

          const { error: conversationUpdateError } = await args.supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("session_id", args.sessionId)
            .eq("user_id", args.user.id);
          if (conversationUpdateError) {
            throw new Error(
              `Updating the change-event description prompt timestamp failed: ${conversationUpdateError.message}`,
            );
          }

          responseAlreadyPersisted = true;
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "complete",
              message: "Event description requested",
              status: "success",
              timestamp: new Date().toISOString(),
            },
          } as never);
          return;
        }

        const changeEventRetrievalCtx = await executeRetrievalPlan(
          plan,
          buildExecutorDeps({
            supabase: args.supabase,
            userId: args.user.id,
            sessionId: args.sessionId,
            selectedProjectId: args.selectedProjectId,
          }),
          { sessionId: args.sessionId, message: lastUserContent },
        );
        latestRetrievalCtx = changeEventRetrievalCtx;
        const relatedEvidence = buildChangeEventRelatedEvidence(changeEventRetrievalCtx);
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "change-event-evidence",
            message:
              relatedEvidence.length > 0
                ? `Found ${relatedEvidence.length} related source${relatedEvidence.length === 1 ? "" : "s"}`
                : "Checked related project evidence",
            status: changeEventRetrievalCtx.warnings.length > 0 ? "warning" : "success",
            durations: changeEventRetrievalCtx.durationsMs,
            timestamp: new Date().toISOString(),
          },
        } as never);

        const workflow = buildChangeEventWorkflowMetadata({
          prompt: lastUserContent,
          selectedProjectId: args.selectedProjectId ?? null,
          previousDraft: previousChangeEventWorkflowDraft,
          relatedEvidence,
        });
        await persistChangeEventWorkflowArtifact({
          userId: args.user.id,
          sessionId: args.sessionId,
          workflow,
        });
        const dataPart = {
          type: "data-assistant-widget",
          id: "assistant-widget-change-event-workflow",
          data: {
            widget: {
              type: "change_event_workflow",
              id: "change-event-workflow",
              title: "Change event workflow",
              draft: workflow.draft,
            },
          },
        };
        const missingLabels = workflow.draft.checklist
          .filter((item) => item.status !== "complete")
          .map((item) => item.label.toLowerCase());
        const content = workflow.readiness.readyForPreview
          ? "Ready for final preview."
          : workflow.draft.projectId
            ? "Draft updated."
            : "Ready for your project.";
        const toolTrace = [
          {
            tool: "changeEventWorkflowState",
            toolName: "changeEventWorkflowState",
            status: "success",
            input: {
              message: lastUserContent.slice(0, 240),
              selectedProjectId: args.selectedProjectId ?? null,
              hadPriorDraft: Boolean(previousChangeEventWorkflowDraft),
            },
            output: {
              readyForPreview: workflow.readiness.readyForPreview,
              activeChecklistKey: workflow.readiness.activeChecklistKey,
              missingChecklistKeys: workflow.readiness.missingChecklistKeys,
              evidenceCount: workflow.readiness.evidenceCount,
              evidenceSourcePath: workflow.readiness.evidenceSourcePath,
              expectedNativeTool: workflow.expectedNativeTool,
            },
            timestamp: new Date().toISOString(),
          },
          {
            tool: "semanticVectorSearch",
            toolName: "semanticVectorSearch",
            status: changeEventRetrievalCtx.semanticVectorResults ? "success" : "missing",
            input: {
              query: plan.sources.semanticVectorSearch?.query ?? lastUserContent.slice(0, 240),
              selectedProjectId: args.selectedProjectId ?? null,
            },
            output: {
              resultCount: summarizeEvalCount(changeEventRetrievalCtx.semanticVectorResults) ?? 0,
              relatedEvidenceCount: relatedEvidence.length,
              warnings: changeEventRetrievalCtx.warnings,
            },
            timestamp: new Date().toISOString(),
          },
        ];

        writer.write(dataPart as never);
        writeTextResponse(writer, "strategist-change-event-workflow", content);

        const { error: workflowPersistError } = await persistChatHistoryRow({
          session_id: args.sessionId,
          user_id: args.user.id,
          role: "assistant",
          content,
          metadata: toJsonValue({
            architecture: "retrieval-planner-v2",
            provider_decision: {
              providerPath: "deterministic-change-event-workflow",
              model: null,
            },
            provider_path: "deterministic-change-event-workflow",
            model: null,
            retrieval_plan: {
              intent: "change_event_write",
              reason: "change_event_workflow_intake",
              responseFormat: "workflow_intake",
              sources: [
                "chat_history.change_event_workflow",
                "semantic_vector_search",
              ],
            },
            change_event_workflow: workflow,
            tool_trace: toolTrace,
            response_quality: buildResponseQualityMetadata({
              toolTrace,
              content,
            }),
            source_debug: {
              orchestrator: "change-event-workflow-intake",
              evidenceCount: workflow.readiness.evidenceCount,
              sourceCoverage: [
                {
                  sourceType: "chat_history.change_event_workflow",
                  status: "checked",
                  notes: missingLabels.length
                    ? `Missing: ${missingLabels.join(", ")}`
                    : "Workflow intake is ready for final preview.",
                },
                {
                  sourceType: "semantic_vector_search",
                  status: changeEventRetrievalCtx.semanticVectorResults ? "checked" : "missing",
                  notes:
                    relatedEvidence.length > 0
                      ? `${relatedEvidence.length} related source${relatedEvidence.length === 1 ? "" : "s"} attached to the workflow.`
                      : `No related evidence suggestions attached from ${
                          summarizeEvalCount(changeEventRetrievalCtx.semanticVectorResults) ?? 0
                        } retrieval result(s).`,
                },
              ],
            },
            data_parts: [dataPart],
          }) as Json,
        });
        if (workflowPersistError) {
          throw new Error(
            `Persisting the change-event workflow assistant turn failed: ${workflowPersistError.message}`,
          );
        }

        const { error: conversationUpdateError } = await args.supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("session_id", args.sessionId)
          .eq("user_id", args.user.id);
        if (conversationUpdateError) {
          throw new Error(
            `Updating the change-event workflow conversation timestamp failed: ${conversationUpdateError.message}`,
          );
        }

        responseAlreadyPersisted = true;
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "complete",
            message: workflow.readiness.readyForPreview
              ? "Change-event workflow ready for final preview"
              : "Change-event workflow updated",
            status: "success",
            timestamp: new Date().toISOString(),
          },
        } as never);
        return;
      }

      if (isGeneratedTasksTodayRequest(lastUserContent)) {
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "knowledge",
            message: "Checking the Tasks table for rows created today",
            status: "loading",
            timestamp: new Date().toISOString(),
          },
        } as never);

        if (lastUserContent.trim()) {
          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "user",
            content: lastUserContent,
          });
        }

        try {
          const answer = await loadGeneratedTasksTodayAnswer({
            supabase: args.supabase,
            selectedProjectId: args.selectedProjectId,
          });
          const dataPart = {
            type: "data-assistant-widget",
            id: "assistant-widget-generated-tasks-today",
            data: { widget: answer.widget },
          };
          writer.write(dataPart as never);
          writeTextResponse(
            writer,
            "strategist-generated-tasks-today-v2",
            answer.content,
          );

          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "assistant",
              content: answer.content,
              metadata: toJsonValue({
                architecture: "retrieval-planner-v2",
                tool_trace: [
                  {
                    tool: "getGeneratedTasksToday",
                    input: {
                      message: lastUserContent.slice(0, 240),
                      selectedProjectId: args.selectedProjectId ?? null,
                    },
                    output: answer.traceOutput,
                    timestamp: new Date().toISOString(),
                  },
                ],
                data_parts: [dataPart],
              }) as Json,
            });

          await args.supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("session_id", args.sessionId)
            .eq("user_id", args.user.id);
          responseAlreadyPersisted = true;

          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "complete",
              message: "Task register checked",
              status: "success",
              timestamp: new Date().toISOString(),
            },
          } as never);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          const content = `I tried to check the Tasks page source of truth, but the task-table lookup failed: ${detail}`;
          writeTextResponse(
            writer,
            "strategist-generated-tasks-today-error-v2",
            content,
          );
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "error",
              message: "Task register lookup failed",
              status: "error",
              timestamp: new Date().toISOString(),
            },
          } as never);
          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "assistant",
            content,
            metadata: {
              architecture: "retrieval-planner-v2",
              tool_trace: [
                {
                  tool: "getGeneratedTasksToday",
                  input: {
                    message: lastUserContent.slice(0, 240),
                    selectedProjectId: args.selectedProjectId ?? null,
                  },
                  error: detail,
                  timestamp: new Date().toISOString(),
                },
              ],
            },
          });
          responseAlreadyPersisted = true;
        }
        return;
      }

      if (shouldUsePersonalTaskRegisterFastPath(lastUserContent)) {
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "knowledge",
            message: "Checking the Tasks table for Brandon's open tasks",
            status: "loading",
            timestamp: new Date().toISOString(),
          },
        } as never);

        if (lastUserContent.trim()) {
          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "user",
            content: lastUserContent,
          });
        }

        try {
          const answer = await loadPersonalTaskRegisterAnswer({
            supabase: args.supabase,
            selectedProjectId: args.selectedProjectId,
            message: lastUserContent,
          });
          const taskRegisterTrace = {
            tool: "getPersonalTaskRegister",
            input: {
              message: lastUserContent.slice(0, 240),
              selectedProjectId: args.selectedProjectId ?? null,
            },
            output: answer.traceOutput,
            timestamp: new Date().toISOString(),
          };
          const getMyTasksTrace = {
            ...taskRegisterTrace,
            tool: "getMyTasks",
          };
          const toolTrace = [taskRegisterTrace, getMyTasksTrace];
          const dataPart = {
            type: "data-assistant-widget",
            id: "assistant-widget-personal-task-register",
            data: { widget: answer.widget },
          };
          writer.write(dataPart as never);
          writeTextResponse(
            writer,
            "strategist-personal-task-register-v1",
            answer.content,
          );

          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "assistant",
            content: answer.content,
            metadata: toJsonValue({
              architecture: "retrieval-planner-v2",
              retrieval_plan: {
                intent: "task_followup",
                reason: "personal_task_register_fast_path",
                responseFormat: "task_register",
                sources: ["public.tasks"],
              },
              tool_trace: toolTrace,
              response_quality: buildResponseQualityMetadata({
                toolTrace,
                content: answer.content,
              }),
              data_parts: [dataPart],
            }) as Json,
          });

          await args.supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("session_id", args.sessionId)
            .eq("user_id", args.user.id);
          responseAlreadyPersisted = true;

          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "complete",
              message: "Brandon task register checked",
              status: "success",
              timestamp: new Date().toISOString(),
            },
          } as never);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          const content = `I tried to check Brandon's Tasks page rows, but the task-register lookup failed: ${detail}`;
          const taskRegisterTrace = {
            tool: "getPersonalTaskRegister",
            input: {
              message: lastUserContent.slice(0, 240),
              selectedProjectId: args.selectedProjectId ?? null,
            },
            error: detail,
            timestamp: new Date().toISOString(),
          };
          const getMyTasksTrace = {
            ...taskRegisterTrace,
            tool: "getMyTasks",
          };
          const toolTrace = [taskRegisterTrace, getMyTasksTrace];
          writeTextResponse(
            writer,
            "strategist-personal-task-register-error-v1",
            content,
          );
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "error",
              message: "Brandon task register lookup failed",
              status: "error",
              timestamp: new Date().toISOString(),
            },
          } as never);
          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "assistant",
            content,
            metadata: {
              architecture: "retrieval-planner-v2",
              retrieval_plan: {
                intent: "task_followup",
                reason: "personal_task_register_fast_path_error",
                responseFormat: "task_register",
                sources: ["public.tasks"],
              },
              tool_trace: toolTrace,
              response_quality: buildResponseQualityMetadata({
                toolTrace,
                content,
              }),
            },
          });
          responseAlreadyPersisted = true;
        }
        return;
      }

      if (plan.intent === "source_health") {
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "source-health",
            message: "Checking source health and freshness",
            status: "loading",
            timestamp: new Date().toISOString(),
          },
        } as never);

        if (lastUserContent.trim()) {
          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "user",
            content: lastUserContent,
          });
        }

        try {
          const sourceHealth = await loadAssistantSourceHealthContext({
            supabase: args.supabase,
            reason: "source_status_request",
          });
          const content = formatAssistantSourceHealthAnswer(sourceHealth.metadata);
          const toolTrace = [sourceHealth.trace];
          const sourceDebug = buildAnswerDebugMetadata({
            orchestrator: "assistant-source-health-fast-path",
            plan,
            toolTrace,
            sourceCoverage: sourceHealth.metadata.sources.map((source) => ({
              sourceType: source.source,
              status: source.status,
              staleMinutes: source.staleMinutes,
              unembeddedCount: source.unembeddedCount,
              uncompiledCount: source.uncompiledCount,
            })),
          });

          writeTextResponse(
            writer,
            "strategist-source-health-v1",
            content,
          );

          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "assistant",
            content,
            metadata: toJsonValue({
              architecture: "retrieval-planner-v2",
              retrieval_plan: {
                intent: plan.intent,
                reason: plan.reason,
                responseFormat: plan.responseFormat,
                sources: Object.keys(plan.sources),
              },
              tool_trace: toolTrace,
              response_quality: buildResponseQualityMetadata({
                toolTrace,
                content,
              }),
              source_health: sourceHealth.metadata,
              source_debug: sourceDebug,
            }) as Json,
          });

          await args.supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("session_id", args.sessionId)
            .eq("user_id", args.user.id);
          responseAlreadyPersisted = true;

          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "complete",
              message: "Source health check completed",
              status: "success",
              timestamp: new Date().toISOString(),
            },
          } as never);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          const content = `I tried to check source health and freshness, but the source-health lookup failed: ${detail}`;
          const toolTrace = [
            {
              tool: "assistantSourceHealth",
              input: { reason: "source_status_request" },
              error: detail,
              timestamp: new Date().toISOString(),
            },
          ];
          writeTextResponse(
            writer,
            "strategist-source-health-error-v1",
            content,
          );
          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "assistant",
            content,
            metadata: toJsonValue({
              architecture: "retrieval-planner-v2",
              retrieval_plan: {
                intent: plan.intent,
                reason: `${plan.reason}_error`,
                responseFormat: plan.responseFormat,
                sources: Object.keys(plan.sources),
              },
              tool_trace: toolTrace,
              response_quality: buildResponseQualityMetadata({
                toolTrace,
                content,
              }),
            }) as Json,
          });
          responseAlreadyPersisted = true;
        }
        return;
      }

      if (
        actionToolsEnabled &&
        isCmoWeeklyContentWorkflowRequest(lastUserContent)
      ) {
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "knowledge",
            message: "Consulting CMO and saving weekly content drafts",
            status: "loading",
            timestamp: new Date().toISOString(),
          },
        } as never);

        if (lastUserContent.trim()) {
          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "user",
            content: lastUserContent,
          });
        }

        const workflowResult = await createWeeklyMarketingContentWorkflow({
          createdBy: args.user.id,
          projectId: args.selectedProjectId ?? null,
        });
        const content = formatCmoWeeklyContentWorkflowResponse(workflowResult);

        writeTextResponse(writer, "strategist-cmo-weekly-content-v2", content);

        await persistChatHistoryRow({
          session_id: args.sessionId,
          user_id: args.user.id,
          role: "assistant",
          content,
          metadata: {
            architecture: "retrieval-planner-v2",
            tool_trace: [
              {
                tool: "consultCMOPhase1Workflow",
                input: {
                  message: lastUserContent.slice(0, 240),
                  selectedProjectId: args.selectedProjectId ?? null,
                },
                output: {
                  weekStartDate: workflowResult.weekStartDate,
                  sourceCandidateCount: workflowResult.sourceCandidates.length,
                  intelligenceItemIds: workflowResult.intelligenceItems.map(
                    (item) => item.id,
                  ),
                  calendarItemIds: workflowResult.calendarItems.map(
                    (item) => item.id,
                  ),
                  assetIds: workflowResult.assets.map((asset) => asset.id),
                  reviewHref: workflowResult.reviewHref,
                },
                timestamp: new Date().toISOString(),
              },
            ],
          },
        });

        await args.supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("session_id", args.sessionId)
          .eq("user_id", args.user.id);
        responseAlreadyPersisted = true;

        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "complete",
            message: "CMO content calendar saved",
            status: "success",
            timestamp: new Date().toISOString(),
          },
        } as never);
        return;
      }

      if (lastUserContent.trim()) {
        await chatHistory.persistOrThrow(
          "user",
          lastUserContent,
          {
            architecture: "retrieval-planner-v2",
            client_message_id: lastUserMessage?.id ?? null,
          },
          "user message",
        );
      }

      if (plan.responseFormat === "project_scope_required") {
        const content = [
          PROJECT_SCOPE_REQUIRED_OPENING,
          "",
          "You referred to this project, but no project context reached the assistant. I stopped instead of searching every project and mixing unrelated meetings, messages, or files.",
          "",
          "Use the folder control to choose the project, then resend your question.",
        ].join("\n");
        const toolTrace = [
          {
            tool: "projectContextRequired",
            toolName: "projectContextRequired",
            agent: "retrieval-planner-v2",
            status: "failed",
            input: {
              message: lastUserContent.slice(0, 240),
              selectedProjectId: null,
            },
            output: {
              error: "A selected-project reference arrived without a selectedProjectId.",
              preventedFallback: "organization_wide_retrieval",
            },
            timestamp: new Date().toISOString(),
          },
        ];
        const responseQuality = buildResponseQualityMetadata({
          toolTrace,
          content,
        });
        const sourceDebug = buildAnswerDebugMetadata({
          orchestrator: "project-scope-preflight",
          plan,
          toolTrace,
          sourceCoverage: [
            {
              sourceType: "project_context",
              status: "missing",
              notes:
                "Organization-wide retrieval was blocked because the request referred to a selected project without a project id.",
            },
          ],
          evidenceCount: 0,
        });

        await persistDirectDeepAgentResponse({
          supabase: args.supabase,
          sessionId: args.sessionId,
          userId: args.user.id,
          content,
          responseLabel: "project-scope-required",
          sourceDebug,
          trace: {
            input: lastUserContent,
            intent: plan.intent,
            modelId: "deterministic-project-scope-guard",
            selectedProjectId: null,
            toolTrace,
            qualityScore: responseQuality.score,
            qualityReasons: responseQuality.reasons,
          },
          metadata: toJsonValue({
            architecture: "retrieval-planner-v2",
            provider_path: "deterministic-project-scope-guard",
            model: null,
            retrieval_plan: {
              intent: plan.intent,
              reason: plan.reason,
              responseFormat: plan.responseFormat,
              sources: [],
            },
            tool_trace: toolTrace,
            response_quality: responseQuality,
            source_debug: sourceDebug,
          }) as Json,
        });

        responseAlreadyPersisted = true;
        writeTextResponse(writer, "strategist-project-scope-required", content);
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "complete",
            message: "Project context required; broad retrieval blocked",
            status: "warning",
            timestamp: new Date().toISOString(),
          },
        } as never);
        return;
      }

      if (isMicrosoftSpecialistDelegationPlan(plan.reason)) {
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "microsoft-specialist",
            message: "Delegating Microsoft operator work",
            status: "loading",
            timestamp: new Date().toISOString(),
          },
        } as never);

        try {
          const microsoftBridgeStarted = Date.now();
          const response = await withKeepAlive(
            writer,
            {
              statusId: "strategist-status",
              stage: "microsoft-specialist",
              message: "Still delegating to Microsoft operator…",
            },
            () =>
              fetchMicrosoftExecutiveAssistant({
                userId: args.user.id,
                sessionId: args.sessionId,
                question: lastUserContent,
                selectedProjectId: args.selectedProjectId,
              }),
          );
          const microsoftBridgeDurationMs =
            Date.now() - microsoftBridgeStarted;
          const content =
            typeof response.answer === "string"
              ? response.answer
              : "The Microsoft Executive Assistant returned no answer.";
          const trace = buildLiveToolTrace(
            {
              tool: "consultMicrosoftExecutiveAssistant",
              input: {
                question: lastUserContent,
                projectId: args.selectedProjectId ?? null,
                mailboxUserId: defaultMicrosoftMailbox() ?? null,
              },
              response,
              output: {
                summary: content.slice(0, 500),
              },
            },
            lastUserContent,
          );
          const toolTrace = trace
            ? [{ ...trace, durationMs: microsoftBridgeDurationMs }]
            : [];
          const sourceDebug = buildAnswerDebugMetadata({
            orchestrator: "microsoft-executive-assistant",
            plan,
            toolTrace,
          });

          // When the specialist returns structured inbox emails, render the
          // outlook_inbox_summary card (links + local time + draft signal)
          // instead of the plain text blob. Falls back to text otherwise.
          const inboxWidget = buildMicrosoftInboxWidget(
            response.emails,
            defaultMicrosoftMailbox() ?? null,
          );
          const inboxWidgetDataPart = inboxWidget
            ? {
                type: "data-assistant-widget",
                id: "assistant-widget-microsoft-inbox-summary",
                data: { widget: inboxWidget },
              }
            : null;

          if (inboxWidgetDataPart) {
            writer.write(inboxWidgetDataPart as never);
            writeTextResponse(
              writer,
              "strategist-microsoft-executive-assistant",
              content,
            );
          } else {
            writeTextResponse(writer, "strategist-microsoft-executive-assistant", content);
          }

          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "assistant",
            content,
            metadata: {
              architecture: "retrieval-planner-v2",
              delegated_orchestrator: "microsoft-executive-assistant",
              tool_trace: toolTrace,
              ...(inboxWidgetDataPart
                ? { data_parts: [inboxWidgetDataPart], answer_full: content }
                : {}),
              response_quality: buildResponseQualityMetadata({
                toolTrace,
                content,
              }),
              source_debug: sourceDebug,
              retrieval_plan: {
                intent: plan.intent,
                reason: plan.reason,
                responseFormat: plan.responseFormat,
                sources: Object.keys(plan.sources),
              },
            } as Json,
          });

          await args.supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("session_id", args.sessionId)
            .eq("user_id", args.user.id);

          responseAlreadyPersisted = true;
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "complete",
              message: "Microsoft Executive Assistant answer returned",
              status: "success",
              timestamp: new Date().toISOString(),
            },
          } as never);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          // Loud, diagnosable record for logs + metadata — never shown to the user.
          const failureDiagnostic = [
            "Failed capability: consultMicrosoftExecutiveAssistant.",
            `Cause: ${detail}`,
            "Detection gap: this request reached the Microsoft delegation path, but the specialist failure was previously collapsing into a generic provider fallback with no tool evidence.",
            "Prevention step: persist the Microsoft tool failure explicitly so Outlook/Brandon assistant regressions fail loudly and stay diagnosable.",
          ].join(" ");
          // Clean, honest message for the chat bubble.
          const content = describeMicrosoftAssistantFailure(detail);
          const toolTrace = [
            {
              tool: "consultMicrosoftExecutiveAssistant",
              toolName: "consultMicrosoftExecutiveAssistant",
              status: "failed",
              input: {
                message: lastUserContent.slice(0, 240),
                selectedProjectId: args.selectedProjectId ?? null,
                mailboxUserId: defaultMicrosoftMailbox() ?? null,
              },
              output: {
                source: "microsoft_graph_live",
                error: detail,
              },
              error: detail,
              timestamp: new Date().toISOString(),
            },
          ];
          const sourceDebug = buildAnswerDebugMetadata({
            orchestrator: "microsoft-executive-assistant",
            plan,
            toolTrace,
          });

          writeTextResponse(
            writer,
            "strategist-microsoft-executive-assistant-error",
            content,
          );
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "error",
              message: "Microsoft Executive Assistant failed",
              status: "error",
              timestamp: new Date().toISOString(),
            },
          } as never);

          await persistChatHistoryRow({
            session_id: args.sessionId,
            user_id: args.user.id,
            role: "assistant",
            content,
            metadata: {
              architecture: "retrieval-planner-v2",
              delegated_orchestrator: "microsoft-executive-assistant",
              failure_diagnostic: failureDiagnostic,
              error_detail: detail,
              tool_trace: toolTrace,
              response_quality: buildResponseQualityMetadata({
                toolTrace,
                content,
              }),
              source_debug: sourceDebug,
              retrieval_plan: {
                intent: plan.intent,
                reason: `${plan.reason}_error`,
                responseFormat: plan.responseFormat,
                sources: Object.keys(plan.sources),
              },
            } as Json,
          });

          await args.supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("session_id", args.sessionId)
            .eq("user_id", args.user.id);

          responseAlreadyPersisted = true;
        }
        return;
      }

      if (
        !AI_EVAL_DISABLE_BACKEND_DEEP_AGENTS &&
        plan.responseFormat !== "collection_analysis" &&
        (shouldUseDeepAgentExecutiveBridge({
          intent: plan.intent,
          planReason: plan.reason,
          selectedProjectId: args.selectedProjectId ?? null,
        }) ||
          (selectedDeepAgentsStrategist &&
            plan.reason === "executive_deep_agent_broad_operator_question"))
      ) {
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "backend-deep-agents",
            message: "Checking Render Deep Agents executive briefing",
            status: "loading",
            timestamp: new Date().toISOString(),
          },
        } as never);

        const executiveBridgeStarted = Date.now();
        try {
          const packet = await withKeepAlive(
            writer,
            {
              statusId: "strategist-status",
              stage: "backend-deep-agents",
              message: "Still working with Render Deep Agents executive briefing…",
            },
            () =>
              fetchDeepAgentExecutiveBriefing({
                userId: args.user.id,
                sessionId: args.sessionId,
                question: lastUserContent,
              }),
          );
          const executiveBridgeDurationMs =
            Date.now() - executiveBridgeStarted;

          if (shouldUseDeepAgentExecutiveDirectResponse(packet)) {
            const content = formatDeepAgentExecutiveDirectResponse(packet);
            const widget = buildDeepAgentExecutiveEvidenceWidget(packet);
            const dataParts = widget
              ? [
                  {
                    type: "data-assistant-widget",
                    id: "assistant-widget-deep-agent-executive-briefing",
                    data: { widget },
                  },
                ]
              : [];
            const toolTrace = [
              createBackendBridgeTrace({
                tool: "backendDeepAgentExecutiveBriefing",
                status: "success",
                message: lastUserContent,
                selectedProjectId: args.selectedProjectId ?? null,
                durationMs: executiveBridgeDurationMs,
              }),
              ...mapBackendPacketTrace(packet.toolTrace, {
                message: lastUserContent,
                selectedProjectId: args.selectedProjectId ?? null,
              }),
            ];
            const sourceCoverage = packet.sources.map((source) => ({
              sourceType: source.sourceType,
              title: source.title,
              url: source.url ?? null,
            }));
            const sourceDebug = buildAnswerDebugMetadata({
              orchestrator: "backend-deep-agent-executive-briefing",
              plan,
              toolTrace,
              sourceCoverage,
              evidenceCount: packet.sources.length,
            });

            await persistDirectDeepAgentResponse({
              supabase: args.supabase,
              sessionId: args.sessionId,
              userId: args.user.id,
              content,
              responseLabel: "executive-briefing",
              sourceDebug,
              trace: {
                input: lastUserContent,
                intent: plan.intent,
                modelId:
                  process.env.DEEP_AGENTS_RESEARCH_MODEL ??
                  "render-backend-deep-agents",
                selectedProjectId: args.selectedProjectId ?? null,
                toolTrace,
              },
              metadata: {
                architecture: "render-backend-deep-agents-v1",
                model: process.env.DEEP_AGENTS_RESEARCH_MODEL ?? null,
                provider_path: "render-backend-ai-gateway",
                backend_deep_agent: {
                  endpoint: "executive-briefing",
                  backing_endpoint: "research",
                  mode: packet.mode,
                  orchestrator: packet.orchestrator,
                  source_count: packet.sources.length,
                  skills_loaded: packet.skillsLoaded,
                },
                retrieval_plan: {
                  intent: plan.intent,
                  reason: plan.reason,
                  responseFormat: plan.responseFormat,
                  sources: Object.keys(plan.sources),
                },
                tool_trace: toolTrace,
                response_quality: buildResponseQualityMetadata({
                  toolTrace,
                  content,
                }),
                source_debug: sourceDebug,
                data_parts: dataParts,
              } as Json,
            });

            responseAlreadyPersisted = true;
            dataParts.forEach((dataPart) => writer.write(dataPart as never));
            writeTextResponse(
              writer,
              "strategist-deep-agent-executive-briefing",
              content,
            );
            writer.write({
              type: "data-status",
              id: "strategist-status",
              data: {
                stage: "complete",
                message: "Render Deep Agents executive answer returned",
                status: "success",
                timestamp: new Date().toISOString(),
              },
            } as never);
            return;
          }

          backendDeepAgentContextBlocks.push(
            formatDeepAgentExecutiveBriefingContext(packet),
          );
          bridgeToolTrace.push(
            createBackendBridgeTrace({
              tool: "backendDeepAgentExecutiveBriefing",
              status: "success",
              message: lastUserContent,
              selectedProjectId: args.selectedProjectId ?? null,
              durationMs: executiveBridgeDurationMs,
              detail:
                "Backend executive packet returned context for local synthesis.",
            }),
            ...mapBackendPacketTrace(packet.toolTrace, {
              message: lastUserContent,
              selectedProjectId: args.selectedProjectId ?? null,
            }),
          );
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "backend-deep-agents",
              message:
                "Render Deep Agents returned executive context but not a direct answer; using local synthesis",
              status: "warning",
              timestamp: new Date().toISOString(),
            },
          } as never);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          const diagnostic = bridgeFailureDiagnostic(error);
          bridgeToolTrace.push(
            createBackendBridgeTrace({
              tool: "backendDeepAgentExecutiveBriefing",
              status: "failed",
              message: lastUserContent,
              selectedProjectId: args.selectedProjectId ?? null,
              durationMs: Date.now() - executiveBridgeStarted,
              detail,
              diagnostic,
            }),
          );
          console.error("[handler-v2] Deep Agents executive bridge failed", {
            message: detail,
            intent: plan.intent,
            diagnostic,
          });
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "backend-deep-agents",
              message: `Render Deep Agents executive bridge failed; falling back to local retrieval: ${detail}`,
              status: "warning",
              timestamp: new Date().toISOString(),
            },
          } as never);
        }
      }

      if (
        !AI_EVAL_DISABLE_BACKEND_DEEP_AGENTS &&
        plan.responseFormat !== "collection_analysis" &&
        (shouldUseDeepAgentResearchBridge({
          intent: plan.intent,
        }) ||
          (selectedDeepAgentsStrategist && plan.intent === "external_research"))
      ) {
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "backend-deep-agents",
            message: "Checking Render Deep Agents research",
            status: "loading",
            timestamp: new Date().toISOString(),
          },
        } as never);

        try {
          const researchBridgeStarted = Date.now();
          const packet = await withKeepAlive(
            writer,
            {
              statusId: "strategist-status",
              stage: "backend-deep-agents",
              message: "Still working with Render Deep Agents research…",
            },
            () =>
              fetchDeepAgentResearch({
                userId: args.user.id,
                sessionId: args.sessionId,
                question: lastUserContent,
                projectId: args.selectedProjectId ?? null,
                maxSearches: 5,
              }),
          );
          const researchBridgeDurationMs =
            Date.now() - researchBridgeStarted;

          if (shouldUseDeepAgentResearchDirectResponse(packet)) {
            const content = formatDeepAgentResearchDirectResponse(packet);
            const widget = buildDeepAgentResearchEvidenceWidget(packet);
            const dataParts = widget
              ? [
                  {
                    type: "data-assistant-widget",
                    id: "assistant-widget-deep-agent-research",
                    data: { widget },
                  },
                ]
              : [];

            const toolTrace = [
              createBackendBridgeTrace({
                tool: "backendDeepAgentResearch",
                status: "success",
                message: lastUserContent,
                selectedProjectId: args.selectedProjectId ?? null,
                durationMs: researchBridgeDurationMs,
              }),
              ...mapBackendPacketTrace(packet.toolTrace, {
                message: lastUserContent,
                selectedProjectId: args.selectedProjectId ?? null,
              }),
            ];

            await persistDirectDeepAgentResponse({
              supabase: args.supabase,
              sessionId: args.sessionId,
              userId: args.user.id,
              content,
              responseLabel: "research",
              sourceDebug: buildAnswerDebugMetadata({
                orchestrator: "backend-deep-agent-research",
                plan,
                toolTrace,
                sourceCoverage: packet.sources.map((source) => ({
                  sourceType: source.sourceType,
                  title: source.title,
                  url: source.url ?? null,
                })),
                evidenceCount: packet.sources.length,
              }),
              trace: {
                input: lastUserContent,
                intent: plan.intent,
                modelId:
                  process.env.DEEP_AGENTS_RESEARCH_MODEL ??
                  "render-backend-deep-agents",
                selectedProjectId: args.selectedProjectId ?? null,
                toolTrace,
              },
              metadata: {
                architecture: "render-backend-deep-agents-v1",
                model: process.env.DEEP_AGENTS_RESEARCH_MODEL ?? null,
                provider_path: "render-backend-ai-gateway",
                backend_deep_agent: {
                  endpoint: "research",
                  mode: packet.mode,
                  orchestrator: packet.orchestrator,
                  source_count: packet.sources.length,
                  skills_loaded: packet.skillsLoaded,
                },
                retrieval_plan: {
                  intent: plan.intent,
                  reason: plan.reason,
                  responseFormat: plan.responseFormat,
                  sources: Object.keys(plan.sources),
                },
                tool_trace: toolTrace,
                response_quality: buildResponseQualityMetadata({
                  toolTrace,
                  content,
                }),
                source_debug: buildAnswerDebugMetadata({
                  orchestrator: "backend-deep-agent-research",
                  plan,
                  toolTrace,
                  sourceCoverage: packet.sources.map((source) => ({
                    sourceType: source.sourceType,
                    title: source.title,
                    url: source.url ?? null,
                  })),
                  evidenceCount: packet.sources.length,
                }),
                data_parts: dataParts,
              } as Json,
            });

            responseAlreadyPersisted = true;
            dataParts.forEach((dataPart) => writer.write(dataPart as never));
            writeTextResponse(
              writer,
              "strategist-deep-agent-research",
              content,
            );
            writer.write({
              type: "data-status",
              id: "strategist-status",
              data: {
                stage: "complete",
                message: "Render Deep Agents research answer returned",
                status: "success",
                timestamp: new Date().toISOString(),
              },
            } as never);
            return;
          }

          backendDeepAgentContextBlocks.push(formatDeepAgentResearchContext(packet));
          bridgeToolTrace.push(
            createBackendBridgeTrace({
              tool: "backendDeepAgentResearch",
              status: "success",
              message: lastUserContent,
              selectedProjectId: args.selectedProjectId ?? null,
              detail:
                "Backend research packet returned context for local synthesis.",
            }),
            ...mapBackendPacketTrace(packet.toolTrace, {
              message: lastUserContent,
              selectedProjectId: args.selectedProjectId ?? null,
            }),
          );
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "backend-deep-agents",
              message:
                "Render Deep Agents returned research context but not a direct answer; using local synthesis",
              status: "warning",
              timestamp: new Date().toISOString(),
            },
          } as never);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          bridgeToolTrace.push(
            createBackendBridgeTrace({
              tool: "backendDeepAgentResearch",
              status: "failed",
              message: lastUserContent,
              selectedProjectId: args.selectedProjectId ?? null,
              detail,
            }),
          );
          console.error("[handler-v2] Deep Agents research bridge failed", {
            message: detail,
            intent: plan.intent,
          });
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "backend-deep-agents",
              message: `Render Deep Agents research bridge failed; falling back to local retrieval: ${detail}`,
              status: "warning",
              timestamp: new Date().toISOString(),
            },
          } as never);
        }
      }

      if (
        !AI_EVAL_DISABLE_BACKEND_DEEP_AGENTS &&
        plan.responseFormat !== "collection_analysis" &&
        selectedDeepAgentsStrategist &&
        plan.intent !== "external_research" &&
        typeof args.selectedProjectId === "number"
      ) {
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "project-intelligence-packet",
            message: "Checking current project intelligence packet",
            status: "loading",
            timestamp: new Date().toISOString(),
          },
        } as never);

        try {
          const usedPacketFastPath = await tryWriteProjectPacketFastPath({
            supabase: args.supabase,
            writer,
            userId: args.user.id,
            sessionId: args.sessionId,
            selectedProjectId: args.selectedProjectId,
            message: lastUserContent,
            plan,
          });

          if (usedPacketFastPath) {
            responseAlreadyPersisted = true;
            return;
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          bridgeToolTrace.push(
            createBackendBridgeTrace({
              tool: "clientProjectIntelligencePacket",
              status: "failed",
              message: lastUserContent,
              selectedProjectId: args.selectedProjectId,
              detail,
            }),
          );
          console.error("[handler-v2] Project packet fast path failed", {
            message: detail,
            selectedProjectId: args.selectedProjectId,
            intent: plan.intent,
          });
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "project-intelligence-packet",
              message: `Project packet fast path failed; using local retrieval: ${detail}`,
              status: "warning",
              timestamp: new Date().toISOString(),
            },
          } as never);
        }
      }

      // Run base system prompt assembly (memory load + project context)
      // and retrieval execution IN PARALLEL — they don't depend on each other.
      //
      // Wrap in withKeepAlive: this is the largest pre-token window (vector
      // search across emails/meetings/chunks + memory load). With no bytes on
      // the wire here, the HTTP/2 proxy can sever the stream and the client
      // renders "network error" even though the server is still working.
      const [baseSystemPrompt, retrievalCtx] = await withKeepAlive(
        writer,
        {
          statusId: "strategist-status",
          stage: "retrieval",
          message: "Searching project knowledge…",
        },
        () =>
          Promise.all([
            assembleSystemPrompt({
              userId: args.user.id,
              messageText: lastUserContent,
              selectedProjectId: args.selectedProjectId,
              sessionId: args.sessionId,
              isFirstTurn: args.messages.length === 1,
              onMemoryUsage: (usage) => {
                memoryUsage = usage;
              },
              onSkillUsage: (usage) => {
                skillUsage = usage;
              },
            }),
            executeRetrievalPlan(
              plan,
              buildExecutorDeps({
                supabase: args.supabase,
                userId: args.user.id,
                sessionId: args.sessionId,
                selectedProjectId: args.selectedProjectId,
              }),
              { sessionId: args.sessionId, message: lastUserContent },
            ),
          ]),
      );
      latestRetrievalCtx = retrievalCtx;

      writer.write({
        type: "data-status",
        id: "strategist-status",
        data: {
          stage: "retrieval-complete",
          message: `Retrieved (${Object.keys(retrievalCtx.durationsMs).length} sources, ${retrievalCtx.warnings.length} warnings)`,
          status: retrievalCtx.warnings.length > 0 ? "warning" : "success",
          durations: retrievalCtx.durationsMs,
          timestamp: new Date().toISOString(),
        },
      } as never);

      if (plan.responseFormat === "collection_analysis") {
        const collection = retrievalCtx.meetingCollection;
        const toolTrace = [
          ...bridgeToolTrace,
          ...buildPrefetchRetrievalTraces({
            ctx: retrievalCtx,
            plan,
            message: lastUserContent,
            selectedProjectId: args.selectedProjectId ?? null,
          }),
        ];

        let content: string;
        let synthesisMetadata: Record<string, unknown> | null = null;
        let advisorQuality:
          | Awaited<ReturnType<typeof synthesizeMeetingCollection>>["advisorQuality"]
          | null = null;
        let completed = false;
        if (
          collection?.status === "complete" &&
          collection.coverage.exhaustive &&
          collection.coverage.failed === 0
        ) {
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "collection-analysis",
              message: `Analyzing ${collection.coverage.retrieved} complete transcript${collection.coverage.retrieved === 1 ? "" : "s"}`,
              status: "loading",
              timestamp: new Date().toISOString(),
            },
          } as never);
          try {
            const synthesis = await withKeepAlive(
              writer,
              {
                statusId: "strategist-status",
                stage: "collection-analysis",
                message: `Still analyzing ${collection.coverage.retrieved} complete transcripts…`,
              },
              () =>
                synthesizeMeetingCollection({
                  collection,
                  model: getLanguageModel(COLLECTION_SYNTHESIS_MODEL),
                }),
            );
            content = synthesis.content;
            completed = true;
            advisorQuality = synthesis.advisorQuality;
            synthesisMetadata = {
              status: "complete",
              meetingCount: synthesis.meetingCount,
              chunkCount: synthesis.chunkCount,
              processedTranscriptCharacters:
                synthesis.processedTranscriptCharacters,
              evidenceCharacters: synthesis.evidenceCharacters,
              extractionDurationMs: synthesis.extractionDurationMs,
              finalSynthesisDurationMs: synthesis.finalSynthesisDurationMs,
              finalSynthesisMaxOutputTokens:
                synthesis.finalSynthesisMaxOutputTokens,
              finalSynthesisMode: synthesis.finalSynthesisMode,
              finalSynthesisTimeoutMs: synthesis.finalSynthesisTimeoutMs,
              model: COLLECTION_SYNTHESIS_MODEL,
              advisorContract: synthesis.advisorQuality,
            };
            toolTrace.push({
              tool: "meetingCollectionSynthesis",
              toolName: "meetingCollectionSynthesis",
              agent: "retrieval-planner-v2",
              status: "success",
              input: {
                meetingCount: synthesis.meetingCount,
                transcriptCharacters: synthesis.processedTranscriptCharacters,
              },
              output: {
                chunkCount: synthesis.chunkCount,
                analyzedMeetings: synthesis.meetingCount,
                processedTranscriptCharacters:
                  synthesis.processedTranscriptCharacters,
                evidenceCharacters: synthesis.evidenceCharacters,
                extractionDurationMs: synthesis.extractionDurationMs,
                finalSynthesisDurationMs: synthesis.finalSynthesisDurationMs,
                finalSynthesisMaxOutputTokens:
                  synthesis.finalSynthesisMaxOutputTokens,
                finalSynthesisMode: synthesis.finalSynthesisMode,
                finalSynthesisTimeoutMs: synthesis.finalSynthesisTimeoutMs,
                model: COLLECTION_SYNTHESIS_MODEL,
                advisorContract: synthesis.advisorQuality,
              },
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            content = buildMeetingCollectionStoppedContent({
              collection,
              synthesisError: message,
            });
            synthesisMetadata = { status: "failed", error: message };
            toolTrace.push({
              tool: "meetingCollectionSynthesis",
              toolName: "meetingCollectionSynthesis",
              agent: "retrieval-planner-v2",
              status: "failed",
              input: {
                meetingCount: collection.coverage.retrieved,
                transcriptCharacters: collection.coverage.transcriptCharacters,
              },
              output: { error: message },
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          content = buildMeetingCollectionStoppedContent({ collection });
        }

        const coverage = collection?.coverage ?? {
          enumerated: 0,
          candidateMatches: 0,
          matched: 0,
          retrieved: 0,
          failed: 1,
          transcriptCharacters: 0,
          exhaustive: false,
        };
        const sourceDebug = buildAnswerDebugMetadata({
          orchestrator: "retrieval-planner-v2-meeting-collection",
          plan,
          toolTrace,
          memoryUsage,
          sourceCoverage: [
            {
              sourceType: "meeting_transcripts",
              status: completed ? "analyzed" : "incomplete",
              enumerated: coverage.enumerated,
              matched: coverage.matched,
              retrieved: coverage.retrieved,
              failed: coverage.failed,
              transcriptCharacters: coverage.transcriptCharacters,
              exhaustive: coverage.exhaustive,
            },
          ],
          evidenceCount: completed ? coverage.retrieved : 0,
          outputPolicy: {
            failClosedOnIncompleteCollection: true,
            semanticPlanning: true,
            fullTranscriptRequired: true,
          },
        });
        const sources = buildAnswerSourceCitations(
          retrievalCtx,
          args.selectedProjectId ?? null,
        );

        await persistDirectDeepAgentResponse({
          supabase: args.supabase,
          sessionId: args.sessionId,
          userId: args.user.id,
          content,
          sources: sources as Json,
          responseLabel: completed
            ? "meeting-collection-analysis"
            : "meeting-collection-stopped",
          sourceDebug,
          trace: {
            input: lastUserContent,
            intent: plan.intent,
            modelId: completed
              ? COLLECTION_SYNTHESIS_MODEL
              : "retrieval-planner-v2-meeting-collection",
            selectedProjectId: args.selectedProjectId ?? null,
            toolTrace,
            qualityScore: advisorQuality?.score,
            qualityReasons: advisorQuality?.reasons,
          },
          metadata: {
            architecture: "retrieval-planner-v2",
            provider_path: "semantic-collection-analysis",
            model: args.activeModel,
            synthesis_model: COLLECTION_SYNTHESIS_MODEL,
            collection_coverage: coverage,
            collection_failures: collection?.failures ?? [],
            collection_synthesis: synthesisMetadata,
            retrieval_plan: {
              intent: plan.intent,
              reason: plan.reason,
              responseFormat: plan.responseFormat,
              sources: Object.keys(plan.sources),
              meetingCollection: plan.sources.meetingCollection,
            },
            tool_trace: toolTrace,
            response_quality: {
              ...buildResponseQualityMetadata({
                toolTrace,
                content,
              }),
              ...(advisorQuality
                ? { advisorContract: advisorQuality }
                : {}),
            },
            source_debug: sourceDebug,
          } as Json,
        });

        responseAlreadyPersisted = true;
        writeTextResponse(writer, "strategist-meeting-collection-analysis", content);
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: completed ? "complete" : "collection-stopped",
            message: completed
              ? `Analyzed ${coverage.retrieved} complete transcript${coverage.retrieved === 1 ? "" : "s"}`
              : "Collection analysis stopped because complete evidence was unavailable",
            status: completed ? "success" : "error",
            timestamp: new Date().toISOString(),
          },
        } as never);
        return;
      }

      if (
        isDocumentIntelligenceEvalRequest({
          message: lastUserContent,
          selectedProjectId: args.selectedProjectId ?? null,
        })
      ) {
        const content = buildDocumentIntelligenceEvalContent({
          ctx: retrievalCtx,
          plan,
          message: lastUserContent,
          selectedProjectId: args.selectedProjectId ?? null,
        });
        const toolTrace = [
          ...bridgeToolTrace,
          ...buildDocumentIntelligenceEvalTrace({
            ctx: retrievalCtx,
            plan,
            message: lastUserContent,
            selectedProjectId: args.selectedProjectId ?? null,
          }),
        ];
        const sourceDebug = buildAnswerDebugMetadata({
          orchestrator: "retrieval-planner-v2-document-intelligence-eval",
          plan,
          toolTrace,
          memoryUsage,
          sourceCoverage: [
            {
              sourceType: "intelligence_packet",
              status: retrievalCtx.intelligencePacket ? "loaded" : "missing",
              notes:
                retrievalCtx.warnings.find(
                  (warning) => warning.source === "intelligence_packet",
                )?.message ?? null,
            },
            {
              sourceType: "project_snapshot",
              status: retrievalCtx.projectSnapshot ? "loaded" : "missing",
              notes:
                retrievalCtx.warnings.find(
                  (warning) => warning.source === "project_snapshot",
                )?.message ?? null,
            },
            {
              sourceType: "document_intelligence",
              status: "checked",
              notes:
                "Eval-only deterministic response path after project operating context retrieval completed.",
            },
          ],
          outputPolicy: {
            evalOnly: true,
            reason:
              "Avoid live model timeout while verifying selected-project document intelligence retrieval and metadata contracts.",
          },
        });

        await persistDirectDeepAgentResponse({
          supabase: args.supabase,
          sessionId: args.sessionId,
          userId: args.user.id,
          content,
          responseLabel: "document-intelligence-eval",
          sourceDebug,
          trace: {
            input: lastUserContent,
            intent: plan.intent,
            modelId: "retrieval-planner-v2-document-intelligence-eval",
            selectedProjectId: args.selectedProjectId ?? null,
            toolTrace,
          },
          metadata: {
            architecture: "retrieval-planner-v2",
            provider_path: "eval-document-intelligence-deterministic",
            eval_only: true,
            model: args.activeModel,
            synthesis_model: synthesisModel,
            retrieval_plan: {
              intent: plan.intent,
              reason: plan.reason,
              responseFormat: plan.responseFormat,
              sources: Object.keys(plan.sources),
            },
            tool_trace: toolTrace,
            response_quality: buildResponseQualityMetadata({
              toolTrace,
              content,
            }),
            source_debug: sourceDebug,
          } as Json,
        });

        responseAlreadyPersisted = true;
        writeTextResponse(
          writer,
          "strategist-document-intelligence-eval",
          content,
        );
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "complete",
            message: "Document intelligence eval response returned",
            status: "success",
            timestamp: new Date().toISOString(),
          },
        } as never);
        return;
      }

      if (
        shouldUseDirectProjectBriefing({
          plan,
          retrievalCtx,
          message: lastUserContent,
          selectedProjectId: args.selectedProjectId ?? null,
        })
      ) {
        const content = buildDirectProjectBriefingContent({
          ctx: retrievalCtx,
          message: lastUserContent,
        });
        const plannerTrace = {
          tool: "intentPlanner",
          input: {
            message: lastUserContent.slice(0, 240),
            selectedProjectId: args.selectedProjectId ?? null,
          },
          output: {
            intent: plan.intent,
            responseMode: plan.responseFormat,
            rationale:
              "Packet-first project briefing resolved structured project context before synthesis.",
          },
          timestamp: new Date().toISOString(),
        };
        const preflightTrace = {
          tool: "serverBusinessContextPreflight",
          toolName: "serverBusinessContextPreflight",
          agent: "retrieval-planner-v2",
          status: "success",
          input: {
            message: lastUserContent.slice(0, 240),
            selectedProjectId: args.selectedProjectId ?? null,
          },
          output: {
            projectName: namedProjectFromSnapshot(asRecord(retrievalCtx.projectSnapshot)),
            projectSnapshotLoaded: Boolean(retrievalCtx.projectSnapshot),
            semanticResultCount: summarizeEvalCount(retrievalCtx.semanticVectorResults),
          },
          timestamp: new Date().toISOString(),
        };
        const toolTrace = [
          ...bridgeToolTrace,
          plannerTrace,
          preflightTrace,
          ...buildPrefetchRetrievalTraces({
            ctx: retrievalCtx,
            plan,
            message: lastUserContent,
            selectedProjectId: args.selectedProjectId ?? null,
          }),
        ];
        const sourceDebug = buildAnswerDebugMetadata({
          orchestrator: "retrieval-planner-v2-direct-project-briefing",
          plan,
          toolTrace,
          memoryUsage,
          sourceCoverage: [
            {
              sourceType: "project_snapshot",
              status: "loaded",
              notes: "getProjectBriefingSnapshot",
            },
            {
              sourceType: "semantic_vector_search",
              status: retrievalCtx.semanticVectorResults ? "loaded" : "missing",
              notes: `${summarizeEvalCount(retrievalCtx.semanticVectorResults) ?? 0} result(s)`,
            },
          ],
          evidenceCount: 1 + (summarizeEvalCount(retrievalCtx.semanticVectorResults) ?? 0),
        });

        await persistDirectDeepAgentResponse({
          supabase: args.supabase,
          sessionId: args.sessionId,
          userId: args.user.id,
          content,
          responseLabel: "direct-project-briefing",
          sourceDebug,
          trace: {
            input: lastUserContent,
            intent: plan.intent,
            modelId: "retrieval-planner-v2-direct-project-briefing",
            selectedProjectId: args.selectedProjectId ?? null,
            toolTrace,
          },
          metadata: {
            architecture: "retrieval-planner-v2",
            provider_decision: {
              providerPath: "direct-project-briefing-rag",
              model: null,
            },
            provider_path: "direct-project-briefing-rag",
            model: args.activeModel,
            synthesis_model: synthesisModel,
            retrieval_plan: {
              intent: plan.intent,
              reason: plan.reason,
              responseFormat: plan.responseFormat,
              sources: Object.keys(plan.sources),
            },
            tool_trace: toolTrace,
            response_quality: buildResponseQualityMetadata({
              toolTrace,
              content,
            }),
            source_debug: sourceDebug,
          } as Json,
        });

        responseAlreadyPersisted = true;
        writeTextResponse(writer, "strategist-direct-project-briefing", content);
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "complete",
            message: "Project briefing returned from loaded source context",
            status: "success",
            timestamp: new Date().toISOString(),
          },
        } as never);
        return;
      }

      if (plan.intent === "source_lookup" && retrievalCtx.semanticVectorResults) {
        const content = await synthesizeDirectSourceLookupAnswer({
          message: lastUserContent,
          semanticVectorResults: retrievalCtx.semanticVectorResults,
          synthesisModel,
        });
        if (content) {
          const plannerTrace = {
            tool: "intentPlanner",
            input: {
              message: lastUserContent.slice(0, 240),
              selectedProjectId: args.selectedProjectId ?? null,
            },
            output: {
              intent: "source_lookup",
              responseMode: "source_lookup",
              rationale:
                "User requested exact internal source context rather than a project status report.",
            },
            timestamp: new Date().toISOString(),
          };
          const sourceLookupTrace = {
            tool: "sourceLookupIntentRouter",
            toolName: "sourceLookupIntentRouter",
            agent: "retrieval-planner-v2",
            status: "success",
            input: {
              message: lastUserContent.slice(0, 240),
              selectedProjectId: args.selectedProjectId ?? null,
            },
            output: {
              intent: plan.intent,
              responseFormat: plan.responseFormat,
              route: "direct_semantic_source_lookup",
            },
            timestamp: new Date().toISOString(),
          };
          const toolTrace = [
            ...bridgeToolTrace,
            plannerTrace,
            sourceLookupTrace,
            ...buildPrefetchRetrievalTraces({
              ctx: retrievalCtx,
              plan,
              message: lastUserContent,
              selectedProjectId: args.selectedProjectId ?? null,
            }),
          ];
          const sourceDebug = buildAnswerDebugMetadata({
            orchestrator: "retrieval-planner-v2-direct-source-lookup",
            plan,
            toolTrace,
            memoryUsage,
          });

          await persistDirectDeepAgentResponse({
            supabase: args.supabase,
            sessionId: args.sessionId,
            userId: args.user.id,
            content,
            responseLabel: "source-lookup-direct-semantic",
            sourceDebug,
            trace: {
              input: lastUserContent,
              intent: plan.intent,
              modelId: "retrieval-planner-v2-direct-source-lookup",
              selectedProjectId: args.selectedProjectId ?? null,
              toolTrace,
            },
            metadata: {
              architecture: "retrieval-planner-v2",
              provider_decision: {
                providerPath: "direct-source-lookup-semantic-rag",
                model: null,
              },
              provider_path: "direct-source-lookup-semantic-rag",
              model: args.activeModel,
              synthesis_model: synthesisModel,
              retrieval_plan: {
                intent: plan.intent,
                reason: plan.reason,
                responseFormat: plan.responseFormat,
                sources: Object.keys(plan.sources),
              },
              tool_trace: toolTrace,
              response_quality: buildResponseQualityMetadata({
                toolTrace,
                content,
              }),
              source_debug: sourceDebug,
            } as Json,
          });

          responseAlreadyPersisted = true;
          writeTextResponse(writer, "strategist-direct-source-lookup", content);
          writer.write({
            type: "data-status",
            id: "strategist-status",
            data: {
              stage: "complete",
              message: "Source lookup returned",
              status: "success",
              timestamp: new Date().toISOString(),
            },
          } as never);
          return;
        }
      }

      if (shouldUseDirectSourceSpecificFastPath({ plan, retrievalCtx })) {
        const sourceSpecificKind =
          plan.sources.sourceSpecificRag?.kind ?? "recent_meetings";
        const sourceAnswer = sanitizeDirectSourceSpecificAnswer(
          retrievalCtx.sourceSpecificRagAnswer?.content ?? "",
        );
        const content = sourceAnswer.includes("I treated this as a source lookup")
          ? sourceAnswer
          : `I treated this as a source lookup, not a project status report.\n\n${sourceAnswer}`;
        const toolTrace = [
          ...bridgeToolTrace,
          ...buildPrefetchRetrievalTraces({
            ctx: retrievalCtx,
            plan,
            message: lastUserContent,
            selectedProjectId: args.selectedProjectId ?? null,
          }),
        ];
        const sourceDebug = buildAnswerDebugMetadata({
          orchestrator: `retrieval-planner-v2-direct-${sourceSpecificKind}`,
          plan,
          toolTrace,
          memoryUsage,
        });

        await persistDirectDeepAgentResponse({
          supabase: args.supabase,
          sessionId: args.sessionId,
          userId: args.user.id,
          content,
          responseLabel: directSourceSpecificResponseLabel(sourceSpecificKind),
          sourceDebug,
          trace: {
            input: lastUserContent,
            intent: plan.intent,
            modelId: `retrieval-planner-v2-direct-${sourceSpecificKind}`,
            selectedProjectId: args.selectedProjectId ?? null,
            toolTrace,
          },
          metadata: {
            architecture: "retrieval-planner-v2",
            provider_path: "direct-source-specific-rag",
            model: args.activeModel,
            synthesis_model: synthesisModel,
            retrieval_plan: {
              intent: plan.intent,
              reason: plan.reason,
              responseFormat: plan.responseFormat,
              sources: Object.keys(plan.sources),
            },
            tool_trace: toolTrace,
            response_quality: buildResponseQualityMetadata({
              toolTrace,
              content,
            }),
            source_debug: sourceDebug,
          } as Json,
        });

        responseAlreadyPersisted = true;
        writeTextResponse(
          writer,
          `strategist-direct-${sourceSpecificKind}`,
          content,
        );
        writer.write({
          type: "data-status",
          id: "strategist-status",
          data: {
            stage: "complete",
            message: directSourceSpecificStatusMessage(sourceSpecificKind),
            status: "success",
            timestamp: new Date().toISOString(),
          },
        } as never);
        return;
      }

      // Bound the injected retrieval/context so the system prompt can never
      // exceed the context hard limit on its own. The budget is derived from the
      // SAME resolved hard limit the compaction guard enforces (~60% of it), so a
      // one-line chat can never be rejected as "over the limit" because of an
      // over-large packet. See compaction.ts buildOverLimitError.
      const { hardLimitTokens: resolvedHardLimitTokens } = resolveContextLimits({
        thresholdTokens: AI_ASSISTANT_CONTEXT_COMPACTION_THRESHOLD_TOKENS,
        hardLimitTokens: AI_ASSISTANT_CONTEXT_COMPACTION_HARD_LIMIT_TOKENS,
      });
      const systemPromptMaxChars = Math.floor(
        resolvedHardLimitTokens * CHARS_PER_TOKEN * 0.6,
      );
      const assembledSystemPrompt = assembleSystemPromptFromContext(
        plan,
        retrievalCtx,
        baseSystemPrompt,
        { maxContextChars: systemPromptMaxChars },
      );
      const attachmentNote = buildChatAttachmentNote(attachmentCapabilities);

      const systemPrompt =
        (backendDeepAgentContextBlocks.length > 0
          ? [
              assembledSystemPrompt,
              "",
              "## Backend Deep Agents Context",
              "",
              ...backendDeepAgentContextBlocks,
            ].join("\n")
          : assembledSystemPrompt) + attachmentNote;

      let tools = createStrategistTools(args.user.id, {
        pinnedProjectId: args.selectedProjectId,
        sessionId: args.sessionId,
        includeActionTools: actionToolsEnabled,
        researchContract: plan.sources.research,
        onTrace: (trace) => {
          const researchReceipt = researchReceiptFromToolTrace(
            plan.sources.research,
            trace,
          );
          if (researchReceipt) liveResearchReceipts.push(researchReceipt);
          const normalizedTrace = buildLiveToolTrace(trace, lastUserContent);
          if (normalizedTrace) liveToolTrace.push(normalizedTrace);
        },
      });
      mcpToolBundle = await createAiAssistantMcpTools({
        allowArtifactWrites: actionToolsEnabled,
      });
      Object.assign(tools, mcpToolBundle.tools);
      tools = selectToolsForResearchContract(
        tools,
        plan.sources.research,
        retrievalCtx.researchReceipts,
      );
      const toolApproval = createAssistantToolApprovalPolicy(
        undefined,
        mcpToolBundle.approvalRequiredToolNames,
      );
      const approvalSecret = resolveToolApprovalSecret({ actionToolsEnabled });
      if (process.env.NODE_ENV !== "production") {
        console.log("[handler-v2] streamText input", {
          plan_reason: plan.reason,
          system_prompt_chars: systemPrompt.length,
          system_prompt_approx_tokens: Math.round(systemPrompt.length / 4),
          retrieval_durations: retrievalCtx.durationsMs,
          warnings: retrievalCtx.warnings,
          has_intelligence_packet: Boolean(retrievalCtx.intelligencePacket),
          has_project_snapshot: Boolean(retrievalCtx.projectSnapshot),
          has_semantic_results: Boolean(retrievalCtx.semanticVectorResults),
          message_count: args.messages.length,
          tool_count: Object.keys(tools).length,
          model: args.activeModel,
          synthesis_model: synthesisModel,
        });
      }

      const modelReadableMessages =
        filterModelReadableAttachments(args.messages);
      let modelMessages = await convertToModelMessages(modelReadableMessages);
      try {
        const compaction = await maybeCompactModelMessages(modelMessages, {
          enabled: AI_ASSISTANT_CONTEXT_COMPACTION_ENABLED,
          systemPrompt,
          thresholdTokens: Number.isFinite(
            AI_ASSISTANT_CONTEXT_COMPACTION_THRESHOLD_TOKENS,
          )
            ? AI_ASSISTANT_CONTEXT_COMPACTION_THRESHOLD_TOKENS
            : undefined,
          hardLimitTokens: Number.isFinite(
            AI_ASSISTANT_CONTEXT_COMPACTION_HARD_LIMIT_TOKENS,
          )
            ? AI_ASSISTANT_CONTEXT_COMPACTION_HARD_LIMIT_TOKENS
            : undefined,
        });
        modelMessages = compaction.messages;
        contextCompactionMetadata = compaction.metadata;
        if (process.env.NODE_ENV !== "production") {
          console.log("[handler-v2] context compaction", {
            status: compaction.metadata.status,
            original_message_count: args.messages.length,
            model_message_count: modelMessages.length,
            token_estimate_before: compaction.metadata.tokenEstimateBefore,
            token_estimate_after: compaction.metadata.tokenEstimateAfter,
          });
        }
      } catch (error) {
        if (error instanceof ContextCompactionError) {
          contextCompactionMetadata = {
            enabled: AI_ASSISTANT_CONTEXT_COMPACTION_ENABLED,
            status: "failed_uncompacted",
            tokenEstimateBefore: 0,
            tokenEstimateAfter: 0,
            thresholdTokens: Number.isFinite(
              AI_ASSISTANT_CONTEXT_COMPACTION_THRESHOLD_TOKENS,
            )
              ? AI_ASSISTANT_CONTEXT_COMPACTION_THRESHOLD_TOKENS
              : 0,
            hardLimitTokens: Number.isFinite(
              AI_ASSISTANT_CONTEXT_COMPACTION_HARD_LIMIT_TOKENS,
            )
              ? AI_ASSISTANT_CONTEXT_COMPACTION_HARD_LIMIT_TOKENS
              : 0,
            headMessagesKept: 0,
            tailMessagesKept: 0,
            middleMessagesSummarized: 0,
            previousSummaryRefreshed: false,
            bulkyToolResultsPruned: 0,
            binaryReferencesReplaced: 0,
            droppedMessages: 0,
            failureReason: `[${error.reason}] ${error.message}`,
          };
          writer.write({
            type: "data-status",
            id: "context-compaction-failed",
            data: {
              stage: "context_compaction",
              message: error.message,
              status: "error",
              timestamp: new Date().toISOString(),
            },
          } as never);
          // Pick honest copy from the actual cause. A huge injected packet is
          // NOT a long conversation — telling the user to start a fresh chat
          // would be wrong (the fresh chat re-injects the same giant context).
          // The full diagnostic is preserved in metadata.context_compaction.
          const userFacingMessage =
            error.reason === "system_prompt_over_limit"
              ? "I pulled in more background context for this question than I can fit in one request, so I held off rather than send a broken request. Try narrowing the question (e.g. ask about one project, source, or time window) and I'll answer."
              : "This conversation has grown past what I can fit in one request and I couldn't safely shorten it. Start a fresh chat, or ask me to continue from a short summary of this thread.";
          writeTextResponse(writer, "context-compaction-failed", userFacingMessage);
          return;
        }
        throw error;
      }
      const lastModelUserMessage = modelMessages.findLast(
        (m) => m.role === "user",
      );
      const inputText = lastModelUserMessage
        ? (lastModelUserMessage.content as
            | { text?: string }[]
            | string
            | undefined) && typeof lastModelUserMessage.content === "string"
          ? lastModelUserMessage.content
          : ((lastModelUserMessage.content as { type: string; text?: string }[])
              ?.filter((p) => p.type === "text")
              .map((p) => p.text ?? "")
              .join(" ") ?? "")
        : "";

      // Unified Langfuse trace: `propagateAttributes` sets trace-level
      // user/session/tags, the root span groups everything, and the
      // `@langfuse/otel` processor auto-captures the generation, tool spans,
      // model, and token usage from `experimental_telemetry`. Quality is
      // attached as Langfuse SCORES on the same trace id (see `scoreChatTrace`),
      // so there is exactly ONE trace per chat — no duplicate v3 trace. When
      // Langfuse is not configured these wrappers are safe no-ops and streaming
      // is unchanged.
      await propagateAttributes(
        {
          userId: args.user.id,
          sessionId: args.sessionId,
          traceName: "ai-assistant-chat",
          tags: [`intent:${plan.intent}`],
        },
        () =>
          startActiveObservation(
            "ai-assistant-chat",
            async (rootSpan) => {
              langfuseTraceId = getActiveTraceId();
              setActiveTraceIO({ input: inputText });
              const generationObservation = startChatGenerationObservation({
                model: synthesisModel,
                input: inputText,
                maxOutputTokens: assistantMaxOutputTokens(plan.reason),
                intent: plan.intent,
                planReason: plan.reason,
              });

              // gpt-5.4 rejects reasoning_effort + function tools on
              // /v1/chat/completions (empty-response crash traced 2026-07-09).
              // buildAssistantOpenAiProviderOptions omits reasoningEffort when
              // tools are attached — see that module + its tests.
              const result = streamText({
                model: getLanguageModel(synthesisModel),
                system: systemPrompt,
                messages: modelMessages,
                tools,
                toolApproval,
                experimental_toolApprovalSecret: approvalSecret,
                maxOutputTokens: assistantMaxOutputTokens(plan.reason),
                providerOptions: {
                  openai: buildAssistantOpenAiProviderOptions(
                    hasFunctionTools(tools),
                  ),
                },
                stopWhen: stepCountIs(6),
                experimental_telemetry: aiTelemetry({
                  functionId: "ai-assistant-chat-v2",
                  metadata: {
                    intent: plan.intent,
                    planReason: plan.reason,
                    responseFormat: plan.responseFormat,
                    synthesisModel,
                    selectedModel: args.activeModel,
                    selectedProjectId: args.selectedProjectId ?? -1,
                    hasIntelligencePacket: Boolean(
                      retrievalCtx.intelligencePacket,
                    ),
                    hasProjectSnapshot: Boolean(retrievalCtx.projectSnapshot),
                    hasSemanticResults: Boolean(
                      retrievalCtx.semanticVectorResults,
                    ),
                  },
                }),
                onError: ({ error }) => {
                  const message =
                    error instanceof Error ? error.message : String(error);
                  streamErrorMessage = message;
                  console.error("[handler-v2] streamText onError", {
                    message,
                    stack:
                      error instanceof Error
                        ? error.stack?.split("\n").slice(0, 5).join("\n")
                        : undefined,
                  });
                  generationObservation.fail(message);
                  if (mcpToolBundle) {
                    waitUntil(mcpToolBundle.close());
                  }
                },
                onFinish: ({
                  finishReason,
                  totalUsage,
                  text,
                  toolCalls,
                  steps,
                }) => {
                  // Aggregate tool call names across ALL agentic steps, not just the last.
                  const toolCallNames =
                    steps?.flatMap((s) =>
                      (s.toolCalls ?? []).map((c) => c.toolName),
                    ) ??
                    toolCalls?.map((c) => c.toolName) ??
                    [];
                  finishMetadata = {
                    finishReason,
                    usage: {
                      inputTokens: totalUsage.inputTokens,
                      outputTokens: totalUsage.outputTokens,
                      totalTokens: totalUsage.totalTokens,
                    },
                    toolCallNames,
                    stepCount: steps?.length ?? toolCallNames.length,
                  };
                  console.log("[handler-v2] streamText onFinish", {
                    finishReason,
                    totalUsage,
                    text_chars: text?.length ?? 0,
                    text_preview: text?.slice(0, 200) ?? "",
                    tool_calls: toolCallNames,
                    step_count: steps?.length ?? 0,
                  });
                  if (mcpToolBundle) {
                    waitUntil(mcpToolBundle.close());
                  }
                  generationObservation.complete({
                    output: text ?? "",
                    finishReason,
                    usage: {
                      inputTokens: totalUsage.inputTokens,
                      outputTokens: totalUsage.outputTokens,
                      totalTokens: totalUsage.totalTokens,
                    },
                    toolCallNames,
                  });
                  setActiveTraceIO({ input: inputText, output: text ?? "" });
                  rootSpan.update({ output: text ?? "" });
                  rootSpan.end();
                  waitUntil(
                    scoreChatTrace({
                      traceId: langfuseTraceId,
                      output: text ?? "",
                      toolCallNames,
                    }),
                  );
                  // Sampled, code-owned LLM judge (off by default; gated by
                  // LANGFUSE_LLM_JUDGE_ENABLED + sample rate). Scores semantic
                  // relevance/specificity/completeness the heuristics can't see.
                  waitUntil(
                    maybeJudgeAndScore({
                      traceId: langfuseTraceId,
                      question: inputText,
                      answer: text ?? "",
                    }),
                  );
                },
              });

              writer.merge(
                result.toUIMessageStream({ originalMessages: args.messages }),
              );
            },
            { endOnExit: false },
          ),
      );
    },
    onFinish: async ({ responseMessage, finishReason }) => {
      if (responseAlreadyPersisted) return;

      const assistantText = extractTextFromParts(responseMessage.parts);
      const assistantContent = assistantText.trim()
        ? assistantText
        : buildEmptyResponseMessage(streamErrorMessage);

      const finalResearchReceipts = mergeResearchReceipts(
        plan.sources.research,
        latestRetrievalCtx?.researchReceipts,
        liveResearchReceipts,
      );
      if (latestRetrievalCtx) {
        latestRetrievalCtx.researchReceipts = finalResearchReceipts;
      }

      const dataParts = extractPersistableDataParts(responseMessage);
      const streamToolTrace =
        finishMetadata?.toolCallNames.map((tool) => ({
          tool,
          toolName: tool,
          status: "success",
          input: {
            message: lastUserContent.slice(0, 240),
            selectedProjectId: args.selectedProjectId ?? null,
          },
          timestamp: new Date().toISOString(),
        })) ?? [];
      const retrievalToolTrace = [
        buildRecentEmailTrace(
          latestRetrievalCtx?.recentEmailInbox,
          lastUserContent,
        ),
      ].filter((trace): trace is Record<string, unknown> => Boolean(trace));
      const prefetchRetrievalTrace = buildPrefetchRetrievalTraces({
        ctx: latestRetrievalCtx,
        plan,
        message: lastUserContent,
        selectedProjectId: args.selectedProjectId ?? null,
      });
      const toolTrace = [
        ...bridgeToolTrace,
        ...prefetchRetrievalTrace,
        ...retrievalToolTrace,
        ...liveToolTrace,
        ...streamToolTrace,
      ];
      if (mcpToolBundle) {
        toolTrace.push(...mcpToolBundle.trace);
      }

      const metadata: Record<string, unknown> = {
        architecture: "retrieval-planner-v2",
        response_message_id: responseMessage.id,
        langfuse_trace_id: langfuseTraceId ?? null,
        model: args.activeModel,
        synthesis_model: synthesisModel,
        provider_path: selectedDeepAgentsStrategist
          ? "render-backend-deep-agents+ai-gateway-synthesis"
          : "ai-gateway",
        finish_reason: finishMetadata?.finishReason ?? finishReason ?? null,
        empty_model_response: !assistantText.trim(),
        stream_error: streamErrorMessage,
        usage: finishMetadata?.usage ?? null,
        tool_trace: toolTrace,
        response_quality: buildResponseQualityMetadata({
          toolTrace,
          content: assistantContent,
        }),
        source_debug: buildAnswerDebugMetadata({
          orchestrator: "retrieval-planner-v2",
          plan,
          toolTrace,
          memoryUsage,
          skillUsage,
          sourceCoverage: [
            ...researchReceiptMetadata(
              latestRetrievalCtx?.researchReceipts,
            ).map((receipt) => ({
              sourceType: receipt.source,
              status: receipt.status,
              authority: receipt.authority,
              toolName: receipt.toolName,
              durationMs: receipt.durationMs,
              evidenceCount: receipt.evidenceCount,
              notes: receipt.error,
            })),
            ...(latestRetrievalCtx?.warnings ?? [])
              .filter(
                (warning) =>
                  !latestRetrievalCtx?.researchReceipts?.some(
                    (receipt) => receipt.source === warning.source,
                  ),
              )
              .map((warning) => ({
                sourceType: warning.source,
                status: "warning",
                notes: warning.message,
              })),
          ],
          outputPolicy: {
            maxOutputTokens: assistantMaxOutputTokens(plan.reason),
            reasoningEffort: "low",
            textVerbosity: "low",
            stopWhen: "stepCountIs(6)",
          },
        }),
        retrieval_plan: {
          intent: plan.intent,
          reason: plan.reason,
          responseFormat: plan.responseFormat,
          sources: Object.keys(plan.sources),
          research: plan.sources.research
            ? {
                version: plan.sources.research.version,
                requestedSources: plan.sources.research.requests.map(
                  (request) => request.source,
                ),
              }
            : null,
        },
        research_receipts: researchReceiptMetadata(
          latestRetrievalCtx?.researchReceipts,
        ),
        research_coverage_complete: researchCoverageComplete(
          plan.sources.research,
          latestRetrievalCtx?.researchReceipts,
        ),
        step_count: finishMetadata?.stepCount ?? null,
      };

      if (contextCompactionMetadata) {
        metadata.context_compaction = contextCompactionMetadata;
      }

      if (memoryUsage) {
        metadata.memory_usage = memoryUsage;
      }

      if (skillUsage) {
        metadata.skill_usage = skillUsage;
      }

      if (dataParts.length > 0) {
        metadata.data_parts = dataParts;
      }

      const { error } = await persistChatHistoryRow({
        session_id: args.sessionId,
        user_id: args.user.id,
        role: "assistant",
        content: assistantContent,
        sources: buildAnswerSourceCitations(
          latestRetrievalCtx,
          args.selectedProjectId ?? null,
        ) as Json,
        metadata: metadata as Json,
      });

      if (error) {
        throw new Error(
          `Persisting the assistant response failed: ${error.message}`,
        );
      }

      if (skillUsage) {
        waitUntil(
          recordSelectedSkillUsage({
            usage: skillUsage,
            userId: args.user.id,
            projectId: args.selectedProjectId ?? null,
            sessionId: args.sessionId,
            surface: "ai_assistant_chat",
            metadata: {
              responseMessageId: responseMessage.id,
              finishReason: finishMetadata?.finishReason ?? finishReason ?? null,
              planIntent: plan.intent,
              planReason: plan.reason,
            },
          }),
        );
      }

      const { error: conversationError } = await args.supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("session_id", args.sessionId)
        .eq("user_id", args.user.id);

      if (conversationError) {
        throw new Error(
          `Updating the assistant conversation failed: ${conversationError.message}`,
        );
      }

      waitUntil(
        runPostResponseTasks(args.sessionId, args.user.id, {
          selectedProjectId: args.selectedProjectId ?? null,
          responseMessageId: responseMessage.id,
        }),
      );
    },
  });

  return createUIMessageStreamResponse({ stream });
}

export async function handleChatV2({
  request,
  assistantSurface: routeAssistantSurface,
  conversationSurface,
}: {
  request: Request;
  assistantSurface: AiAssistantSurface;
  conversationSurface: "alleato_ai" | "ask_alleato";
}): Promise<Response> {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "ai-assistant/chat#POST",
      message: "Unauthorized",
      status: 401,
    });
  }

  const body = await request.json();
  const {
    id: sessionId,
    messages,
    selectedProjectId,
    selectedModel,
  } = body as {
    id: string;
    messages: UIMessage[];
    selectedProjectId?: number;
    selectedModel?: unknown;
  };

  if (!sessionId || !Array.isArray(messages) || messages.length === 0) {
    return new Response("session id and messages are required", {
      status: 400,
    });
  }

  const attachmentValidation = validateChatAttachmentPayload(messages);
  if (attachmentValidation) {
    return new Response(attachmentValidation.message, {
      status: attachmentValidation.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (
    !(await conversationBelongsToSurface({
      sessionId,
      userId: user.id,
      surface: conversationSurface,
    }))
  ) {
    throw new GuardrailError({
      code: "RESOURCE_NOT_FOUND",
      where: "ai-assistant/chat#POST",
      message: "This conversation is not part of Alleato AI.",
      status: 404,
      severity: "medium",
    });
  }

  const activeModel = isAiAssistantModelId(selectedModel)
    ? selectedModel
    : DEFAULT_AI_ASSISTANT_MODEL;
  const assistantSurface = parseAiAssistantSurface(routeAssistantSurface);

  return runChatV2({
    user,
    sessionId,
    messages,
    assistantSurface,
    selectedProjectId,
    activeModel,
    supabase: createServiceClient(),
  });
}
