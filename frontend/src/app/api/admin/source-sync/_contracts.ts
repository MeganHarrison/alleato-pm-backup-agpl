import { z } from "zod";

export const SourceHealthSchema = z.object({
  source: z.string(),
  resourceId: z.string(),
  resourceName: z.string(),
  status: z.enum(["healthy", "warning", "critical", "unknown"]),
  lastSyncAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  lastErrorAt: z.string().nullable(),
  lastErrorMessage: z.string().nullable(),
  itemsSynced: z.number(),
  staleMinutes: z.number().nullable(),
  unprocessedCount: z.number(),
  unembeddedCount: z.number(),
  uncompiledCount: z.number(),
  metadata: z.record(z.string(), z.unknown()),
});

export const SourceSyncAlertSchema = z.object({
  severity: z.enum(["info", "warning", "critical"]).or(z.string()),
  code: z.string(),
  source: z.string(),
  resourceId: z.string(),
  message: z.string(),
  detectedAt: z.string().nullable(),
});

export const SourceSyncRunSchema = z.object({
  id: z.string(),
  source: z.string(),
  stage: z.string(),
  status: z.string(),
  resourceId: z.string(),
  resourceName: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  itemsSeen: z.number(),
  itemsSynced: z.number(),
  itemsFailed: z.number(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export const SourceSyncStuckItemSchema = z.object({
  source: z.string(),
  resourceId: z.string(),
  resourceName: z.string(),
  stage: z.string(),
  status: z.string(),
  ageMinutes: z.number().nullable(),
  lastAttemptAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export const RagLifecycleStageSchema = z.object({
  key: z.enum([
    "synced",
    "vectorized",
    "projectAssigned",
    "tasksExtracted",
    "projectIntelligenceUpdated",
  ]),
  label: z.string(),
  status: z.enum(["healthy", "warning", "critical", "unknown"]),
  count: z.number(),
  total: z.number(),
  latestAt: z.string().nullable(),
  message: z.string(),
  ownerHint: z.string(),
});

export const RagLifecycleSourceSchema = z.object({
  key: z.enum(["meetings", "teams", "emails", "sharepoint"]),
  label: z.string(),
  sourceSystems: z.array(z.string()),
  totalSources: z.number(),
  latestSourceAt: z.string().nullable(),
  status: z.enum(["healthy", "warning", "critical", "unknown"]),
  stages: z.array(RagLifecycleStageSchema),
  alerts: z.array(SourceSyncAlertSchema),
});

export const RagLifecycleNotificationSchema = z.object({
  status: z.enum(["sent", "ready", "blocked", "failed", "skipped"]),
  channel: z.string(),
  message: z.string(),
  checkedAt: z.string(),
});

export const RagLifecycleStatusSchema = z.object({
  generatedAt: z.string(),
  lookbackHours: z.number(),
  maxPacketAgeHours: z.number(),
  status: z.enum(["healthy", "degraded", "unavailable"]),
  sources: z.array(RagLifecycleSourceSchema),
  notifications: z.array(RagLifecycleNotificationSchema),
});

export const LifecycleDocumentSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  date: z.string().nullable(),
  projectId: z.number().nullable(),
  projectName: z.string().nullable(),
  taskOutcome: z.enum([
    "tasks_created",
    "no_actionable_tasks",
    "task_signal_staged",
    "not_extracted",
  ]),
  stages: z.object({
    synced: z.boolean(),
    vectorized: z.boolean(),
    projectAssigned: z.boolean(),
    tasksExtracted: z.boolean(),
    projectIntelligenceUpdated: z.boolean(),
  }),
  detailHref: z.string().nullable(),
  webUrl: z.string().nullable(),
});

export const LifecycleDocumentsResponseSchema = z.object({
  source: z.enum(["meetings", "teams", "emails", "sharepoint"]),
  sourceLabel: z.string(),
  stageKey: z.string(),
  generatedAt: z.string(),
  total: z.number(),
  returned: z.number(),
  truncated: z.boolean(),
  documents: z.array(LifecycleDocumentSchema),
});

export type LifecycleDocumentsResponse = z.infer<typeof LifecycleDocumentsResponseSchema>;

export const DailyContentSourceSchema = z.object({
  key: z.enum(["emails", "meetings", "sharepoint", "teams"]),
  label: z.string(),
  synced: z.number(),
  embedded: z.number(),
  latestAt: z.string().nullable(),
});

export const DailyContentResponseSchema = z.object({
  date: z.string(),
  generatedAt: z.string(),
  sources: z.array(DailyContentSourceSchema),
  totals: z.object({ synced: z.number(), embedded: z.number() }),
});

export type DailyContentResponse = z.infer<typeof DailyContentResponseSchema>;

export const SourceSyncStatusSchema = z.object({
  status: z.enum(["healthy", "degraded", "unavailable"]),
  healthy: z.boolean(),
  generatedAt: z.string(),
  thresholds: z.record(z.string(), z.number()),
  sources: z.array(SourceHealthSchema),
  // `pipeline` is a diagnostic breakdown block. Most entries are
  // `Record<string, number>` (e.g. documentMetadataBySource), but the backend
  // also emits scalar counts (e.g. `unconfiguredGraphSubscriptions: number`).
  // Accept both so a single additive diagnostic field can never 500 the entire
  // RAG health page again (see status route SCHEMA_MISMATCH incident 2026-06-27).
  pipeline: z.record(
    z.string(),
    z.union([z.record(z.string(), z.number()), z.number()]),
  ),
  alerts: z.array(SourceSyncAlertSchema),
  recentRuns: z.array(SourceSyncRunSchema),
  stuckItems: z.array(SourceSyncStuckItemSchema),
  counts: z.object({
    sources: z.number(),
    alerts: z.number(),
    documents: z.number(),
    chunks: z.number(),
    unembedded: z.number(),
    uncompiled: z.number(),
    tasks: z.number(),
    graphSubscriptions: z.number(),
    stuckItems: z.number(),
  }),
  ragLifecycle: RagLifecycleStatusSchema.optional(),
});

export type SourceSyncStatus = z.infer<typeof SourceSyncStatusSchema>;
