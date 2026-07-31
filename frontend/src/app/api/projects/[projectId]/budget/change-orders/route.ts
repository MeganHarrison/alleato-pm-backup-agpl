import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { requirePermission } from "@/lib/permissions-guard";
import { resolveBudgetDrilldownTargets } from "@/lib/budget/drilldown-matching";
import { logger } from "@/lib/logger";

type ChangeOrderStatusFilter = "approved" | "pending" | "all";
const PENDING_PRIME_CO_STATUSES = ["proposed", "pending", "submitted", "under_review", "revised"];

/**
 * Resolve display names for approver user ids. A lookup failure is reported
 * via structured logging and the rows fall back to showing no approver name.
 */
async function resolveUserNames(
  userIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return names;

    const { data, error } = await serviceDb.from("user_profiles")
    .select("id, full_name, email")
    .in("id", uniqueIds);
  if (error) {
    logger.warn({
      msg: "Failed to resolve approver display names for budget change-order drilldown",
      data: { userIds: uniqueIds, error: error.message },
    });
    return names;
  }
  for (const profile of data ?? []) {
    const display = profile.full_name?.trim() || profile.email?.trim();
    if (display) names.set(profile.id, display);
  }
  return names;
}

/**
 * GET /api/projects/[projectId]/budget/change-orders
 * Returns budget-related prime change orders scoped to a budget line or
 * division group. The "approved" filter mirrors v_budget_lines.approved_co_total:
 * pco_line_items joined to approved + promoted prime_contract_pcos, keyed by
 * budget line id.
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/change-orders#GET",
  async ({ request, params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const { searchParams } = new URL(request.url);
    const budgetLineId = searchParams.get("budgetLineId");
    const costCodeParam = searchParams.get("costCode");
    const statusParam = (searchParams.get("status") ?? "all").toLowerCase();
    const statusFilter: ChangeOrderStatusFilter =
      statusParam === "approved" || statusParam === "pending" ? statusParam : "all";

    const supabase = await createClient();
    const targets = await resolveBudgetDrilldownTargets(
      supabase,
      projectIdNum,
      budgetLineId,
      costCodeParam,
    );

    if (targets.budgetLineIds.length === 0 && targets.costCodeIds.length === 0) {
      return NextResponse.json({ changeOrders: [] });
    }

    // ---- Source 1: prime contract PCO lines (feeds the Approved COs column) ----
    // v_budget_lines counts pco_line_items where the parent PCO is approved and
    // promoted to a change order, keyed by budget_code_id = budget_lines.id.
    // pco_line_items.pco_id is polymorphic (pco_type discriminates), so there is
    // no FK for PostgREST embedding — fetch parents first, then lines.
    let pcoParentQuery = supabase
      .from("prime_contract_pcos")
      .select(
        "id, pco_number, title, status, approved_at, approved_by, promoted_to_co_id, prime_contract_id, created_at",
      )
      .eq("project_id", projectIdNum);

    if (statusFilter === "approved") {
      pcoParentQuery = pcoParentQuery
        .eq("status", "approved")
        .not("promoted_to_co_id", "is", null);
    } else if (statusFilter === "pending") {
      pcoParentQuery = pcoParentQuery.in("status", PENDING_PRIME_CO_STATUSES);
    }

    const pcoParentResult = await pcoParentQuery;
    if (pcoParentResult.error) {
      return NextResponse.json(
        { error: "Failed to fetch change orders", details: pcoParentResult.error.message },
        { status: 500 },
      );
    }

    const pcoParents = pcoParentResult.data ?? [];
    const pcoParentById = new Map(pcoParents.map((pco) => [pco.id, pco]));

    const pcoLinesResult =
      pcoParents.length > 0 && targets.budgetLineIds.length > 0
        ? await supabase
            .from("pco_line_items")
            .select("id, amount, description, budget_code_id, pco_id")
            .eq("pco_type", "prime")
            .in("pco_id", Array.from(pcoParentById.keys()))
            .in("budget_code_id", targets.budgetLineIds)
        : { data: [], error: null };

    if (pcoLinesResult.error) {
      return NextResponse.json(
        { error: "Failed to fetch change orders", details: pcoLinesResult.error.message },
        { status: 500 },
      );
    }

    const pcoRows = pcoLinesResult.data ?? [];
    const approverIds = pcoRows
      .map((row) => pcoParentById.get(row.pco_id ?? "")?.approved_by ?? null)
      .filter((id): id is string => Boolean(id));
    const approverNames = await resolveUserNames(approverIds);

    const promotedCoIds = new Set<number>();
    const pcoChangeOrders = pcoRows.map((row) => {
      const pco = row.pco_id ? pcoParentById.get(row.pco_id) : undefined;
      if (pco?.promoted_to_co_id != null) {
        promotedCoIds.add(Number(pco.promoted_to_co_id));
      }
      return {
        id: String(row.id ?? ""),
        changeOrderNumber: pco?.pco_number || String(pco?.id ?? ""),
        description: row.description || pco?.title || "",
        amount: Number(row.amount ?? 0) || 0,
        status: pco?.status || "unknown",
        requestedDate: pco?.created_at || null,
        requestedBy: null,
        approvedDate: pco?.approved_at || null,
        approvedBy: pco?.approved_by
          ? (approverNames.get(pco.approved_by) ?? null)
          : null,
        contractNumber: "-",
        detailHref:
          pco?.promoted_to_co_id != null
            ? `/${projectIdNum}/change-orders/prime/${pco.promoted_to_co_id}`
            : pco?.prime_contract_id
              ? `/${projectIdNum}/prime-contracts/${pco.prime_contract_id}/change-orders/pcos/${pco.id}`
              : null,
      };
    });

    // NOTE: the legacy `change_order_lines` table no longer exists in the
    // database (verified 2026-07-01) — the old legacy source was dead code
    // and has been removed.

    // ---- Source 2: prime contract change order (PCCO) lines ----
    // pcco_line_items.cost_code has stored both cost code strings and budget
    // line UUIDs across imports, so match against both target sets.
    const pccoMatchKeys = Array.from(
      new Set([...targets.costCodeIds, ...targets.budgetLineIds]),
    );
    let pccoQuery = supabase
      .from("pcco_line_items")
      .select(
        `
        id,
        line_amount,
        description,
        cost_code,
        pcco_id,
        prime_contract_change_orders!inner(
          id,
          pcco_number,
          title,
          status,
          submitted_at,
          approved_at,
          created_at,
          project_id
        )
      `,
      )
      .eq("prime_contract_change_orders.project_id", projectIdNum)
      .in("cost_code", pccoMatchKeys);

    if (statusFilter === "approved") {
      pccoQuery = pccoQuery.in("prime_contract_change_orders.status", ["approved", "Approved"]);
    } else if (statusFilter === "pending") {
      pccoQuery = pccoQuery.in("prime_contract_change_orders.status", PENDING_PRIME_CO_STATUSES);
    }

    const pccoResult = pccoMatchKeys.length > 0 ? await pccoQuery : { data: [], error: null };
    const pccoError = pccoResult.error;
    const pccoSerializedError = JSON.stringify(pccoError);
    const isMissingPccoTable =
      pccoSerializedError.includes("pcco_line_items") ||
      pccoSerializedError.includes("PGRST205") ||
      pccoSerializedError.includes("schema cache");

    if (pccoError && !isMissingPccoTable) {
      return NextResponse.json(
        { error: "Failed to fetch prime contract change orders", details: pccoError.message },
        { status: 500 },
      );
    }

    const pccoChangeOrders = (isMissingPccoTable ? [] : (pccoResult.data ?? []))
      // A PCCO created by promoting a PCO would duplicate the PCO row above.
      .filter((line) => {
        const coRaw = Array.isArray(line.prime_contract_change_orders)
          ? line.prime_contract_change_orders[0]
          : line.prime_contract_change_orders;
        return !promotedCoIds.has(Number(coRaw?.id));
      })
      .map((line) => {
        const coRaw = Array.isArray(line.prime_contract_change_orders)
          ? line.prime_contract_change_orders[0]
          : line.prime_contract_change_orders;
        const co = coRaw ?? null;

        return {
          id: String(line.id ?? ""),
          changeOrderNumber: co?.pcco_number || String(co?.id ?? ""),
          description: line.description || co?.title || "",
          amount: Number(line.line_amount ?? 0) || 0,
          status: co?.status || "unknown",
          requestedDate: co?.submitted_at || co?.created_at || null,
          requestedBy: null,
          approvedDate: co?.approved_at || null,
          approvedBy: null,
          contractNumber: "-",
          detailHref: co?.id != null ? `/${projectIdNum}/change-orders/prime/${co.id}` : null,
        };
      });

    return NextResponse.json({
      changeOrders: [...pcoChangeOrders, ...pccoChangeOrders],
    });
  },
);
