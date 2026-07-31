import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { selectCarryoverItems } from "@/lib/meetings/domain";
import { assertMeetingInProject } from "@/lib/meetings/guards";
import { parseProjectId } from "@/lib/meetings/route-params";
import { loadMeetingDetail } from "@/lib/meetings/server";
import type { Database } from "@/types/database.types";

// Postgres unique_violation error code.
const POSTGRES_UNIQUE_VIOLATION = "23505";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD format");

const followUpSchema = z.object({
  meeting_date: dateString.optional(),
  carry_open_items: z.boolean(),
});

type MeetingRow = Database["public"]["Tables"]["meetings"]["Row"];
type MeetingCategoryRow = Database["public"]["Tables"]["meeting_categories"]["Row"];
type MeetingItemRow = Database["public"]["Tables"]["meeting_items"]["Row"];
type MeetingAttendeeRow = Database["public"]["Tables"]["meeting_attendees"]["Row"];

// POST: Create a follow-up meeting in the same series (number = max + 1),
// copying attendees and all categories. When carry_open_items is true, every
// open/in_progress item (via selectCarryoverItems) is copied into the
// corresponding new category with carried_from_item_id set to the old item's
// id, preserving the original origin_meeting_id (the very first meeting the
// item was created in) rather than resetting it to this follow-up.
export const POST = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]/follow-up#POST",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/follow-up#POST";
    const { projectId, meetingId } = await params;
    assertNonNilUuid(meetingId, "meetingId", where);

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    const createdByUserId = user.id;
    const numericProjectId = parseProjectId(projectId, where);
    const payload = await parseJsonBody(request, followUpSchema, where);
    const supabase = await createClient();

    await assertMeetingInProject(supabase, meetingId, numericProjectId, where);

    const { data: sourceMeetingRow, error: sourceMeetingError } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .eq("project_id", numericProjectId)
      .single();

    if (sourceMeetingError || !sourceMeetingRow) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load source meeting: ${sourceMeetingError?.message ?? "Unknown load failure"}`,
        details: sourceMeetingError,
      });
    }

    const sourceMeeting = sourceMeetingRow as MeetingRow;

    const [sourceCategoriesResult, sourceItemsResult, sourceAttendeesResult] = await Promise.all([
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
      supabase.from("meeting_attendees").select("*").eq("meeting_id", meetingId),
    ]);

    if (sourceCategoriesResult.error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load source categories: ${sourceCategoriesResult.error.message}`,
        details: sourceCategoriesResult.error,
      });
    }
    if (sourceItemsResult.error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load source items: ${sourceItemsResult.error.message}`,
        details: sourceItemsResult.error,
      });
    }
    if (sourceAttendeesResult.error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load source attendees: ${sourceAttendeesResult.error.message}`,
        details: sourceAttendeesResult.error,
      });
    }

    const sourceCategories = (sourceCategoriesResult.data ?? []) as MeetingCategoryRow[];
    const sourceItems = (sourceItemsResult.data ?? []) as MeetingItemRow[];
    const sourceAttendees = (sourceAttendeesResult.data ?? []) as MeetingAttendeeRow[];

    // number = max(number) + 1 within the series. A concurrent double-submit
    // can race on the unique(series_id, number) constraint — on that specific
    // conflict, re-read the max and retry the insert exactly once.
    async function computeNextNumber(): Promise<number> {
      const { data: maxNumberRows, error: maxNumberError } = await supabase
        .from("meetings")
        .select("number")
        .eq("series_id", sourceMeeting.series_id)
        .order("number", { ascending: false })
        .limit(1);

      if (maxNumberError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: `Failed to compute next meeting number: ${maxNumberError.message}`,
          details: maxNumberError,
        });
      }

      return ((maxNumberRows ?? [])[0]?.number ?? 0) + 1;
    }

    async function insertMeeting(number: number) {
      return supabase
        .from("meetings")
        .insert({
          project_id: numericProjectId,
          series_id: sourceMeeting.series_id,
          number,
          name: sourceMeeting.name,
          meeting_date: payload.meeting_date ?? null,
          timezone: sourceMeeting.timezone,
          location: sourceMeeting.location,
          is_private: sourceMeeting.is_private,
          is_draft: false,
          mode: "agenda",
          created_by: createdByUserId,
        })
        .select("*")
        .single();
    }

    let nextNumber = await computeNextNumber();
    let { data: newMeeting, error: newMeetingError } = await insertMeeting(nextNumber);

    if (newMeetingError?.code === POSTGRES_UNIQUE_VIOLATION) {
      nextNumber = await computeNextNumber();
      ({ data: newMeeting, error: newMeetingError } = await insertMeeting(nextNumber));

      if (newMeetingError?.code === POSTGRES_UNIQUE_VIOLATION) {
        throw new GuardrailError({
          code: "PRECONDITION_FAILED",
          where,
          message:
            "Meeting number conflict — another meeting was created in this series at the same time; please retry",
          details: newMeetingError,
        });
      }
    }

    if (newMeetingError || !newMeeting) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to create follow-up meeting: ${newMeetingError?.message ?? "Unknown insert failure"}`,
        details: newMeetingError,
      });
    }

    const newMeetingId = newMeeting.id as string;

    try {
      // Copy attendees.
      if (sourceAttendees.length > 0) {
        const { error: attendeesError } = await supabase.from("meeting_attendees").insert(
          sourceAttendees.map((attendee) => ({
            meeting_id: newMeetingId,
            person_id: attendee.person_id,
            is_required: attendee.is_required,
          })),
        );

        if (attendeesError) {
          throw new GuardrailError({
            code: "INTERNAL_ERROR",
            where,
            message: `Failed to copy meeting attendees: ${attendeesError.message}`,
            details: attendeesError,
          });
        }
      }

      // Copy all categories (same names/positions), tracking old->new id.
      const categoryIdMap = new Map<string, string>();
      for (const sourceCategory of sourceCategories) {
        const { data: newCategory, error: newCategoryError } = await supabase
          .from("meeting_categories")
          .insert({
            meeting_id: newMeetingId,
            name: sourceCategory.name,
            position: sourceCategory.position,
          })
          .select("id")
          .single();

        if (newCategoryError || !newCategory) {
          throw new GuardrailError({
            code: "INTERNAL_ERROR",
            where,
            message: `Failed to copy category: ${newCategoryError?.message ?? "Unknown insert failure"}`,
            details: newCategoryError,
          });
        }

        categoryIdMap.set(sourceCategory.id, newCategory.id as string);
      }

      // When carrying items forward, copy only open/in_progress items,
      // chaining carried_from_item_id and preserving the original
      // origin_meeting_id (the first meeting the item was ever created in).
      if (payload.carry_open_items) {
        const carryoverIds = new Set(
          selectCarryoverItems(sourceItems.map((item) => ({ id: item.id, status: item.status }))),
        );
        const carryoverItems = sourceItems.filter((item) => carryoverIds.has(item.id));

        if (carryoverItems.length > 0) {
          const rows = carryoverItems
            .map((item) => {
              const newCategoryId = categoryIdMap.get(item.category_id);
              if (!newCategoryId) return null;
              return {
                meeting_id: newMeetingId,
                category_id: newCategoryId,
                title: item.title,
                description: item.description,
                assignee_person_id: item.assignee_person_id,
                due_date: item.due_date,
                status: item.status,
                priority: item.priority,
                position: item.position,
                carried_from_item_id: item.id,
                origin_meeting_id: item.origin_meeting_id ?? item.meeting_id,
                official_minutes: null,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null);

          if (rows.length > 0) {
            const { error: copiedItemsError } = await supabase.from("meeting_items").insert(rows);

            if (copiedItemsError) {
              throw new GuardrailError({
                code: "INTERNAL_ERROR",
                where,
                message: `Failed to copy carried-over items: ${copiedItemsError.message}`,
                details: copiedItemsError,
              });
            }
          }
        }
      }
    } catch (postInsertError) {
      try {
        await supabase.from("meetings").delete().eq("id", newMeetingId);
      } catch (cleanupError) {
        // Best-effort only — the original error is what matters to the caller.
        console.error(
          `[${where}] Failed to clean up orphaned follow-up meeting ${newMeetingId} after partial create failure:`,
          cleanupError,
        );
      }
      throw postInsertError;
    }

    const detail = await loadMeetingDetail(supabase, numericProjectId, newMeetingId);

    if (!detail) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: "Follow-up meeting was created but could not be reloaded.",
      });
    }

    return NextResponse.json(detail, { status: 201 });
  },
);
