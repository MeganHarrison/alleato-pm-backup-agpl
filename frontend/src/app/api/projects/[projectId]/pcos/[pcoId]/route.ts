/**
 * ============================================================================
 * PCO DETAIL API ROUTE
 * ============================================================================
 *
 * GET   /api/projects/[projectId]/pcos/[pcoId] - Get single PCO with relations
 * PATCH /api/projects/[projectId]/pcos/[pcoId] - Update PCO fields
 *
 * No DELETE — PCOs are never deleted, only voided via status change.
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

type PcoChangeEventRow = {
  change_event_id: string;
};
import { requirePermission } from "@/lib/permissions-guard";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ projectId: string; pcoId: string }>;
}

/**
 * GET /api/projects/[projectId]/pcos/[pcoId]
 * Returns a single PCO with versions, grouped change events, and line items
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/pcos/[pcoId]#GET",
  async ({ request, params }) => {
  
    const { projectId, pcoId } = await params;
    const numericProjectId = parseInt(projectId, 10);
    const numericPcoId = parseInt(pcoId, 10);

    if (isNaN(numericProjectId) || isNaN(numericPcoId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/pcos/[pcoId]#GET",
        message: "Authentication required.",
      });
    }

    // Fetch PCO with related data
    const { data: pco, error } = await supabase
      .from("potential_change_orders")
      .select("*")
      .eq("project_id", numericProjectId)
      .eq("id", numericPcoId)
      .single();

    if (error || !pco) {
      return NextResponse.json(
        { error: "PCO not found" },
        { status: 404 }
      );
    }

    // Fetch versions
    const { data: versions } = await supabase
      .from("pco_versions")
      .select("*")
      .eq("pco_id", numericPcoId)
      .order("version", { ascending: false });

    // Fetch grouped change events with their change_event details
    const { data: pcoChangeEvents } = await supabase
      .from("pco_change_events")
      .select(
        `
        id,
        pco_id,
        change_event_id,
        estimated_amount,
        sort_order,
        added_at,
        added_by_id
      `
      )
      .eq("pco_id", numericPcoId)
      .order("sort_order", { ascending: true });

    // Fetch full change event details for grouped events
    const changeEventIds = ((pcoChangeEvents || []) as PcoChangeEventRow[]).map(
      (pce) => pce.change_event_id,
    );
    const changeEventsMap: Record<string, unknown> = {};
    if (changeEventIds.length > 0) {
      const { data: changeEvents } = await supabase
        .from("change_events")
        .select("id, number, title, type, status, scope")
        .in("id", changeEventIds);

      for (const ce of changeEvents || []) {
        changeEventsMap[ce.id] = ce;
      }
    }

    const groupedChangeEvents = ((pcoChangeEvents || []) as PcoChangeEventRow[]).map((pce) => ({
      ...pce,
      changeEvent: changeEventsMap[pce.change_event_id] || null,
    }));

    // Flattened change events in the shape the edit form expects (id = the
    // change_event_id, plus a few display fields).
    const changeEvents = ((pcoChangeEvents || []) as Array<
      PcoChangeEventRow & { estimated_amount: number | null }
    >).map((pce) => {
      const ce = (changeEventsMap[pce.change_event_id] || {}) as {
        number?: string;
        title?: string;
        type?: string;
      };
      return {
        id: pce.change_event_id,
        number: ce.number ?? "",
        title: ce.title ?? "",
        type: ce.type ?? "",
        estimated_amount: pce.estimated_amount ?? null,
      };
    });

    // Fetch line items from the numeric-PCO line-items table.
    const { data: lineItems } = await supabase
      .from("potential_change_order_line_items")
      .select("*")
      .eq("pco_id", numericPcoId)
      .order("sort_order", { ascending: true });

    // Fetch timeline events
    const { data: timeline } = await supabase
      .from("timeline_events")
      .select("*")
      .eq("parent_type", "PCO")
      .eq("parent_id", numericPcoId.toString())
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      ...pco,
      versions: versions || [],
      groupedChangeEvents,
      // Page-facing shapes consumed by the detail sidebar and edit form.
      change_events: changeEvents,
      line_items: lineItems || [],
      lineItems: lineItems || [],
      timeline: timeline || [],
      _links: {
        self: `/api/projects/${projectId}/pcos/${pcoId}`,
        changeEvents: `/api/projects/${projectId}/pcos/${pcoId}/change-events`,
        lineItems: `/api/projects/${projectId}/pcos/${pcoId}/line-items`,
        submit: `/api/projects/${projectId}/pcos/${pcoId}/submit`,
        clientDecision: `/api/projects/${projectId}/pcos/${pcoId}/client-decision`,
      },
    });
    },
);

/**
 * PATCH /api/projects/[projectId]/pcos/[pcoId]
 * Updates PCO fields (partial update)
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/pcos/[pcoId]#PATCH",
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
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/pcos/[pcoId]#PATCH", message: "Authentication required." });
    }

    // Verify PCO exists
    const { data: existing, error: fetchError } = await supabase
      .from("potential_change_orders")
      .select("*")
      .eq("project_id", numericProjectId)
      .eq("id", numericPcoId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "PCO not found" },
        { status: 404 }
      );
    }

    // Build update object from allowed fields
    const allowedFields = [
      "title",
      "description",
      "type",
      "status",
      "estimated_value",
      "approved_value",
      "markup_percentage",
      "schedule_impact_days",
      "schedule_impact_description",
      "rfq_required",
      "rfq_status",
      "annotation",
      "annotation_note",
      "root_cause",
      "prime_change_order_id",
      "change_reason",
      "location",
      "reference",
      "request_received_from",
      "due_date",
      "is_private",
      "field_change",
      "paid_in_full",
    ];

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from("potential_change_orders")
      .update(updates)
      .eq("id", numericPcoId)
      .select()
      .single();

    if (error) {
      logger.error({ msg: "Failed to update PCO:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    // Write timeline event
    const changedFields = Object.keys(updates).filter(
      (k) => k !== "updated_at"
    );
    if (changedFields.length > 0) {
      await supabase.from("timeline_events").insert({
        project_id: numericProjectId,
        parent_type: "PCO",
        parent_id: numericPcoId.toString(),
        event_type: "UPDATED",
        actor_id: user.id,
        summary: `PCO updated: ${changedFields.join(", ")}`,
        metadata: { changed_fields: changedFields },
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(data);
    },
);
