import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string; photoId: string }>;
}

/**
 * PATCH /api/projects/[projectId]/photos/[photoId]/restore
 * Restores a soft-deleted photo by clearing deleted_at.
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/photos/[photoId]/restore#PATCH",
  async ({ request, params }) => {
  
    const { projectId, photoId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/photos/[photoId]/restore#PATCH", message: "Authentication required." });
    }

    const { data, error } = await supabase
      .from("project_photos")
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq("id", parseInt(photoId, 10))
      .eq("project_id", parseInt(projectId, 10))
      .not("deleted_at", "is", null)
      .select("id")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    if (!data) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
    },
);
