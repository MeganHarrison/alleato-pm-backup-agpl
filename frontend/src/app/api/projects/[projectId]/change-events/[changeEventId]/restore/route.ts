import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

/**
 * POST /api/projects/[projectId]/change-events/[changeEventId]/restore
 * Restores a soft-deleted change event by clearing deleted_at.
 */
export const POST = withApiGuardrails<{ projectId: string; changeEventId: string }>(
  "projects/[projectId]/change-events/[changeEventId]/restore#POST",
  async ({ params }) => {
    const { projectId, changeEventId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "change_orders", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/change-events/[changeEventId]/restore#POST",
        message: "Authentication required.",
      });
    }

    // Verify the change event exists and is soft-deleted
    const { data: existingEvent, error: fetchError } = await supabase
      .from("change_events")
      .select("id, deleted_at")
      .eq("project_id", projectIdNum)
      .eq("id", changeEventId)
      .single();

    if (fetchError || !existingEvent) {
      return NextResponse.json(
        { error: "Change event not found" },
        { status: 404 },
      );
    }

    if (!existingEvent.deleted_at) {
      return NextResponse.json(
        { error: "Change event is not deleted" },
        { status: 400 },
      );
    }

    // Restore by clearing deleted_at
    const { error } = await supabase
      .from("change_events")
      .update({
        deleted_at: null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", changeEventId);

    if (error) {
      return apiErrorResponse(error);
    }

    // Audit log
    await supabase.from("change_event_history").insert({
      change_event_id: changeEventId,
      field_name: "deleted_at",
      old_value: existingEvent.deleted_at,
      new_value: null,
      changed_by: user.id,
      change_type: "RESTORE",
    });

    return NextResponse.json({ success: true });
  },
);
