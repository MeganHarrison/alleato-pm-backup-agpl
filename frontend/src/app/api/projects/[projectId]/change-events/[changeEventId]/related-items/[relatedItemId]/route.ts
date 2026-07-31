import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{
    projectId: string;
    changeEventId: string;
    relatedItemId: string;
  }>;
}

export const DELETE = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/related-items/[relatedItemId]#DELETE",
  async ({ params }) => {
  
    const { projectId, changeEventId, relatedItemId } = await params;
    const parsedProjectId = Number.parseInt(projectId, 10);
    if (Number.isNaN(parsedProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const guard = await requirePermission(parsedProjectId, "change_orders", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/related-items/[relatedItemId]#DELETE", message: "Authentication required." });
    }

    const { error } = await supabase
      .from("change_event_related_items")
      .delete()
      .eq("id", relatedItemId)
      .eq("project_id", parsedProjectId)
      .eq("change_event_id", changeEventId);

    if (error) {
      if (
        error.code === "42P01" ||
        error.message?.includes("Could not find") ||
        error.message?.includes("schema cache")
      ) {
        return NextResponse.json(
          { error: "Related items are unavailable until migrations are applied" },
          { status: 503 },
        );
      }

      return apiErrorResponse(error);
    }

    return new NextResponse(null, { status: 204 });
    },
);
