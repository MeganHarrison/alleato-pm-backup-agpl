import type {
  DeliveryAttempt,
  AiEvent,
  AiRun,
  EvidenceRef,
  SourceHealthSnapshot,
  ToolPolicy,
} from "./contracts";
import { assertExecutiveBriefingDraftEvidence } from "./executive-daily-brief-evidence";
import { createAiOpsLedger } from "./ledger";
import { createServiceClient } from "@/lib/supabase/service";
import type { ExecutiveBriefingDraft } from "@/lib/executive/executive-briefing-workflow";
import type {
  OwnerBriefingDeliveryResult,
  OwnerBriefingSourceSummary,
} from "@/lib/executive/owner-briefing-delivery";
import {
  EXECUTIVE_DAILY_BRIEF_WORKFLOW,
  EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
  EXECUTIVE_DAILY_BRIEF_WORKFLOW_VERSION,
  executiveDailyBriefSourcePolicyMetadata,
} from "./executive-daily-brief-workflow";
import { ledgerChannelForDeliveryPlatform } from "./delivery-router";
import { sourceAdapterRunStepsFromHealth } from "./source-adapters";
import { executiveDailyBriefToolScope } from "./tool-registry";

export type DailyBriefRunContext = {
  eventId: string;
  runId: string;
  startedAt: string;
  toolPolicy: ToolPolicy;
};

type StartDailyBriefRunInput = {
  eventType: AiEvent["eventType"];
  triggerType: string;
  surface: string;
  title: string;
  userGoal: string;
  normalizedGoal: string;
  actorDisplayName?: string | null;
  actorMode?: ToolPolicy["actorMode"];
  allowedProjectIds?: number[] | null;
  allowedSourceFamilies?: ToolPolicy["allowedSourceFamilies"];
  deliveryTarget?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  businessDate?: string;
};

type CompleteDailyBriefRunInput = {
  status: AiRun["status"];
  resultSummary: string;
  dailyRecapId?: string | null;
  deliveryStatus?: AiRun["deliveryStatus"];
  deliveryTarget?: Record<string, unknown>;
  sourceCounts?: Record<string, unknown>;
  sourceHealth?: SourceHealthSnapshot[];
  metadata?: Record<string, unknown>;
};

type RecordPayloadArtifactInput = {
  title: string;
  contentType: string;
  storageTable?: string | null;
  storageId?: string | null;
  metadata?: Record<string, unknown>;
};

type RecordDeliveryAttemptInput = {
  artifactId?: string | null;
  channel: DeliveryAttempt["channel"];
  recipientId?: string | null;
  recipientAddress?: string | null;
  status: DeliveryAttempt["status"];
  providerMessageId?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
};

function nowIso() {
  return new Date().toISOString();
}

async function recordToolCallStep(
  context: DailyBriefRunContext,
  input: {
    toolName: string;
    status: "succeeded" | "failed_retryable" | "failed_permanent";
    startedAt: string;
    completedAt?: string;
    failureCode?: string | null;
    failureMessage?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const ledger = createAiOpsLedger(createServiceClient());
  await ledger.createRunStep({
    runId: context.runId,
    stepType: "tool_call",
    status: input.status,
    startedAt: input.startedAt,
    completedAt: input.completedAt ?? nowIso(),
    failureCode: input.failureCode ?? null,
    failureMessage: input.failureMessage ?? null,
    metadata: {
      toolName: input.toolName,
      ...(input.metadata ?? {}),
    },
  });
}

function toIsoOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function idempotencyKey(input: StartDailyBriefRunInput, startedAt: string) {
  return [
    EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
    input.surface,
    input.eventType,
    input.triggerType,
    startedAt,
  ].join(":");
}

function allowDeliveryForTarget(deliveryTarget: Record<string, unknown>) {
  if (deliveryTarget.channel === "none") return false;
  if (deliveryTarget.dryRun === true) return false;
  if (deliveryTarget.deliveryEnabled === false) return false;
  if (typeof deliveryTarget.channel !== "string") return false;
  return ledgerChannelForDeliveryPlatform(deliveryTarget.channel) !== null;
}

function sourceFamily(value: string): EvidenceRef["sourceFamily"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("meeting") || normalized.includes("fireflies"))
    return "meeting";
  if (normalized.includes("email") || normalized.includes("outlook"))
    return "email";
  if (normalized.includes("teams")) return "teams";
  if (normalized.includes("document")) return "document";
  if (normalized.includes("financial") || normalized.includes("acumatica"))
    return "acumatica";
  if (normalized.includes("procore")) return "procore";
  if (normalized.includes("packet")) return "intelligence_packet";
  if (normalized.includes("card")) return "insight_card";
  return "project_intelligence";
}

function confidence(
  value: string | null | undefined,
): EvidenceRef["confidence"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "unknown";
}

function sourceHealthFromDraft(
  draft: ExecutiveBriefingDraft,
): SourceHealthSnapshot[] {
  return draft.packet.sourceCoverage.map((source) => ({
    sourceFamily: sourceFamily(source.label),
    resourceId: source.label,
    resourceName: source.detail || source.label,
    status:
      source.status === "loaded"
        ? "loaded"
        : source.status === "warning"
          ? "degraded"
          : source.status === "empty"
            ? "missing"
            : "unknown",
    checkedAt: nowIso(),
    latestSourceAt: toIsoOrNull(source.latest),
    loadedCount: source.count,
    missingCount: source.status === "empty" ? 1 : 0,
    warning: source.warning ?? null,
    metadata: { label: source.label },
  }));
}

function evidenceRefsFromSourceSummary(
  summary: OwnerBriefingSourceSummary,
): EvidenceRef[] {
  const refs: EvidenceRef[] = [];

  for (const project of summary.topProjects) {
    if (project.packetId) {
      refs.push({
        sourceFamily: "intelligence_packet",
        sourceId: project.packetId,
        sourceTitle: project.projectName,
        occurredAt: toIsoOrNull(project.packetGeneratedAt),
        excerpt: project.packetIsStale
          ? "Packet was stale when selected for the owner briefing."
          : "Packet was current when selected for the owner briefing.",
        confidence: "unknown",
        projectId: project.projectId,
        projectLabel: project.projectName,
        metadata: {
          targetId: project.targetId,
          packetIsStale: project.packetIsStale,
        },
      });
    }

    for (const item of [
      ...project.decisionsNeeded,
      ...project.actionsRequired,
    ]) {
      refs.push({
        sourceFamily: "insight_card",
        sourceId: item.cardId,
        sourceTitle: item.title,
        occurredAt: toIsoOrNull(item.lastSeenAt ?? item.firstSeenAt),
        excerpt:
          item.summary ?? item.whyItMatters ?? item.nextAction ?? item.title,
        confidence: confidence(item.confidence),
        projectId: project.projectId,
        projectLabel: project.projectName,
        metadata: {
          targetId: project.targetId,
          cardType: item.cardType,
          sourceCount: item.sourceCount,
        },
      });
    }
  }

  return refs;
}

export function evidenceRefsFromDeliveryResult(
  result:
    | OwnerBriefingDeliveryResult
    | { skipped?: boolean; status?: string; reason?: string },
): EvidenceRef[] {
  if ("sourceSummary" in result) {
    return evidenceRefsFromSourceSummary(result.sourceSummary);
  }
  return [];
}

export function sourceHealthForDeliveryResult(
  result:
    | OwnerBriefingDeliveryResult
    | { skipped?: boolean; status?: string; reason?: string },
): SourceHealthSnapshot[] {
  if (!("sourceSummary" in result)) {
    return [
      {
        sourceFamily: "project_intelligence",
        resourceId: "owner_briefing_delivery",
        resourceName: "Owner briefing delivery",
        status:
          result.status === "disabled" ||
          ("skipped" in result && result.skipped)
            ? "skipped"
            : "unknown",
        checkedAt: nowIso(),
        loadedCount: 0,
        missingCount: 0,
        warning: result.reason ?? null,
        metadata: {},
      },
    ];
  }

  return [
    {
      sourceFamily: "project_intelligence",
      resourceId: "owner_briefing_source_summary",
      resourceName: "Owner briefing source summary",
      status: result.sourceSummary.stalePacketCount > 0 ? "degraded" : "loaded",
      checkedAt: nowIso(),
      latestSourceAt: toIsoOrNull(result.sourceSummary.generatedAt),
      loadedCount: result.sourceSummary.activeProjectCount,
      missingCount: 0,
      warning:
        result.sourceSummary.stalePacketCount > 0
          ? `${result.sourceSummary.stalePacketCount} stale packet(s) were included.`
          : null,
      metadata: {
        stalePacketCount: result.sourceSummary.stalePacketCount,
        projectCount: result.sourceSummary.topProjects.length,
      },
    },
  ];
}

export async function startDailyBriefRun(
  input: StartDailyBriefRunInput,
): Promise<DailyBriefRunContext> {
  const startedAt = nowIso();
  const ledger = createAiOpsLedger(createServiceClient());
  const deliveryTarget = input.deliveryTarget ?? {};
  const actorMode = input.actorMode ?? "service";
  const allowedProjectIds = input.allowedProjectIds ?? null;
  const toolScope = executiveDailyBriefToolScope({
    actorMode,
    allowDelivery: allowDeliveryForTarget(deliveryTarget),
    allowWrites: true,
    allowedProjectIds,
    allowedSourceFamilies: input.allowedSourceFamilies,
    allowedChannels:
      deliveryTarget.channel === "email"
        ? ["email"]
        : deliveryTarget.channel === "teams"
          ? ["teams"]
          : ["teams", "email"],
  });
  const event = await ledger.createEvent({
    eventSource: EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
    eventType: input.eventType,
    status: "accepted",
    idempotencyKey: idempotencyKey(input, startedAt),
    actorDisplayName: input.actorDisplayName ?? null,
    deliveryContext: deliveryTarget,
    permissionContext: {
      permissionMode: actorMode,
      allowedProjectIds,
      allowedSourceFamilies: toolScope.policy.allowedSourceFamilies,
    },
    payload: input.payload ?? {},
    metadata: { ...(input.metadata ?? {}), startedAt },
  });

  const run = await ledger.createRun({
    eventId: event.id,
    workflowId: EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
    workflowVersion: EXECUTIVE_DAILY_BRIEF_WORKFLOW_VERSION,
    triggerType: input.triggerType,
    surface: input.surface,
    title: input.title,
    userGoal: input.userGoal,
    normalizedGoal: input.normalizedGoal,
    status: "running",
    businessDate: input.businessDate ?? new Date(startedAt).toISOString().slice(0, 10),
    attemptCount: 1,
    priority: "high",
    permissionMode: actorMode,
    modelPolicy: {
      route: "executive_daily_brief",
      maxModelCalls: EXECUTIVE_DAILY_BRIEF_WORKFLOW.runtimeBudget.maxModelCalls,
    },
    runtimeBudget: EXECUTIVE_DAILY_BRIEF_WORKFLOW.runtimeBudget,
    toolScope: {
      visibleToolNames: toolScope.visibleToolNames,
      hiddenToolNames: toolScope.hiddenToolNames,
      allowDelivery: toolScope.policy.allowDelivery,
      allowWrites: toolScope.policy.allowWrites,
      actorMode: toolScope.policy.actorMode,
      allowedProjectIds: toolScope.policy.allowedProjectIds,
      allowedSourceFamilies: toolScope.policy.allowedSourceFamilies,
    },
    sourcePolicy: executiveDailyBriefSourcePolicyMetadata({
      allowedProjectIds,
      allowedSourceFamilies: toolScope.policy.allowedSourceFamilies,
    }),
    sourceHealth: [],
    sourceCounts: {},
    artifacts: [],
    deliveryTarget,
    retryable: false,
    startedAt,
    metadata: {
      ...(input.metadata ?? {}),
      workflowPack: EXECUTIVE_DAILY_BRIEF_WORKFLOW,
      toolPolicy: toolScope.policy,
    },
  });

  return {
    eventId: event.id,
    runId: run.id,
    startedAt,
    toolPolicy: toolScope.policy,
  };
}

export async function completeDailyBriefRun(
  context: DailyBriefRunContext,
  input: CompleteDailyBriefRunInput,
) {
  const completedAt = nowIso();
  const ledger = createAiOpsLedger(createServiceClient());
  await ledger.updateEvent(context.eventId, {
    status: "converted_to_run",
    metadata: { completedAt, ...(input.metadata ?? {}) },
  });
  await ledger.updateRun(context.runId, {
    status: input.status,
    dailyRecapId: input.dailyRecapId,
    resultSummary: input.resultSummary,
    deliveryStatus: input.deliveryStatus,
    deliveryTarget: input.deliveryTarget,
    sourceCounts: input.sourceCounts,
    completedAt,
    metadata: {
      completedAt,
      toolPolicy: context.toolPolicy,
      sourceHealth: input.sourceHealth ?? [],
      ...(input.metadata ?? {}),
    },
  });
}

export async function failDailyBriefRun(
  context: DailyBriefRunContext | null,
  error: unknown,
  failureCode: string,
) {
  if (!context) return;
  const message = error instanceof Error ? error.message : String(error);
  const completedAt = nowIso();
  const ledger = createAiOpsLedger(createServiceClient());
  await ledger.updateEvent(context.eventId, {
    status: "failed",
    failureCode,
    failureMessage: message,
    metadata: { completedAt },
  });
  await ledger.updateRun(context.runId, {
    status: "failed_permanent",
    deliveryStatus: "failed",
    failureCode,
    failureMessage: message,
    completedAt,
    metadata: { completedAt, toolPolicy: context.toolPolicy },
  });
}

export async function recordDraftEvidence(
  context: DailyBriefRunContext,
  draft: ExecutiveBriefingDraft,
) {
  const ledger = createAiOpsLedger(createServiceClient());
  const sourceHealth = sourceHealthFromDraft(draft);
  const adapterStepAt = nowIso();
  for (const step of sourceAdapterRunStepsFromHealth({
    runId: context.runId,
    health: sourceHealth,
    at: adapterStepAt,
  })) {
    await ledger.createRunStep(step);
  }

  const sourceRefs = assertExecutiveBriefingDraftEvidence(draft);
  await ledger.insertEvidenceRefs(context.runId, sourceRefs);
  await ledger.createArtifact({
    runId: context.runId,
    kind: "source_health_report",
    title: "Executive Daily Brief source health report",
    storageTable: "ai_work_runs",
    storageId: context.runId,
    contentType: "application/vnd.alleato.source-health+json",
    sourceRefs: [],
    metadata: {
      recapDate: draft.recapDate,
      sourceHealth,
    },
  });
  const artifact = await ledger.createArtifact({
    runId: context.runId,
    kind: "brief_packet",
    title: "Executive Daily Brief packet",
    storageTable: "daily_recaps",
    storageId: draft.id,
    contentType: "application/vnd.alleato.executive-brief+json",
    sourceRefs,
    metadata: {
      recapDate: draft.recapDate,
      workflowStatus: draft.workflowStatus,
      itemCount:
        draft.packet.sections.needsBrandon.length +
        draft.packet.sections.waitingOnOthers.length +
        draft.packet.sections.importantUpdates.length,
    },
  });
  await ledger.createRunStep({
    runId: context.runId,
    stepType: "artifact_persist",
    status: "succeeded",
    startedAt: nowIso(),
    completedAt: nowIso(),
    metadata: {
      artifactId: artifact.id,
      artifactKind: "brief_packet",
      storageTable: "daily_recaps",
      storageId: draft.id,
      sourceRefCount: sourceRefs.length,
    },
  });
  return artifact;
}

export async function recordDeliveryEvidence(
  context: DailyBriefRunContext,
  result: OwnerBriefingDeliveryResult,
  artifactId?: string | null,
) {
  const ledger = createAiOpsLedger(createServiceClient());
  await ledger.insertEvidenceRefs(
    context.runId,
    evidenceRefsFromDeliveryResult(result),
  );
  if (result.ok) {
    for (const recipient of result.recipients) {
      await ledger.createDeliveryAttempt({
        runId: context.runId,
        artifactId: artifactId ?? null,
        channel: "teams",
        recipientId: recipient.userId,
        recipientAddress: recipient.email,
        status:
          recipient.reason === "dry_run"
            ? "dry_run"
            : recipient.sent
              ? "sent"
              : "failed",
        providerMessageId: recipient.providerMessageId ?? null,
        failureCode:
          !recipient.sent && recipient.reason !== "dry_run"
            ? "TEAMS_RECIPIENT_SEND_FAILED"
            : null,
        failureMessage:
          !recipient.sent && recipient.reason !== "dry_run"
            ? (recipient.reason ?? "Teams send failed for recipient.")
            : null,
        retryable: !recipient.sent && recipient.reason !== "dry_run",
        attemptedAt: result.sentAt,
        metadata: {
          displayName: recipient.displayName,
          reason: recipient.reason ?? null,
          providerResponse: recipient.providerResponse ?? null,
        },
      });
    }
    await ledger.createRunStep({
      runId: context.runId,
      stepType: "delivery",
      status: result.recipients.every(
        (recipient) => recipient.sent || recipient.reason === "dry_run",
      )
        ? "succeeded"
        : "failed_retryable",
      startedAt: result.sentAt,
      completedAt: result.sentAt,
      metadata: {
        channel: "teams",
        artifactId: artifactId ?? null,
        recipientCount: result.recipients.length,
      },
    });
    return;
  }

  await ledger.createDeliveryAttempt({
    runId: context.runId,
    artifactId: artifactId ?? null,
    channel: "teams",
    status: result.status,
    failureCode:
      result.status === "blocked"
        ? "TEAMS_DELIVERY_BLOCKED"
        : "TEAMS_DELIVERY_FAILED",
    failureMessage: result.reason,
    retryable: result.status === "failed",
    attemptedAt: nowIso(),
    metadata: { reason: result.reason },
  });
  await ledger.createRunStep({
    runId: context.runId,
    stepType: "delivery",
    status: result.status === "blocked" ? "blocked" : "failed_retryable",
    startedAt: nowIso(),
    completedAt: nowIso(),
    failureCode:
      result.status === "blocked"
        ? "TEAMS_DELIVERY_BLOCKED"
        : "TEAMS_DELIVERY_FAILED",
    failureMessage: result.reason,
    metadata: { channel: "teams", artifactId: artifactId ?? null },
  });
}

export async function recordTeamsPayloadArtifact(
  context: DailyBriefRunContext,
  input: RecordPayloadArtifactInput,
): Promise<{ id: string }> {
  const startedAt = nowIso();
  const ledger = createAiOpsLedger(createServiceClient());
  const artifact = await ledger.createArtifact({
    runId: context.runId,
    kind: "teams_payload",
    title: input.title,
    contentType: input.contentType,
    storageTable: input.storageTable ?? null,
    storageId: input.storageId ?? null,
    sourceRefs: [],
    metadata: input.metadata ?? {},
  });
  await recordToolCallStep(context, {
    toolName: "build-teams-daily-brief-payload",
    status: "succeeded",
    startedAt,
    metadata: {
      artifactId: artifact.id,
      artifactKind: "teams_payload",
      ...(input.metadata ?? {}),
    },
  });
  return artifact;
}

export async function recordEmailPayloadArtifact(
  context: DailyBriefRunContext,
  input: RecordPayloadArtifactInput,
): Promise<{ id: string }> {
  const startedAt = nowIso();
  const ledger = createAiOpsLedger(createServiceClient());
  const artifact = await ledger.createArtifact({
    runId: context.runId,
    kind: "email_payload",
    title: input.title,
    contentType: input.contentType,
    sourceRefs: [],
    metadata: input.metadata ?? {},
  });
  await recordToolCallStep(context, {
    toolName: "build-email-daily-brief-payload",
    status: "succeeded",
    startedAt,
    metadata: {
      artifactId: artifact.id,
      artifactKind: "email_payload",
      ...(input.metadata ?? {}),
    },
  });
  return artifact;
}

export async function recordDeliveryAttempt(
  context: DailyBriefRunContext,
  input: RecordDeliveryAttemptInput,
) {
  const ledger = createAiOpsLedger(createServiceClient());
  const attempt = await ledger.createDeliveryAttempt({
    runId: context.runId,
    artifactId: input.artifactId ?? null,
    channel: input.channel,
    recipientId: input.recipientId ?? null,
    recipientAddress: input.recipientAddress ?? null,
    status: input.status,
    providerMessageId: input.providerMessageId ?? null,
    failureCode: input.failureCode ?? null,
    failureMessage: input.failureMessage ?? null,
    retryable: input.retryable ?? false,
    attemptedAt: nowIso(),
    metadata: input.metadata ?? {},
  });
  await ledger.createRunStep({
    runId: context.runId,
    stepType: "delivery",
    status:
      input.status === "sent" || input.status === "dry_run"
        ? "succeeded"
        : input.status === "disabled" ||
            input.status === "blocked" ||
            input.status === "skipped"
          ? "blocked"
          : input.retryable
            ? "failed_retryable"
            : "failed_permanent",
    startedAt: nowIso(),
    completedAt: nowIso(),
    failureCode: input.failureCode ?? null,
    failureMessage: input.failureMessage ?? null,
    metadata: {
      toolName:
        input.status === "dry_run"
          ? input.channel === "email"
            ? "build-email-daily-brief-payload"
            : "build-teams-daily-brief-payload"
          : input.channel === "email"
            ? "send-email-daily-brief"
            : "send-teams-daily-brief",
      channel: input.channel,
      status: input.status,
      artifactId: input.artifactId ?? null,
      deliveryAttemptId: attempt.id,
      ...(input.metadata ?? {}),
    },
  });
  return attempt;
}

export function sourceHealthForDraft(draft: ExecutiveBriefingDraft) {
  return sourceHealthFromDraft(draft);
}
