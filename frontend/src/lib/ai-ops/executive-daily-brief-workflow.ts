import type { WorkflowDefinition } from "./contracts";
import {
  EXECUTIVE_DAILY_BRIEF_SOURCE_ADAPTERS,
  requiredExecutiveBriefSourceFamilies,
} from "./source-adapters";

export const EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID = "executive_daily_brief";
export const EXECUTIVE_DAILY_BRIEF_WORKFLOW_VERSION =
  "2026-07-07.canonical-packet-read-v1";

export const EXECUTIVE_DAILY_BRIEF_ALLOWED_TOOLS = [
  "fetch-fireflies-meeting-sources",
  "fetch-outlook-email-sources",
  "fetch-teams-message-sources",
  "fetch-document-rag-sources",
  "fetch-acumatica-financial-sources",
  "fetch-procore-project-sources",
  "fetch-project-intelligence-sources",
  "read-current-daily-executive-brief",
  "fetch-daily-executive-brief-sources",
  "build-teams-daily-brief-payload",
  "send-teams-daily-brief",
] as const;

export const EXECUTIVE_DAILY_BRIEF_WORKFLOW: WorkflowDefinition = {
  workflowId: EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
  version: EXECUTIVE_DAILY_BRIEF_WORKFLOW_VERSION,
  title: "Executive Daily Brief",
  allowedTools: [...EXECUTIVE_DAILY_BRIEF_ALLOWED_TOOLS],
  sourcePolicy: {
    requiredSourceFamilies: requiredExecutiveBriefSourceFamilies(),
    freshnessMinutes: 4_320,
    minimumEvidenceRefsPerClaim: 1,
    failWhenRequiredSourcesMissing: false,
  },
  evidencePolicy: {
    requireSourceRefs: true,
    minimumConfidence: "medium",
    allowSyntheticEvidence: false,
  },
  deliveryPolicy: {
    allowedChannels: ["teams", "email"],
    defaultDryRun: true,
    requireDeliveryAttemptRecord: true,
  },
  runtimeBudget: {
    timeoutMs: 180_000,
    maxToolCalls: 24,
    maxModelCalls: 2,
  },
  failureModes: [
    "missing_required_source",
    "stale_required_source",
    "missing_claim_evidence",
    "artifact_persist_failed",
    "delivery_disabled",
    "delivery_blocked",
    "delivery_provider_failed",
    "quota_or_model_failure",
    "schedule_skipped",
  ],
  metadata: {
    sourceAdapters: EXECUTIVE_DAILY_BRIEF_SOURCE_ADAPTERS.map((adapter) => ({
      adapterId: adapter.adapterId,
      sourceFamilies: adapter.sourceFamilies,
      requiredForExecutiveBrief: adapter.requiredForExecutiveBrief,
      defaultFreshnessMinutes: adapter.defaultFreshnessMinutes,
    })),
    packetSchemaName: "ExecutiveDailyBriefPacket",
    promptContract:
      "Read the canonical daily-executive-brief packet from intelligence_packets. Do not regenerate or deliver a Daily Brief unless the rebuilt compiler writes back to the same packet contract.",
    degradedOutputBehavior:
      "If the canonical packet is missing or stale, report that state and name the canonical manual source-bundle compiler as the missing generation step.",
    hardFailConditions: [
      "Canonical daily-executive-brief target is missing or inactive.",
      "No current or snapshot intelligence_packets row exists for the canonical target.",
      "A tool attempts to write to the legacy recap table or deliver from a non-canonical packet.",
    ],
  },
};

export function executiveDailyBriefSourcePolicyMetadata(input?: {
  allowedSourceFamilies?: WorkflowDefinition["sourcePolicy"]["requiredSourceFamilies"];
  allowedProjectIds?: number[] | null;
}) {
  return {
    workflowId: EXECUTIVE_DAILY_BRIEF_WORKFLOW.workflowId,
    workflowVersion: EXECUTIVE_DAILY_BRIEF_WORKFLOW.version,
    requiredSourceFamilies:
      EXECUTIVE_DAILY_BRIEF_WORKFLOW.sourcePolicy.requiredSourceFamilies,
    allowedSourceFamilies:
      input?.allowedSourceFamilies ??
      EXECUTIVE_DAILY_BRIEF_WORKFLOW.sourcePolicy.requiredSourceFamilies,
    allowedProjectIds: input?.allowedProjectIds ?? null,
    freshnessMinutes:
      EXECUTIVE_DAILY_BRIEF_WORKFLOW.sourcePolicy.freshnessMinutes,
    minimumEvidenceRefsPerClaim:
      EXECUTIVE_DAILY_BRIEF_WORKFLOW.sourcePolicy.minimumEvidenceRefsPerClaim,
    failWhenRequiredSourcesMissing:
      EXECUTIVE_DAILY_BRIEF_WORKFLOW.sourcePolicy
        .failWhenRequiredSourcesMissing,
  };
}
