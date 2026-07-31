import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { assertMeetingInProject } from "@/lib/meetings/guards";
import { parseProjectId } from "@/lib/meetings/route-params";
import { loadPreviousMinutes } from "@/lib/meetings/server";

type RouteParams = { projectId: string; meetingId: string; itemId: string };

// GET: Walk the carried_from_item_id chain backward from this item, returning
// the official minutes recorded on each ancestor item (oldest-first).
export const GET = withApiGuardrails<RouteParams>(
  "projects/[projectId]/meetings/[meetingId]/items/[itemId]/history#GET",
  async ({ params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/items/[itemId]/history#GET";
    const { projectId, meetingId, itemId } = await params;
    assertNonNilUuid(meetingId, "meetingId", where);
    assertNonNilUuid(itemId, "itemId", where);

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

    await assertMeetingInProject(supabase, meetingId, numericProjectId, where);

    const { data: existingItem } = await supabase
      .from("meeting_items")
      .select("id, meeting_id")
      .eq("id", itemId)
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (!existingItem) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Agenda item not found in this meeting.",
      });
    }

    const history = await loadPreviousMinutes(supabase, itemId);

    return NextResponse.json({ history });
  },
);
