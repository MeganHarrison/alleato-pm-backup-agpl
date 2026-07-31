import { NextResponse } from "next/server";

import { validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";
import { createRagServiceClient, createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

import {
  LifecycleDocumentsResponseSchema,
  type LifecycleDocumentsResponse,
} from "../_contracts";
import { loadCohort } from "../_daily";
import {
  batches,
  computeDocumentStages,
  familyByKey,
  getTaskExtractionOutcome,
  latestJobMetadataByDocumentId,
  readSupabaseRows,
  STAGE_KEYS,
  type LifecycleJobRow,
  type LifecycleStageKey,
  type LifecycleSupport,
  type SourceRow,
} from "../_lifecycle";
import { requireAdmin } from "../_shared";

const LOOKBACK_HOURS = 24;
const MAX_WINDOW_DAYS = 180;
const MAX_DOCUMENTS = 500;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

type Window = { sinceISO: string; untilISO: string };

/**
 * Resolve the cohort window. Mirrors status/route.ts parseLifecycleWindow so the
 * drill-down scopes to the exact same source cohort as the matrix it expands.
 */
function parseWindow(request: Request): Window {
  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (start && end && DATE_ONLY.test(start) && DATE_ONLY.test(end)) {
    const [lo, hi] = start <= end ? [start, end] : [end, start];
    return {
      sinceISO: new Date(`${lo}T00:00:00.000Z`).toISOString(),
      untilISO: new Date(`${hi}T23:59:59.999Z`).toISOString(),
    };
  }

  const daysParam = url.searchParams.get("days");
  if (daysParam) {
    const days = Math.min(Math.max(parseInt(daysParam, 10) || 1, 1), MAX_WINDOW_DAYS);
    return {
      sinceISO: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      untilISO: new Date().toISOString(),
    };
  }

  return {
    sinceISO: new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString(),
    untilISO: new Date().toISOString(),
  };
}

const STAGE_KEY_SET = new Set<string>(STAGE_KEYS);

function parseStageKey(request: Request): LifecycleStageKey | null {
  const stage = new URL(request.url).searchParams.get("stage");
  return stage && STAGE_KEY_SET.has(stage) ? (stage as LifecycleStageKey) : null;
}

/**
 * Gather the stage-evaluation support data for a single family's documents.
 * Same tables and cutoffs as the matrix; scoped to this family's ids only.
 */
async function loadSupport(rows: SourceRow[], window: Window): Promise<LifecycleSupport> {
  const appClient = createServiceClient();
  const ragClient = createRagServiceClient();
  const ids = rows.map((row) => row.id);

  const chunkRows: Array<{ document_id: string; source_type: string | null }> = [];
  const taskRows: Array<{ metadata_id: string }> = [];
  const evidenceRows: Array<{ source_document_id: string | null }> = [];
  const jobRows: LifecycleJobRow[] = [];

  for (const batch of batches(ids)) {
    const [chunkResult, taskResult, evidenceResult, jobResult] =
      await Promise.all([
        readSupabaseRows<{ document_id: string; source_type: string | null }>("RAG chunks", () =>
          ragClient
            .from("document_chunks")
            .select("document_id,source_type")
            .in("document_id", batch)
            .not("embedding", "is", null)
            .limit(1000),
        ),
        readSupabaseRows<{ metadata_id: string }>("extracted tasks", () =>
          serviceDb.from("tasks")
            .select("metadata_id,created_at")
            .in("metadata_id", batch)
            .gte("created_at", window.sinceISO)
            .limit(1000),
        ),
        readSupabaseRows<{ source_document_id: string | null }>(
          "Project Intelligence evidence",
          () =>
            serviceDb.from("insight_card_evidence")
              .select("source_document_id,created_at")
              .in("source_document_id", batch)
              .gte("created_at", window.sinceISO)
              .limit(1000),
        ),
        readSupabaseRows<LifecycleJobRow>("source processing jobs", () =>
          ragClient
            .from("source_processing_jobs")
            .select(
              "source_document_id,source_item_id,source_system,status,updated_at,error_code,error_message,metadata",
            )
            .in("source_document_id", batch)
            .order("updated_at", { ascending: false })
            .limit(1000)
            .returns<LifecycleJobRow[]>(),
        ),
      ]);

    chunkRows.push(...chunkResult);
    taskRows.push(...taskResult);
    evidenceRows.push(...evidenceResult);
    jobRows.push(...jobResult);
  }

  return {
    embeddedIds: new Set(chunkRows.map((row) => row.document_id)),
    embeddedMeetingTranscriptIds: new Set(
      chunkRows
        .filter((row) => row.source_type === "meeting_transcript")
        .map((row) => row.document_id),
    ),
    taskIds: new Set(taskRows.map((row) => row.metadata_id)),
    evidenceIds: new Set(
      evidenceRows
        .map((row) => row.source_document_id)
        .filter((id): id is string => Boolean(id)),
    ),
    jobMetadataByDocumentId: latestJobMetadataByDocumentId(jobRows),
  };
}

async function loadProjectNames(projectIds: number[]): Promise<Map<number, string>> {
  if (projectIds.length === 0) return new Map();
  const appClient = createServiceClient();
  const rows = await readSupabaseRows<{ id: number; name: string | null }>("project names", () =>
    serviceDb.from("projects").select("id,name").in("id", projectIds),
  );
  return new Map(rows.map((row) => [row.id, row.name ?? `Project ${row.id}`]));
}

export const GET = withApiGuardrails(
  "api.admin.source-sync.lifecycle-documents.GET",
  async ({ request }) => {
    await requireAdmin("api.admin.source-sync.lifecycle-documents.GET");

    const sourceKey = new URL(request.url).searchParams.get("source") ?? "";
    const family = familyByKey(sourceKey);
    if (!family) {
      return NextResponse.json(
        { error: `Unknown source "${sourceKey}". Expected one of meetings, teams, emails, sharepoint.` },
        { status: 400 },
      );
    }

    const window = parseWindow(request);
    const stageKey = parseStageKey(request);

    const familyRows = (await loadCohort(window)).filter(family.matches);
    const support = await loadSupport(familyRows, window);

    const projectIds = Array.from(
      new Set(
        familyRows
          .map((row) => row.project_id)
          .filter((id): id is number => id !== null),
      ),
    );
    const projectNames = await loadProjectNames(projectIds);

    const documents = familyRows.map((row) => {
      const stages = computeDocumentStages(row, family, support);
      return {
        id: row.id,
        title: row.title,
        date: row.source_last_modified_at ?? row.date ?? row.created_at,
        projectId: row.project_id,
        projectName: row.project_id !== null ? projectNames.get(row.project_id) ?? null : null,
        taskOutcome: getTaskExtractionOutcome(
          row.id,
          support.taskIds,
          support.jobMetadataByDocumentId,
        ),
        stages,
        // Only meetings have a guaranteed in-app detail route keyed by document id.
        detailHref: family.key === "meetings" ? `/meetings/${row.id}` : null,
        // External source link (Outlook / SharePoint web URL) when captured.
        webUrl: row.source_web_url ?? null,
      };
    });

    // Surface the documents stuck at the clicked stage first — those are the
    // ones the operator opened the cell to investigate.
    documents.sort((a, b) => {
      if (stageKey) {
        const aStuck = a.stages[stageKey] ? 1 : 0;
        const bStuck = b.stages[stageKey] ? 1 : 0;
        if (aStuck !== bStuck) return aStuck - bStuck;
      }
      return String(b.date ?? "").localeCompare(String(a.date ?? ""));
    });

    const total = documents.length;
    const limited = documents.slice(0, MAX_DOCUMENTS);

    const payload: LifecycleDocumentsResponse = {
      source: family.key,
      sourceLabel: family.label,
      stageKey: stageKey ?? "synced",
      generatedAt: new Date().toISOString(),
      total,
      returned: limited.length,
      truncated: total > limited.length,
      documents: limited,
    };

    return NextResponse.json(
      validateResponseContract(
        LifecycleDocumentsResponseSchema,
        payload,
        "api.admin.source-sync.lifecycle-documents.GET",
      ),
    );
  },
);
