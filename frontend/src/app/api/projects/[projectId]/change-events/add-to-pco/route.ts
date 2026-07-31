/**
 * POST /api/projects/[projectId]/change-events/add-to-pco
 *
 * Routes selected change events to a PCO (Potential Change Order).
 * Supports both creating a NEW PCO and adding to an EXISTING PCO.
 * Handles both prime contract PCOs (revenue side) and commitment PCOs (cost side).
 *
 * Uses the two-tier tables: prime_contract_pcos / commitment_pcos,
 * pco_line_items, and change_event_pco_links.
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { z } from "zod";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// --- Zod validation ---

const createNewSchema = z.object({
  title: z.string().min(1, "Title is required"),
  prime_contract_id: z.string().uuid().optional(),
  commitment_id: z.string().uuid().optional(),
  commitment_type: z.enum(["subcontract", "purchase_order"]).optional(),
  description: z.string().optional().nullable(),
  // Extended prime PCO fields
  status: z.enum(["draft", "pending", "approved", "void"]).optional(),
  change_reason: z.string().optional().nullable(),
  revision: z.number().int().optional().nullable(),
  is_private: z.boolean().optional(),
  executed: z.boolean().optional(),
  signed_co_received_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  request_received_from: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  field_change: z.boolean().optional(),
  reference: z.string().optional().nullable(),
  paid_in_full: z.boolean().optional(),
  promoted_to_co_id: z.number().int().optional().nullable(),
  schedule_impact: z.number().int().optional().nullable(),
});

const bodySchema = z
  .object({
    change_event_ids: z.array(z.string().uuid()).min(1, "At least one change event is required"),
    pco_type: z.enum(["prime", "commitment"]),
    create_new: createNewSchema.optional(),
    existing_pco_id: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      const hasNew = !!data.create_new;
      const hasExisting = !!data.existing_pco_id;
      return (hasNew && !hasExisting) || (!hasNew && hasExisting);
    },
    { message: "Provide either create_new or existing_pco_id, not both and not neither" },
  )
  .refine(
    (data) => {
      if (data.pco_type === "prime" && data.create_new) {
        return !!data.create_new.prime_contract_id;
      }
      return true;
    },
    { message: "prime_contract_id is required when creating a new prime PCO" },
  )
  .refine(
    (data) => {
      if (data.pco_type === "commitment" && data.create_new) {
        return !!data.create_new.commitment_id && !!data.create_new.commitment_type;
      }
      return true;
    },
    { message: "commitment_id and commitment_type are required when creating a new commitment PCO" },
  );

export const POST = withApiGuardrails(
  "projects/[projectId]/change-events/add-to-pco#POST",
  async ({ request, params }) => {
  
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);
    if (Number.isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();

    // Auth
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/add-to-pco#POST", message: "Authentication required." });
    }

    // Parse & validate body
    const rawBody = await request.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { change_event_ids, pco_type, create_new, existing_pco_id } = parsed.data;

    // Fetch selected change events with their line items
    const { data: changeEvents, error: fetchError } = await supabase
      .from("change_events")
      .select("id, number, title, description, sent_to_prime_pco, sent_to_commitment_pco, change_event_line_items(*)")
      .in("id", change_event_ids)
      .eq("project_id", projectId)
      .is("deleted_at", null);

    if (fetchError) {
      return apiErrorResponse(fetchError);
    }

    if (!changeEvents || changeEvents.length === 0) {
      return NextResponse.json(
        { error: "No matching change events found" },
        { status: 404 },
      );
    }

    // Check that we found all requested CEs
    const foundIds = new Set(changeEvents.map((ce) => ce.id));
    const missingIds = change_event_ids.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: `Change events not found: ${missingIds.join(", ")}` },
        { status: 404 },
      );
    }

    let pcoId: string;
    let pcoRecord: Record<string, unknown>;

    // ── Create NEW PCO or verify EXISTING PCO ───────────────────────────

    if (create_new) {
      // Generate PCO number via RPC
      const { data: pcoNumber, error: rpcError } = await supabase.rpc("generate_pco_number", {
        p_project_id: projectId,
        p_type: pco_type,
      });

      if (rpcError) {
        logger.error({ msg: "[add-to-pco] generate_pco_number RPC error:", data: rpcError });
        return NextResponse.json(
          { error: "Failed to generate PCO number", details: rpcError.message },
          { status: 500 },
        );
      }

      if (pco_type === "prime") {
        const { data: pco, error: insertError } = await supabase
          .from("prime_contract_pcos")
          .insert({
            project_id: projectId,
            prime_contract_id: create_new.prime_contract_id!,
            pco_number: pcoNumber,
            title: create_new.title,
            description: create_new.description ?? null,
            status: create_new.status ?? "draft",
            change_reason: create_new.change_reason ?? null,
            revision: create_new.revision ?? null,
            is_private: create_new.is_private ?? false,
            executed: create_new.executed ?? false,
            signed_co_received_date: create_new.signed_co_received_date ?? null,
            due_date: create_new.due_date ?? null,
            request_received_from: create_new.request_received_from ?? null,
            location: create_new.location ?? null,
            schedule_impact: create_new.schedule_impact ?? null,
            field_change: create_new.field_change ?? false,
            reference: create_new.reference ?? null,
            paid_in_full: create_new.paid_in_full ?? false,
            promoted_to_co_id: create_new.promoted_to_co_id ?? null,
            created_by: user.id,
          })
          .select()
          .single();

        if (insertError || !pco) {
          logger.error({ msg: "[add-to-pco] prime_contract_pcos insert error:", data: insertError });
          return NextResponse.json(
            { error: "Failed to create prime PCO", details: insertError?.message },
            { status: 500 },
          );
        }

        pcoId = pco.id;
        pcoRecord = pco;
      } else {
        // commitment
        const { data: pco, error: insertError } = await supabase
          .from("commitment_pcos")
          .insert({
            project_id: projectId,
            commitment_id: create_new.commitment_id!,
            commitment_type: create_new.commitment_type!,
            pco_number: pcoNumber,
            title: create_new.title,
            description: create_new.description ?? null,
            status: "draft",
            created_by: user.id,
          })
          .select()
          .single();

        if (insertError || !pco) {
          logger.error({ msg: "[add-to-pco] commitment_pcos insert error:", data: insertError });
          return NextResponse.json(
            { error: "Failed to create commitment PCO", details: insertError?.message },
            { status: 500 },
          );
        }

        pcoId = pco.id;
        pcoRecord = pco;
      }
    } else {
      // Verify the existing PCO exists and is in an editable status
      const table = pco_type === "prime" ? "prime_contract_pcos" : "commitment_pcos";

      const { data: existingPco, error: pcoErr } = await supabase
        .from(table)
        .select("*")
        .eq("id", existing_pco_id!)
        .eq("project_id", projectId)
        .single();

      if (pcoErr || !existingPco) {
        return NextResponse.json(
          { error: "PCO not found or does not belong to this project" },
          { status: 404 },
        );
      }

      const editableStatuses = ["draft", "pending"];
      if (!editableStatuses.includes(existingPco.status)) {
        return NextResponse.json(
          { error: `PCO is in '${existingPco.status}' status and cannot be modified. Only draft or pending PCOs can accept new change events.` },
          { status: 400 },
        );
      }

      pcoId = existingPco.id;
      pcoRecord = existingPco;
    }

    // ── Process each change event ───────────────────────────────────────

    const linkResults: { change_event_id: string; line_items_created: number }[] = [];
    const errors: string[] = [];

    // Track sort order for PCO line items (start after existing items if adding to existing PCO)
    let sortOrder = 0;
    if (existing_pco_id) {
      const { count } = await supabase
        .from("pco_line_items")
        .select("id", { count: "exact", head: true })
        .eq("pco_id", pcoId)
        .eq("pco_type", pco_type);
      sortOrder = count ?? 0;
    }

    for (const event of changeEvents) {
      // 1. Create the change_event_pco_links row
      const { error: linkError } = await supabase
        .from("change_event_pco_links")
        .insert({
          change_event_id: event.id,
          pco_id: pcoId,
          pco_type: pco_type,
          linked_by: user.id,
        });

      if (linkError) {
        // Duplicate link (unique constraint) — skip gracefully
        if (linkError.message?.includes("duplicate") || linkError.message?.includes("unique")) {
          errors.push(`CE ${event.number ?? event.id} is already linked to this PCO`);
          continue;
        }
        errors.push(`Failed to link CE ${event.number ?? event.id}: ${linkError.message}`);
        continue;
      }

      // 2. Fetch line items for this change event
      const lineItems = (event as Record<string, unknown>).change_event_line_items as Array<{
        id: string;
        budget_code_id: string | null;
        description: string | null;
        quantity: number | null;
        unit_of_measure: string | null;
        unit_cost: number | null;
        cost_rom: number | null;
        revenue_rom: number | null;
      }> ?? [];

      // 3. Create pco_line_items for each CE line item
      const pcoLineItemsToInsert = lineItems.map((li) => {
        // Prime PCO uses revenue_rom (Latest Price); Commitment PCO uses cost_rom (Latest Cost)
        const amount = pco_type === "prime"
          ? (li.revenue_rom ?? li.cost_rom ?? 0)
          : (li.cost_rom ?? li.revenue_rom ?? 0);

        sortOrder += 1;
        return {
          pco_id: pcoId,
          pco_type: pco_type,
          change_event_id: event.id,
          change_event_line_item_id: li.id,
          budget_code_id: li.budget_code_id,
          description: li.description,
          quantity: li.quantity,
          unit_of_measure: li.unit_of_measure,
          unit_cost: li.unit_cost,
          amount: amount,
          sort_order: sortOrder,
        };
      });

      if (pcoLineItemsToInsert.length > 0) {
        const { error: lineItemError } = await supabase
          .from("pco_line_items")
          .insert(pcoLineItemsToInsert);

        if (lineItemError) {
          errors.push(`Failed to create line items for CE ${event.number ?? event.id}: ${lineItemError.message}`);
          // Still count the link as created even if line items failed
        }
      }

      // 4. Update change event tracking columns
      const trackingUpdate =
        pco_type === "prime"
          ? { sent_to_prime_pco: true }
          : { sent_to_commitment_pco: true };

      const { error: updateError } = await supabase
        .from("change_events")
        .update(trackingUpdate)
        .eq("id", event.id);

      if (updateError) {
        logger.error({ msg: `[add-to-pco] Failed to update tracking for CE ${event.id}:`, data: updateError });
      }

      linkResults.push({
        change_event_id: event.id,
        line_items_created: pcoLineItemsToInsert.length,
      });
    }

    if (linkResults.length === 0) {
      return NextResponse.json(
        { error: "Failed to link any change events to the PCO", details: errors },
        { status: 500 },
      );
    }

    // ── Recalculate and update PCO total_amount ─────────────────────────

    const { data: allLineItems } = await supabase
      .from("pco_line_items")
      .select("amount")
      .eq("pco_id", pcoId)
      .eq("pco_type", pco_type);

    const lineItemsBaseAmount = (allLineItems ?? []).reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    );

    let totalAmount = lineItemsBaseAmount;
    if (pco_type === "prime") {
      const { data: markupRows, error: markupError } = await supabase
        .from("vertical_markup")
        .select("percentage, compound, calculation_order")
        .eq("project_id", projectId)
        .order("calculation_order", { ascending: true });

      if (markupError) {
        logger.error({ msg: "[add-to-pco] Failed to fetch vertical markup rows:", data: markupError });
      } else if (markupRows && markupRows.length > 0) {
        let runningBase = lineItemsBaseAmount;
        let markupTotal = 0;
        for (const markup of markupRows) {
          const markupAmount = runningBase * (Number(markup.percentage) / 100);
          markupTotal += markupAmount;
          if (markup.compound) {
            runningBase += markupAmount;
          }
        }
        totalAmount += markupTotal;
      }
    }

    const pcoTable = pco_type === "prime" ? "prime_contract_pcos" : "commitment_pcos";
    const { error: totalUpdateError } = await supabase
      .from(pcoTable)
      .update({ total_amount: totalAmount, updated_by: user.id })
      .eq("id", pcoId);

    if (totalUpdateError) {
      logger.error({ msg: "[add-to-pco] Failed to update PCO total_amount:", data: totalUpdateError });
    }

    // ── Fetch the final PCO with its line items to return ───────────────

    const { data: finalPco } = await supabase
      .from(pcoTable)
      .select("*")
      .eq("id", pcoId)
      .single();

    const { data: finalLineItems } = await supabase
      .from("pco_line_items")
      .select("*")
      .eq("pco_id", pcoId)
      .eq("pco_type", pco_type)
      .order("sort_order", { ascending: true });

    return NextResponse.json(
      {
        pco: finalPco ?? pcoRecord,
        line_items: finalLineItems ?? [],
        linked_change_events: linkResults,
        total_amount: totalAmount,
        ...(errors.length > 0 ? { warnings: errors } : {}),
      },
      { status: create_new ? 201 : 200 },
    );
    },
);
