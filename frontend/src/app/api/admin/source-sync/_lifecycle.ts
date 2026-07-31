/**
 * Shared RAG-lifecycle primitives.
 *
 * The lifecycle matrix on /rag?tab=lifecycle and its per-document drill-down
 * MUST agree on which documents belong to a source family and which lifecycle
 * stages each document has cleared. Those rules live here so the aggregate
 * counts (status/route.ts) and the document list (lifecycle-documents/route.ts)
 * can never drift.
 */

export type LifecycleStageKey =
  | "synced"
  | "vectorized"
  | "projectAssigned"
  | "tasksExtracted"
  | "projectIntelligenceUpdated";

export type LifecycleStatus = "healthy" | "warning" | "critical" | "unknown";

export type SourceFamilyKey = "meetings" | "teams" | "emails" | "sharepoint";

export const STAGE_KEYS: LifecycleStageKey[] = [
  "synced",
  "vectorized",
  "projectAssigned",
  "tasksExtracted",
  "projectIntelligenceUpdated",
];

export const STAGE_LABELS: Record<LifecycleStageKey, string> = {
  synced: "Synced",
  vectorized: "Vectorized",
  projectAssigned: "Project assigned",
  tasksExtracted: "Tasks extracted",
  projectIntelligenceUpdated: "Project Intelligence updated",
};

export type SourceRow = {
  id: string;
  title: string | null;
  source: string | null;
  category: string | null;
  type: string | null;
  project_id: number | null;
  source_system: string | null;
  source_item_id: string | null;
  fireflies_id: string | null;
  created_at: string | null;
  date: string | null;
  source_last_modified_at: string | null;
  source_web_url?: string | null;
};

export type RagEmailSourceRow = {
  id: string;
  title: string | null;
  source: string | null;
  type: string | null;
  source_system: string | null;
  source_item_id: string | null;
  source_web_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  project_id: number | null;
};

export type LifecycleJobRow = {
  source_document_id: string | null;
  source_item_id: string | null;
  source_system: string;
  status: string;
  updated_at: string;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

export type SourceFamilyConfig = {
  key: SourceFamilyKey;
  label: string;
  sourceSystems: string[];
  matches: (row: SourceRow) => boolean;
};

export const SOURCE_FAMILIES: SourceFamilyConfig[] = [
  {
    key: "meetings",
    label: "Meeting transcripts",
    sourceSystems: ["fireflies"],
    matches: (row) => row.source === "fireflies",
  },
  {
    key: "teams",
    label: "Teams messages",
    sourceSystems: ["microsoft_graph", "teams"],
    matches: (row) =>
      row.source === "microsoft_graph" &&
      (row.category === "teams_message" || String(row.type ?? "").includes("teams")),
  },
  {
    key: "emails",
    label: "Emails",
    sourceSystems: ["microsoft_graph", "outlook_email"],
    matches: (row) =>
      row.source === "microsoft_graph" &&
      (row.category === "email" ||
        row.type === "email" ||
        row.type === "email_attachment" ||
        row.id.startsWith("outlook_")),
  },
  {
    key: "sharepoint",
    label: "SharePoint files",
    sourceSystems: ["microsoft_graph", "sharepoint_file"],
    matches: (row) =>
      row.source === "microsoft_graph" &&
      (row.id.startsWith("sharepoint_") ||
        String(row.source_item_id ?? "").startsWith("sharepoint_") ||
        String(row.source_item_id ?? "").startsWith("sites/") ||
        String(row.source_item_id ?? "").includes("sharepoint") ||
        String(row.source_system ?? "").includes("sharepoint")),
  },
];

export function familyByKey(key: string): SourceFamilyConfig | null {
  return SOURCE_FAMILIES.find((family) => family.key === key) ?? null;
}

export function newest(values: Array<string | null | undefined>): string | null {
  const sorted = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return sorted[0] ?? null;
}

export function coverageStatus(count: number, total: number): LifecycleStatus {
  if (total === 0) return "unknown";
  if (count === total) return "healthy";
  if (count > 0) return "warning";
  return "critical";
}

/**
 * Per-stage grace window (minutes) a freshly-synced document is allowed to sit
 * before NOT having cleared that downstream stage counts against health. The
 * crons that feed each stage run behind sync, so the newest cohort is normally
 * "in flight", not stuck. Without this, `coverageStatus` paints every stage
 * amber/red permanently on a rolling window. Values mirror the backend health
 * thresholds (source_sync_health.py: STALE_SYNC_MINUTES=120,
 * STALE_EXTRACTION_MINUTES=1440, packet freshness=36h) so the map and the
 * backend agree on what "behind" vs "stuck" means. `synced` has no grace — it
 * is the sync itself.
 */
export const STAGE_GRACE_MINUTES: Record<LifecycleStageKey, number> = {
  synced: 0,
  vectorized: 120,
  projectAssigned: 120,
  tasksExtracted: 1440,
  projectIntelligenceUpdated: 2160,
};

/** Age of an ISO timestamp in minutes, or null when unparseable/absent. */
export function ageMinutes(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (nowMs - then) / 60000;
}

/**
 * Coverage status computed over only the *mature* cohort — documents older than
 * the stage's grace window. Documents still within the window are in flight
 * (the feeding cron simply has not run yet) and never drag a stage red. Returns
 * "healthy" when nothing is mature yet: an all-fresh cohort is flowing, not
 * broken. Real stalls — mature documents that never cleared — still surface.
 */
export function maturityCoverageStatus(
  clearedMature: number,
  totalMature: number,
): LifecycleStatus {
  if (totalMature === 0) return "healthy";
  return coverageStatus(clearedMature, totalMature);
}

/**
 * Error codes the ingestion pipeline uses for documents it *deliberately* did
 * not embed — not failures. The backend records these with
 * `status="failed_permanent"` (see fireflies_pipeline / embedder /
 * document_parser) but marks them `intentional: true` and clears the error
 * message. They must NOT be surfaced as critical pipeline failures, or the
 * health map paints red for documents that were correctly skipped.
 */
export const INTENTIONAL_SKIP_ERROR_CODES = new Set<string>([
  "interview_title_excluded",
  "skipped_low_content",
]);

/**
 * True when a source-processing job represents an intentional skip rather than
 * a real failure. Matches by known skip error codes and by the backend's
 * `INTENTIONALLY_EXCLUDED:` error-message marker (belt and suspenders — the
 * message prefix survives even if a new skip code is added upstream).
 */
export function isIntentionalSkipJob(job: {
  error_code?: string | null;
  error_message?: string | null;
  status?: string | null;
}): boolean {
  if (job.status === "intentionally_excluded") return true;
  if (job.error_code && INTENTIONAL_SKIP_ERROR_CODES.has(job.error_code)) return true;
  return Boolean(job.error_message?.startsWith("INTENTIONALLY_EXCLUDED:"));
}

/**
 * Remove terminal intentional exclusions from an actionable-failure collection.
 * This keeps UI recovery surfaces from treating a policy decision as an incident.
 */
export function excludeIntentionalSkipJobs<
  T extends { error_message?: string | null },
>(jobs: T[]): T[] {
  return jobs.filter(
    (job) => !isIntentionalSkipJob({ error_message: job.error_message }),
  );
}

export function isTransientSupabaseReadError(error: { message?: string } | null | undefined) {
  return String(error?.message ?? "").toLowerCase().includes("fetch failed");
}

export async function readSupabaseRows<T>(
  label: string,
  queryFactory: () => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
): Promise<T[]> {
  let lastMessage = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await queryFactory();
    if (!result.error) return result.data ?? [];
    lastMessage = result.error.message ?? "unknown error";
    if (!isTransientSupabaseReadError(result.error) || attempt === 3) {
      throw new Error(`Failed to load ${label}: ${lastMessage}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }
  throw new Error(`Failed to load ${label}: ${lastMessage}`);
}

const LIFECYCLE_BATCH_SIZE = 25;

export function batches<T>(values: T[], size = LIFECYCLE_BATCH_SIZE): T[][] {
  const grouped: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    grouped.push(values.slice(index, index + size));
  }
  return grouped;
}

export function latestJobMetadataByDocumentId(jobRows: LifecycleJobRow[]) {
  const metadataByDocumentId = new Map<string, Record<string, unknown>>();
  const sorted = [...jobRows].sort((a, b) => {
    const aReadProof = a.metadata?.read_proof;
    const bReadProof = b.metadata?.read_proof;
    const aHasFullReadProof =
      typeof aReadProof === "object" &&
      aReadProof !== null &&
      (aReadProof as Record<string, unknown>).status === "full_source_read" &&
      (aReadProof as Record<string, unknown>).scope === "full_transcript";
    const bHasFullReadProof =
      typeof bReadProof === "object" &&
      bReadProof !== null &&
      (bReadProof as Record<string, unknown>).status === "full_source_read" &&
      (bReadProof as Record<string, unknown>).scope === "full_transcript";
    if (aHasFullReadProof !== bHasFullReadProof) return aHasFullReadProof ? -1 : 1;
    const aHasTaskStatus = Boolean(a.metadata?.task_extraction_status);
    const bHasTaskStatus = Boolean(b.metadata?.task_extraction_status);
    if (aHasTaskStatus !== bHasTaskStatus) return aHasTaskStatus ? -1 : 1;
    return String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
  });
  for (const row of sorted) {
    const documentId = row.source_document_id ? String(row.source_document_id) : "";
    if (!documentId || metadataByDocumentId.has(documentId)) continue;
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    metadataByDocumentId.set(documentId, { ...metadata, _updated_at: row.updated_at });
  }
  return metadataByDocumentId;
}

export function hasTaskExtractionOutcome(
  documentId: string,
  taskIds: Set<string>,
  jobMetadataByDocumentId: Map<string, Record<string, unknown>>,
) {
  return getTaskExtractionOutcome(documentId, taskIds, jobMetadataByDocumentId) !== "not_extracted";
}

export type TaskExtractionOutcome =
  | "tasks_created"
  | "no_actionable_tasks"
  | "task_signal_staged"
  | "not_extracted";

export function getTaskExtractionOutcome(
  documentId: string,
  taskIds: Set<string>,
  jobMetadataByDocumentId: Map<string, Record<string, unknown>>,
): TaskExtractionOutcome {
  if (taskIds.has(documentId)) return "tasks_created";
  const status = String(
    jobMetadataByDocumentId.get(documentId)?.task_extraction_status ?? "",
  ).toLowerCase();
  if (status === "no_actionable_tasks") return "no_actionable_tasks";
  if (status === "task_signal_staged") return "task_signal_staged";
  return "not_extracted";
}

export function hasFullTranscriptReadProof(
  documentId: string,
  jobMetadataByDocumentId: Map<string, Record<string, unknown>>,
) {
  const readProof = jobMetadataByDocumentId.get(documentId)?.read_proof;
  if (!readProof || typeof readProof !== "object") return false;
  const proof = readProof as Record<string, unknown>;
  return proof.status === "full_source_read" && proof.scope === "full_transcript";
}

/**
 * Support data needed to evaluate the per-document lifecycle stages. Shared so
 * the aggregate matrix and the drill-down evaluate stages identically.
 */
export type LifecycleSupport = {
  embeddedIds: Set<string>;
  embeddedMeetingTranscriptIds: Set<string>;
  taskIds: Set<string>;
  evidenceIds: Set<string>;
  jobMetadataByDocumentId: Map<string, Record<string, unknown>>;
};

/**
 * Evaluate which lifecycle stages a single source document has cleared.
 *
 * `projectIntelligenceUpdated` here reflects per-document evidence only; the
 * matrix additionally gates the whole stage as critical when there is no fresh
 * Project Intelligence packet. That packet-level gate is a source-level concern
 * and is applied by the caller, not per document.
 */
export function computeDocumentStages(
  row: SourceRow,
  family: SourceFamilyConfig,
  support: LifecycleSupport,
): Record<LifecycleStageKey, boolean> {
  const vectorizedIds =
    family.key === "meetings" ? support.embeddedMeetingTranscriptIds : support.embeddedIds;
  const intelligence =
    support.evidenceIds.has(row.id) &&
    (family.key !== "meetings" ||
      hasFullTranscriptReadProof(row.id, support.jobMetadataByDocumentId));
  return {
    synced: true,
    vectorized: vectorizedIds.has(row.id),
    projectAssigned: row.project_id !== null,
    tasksExtracted: hasTaskExtractionOutcome(
      row.id,
      support.taskIds,
      support.jobMetadataByDocumentId,
    ),
    projectIntelligenceUpdated: intelligence,
  };
}
