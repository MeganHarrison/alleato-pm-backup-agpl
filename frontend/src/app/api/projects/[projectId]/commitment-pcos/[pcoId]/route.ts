import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { logger } from "@/lib/logger";

const updateCommitmentPcoSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullish(),
  status: z.enum(["draft", "pending", "approved", "void"]).optional(),
  schedule_impact: z.number().int().nullish(),
  due_date: z.string().nullish(),
  designated_reviewer_id: z.string().uuid().nullish(),
});

/**
 * GET /api/projects/[projectId]/commitment-pcos/[pcoId]
 * Get a single commitment PCO with full details
 */
export const GET = withApiGuardrails<{ projectId: string; pcoId: string }>(
  "projects/[projectId]/commitment-pcos/[pcoId]#GET",
  async ({ request, params }) => {

    const { projectId, pcoId } = await params;
    assertNonNilUuid(pcoId, "pcoId", "projects/[projectId]/commitment-pcos/[pcoId]#GET");
    const projectIdNum = parseInt(projectId, 10);
    const supabase = await createClient();

    // Auth check
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/commitment-pcos/[pcoId]#GET", message: "Authentication required." });
    }

    // Get the PCO
    const { data: pco, error } = await supabase
      .from("commitment_pcos")
      .select("*")
      .eq("project_id", projectIdNum)
      .eq("id", pcoId)
      .single();

    if (error || !pco) {
      return NextResponse.json(
        { error: "Commitment PCO not found" },
        { status: 404 },
      );
    }

    // Get commitment info
    let commitment = null;
    if (pco.commitment_type === "subcontract") {
      const { data } = await supabase
        .from("subcontracts")
        .select("id, contract_number, title, vendor:companies!subcontracts_vendor_id_fkey(id, name)")
        .eq("id", pco.commitment_id)
        .maybeSingle();
      commitment = data;
    } else if (pco.commitment_type === "purchase_order") {
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, contract_number, title, vendor:companies!purchase_orders_vendor_id_fkey(id, name)")
        .eq("id", pco.commitment_id)
        .maybeSingle();
      commitment = data;
    }

    // Get linked change events
    const { data: links } = await supabase
      .from("change_event_pco_links")
      .select("change_event_id, linked_at, linked_by")
      .eq("pco_id", pcoId)
      .eq("pco_type", "commitment");

    let linkedChangeEvents: Array<Record<string, unknown>> = [];
    if (links && links.length > 0) {
      const ceIds = links.map((l) => l.change_event_id);
      // total_revenue_rom / total_cost_rom live on the change_events_summary
      // view, so we fetch base fields from change_events and aggregates from
      // the view, then merge by id.
      const [{ data: ces }, { data: ceTotals }] = await Promise.all([
        supabase
          .from("change_events")
          .select("id, number, title, status, type")
          .in("id", ceIds)
          .is("deleted_at", null),
        supabase
          .from("change_events_summary")
          .select("id, total_revenue_rom, total_cost_rom")
          .in("id", ceIds),
      ]);
      const totalsById = new Map(
        (ceTotals ?? []).map((row) => [row.id, row]),
      );

      linkedChangeEvents = (ces || []).map((ce) => {
        const link = links.find((l) => l.change_event_id === ce.id);
        const totals = totalsById.get(ce.id);
        return {
          ...ce,
          total_revenue_rom: totals?.total_revenue_rom ?? null,
          total_cost_rom: totals?.total_cost_rom ?? null,
          linked_at: link?.linked_at,
          linked_by: link?.linked_by,
        };
      });
    }

    // Get promoted CO info if applicable
    let promotedCo = null;
    if (pco.promoted_to_co_id) {
      const { data } = await supabase
        .from("contract_change_orders")
        .select("id, change_order_number, title, status, amount")
        .eq("id", pco.promoted_to_co_id)
        .maybeSingle();
      promotedCo = data;
    }

    return NextResponse.json({
      ...pco,
      commitment,
      linked_change_events: linkedChangeEvents,
      promoted_co: promotedCo,
    });
    },
);

/**
 * PATCH /api/projects/[projectId]/commitment-pcos/[pcoId]
 * Update a commitment PCO (only draft or pending)
 */
export const PATCH = withApiGuardrails<{ projectId: string; pcoId: string }>(
  "projects/[projectId]/commitment-pcos/[pcoId]#PATCH",
  async ({ request, params }) => {

    const { projectId, pcoId } = await params;
    assertNonNilUuid(pcoId, "pcoId", "projects/[projectId]/commitment-pcos/[pcoId]#PATCH");
    const projectIdNum = parseInt(projectId, 10);
    const supabase = await createClient();

    // Auth check
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/commitment-pcos/[pcoId]#PATCH", message: "Authentication required." });
    }

    // Get existing PCO
    const { data: existing, error: fetchError } = await supabase
      .from("commitment_pcos")
      .select("id, status")
      .eq("project_id", projectIdNum)
      .eq("id", pcoId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Commitment PCO not found" },
        { status: 404 },
      );
    }

    // Only allow updates on draft or pending
    if (existing.status !== "draft" && existing.status !== "pending") {
      return NextResponse.json(
        {
          error: "Cannot update PCO",
          details: "Only PCOs with status 'draft' or 'pending' can be updated",
        },
        { status: 409 },
      );
    }

    const body = await request.json();
    const validatedData = updateCommitmentPcoSchema.parse(body);

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    if (validatedData.title !== undefined) updates.title = validatedData.title;
    if (validatedData.description !== undefined)
      updates.description = validatedData.description;
    if (validatedData.status !== undefined) updates.status = validatedData.status;
    if (validatedData.schedule_impact !== undefined)
      updates.schedule_impact = validatedData.schedule_impact;
    if (validatedData.due_date !== undefined)
      updates.due_date = validatedData.due_date;
    if (validatedData.designated_reviewer_id !== undefined)
      updates.designated_reviewer_id = validatedData.designated_reviewer_id;
    // Handle approval. The guard above narrows existing.status to "draft" |
    // "pending", so if the update moves it to "approved" we always record
    // approver info.
    const nextStatus = validatedData.status;
    if (nextStatus && nextStatus === "approved") {
      updates.approved_at = new Date().toISOString();
      updates.approved_by = user.id;
    }

    const { data, error } = await supabase
      .from("commitment_pcos")
      .update(updates)
      .eq("id", pcoId)
      .select("*")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data);
    },
);

/**
 * DELETE /api/projects/[projectId]/commitment-pcos/[pcoId]
 * Delete a commitment PCO (only draft status)
 */
export const DELETE = withApiGuardrails<{ projectId: string; pcoId: string }>(
  "projects/[projectId]/commitment-pcos/[pcoId]#DELETE",
  async ({ request, params }) => {

    const { projectId, pcoId } = await params;
    assertNonNilUuid(pcoId, "pcoId", "projects/[projectId]/commitment-pcos/[pcoId]#DELETE");
    const projectIdNum = parseInt(projectId, 10);
    const supabase = await createClient();

    // Auth check
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/commitment-pcos/[pcoId]#DELETE", message: "Authentication required." });
    }

    // Get existing PCO
    const { data: existing, error: fetchError } = await supabase
      .from("commitment_pcos")
      .select("id, status")
      .eq("project_id", projectIdNum)
      .eq("id", pcoId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Commitment PCO not found" },
        { status: 404 },
      );
    }

    // Only allow delete on draft
    if (existing.status !== "draft") {
      return NextResponse.json(
        {
          error: "Cannot delete PCO",
          details: "Only PCOs with status 'draft' can be deleted",
        },
        { status: 409 },
      );
    }

    // Delete linked change event associations first
    const { error: linkDeleteError } = await supabase
      .from("change_event_pco_links")
      .delete()
      .eq("pco_id", pcoId)
      .eq("pco_type", "commitment");

    if (linkDeleteError) {
      logger.error({ msg: "[commitment-pcos DELETE] Failed to delete links", error: linkDeleteError.message });
      return apiErrorResponse(linkDeleteError);
    }

    // Delete line items
    const { error: lineItemDeleteError } = await supabase
      .from("pco_line_items")
      .delete()
      .eq("pco_id", pcoId)
      .eq("pco_type", "commitment");

    if (lineItemDeleteError) {
      logger.error({ msg: "[commitment-pcos DELETE] Failed to delete line items", error: lineItemDeleteError.message });
      return apiErrorResponse(lineItemDeleteError);
    }

    // Delete the PCO
    const { error } = await supabase
      .from("commitment_pcos")
      .delete()
      .eq("id", pcoId);

    if (error) {
      return apiErrorResponse(error);
    }

    return new NextResponse(null, { status: 204 });
    },
);
