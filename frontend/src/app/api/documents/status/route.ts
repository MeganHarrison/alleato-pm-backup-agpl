import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { excludeIntentionalSkipJobs } from "@/app/api/admin/source-sync/_lifecycle";

// Types excluded from the default view — they live in Communications, not Documents.
// The user can still filter to see them explicitly via ?type=teams_dm etc.
// Communication/transcript types hidden from the default document list unless a
// `type` filter explicitly selects them. Exported so the smart-group counts
// endpoint can apply the SAME exclusion and keep rail counts == grid rows.
export const DEFAULT_EXCLUDED_TYPES = [
  "teams_dm",
  "teams_dm_conversation",
  "teams_message",
  "email",
  "meeting",
  "Interview",
  // Internal document_metadata stub created solely to satisfy the
  // tasks.metadata_id FK for meeting-agenda-item tasks — never a real
  // document, so it must never surface in the Files/Documents UI.
  "meeting_agenda_task",
];

const MAX_PER_PAGE = 500;
const DEFAULT_PER_PAGE = 25;

const PROCESSING_PIPELINE_STAGES = [
  "segmented",
  "chunked",
  "embedded",
  "structured_extracted",
] as const;

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  created_at: "created_at",
  captured_at: "captured_at",
  date: "date",
  title: "title",
  type: "type",
  category: "category",
  document_type: "document_type",
  source: "source",
};

function normalizePipelineStage(
  stage: string | null | undefined,
  errorMessage: string | null | undefined,
): string {
  if (errorMessage || stage === "error") {
    return "failed";
  }

  if (stage && PROCESSING_PIPELINE_STAGES.includes(stage as (typeof PROCESSING_PIPELINE_STAGES)[number])) {
    return "processing";
  }

  return stage ?? "unknown";
}

function describeLifecycleStage(
  normalizedStage: string,
  taskCount: number,
  projectAssigned: boolean,
): string {
  if (normalizedStage === "failed") {
    return "Failed";
  }

  if (normalizedStage === "processing") {
    return "Processing";
  }

  if (taskCount > 0) {
    return "Tasks extracted";
  }

  if (projectAssigned && normalizedStage === "done") {
    return "Project assigned";
  }

  if (normalizedStage === "done") {
    return "Vectorized";
  }

  if (normalizedStage === "raw_ingested") {
    return "Synced";
  }

  return "Unknown";
}

export const GET = withApiGuardrails(
  "documents/status#GET",
  async ({ request }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "documents/status#GET",
        message: "Authentication required.",
      });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") || undefined;
    const typeFilter = searchParams.get("type") || undefined;
    const documentType = searchParams.get("document_type") || undefined;
    const category = searchParams.get("category") || undefined;
    const projectIdParam = searchParams.get("project_id") || undefined;
    const search = searchParams.get("search") || undefined;
    const dateFrom = searchParams.get("date_from") || undefined;
    const dateTo = searchParams.get("date_to") || undefined;
    const pipelineStage = searchParams.get("pipeline_stage") || undefined;
    const requestedSort = searchParams.get("sort") || "created_at";
    const sortColumn = ALLOWED_SORT_COLUMNS[requestedSort] ?? "created_at";
    const sortDirection =
      searchParams.get("sort_dir") === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(
      MAX_PER_PAGE,
      Math.max(10, parseInt(searchParams.get("per_page") || String(DEFAULT_PER_PAGE), 10)),
    );
    const offset = (page - 1) * perPage;

    let query = supabase
      .from("document_metadata")
      .select(
        `
        id,
        fireflies_id,
        title,
        status,
        type,
        category,
        document_type,
        source,
        source_system,
        source_web_url,
        date,
        created_at,
        captured_at,
        file_path,
        storage_bucket,
        url,
        summary,
        overview,
        participants,
        participants_array,
        project_id,
        projects!document_metadata_project_id_fkey ( name ),
        fireflies_ingestion_jobs!fireflies_ingestion_jobs_metadata_id_fkey (
          stage,
          attempt_count,
          last_attempt_at,
          error_message
        )
      `,
        { count: "exact" },
      )
      // Align with group-counts/route.ts — exclude soft-deleted records so the
      // grid count matches the sidebar badge counts.
      .is("deleted_at", null)
      .order(sortColumn, {
        ascending: sortDirection === "asc",
        nullsFirst: false,
      })
      .range(offset, offset + perPage - 1);

    // Source filter
    if (source) {
      query = query.eq("source", source);
    }

    // Type filter — if set, use exact match (allows viewing comms types explicitly).
    // If not set, exclude the default high-volume comms types.
    if (typeFilter) {
      query = query.eq("type", typeFilter);
    } else {
      for (const t of DEFAULT_EXCLUDED_TYPES) {
        query = query.neq("type", t);
      }
    }

    // Document type filter (folder-derived construction document type)
    if (documentType) {
      query = query.eq("document_type", documentType);
    }

    // Category filter
    if (category) {
      query = query.eq("category", category);
    }

    if (projectIdParam) {
      const projectId = Number.parseInt(projectIdParam, 10);
      if (Number.isFinite(projectId)) {
        query = query.eq("project_id", projectId);
      }
    }

    // Full-text search on title
    if (search) {
      const escapedSearch = search.replace(/[%_,]/g, (char) => `\\${char}`);
      query = query.or(
        [
          `title.ilike.%${escapedSearch}%`,
          `summary.ilike.%${escapedSearch}%`,
          `overview.ilike.%${escapedSearch}%`,
          `participants.ilike.%${escapedSearch}%`,
        ].join(","),
      );
    }

    // Date range on created_at
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      // Include the full end day
      query = query.lte("created_at", dateTo + "T23:59:59.999Z");
    }

    if (pipelineStage === "done" || pipelineStage === "pending" || pipelineStage === "raw_ingested") {
      query = query.eq("fireflies_ingestion_jobs.stage", pipelineStage);
    } else if (pipelineStage === "processing") {
      query = query.in("fireflies_ingestion_jobs.stage", [
        ...PROCESSING_PIPELINE_STAGES,
      ]);
    } else if (pipelineStage === "failed") {
      query = query.eq("fireflies_ingestion_jobs.stage", "error");
    } else if (pipelineStage === "unknown") {
      query = query.is("fireflies_ingestion_jobs.stage", null);
    }

    const { data: documents, error, count } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    const documentIds = (documents ?? []).map((doc) => doc.id).filter(Boolean);
    const taskCountByDocumentId = new Map<string, number>();

    if (documentIds.length > 0) {
      const { data: taskRows, error: taskError } = await supabase
        .from("tasks")
        .select("metadata_id")
        .in("metadata_id", documentIds);

      if (taskError) {
        return apiErrorResponse(taskError);
      }

      for (const row of taskRows ?? []) {
        const metadataId = String(row.metadata_id ?? "").trim();
        if (!metadataId) continue;
        taskCountByDocumentId.set(
          metadataId,
          (taskCountByDocumentId.get(metadataId) ?? 0) + 1,
        );
      }
    }

    const transformedDocuments =
      documents?.map((doc) => {
        const jobs = Array.isArray(doc.fireflies_ingestion_jobs)
          ? doc.fireflies_ingestion_jobs
          : doc.fireflies_ingestion_jobs
            ? [doc.fireflies_ingestion_jobs]
            : [];

        const job = jobs[0];
        const stage = normalizePipelineStage(job?.stage, job?.error_message);
        const taskCount = taskCountByDocumentId.get(doc.id) ?? 0;
        const projectAssigned = Boolean(doc.project_id);

        return {
          id: doc.id,
          fireflies_id: doc.fireflies_id,
          title: doc.title,
          status: doc.status,
          type: doc.type,
          category: doc.category,
          document_type: doc.document_type,
          source: doc.source,
          source_system: doc.source_system,
          source_web_url: doc.source_web_url,
          date: doc.date,
          created_at: doc.created_at,
          captured_at: doc.captured_at,
          file_path: doc.file_path,
          storage_bucket: doc.storage_bucket,
          url: doc.url,
          project_id: doc.project_id,
          project_name: Array.isArray(doc.projects)
            ? (doc.projects[0]?.name ?? null)
            : ((doc.projects as { name?: string | null } | null)?.name ?? null),
          summary: doc.summary,
          overview: doc.overview,
          participants: doc.participants,
          participants_array: doc.participants_array,
          pipeline_stage: stage,
          raw_pipeline_stage: job?.stage ?? null,
          lifecycle_label: describeLifecycleStage(
            stage,
            taskCount,
            projectAssigned,
          ),
          project_assigned: projectAssigned,
          task_count: taskCount,
          attempt_count: job?.attempt_count || 0,
          last_attempt_at: job?.last_attempt_at,
          error_message: job?.error_message,
        };
      }) || [];

    // Intentional exclusions are terminal lifecycle outcomes, not actionable
    // failures. Keep the shared source-sync predicate at this API boundary so
    // every consumer of this lifecycle feed gets the same classification.
    const filtered = excludeIntentionalSkipJobs(transformedDocuments);

    return NextResponse.json({
      documents: filtered,
      total: filtered.length,
      page,
      per_page: perPage,
      total_pages: Math.ceil(filtered.length / perPage),
    });
  },
);
