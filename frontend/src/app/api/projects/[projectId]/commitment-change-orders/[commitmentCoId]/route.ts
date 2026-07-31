import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import { getScopedCommitmentChangeOrder } from "@/lib/change-orders/commitment-change-orders";

interface RouteParams {
  params: Promise<{ projectId: string; commitmentCoId: string }>;
}

interface AssociatedChangeRequest {
  id: string;
  number: string;
  title: string;
  status: string;
  reason: string | null;
  scope: string;
  created_at: string;
  linked_at: string | null;
}

/**
 * GET /api/projects/[projectId]/commitment-change-orders/[commitmentCoId]
 *
 * Direct lookup of a contract_change_orders row by UUID,
 * verified against the project via the linked commitment.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]#GET",
  async ({ request, params }) => {
    const { projectId, commitmentCoId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]#GET",
        message: "Authentication required.",
      });
    }

    const scoped = await getScopedCommitmentChangeOrder(
      supabase,
      Number(projectId),
      commitmentCoId,
    );

    if (!scoped) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: links, error: linksError } = await supabase
      .from("change_event_pco_links")
      .select("change_event_id, linked_at")
      .eq("pco_id", commitmentCoId)
      .eq("pco_type", "commitment")
      .order("linked_at", { ascending: false });

    if (linksError) {
      return apiErrorResponse(linksError);
    }

    const changeEventIds = [
      ...new Set((links ?? []).map((link) => link.change_event_id)),
    ];

    if (changeEventIds.length === 0) {
      return NextResponse.json({
        ...scoped,
        associated_change_requests: [],
      });
    }

    const { data: changeEvents, error: changeEventsError } = await supabase
      .from("change_events")
      .select("id, number, title, status, reason, scope, created_at")
      .in("id", changeEventIds)
      .eq("project_id", Number(projectId))
      .is("deleted_at", null)
      .order("number", { ascending: true });

    if (changeEventsError) {
      return apiErrorResponse(changeEventsError);
    }

    const linkedAtByChangeEventId = new Map(
      (links ?? []).map((link) => [link.change_event_id, link.linked_at]),
    );
    const associatedChangeRequests: AssociatedChangeRequest[] = (
      changeEvents ?? []
    ).map((changeEvent) => ({
      id: changeEvent.id,
      number: changeEvent.number,
      title: changeEvent.title,
      status: changeEvent.status,
      reason: changeEvent.reason,
      scope: changeEvent.scope,
      created_at: changeEvent.created_at,
      linked_at: linkedAtByChangeEventId.get(changeEvent.id) ?? null,
    }));

    return NextResponse.json({
      ...scoped,
      associated_change_requests: associatedChangeRequests,
    });
  },
);

/**
 * PUT /api/projects/[projectId]/commitment-change-orders/[commitmentCoId]
 * Update a commitment change order.
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]#PUT",
  async ({ request, params }) => {
    const { projectId, commitmentCoId } = await params;
    const projectIdNum = Number(projectId);
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where:
          "projects/[projectId]/commitment-change-orders/[commitmentCoId]#PUT",
        message: "Authentication required.",
      });
    }

    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const scoped = await getScopedCommitmentChangeOrder(
      supabase,
      projectIdNum,
      commitmentCoId,
    );

    if (!scoped) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();

    // Strip fields that shouldn't be directly updated
    const {
      id: _id,
      created_at: _ca,
      updated_at: _ua,
      commitment_number: _cn,
      ...updateData
    } = body;
    if ("description" in updateData) {
      updateData.description = updateData.description ?? "";
    }

    // Guardrail: a change order can't be requested after the moment it's created.
    // Compare calendar-date prefixes (not parsed Date instants) so this can't
    // false-positive across timezones at day boundaries.
    if (
      typeof updateData.requested_date === "string" &&
      scoped.created_at &&
      updateData.requested_date.slice(0, 10) > scoped.created_at.slice(0, 10)
    ) {
      return NextResponse.json(
        {
          error: "Invalid requested date",
          message: "Requested date cannot be later than the date the change order was created.",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("contract_change_orders")
      .update(updateData)
      .eq("id", commitmentCoId)
      .select("*")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data);
  },
);

/**
 * DELETE /api/projects/[projectId]/commitment-change-orders/[commitmentCoId]
 * Delete a commitment change order.
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]#DELETE",
  async ({ request, params }) => {
    const { projectId, commitmentCoId } = await params;
    const projectIdNum = Number(projectId);
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where:
          "projects/[projectId]/commitment-change-orders/[commitmentCoId]#DELETE",
        message: "Authentication required.",
      });
    }

    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const scoped = await getScopedCommitmentChangeOrder(
      supabase,
      projectIdNum,
      commitmentCoId,
    );

    if (!scoped) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("contract_change_orders")
      .delete()
      .eq("id", commitmentCoId);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ message: "Deleted successfully" });
  },
);
