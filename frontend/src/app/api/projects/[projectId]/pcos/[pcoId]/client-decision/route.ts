/**
 * ============================================================================
 * PCO CLIENT DECISION API ROUTE
 * ============================================================================
 *
 * POST /api/projects/[projectId]/pcos/[pcoId]/client-decision
 * Records the client's decision on a submitted PCO:
 *   - APPROVED: sets status, approved_at, writes timeline
 *   - REVISION_REQUESTED: increments current_version, sets status to DRAFT
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ projectId: string; pcoId: string }>;
}

export const POST = withApiGuardrails(
  "projects/[projectId]/pcos/[pcoId]/client-decision#POST",
  async ({ request, params }) => {
  
    const { projectId, pcoId } = await params;
    const numericProjectId = parseInt(projectId, 10);
    const numericPcoId = parseInt(pcoId, 10);

    if (isNaN(numericProjectId) || isNaN(numericPcoId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const guard = await requirePermission(numericProjectId, "change_orders", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json();

    // Get current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/pcos/[pcoId]/client-decision#POST", message: "Authentication required." });
    }

    // Validate decision
    const validDecisions = ["APPROVED", "REVISION_REQUESTED"];
    if (!body.decision || !validDecisions.includes(body.decision)) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: `decision must be one of: ${validDecisions.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Fetch PCO
    const { data: pco, error: fetchError } = await supabase
      .from("potential_change_orders")
      .select("*")
      .eq("id", numericPcoId)
      .eq("project_id", numericProjectId)
      .single();

    if (fetchError || !pco) {
      return NextResponse.json(
        { error: "PCO not found" },
        { status: 404 }
      );
    }

    // Only SUBMITTED PCOs can receive client decisions
    if (pco.status !== "SUBMITTED") {
      return NextResponse.json(
        {
          error: "Cannot record decision",
          details: `PCO is in status "${pco.status}". Only SUBMITTED PCOs can receive client decisions.`,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    // The submit route inserts a pco_versions row at `current_version` and then
    // increments current_version on the PCO record.  So by the time the client
    // makes a decision, pco.current_version is already one ahead of the
    // actually-submitted version row.  We must target (current_version - 1).
    const submittedVersion = (pco.current_version ?? 1) - 1;

    if (submittedVersion < 1) {
      return NextResponse.json(
        { error: "No submitted version found for this PCO" },
        { status: 409 }
      );
    }

    // Update the submitted pco_version with client decision
    const { error: versionUpdateError } = await supabase
      .from("pco_versions")
      .update({
        client_decision: body.decision,
        client_decision_at: now,
        client_decision_note: body.note || null,
      })
      .eq("pco_id", numericPcoId)
      .eq("version", submittedVersion);

    if (versionUpdateError) {
      logger.error({ msg: "Failed to update version decision:", data: versionUpdateError });
    }

    const updates: Record<string, unknown> = {
      updated_at: now,
    };

    if (body.decision === "APPROVED") {
      updates.status = "APPROVED";
      updates.approved_at = now;
      updates.approved_value = pco.estimated_value;
    } else {
      // REVISION_REQUESTED — revert to DRAFT for resubmission.
      // current_version was already incremented by the submit route, so no bump needed here.
      updates.status = "DRAFT";
    }

    const { data: updatedPco, error: updateError } = await supabase
      .from("potential_change_orders")
      .update(updates)
      .eq("id", numericPcoId)
      .select()
      .single();

    if (updateError) {
      logger.error({ msg: "Failed to update PCO:", data: updateError });
      return NextResponse.json(
        { error: "Failed to record decision", details: updateError.message },
        { status: 400 }
      );
    }

    // Write timeline event
    const summary =
      body.decision === "APPROVED"
        ? `PCO "${pco.title}" approved by client`
        : `PCO "${pco.title}" — client requested revision${body.note ? `: ${body.note}` : ""}`;

    // Map decision to allowed event_type values from the timeline_events CHECK constraint
    const decisionEventType =
      body.decision === "APPROVED" ? "PCO_APPROVED" : "CLIENT_REVISION_REQUESTED";

    await supabase.from("timeline_events").insert({
      project_id: numericProjectId,
      parent_type: "PCO",
      parent_id: numericPcoId.toString(),
      event_type: decisionEventType,
      actor_id: user.id,
      summary,
      metadata: {
        decision: body.decision,
        note: body.note || null,
        version: submittedVersion,
      },
      created_at: now,
    });

    return NextResponse.json({
      ...updatedPco,
      decision: body.decision,
      message:
        body.decision === "APPROVED"
          ? "PCO approved"
          : "Revision requested — PCO returned to DRAFT",
    });
    },
);
