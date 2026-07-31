import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { assertMeetingInProject } from "@/lib/meetings/guards";
import { parseProjectId } from "@/lib/meetings/route-params";

const setAttendanceSchema = z.object({
  person_id: z.string().uuid(),
  attended: z.boolean().nullable(),
});

type RouteParams = { projectId: string; meetingId: string };

// PATCH: Mark (or clear) a single attendee's attendance for a meeting.
// `person_id` must have an existing `meeting_attendees` row for this meeting.
export const PATCH = withApiGuardrails<RouteParams>(
  "projects/[projectId]/meetings/[meetingId]/attendees#PATCH",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/attendees#PATCH";
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
    const { person_id, attended } = await parseJsonBody(request, setAttendanceSchema, where);
    const supabase = await createClient();

    await assertMeetingInProject(supabase, meetingId, numericProjectId, where);

    const { data: existingAttendee } = await supabase
      .from("meeting_attendees")
      .select("id, meeting_id, person_id")
      .eq("meeting_id", meetingId)
      .eq("person_id", person_id)
      .maybeSingle();

    if (!existingAttendee) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Attendee not found on this meeting",
      });
    }

    const { data: updatedAttendee, error: updateError } = await supabase
      .from("meeting_attendees")
      .update({ attended })
      .eq("meeting_id", meetingId)
      .eq("person_id", person_id)
      .select("*")
      .single();

    if (updateError || !updatedAttendee) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to update attendance: ${updateError?.message ?? "Unknown update failure"}`,
        details: updateError,
      });
    }

    return NextResponse.json(updatedAttendee);
  },
);
