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
 * GET /api/projects/[projectId]/submittals/[submittalId]/revisions
 * Returns all revisions sharing the same submittal_number (including the current one).
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/revisions#GET",
  async ({ params }) => {
    const { projectId, submittalId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/[submittalId]/revisions#GET",
        message: "Authentication required.",
      });
    }

    // Fetch the base submittal to get its number
    const { data: base, error: baseError } = await supabase
      .from("submittals")
      .select("submittal_number")
      .eq("id", submittalId)
      .single();

    if (baseError || !base) {
      return NextResponse.json({ error: "Submittal not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("submittals")
      .select("id, submittal_number, revision, title, status, created_at")
      .eq("project_id", parseInt(projectId, 10))
      .eq("submittal_number", base.submittal_number)
      .is("deleted_at", null)
      .order("revision", { ascending: true });

    if (error) return apiErrorResponse(error);
    return NextResponse.json(data ?? []);
  },
);

/**
 * POST /api/projects/[projectId]/submittals/[submittalId]/revisions
 * Creates a new revision of the submittal (increments revision, resets status).
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/revisions#POST",
  async ({ request, params }) => {
  
    const { projectId, submittalId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/submittals/[submittalId]/revisions#POST", message: "Authentication required." });
    }

    // Fetch the original submittal
    const { data: original, error: fetchError } = await supabase
      .from("submittals")
      .select("*")
      .eq("id", submittalId)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ error: "Submittal not found" }, { status: 404 });
    }

    const nextRevision = (original.revision ?? 0) + 1;

    // Check no existing revision with this number
    const { data: existing } = await supabase
      .from("submittals")
      .select("id")
      .eq("project_id", parseInt(projectId, 10))
      .eq("submittal_number", original.submittal_number)
      .eq("revision", nextRevision)
      .is("deleted_at", null)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Revision ${nextRevision} already exists` },
        { status: 409 },
      );
    }

    // Create new revision — same submittal_number, incremented revision, reset status
    const { data: newRevision, error: insertError } = await supabase
      .from("submittals")
      .insert({
        project_id: original.project_id,
        submittal_number: original.submittal_number,
        revision: nextRevision,
        title: original.title,
        status: "Draft",
        specification_section: original.specification_section,
        submittal_type: original.submittal_type,
        submittal_type_id: original.submittal_type_id,
        division: original.division,
        submittal_package_id: original.submittal_package_id,
        responsible_contractor_id: original.responsible_contractor_id,
        received_from_id: original.received_from_id,
        submittal_manager_id: original.submittal_manager_id,
        description: original.description,
        is_private: original.is_private,
        lead_time: original.lead_time,
        final_due_date: original.final_due_date,
        required_on_site_date: original.required_on_site_date,
        cost_code_id: original.cost_code_id,
        location_id: original.location_id,
        submitted_by: user.id,
        created_by: user.id,
        ball_in_court: null,
      })
      .select()
      .single();

    if (insertError) {
      return apiErrorResponse(insertError);
    }

    return NextResponse.json(newRevision, { status: 201 });
    },
);
