import { createAiOpsLedger } from "@/lib/ai-ops/ledger";
import { createServiceClient } from "@/lib/supabase/service";

import type {
  SubmittalAIReviewReadinessLayer,
  SubmittalAIReviewRun,
} from "./schemas";

const WORKFLOW_ID = "submittal_ai_review";
const WORKFLOW_VERSION = "2026-06-26.ai-submittal-review-v1";

type SourceCoverage = SubmittalAIReviewRun["sourceCoverage"];

export type SubmittalAIReviewOpsContext = {
  runId: string;
  startedAt: string;
};

type StartInput = {
  projectId: number;
  submittalId: string;
  submittalReviewRunId: string;
  userId: string;
  focusArea: string | null;
  modelId: string;
  startedAt: string;
};

type StepStatus =
  | "succeeded"
  | "skipped"
  | "blocked"
  | "failed_retryable"
  | "failed_permanent";

function toAiRunStatus(status: SubmittalAIReviewRun["status"]) {
  if (status === "ready") return "succeeded" as const;
  if (status === "partial") return "partial_success" as const;
  if (status === "not_ready") return "skipped" as const;
  if (status === "failed") return "failed_permanent" as const;
  return "running" as const;
}

function sourceHealthFromReadiness(
  projectId: number,
  layers: SubmittalAIReviewReadinessLayer[],
) {
  return layers.map((layer) => ({
    sourceFamily:
      layer.key === "retrieval" ? ("rag" as const) : ("document" as const),
    resourceId: layer.key,
    resourceName: layer.label,
    status:
      layer.state === "ready"
        ? ("healthy" as const)
        : layer.state === "partial"
          ? ("degraded" as const)
          : layer.state === "not_ready"
            ? ("missing" as const)
            : ("failed" as const),
    checkedAt: new Date().toISOString(),
    loadedCount: layer.availableCount ?? 0,
    missingCount: Math.max(
      (layer.totalCount ?? 0) - (layer.availableCount ?? 0),
      0,
    ),
    warning: layer.reasons.length > 0 ? layer.reasons.join(" ") : null,
    metadata: {
      projectId,
      readinessKey: layer.key,
      readinessState: layer.state,
    },
  }));
}

export async function startSubmittalAIReviewOpsRun(
  input: StartInput,
): Promise<SubmittalAIReviewOpsContext> {
  const ledger = createAiOpsLedger(createServiceClient());
  const run = await ledger.createRun({
    workflowId: WORKFLOW_ID,
    workflowVersion: WORKFLOW_VERSION,
    triggerType: "manual_review",
    surface: "submittal_detail_ai_review",
    title: "Submittal AI Review",
    userGoal: "Review a construction submittal against linked drawings and source evidence.",
    normalizedGoal:
      "Generate structured, source-backed submittal review findings.",
    status: "running",
    permissionMode: "user_delegated",
    priority: "normal",
    modelPolicy: {
      modelId: input.modelId,
      maxModelCalls: 1,
    },
    runtimeBudget: {
      maxModelCalls: 1,
      maxToolCalls: 2,
    },
    toolScope: {
      allowedTools: [
        "reviewSubmittalAgainstDrawings",
        "getSpecRequirements",
      ],
      allowedProjectIds: [input.projectId],
      allowWrites: true,
      allowDelivery: false,
    },
    sourcePolicy: {
      requiredSourceFamilies: ["document", "rag"],
      failWhenRequiredSourcesMissing: false,
    },
    sourceHealth: [],
    sourceCounts: {},
    artifacts: [],
    deliveryTarget: {},
    retryable: false,
    startedAt: input.startedAt,
    metadata: {
      projectId: input.projectId,
      submittalId: input.submittalId,
      submittalReviewRunId: input.submittalReviewRunId,
      actorUserId: input.userId,
      focusArea: input.focusArea,
    },
  });

  return { runId: run.id, startedAt: input.startedAt };
}

export async function recordSubmittalAIReviewOpsStep(
  context: SubmittalAIReviewOpsContext | null,
  input: {
    stepType: "source_fetch" | "tool_call" | "synthesis" | "artifact_persist";
    status: StepStatus;
    startedAt: string;
    completedAt?: string;
    failureCode?: string | null;
    failureMessage?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  if (!context) return;
  const ledger = createAiOpsLedger(createServiceClient());
  await ledger.createRunStep({
    runId: context.runId,
    stepType: input.stepType,
    status: input.status,
    startedAt: input.startedAt,
    completedAt: input.completedAt ?? new Date().toISOString(),
    failureCode: input.failureCode ?? null,
    failureMessage: input.failureMessage ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function completeSubmittalAIReviewOpsRun(
  context: SubmittalAIReviewOpsContext | null,
  payload: SubmittalAIReviewRun,
) {
  if (!context) return;
  const ledger = createAiOpsLedger(createServiceClient());
  const completedAt = payload.completedAt ?? new Date().toISOString();

  await ledger.updateRun(context.runId, {
    status: toAiRunStatus(payload.status),
    sourceCounts: payload.sourceCoverage,
    resultSummary:
      payload.summary ??
      payload.error?.message ??
      payload.readiness.summary,
    confidence:
      payload.status === "ready"
        ? "high"
        : payload.status === "partial"
          ? "medium"
          : payload.status === "not_ready"
            ? "low"
            : "unknown",
    failureCode: payload.error?.code ?? null,
    failureMessage: payload.error?.message ?? null,
    completedAt,
    metadata: {
      workflowVersion: WORKFLOW_VERSION,
      submittalReviewRunId: payload.runId,
      submittalId: payload.submittalId,
      projectId: payload.projectId,
      readiness: payload.readiness,
      sourceCoverage: payload.sourceCoverage,
      checkCount: payload.checks.length,
      linkedDrawingCount: payload.linkedDrawings.length,
      sourceHealth: sourceHealthFromReadiness(
        payload.projectId,
        payload.readiness.layers,
      ),
    },
  });

  const artifact = await ledger.createArtifact({
    runId: context.runId,
    kind: "verification_report",
    title: "Submittal AI review result",
    storageTable: "submittal_ai_review_runs",
    storageId: payload.runId,
    contentType: "application/vnd.alleato.submittal-ai-review+json",
    sourceRefs: [],
    metadata: {
      status: payload.status,
      readinessState: payload.readiness.state,
      sourceCoverage: payload.sourceCoverage,
      checkCount: payload.checks.length,
    },
  });

  await recordSubmittalAIReviewOpsStep(context, {
    stepType: "artifact_persist",
    status: "succeeded",
    startedAt: completedAt,
    completedAt,
    metadata: {
      artifactId: artifact.id,
      storageTable: "submittal_ai_review_runs",
      storageId: payload.runId,
    },
  });
}

export async function failSubmittalAIReviewOpsRun(
  context: SubmittalAIReviewOpsContext | null,
  input: {
    code: string;
    message: string;
    sourceCoverage?: SourceCoverage;
    metadata?: Record<string, unknown>;
  },
) {
  if (!context) return;
  const completedAt = new Date().toISOString();
  const ledger = createAiOpsLedger(createServiceClient());
  await ledger.updateRun(context.runId, {
    status: "failed_permanent",
    sourceCounts: input.sourceCoverage,
    failureCode: input.code,
    failureMessage: input.message,
    completedAt,
    metadata: {
      workflowVersion: WORKFLOW_VERSION,
      completedAt,
      ...(input.metadata ?? {}),
    },
  });
}
