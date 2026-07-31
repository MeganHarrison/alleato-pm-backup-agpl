/**
 * ============================================================================
 * PCO SUBMIT API ROUTE
 * ============================================================================
 *
 * POST /api/projects/[projectId]/pcos/[pcoId]/submit
 * Submits a PCO to the client:
 *   - Snapshots current PCO state into pco_versions
 *   - Sets status to SUBMITTED
 *   - Sets submitted_at
 *   - Writes timeline event
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
  "projects/[projectId]/pcos/[pcoId]/submit#POST",
  async ({ request, params }) => {
  
    const { projectId, pcoId } = await params;
    const numericProjectId = parseInt(projectId, 10);
    const numericPcoId = parseInt(pcoId, 10);

    if (isNaN(numericProjectId) || isNaN(numericPcoId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const guard = await requirePermission(numericProjectId, "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // Get current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/pcos/[pcoId]/submit#POST", message: "Authentication required." });
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

    // Only DRAFT or REVISION_REQUESTED can be submitted
    if (pco.status !== "DRAFT" && pco.status !== "REVISION_REQUESTED") {
      return NextResponse.json(
        {
          error: "Cannot submit PCO",
          details: `PCO is in status "${pco.status}". Only DRAFT or REVISION_REQUESTED PCOs can be submitted.`,
        },
        { status: 409 }
      );
    }

    // Fetch line items and grouped change events for snapshot
    const { data: lineItems } = await supabase
      .from("potential_change_order_line_items")
      .select("*")
      .eq("pco_id", numericPcoId);

    const { data: groupedCEs } = await supabase
      .from("pco_change_events")
      .select("*")
      .eq("pco_id", numericPcoId);

    const now = new Date().toISOString();
    const version = pco.current_version || 1;

    // Create version snapshot
    const snapshotData = {
      pco: { ...pco },
      lineItems: lineItems || [],
      groupedChangeEvents: groupedCEs || [],
    };

    const { error: versionError } = await supabase
      .from("pco_versions")
      .insert({
        pco_id: numericPcoId,
        version,
        snapshot_data: snapshotData,
        submitted_at: now,
        submitted_by_id: user.id,
      });

    if (versionError) {
      logger.error({ msg: "Failed to create PCO version:", data: versionError });
      return NextResponse.json(
        { error: "Failed to create version snapshot", details: versionError.message },
        { status: 400 }
      );
    }

    // Update PCO status and increment current_version so the next submission
    // uses a new version number (prevents duplicate key on pco_versions unique index)
    const { data: updatedPco, error: updateError } = await supabase
      .from("potential_change_orders")
      .update({
        status: "SUBMITTED",
        submitted_at: now,
        current_version: version + 1,
        updated_at: now,
      })
      .eq("id", numericPcoId)
      .select()
      .single();

    if (updateError) {
      logger.error({ msg: "Failed to update PCO status:", data: updateError });
      return NextResponse.json(
        { error: "Failed to submit PCO", details: updateError.message },
        { status: 400 }
      );
    }

    // Write timeline event
    await supabase.from("timeline_events").insert({
      project_id: numericProjectId,
      parent_type: "PCO",
      parent_id: numericPcoId.toString(),
      event_type: "PCO_SUBMITTED",
      actor_id: user.id,
      summary: `PCO "${pco.title}" submitted to client (version ${version})`,
      metadata: { version },
      created_at: now,
    });

    return NextResponse.json({
      ...updatedPco,
      version,
      message: "PCO submitted successfully",
    });
    },
);
