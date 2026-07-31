import type {
  FeatureRequestReadiness,
  FeatureRequestRow,
  FeatureRequestStatus,
  ImplementationPlanRow,
} from "./types";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function scoreFeatureRequestReadiness(params: {
  request: Pick<
    FeatureRequestRow,
    | "raw_request"
    | "assistant_summary"
    | "desired_outcome"
    | "affected_pages"
    | "affected_workflows"
    | "acceptance_criteria"
    | "verification_steps"
    | "open_questions"
    | "assumptions"
    | "linear_issue_id"
    | "linear_draft_body"
    | "claude_handoff_path"
  >;
  latestPlan?: Pick<ImplementationPlanRow, "id"> | null;
}): FeatureRequestReadiness {
  const { request, latestPlan } = params;
  const affectedPages = asStringArray(request.affected_pages);
  const affectedWorkflows = asStringArray(request.affected_workflows);
  const acceptanceCriteria = asStringArray(request.acceptance_criteria);
  const verificationSteps = asStringArray(request.verification_steps);
  const openQuestions = asStringArray(request.open_questions);
  const assumptions = asStringArray(request.assumptions);
  const missingRequirements: string[] = [];

  if (!hasText(request.raw_request)) missingRequirements.push("raw stakeholder request");
  if (!hasText(request.assistant_summary)) missingRequirements.push("AIS stakeholder summary");
  if (!hasText(request.desired_outcome)) missingRequirements.push("desired outcome");
  if (affectedPages.length === 0 && affectedWorkflows.length === 0) {
    missingRequirements.push("affected workflow or page scope");
  }
  if (acceptanceCriteria.length === 0) missingRequirements.push("final acceptance criteria");
  if (verificationSteps.length === 0) missingRequirements.push("verification steps");
  if (openQuestions.length > 0 && assumptions.length === 0) {
    missingRequirements.push("open implementation-critical questions resolved or converted to assumptions");
  }
  if (!latestPlan) missingRequirements.push("implementation plan");
  if (!hasText(request.claude_handoff_path)) missingRequirements.push("Claude Code handoff");
  if (!hasText(request.linear_issue_id) && !hasText(request.linear_draft_body)) {
    missingRequirements.push("Linear issue or Linear draft body");
  }

  const readyForBuild = missingRequirements.length === 0;
  const status: FeatureRequestStatus = readyForBuild
    ? "ready_for_build"
    : acceptanceCriteria.length > 0 || verificationSteps.length > 0
      ? "ready_for_planning"
      : "needs_clarification";

  const blockedMessage = readyForBuild
    ? null
    : [
        "This is not ready for build yet.",
        "",
        "Missing:",
        ...missingRequirements.map((requirement) => `- ${requirement}`),
        "",
        "Recommended next action:",
        openQuestions[0] ??
          "Ask the stakeholder to confirm workflow scope, acceptance criteria, and verification expectations.",
      ].join("\n");

  return {
    readyForBuild,
    status,
    label: readyForBuild
      ? "Ready for build"
      : missingRequirements.length <= 3
        ? "Almost ready"
        : "Needs clarification",
    missingRequirements,
    goalClarity: hasText(request.desired_outcome) ? "high" : "low",
    dataClarity: affectedPages.length > 0 || affectedWorkflows.length > 0 ? "medium" : "low",
    uxClarity: affectedPages.length > 0 ? "medium" : "low",
    acceptanceStatus:
      acceptanceCriteria.length > 2 && verificationSteps.length > 0
        ? "complete"
        : acceptanceCriteria.length > 0
          ? "partial"
          : "missing",
    implementationRisk: openQuestions.length > 0 ? "high" : "medium",
    blockedMessage,
  };
}

export function assertReadyForBuild(readiness: FeatureRequestReadiness): void {
  if (!readiness.readyForBuild) {
    throw new Error(readiness.blockedMessage ?? "Feature request is not ready for build.");
  }
}
