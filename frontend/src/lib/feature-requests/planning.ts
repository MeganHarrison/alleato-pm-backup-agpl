import type {
  FeatureRequestPacketInput,
  FeatureRequestRow,
  ImplementationPlanInput,
} from "./types";

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function inferFeatureRequestType(rawRequest: string): FeatureRequestPacketInput["requestType"] {
  const lower = rawRequest.toLowerCase();
  if (lower.includes("dashboard") || lower.includes("report") || lower.includes("see which")) {
    return "report_dashboard";
  }
  if (lower.includes("automate") || lower.includes("automation")) return "automation";
  if (lower.includes("bug") || lower.includes("broken") || lower.includes("fix")) return "bug";
  if (lower.includes("ai") || lower.includes("assistant")) return "ai_assistant_capability";
  if (lower.includes("permission") || lower.includes("admin")) return "permission_admin";
  if (lower.includes("integration") || lower.includes("sync")) return "integration";
  return "workflow_improvement";
}

export function buildFeatureRequestDraft(params: {
  rawRequest: string;
  requesterName?: string;
  requesterUserId?: string | null;
  selectedProjectId?: number | null;
  sourceSessionId?: string | null;
  sourceMessageId?: string | null;
}): FeatureRequestPacketInput {
  const rawRequest = params.rawRequest.trim();
  const lower = rawRequest.toLowerCase();
  const affectedWorkflows = uniq([
    lower.includes("rfi") ? "RFIs" : "",
    lower.includes("submittal") ? "Submittals" : "",
    lower.includes("invoice") ? "Invoices" : "",
    lower.includes("commitment") || lower.includes("subcontractor") ? "Commitments" : "",
    lower.includes("change order") ? "Change orders" : "",
  ]);
  const broadBlockerAsk =
    lower.includes("holding up") ||
    lower.includes("blocker") ||
    lower.includes("blockers") ||
    lower.includes("all of them");
  const title = rawRequest.length > 84 ? `${rawRequest.slice(0, 81)}...` : rawRequest;

  return {
    title,
    requesterName: params.requesterName ?? "Brandon",
    requesterUserId: params.requesterUserId ?? null,
    projectId: params.selectedProjectId ?? null,
    requestType: inferFeatureRequestType(rawRequest),
    rawRequest,
    assistantSummary: rawRequest,
    desiredOutcome: broadBlockerAsk
      ? "Identify which subcontractors are blocking project progress and explain the workflow source of each blocker."
      : null,
    affectedUsers: ["Project leadership", "Project managers"],
    affectedWorkflows,
    acceptanceCriteria: broadBlockerAsk
      ? [
          "Shows subcontractors with active blockers and the blocker source workflow.",
          "Separates RFIs, submittals, invoices, commitments, and change orders so leadership can see why each party is holding work up.",
          "Provides enough detail to identify the next owner action for each blocker.",
        ]
      : [],
    verificationSteps: broadBlockerAsk
      ? [
          "Capture the request through AIS chat and confirm the packet persists.",
          "Open the feature request detail page and confirm raw wording, summary, acceptance criteria, and open questions render.",
          "Confirm readiness remains blocked until workflow scope is confirmed or explicitly assumed.",
        ]
      : [],
    openQuestions: broadBlockerAsk
      ? [
          "Should blocker coverage include RFIs, submittals, invoices, commitments, change orders, or every open workflow blocker?",
        ]
      : ["Which users, pages, workflows, and acceptance criteria define success for this request?"],
    sourceSessionId: params.sourceSessionId ?? null,
    sourceMessageId: params.sourceMessageId ?? null,
    sourceMetadata: {
      captured_by: "ais_feature_request_router",
    },
  };
}

export function generateImplementationPlanDraft(
  request: FeatureRequestRow,
  overrides: ImplementationPlanInput = {},
): Required<Omit<ImplementationPlanInput, "generatedBy">> & { generatedBy?: string | null } {
  const workflows = Array.isArray(request.affected_workflows)
    ? request.affected_workflows.filter((item): item is string => typeof item === "string")
    : [];
  const acceptanceCriteria = Array.isArray(request.acceptance_criteria)
    ? request.acceptance_criteria.filter((item): item is string => typeof item === "string")
    : [];
  const verificationSteps = Array.isArray(request.verification_steps)
    ? request.verification_steps.filter((item): item is string => typeof item === "string")
    : [];
  const openQuestions = Array.isArray(request.open_questions)
    ? request.open_questions.filter((item): item is string => typeof item === "string")
    : [];

  return {
    summary:
      overrides.summary ??
      `Implement a durable feature request packet for "${request.title}" with stakeholder wording, readiness checks, and execution handoff context.`,
    affectedRoutes: overrides.affectedRoutes ?? ["/ai-assistant/feature-requests", "/ai-assistant/feature-requests/[requestId]"],
    affectedComponents: overrides.affectedComponents ?? [
      "AIS chat packet widget",
      "Feature request list",
      "Feature request detail",
      "Readiness gate",
    ],
    affectedTables: overrides.affectedTables ?? [
      "feature_requests",
      "feature_request_events",
      "implementation_plans",
      "execution_handoffs",
    ],
    dataRequirements: overrides.dataRequirements ?? [
      "Preserve raw stakeholder request separately from AIS summary.",
      "Store affected workflows, acceptance criteria, verification steps, open questions, and assumptions as structured arrays.",
    ],
    implementationSteps: overrides.implementationSteps ?? [
      "Confirm schema and access boundaries.",
      "Wire packet capture/update tools through AIS.",
      "Render persisted packet widget from chat data parts.",
      "Expose durable list and detail pages.",
      "Generate Claude Code handoff markdown with readiness evidence.",
    ],
    acceptanceCriteria: overrides.acceptanceCriteria ?? acceptanceCriteria,
    verificationSteps: overrides.verificationSteps ?? verificationSteps,
    risks: overrides.risks ?? [
      workflows.length === 0
        ? "Workflow scope is not confirmed yet."
        : `Workflow scope includes ${workflows.join(", ")} and should be verified against live data availability.`,
      "Readiness must fail loudly instead of marking vague work ready.",
    ],
    openQuestions: overrides.openQuestions ?? openQuestions,
    generatedBy: overrides.generatedBy ?? null,
  };
}
