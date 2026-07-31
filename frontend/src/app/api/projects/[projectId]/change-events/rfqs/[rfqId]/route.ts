import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string; rfqId: string }>;
}

const updateRfqSchema = z.object({
  status: z.enum(["Draft", "Sent", "Response Received", "Closed"]).optional(),
  title: z.string().min(3).max(255).optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  includeAttachments: z.boolean().optional(),
});

/**
 * GET /api/projects/[projectId]/change-events/rfqs/[rfqId]
 * Get a single RFQ with its responses
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/rfqs/[rfqId]#GET",
  async ({ request, params }) => {
  
    const { projectId, rfqId } = await params;
    const numericProjectId = parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: rfq, error } = await supabase
      .from("change_event_rfqs")
      .select("*")
      .eq("project_id", numericProjectId)
      .eq("id", rfqId)
      .single();

    if (error || !rfq) {
      return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }

    const { data: responses } = await supabase
      .from("change_event_rfq_responses")
      .select("*")
      .eq("rfq_id", rfqId)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      data: {
        ...rfq,
        responses: responses ?? [],
        response_count: responses?.length ?? 0,
      },
    });
    },
);

/**
 * PATCH /api/projects/[projectId]/change-events/rfqs/[rfqId]
 * Update an RFQ (including closing it)
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/change-events/rfqs/[rfqId]#PATCH",
  async ({ request, params }) => {
  
    const { projectId, rfqId } = await params;
    const numericProjectId = parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const guard = await requirePermission(numericProjectId, "change_orders", "write");
    if (guard.denied) return guard.response;

    const body = await request.json();
    const parsed = updateRfqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/rfqs/[rfqId]#PATCH", message: "Authentication required." });
    }

    // Verify the RFQ exists and belongs to the project
    const { data: existing, error: fetchError } = await supabase
      .from("change_event_rfqs")
      .select("id, project_id, status")
      .eq("project_id", numericProjectId)
      .eq("id", rfqId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_by: user.id };
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
    if (parsed.data.dueDate !== undefined) updates.due_date = parsed.data.dueDate.slice(0, 10);
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
    if (parsed.data.includeAttachments !== undefined) updates.include_attachments = parsed.data.includeAttachments;

    const { data: updated, error: updateError } = await supabase
      .from("change_event_rfqs")
      .update(updates)
      .eq("id", rfqId)
      .select("*")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Failed to update RFQ", details: updateError?.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ data: updated });
    },
);

/**
 * DELETE /api/projects/[projectId]/change-events/rfqs/[rfqId]
 * Delete an RFQ (only allowed in Draft status)
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/change-events/rfqs/[rfqId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, rfqId } = await params;
    const numericProjectId = parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const guard = await requirePermission(numericProjectId, "change_orders", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/rfqs/[rfqId]#DELETE", message: "Authentication required." });
    }

    const { data: existing, error: fetchError } = await supabase
      .from("change_event_rfqs")
      .select("id, status")
      .eq("project_id", numericProjectId)
      .eq("id", rfqId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }

    if (existing.status !== "Draft") {
      return NextResponse.json(
        { error: "Only Draft RFQs can be deleted" },
        { status: 409 },
      );
    }

    const { error: deleteError } = await supabase
      .from("change_event_rfqs")
      .delete()
      .eq("id", rfqId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete RFQ", details: deleteError.message },
        { status: 400 },
      );
    }

    return new NextResponse(null, { status: 204 });
    },
);
