import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { deriveMeetingStatus, numberAgenda } from "./domain";
import { dedupeSemanticItems } from "./text-dedupe";

type ServiceClient = SupabaseClient<Database>;

type MeetingRow = Database["public"]["Tables"]["meetings"]["Row"];
type MeetingAttendeeRow = Database["public"]["Tables"]["meeting_attendees"]["Row"];
type MeetingCategoryRow = Database["public"]["Tables"]["meeting_categories"]["Row"];
type MeetingItemRow = Database["public"]["Tables"]["meeting_items"]["Row"];

const MAX_PREVIOUS_MINUTES_HOPS = 20;

export type MeetingDetailAttendee = {
  id: string;
  person_id: string;
  is_required: boolean;
  attended: boolean | null;
  person: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    company_name: string | null;
  };
};

export type MeetingDetailItem = MeetingItemRow & {
  agenda_number: string;
  task_count: number;
};

export type MeetingDetailCategory = MeetingCategoryRow & {
  items: MeetingDetailItem[];
};

export type MeetingDetail = {
  meeting: MeetingRow & {
    status: ReturnType<typeof deriveMeetingStatus>;
    series_name: string;
  };
  attendees: MeetingDetailAttendee[];
  categories: MeetingDetailCategory[];
};

export type PreviousMinutesEntry = {
  meeting_id: string;
  meeting_number: number;
  meeting_date: string | null;
  official_minutes: string | null;
  status: string;
};

export type CuratedMeetingRisk = {
  id: string;
  text: string;
  whyItMatters: string | null;
  confidence: string | null;
  source: "curated";
};

const MEETING_RISK_CARD_TYPES = [
  "risk",
  "blocker",
  "financial_exposure",
  "schedule_risk",
] as const;

const ACTIVE_CARD_STATUS_VALUES = [
  "open",
  "blocked",
  "needs_review",
  "stale",
] as const;

const VALID_ATTRIBUTION_STATUS_VALUES = [
  "auto_assigned",
  "approved",
] as const;

/**
 * loadMeetingDetail
 * Loads a single meeting (scoped to a project, excluding soft-deleted rows)
 * along with its attendees (+ joined people), categories, and items —
 * composing the derived status (Task 2 `deriveMeetingStatus`), the agenda
 * numbering (Task 2 `numberAgenda`), and per-item task counts from `tasks`.
 *
 * Returns null when the meeting doesn't exist, belongs to a different
 * project, or is soft-deleted.
 */
export async function loadMeetingDetail(
  supabase: ServiceClient,
  projectId: number,
  meetingId: string,
): Promise<MeetingDetail | null> {
  const { data: meetingRow, error: meetingError } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();

  if (meetingError) {
    throw new Error(`Failed to load meeting: ${meetingError.message}`);
  }

  if (!meetingRow) return null;

  const meeting = meetingRow as MeetingRow;
  if (meeting.project_id !== projectId) return null;
  if (meeting.deleted_at) return null;

  const [attendeesResult, categoriesResult, itemsResult, seriesResult] = await Promise.all([
    supabase
      .from("meeting_attendees")
      .select("*, people(id, first_name, last_name, email, company)")
      .eq("meeting_id", meetingId),
    supabase
      .from("meeting_categories")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("position", { ascending: true }),
    supabase
      .from("meeting_items")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("position", { ascending: true }),
    supabase
      .from("meeting_series")
      .select("id, name")
      .eq("id", meeting.series_id)
      .maybeSingle(),
  ]);

  if (attendeesResult.error) {
    throw new Error(`Failed to load meeting attendees: ${attendeesResult.error.message}`);
  }
  if (categoriesResult.error) {
    throw new Error(`Failed to load meeting categories: ${categoriesResult.error.message}`);
  }
  if (itemsResult.error) {
    throw new Error(`Failed to load meeting items: ${itemsResult.error.message}`);
  }
  if (seriesResult.error) {
    throw new Error(`Failed to load meeting series: ${seriesResult.error.message}`);
  }

  const seriesName = (seriesResult.data as { name: string } | null)?.name ?? "";

  const attendeeRows = (attendeesResult.data ?? []) as Array<
    MeetingAttendeeRow & {
      people: {
        id: string;
        first_name: string;
        last_name: string;
        email: string | null;
        company: string | null;
      } | null;
    }
  >;
  const categoryRows = (categoriesResult.data ?? []) as MeetingCategoryRow[];
  const itemRows = (itemsResult.data ?? []) as MeetingItemRow[];

  const itemIds = itemRows.map((item) => item.id);
  let taskCountByItemId = new Map<string, number>();
  if (itemIds.length > 0) {
    const { data: taskRows, error: tasksError } = await supabase
      .from("tasks")
      .select("id, meeting_item_id")
      .in("meeting_item_id", itemIds);

    if (tasksError) {
      throw new Error(`Failed to load agenda item tasks: ${tasksError.message}`);
    }

    taskCountByItemId = new Map();
    for (const taskRow of (taskRows ?? []) as Array<{ meeting_item_id: string | null }>) {
      if (!taskRow.meeting_item_id) continue;
      taskCountByItemId.set(
        taskRow.meeting_item_id,
        (taskCountByItemId.get(taskRow.meeting_item_id) ?? 0) + 1,
      );
    }
  }

  const agendaNumbers = numberAgenda(
    categoryRows.map((category) => ({ id: category.id, position: category.position })),
    itemRows.map((item) => ({
      id: item.id,
      category_id: item.category_id,
      position: item.position,
    })),
  );

  const itemsByCategoryId = new Map<string, MeetingDetailItem[]>();
  for (const item of itemRows) {
    const detailItem: MeetingDetailItem = {
      ...item,
      agenda_number: agendaNumbers.get(item.id) ?? "",
      task_count: taskCountByItemId.get(item.id) ?? 0,
    };
    const current = itemsByCategoryId.get(item.category_id) ?? [];
    current.push(detailItem);
    itemsByCategoryId.set(item.category_id, current);
  }

  const categories: MeetingDetailCategory[] = categoryRows.map((category) => ({
    ...category,
    items: itemsByCategoryId.get(category.id) ?? [],
  }));

  const attendees: MeetingDetailAttendee[] = attendeeRows.map((attendee) => ({
    id: attendee.id,
    person_id: attendee.person_id,
    is_required: attendee.is_required,
    attended: attendee.attended,
    person: {
      id: attendee.people?.id ?? attendee.person_id,
      first_name: attendee.people?.first_name ?? "",
      last_name: attendee.people?.last_name ?? "",
      email: attendee.people?.email ?? null,
      company_name: attendee.people?.company ?? null,
    },
  }));

  return {
    meeting: {
      ...meeting,
      status: deriveMeetingStatus({ is_draft: meeting.is_draft, mode: meeting.mode as "agenda" | "minutes" }),
      series_name: seriesName,
    },
    attendees,
    categories,
  };
}

export async function loadCuratedMeetingRisks(
  supabase: ServiceClient,
  documentMetadataId: string,
): Promise<CuratedMeetingRisk[]> {
  const { data: evidenceRows, error: evidenceError } = await supabase
    .from("insight_card_evidence")
    .select("insight_card_id")
    .eq("source_document_id", documentMetadataId);

  if (evidenceError) {
    throw new Error(
      `Failed to load meeting risk evidence: ${evidenceError.message}`,
    );
  }

  const insightCardIds = [...new Set(
    (evidenceRows ?? [])
      .map((row) => row.insight_card_id)
      .filter((id): id is string => Boolean(id)),
  )];

  if (insightCardIds.length === 0) {
    return [];
  }

  const { data: cardRows, error: cardError } = await supabase
    .from("insight_cards")
    .select(
      "id,title,summary,why_it_matters,confidence,card_type,current_status,attribution_status,severity,last_seen_at,updated_at",
    )
    .in("id", insightCardIds)
    .in("card_type", [...MEETING_RISK_CARD_TYPES])
    .in("current_status", [...ACTIVE_CARD_STATUS_VALUES])
    .in("attribution_status", [...VALID_ATTRIBUTION_STATUS_VALUES]);

  if (cardError) {
    throw new Error(`Failed to load meeting risk cards: ${cardError.message}`);
  }

  const risks = (cardRows ?? [])
    .slice()
    .sort((a, b) => {
      const severityDelta = (b.severity ?? -1) - (a.severity ?? -1);
      if (severityDelta !== 0) return severityDelta;
      const aTime = Date.parse(a.last_seen_at ?? a.updated_at ?? "") || 0;
      const bTime = Date.parse(b.last_seen_at ?? b.updated_at ?? "") || 0;
      return bTime - aTime;
    })
    .map((card) => ({
      id: card.id,
      text: card.title || card.summary,
      whyItMatters: card.why_it_matters ?? null,
      confidence: card.confidence ?? null,
      source: "curated" as const,
    }))
    .filter((card) => card.text.trim().length > 0);

  return dedupeSemanticItems(
    dedupeSemanticItems(risks, (card) => card.text, 0.5),
    (card) => card.whyItMatters ?? card.text,
    0.5,
  );
}

export type ResolvedMeetingDocumentId =
  | { kind: "meetings_row"; documentMetadataId: string }
  | { kind: "meetings_row_no_transcript" }
  | { kind: "legacy_document_id"; documentMetadataId: string };

/**
 * resolveMeetingDocumentId
 * The `/prep` and `/digest` subroutes historically looked up their content
 * directly by a `document_metadata.id`. The new `meetings` table introduces a
 * separate UUID space, so a caller's `meetingId` path param can now mean
 * either id space:
 *
 *   - If `meetingId` matches a row in `meetings`, the legacy document-based
 *     logic needs that meeting's `transcript_document_id` instead (or a clear
 *     "no transcript yet" signal when it hasn't been linked).
 *   - If `meetingId` does not match a `meetings` row, it is passed straight
 *     through — the pre-existing `document_metadata.id` behavior.
 *
 * This function is the ONLY thing that should change at the prep/digest call
 * sites; the document-based logic downstream is untouched.
 */
export async function resolveMeetingDocumentId(
  supabase: ServiceClient,
  meetingId: string,
): Promise<ResolvedMeetingDocumentId> {
  const { data: meetingRow, error } = await supabase
    .from("meetings")
    .select("id, transcript_document_id")
    .eq("id", meetingId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve meeting document id: ${error.message}`);
  }

  if (!meetingRow) {
    return { kind: "legacy_document_id", documentMetadataId: meetingId };
  }

  const transcriptDocumentId = (meetingRow as { transcript_document_id: string | null })
    .transcript_document_id;

  if (!transcriptDocumentId) {
    return { kind: "meetings_row_no_transcript" };
  }

  return { kind: "meetings_row", documentMetadataId: transcriptDocumentId };
}

/**
 * loadPreviousMinutes
 * Walks the `carried_from_item_id` chain backward from `itemId`, collecting
 * the official minutes recorded on each ancestor item along with its parent
 * meeting's number/date/status. Stops when an item has no
 * `carried_from_item_id`, or after MAX_PREVIOUS_MINUTES_HOPS hops (guards
 * against a cyclical chain). Returns entries oldest-first.
 */
export async function loadPreviousMinutes(
  supabase: ServiceClient,
  itemId: string,
): Promise<PreviousMinutesEntry[]> {
  const entries: PreviousMinutesEntry[] = [];

  let currentItemId: string | null = itemId;
  let hops = 0;

  while (currentItemId && hops < MAX_PREVIOUS_MINUTES_HOPS) {
    const { data: itemRow, error: itemError } = await supabase
      .from("meeting_items")
      .select("id, carried_from_item_id, meeting_id, official_minutes")
      .eq("id", currentItemId)
      .maybeSingle();

    if (itemError) {
      throw new Error(`Failed to load agenda item: ${itemError.message}`);
    }
    if (!itemRow) break;

    const item = itemRow as {
      id: string;
      carried_from_item_id: string | null;
      meeting_id: string;
      official_minutes: string | null;
    };

    const parentId = item.carried_from_item_id;
    if (!parentId) break;

    const { data: parentItemRow, error: parentItemError } = await supabase
      .from("meeting_items")
      .select("id, carried_from_item_id, meeting_id, official_minutes")
      .eq("id", parentId)
      .maybeSingle();

    if (parentItemError) {
      throw new Error(`Failed to load carried-from agenda item: ${parentItemError.message}`);
    }
    if (!parentItemRow) break;

    const parentItem = parentItemRow as {
      id: string;
      carried_from_item_id: string | null;
      meeting_id: string;
      official_minutes: string | null;
    };

    const { data: parentMeetingRow, error: parentMeetingError } = await supabase
      .from("meetings")
      .select("id, number, meeting_date, is_draft, mode")
      .eq("id", parentItem.meeting_id)
      .maybeSingle();

    if (parentMeetingError) {
      throw new Error(`Failed to load carried-from meeting: ${parentMeetingError.message}`);
    }
    if (!parentMeetingRow) break;

    const parentMeeting = parentMeetingRow as {
      id: string;
      number: number;
      meeting_date: string | null;
      is_draft: boolean;
      mode: string;
    };

    entries.push({
      meeting_id: parentMeeting.id,
      meeting_number: parentMeeting.number,
      meeting_date: parentMeeting.meeting_date,
      official_minutes: parentItem.official_minutes,
      status: deriveMeetingStatus({
        is_draft: parentMeeting.is_draft,
        mode: parentMeeting.mode as "agenda" | "minutes",
      }),
    });

    currentItemId = parentItem.id;
    hops += 1;
  }

  return entries.reverse();
}
