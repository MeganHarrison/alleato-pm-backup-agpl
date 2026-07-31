import { NextResponse } from "next/server";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { assertMeetingInProject } from "@/lib/meetings/guards";
import { parseProjectId } from "@/lib/meetings/route-params";
import { updateItemSchema } from "@/lib/meetings/schemas";
import type { Database } from "@/types/database.types";

type MeetingItemUpdate = Database["public"]["Tables"]["meeting_items"]["Update"];

type RouteParams = { projectId: string; meetingId: string; itemId: string };

// PATCH: Update any field on an agenda item (title, description,
// official_minutes, status, priority, assignee_person_id, due_date,
// category_id). When category_id is supplied, the target category must
// belong to this meeting.
export const PATCH = withApiGuardrails<RouteParams>(
  "projects/[projectId]/meetings/[meetingId]/items/[itemId]#PATCH",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/items/[itemId]#PATCH";
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
    const payload = await parseJsonBody(request, updateItemSchema, where);
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

    if (payload.category_id) {
      const { data: targetCategory } = await supabase
        .from("meeting_categories")
        .select("id, meeting_id")
        .eq("id", payload.category_id)
        .eq("meeting_id", meetingId)
        .maybeSingle();

      if (!targetCategory) {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where,
          message: "Target category not found in this meeting.",
        });
      }
    }

    const updateData: MeetingItemUpdate = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedItem, error: updateError } = await supabase
      .from("meeting_items")
      .update(updateData)
      .eq("id", itemId)
      .eq("meeting_id", meetingId)
      .select("*")
      .single();

    if (updateError || !updatedItem) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to update agenda item: ${updateError?.message ?? "Unknown update failure"}`,
        details: updateError,
      });
    }

    return NextResponse.json(updatedItem);
  },
);

// DELETE: Hard-delete an agenda item.
export const DELETE = withApiGuardrails<RouteParams>(
  "projects/[projectId]/meetings/[meetingId]/items/[itemId]#DELETE",
  async ({ params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/items/[itemId]#DELETE";
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

    const { error: deleteError } = await supabase
      .from("meeting_items")
      .delete()
      .eq("id", itemId)
      .eq("meeting_id", meetingId);

    if (deleteError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to delete agenda item: ${deleteError.message}`,
        details: deleteError,
      });
    }

    return NextResponse.json({ success: true, id: itemId });
  },
);
