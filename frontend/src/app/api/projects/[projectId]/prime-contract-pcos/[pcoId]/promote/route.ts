/**
 * ============================================================================
 * PROMOTE PCO → PCCO (Prime Contract Change Order)
 * ============================================================================
 *
 * POST /api/projects/[projectId]/prime-contract-pcos/[pcoId]/promote
 *
 * Promotes a Prime Contract PCO to an official Prime Contract Change Order.
 * - Creates a prime_contract_change_orders row from the PCO data
 * - Sets promoted_to_co_id and promoted_at on the PCO
 * - Changes PCO status to 'approved'
 * - Only allowed if PCO status is 'pending' or 'approved'
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { mapPrimePcoLineItemToPccoLineItem } from "@/lib/change-events/pco-promotion-line-items";
import { resolvePromotedPccoTotalAmount } from "@/lib/prime-contract-pcos/promote-total";

export const POST = withApiGuardrails<{ projectId: string; pcoId: string }>(
  "projects/[projectId]/prime-contract-pcos/[pcoId]/promote#POST",
  async ({ request, params }) => {
  
    const { projectId, pcoId } = await params;
    const supabase = await createClient();

    // Auth check
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-pcos/[pcoId]/promote#POST", message: "Authentication required." });
    }

    const projectIdNum = parseInt(projectId, 10);

    // Get existing PCO with line items total
    const { data: pco, error: fetchError } = await supabase
      .from("prime_contract_pcos")
      .select("*")
      .eq("project_id", projectIdNum)
      .eq("id", pcoId)
      .single();

    if (fetchError || !pco) {
      return NextResponse.json(
        { error: "Prime contract PCO not found" },
        { status: 404 },
      );
    }

    // Validate status — only pending or approved can be promoted
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

    // Check if already promoted
    if (pco.promoted_to_co_id) {
      return NextResponse.json(
        {
          error: "PCO already promoted",
          details: `This PCO has already been promoted to change order #${pco.promoted_to_co_id}`,
        },
        { status: 409 },
      );
    }

    const { count: linkedChangeEventCount, error: linkedChangeEventError } =
      await supabase
        .from("change_event_pco_links")
        .select("id", { count: "exact", head: true })
        .eq("pco_id", pcoId)
        .eq("pco_type", "prime");

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

    // Resolve the PCCO total. The PCO's persisted total (prime_contract_pcos.total_amount)
    // already includes the prime contract's financial markup and is what the detail page
    // and the promote confirmation dialog show. Re-summing base line-item amounts here would
    // silently drop the markup, understating the owner-facing change order.
    const { data: lineItems } = await supabase
      .from("pco_line_items")
      .select("amount")
      .eq("pco_id", pcoId)
      .eq("pco_type", "prime");

    const totalAmount = resolvePromotedPccoTotalAmount(pco, lineItems);

    // Generate PCCO number — count existing PCCOs for the contract + 1
    const { data: existingPccos } = await supabase
      .from("prime_contract_change_orders")
      .select("id")
      .eq("prime_contract_id", pco.prime_contract_id);

    const nextPccoNumber = ((existingPccos || []).length + 1)
      .toString()
      .padStart(3, "0");

    const now = new Date().toISOString();

    // Create the PCCO (Prime Contract Change Order)
    const { data: pcco, error: pccoError } = await supabase
      .from("prime_contract_change_orders")
      .insert({
        project_id: projectIdNum,
        prime_contract_id: pco.prime_contract_id,
        pcco_number: nextPccoNumber,
        title: pco.title,
        description: pco.description,
        status: "draft",
        schedule_impact: pco.schedule_impact,
        due_date: pco.due_date,
        designated_reviewer: pco.designated_reviewer_id,
        total_amount: totalAmount,
        // A promoted PCCO starts as a draft; approval (and approved_at) is owned by the
        // dedicated approve route. Stamping approved_at here left draft rows looking approved.
        created_at: now,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (pccoError) {
      logger.error({ msg: "[POST /promote] Failed to create PCCO:", data: pccoError });
      return apiErrorResponse(pccoError);
    }

    // Copy line items from PCO to PCCO
    if (lineItems && lineItems.length > 0) {
      const { data: fullLineItems } = await supabase
        .from("pco_line_items")
        .select("*")
        .eq("pco_id", pcoId)
        .eq("pco_type", "prime");

      if (fullLineItems && fullLineItems.length > 0) {
        const pccoLineItems = fullLineItems.map((item) =>
          mapPrimePcoLineItemToPccoLineItem(pcco.id, item),
        );

        const { error: lineItemCopyError } = await supabase
          .from("pcco_line_items")
          .insert(pccoLineItems);

        if (lineItemCopyError) {
          logger.error({ msg: "[POST /promote] Failed to copy line items:", data: lineItemCopyError });
          await supabase.from("pcco_line_items").delete().eq("pcco_id", pcco.id);
          await supabase.from("prime_contract_change_orders").delete().eq("id", pcco.id);

          const rollbackPatch = {
            promoted_to_co_id: null,
            promoted_at: null,
            updated_at: now,
            updated_by: user.id,
          } as Record<string, unknown>;

          if (pco.status === "pending") {
            rollbackPatch.status = "pending";
            rollbackPatch.approved_at = null;
            rollbackPatch.approved_by = null;
          }

          const { error: rollbackError } = await supabase
            .from("prime_contract_pcos")
            .update(rollbackPatch)
            .eq("id", pcoId);

          if (rollbackError) {
            logger.error({
              msg: "[POST /promote] Failed to rollback PCO after line-item copy failure:",
              data: rollbackError,
            });
          }

          return NextResponse.json(
            {
              error: "PCO promotion failed",
              details:
                "Line item copy failed while creating the change order. No promotion was applied.",
            },
            { status: 500 },
          );
        }
      }
    }

    // Update the PCO with promotion reference only after all child rows copied.
    const { error: updateError } = await supabase
      .from("prime_contract_pcos")
      .update({
        status: "approved",
        promoted_to_co_id: pcco.id,
        promoted_at: now,
        approved_at: now,
        approved_by: user.id,
        updated_at: now,
        updated_by: user.id,
      })
      .eq("id", pcoId);

    if (updateError) {
      logger.error({ msg: "[POST /promote] Failed to update PCO:", data: updateError });
      await supabase
        .from("pcco_line_items")
        .delete()
        .eq("pcco_id", pcco.id);
      await supabase
        .from("prime_contract_change_orders")
        .delete()
        .eq("id", pcco.id);
      return apiErrorResponse(updateError);
    }

    return NextResponse.json(
      {
        pco_id: pcoId,
        pcco_id: pcco.id,
        pcco_number: pcco.pcco_number,
        message: `PCO successfully promoted to Change Order #${pcco.pcco_number}`,
      },
      { status: 201 },
    );
    },
);
