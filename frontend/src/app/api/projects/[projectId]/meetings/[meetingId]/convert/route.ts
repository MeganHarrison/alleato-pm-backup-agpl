import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { loadMeetingDetail } from "@/lib/meetings/server";
import { parseProjectId } from "@/lib/meetings/route-params";
import type { Database } from "@/types/database.types";

type MeetingUpdate = Database["public"]["Tables"]["meetings"]["Update"];

const convertModeSchema = z.object({
  mode: z.enum(["minutes", "agenda"]),
});

// POST: Convert a meeting between "agenda" and "minutes" mode. Converting to
// minutes also clears is_draft (a meeting can't be in minutes mode and still
// be a draft).
export const POST = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]/convert#POST",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/convert#POST";
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
    const { mode } = await parseJsonBody(request, convertModeSchema, where);
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

    const updateData: MeetingUpdate = {
      mode,
      updated_at: new Date().toISOString(),
    };
    if (mode === "minutes") {
      updateData.is_draft = false;
    }

    const { error } = await supabase
      .from("meetings")
      .update(updateData)
      .eq("id", meetingId)
      .eq("project_id", numericProjectId);

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to convert meeting mode: ${error.message}`,
        details: error,
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
