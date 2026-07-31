import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { assertMeetingInProject } from "@/lib/meetings/guards";
import { parseProjectId } from "@/lib/meetings/route-params";

const renameCategorySchema = z.object({
  name: z.string().min(1, "Category name is required."),
});

type RouteParams = { projectId: string; meetingId: string; categoryId: string };

// PATCH: Rename a category. `categoryId` must belong to `meetingId`.
export const PATCH = withApiGuardrails<RouteParams>(
  "projects/[projectId]/meetings/[meetingId]/categories/[categoryId]#PATCH",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/categories/[categoryId]#PATCH";
    const { projectId, meetingId, categoryId } = await params;
    assertNonNilUuid(meetingId, "meetingId", where);
    assertNonNilUuid(categoryId, "categoryId", where);

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    const numericProjectId = parseProjectId(projectId, where);
    const { name } = await parseJsonBody(request, renameCategorySchema, where);
    const supabase = await createClient();

    await assertMeetingInProject(supabase, meetingId, numericProjectId, where);

    const { data: existingCategory } = await supabase
      .from("meeting_categories")
      .select("id, meeting_id")
      .eq("id", categoryId)
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (!existingCategory) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Category not found in this meeting.",
      });
    }

    const { data: updatedCategory, error: updateError } = await supabase
      .from("meeting_categories")
      .update({ name })
      .eq("id", categoryId)
      .eq("meeting_id", meetingId)
      .select("*")
      .single();

    if (updateError || !updatedCategory) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to rename category: ${updateError?.message ?? "Unknown update failure"}`,
        details: updateError,
      });
    }

    return NextResponse.json(updatedCategory);
  },
);

// DELETE: Delete a category. If it's the meeting's only category, reject with
// a 400 — a meeting must always have at least one category. Otherwise, move
// its items to the meeting's first remaining category (by position), appended
// after that category's existing items (preserving relative order), then
// delete the category.
export const DELETE = withApiGuardrails<RouteParams>(
  "projects/[projectId]/meetings/[meetingId]/categories/[categoryId]#DELETE",
  async ({ params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/categories/[categoryId]#DELETE";
    const { projectId, meetingId, categoryId } = await params;
    assertNonNilUuid(meetingId, "meetingId", where);
    assertNonNilUuid(categoryId, "categoryId", where);

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

    const { data: existingCategory } = await supabase
      .from("meeting_categories")
      .select("id, meeting_id")
      .eq("id", categoryId)
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (!existingCategory) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Category not found in this meeting.",
      });
    }

    const { data: allCategories, error: allCategoriesError } = await supabase
      .from("meeting_categories")
      .select("id, position")
      .eq("meeting_id", meetingId)
      .order("position", { ascending: true });

    if (allCategoriesError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load categories: ${allCategoriesError.message}`,
        details: allCategoriesError,
      });
    }

    const categories = allCategories ?? [];
    if (categories.length <= 1) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: "A meeting must have at least one category.",
      });
    }

    const targetCategory = categories.find((category) => category.id !== categoryId);
    if (!targetCategory) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: "A meeting must have at least one category.",
      });
    }

    // Load the items being reparented, in their existing relative order.
    const { data: itemsToMove, error: itemsToMoveError } = await supabase
      .from("meeting_items")
      .select("id, position")
      .eq("meeting_id", meetingId)
      .eq("category_id", categoryId)
      .order("position", { ascending: true });

    if (itemsToMoveError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load category items: ${itemsToMoveError.message}`,
        details: itemsToMoveError,
      });
    }

    const movingItems = itemsToMove ?? [];

    if (movingItems.length > 0) {
      const { data: targetCategoryItems, error: targetCategoryItemsError } = await supabase
        .from("meeting_items")
        .select("position")
        .eq("meeting_id", meetingId)
        .eq("category_id", targetCategory.id)
        .order("position", { ascending: false })
        .limit(1);

      if (targetCategoryItemsError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: `Failed to load target category items: ${targetCategoryItemsError.message}`,
          details: targetCategoryItemsError,
        });
      }

      let nextPosition = ((targetCategoryItems ?? [])[0]?.position ?? -1) + 1;

      const moveResults = await Promise.all(
        movingItems.map((item) => {
          const position = nextPosition;
          nextPosition += 1;
          return supabase
            .from("meeting_items")
            .update({ category_id: targetCategory.id, position, updated_at: new Date().toISOString() })
            .eq("id", item.id)
            .eq("meeting_id", meetingId);
        }),
      );

      const failedMove = moveResults.find((result) => result.error);
      if (failedMove?.error) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: `Failed to move items to target category: ${failedMove.error.message}`,
          details: failedMove.error,
        });
      }
    }

    const { error: deleteError } = await supabase
      .from("meeting_categories")
      .delete()
      .eq("id", categoryId)
      .eq("meeting_id", meetingId);

    if (deleteError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to delete category: ${deleteError.message}`,
        details: deleteError,
      });
    }

    return NextResponse.json({ success: true, moved_item_count: movingItems.length });
  },
);
