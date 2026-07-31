import { NextResponse } from "next/server";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { loadMeetingDetail } from "@/lib/meetings/server";
import { parseProjectId } from "@/lib/meetings/route-params";
import { updateMeetingSchema } from "@/lib/meetings/schemas";
import type { Database } from "@/types/database.types";

type MeetingUpdate = Database["public"]["Tables"]["meetings"]["Update"];

// GET: Fetch a single meeting's full detail (meeting + attendees + categories/items).
export const GET = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]#GET",
  async ({ params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]#GET";
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

    const numericProjectId = parseProjectId(projectId, where);
    const supabase = await createClient();

    const detail = await loadMeetingDetail(supabase, numericProjectId, meetingId);

    if (!detail) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Meeting not found.",
      });
    }

    return NextResponse.json(detail);
  },
);

// PATCH: Update only the supplied fields on a meeting. When attendee_person_ids
// is supplied, the attendee set is replaced (delete-all-then-insert). Always
// returns the fresh MeetingDetail.
export const PATCH = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]#PATCH",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]#PATCH";
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

    const numericProjectId = parseProjectId(projectId, where);
    const payload = await parseJsonBody(request, updateMeetingSchema, where);

    if (Object.keys(payload).length === 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: "At least one field must be provided.",
      });
    }

    const supabase = await createClient();

    const { data: existingMeeting } = await supabase
      .from("meetings")
      .select("id, project_id, deleted_at")
      .eq("id", meetingId)
      .eq("project_id", numericProjectId)
      .maybeSingle();

    if (!existingMeeting || existingMeeting.deleted_at) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Meeting not found in this project",
      });
    }

    const { attendee_person_ids: attendeePersonIds, series_name: _seriesName, ...rest } = payload;

    const updateData: MeetingUpdate = { ...rest, updated_at: new Date().toISOString() };

    const { error: updateError } = await supabase
      .from("meetings")
      .update(updateData)
      .eq("id", meetingId)
      .eq("project_id", numericProjectId);

    if (updateError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to update meeting: ${updateError.message}`,
        details: updateError,
      });
    }

    // Replace attendees when the caller supplied a new set. Delete-then-insert
    // is not wrapped in a DB transaction (no RPC here), so a failure after the
    // delete leaves the meeting with zero attendees — surface a clear error
    // rather than attempting a best-effort restore (per task brief).
    if (attendeePersonIds !== undefined) {
      const { error: deleteError } = await supabase
        .from("meeting_attendees")
        .delete()
        .eq("meeting_id", meetingId);

      if (deleteError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: `Failed to clear existing meeting attendees: ${deleteError.message}`,
          details: deleteError,
        });
      }

      if (attendeePersonIds.length > 0) {
        const { error: insertError } = await supabase.from("meeting_attendees").insert(
          attendeePersonIds.map((personId) => ({
            meeting_id: meetingId,
            person_id: personId,
          })),
        );

        if (insertError) {
          throw new GuardrailError({
            code: "INTERNAL_ERROR",
            where,
            message: `Failed to add meeting attendees: ${insertError.message}`,
            details: insertError,
          });
        }
      }
    }

    const detail = await loadMeetingDetail(supabase, numericProjectId, meetingId);

    if (!detail) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Meeting not found.",
      });
    }

    return NextResponse.json(detail);
  },
);

// DELETE: Soft delete a meeting (sets deleted_at). 404s when the meeting is
// already deleted or doesn't exist.
export const DELETE = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]#DELETE",
  async ({ params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]#DELETE";
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

    const numericProjectId = parseProjectId(projectId, where);
    const supabase = await createClient();

    const { data: existingMeeting } = await supabase
      .from("meetings")
      .select("id, project_id, deleted_at")
      .eq("id", meetingId)
      .eq("project_id", numericProjectId)
      .maybeSingle();

    if (!existingMeeting || existingMeeting.deleted_at) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Meeting not found in this project",
      });
    }

    const { data, error } = await supabase
      .from("meetings")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", meetingId)
      .eq("project_id", numericProjectId)
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where,
          message: "Meeting not found or already deleted.",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to delete meeting: ${error.message}`,
        details: error,
      });
    }

    if (!data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Meeting not found or already deleted.",
      });
    }

    return NextResponse.json({ success: true, data });
  },
);
