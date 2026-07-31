import { notFound } from "next/navigation";

import { getProjectInfo } from "@/lib/supabase/project-fetcher";
import { getIsLeadership } from "@/lib/auth/current-user";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database, Json } from "@/types/database.types";
import type { Database as RagDatabase } from "@/types/rag-database.types";

type DocumentMetadataRow = Database["public"]["Tables"]["document_metadata"]["Row"];
type MeetingRow = Database["public"]["Tables"]["meetings"]["Row"];
type MeetingSegmentRow = Database["public"]["Tables"]["meeting_segments"]["Row"];
type MeetingPrepRow = Database["public"]["Tables"]["meeting_preps"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type InsightCardEvidenceRow =
  Database["public"]["Tables"]["insight_card_evidence"]["Row"];
type InsightCardRow = Database["public"]["Tables"]["insight_cards"]["Row"];
type MeetingCategoryRow =
  Database["public"]["Tables"]["meeting_categories"]["Row"];
type MeetingItemRow = Database["public"]["Tables"]["meeting_items"]["Row"];
type MeetingAttendeeRow =
  Database["public"]["Tables"]["meeting_attendees"]["Row"];
type MeetingDocumentRow =
  Database["public"]["Tables"]["meeting_documents"]["Row"];
type MeetingItemDocumentRow =
  Database["public"]["Tables"]["meeting_item_documents"]["Row"];
type DocumentAttributionCandidateRow =
  Database["public"]["Tables"]["document_attribution_candidates"]["Row"];
type FirefliesIngestionJobRow =
  Database["public"]["Tables"]["fireflies_ingestion_jobs"]["Row"];
type RagChunkRow = RagDatabase["public"]["Tables"]["document_chunks"]["Row"];

export type MeetingLineageInventoryRow = {
  key: string;
  label: string;
  count: number;
  status: "present" | "empty" | "error";
  error: string | null;
};

export type MeetingLineageData = {
  projectId: string;
  projectName: string;
  routeMeetingId: string;
  routeKind: "structured_meeting" | "document_metadata";
  documentId: string | null;
  document: DocumentMetadataRow | null;
  structuredMeeting: MeetingRow | null;
  meetingSegments: MeetingSegmentRow[];
  meetingPreps: MeetingPrepRow[];
  tasks: TaskRow[];
  insightCardEvidence: InsightCardEvidenceRow[];
  insightCards: InsightCardRow[];
  meetingCategories: MeetingCategoryRow[];
  meetingItems: MeetingItemRow[];
  meetingAttendees: MeetingAttendeeRow[];
  meetingDocuments: MeetingDocumentRow[];
  meetingItemDocuments: MeetingItemDocumentRow[];
  documentAttributionCandidates: DocumentAttributionCandidateRow[];
  firefliesIngestionJobs: FirefliesIngestionJobRow[];
  documentChunks: RagChunkRow[];
  ragChunksError: string | null;
  inventory: MeetingLineageInventoryRow[];
  schemaNotes: string[];
};

type TableSnapshot = {
  count: number;
  error: string | null;
};

export function buildMeetingLineageInventory(
  snapshots: Record<string, TableSnapshot>,
): MeetingLineageInventoryRow[] {
  const ordered: Array<[string, string]> = [
    ["document_metadata", "document_metadata"],
    ["meetings", "meetings"],
    ["meeting_segments", "meeting_segments"],
    ["meeting_preps", "meeting_preps"],
    ["tasks", "tasks"],
    ["meeting_categories", "meeting_categories"],
    ["meeting_items", "meeting_items"],
    ["meeting_attendees", "meeting_attendees"],
    ["meeting_documents", "meeting_documents"],
    ["meeting_item_documents", "meeting_item_documents"],
    ["insight_card_evidence", "insight_card_evidence"],
    ["insight_cards", "insight_cards"],
    ["document_attribution_candidates", "document_attribution_candidates"],
    ["fireflies_ingestion_jobs", "fireflies_ingestion_jobs"],
    ["document_chunks", "document_chunks (RAG)"],
  ];

  return ordered.map(([key, label]) => {
    const snapshot = snapshots[key] ?? { count: 0, error: "Not queried" };
    return {
      key,
      label,
      count: snapshot.count,
      status: snapshot.error
        ? "error"
        : snapshot.count > 0
          ? "present"
          : "empty",
      error: snapshot.error,
    };
  });
}

function isStructuredMeetingId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function asRows<T>(data: T[] | null | undefined): T[] {
  return data ?? [];
}

function jsonArrayHasValues(value: Json): boolean {
  return Array.isArray(value) && value.length > 0;
}

function buildSchemaNotes(
  document: DocumentMetadataRow | null,
  segments: MeetingSegmentRow[],
): string[] {
  const notes = [
    "Legacy `risks`, `decisions`, and `opportunities` tables are not present in the current app database; those concepts now surface through `meeting_segments` JSON arrays and curated `insight_cards`.",
  ];

  if (document?.summary_embedding == null) {
    notes.push("`document_metadata.summary_embedding` is currently null for this meeting.");
  }

  if (segments.length === 0) {
    notes.push("No `meeting_segments` rows were written for this meeting.");
  } else if (
    segments.every(
      (segment) =>
        !jsonArrayHasValues(segment.tasks) &&
        !jsonArrayHasValues(segment.risks) &&
        !jsonArrayHasValues(segment.decisions),
    )
  ) {
    notes.push(
      "`meeting_segments` rows exist but their extracted `tasks` / `risks` / `decisions` arrays are empty.",
    );
  }

  return notes;
}

export async function loadMeetingLineage(
  projectId: string,
  routeMeetingId: string,
): Promise<MeetingLineageData> {
  const { project, numericProjectId } = await getProjectInfo(projectId);

  // Every read below uses service-role clients (RLS bypassed), so project
  // membership must be enforced here before touching any meeting data.
  const access = await verifyProjectAccess(numericProjectId);
  if (isAuthError(access)) {
    notFound();
  }

  const supabase = createServiceClient();

  let structuredMeeting: MeetingRow | null = null;
  let document: DocumentMetadataRow | null = null;
  let routeKind: "structured_meeting" | "document_metadata" = "document_metadata";

  if (isStructuredMeetingId(routeMeetingId)) {
    const { data } = await serviceDb.from("meetings")
      .select("*")
      .eq("id", routeMeetingId)
      .eq("project_id", numericProjectId)
      .is("deleted_at", null)
      .maybeSingle();
    structuredMeeting = data ?? null;
    if (structuredMeeting) {
      routeKind = "structured_meeting";
      if (structuredMeeting.transcript_document_id) {
        const { data: linkedDocument } = await serviceDb.from("document_metadata")
          .select("*")
          .eq("id", structuredMeeting.transcript_document_id)
          .eq("project_id", numericProjectId)
          .eq("type", "meeting")
          .is("deleted_at", null)
          .maybeSingle();
        document = linkedDocument ?? null;
      }
    }
  }

  if (!document) {
    const { data } = await serviceDb.from("document_metadata")
      .select("*")
      .eq("id", routeMeetingId)
      .eq("project_id", numericProjectId)
      .eq("type", "meeting")
      .is("deleted_at", null)
      .maybeSingle();
    document = data ?? null;
  }

  if (!structuredMeeting && document) {
    const { data } = await serviceDb.from("meetings")
      .select("*")
      .eq("project_id", numericProjectId)
      .eq("transcript_document_id", document.id)
      .is("deleted_at", null)
      .maybeSingle();
    structuredMeeting = data ?? null;
  }

  if (!document && !structuredMeeting) {
    notFound();
  }

  // Leadership-restricted meetings (Annual Reviews): this loader uses the
  // service-role client, so RLS does not protect it. Hide the page entirely
  // from non-leadership users.
  if (document?.access_level === "leadership" && !(await getIsLeadership())) {
    notFound();
  }

  const documentId = document?.id ?? structuredMeeting?.transcript_document_id ?? null;
  const structuredMeetingId = structuredMeeting?.id ?? null;

  const [
    meetingSegmentsResult,
    meetingPrepsResult,
    tasksResult,
    evidenceResult,
    meetingCategoriesResult,
    meetingItemsResult,
    meetingAttendeesResult,
    meetingDocumentsResult,
    meetingItemDocumentsResult,
    attributionCandidatesResult,
    firefliesJobsResult,
  ] = await Promise.all([
    documentId
      ? serviceDb.from("meeting_segments")
          .select("*")
          .eq("metadata_id", documentId)
          .order("segment_index", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    documentId
      ? serviceDb.from("meeting_preps")
          .select("*")
          .eq("meeting_id", documentId)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    documentId
      ? serviceDb.from("tasks")
          .select("*")
          .eq("metadata_id", documentId)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    documentId
      ? serviceDb.from("insight_card_evidence")
          .select("*")
          .eq("source_document_id", documentId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    structuredMeetingId
      ? serviceDb.from("meeting_categories")
          .select("*")
          .eq("meeting_id", structuredMeetingId)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    structuredMeetingId
      ? serviceDb.from("meeting_items")
          .select("*")
          .eq("meeting_id", structuredMeetingId)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    structuredMeetingId
      ? serviceDb.from("meeting_attendees")
          .select("*")
          .eq("meeting_id", structuredMeetingId)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    documentId
      ? serviceDb.from("meeting_documents")
          .select("*")
          .eq("document_metadata_id", documentId)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    documentId
      ? serviceDb.from("meeting_item_documents")
          .select("*")
          .eq("document_metadata_id", documentId)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    documentId
      ? serviceDb.from("document_attribution_candidates")
          .select("*")
          .eq("source_document_id", documentId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    documentId
      ? serviceDb.from("fireflies_ingestion_jobs")
          .select("*")
          .or(`metadata_id.eq.${documentId},fireflies_id.eq.${documentId}`)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const evidence = asRows<InsightCardEvidenceRow>(evidenceResult.data as InsightCardEvidenceRow[]);
  const insightCardIds = [...new Set(evidence.map((row) => row.insight_card_id).filter(Boolean))];
  const insightCardsResult = insightCardIds.length
    ? await serviceDb.from("insight_cards")
        .select("*")
        .in("id", insightCardIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  let documentChunks: RagChunkRow[] = [];
  let ragChunksError: string | null = null;
  if (documentId) {
    try {
      const rag = createRagServiceClient();
      const { data, error } = await rag
        .from("document_chunks")
        .select("*")
        .eq("document_id", documentId)
        .order("chunk_index", { ascending: true });
      documentChunks = asRows<RagChunkRow>(data as RagChunkRow[]);
      ragChunksError = error?.message ?? null;
    } catch (error) {
      ragChunksError = error instanceof Error ? error.message : String(error);
    }
  }

  const meetingSegments = asRows<MeetingSegmentRow>(meetingSegmentsResult.data as MeetingSegmentRow[]);
  const meetingPreps = asRows<MeetingPrepRow>(meetingPrepsResult.data as MeetingPrepRow[]);
  const tasks = asRows<TaskRow>(tasksResult.data as TaskRow[]);
  const meetingCategories = asRows<MeetingCategoryRow>(
    meetingCategoriesResult.data as MeetingCategoryRow[],
  );
  const meetingItems = asRows<MeetingItemRow>(
    meetingItemsResult.data as MeetingItemRow[],
  );
  const meetingAttendees = asRows<MeetingAttendeeRow>(
    meetingAttendeesResult.data as MeetingAttendeeRow[],
  );
  const meetingDocuments = asRows<MeetingDocumentRow>(
    meetingDocumentsResult.data as MeetingDocumentRow[],
  );
  const meetingItemDocuments = asRows<MeetingItemDocumentRow>(
    meetingItemDocumentsResult.data as MeetingItemDocumentRow[],
  );
  const documentAttributionCandidates = asRows<DocumentAttributionCandidateRow>(
    attributionCandidatesResult.data as DocumentAttributionCandidateRow[],
  );
  const firefliesIngestionJobs = asRows<FirefliesIngestionJobRow>(
    firefliesJobsResult.data as FirefliesIngestionJobRow[],
  );
  const insightCards = asRows<InsightCardRow>(
    insightCardsResult.data as InsightCardRow[],
  );

  const inventory = buildMeetingLineageInventory({
    document_metadata: {
      count: document ? 1 : 0,
      error: null,
    },
    meetings: {
      count: structuredMeeting ? 1 : 0,
      error: null,
    },
    meeting_segments: {
      count: meetingSegments.length,
      error: meetingSegmentsResult.error?.message ?? null,
    },
    meeting_preps: {
      count: meetingPreps.length,
      error: meetingPrepsResult.error?.message ?? null,
    },
    tasks: {
      count: tasks.length,
      error: tasksResult.error?.message ?? null,
    },
    meeting_categories: {
      count: meetingCategories.length,
      error: meetingCategoriesResult.error?.message ?? null,
    },
    meeting_items: {
      count: meetingItems.length,
      error: meetingItemsResult.error?.message ?? null,
    },
    meeting_attendees: {
      count: meetingAttendees.length,
      error: meetingAttendeesResult.error?.message ?? null,
    },
    meeting_documents: {
      count: meetingDocuments.length,
      error: meetingDocumentsResult.error?.message ?? null,
    },
    meeting_item_documents: {
      count: meetingItemDocuments.length,
      error: meetingItemDocumentsResult.error?.message ?? null,
    },
    insight_card_evidence: {
      count: evidence.length,
      error: evidenceResult.error?.message ?? null,
    },
    insight_cards: {
      count: insightCards.length,
      error: insightCardsResult.error?.message ?? null,
    },
    document_attribution_candidates: {
      count: documentAttributionCandidates.length,
      error: attributionCandidatesResult.error?.message ?? null,
    },
    fireflies_ingestion_jobs: {
      count: firefliesIngestionJobs.length,
      error: firefliesJobsResult.error?.message ?? null,
    },
    document_chunks: {
      count: documentChunks.length,
      error: ragChunksError,
    },
  });

  return {
    projectId,
    projectName: project.name ?? `Project ${project.id}`,
    routeMeetingId,
    routeKind,
    documentId,
    document,
    structuredMeeting,
    meetingSegments,
    meetingPreps,
    tasks,
    insightCardEvidence: evidence,
    insightCards,
    meetingCategories,
    meetingItems,
    meetingAttendees,
    meetingDocuments,
    meetingItemDocuments,
    documentAttributionCandidates,
    firefliesIngestionJobs,
    documentChunks,
    ragChunksError,
    inventory,
    schemaNotes: buildSchemaNotes(document, meetingSegments),
  };
}
