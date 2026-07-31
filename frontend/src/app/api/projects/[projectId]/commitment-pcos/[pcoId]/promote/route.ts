import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { mapCommitmentPcoLineItemToCoLine } from "@/lib/change-events/commitment-pco-promotion-line-items";

interface RouteParams {
  params: Promise<{ projectId: string; pcoId: string }>;
}

/**
 * POST /api/projects/[projectId]/commitment-pcos/[pcoId]/promote
 * Promote a commitment PCO to an official Commitment Change Order (CCO)
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/commitment-pcos/[pcoId]/promote#POST",
  async ({ request, params }) => {
  
    const { projectId, pcoId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const supabase = await createClient();

    // Auth check
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/commitment-pcos/[pcoId]/promote#POST", message: "Authentication required." });
    }

    // Get the PCO
    const { data: pco, error: fetchError } = await supabase
      .from("commitment_pcos")
      .select("*")
      .eq("project_id", projectIdNum)
      .eq("id", pcoId)
      .single();

    if (fetchError || !pco) {
      return NextResponse.json(
        { error: "Commitment PCO not found" },
        { status: 404 },
      );
    }

    // Only allow promote from pending or approved
    if (pco.status !== "pending" && pco.status !== "approved") {
      return NextResponse.json(
        {
          error: "Cannot promote PCO",
          details:
            "Only PCOs with status 'pending' or 'approved' can be promoted to a change order",
        },
        { status: 409 },
      );
    }

    // Check not already promoted
    if (pco.promoted_to_co_id) {
      return NextResponse.json(
        {
          error: "PCO already promoted",
          details: `This PCO has already been promoted to change order ${pco.promoted_to_co_id}`,
        },
        { status: 409 },
      );
    }

    const { count: linkedChangeEventCount, error: linkedChangeEventError } =
      await supabase
        .from("change_event_pco_links")
        .select("id", { count: "exact", head: true })
        .eq("pco_id", pcoId)
        .eq("pco_type", "commitment");

    if (linkedChangeEventError) {
      return apiErrorResponse(linkedChangeEventError);
    }

    if (!linkedChangeEventCount) {
      return NextResponse.json(
        {
          error: "Change Event required",
          details:
            "A PCO must be linked to at least one change event before it can be promoted to an official change order.",
        },
        { status: 409 },
      );
    }

    // Generate a change order number
    // Count existing CCOs for this commitment to build the number
    const { count } = await supabase
      .from("contract_change_orders")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", pco.commitment_id);

    const coNumber = `CCO-${String((count || 0) + 1).padStart(3, "0")}`;

    const now = new Date().toISOString();

    // Create the contract change order
    const { data: newCo, error: coError } = await supabase
      .from("contract_change_orders")
      .insert({
        contract_id: pco.commitment_id,
        contract_type: pco.commitment_type,
        change_order_number: coNumber,
        title: pco.title,
        description: pco.description || "",
        amount: pco.total_amount || 0,
        status: "draft",
        schedule_impact: pco.schedule_impact,
        due_date: pco.due_date,
        designated_reviewer: pco.designated_reviewer_id,
        requested_date: now,
        created_by: user.id,
        updated_at: now,
      })
      .select("*")
      .single();

    if (coError) {
      logger.error({ msg: "[commitment-pcos promote] CO creation error", error: coError.message });
      return apiErrorResponse(coError);
    }

    const { data: pcoLineItems, error: lineItemsError } = await supabase
      .from("pco_line_items")
      .select("budget_code_id, description, amount")
      .eq("pco_id", pcoId)
      .eq("pco_type", "commitment")
      .order("sort_order", { ascending: true });

    if (lineItemsError) {
      await supabase.from("contract_change_orders").delete().eq("id", newCo.id);
      return apiErrorResponse(lineItemsError);
    }

    if (pcoLineItems && pcoLineItems.length > 0) {
      const { error: lineInsertError } = await supabase
        .from("commitment_change_order_lines")
        .insert(
          pcoLineItems.map((item) =>
            mapCommitmentPcoLineItemToCoLine(newCo.id, item),
          ),
        );

      if (lineInsertError) {
        logger.error({
          msg: "[commitment-pcos promote] CO line item copy error, rolling back CO",
          error: lineInsertError.message,
        });
        await supabase.from("contract_change_orders").delete().eq("id", newCo.id);
        return apiErrorResponse(lineInsertError);
      }
    }

    // Update the PCO with promotion info
    const { data: updatedPco, error: updateError } = await supabase
      .from("commitment_pcos")
      .update({
        promoted_to_co_id: newCo.id,
        promoted_at: now,
        status: "approved",
        approved_at: pco.approved_at || now,
        approved_by: pco.approved_by || user.id,
        updated_at: now,
        updated_by: user.id,
      })
      .eq("id", pcoId)
      .select("*")
      .single();

    if (updateError) {
      logger.error({ msg: "[commitment-pcos promote] PCO update error, rolling back CO", error: updateError.message });
      // Rollback: delete the created CO
      await supabase.from("contract_change_orders").delete().eq("id", newCo.id);
      return apiErrorResponse(updateError);
    }

    return NextResponse.json({
      pco: updatedPco,
      change_order: newCo,
      message: `PCO successfully promoted to Change Order #${coNumber}`,
    });
    },
);
