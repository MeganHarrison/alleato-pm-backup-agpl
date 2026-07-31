import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import { buildNextCommitmentChangeOrderNumber } from "@/lib/change-orders/commitment-change-order-number";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * GET /api/projects/[projectId]/commitment-change-orders
 *
 * Returns all change orders across all commitments for a project.
 * Uses the commitments read model to scope contract_change_orders to the current project.
 *
 * Response shape:
 * {
 *   data: Array<{
 *     id, number, title, status, amount, requested_date, approved_date,
 *     commitment_id, commitment_number
 *   }>,
 *   meta: { total_count, total_amount }
 * }
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders#GET",
  async ({ request, params }) => {
    const { projectId } = await params;

    // Unauthenticated requests must 401 before touching the DB — the queries
    // below read budget_lines, which hard-errors for the anon role.
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/commitment-change-orders#GET", message: "Authentication required." });
    }

    const supabase = await createClient();

    const { data: commitments, error: commitmentsError } = await supabase
      .from("commitments_unified")
      .select("id, contract_number")
      .eq("project_id", Number(projectId))
      .is("deleted_at", null);

    if (commitmentsError) {
      return apiErrorResponse(commitmentsError);
    }

    const commitmentIds = (commitments ?? [])
      .map((c) => c.id)
      .filter(Boolean) as string[];

    // A CO belongs to this project if EITHER (a) it hangs off one of the
    // project's commitments, OR (b) it is stamped directly with project_id.
    // Case (b) covers Acumatica project-level change orders whose commitment
    // header was never synced (contract_id points at a deleted "ghost"
    // commitment) — see scripts/jobplanner/backfill-cco-project-id.mjs
    // (2026-07-09). Without the project_id branch these rows are invisible in
    // the UI even though the data is correct. PostgREST returns each row once,
    // so overlapping matches are not double-counted.
    const orFilters = [`project_id.eq.${Number(projectId)}`];
    if (commitmentIds.length > 0) {
      orFilters.push(`contract_id.in.(${commitmentIds.join(",")})`);
    }

    const { data: changeOrders, error: coError } = await supabase
      .from("contract_change_orders")
      .select(
        "id, change_order_number, description, status, amount, requested_date, approved_date, contract_id",
      )
      .or(orFilters.join(","))
      .order("requested_date", { ascending: false });

    if (coError) {
      return apiErrorResponse(coError);
    }

    const commitmentRows = (commitments ?? []).map((commitment) => ({
      id: commitment.id,
      contract_number: commitment.contract_number ?? null,
    }));
    const commitmentNumberById = new Map(
      commitmentRows
        .filter(
          (
            commitment,
          ): commitment is { id: string; contract_number: string | null } =>
            Boolean(commitment.id),
        )
        .map((commitment) => [commitment.id, commitment.contract_number]),
    );

    const data = (changeOrders ?? []).map((co) => ({
      id: co.id,
      number: co.change_order_number,
      title: co.description,
      status: co.status?.toLowerCase() ?? "draft",
      amount: Number(co.amount) || 0,
      requested_date: co.requested_date,
      approved_date: co.approved_date,
      commitment_id: co.contract_id,
      commitment_number: commitmentNumberById.get(co.contract_id) ?? null,
    }));

    const totalAmount = data.reduce((sum, co) => sum + co.amount, 0);

    return NextResponse.json({
      data,
      meta: {
        total_count: data.length,
        total_amount: totalAmount,
      },
    });
  },
);

/**
 * POST /api/projects/[projectId]/commitment-change-orders
 * Create a new commitment change order.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const projectIdNum = Number(projectId);
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/commitment-change-orders#POST",
        message: "Authentication required.",
      });
    }

    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const body = await request.json();
    const changeEventIds = Array.isArray(body.change_event_ids)
      ? (body.change_event_ids as string[])
      : [];

    if (!body.contract_id) {
      return NextResponse.json(
        { error: "contract_id (commitment ID) is required" },
        { status: 400 },
      );
    }

    // Guardrail: a change order can't be requested after the moment it's created.
    // Compare calendar-date prefixes (not parsed Date instants) so this can't
    // false-positive across timezones at day boundaries.
    if (
      typeof body.requested_date === "string" &&
      body.requested_date.slice(0, 10) > new Date().toISOString().slice(0, 10)
    ) {
      return NextResponse.json(
        {
          error: "Invalid requested date",
          message: "Requested date cannot be in the future.",
        },
        { status: 400 },
      );
    }

    // Verify the commitment belongs to this project
    const { data: commitment, error: commitmentError } = await supabase
      .from("commitments_unified")
      .select("id, project_id")
      .eq("id", body.contract_id)
      .is("deleted_at", null)
      .single();

    if (commitmentError || !commitment) {
      return NextResponse.json(
        { error: "Commitment not found" },
        { status: 404 },
      );
    }

    if (commitment.project_id !== Number(projectId)) {
      return NextResponse.json(
        { error: "Commitment does not belong to this project" },
        { status: 400 },
      );
    }

    let originalChangeEventFlags = new Map<string, boolean>();
    let sourceLineItems: Array<{
      id: string;
      description: string | null;
      cost_rom: number | string | null;
      revenue_rom: number | string | null;
      budget_line_id: string | null;
      budget_code_id: string | null;
    }> = [];

    if (changeEventIds.length > 0) {
      const { data: changeEvents, error: changeEventsError } = await supabase
        .from("change_events")
        .select("id, sent_to_commitment_pco")
        .eq("project_id", projectIdNum)
        .in("id", changeEventIds);

      if (changeEventsError) {
        return apiErrorResponse(changeEventsError);
      }

      if (!changeEvents || changeEvents.length !== changeEventIds.length) {
        return NextResponse.json(
          {
            error:
              "One or more change events were not found in this project.",
          },
          { status: 400 },
        );
      }

      originalChangeEventFlags = new Map(
        changeEvents.map((changeEvent) => [
          changeEvent.id,
          Boolean(changeEvent.sent_to_commitment_pco),
        ]),
      );

      const { data: lineItems, error: lineItemsError } = await supabase
        .from("change_event_line_items")
        .select("id, description, cost_rom, revenue_rom, budget_line_id, budget_code_id")
        .in("change_event_id", changeEventIds);

      if (lineItemsError) {
        return apiErrorResponse(lineItemsError);
      }

      sourceLineItems = lineItems ?? [];
    }

    const lineItemIds = sourceLineItems.map((item) => item.id).filter(Boolean);
    const latestRfqAmountByLineItemId = new Map<string, number>();
    if (lineItemIds.length > 0) {
      const { data: rfqResponses, error: rfqResponsesError } = await supabase
        .from("change_event_rfq_responses")
        .select("line_item_id, extended_amount, submitted_at, created_at")
        .in("line_item_id", lineItemIds)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (rfqResponsesError) {
        return apiErrorResponse(rfqResponsesError);
      }

      for (const response of rfqResponses ?? []) {
        if (!response.line_item_id || latestRfqAmountByLineItemId.has(response.line_item_id)) {
          continue;
        }
        const amount = Number(response.extended_amount);
        latestRfqAmountByLineItemId.set(
          response.line_item_id,
          Number.isFinite(amount) ? amount : 0,
        );
      }
    }

    const sourceBudgetLineIds = [
      ...new Set(
        sourceLineItems
          .map((item) => item.budget_line_id ?? item.budget_code_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const budgetLineById = new Map<
      string,
      { cost_code_id: string; cost_type_id: string }
    >();
    if (sourceBudgetLineIds.length > 0) {
      const { data: budgetLines, error: budgetLinesError } = await supabase
        .from("budget_lines")
        .select("id, cost_code_id, cost_type_id")
        .in("id", sourceBudgetLineIds);

      if (budgetLinesError) {
        return apiErrorResponse(budgetLinesError);
      }

      for (const budgetLine of budgetLines ?? []) {
        budgetLineById.set(budgetLine.id, {
          cost_code_id: budgetLine.cost_code_id,
          cost_type_id: budgetLine.cost_type_id,
        });
      }
    }

    const sourceAmount = sourceLineItems.reduce((sum, item) => {
      const value =
        latestRfqAmountByLineItemId.get(item.id) ??
        item.cost_rom ??
        item.revenue_rom ??
        0;
      return sum + (Number(value) || 0);
    }, 0);
    const requestedAmount = Number(body.amount ?? 0);
    const changeOrderAmount = requestedAmount !== 0 ? requestedAmount : sourceAmount;

    let changeOrderNumber =
      typeof body.change_order_number === "string" &&
      body.change_order_number.trim()
        ? body.change_order_number.trim()
        : null;

    if (!changeOrderNumber) {
      const { count, error: countError } = await supabase
        .from("contract_change_orders")
        .select("id", { count: "exact", head: true })
        .eq("contract_id", body.contract_id);

      if (countError) {
        return apiErrorResponse(countError);
      }

      changeOrderNumber = buildNextCommitmentChangeOrderNumber(count ?? 0);
    }

    const { data, error } = await supabase
      .from("contract_change_orders")
      .insert({
        project_id: projectIdNum,
        change_order_number: changeOrderNumber,
        description: body.description ?? "",
        amount: changeOrderAmount,
        contract_id: body.contract_id,
        status: body.status || "draft",
        requested_date: body.requested_date ?? new Date().toISOString().split("T")[0],
        title: body.title ?? null,
        change_reason: body.change_reason ?? null,
        designated_reviewer: body.designated_reviewer ?? null,
        requested_by: body.requested_by ?? null,
        due_date: body.due_date ?? null,
        invoiced_date: body.invoiced_date ?? null,
        schedule_impact: body.schedule_impact ?? null,
        location: body.location ?? null,
        reference: body.reference ?? null,
        field_change: body.field_change ?? false,
        is_private: body.is_private ?? false,
        paid_in_full: body.paid_in_full ?? false,
        executed: body.executed ?? false,
        revision: body.revision ?? 0,
        signed_co_received_date: body.signed_co_received_date ?? null,
        paid_date: body.paid_date ?? null,
        request_received_from: body.request_received_from ?? null,
        contract_company: body.contract_company ?? null,
        contract_type: body.contract_type ?? null,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    if (changeEventIds.length > 0 && data?.id) {
      if (sourceLineItems.length > 0) {
        const { error: lineInsertError } = await supabase
          .from("commitment_change_order_lines")
          .insert(
            sourceLineItems.map((item) => ({
              commitment_change_order_id: data.id,
              description: item.description ?? null,
              amount:
                Number(
                  latestRfqAmountByLineItemId.get(item.id) ??
                    item.cost_rom ??
                    item.revenue_rom ??
                    0,
                ) || 0,
              budget_line_id: item.budget_line_id ?? item.budget_code_id ?? null,
              cost_code_id: budgetLineById.get(item.budget_line_id ?? item.budget_code_id ?? "")
                ?.cost_code_id ?? null,
              cost_type_id: budgetLineById.get(item.budget_line_id ?? item.budget_code_id ?? "")
                ?.cost_type_id ?? null,
            })),
          );

        if (lineInsertError) {
          await supabase.from("contract_change_orders").delete().eq("id", data.id);

          return NextResponse.json(
            {
              error:
                "Failed to create commitment change order line items.",
              details: lineInsertError.message,
            },
            { status: 500 },
          );
        }
      }

      const { error: ceUpdateError } = await supabase
        .from("change_events")
        .update({ sent_to_commitment_pco: true })
        .in("id", changeEventIds);

      if (ceUpdateError) {
        await supabase.from("contract_change_orders").delete().eq("id", data.id);

        return NextResponse.json(
          {
            error:
              "Failed to associate change events with the commitment change order.",
            details: ceUpdateError.message,
          },
          { status: 500 },
        );
      }

      const links = changeEventIds.map((ceId) => ({
        change_event_id: ceId,
        pco_id: data.id,
        pco_type: "commitment",
      }));

      const { error: linkError } = await supabase
        .from("change_event_pco_links")
        .insert(links);

      if (linkError) {
        const rollbackIds = Array.from(originalChangeEventFlags.entries())
          .filter(([, wasLinked]) => !wasLinked)
          .map(([changeEventId]) => changeEventId);

        if (rollbackIds.length > 0) {
          await supabase
            .from("change_events")
            .update({ sent_to_commitment_pco: false })
            .in("id", rollbackIds);
        }

        await supabase.from("contract_change_orders").delete().eq("id", data.id);

        return NextResponse.json(
          {
            error:
              "Failed to create change event links for the commitment change order.",
            details: linkError.message,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(data, { status: 201 });
  },
);
