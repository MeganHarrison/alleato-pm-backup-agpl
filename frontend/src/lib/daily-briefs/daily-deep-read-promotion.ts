import type { SupabaseClient } from "@supabase/supabase-js";

import { GuardrailError } from "@/lib/guardrails/errors";
import { createRagServiceClient, createServiceClient } from "@/lib/supabase/service";
import type { CanonicalDailyBriefPacket } from "@/lib/daily-briefs/canonical-packets";
import { loadCurrentDailyExecutiveBriefPacket } from "@/lib/daily-briefs/canonical-packets";
import type { Database, Json } from "@/types/database.types";
import type { Database as RagDatabase } from "@/types/rag-database.types";

export const DAILY_DEEP_READ_PROMOTION_COMPILER_VERSION =
  "daily_deep_read_promotion_v1";
export const DAILY_DEEP_READ_CONSUMER_COMPILER_VERSION =
  "daily_deep_read_consumers_v1";

const WHERE = "daily-deep-read-promotion";

type AppClient = SupabaseClient<Database>;
type RagClient = SupabaseClient<RagDatabase>;
type SourceSignalCandidate =
  RagDatabase["public"]["Tables"]["source_signal_candidates"]["Row"];
type IntelligenceTarget =
  Database["public"]["Tables"]["intelligence_targets"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type InsightCardInsert = Database["public"]["Tables"]["insight_cards"]["Insert"];
type JsonRecord = Record<string, Json>;

export type DailyDeepReadPromotionKind = "task" | "insight_card";

export type DailyDeepReadPromotionResult = {
  ok: true;
  kind: DailyDeepReadPromotionKind;
  candidateId: string;
  projectId: number;
  packetId: string;
  createdRecordId: string;
  targetId: string;
};

export type DailyDeepReadBatchPromotionFailure = {
  candidateId: string;
  code: string;
  message: string;
};

export type DailyDeepReadBatchPromotionResult = {
  ok: true;
  projectId: number;
  packetId: string;
  promoted: DailyDeepReadPromotionResult[];
  failed: DailyDeepReadBatchPromotionFailure[];
};

export type DailyDeepReadPromotionDrainResult = {
  ok: true;
  packetId: string;
  projectsChecked: number;
  promotedCount: number;
  failedCount: number;
  projects: DailyDeepReadBatchPromotionResult[];
};

type PromoteInput = {
  candidateId: string;
  projectId: number;
  reviewedBy?: string | null;
};

type PromoteDeps = {
  appClient?: AppClient;
  ragClient?: RagClient;
  currentPacket?: CanonicalDailyBriefPacket;
  refreshProjectIntelligence?: (projectId: number) => Promise<unknown>;
};

type PromoteBatchInput = {
  projectId: number;
  reviewedBy?: string | null;
  maxCandidates?: number;
};

type PromoteDrainInput = {
  reviewedBy?: string | null;
  maxProjects?: number;
  maxCandidatesPerProject?: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonRecord(value: Json | RagDatabase["public"]["Tables"]["source_signal_candidates"]["Row"]["extraction_json"]): JsonRecord {
  return isRecord(value) ? value : {};
}

function compactText(value: string | null | undefined, maxLength: number): string {
  const cleaned = (value ?? "").replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}

function cleanPromotedText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\[[^\]]*(?:outlook|teams?|fireflies|email|transcript|AAAA|MTA)[^\]]*\]/gi, "")
    .replace(/\b(?:outlook|teams?|fireflies|email|transcript)[A-Za-z0-9._:-]{16,}\b/gi, "")
    .replace(/\b[A-Za-z0-9_-]{48,}\b/g, "")
    .replace(/[\[\]]+/g, "")
    .replace(/\s+[,:;.-]*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function promotedTitle(candidate: SourceSignalCandidate): string {
  return (
    compactText(cleanPromotedText(candidate.title), 500) ||
    compactText(cleanPromotedText(candidate.summary), 500) ||
    "Daily Deep Read candidate"
  );
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
}

function mapAttributionStatus(confidence: string): string {
  return confidence === "high" ? "auto_assigned" : "needs_review";
}

function mapCardType(signalType: string): string {
  if (signalType === "decision") return "decision";
  if (signalType === "risk") return "risk";
  if (signalType === "initiative") return "initiative";
  if (signalType === "project_update") return "project_update";
  return signalType;
}

function buildLineageMetadata(params: {
  candidate: SourceSignalCandidate;
  packet: CanonicalDailyBriefPacket;
  targetId: string;
  reviewedBy?: string | null;
}): JsonRecord {
  const extraction = jsonRecord(params.candidate.extraction_json);
  return {
    ...extraction,
    source_policy:
      extraction.source_policy ??
      "Promoted from reviewed Daily Deep Read candidate; no direct RAG chunk synthesis.",
    daily_deep_read_candidate_id: params.candidate.id,
    daily_packet_id: params.packet.id,
    daily_packet_business_date: params.packet.businessDate,
    daily_packet_generated_at: params.packet.generatedAt,
    daily_packet_target_id: params.packet.targetId,
    promoted_target_id: params.targetId,
    promoted_by: params.reviewedBy ?? null,
    promotion_compiler_version: DAILY_DEEP_READ_PROMOTION_COMPILER_VERSION,
    promoted_at: new Date().toISOString(),
  };
}

function candidateSummary(candidate: SourceSignalCandidate): string {
  return (
    compactText(candidate.summary, 4000) ||
    compactText(candidate.why_it_matters, 4000) ||
    compactText(candidate.excerpt, 4000) ||
    compactText(candidate.title, 4000)
  );
}

async function loadProjectTarget(appClient: AppClient, projectId: number): Promise<IntelligenceTarget> {
  const { data: existing, error: existingError } = await appClient
    .from("intelligence_targets")
    .select("*")
    .eq("target_type", "client_project")
    .eq("project_id", projectId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: WHERE,
      message: "Failed to load project intelligence target.",
      details: existingError.message,
    });
  }
  if (existing) return existing as IntelligenceTarget;

  const { data: project, error: projectError } = await appClient
    .from("projects")
    .select("id,name,project_number")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE,
      message: "Project could not be found for Daily Deep Read promotion.",
      details: projectError?.message ?? { projectId },
    });
  }

  const name = project.name ?? `Project ${projectId}`;
  const baseSlug = slugify([project.project_number, name].filter(Boolean).join(" "));
  const payload: Database["public"]["Tables"]["intelligence_targets"]["Insert"] = {
    target_type: "client_project",
    name,
    slug: baseSlug,
    status: "active",
    project_id: projectId,
    metadata: {
      created_by: DAILY_DEEP_READ_PROMOTION_COMPILER_VERSION,
      source: "daily_deep_read_promotion",
    },
  };

  const { data: inserted, error: insertError } = await appClient
    .from("intelligence_targets")
    .insert(payload)
    .select("*")
    .single();

  if (!insertError && inserted) return inserted as IntelligenceTarget;

  const fallbackPayload = {
    ...payload,
    slug: `${baseSlug}-${projectId}`,
  };
  const { data: fallback, error: fallbackError } = await appClient
    .from("intelligence_targets")
    .insert(fallbackPayload)
    .select("*")
    .single();

  if (fallbackError || !fallback) {
    throw new GuardrailError({
      code: "DB_INSERT_FAILED",
      where: WHERE,
      message: "Failed to create project intelligence target.",
      details: fallbackError?.message ?? insertError?.message,
    });
  }

  return fallback as IntelligenceTarget;
}

async function ensurePacketDocument(
  appClient: AppClient,
  packet: CanonicalDailyBriefPacket,
  projectId: number,
): Promise<string> {
  const metadataId = packet.id;
  const { data: existing, error: existingError } = await appClient
    .from("document_metadata")
    .select("id")
    .eq("id", metadataId)
    .maybeSingle();

  if (existingError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: WHERE,
      message: "Failed to load Daily Deep Read packet source document.",
      details: existingError.message,
    });
  }
  if (existing?.id) return existing.id;

  const { data, error } = await appClient
    .from("document_metadata")
    .insert({
      id: metadataId,
      title: packet.title,
      summary: packet.executiveSummary,
      content: packet.briefMarkdown,
      raw_text: packet.briefMarkdown,
      category: "daily_deep_read",
      phase: "intelligence",
      project_id: projectId,
      source: "daily_deep_read",
      source_system: "daily_deep_read",
      status: "processed",
      date: packet.businessDate === "unknown" ? null : packet.businessDate,
      captured_at: packet.generatedAt,
      source_metadata: {
        packet_id: packet.id,
        packet_type: packet.packetType,
        target_id: packet.targetId,
        business_date: packet.businessDate,
        compiler_version: packet.compilerVersion,
        source_policy: "Canonical Daily Deep Read packet source for promoted tasks/cards.",
      },
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new GuardrailError({
      code: "DB_INSERT_FAILED",
      where: WHERE,
      message: "Failed to create Daily Deep Read packet source document.",
      details: error?.message,
    });
  }

  return data.id;
}

async function loadPromotableCandidate(params: {
  ragClient: RagClient;
  projectId: number;
  candidateId: string;
  packetId: string;
}): Promise<SourceSignalCandidate> {
  const { data, error } = await params.ragClient
    .from("source_signal_candidates")
    .select("*")
    .eq("id", params.candidateId)
    .eq("project_id", params.projectId)
    .eq("compiler_version", DAILY_DEEP_READ_CONSUMER_COMPILER_VERSION)
    .eq("status", "candidate")
    .eq("extraction_json->>daily_packet_id", params.packetId)
    .maybeSingle();

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Failed to load accepted Daily Deep Read candidate.",
      details: error.message,
    });
  }
  if (!data) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: WHERE,
      message:
        "Daily Deep Read candidate is not accepted for this project and current packet, or was already promoted.",
      details: {
        candidateId: params.candidateId,
        projectId: params.projectId,
        packetId: params.packetId,
      },
    });
  }
  if (data.promoted_insight_card_id) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: WHERE,
      message: "Daily Deep Read candidate has already been promoted.",
      details: { candidateId: data.id, promotedRecordId: data.promoted_insight_card_id },
    });
  }
  return data as SourceSignalCandidate;
}

async function loadAcceptedCandidateIds(params: {
  ragClient: RagClient;
  projectId: number;
  packetId: string;
  maxCandidates: number;
}): Promise<string[]> {
  const { data, error } = await params.ragClient
    .from("source_signal_candidates")
    .select("id")
    .eq("project_id", params.projectId)
    .eq("compiler_version", DAILY_DEEP_READ_CONSUMER_COMPILER_VERSION)
    .eq("status", "candidate")
    .eq("extraction_json->>daily_packet_id", params.packetId)
    .limit(params.maxCandidates);

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Failed to load accepted Daily Deep Read candidates for batch promotion.",
      details: error.message,
    });
  }

  return ((data ?? []) as Array<{ id: string }>).map((row) => row.id).filter(Boolean);
}

async function loadAcceptedCandidateProjectIds(params: {
  ragClient: RagClient;
  packetId: string;
  maxProjects: number;
}): Promise<number[]> {
  const { data, error } = await params.ragClient
    .from("source_signal_candidates")
    .select("project_id")
    .eq("compiler_version", DAILY_DEEP_READ_CONSUMER_COMPILER_VERSION)
    .eq("status", "candidate")
    .eq("extraction_json->>daily_packet_id", params.packetId)
    .limit(params.maxProjects * 25);

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Failed to load projects with accepted Daily Deep Read candidates.",
      details: error.message,
    });
  }

  const projectIds = new Set<number>();
  for (const row of (data ?? []) as Array<{ project_id: number | null }>) {
    if (typeof row.project_id !== "number" || !Number.isInteger(row.project_id)) continue;
    projectIds.add(row.project_id);
    if (projectIds.size >= params.maxProjects) break;
  }
  return Array.from(projectIds);
}

async function assertNoExistingPromotion(params: {
  appClient: AppClient;
  candidate: SourceSignalCandidate;
}) {
  const candidateId = params.candidate.id;
  const [taskResult, cardResult] = await Promise.all([
    params.appClient
      .from("tasks")
      .select("id")
      .eq("extraction_metadata->>daily_deep_read_candidate_id", candidateId)
      .limit(1)
      .maybeSingle(),
    params.appClient
      .from("insight_cards")
      .select("id")
      .eq("metadata->>daily_deep_read_candidate_id", candidateId)
      .limit(1)
      .maybeSingle(),
  ]);

  const existingId = taskResult.data?.id ?? cardResult.data?.id;
  if (taskResult.error || cardResult.error) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: WHERE,
      message: "Failed to check for existing Daily Deep Read promotion.",
      details: taskResult.error?.message ?? cardResult.error?.message,
    });
  }
  if (existingId) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: WHERE,
      message: "Daily Deep Read candidate already has a promoted app record.",
      details: { candidateId, existingId },
    });
  }
}

async function createTaskFromCandidate(params: {
  appClient: AppClient;
  candidate: SourceSignalCandidate;
  packet: CanonicalDailyBriefPacket;
  targetId: string;
  metadataId: string;
  reviewedBy?: string | null;
}): Promise<string> {
  const metadata = buildLineageMetadata(params);
  const payload: TaskInsert = {
    title: promotedTitle(params.candidate),
    description: candidateSummary(params.candidate),
    metadata_id: params.metadataId,
    project_id: params.candidate.project_id,
    project_ids: params.candidate.project_id ? [params.candidate.project_id] : [],
    priority: params.candidate.confidence === "high" ? "high" : "medium",
    status: "open",
    source_system: "daily_deep_read",
    extraction_source: "daily_deep_read_candidate",
    extraction_model: DAILY_DEEP_READ_PROMOTION_COMPILER_VERSION,
    extraction_prompt_version: DAILY_DEEP_READ_PROMOTION_COMPILER_VERSION,
    extraction_metadata: metadata,
    source_chunk_id: params.candidate.source_chunk_id,
    assignee_person_id: params.candidate.suggested_owner_person_id,
    assignee_name: params.candidate.suggested_owner_label,
  };

  const { data, error } = await params.appClient
    .from("tasks")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new GuardrailError({
      code: "DB_INSERT_FAILED",
      where: WHERE,
      message: "Failed to create task from Daily Deep Read candidate.",
      details: error?.message,
    });
  }
  return data.id;
}

async function createInsightCardFromCandidate(params: {
  appClient: AppClient;
  candidate: SourceSignalCandidate;
  packet: CanonicalDailyBriefPacket;
  targetId: string;
  reviewedBy?: string | null;
}): Promise<string> {
  const metadata = buildLineageMetadata(params);
  const payload: InsightCardInsert = {
    primary_target_id: params.targetId,
    card_type: mapCardType(params.candidate.signal_type),
    title: promotedTitle(params.candidate),
    summary: candidateSummary(params.candidate),
    why_it_matters: params.candidate.why_it_matters,
    current_status: params.candidate.current_status === "rejected" ? "needs_review" : "open",
    confidence: params.candidate.confidence,
    attribution_status: mapAttributionStatus(params.candidate.confidence),
    suggested_owner_person_id: params.candidate.suggested_owner_person_id,
    suggested_owner_label: params.candidate.suggested_owner_label,
    next_action: params.candidate.next_action,
    first_seen_at: params.candidate.source_occurred_at ?? new Date().toISOString(),
    last_seen_at: params.candidate.source_occurred_at ?? new Date().toISOString(),
    occurred_at: params.candidate.source_occurred_at ?? new Date().toISOString(),
    source_count: 1,
    stale_after: params.candidate.stale_after,
    compiler_version: DAILY_DEEP_READ_PROMOTION_COMPILER_VERSION,
    metadata,
  };

  const { data, error } = await params.appClient
    .from("insight_cards")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new GuardrailError({
      code: "DB_INSERT_FAILED",
      where: WHERE,
      message: "Failed to create insight card from Daily Deep Read candidate.",
      details: error?.message,
    });
  }
  return data.id;
}

async function markCandidatePromoted(params: {
  ragClient: RagClient;
  candidate: SourceSignalCandidate;
  packet: CanonicalDailyBriefPacket;
  createdRecordId: string;
  kind: DailyDeepReadPromotionKind;
  reviewedBy?: string | null;
}) {
  const extractionJson = jsonRecord(params.candidate.extraction_json);
  const { error } = await params.ragClient
    .from("source_signal_candidates")
    .update({
      status: "promoted",
      current_status: "resolved",
      promoted_insight_card_id: params.createdRecordId,
      extraction_json: {
        ...extractionJson,
        promotion: {
          kind: params.kind,
          promoted_record_id: params.createdRecordId,
          promoted_at: new Date().toISOString(),
          promoted_by: params.reviewedBy ?? null,
          daily_packet_id: params.packet.id,
          compiler_version: DAILY_DEEP_READ_PROMOTION_COMPILER_VERSION,
        },
      },
    })
    .eq("id", params.candidate.id)
    .eq("status", "candidate");

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Created app record but failed to mark Daily Deep Read candidate promoted.",
      details: error.message,
    });
  }
}

function backendUrl(): string {
  const rawUrl = (process.env.BACKEND_URL || process.env.PYTHON_BACKEND_URL || "").trim();
  try {
    return new URL(rawUrl).toString().replace(/\/$/, "");
  } catch {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: WHERE,
      message:
        "Missing or invalid backend URL. Set BACKEND_URL or PYTHON_BACKEND_URL before promoting Daily Deep Read candidates.",
      status: 503,
    });
  }
}

function backendAdminApiKey(): string {
  const apiKey = process.env.ADMIN_API_KEY?.trim();
  if (!apiKey) {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: WHERE,
      message:
        "ADMIN_API_KEY is required to refresh project intelligence after Daily Deep Read promotion.",
      status: 503,
    });
  }
  return apiKey;
}

async function refreshProjectIntelligence(projectId: number): Promise<unknown> {
  const response = await fetch(
    `${backendUrl()}/api/intelligence/project-intelligence/refresh`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-api-key": backendAdminApiKey(),
      },
      body: JSON.stringify({ project_id: projectId }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Backend project intelligence refresh failed after Daily Deep Read promotion.",
      status: 502,
      details: {
        status: response.status,
        response: detail.slice(0, 2000),
      },
    });
  }

  return response.json().catch(() => ({}));
}

export async function promoteDailyDeepReadCandidate(
  input: PromoteInput,
  deps: PromoteDeps = {},
): Promise<DailyDeepReadPromotionResult> {
  const appClient = deps.appClient ?? createServiceClient();
  const ragClient = deps.ragClient ?? createRagServiceClient();
  const packet = deps.currentPacket ?? await loadCurrentDailyExecutiveBriefPacket();
  const candidate = await loadPromotableCandidate({
    ragClient,
    projectId: input.projectId,
    candidateId: input.candidateId,
    packetId: packet.id,
  });

  await assertNoExistingPromotion({ appClient, candidate });
  const target = await loadProjectTarget(appClient, input.projectId);
  const metadataId = await ensurePacketDocument(appClient, packet, input.projectId);
  const kind: DailyDeepReadPromotionKind =
    candidate.signal_type === "task" ? "task" : "insight_card";
  const createdRecordId =
    kind === "task"
      ? await createTaskFromCandidate({
          appClient,
          candidate,
          packet,
          targetId: target.id,
          metadataId,
          reviewedBy: input.reviewedBy,
        })
      : await createInsightCardFromCandidate({
          appClient,
          candidate,
          packet,
          targetId: target.id,
          reviewedBy: input.reviewedBy,
      });

  await markCandidatePromoted({
    ragClient,
    candidate,
    packet,
    createdRecordId,
    kind,
    reviewedBy: input.reviewedBy,
  });
  await (deps.refreshProjectIntelligence ?? refreshProjectIntelligence)(input.projectId);

  return {
    ok: true,
    kind,
    candidateId: candidate.id,
    projectId: input.projectId,
    packetId: packet.id,
    createdRecordId,
    targetId: target.id,
  };
}

function promotionFailure(candidateId: string, error: unknown): DailyDeepReadBatchPromotionFailure {
  if (error instanceof GuardrailError) {
    return {
      candidateId,
      code: error.code,
      message: error.message,
    };
  }
  if (error instanceof Error) {
    return {
      candidateId,
      code: "UNKNOWN_ERROR",
      message: error.message,
    };
  }
  return {
    candidateId,
    code: "UNKNOWN_ERROR",
    message: String(error),
  };
}

export async function promoteAcceptedDailyDeepReadCandidates(
  input: PromoteBatchInput,
  deps: PromoteDeps = {},
): Promise<DailyDeepReadBatchPromotionResult> {
  const appClient = deps.appClient ?? createServiceClient();
  const ragClient = deps.ragClient ?? createRagServiceClient();
  const packet = deps.currentPacket ?? await loadCurrentDailyExecutiveBriefPacket();
  const maxCandidates = Math.max(1, Math.min(input.maxCandidates ?? 25, 100));
  const candidateIds = await loadAcceptedCandidateIds({
    ragClient,
    projectId: input.projectId,
    packetId: packet.id,
    maxCandidates,
  });
  const promoted: DailyDeepReadPromotionResult[] = [];
  const failed: DailyDeepReadBatchPromotionFailure[] = [];

  for (const candidateId of candidateIds) {
    try {
      promoted.push(
        await promoteDailyDeepReadCandidate(
          {
            candidateId,
            projectId: input.projectId,
            reviewedBy: input.reviewedBy,
          },
          {
            appClient,
            ragClient,
            currentPacket: packet,
            refreshProjectIntelligence: deps.refreshProjectIntelligence,
          },
        ),
      );
    } catch (error) {
      failed.push(promotionFailure(candidateId, error));
    }
  }

  return {
    ok: true,
    projectId: input.projectId,
    packetId: packet.id,
    promoted,
    failed,
  };
}

export async function drainAcceptedDailyDeepReadPromotions(
  input: PromoteDrainInput = {},
  deps: PromoteDeps = {},
): Promise<DailyDeepReadPromotionDrainResult> {
  const appClient = deps.appClient ?? createServiceClient();
  const ragClient = deps.ragClient ?? createRagServiceClient();
  const packet = deps.currentPacket ?? await loadCurrentDailyExecutiveBriefPacket();
  const maxProjects = Math.max(1, Math.min(input.maxProjects ?? 50, 200));
  const maxCandidatesPerProject = Math.max(
    1,
    Math.min(input.maxCandidatesPerProject ?? 25, 100),
  );
  const projectIds = await loadAcceptedCandidateProjectIds({
    ragClient,
    packetId: packet.id,
    maxProjects,
  });
  const projects: DailyDeepReadBatchPromotionResult[] = [];

  for (const projectId of projectIds) {
    projects.push(
      await promoteAcceptedDailyDeepReadCandidates(
        {
          projectId,
          reviewedBy: input.reviewedBy,
          maxCandidates: maxCandidatesPerProject,
        },
        {
          appClient,
          ragClient,
          currentPacket: packet,
          refreshProjectIntelligence: deps.refreshProjectIntelligence,
        },
      ),
    );
  }

  return {
    ok: true,
    packetId: packet.id,
    projectsChecked: projects.length,
    promotedCount: projects.reduce((sum, project) => sum + project.promoted.length, 0),
    failedCount: projects.reduce((sum, project) => sum + project.failed.length, 0),
    projects,
  };
}
