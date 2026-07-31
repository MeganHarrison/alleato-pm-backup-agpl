/**
 * Shared loaders for the day-scoped content-sync view (/source-sync) and the
 * per-source drill-down (lifecycle-documents). Both must agree on which rows
 * belong to a given day and which of them are embedded, so the summary counts
 * and the file lists can never disagree. That agreement lives here.
 */

import { createRagServiceClient, createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

import {
  batches,
  readSupabaseRows,
  type RagEmailSourceRow,
  type SourceRow,
} from "./_lifecycle";

export type CohortWindow = { sinceISO: string; untilISO: string };
export type DayWindow = CohortWindow & { date: string };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve a single UTC calendar day. Falls back to today when unparseable. */
export function resolveDayWindow(dateParam: string | null): DayWindow {
  const date =
    dateParam && DATE_ONLY.test(dateParam)
      ? dateParam
      : new Date().toISOString().slice(0, 10);
  return {
    date,
    sinceISO: new Date(`${date}T00:00:00.000Z`).toISOString(),
    untilISO: new Date(`${date}T23:59:59.999Z`).toISOString(),
  };
}

/**
 * Load every synced source row created in the window across all families.
 * Mirrors the RAG-only Outlook merge so emails ingested straight into the RAG
 * store (never promoted to the app's document_metadata) still count.
 */
export async function loadCohort(window: CohortWindow): Promise<SourceRow[]> {
  const appClient = createServiceClient();
  const ragClient = createRagServiceClient();

  const appRows = await readSupabaseRows<SourceRow>("daily source metadata", () =>
    serviceDb.from("document_metadata")
      .select(
        "id,title,source,category,type,project_id,source_system,source_item_id,fireflies_id,created_at,date,source_last_modified_at,source_web_url",
      )
      .is("deleted_at", null)
      .gte("created_at", window.sinceISO)
      .lte("created_at", window.untilISO)
      .in("source", ["fireflies", "microsoft_graph"])
      .order("created_at", { ascending: false })
      .limit(5000),
  );

  const appRowIds = new Set(appRows.map((row) => row.id));

  const ragEmailRows = await readSupabaseRows<RagEmailSourceRow>("RAG email metadata", () =>
    ragClient
      .from("rag_document_metadata")
      .select(
        "id,title,source,type,source_system,source_item_id,source_web_url,created_at,updated_at,project_id",
      )
      .eq("source", "microsoft_graph")
      .or("type.in.(email,email_attachment),id.like.outlook_%")
      .gte("updated_at", window.sinceISO)
      .lte("updated_at", window.untilISO)
      .order("updated_at", { ascending: false })
      .limit(5000),
  );

  const ragOnlyEmailRows = ragEmailRows
    .filter((row) => !appRowIds.has(row.id))
    .map<SourceRow>((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      category: row.type === "email_attachment" ? "email_attachment" : "email",
      type: row.type,
      project_id: row.project_id,
      source_system: row.source_system,
      source_item_id: row.source_item_id,
      fireflies_id: null,
      created_at: row.created_at,
      date: row.created_at,
      source_last_modified_at: row.updated_at,
      source_web_url: row.source_web_url,
    }));

  return [...appRows, ...ragOnlyEmailRows];
}

export type EmbeddedSets = {
  embeddedIds: Set<string>;
  embeddedMeetingTranscriptIds: Set<string>;
};

/**
 * Which of the given document ids have at least one embedded chunk. Meetings
 * are gated on the meeting_transcript chunk type so a stray non-transcript
 * chunk never marks a meeting embedded.
 */
export async function loadEmbeddedSets(ids: string[]): Promise<EmbeddedSets> {
  const ragClient = createRagServiceClient();
  const embeddedIds = new Set<string>();
  const embeddedMeetingTranscriptIds = new Set<string>();

  for (const batch of batches(ids)) {
    const rows = await readSupabaseRows<{ document_id: string; source_type: string | null }>(
      "RAG chunks",
      () =>
        ragClient
          .from("document_chunks")
          .select("document_id,source_type")
          .in("document_id", batch)
          .not("embedding", "is", null)
          .limit(2000),
    );
    for (const row of rows) {
      embeddedIds.add(row.document_id);
      if (row.source_type === "meeting_transcript") {
        embeddedMeetingTranscriptIds.add(row.document_id);
      }
    }
  }

  return { embeddedIds, embeddedMeetingTranscriptIds };
}
