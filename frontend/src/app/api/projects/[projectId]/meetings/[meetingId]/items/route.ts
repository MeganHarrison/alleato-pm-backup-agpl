import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { assertMeetingInProject } from "@/lib/meetings/guards";
import { parseProjectId } from "@/lib/meetings/route-params";
import { createItemSchema, reorderSchema } from "@/lib/meetings/schemas";

const moveItemsSchema = z.object({
  category_id: z.string().uuid(),
  ordered_ids: reorderSchema.shape.ordered_ids,
});

// POST: Create a new agenda item in a category, appended after all existing
// items in that category (position = max(position) + 1). `origin_meeting_id`
// is set to this meeting since the item was created here (not carried over).
export const POST = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]/items#POST",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/items#POST";
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
    const payload = await parseJsonBody(request, createItemSchema, where);
    const supabase = await createClient();

    await assertMeetingInProject(supabase, meetingId, numericProjectId, where);

    const { data: category } = await supabase
      .from("meeting_categories")
      .select("id, meeting_id")
      .eq("id", payload.category_id)
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (!category) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Category not found in this meeting.",
      });
    }

    const { data: maxPositionRows, error: maxPositionError } = await supabase
      .from("meeting_items")
      .select("position")
      .eq("category_id", payload.category_id)
      .order("position", { ascending: false })
      .limit(1);

    if (maxPositionError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to compute next item position: ${maxPositionError.message}`,
        details: maxPositionError,
      });
    }

    const nextPosition = ((maxPositionRows ?? [])[0]?.position ?? -1) + 1;

    const { data: newItem, error: insertError } = await supabase
      .from("meeting_items")
      .insert({
        meeting_id: meetingId,
        category_id: payload.category_id,
        title: payload.title,
        description: payload.description ?? null,
        assignee_person_id: payload.assignee_person_id ?? null,
        due_date: payload.due_date ?? null,
        status: payload.status ?? "open",
        priority: payload.priority ?? null,
        position: nextPosition,
        origin_meeting_id: meetingId,
      })
      .select("*")
      .single();

    if (insertError || !newItem) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to create agenda item: ${insertError?.message ?? "Unknown insert failure"}`,
        details: insertError,
      });
    }

    return NextResponse.json(newItem, { status: 201 });
  },
);

// PATCH: Move/reorder items into a category. The caller sends the target
// category id and the full ordered id list for every item that should end up
// in that category; positions are rewritten 0..n in the given order. Every
// item and the target category must belong to this meeting.
export const PATCH = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]/items#PATCH",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/items#PATCH";
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
    const { category_id: categoryId, ordered_ids: orderedIds } = await parseJsonBody(
      request,
      moveItemsSchema,
      where,
    );
    const supabase = await createClient();

    await assertMeetingInProject(supabase, meetingId, numericProjectId, where);

    const { data: category } = await supabase
      .from("meeting_categories")
      .select("id, meeting_id")
      .eq("id", categoryId)
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (!category) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Category not found in this meeting.",
      });
    }

    const { data: existingItems, error: existingItemsError } = await supabase
      .from("meeting_items")
      .select("id")
      .eq("meeting_id", meetingId);

    if (existingItemsError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load items: ${existingItemsError.message}`,
        details: existingItemsError,
      });
    }

    const existingItemIds = new Set((existingItems ?? []).map((item) => item.id as string));

    const unknownIds = orderedIds.filter((id) => !existingItemIds.has(id));
    if (unknownIds.length > 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: `The following item ids do not belong to this meeting: ${unknownIds.join(", ")}`,
      });
    }

    const nowIso = new Date().toISOString();
    const updates = orderedIds.map((id, index) =>
      supabase
        .from("meeting_items")
        .update({ category_id: categoryId, position: index, updated_at: nowIso })
        .eq("id", id)
        .eq("meeting_id", meetingId),
    );

    const results = await Promise.all(updates);
    const failedUpdate = results.find((result) => result.error);
    if (failedUpdate?.error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to reorder items: ${failedUpdate.error.message}`,
        details: failedUpdate.error,
      });
    }

    const { data: reorderedItems, error: reloadError } = await supabase
      .from("meeting_items")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("position", { ascending: true });

    if (reloadError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to reload items: ${reloadError.message}`,
        details: reloadError,
      });
    }

    return NextResponse.json({ items: reorderedItems ?? [] });
  },
);
