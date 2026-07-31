import { z } from "zod";

export const aiEventTypeSchema = z.enum([
  "scheduled_run",
  "scheduled_check",
  "preview_request",
  "manual_regeneration",
  "source_sync_event",
  "teams_event",
  "email_event",
  "document_event",
  "financial_event",
  "project_event",
]);

export const aiEventStatusSchema = z.enum([
  "received",
  "accepted",
  "ignored",
  "rejected",
  "converted_to_run",
  "failed",
]);

export const aiRunStatusSchema = z.enum([
  "queued",
  "planning",
  "running",
  "waiting_on_child",
  "needs_user_approval",
  "needs_admin_review",
  "succeeded",
  "partial_success",
  "failed_retryable",
  "failed_permanent",
  "cancelled",
  "expired",
  "skipped",
]);

export const aiRunStepStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "skipped",
  "blocked",
  "failed_retryable",
  "failed_permanent",
]);

export const aiDeliveryStatusSchema = z.enum([
  "sent",
  "skipped",
  "blocked",
  "failed",
  "disabled",
  "dry_run",
]);

export const aiSourceHealthStatusSchema = z.enum([
  "loaded",
  "healthy",
  "stale",
  "missing",
  "degraded",
  "failed",
  "skipped",
  "unknown",
]);

export const aiConfidenceSchema = z.enum(["high", "medium", "low", "unknown"]);

export const aiSourceFamilySchema = z.enum([
  "fireflies",
  "meeting",
  "outlook",
  "email",
  "teams",
  "document",
  "rag",
  "acumatica",
  "procore",
  "project_intelligence",
  "intelligence_packet",
  "insight_card",
  "daily_recap",
  "delivery",
  "teams_recipient",
  "system",
]);

export const aiPermissionModeSchema = z.enum([
  "readonly",
  "service",
  "user_delegated",
  "admin_approved",
]);

export const aiRunPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);

export const aiArtifactKindSchema = z.enum([
  "brief_packet",
  "teams_payload",
  "email_payload",
  "source_health_report",
  "delivery_receipt",
  "verification_report",
]);

export const jsonRecordSchema = z.record(z.string(), z.unknown());

export const aiEventSchema = z.object({
  id: z.string().uuid().optional(),
  eventSource: z.string().min(1),
  eventType: aiEventTypeSchema,
  status: aiEventStatusSchema,
  idempotencyKey: z.string().min(1),
  sourceRecordId: z.string().min(1).nullable().optional(),
  sourceThreadId: z.string().min(1).nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  actorUserId: z.string().uuid().nullable().optional(),
  actorDisplayName: z.string().min(1).nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  deliveryContext: jsonRecordSchema.default({}),
  permissionContext: jsonRecordSchema.default({}),
  payload: jsonRecordSchema.default({}),
  failureCode: z.string().min(1).nullable().optional(),
  failureMessage: z.string().min(1).nullable().optional(),
  receivedAt: z.string().datetime().optional(),
  metadata: jsonRecordSchema.default({}),
});

export const evidenceRefSchema = z.object({
  sourceFamily: aiSourceFamilySchema,
  sourceId: z.string().min(1),
  sourceTitle: z.string().min(1),
  sourceUrl: z.string().url().nullable().optional(),
  internalHref: z.string().min(1).nullable().optional(),
  occurredAt: z.string().datetime().nullable().optional(),
  excerpt: z.string().min(1),
  confidence: aiConfidenceSchema,
  projectId: z.number().int().positive().nullable().optional(),
  projectLabel: z.string().min(1).nullable().optional(),
  metadata: jsonRecordSchema.default({}),
});

export const sourceHealthSnapshotSchema = z.object({
  sourceFamily: aiSourceFamilySchema,
  resourceId: z.string().min(1),
  resourceName: z.string().min(1),
  status: aiSourceHealthStatusSchema,
  checkedAt: z.string().datetime(),
  latestSourceAt: z.string().datetime().nullable().optional(),
  staleMinutes: z.number().int().nonnegative().nullable().optional(),
  loadedCount: z.number().int().nonnegative().default(0),
  missingCount: z.number().int().nonnegative().default(0),
  warning: z.string().min(1).nullable().optional(),
  failureCode: z.string().min(1).nullable().optional(),
  failureMessage: z.string().min(1).nullable().optional(),
  metadata: jsonRecordSchema.default({}),
});

export const aiArtifactSchema = z.object({
  id: z.string().uuid().optional(),
  runId: z.string().uuid(),
  kind: aiArtifactKindSchema,
  title: z.string().min(1),
  storageTable: z.string().min(1).nullable().optional(),
  storageId: z.string().min(1).nullable().optional(),
  contentType: z.string().min(1),
  checksum: z.string().min(1).nullable().optional(),
  sourceRefs: z.array(evidenceRefSchema).default([]),
  metadata: jsonRecordSchema.default({}),
  createdAt: z.string().datetime().optional(),
});

export const aiRunStepSchema = z.object({
  id: z.string().uuid().optional(),
  runId: z.string().uuid(),
  stepType: z.enum([
    "source_fetch",
    "tool_call",
    "synthesis",
    "artifact_persist",
    "delivery",
    "verification",
  ]),
  status: aiRunStepStatusSchema,
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  failureCode: z.string().min(1).nullable().optional(),
  failureMessage: z.string().min(1).nullable().optional(),
  metadata: jsonRecordSchema.default({}),
});

export const aiRunSchema = z.object({
  id: z.string().uuid().optional(),
  eventId: z.string().uuid().nullable().optional(),
  sourceSyncRunId: z.string().uuid().nullable().optional(),
  dailyRecapId: z.string().uuid().nullable().optional(),
  workflowId: z.string().min(1),
  workflowVersion: z.string().min(1),
  triggerType: z.string().min(1),
  surface: z.string().min(1),
  title: z.string().min(1),
  userGoal: z.string().min(1),
  normalizedGoal: z.string().min(1),
  status: aiRunStatusSchema,
  businessDate: z.string().date().nullable().optional(),
  attemptCount: z.number().int().nonnegative().default(0),
  blocker: z.string().min(1).nullable().optional(),
  nextAttemptAt: z.string().datetime().nullable().optional(),
  permissionMode: aiPermissionModeSchema,
  priority: aiRunPrioritySchema.default("normal"),
  modelPolicy: jsonRecordSchema.default({}),
  runtimeBudget: jsonRecordSchema.default({}),
  toolScope: jsonRecordSchema.default({}),
  sourcePolicy: jsonRecordSchema.default({}),
  sourceHealth: z.array(sourceHealthSnapshotSchema).default([]),
  sourceCounts: jsonRecordSchema.default({}),
  artifacts: z.array(aiArtifactSchema).default([]),
  resultSummary: z.string().min(1).nullable().optional(),
  confidence: aiConfidenceSchema.nullable().optional(),
  deliveryStatus: aiDeliveryStatusSchema.nullable().optional(),
  deliveryTarget: jsonRecordSchema.default({}),
  failureCode: z.string().min(1).nullable().optional(),
  failureMessage: z.string().min(1).nullable().optional(),
  retryable: z.boolean().default(false),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  metadata: jsonRecordSchema.default({}),
});

export const toolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  owningAdapter: z.string().min(1),
  inputSchemaName: z.string().min(1),
  outputSchemaName: z.string().min(1),
  failureShape: z.enum(["throws", "result_error", "status_payload"]),
  metadata: jsonRecordSchema.default({}),
});

export const toolPolicySchema = z.object({
  workflowId: z.string().min(1),
  allowedToolNames: z.array(z.string().min(1)).min(1),
  actorMode: aiPermissionModeSchema,
  allowedProjectIds: z.array(z.number().int().positive()).nullable().optional(),
  allowedSourceFamilies: z.array(aiSourceFamilySchema).min(1),
  allowDelivery: z.boolean(),
  allowWrites: z.boolean(),
  metadata: jsonRecordSchema.default({}),
});

export const workflowDefinitionSchema = z.object({
  workflowId: z.string().min(1),
  version: z.string().min(1),
  title: z.string().min(1),
  allowedTools: z.array(z.string().min(1)).min(1),
  sourcePolicy: z.object({
    requiredSourceFamilies: z.array(aiSourceFamilySchema).min(1),
    freshnessMinutes: z.number().int().positive(),
    minimumEvidenceRefsPerClaim: z.number().int().positive(),
    failWhenRequiredSourcesMissing: z.boolean(),
  }),
  evidencePolicy: z.object({
    requireSourceRefs: z.boolean(),
    minimumConfidence: aiConfidenceSchema,
    allowSyntheticEvidence: z.boolean(),
  }),
  deliveryPolicy: z.object({
    allowedChannels: z.array(z.enum(["teams", "email"])).min(1),
    defaultDryRun: z.boolean(),
    requireDeliveryAttemptRecord: z.boolean(),
  }),
  runtimeBudget: z.object({
    timeoutMs: z.number().int().positive(),
    maxToolCalls: z.number().int().positive(),
    maxModelCalls: z.number().int().positive(),
  }),
  failureModes: z.array(z.string().min(1)).min(1),
  metadata: jsonRecordSchema.default({}),
});

export const deliveryAttemptSchema = z.object({
  id: z.string().uuid().optional(),
  runId: z.string().uuid(),
  artifactId: z.string().uuid().nullable().optional(),
  channel: z.enum(["teams", "email"]),
  recipientId: z.string().min(1).nullable().optional(),
  recipientAddress: z.string().min(1).nullable().optional(),
  status: aiDeliveryStatusSchema,
  providerMessageId: z.string().min(1).nullable().optional(),
  failureCode: z.string().min(1).nullable().optional(),
  failureMessage: z.string().min(1).nullable().optional(),
  retryable: z.boolean().default(false),
  attemptedAt: z.string().datetime(),
  metadata: jsonRecordSchema.default({}),
});

export type AiEvent = z.infer<typeof aiEventSchema>;
export type AiRun = z.infer<typeof aiRunSchema>;
export type AiRunStep = z.infer<typeof aiRunStepSchema>;
export type AiArtifact = z.infer<typeof aiArtifactSchema>;
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export type SourceHealthSnapshot = z.infer<typeof sourceHealthSnapshotSchema>;
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;
export type ToolPolicy = z.infer<typeof toolPolicySchema>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type DeliveryAttempt = z.infer<typeof deliveryAttemptSchema>;
