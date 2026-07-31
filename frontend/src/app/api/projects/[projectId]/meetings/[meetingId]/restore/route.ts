import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { loadMeetingDetail } from "@/lib/meetings/server";
import { parseProjectId } from "@/lib/meetings/route-params";

// POST: Restore a soft-deleted meeting (clears deleted_at).
export const POST = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]/restore#POST",
  async ({ params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/restore#POST";
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

    if (!existingMeeting) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Meeting not found in this project",
      });
    }

    const { data, error } = await supabase
      .from("meetings")
      .update({ deleted_at: null })
      .eq("id", meetingId)
      .eq("project_id", numericProjectId)
      .select("id")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where,
          message: "Meeting not found.",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to restore meeting: ${error.message}`,
        details: error,
      });
    }

    if (!data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Meeting not found.",
      });
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
