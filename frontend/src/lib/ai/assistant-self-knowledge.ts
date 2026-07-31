import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { serviceDb } from "@/lib/supabase/service-db";
import { type ToolTracePayload, withTrace as traceTool } from "@/lib/ai/tools/tool-utils";

export type AssistantToolAccess = "read" | "write_preview" | "write_confirmed" | "external";

export type AssistantCapabilityGroup = {
  id: string;
  label: string;
  access: AssistantToolAccess;
  description: string;
  examples: string[];
};

export type AssistantRetrievalStep = {
  order: number;
  id: string;
  label: string;
  whenUsed: string;
  sourceOfTruth: string;
  failureMode: string;
};

export const ASSISTANT_CAPABILITY_GROUPS: AssistantCapabilityGroup[] = [
  {
    id: "project-intelligence",
    label: "Project intelligence and packets",
    access: "read",
    description:
      "Reads current client project intelligence packets, operating summaries, source coverage, and packet evidence before falling back to raw retrieval.",
    examples: [
      "What's the latest on this project?",
      "What should I be worried about?",
      "What does the current packet say?",
    ],
  },
  {
    id: "structured-project-data",
    label: "Structured project controls data",
    access: "read",
    description:
      "Queries first-party tables for budgets, commitments, change orders, RFIs, submittals, schedule tasks, direct costs, invoices, directory data, and portfolio rollups.",
    examples: [
      "Show budget exposure by cost code.",
      "Which RFIs are overdue?",
      "Who is on the project team?",
    ],
  },
  {
    id: "source-retrieval",
    label: "Source retrieval",
    access: "read",
    description:
      "Searches semantic chunks and source-specific stores for meetings, emails, Teams messages, OneDrive documents, company knowledge, and app help.",
    examples: [
      "What was discussed about the permit delay?",
      "Find emails from this week.",
      "Search the spec documents.",
    ],
  },
  {
    id: "specialist-agents",
    label: "Specialist advisors",
    access: "read",
    description:
      "Routes questions to CFO, COO, CRO, CHRO, VP of Business Development, and CMO advisors. Specialists call their own scoped tools and return evidence-backed analysis.",
    examples: [
      "Ask the CFO how margin looks.",
      "Ask the COO what is blocking the schedule.",
      "Ask the CMO to draft a content plan from project wins.",
    ],
  },
  {
    id: "preview-actions",
    label: "Preview-first actions",
    access: "write_preview",
    description:
      "Creates previews for tasks, RFIs, change events, feature request packets, implementation plans, workspace artifacts, and progress-report outputs before durable writes are confirmed.",
    examples: [
      "Create a task for this follow-up.",
      "Draft a feature request packet.",
      "Create a change event preview from this risk.",
    ],
  },
  {
    id: "external-context",
    label: "External context",
    access: "external",
    description:
      "Uses web search and external document intelligence only when the app's first-party data is not enough or the user explicitly asks for outside context.",
    examples: [
      "Check market context for this client.",
      "Look up external background before the meeting.",
    ],
  },
  {
    id: "self-inspection",
    label: "Assistant self-inspection",
    access: "read",
    description:
      "Explains available tool groups, retrieval order, source hierarchy, and the prior answer's persisted trace metadata.",
    examples: [
      "What tools do you have?",
      "What did you retrieve first?",
      "Why did you use that source?",
    ],
  },
];

export const ASSISTANT_RETRIEVAL_ORDER: AssistantRetrievalStep[] = [
  {
    order: 1,
    id: "intent-and-scope",
    label: "Intent and project scope",
    whenUsed:
      "Every turn. The assistant classifies the request, applies selected project scope, and decides whether the answer needs packet, structured, source, or write-action handling.",
    sourceOfTruth: "intent router, selectedProjectId, project access guardrails",
    failureMode:
      "If the request is ambiguous, AA should ask for the missing project or action detail instead of guessing.",
  },
  {
    order: 2,
    id: "current-packet",
    label: "Current intelligence packet",
    whenUsed:
      "Project status, risk, catch-up, owner-readout, and strategic questions use the current packet first when a fresh packet exists.",
    sourceOfTruth: "intelligence_targets, intelligence_packets, insight_cards, insight_card_evidence",
    failureMode:
      "If the packet is missing or stale, AA must say that and continue with structured/source retrieval.",
  },
  {
    order: 3,
    id: "operating-snapshot",
    label: "Project operating snapshot",
    whenUsed:
      "Used when the question needs structured current-state data such as project controls, tasks, financials, and operating-summary source coverage.",
    sourceOfTruth: "project briefing snapshot and operating-summary services",
    failureMode:
      "If a source category is unavailable, AA should surface the gap rather than treating the snapshot as complete.",
  },
  {
    order: 4,
    id: "structured-tools",
    label: "Structured tools",
    whenUsed:
      "Used for precise totals, counts, IDs, statuses, ownership, and workflow records.",
    sourceOfTruth: "Supabase tables/views and scoped project tools",
    failureMode:
      "If a query fails, AA should return the tool-error envelope and explain which source failed.",
  },
  {
    order: 5,
    id: "source-specific-retrieval",
    label: "Source-specific retrieval",
    whenUsed:
      "Used for meetings, emails, Teams messages, documents, app help, and questions where the answer lives in unstructured communications.",
    sourceOfTruth: "document_metadata, document_chunks, source-specific retrieval helpers",
    failureMode:
      "If a source is empty or timed out, AA should cite the attempted source and answer from remaining evidence only.",
  },
  {
    order: 6,
    id: "specialist-or-action-tools",
    label: "Specialist or action tools",
    whenUsed:
      "Used after evidence is scoped when a CFO/COO/CRO/CHRO/VPBD/CMO opinion or preview-first write workflow is needed.",
    sourceOfTruth: "C-suite orchestrator, action tools, feature request tools",
    failureMode:
      "Writes must stay preview-first unless the tool has explicit confirmation and idempotency protection.",
  },
  {
    order: 7,
    id: "answer-and-trace",
    label: "Answer, citations, and trace",
    whenUsed:
      "Every turn. AA persists tool traces, provider decision, loop diagnostic, source health, quality score, and retrieval policy metadata to chat history.",
    sourceOfTruth: "chat_history.metadata",
    failureMode:
      "If metadata cannot be persisted, the request should fail loudly instead of presenting observability as complete.",
  },
];

export function getAssistantRetrievalOrderSummary() {
  return {
    policyVersion: "assistant_retrieval_policy_v1",
    summary:
      "AA scopes the question first, prefers fresh compiled project intelligence for strategic questions, layers structured project data, then uses source-specific retrieval and specialist/action tools as needed.",
    steps: ASSISTANT_RETRIEVAL_ORDER,
  };
}

export function getAssistantSelfKnowledgePrompt(): string {
  const retrievalLines = ASSISTANT_RETRIEVAL_ORDER.map(
    (step) => `${step.order}. ${step.label} - ${step.whenUsed}`,
  ).join("\n");
  const capabilityLines = ASSISTANT_CAPABILITY_GROUPS.map(
    (group) => `- ${group.label} (${group.access}): ${group.description}`,
  ).join("\n");

  return [
    "## Assistant Self-Knowledge",
    "When the user asks how you work, what tools you have, what you searched first, why you used a source, or what happened in the previous answer, answer from the self-inspection tools and persisted trace metadata. Do not invent hidden tools or claim access you do not have.",
    "",
    "Capability groups:",
    capabilityLines,
    "",
    "Retrieval order:",
    retrievalLines,
    "",
    "For prior-answer questions, prefer `explainLastAnswerSources`. For general capability questions, prefer `describeAssistantCapabilities` or `explainAssistantRetrievalOrder`.",
  ].join("\n");
}

function compactTrace(trace: Record<string, unknown>) {
  const output = trace.output && typeof trace.output === "object"
    ? (trace.output as Record<string, unknown>)
    : null;

  return {
    tool: typeof trace.tool === "string" ? trace.tool : "unknown",
    error: typeof trace.error === "string" ? trace.error : null,
    timestamp: typeof trace.timestamp === "string" ? trace.timestamp : null,
    outputKeys: output ? Object.keys(output).slice(0, 12) : [],
  };
}

async function loadLastAssistantTrace(params: {
  sessionId: string;
  userId: string;
}) {
    const { data, error } = await serviceDb.from("chat_history")
    .select("id,created_at,content,metadata")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load previous assistant trace: ${error.message}`);
  }

  const metadata =
    data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};
  const trace = Array.isArray(metadata.tool_trace)
    ? metadata.tool_trace.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object" && !Array.isArray(item)),
      )
    : [];

  return {
    messageId: data?.id ?? null,
    createdAt: data?.created_at ?? null,
    contentPreview:
      typeof data?.content === "string"
        ? data.content.slice(0, 500)
        : null,
    model: metadata.model ?? null,
    providerPath: metadata.provider_path ?? null,
    architecture: metadata.architecture ?? null,
    responseQuality: metadata.response_quality ?? null,
    sourceHealth: metadata.source_health ?? null,
    retrievalPolicy: metadata.assistant_retrieval_order ?? getAssistantRetrievalOrderSummary(),
    traceCount: trace.length,
    traces: trace.map(compactTrace),
  };
}

export function createAssistantSelfInspectionTools(options: {
  userId: string;
  sessionId?: string;
  availableToolNames: string[];
  onTrace?: (trace: ToolTracePayload) => void;
}): ToolSet {
  const withTrace = <TInput extends Record<string, unknown>, TResult>(
    name: string,
    execute: (input: TInput) => Promise<TResult>,
  ) =>
    traceTool(
      name,
      { onTrace: options.onTrace },
      execute,
      "Assistant self-inspection failed. Explain which introspection source failed and answer from the static capability manifest if possible.",
    );

  return {
    describeAssistantCapabilities: tool({
      description:
        "Explain AA's available capability groups and runtime tool names. Use this when the user asks what tools AA has, what AA can do, or whether AA can read/write a type of data.",
      inputSchema: z.object({
        includeRuntimeToolNames: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to include the current runtime tool-name list."),
      }),
      execute: withTrace(
        "describeAssistantCapabilities",
        async ({ includeRuntimeToolNames }) => ({
          policyVersion: "assistant_capabilities_v1",
          capabilityGroups: ASSISTANT_CAPABILITY_GROUPS,
          runtimeToolCount: options.availableToolNames.length,
          runtimeToolNames: includeRuntimeToolNames
            ? options.availableToolNames
            : [],
          guardrails: [
            "Project data is scoped by selected project and access guardrails.",
            "Durable writes are preview-first unless explicitly confirmed by the tool contract.",
            "AA should explain unavailable sources instead of omitting source failures.",
          ],
        }),
      ),
    }),
    explainAssistantRetrievalOrder: tool({
      description:
        "Explain the order AA uses to classify, scope, retrieve, call tools, and answer. Use this when the user asks what AA searches first or how retrieval works.",
      inputSchema: z.object({}),
      execute: withTrace(
        "explainAssistantRetrievalOrder",
        async () => getAssistantRetrievalOrderSummary(),
      ),
    }),
    explainLastAnswerSources: tool({
      description:
        "Explain the previous assistant answer's persisted tool trace, provider/model metadata, source health, and retrieval policy. Use for questions like 'what did you search?' or 'why did you use that source?'.",
      inputSchema: z.object({}),
      execute: withTrace("explainLastAnswerSources", async () => {
        if (!options.sessionId) {
          return {
            unavailable: true,
            reason:
              "No sessionId was provided to the self-inspection tool, so prior message trace lookup is unavailable in this runtime.",
            retrievalPolicy: getAssistantRetrievalOrderSummary(),
          };
        }

        return loadLastAssistantTrace({
          sessionId: options.sessionId,
          userId: options.userId,
        });
      }),
    }),
  };
}
