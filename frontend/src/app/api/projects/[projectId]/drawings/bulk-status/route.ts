import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { DrawingService } from "@/services/DrawingService";

const VALID_ACTIONS = ["publish", "unpublish", "obsolete", "restore"] as const;
type BulkStatusAction = typeof VALID_ACTIONS[number];

export const PATCH = withApiGuardrails(
  "projects/[projectId]/drawings/bulk-status#PATCH",
  async ({ request, params }) => {
    const { projectId } = params as { projectId: string };
    const projectIdNum = Number(projectId);
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/drawings/bulk-status#PATCH",
        message: "Unauthorized",
        status: 401,
      });
    }

    let body: { drawingIds: string[]; action: BulkStatusAction };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { drawingIds, action } = body;
    if (!Array.isArray(drawingIds) || drawingIds.length === 0) {
      return NextResponse.json({ error: "drawingIds array is required" }, { status: 400 });
    }
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    if (action === "publish" || action === "unpublish") {
      const service = new DrawingService(createServiceClient());
      let succeeded = 0;
      const failures: Array<{ drawingId: string; error: string }> = [];

      for (const drawingId of drawingIds) {
        const result =
          action === "publish"
            ? await service.publish(projectId, drawingId, user.id)
            : await service.unpublish(projectId, drawingId);

        if (result.error) {
          failures.push({ drawingId, error: result.error.message });
        } else {
          succeeded++;
        }
      }

      return NextResponse.json({
        succeeded,
        failed: failures.length,
        failures,
      });
    }

    const updateData: { is_obsolete?: boolean } = {};
    if (action === "obsolete") updateData.is_obsolete = true;
    else if (action === "restore") updateData.is_obsolete = false;

    const { data, error } = await supabase
      .from("drawings")
      .update(updateData)
      .in("id", drawingIds)
      .eq("project_id", projectIdNum)
      .is("deleted_at", null)
      .select("id");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      succeeded: data?.length ?? 0,
      failed: drawingIds.length - (data?.length ?? 0),
    });
  },
);
