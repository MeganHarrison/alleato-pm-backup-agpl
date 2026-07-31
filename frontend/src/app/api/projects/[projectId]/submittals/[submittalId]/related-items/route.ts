import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string; submittalId: string }>;
}

const addRelatedItemSchema = z.object({
  drawing_id: z.string().min(1),
});

const deleteRelatedItemsSchema = z.object({
  related_item_ids: z.array(z.string().uuid()).min(1),
});

/**
 * GET /api/projects/[projectId]/submittals/[submittalId]/related-items
 * Returns linked drawings for the submittal.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/related-items#GET",
  async ({ params }) => {
    const { projectId, submittalId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/[submittalId]/related-items#GET",
        message: "Authentication required.",
      });
    }

    const { data: submittal, error: submittalError } = await supabase
      .from("submittals")
      .select("id")
      .eq("project_id", parseInt(projectId, 10))
      .eq("id", submittalId)
      .is("deleted_at", null)
      .single();

    if (submittalError || !submittal) {
      return NextResponse.json({ error: "Submittal not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("submittal_linked_drawings")
      .select("id, drawing_id, submittal_id")
      .eq("submittal_id", submittalId)
      .order("id");

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data ?? []);
  },
);

/**
 * POST /api/projects/[projectId]/submittals/[submittalId]/related-items
 * Links one drawing to the submittal.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/related-items#POST",
  async ({ request, params }) => {
    const { projectId, submittalId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/[submittalId]/related-items#POST",
        message: "Authentication required.",
      });
    }

    const { data: submittal, error: submittalError } = await supabase
      .from("submittals")
      .select("id")
      .eq("project_id", parseInt(projectId, 10))
      .eq("id", submittalId)
      .is("deleted_at", null)
      .single();

    if (submittalError || !submittal) {
      return NextResponse.json({ error: "Submittal not found" }, { status: 404 });
    }

    const body = await request.json();
    const { drawing_id } = addRelatedItemSchema.parse(body);

    const { data, error } = await supabase
      .from("submittal_linked_drawings")
      .insert({ submittal_id: submittalId, drawing_id })
      .select("id, drawing_id, submittal_id")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data, { status: 201 });
  },
);

/**
 * DELETE /api/projects/[projectId]/submittals/[submittalId]/related-items
 * Unlinks one or more related drawing records.
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/related-items#DELETE",
  async ({ request, params }) => {
    const { projectId, submittalId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/[submittalId]/related-items#DELETE",
        message: "Authentication required.",
      });
    }

    const { data: submittal, error: submittalError } = await supabase
      .from("submittals")
      .select("id")
      .eq("project_id", parseInt(projectId, 10))
      .eq("id", submittalId)
      .is("deleted_at", null)
      .single();

    if (submittalError || !submittal) {
      return NextResponse.json({ error: "Submittal not found" }, { status: 404 });
    }

    const body = await request.json();
    const { related_item_ids } = deleteRelatedItemsSchema.parse(body);

    const { error } = await supabase
      .from("submittal_linked_drawings")
      .delete()
      .eq("submittal_id", submittalId)
      .in("id", related_item_ids);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true, deleted_count: related_item_ids.length });
  },
);
