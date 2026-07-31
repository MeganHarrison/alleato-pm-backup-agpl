import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  BudgetFetchError,
  computeBudgetGrandTotals,
  type GrandTotals,
} from "@/lib/budget/compute-grand-totals";
import {
  flattenSnapshotTotals,
  type SnapshotGrandTotalsJson,
} from "@/lib/budget/snapshot-totals";
import type { Json } from "@/types/database.types";

async function readOptionalSnapshotBody(
  request: Request,
): Promise<{ name?: string; description?: string }> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as { name?: string; description?: string };
  } catch (error) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "projects/[projectId]/budget/snapshots#POST",
      message: "Budget snapshot request body must be valid JSON when provided.",
      status: 400,
      cause: error,
    });
  }
}

/**
 * GET /api/projects/[id]/budget/snapshots
 *
 * Returns the list of budget snapshots plus the "current" grand totals for
 * comparison. Current totals come from the shared `computeBudgetGrandTotals`
 * helper — they are NOT hand-rolled from `budget_lines.original_amount` the
 * way earlier versions of this route did (which produced totalCosts: 0).
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/snapshots#GET",
  async ({ request, params }) => {
    const { projectId: projectIdStr } = await params;
    const projectIdNum = parseInt(projectIdStr, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/budget/snapshots#GET",
        message: "Authentication required.",
      });
    }

    const { data: rawSnapshots, error: snapshotsError } = await supabase
      .from("budget_snapshots")
      .select("id, name, description, grand_totals, created_by, created_at")
      .eq("project_id", projectIdNum)
      .order("created_at", { ascending: false });

    if (snapshotsError) return apiErrorResponse(snapshotsError);

    const snapshots = (rawSnapshots || []).map((s) => {
      const totals = flattenSnapshotTotals(
        s.grand_totals as SnapshotGrandTotalsJson | null,
        s.created_at,
      );
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        snapshot_date: totals.snapshot_date,
        total_budget: totals.total_budget,
        total_costs: totals.total_costs,
        variance: totals.variance,
        created_by: s.created_by,
        created_at: s.created_at,
      };
    });

    // Compute REAL current totals via the shared helper so that comparison
    // against past snapshots is apples-to-apples. If the budget fetch fails,
    // surface it as an API error — do not ship zeroed totals silently
    // (CLAUDE.md Rule 1: no silent failures).
    let currentTotalBudget = 0;
    let currentTotalCosts = 0;
    try {
      const { grandTotals } = await computeBudgetGrandTotals(
        supabase,
        projectIdNum,
      );
      currentTotalBudget = grandTotals.revisedBudget;
      currentTotalCosts = grandTotals.projectedCosts;
    } catch (error) {
      if (error instanceof BudgetFetchError) {
        return apiErrorResponse(error.cause);
      }
      throw error;
    }

    return NextResponse.json({
      snapshots,
      current: {
        totalBudget: currentTotalBudget,
        totalCosts: currentTotalCosts,
        variance: currentTotalBudget - currentTotalCosts,
        snapshotDate: new Date().toISOString(),
      },
      count: snapshots.length,
    });
  },
);

/**
 * POST /api/projects/[id]/budget/snapshots
 *
 * Captures a point-in-time snapshot of the current budget totals. Writes the
 * FULL Procore-parity GrandTotals into `grand_totals` JSON so that restoring
 * or comparing a snapshot later yields the same numbers the budget table
 * shows today — no drift between the summary card and the detail view.
 */
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/snapshots#POST",
  async ({ request, params }) => {
    const { projectId: projectIdStr } = await params;
    const projectIdNum = parseInt(projectIdStr, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/budget/snapshots#POST",
        message: "Authentication required.",
      });
    }

    const body = await readOptionalSnapshotBody(request);
    const { name, description } = body;

    let lineItems;
    let grandTotals: GrandTotals;
    try {
      const result = await computeBudgetGrandTotals(supabase, projectIdNum);
      lineItems = result.lineItems;
      grandTotals = result.grandTotals;
    } catch (error) {
      if (error instanceof BudgetFetchError) {
        return apiErrorResponse(error.cause);
      }
      throw error;
    }

    const snapshotDate = new Date().toISOString();
    const grandTotalsJson: SnapshotGrandTotalsJson = {
      snapshot_date: snapshotDate,
      ...grandTotals,
    };

    const { data: snapshot, error: insertError } = await supabase
      .from("budget_snapshots")
      .insert({
        project_id: projectIdNum,
        name: name || `Snapshot ${new Date().toLocaleDateString()}`,
        description: description ?? null,
        // The payload is JSON-serializable by construction (only numbers,
        // strings, booleans, arrays, and plain objects). Supabase's `Json`
        // type is structural and doesn't admit concrete interfaces directly,
        // so an explicit cast is the documented escape hatch here.
        grand_totals: grandTotalsJson as unknown as Json,
        line_items: lineItems as unknown as Json,
        created_by: user.id,
      })
      // Return only metadata — the full line_items/grand_totals JSON can be
      // large and the client discards it, so don't serialize it back.
      .select("id, name, description, created_at, created_by, project_id")
      .single();

    if (insertError) return apiErrorResponse(insertError);

    return NextResponse.json(snapshot, { status: 201 });
  },
);
