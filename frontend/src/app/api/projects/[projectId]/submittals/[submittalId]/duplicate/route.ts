import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string; submittalId: string }>;
}

/**
 * POST /api/projects/[projectId]/submittals/[submittalId]/duplicate
 * Copies a submittal row (appends " (Copy)" to title) and returns the new record.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/duplicate#POST",
  async ({ request, params }) => {
  
    const { projectId, submittalId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/submittals/[submittalId]/duplicate#POST", message: "Authentication required." });
    }

    // Fetch original submittal
    const { data: original, error: fetchError } = await supabase
      .from("submittals")
      .select("*")
      .eq("project_id", parseInt(projectId, 10))
      .eq("id", submittalId)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ error: "Submittal not found" }, { status: 404 });
    }

    // Build the duplicate — strip identity fields, mutate title
    const { id: _id, created_at: _ca, updated_at: _ua, deleted_at: _da, ...rest } = original;

    const now = new Date().toISOString();
    const { data: newRecord, error: insertError } = await supabase
      .from("submittals")
      .insert({
        ...rest,
        title: `${original.title} (Copy)`,
        status: "Draft",
        deleted_at: null,
        created_at: now,
        updated_at: now,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return apiErrorResponse(insertError);
    }

    return NextResponse.json(newRecord, { status: 201 });
    },
);
