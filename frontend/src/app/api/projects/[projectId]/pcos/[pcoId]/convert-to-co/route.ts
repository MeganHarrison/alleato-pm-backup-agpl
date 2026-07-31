/**
 * ============================================================================
 * CONVERT PCO TO OFFICIAL CHANGE ORDER
 * ============================================================================
 *
 * POST /api/projects/[projectId]/pcos/[pcoId]/convert-to-co
 *
 * Converts an approved PCO into an official Prime Contract Change Order.
 * Also auto-creates Commitment Change Orders for each subcontractor
 * referenced in the PCO line items.
 *
 * Fixes applied:
 *  - API-005: Queries `subcontracts` (not `prime_contracts`) to find
 *    commitments for each subcontractor.
 *  - API-014: Compensating rollback on partial failure; safe number parsing.
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
  "projects/[projectId]/pcos/[pcoId]/convert-to-co#POST",
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

    // Authenticate
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/pcos/[pcoId]/convert-to-co#POST", message: "Authentication required." });
    }

    // 1. Fetch the PCO and verify it exists
    const { data: pco, error: pcoError } = await supabase
      .from("potential_change_orders")
      .select("*")
      .eq("project_id", numericProjectId)
      .eq("id", numericPcoId)
      .single();

    if (pcoError || !pco) {
      return NextResponse.json(
        { error: "PCO not found" },
        { status: 404 }
      );
    }

    // Validate the PCO has status = 'APPROVED' (case-insensitive check)
    if (pco.status.toUpperCase() !== "APPROVED") {
      return NextResponse.json(
        {
          error: "PCO must be approved before converting to a Change Order",
          current_status: pco.status,
        },
        { status: 400 }
      );
    }

    // Check if PCO was already converted
    if (pco.prime_change_order_id) {
      return NextResponse.json(
        {
          error: "PCO has already been converted to a Change Order",
          prime_change_order_id: pco.prime_change_order_id,
        },
        { status: 400 }
      );
    }

    // 2. Fetch line items for this PCO
    const { data: lineItems } = await supabase
      .from("potential_change_order_line_items")
      .select("*")
      .eq("pco_id", numericPcoId)
      .order("sort_order", { ascending: true });

    // 3. Auto-generate next PCCO number (safe parsing — treat non-numeric as 0)
    const { data: existingCOs } = await supabase
      .from("prime_contract_change_orders")
      .select("pcco_number")
      .eq("project_id", numericProjectId)
      .order("id", { ascending: false })
      .limit(1);

    let nextPccoNumber = "001";
    if (existingCOs && existingCOs.length > 0 && existingCOs[0].pcco_number) {
      const parsed = Number(existingCOs[0].pcco_number);
      // Only increment when the existing number is a valid positive integer
      if (Number.isFinite(parsed) && parsed > 0) {
        nextPccoNumber = String(Math.floor(parsed) + 1).padStart(3, "0");
      }
    }

    // Calculate total amount from line items or use estimated_value.
    // potential_change_order_line_items exposes the generated `line_amount`.
    const totalAmount =
      lineItems && lineItems.length > 0
        ? lineItems.reduce(
            (sum, item) => sum + (item.line_amount || 0),
            0
          )
        : pco.estimated_value || 0;

    // 4. Create the Prime Contract Change Order
    const { data: primeCO, error: createError } = await supabase
      .from("prime_contract_change_orders")
      .insert({
        title: pco.title,
        description: pco.description,
        total_amount: totalAmount,
        status: "Draft",
        project_id: numericProjectId,
        schedule_impact: pco.schedule_impact_days,
        pcco_number: nextPccoNumber,
        created_by: user.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError || !primeCO) {
      logger.error({ msg: "Failed to create Prime CO:", data: createError });
      return NextResponse.json(
        {
          error: "Failed to create Change Order",
          details: createError?.message,
        },
        { status: 500 }
      );
    }

    // 5. Update the PCO with the new prime_change_order_id.
    // If this fails we roll back the Prime CO to keep the DB consistent.
    const { error: updatePcoError } = await supabase
      .from("potential_change_orders")
      .update({
        prime_change_order_id: primeCO.id,
        status: "CONVERTED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", numericPcoId);

    if (updatePcoError) {
      logger.error({ msg: "Failed to update PCO with CO link:", data: updatePcoError });
      // Compensating action: delete the orphaned Prime CO
      await supabase
        .from("prime_contract_change_orders")
        .delete()
        .eq("id", primeCO.id);
      return NextResponse.json(
        {
          error:
            "Conversion failed: could not link PCO to new Change Order. The Change Order was rolled back.",
          details: updatePcoError.message,
        },
        { status: 500 }
      );
    }

    // 6. Create Commitment Change Orders for each unique subcontractor
    //    FIX (API-005): Query `subcontracts` table — not `prime_contracts`.
    //    `pco_line_items.subcontractor_id` maps to `subcontracts.contract_company_id`.
    const commitmentCOs: Array<Record<string, unknown>> = [];
    const commitmentErrors: Array<{ subcontractorId: string; error: string }> =
      [];

    if (lineItems && lineItems.length > 0) {
      // pco_line_items no longer carries subcontractor_id directly; the
      // subcontractor is now resolved via the linked change_event_line_item.
      const celiIds = lineItems
        .map((li) => li.change_event_line_item_id)
        .filter((v): v is string => !!v);

      const vendorByCeliId = new Map<string, string | null>();
      if (celiIds.length > 0) {
        const { data: celiRows } = await supabase
          .from("change_event_line_items")
          .select("id, vendor_id")
          .in("id", celiIds);
        for (const row of celiRows ?? []) {
          vendorByCeliId.set(row.id, row.vendor_id ?? null);
        }
      }

      type PcoLineItem = (typeof lineItems)[0];
      const subcontractorGroups: Record<string, PcoLineItem[]> = {};

      for (const item of lineItems) {
        const subcontractorId = item.change_event_line_item_id
          ? vendorByCeliId.get(item.change_event_line_item_id) ?? null
          : null;
        if (subcontractorId) {
          if (!subcontractorGroups[subcontractorId]) {
            subcontractorGroups[subcontractorId] = [];
          }
          subcontractorGroups[subcontractorId].push(item);
        }
      }

      // Get the next commitment CO number — scoped to this project
      const { data: existingCommitmentCOs } = await supabase
        .from("contract_change_orders")
        .select("change_order_number, contract_id")
        .eq("prime_change_order_id", primeCO.id)
        .order("created_at", { ascending: false })
        .limit(1);

      // Fall back to a broader project-scoped query: find the highest number
      // across all commitment COs whose contract belongs to this project.
      let commitmentCoCounter = 1;

      // We query subcontracts for the project first, then find their COs
      const { data: projectSubcontracts } = await supabase
        .from("subcontracts")
        .select("id")
        .eq("project_id", numericProjectId)
        .is("deleted_at", null);

      if (projectSubcontracts && projectSubcontracts.length > 0) {
        const subcontractIds = projectSubcontracts.map((s) => s.id);
        const { data: latestCO } = await supabase
          .from("contract_change_orders")
          .select("change_order_number")
          .in("contract_id", subcontractIds)
          .order("created_at", { ascending: false })
          .limit(1);

        if (latestCO && latestCO.length > 0 && latestCO[0].change_order_number) {
          const parsed = Number(latestCO[0].change_order_number);
          if (Number.isFinite(parsed) && parsed > 0) {
            commitmentCoCounter = Math.floor(parsed) + 1;
          }
        }
      }

      // Also check the initial simple query result
      if (
        existingCommitmentCOs &&
        existingCommitmentCOs.length > 0 &&
        existingCommitmentCOs[0].change_order_number
      ) {
        const parsed = Number(existingCommitmentCOs[0].change_order_number);
        if (Number.isFinite(parsed) && parsed >= commitmentCoCounter) {
          commitmentCoCounter = Math.floor(parsed) + 1;
        }
      }

      for (const [subcontractorId, items] of Object.entries(
        subcontractorGroups
      )) {
        // FIX (API-005): Look up the subcontractor's commitment in `subcontracts`,
        // matching on `contract_company_id` (the vendor/company assigned to the
        // subcontract) instead of the old incorrect `prime_contracts` query.
        const { data: commitments } = await supabase
          .from("subcontracts")
          .select("id, contract_number, title")
          .eq("project_id", numericProjectId)
          .eq("contract_company_id", subcontractorId)
          .is("deleted_at", null);

        if (!commitments || commitments.length === 0) {
          logger.warn({ msg: `No subcontract found for subcontractor ${subcontractorId} on project ${numericProjectId}, skipping commitment CO` });
          commitmentErrors.push({
            subcontractorId,
            error: "No subcontract found for this subcontractor on the project",
          });
          continue;
        }

        const subAmount = items.reduce(
          (sum, item) => sum + (item.line_amount || 0),
          0
        );

        // Create a commitment CO for each matching subcontract
        // (usually one, but a vendor may hold multiple commitments)
        for (const commitment of commitments) {
          const coNumber = String(commitmentCoCounter).padStart(3, "0");
          commitmentCoCounter++;

          const { data: commitmentCO, error: commitmentError } = await supabase
            .from("contract_change_orders")
            .insert({
              contract_id: commitment.id,
              change_order_number: coNumber,
              description: `Commitment CO from PCO #${pco.number}`,
              amount: subAmount,
              status: "Draft",
              prime_change_order_id: primeCO.id,
              parallel_mode: false,
              requested_date: new Date().toISOString(),
            })
            .select()
            .single();

          if (commitmentError) {
            logger.error({ msg: `Failed to create commitment CO for subcontractor ${subcontractorId} (subcontract ${commitment.id}):`, error: commitmentError.message });
            commitmentErrors.push({
              subcontractorId,
              error: commitmentError.message,
            });
          } else if (commitmentCO) {
            commitmentCOs.push(commitmentCO);
          }
        }
      }
    }

    // 7. Write timeline events
    const now = new Date().toISOString();

    // Timeline event on the PCO
    await supabase.from("timeline_events").insert({
      project_id: numericProjectId,
      parent_type: "PCO",
      parent_id: numericPcoId.toString(),
      event_type: "CO_CREATED",
      actor_id: user.id,
      summary: "Official Change Order created from this PCO",
      metadata: { prime_change_order_id: primeCO.id },
      created_at: now,
    });

    // Timeline event on the new Prime CO
    await supabase.from("timeline_events").insert({
      project_id: numericProjectId,
      parent_type: "PRIME_CO",
      parent_id: primeCO.id.toString(),
      event_type: "CREATED",
      actor_id: user.id,
      summary: `Created from approved PCO #${pco.number}`,
      metadata: { pco_id: numericPcoId, pco_number: pco.number },
      created_at: now,
    });

    // 8. Return the created prime CO with commitment COs
    return NextResponse.json({
      ...primeCO,
      commitmentChangeOrders: commitmentCOs,
      // Surface any partial failures so the caller knows which subs were skipped
      ...(commitmentErrors.length > 0
        ? { commitmentErrors }
        : {}),
      _links: {
        self: `/api/projects/${projectId}/change-orders/prime/${primeCO.id}`,
        pco: `/api/projects/${projectId}/pcos/${pcoId}`,
      },
    });
    },
);
