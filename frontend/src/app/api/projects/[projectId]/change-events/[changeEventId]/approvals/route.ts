import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import { logger } from "@/lib/logger";

type RouteParams = {
  params: Promise<{ projectId: string; changeEventId: string }>;
};

/**
 * GET /api/projects/[projectId]/change-events/[changeEventId]/approvals
 * List all approvals for a specific change event
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/approvals#GET",
  async ({ request, params }) => {
  
    const { projectId, changeEventId } = await params;
    const supabase = await createClient();

    // Verify user authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/approvals#GET", message: "Authentication required." });
    }

    // Verify change event exists and belongs to project
    const { data: changeEvent, error: ceError } = await supabase
      .from("change_events")
      .select("id, project_id")
      .eq("id", changeEventId)
      .eq("project_id", parseInt(projectId, 10))
      .single();

    if (ceError || !changeEvent) {
      return NextResponse.json(
        { error: "Change event not found" },
        { status: 404 },
      );
    }

    // Fetch approvals
    const { data, error } = await supabase
      .from("change_event_approvals")
      .select("*")
      .eq("change_event_id", changeEventId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error({ msg: "Error fetching approvals:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data: data || [] });
    },
);

/**
 * POST /api/projects/[projectId]/change-events/[changeEventId]/approvals
 * Create a new approval request for a change event
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/approvals#POST",
  async ({ request, params }) => {
  
    const { projectId, changeEventId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "change_orders", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // Verify user authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/approvals#POST", message: "Authentication required." });
    }

    const body = await request.json();
    const { approver_id, comments } = body;

    if (!approver_id) {
      return NextResponse.json(
        { error: "approver_id is required" },
        { status: 400 },
      );
    }

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    // Verify the change event exists and belongs to the project
    const { data: changeEvent, error: ceError } = await supabase
      .from("change_events")
      .select("id, project_id")
      .eq("id", changeEventId)
      .eq("project_id", projectIdNum)
      .single();

    if (ceError || !changeEvent) {
      return NextResponse.json(
        { error: "Change event not found" },
        { status: 404 },
      );
    }

    // Create the approval request
    const { data, error } = await supabase
      .from("change_event_approvals")
      .insert({
        change_event_id: changeEventId,
        approver_id: approver_id,
        approval_status: "pending",
        comments: comments || null,
      })
      .select("*")
      .single();

    if (error) {
      logger.error({ msg: "Error creating approval:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data }, { status: 201 });
    },
);

/**
 * PATCH /api/projects/[projectId]/change-events/[changeEventId]/approvals
 * Update an approval decision (approve/reject)
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/approvals#PATCH",
  async ({ request, params }) => {
  
    const { projectId, changeEventId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "change_orders", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // Verify user authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/approvals#PATCH", message: "Authentication required." });
    }

    const body = await request.json();
    const { approval_id, approval_status, comments } = body;

    if (!approval_id) {
      return NextResponse.json(
        { error: "approval_id is required" },
        { status: 400 },
      );
    }

    if (!approval_status || !["approved", "rejected"].includes(approval_status)) {
      return NextResponse.json(
        { error: "approval_status must be 'approved' or 'rejected'" },
        { status: 400 },
      );
    }

    // Verify the approval exists and user has permission
    const { data: existingApproval, error: fetchError } = await supabase
      .from("change_event_approvals")
      .select("*")
      .eq("id", approval_id)
      .eq("change_event_id", changeEventId)
      .single();

    if (fetchError || !existingApproval) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 },
      );
    }

    // Check if user is the approver
    if (existingApproval.approver_id !== user.id) {
      return NextResponse.json(
        { error: "Only the assigned approver can update this approval" },
        { status: 403 },
      );
    }

    // Prevent changing a decision that has already been made
    if (existingApproval.approval_status !== "pending") {
      return NextResponse.json(
        { error: "Approval has already been decided and cannot be changed" },
        { status: 409 },
      );
    }

    // Update the approval
    const { data, error } = await supabase
      .from("change_event_approvals")
      .update({
        approval_status,
        comments: comments || existingApproval.comments,
        responded_at: new Date().toISOString(),
      })
      .eq("id", approval_id)
      .eq("change_event_id", changeEventId)
      .select("*")
      .single();

    if (error) {
      logger.error({ msg: "Error updating approval:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data });
    },
);
