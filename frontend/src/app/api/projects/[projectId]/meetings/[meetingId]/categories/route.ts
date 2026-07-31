import { NextResponse } from "next/server";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { assertMeetingInProject } from "@/lib/meetings/guards";
import { parseProjectId } from "@/lib/meetings/route-params";
import { createCategorySchema, reorderSchema } from "@/lib/meetings/schemas";

// POST: Create a new category for a meeting, appended after all existing
// categories (position = max(position) + 1).
export const POST = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]/categories#POST",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/categories#POST";
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
    const payload = await parseJsonBody(request, createCategorySchema, where);
    const supabase = await createClient();

    await assertMeetingInProject(supabase, meetingId, numericProjectId, where);

    const { data: maxPositionRows, error: maxPositionError } = await supabase
      .from("meeting_categories")
      .select("position")
      .eq("meeting_id", meetingId)
      .order("position", { ascending: false })
      .limit(1);

    if (maxPositionError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to compute next category position: ${maxPositionError.message}`,
        details: maxPositionError,
      });
    }

    const nextPosition = ((maxPositionRows ?? [])[0]?.position ?? -1) + 1;

    const { data: newCategory, error: insertError } = await supabase
      .from("meeting_categories")
      .insert({
        meeting_id: meetingId,
        name: payload.name,
        position: nextPosition,
      })
      .select("*")
      .single();

    if (insertError || !newCategory) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to create category: ${insertError?.message ?? "Unknown insert failure"}`,
        details: insertError,
      });
    }

    return NextResponse.json(newCategory, { status: 201 });
  },
);

// PATCH: Reorder categories within a meeting. The caller sends the full
// ordered id list for every category in the meeting; positions are rewritten
// 0..n in the given order. Every id must belong to this meeting.
export const PATCH = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]/categories#PATCH",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/categories#PATCH";
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
    const { ordered_ids: orderedIds } = await parseJsonBody(request, reorderSchema, where);
    const supabase = await createClient();

    await assertMeetingInProject(supabase, meetingId, numericProjectId, where);

    const { data: existingCategories, error: existingCategoriesError } = await supabase
      .from("meeting_categories")
      .select("id")
      .eq("meeting_id", meetingId);

    if (existingCategoriesError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load categories: ${existingCategoriesError.message}`,
        details: existingCategoriesError,
      });
    }

    const existingCategoryIds = new Set(
      (existingCategories ?? []).map((category) => category.id as string),
    );

    const unknownIds = orderedIds.filter((id) => !existingCategoryIds.has(id));
    if (unknownIds.length > 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: `The following category ids do not belong to this meeting: ${unknownIds.join(", ")}`,
      });
    }

    const updates = orderedIds.map((id, index) =>
      supabase
        .from("meeting_categories")
        .update({ position: index })
        .eq("id", id)
        .eq("meeting_id", meetingId),
    );

    const results = await Promise.all(updates);
    const failedUpdate = results.find((result) => result.error);
    if (failedUpdate?.error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to reorder categories: ${failedUpdate.error.message}`,
        details: failedUpdate.error,
      });
    }

    const { data: reorderedCategories, error: reloadError } = await supabase
      .from("meeting_categories")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("position", { ascending: true });

    if (reloadError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to reload categories: ${reloadError.message}`,
        details: reloadError,
      });
    }

    return NextResponse.json({ categories: reorderedCategories ?? [] });
  },
);
