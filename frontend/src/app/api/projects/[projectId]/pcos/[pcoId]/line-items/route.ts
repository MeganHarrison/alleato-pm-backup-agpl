/**
 * ============================================================================
 * PCO LINE ITEMS API ROUTE
 * ============================================================================
 *
 * GET    /api/projects/[projectId]/pcos/[pcoId]/line-items - List line items
 * POST   /api/projects/[projectId]/pcos/[pcoId]/line-items - Add line item
 * PATCH  /api/projects/[projectId]/pcos/[pcoId]/line-items - Update line item
 * DELETE /api/projects/[projectId]/pcos/[pcoId]/line-items - Remove line item
 *
 * Schema: potential_change_order_line_items table (numeric pco_id).
 * - id, pco_id (bigint), change_event_line_item_id
 * - description, quantity, uom, unit_cost, category, sort_order
 * - line_amount (generated = quantity * unit_cost)
 *
 * Note: the create/edit pages now write line items atomically via the
 * create_pco_with_lines / update_pco_with_lines RPCs; this collection route
 * remains for incremental single-item edits.
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

/**
 * GET - List all line items for a PCO
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/pcos/[pcoId]/line-items#GET",
  async ({ request, params }) => {

    const { pcoId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/pcos/[pcoId]/line-items#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("potential_change_order_line_items")
      .select("*")
      .eq("pco_id", parseInt(pcoId, 10))
      .order("sort_order", { ascending: true });

    if (error) {
      logger.error({ msg: "Failed to fetch PCO line items:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data: data || [] });
    },
);

/**
 * POST - Add a line item to a PCO
 * Body: { cost_code?, description, quantity?, uom?, unit_cost?, line_type?, category?, subcontractor_id?, change_event_line_item_id? }
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/pcos/[pcoId]/line-items#POST",
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
    const body = await request.json();

    // Get current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/pcos/[pcoId]/line-items#POST", message: "Authentication required." });
    }

    // Verify PCO exists
    const { data: pco, error: pcoError } = await supabase
      .from("potential_change_orders")
      .select("id, title")
      .eq("id", numericPcoId)
      .eq("project_id", numericProjectId)
      .single();

    if (pcoError || !pco) {
      return NextResponse.json(
        { error: "PCO not found" },
        { status: 404 }
      );
    }

    if (!body.description || typeof body.description !== "string") {
      return NextResponse.json(
        { error: "Validation error", details: "description is required" },
        { status: 400 }
      );
    }

    // potential_change_order_line_items columns. line_amount is a generated
    // column (quantity * unit_cost) — never inserted.
    const insertData = {
      pco_id: numericPcoId,
      description: body.description,
      quantity: body.quantity ?? 1,
      uom: body.uom ?? body.unit_of_measure ?? null,
      unit_cost: body.unit_cost ?? 0,
      category: body.category ?? null,
      change_event_line_item_id: body.change_event_line_item_id || null,
      sort_order: body.sort_order ?? 0,
    };

    const { data, error } = await supabase
      .from("potential_change_order_line_items")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      logger.error({ msg: "Failed to add PCO line item:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    // Write timeline event
    await supabase.from("timeline_events").insert({
      project_id: numericProjectId,
      parent_type: "PCO",
      parent_id: numericPcoId.toString(),
      event_type: "UPDATED",
      actor_id: user.id,
      summary: `Line item added: "${body.description}"`,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json(data, { status: 201 });
    },
);

/**
 * PATCH - Update a line item
 * Body: { id (required), ...fields to update }
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/pcos/[pcoId]/line-items#PATCH",
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
    const body = await request.json();

    // Get current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/pcos/[pcoId]/line-items#PATCH", message: "Authentication required." });
    }

    if (!body.id) {
      return NextResponse.json(
        { error: "Validation error", details: "id is required" },
        { status: 400 }
      );
    }

    // Verify line item belongs to this PCO
    const { data: existing, error: fetchError } = await supabase
      .from("potential_change_order_line_items")
      .select("id")
      .eq("id", body.id)
      .eq("pco_id", numericPcoId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Line item not found in this PCO" },
        { status: 404 }
      );
    }

    // Real columns on potential_change_order_line_items (line_amount is generated).
    const allowedFields = [
      "description",
      "quantity",
      "uom",
      "unit_cost",
      "category",
      "change_event_line_item_id",
      "sort_order",
    ];

    // Back-compat: accept the legacy field name for unit of measure.
    if (body.unit_of_measure !== undefined && body.uom === undefined) {
      body.uom = body.unit_of_measure;
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // updated_at is always present; require at least one real field beyond it.
    if (Object.keys(updates).length <= 1) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("potential_change_order_line_items")
      .update(updates)
      .eq("id", body.id)
      .eq("pco_id", numericPcoId)
      .select()
      .single();

    if (error) {
      logger.error({ msg: "Failed to update PCO line item:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    // Write timeline event
    await supabase.from("timeline_events").insert({
      project_id: numericProjectId,
      parent_type: "PCO",
      parent_id: numericPcoId.toString(),
      event_type: "UPDATED",
      actor_id: user.id,
      summary: `Line item updated: ${Object.keys(updates).join(", ")}`,
      metadata: { line_item_id: body.id },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json(data);
    },
);

/**
 * DELETE - Remove a line item from a PCO
 * Body: { lineItemId: number }
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/pcos/[pcoId]/line-items#DELETE",
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
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/pcos/[pcoId]/line-items#DELETE", message: "Authentication required." });
    }

    if (!body.lineItemId) {
      return NextResponse.json(
        { error: "Validation error", details: "lineItemId is required" },
        { status: 400 }
      );
    }

    // Delete and return the deleted item for confirmation 
    const { data, error } = await supabase
      .from("potential_change_order_line_items")
      .delete()
      .eq("id", body.lineItemId)
      .eq("pco_id", numericPcoId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Line item not found in this PCO" },
        { status: 404 }
      );
    }

    // Write timeline event
    await supabase.from("timeline_events").insert({
      project_id: numericProjectId,
      parent_type: "PCO",
      parent_id: numericPcoId.toString(),
      event_type: "UPDATED",
      actor_id: user.id,
      summary: `Line item removed: "${data.description || "unnamed"}"`,
      metadata: { line_item_id: body.lineItemId },
      created_at: new Date().toISOString(),
    });

    return new NextResponse(null, { status: 204 });
    },
);
