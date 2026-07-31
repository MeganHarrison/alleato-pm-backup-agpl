import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { BudgetLineItemsPayloadSchema } from "@/lib/schemas/budget";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import {
  BudgetFetchError,
  computeBudgetGrandTotals,
} from "@/lib/budget/compute-grand-totals";
import {
  getBudgetLineAmountPolicy,
  isEffectivelyZero,
} from "@/lib/budget/new-line-amount-policy";


// GET /api/projects/[id]/budget - Fetch budget data for a project
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget#GET",
  async ({ request, params }) => {

    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    // Permission check: reading budget requires "read" on budget
    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    try {
      const { lineItems, grandTotals } = await computeBudgetGrandTotals(
        supabase,
        projectIdNum,
      );
      return NextResponse.json({ lineItems, grandTotals });
    } catch (error) {
      if (error instanceof BudgetFetchError) {
        return apiErrorResponse(error.cause);
      }
      throw error;
    }
  },
);


// POST /api/projects/[id]/budget - Create budget line items
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    // Permission check: writing budget lines requires "write" on budget
    const guard = await requirePermission(projectIdNum, "budget", "write");
    if (guard.denied) return guard.response;

    const body = await request.json();
    const parsed = BudgetLineItemsPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const normalizedLineItems = parsed.data.lineItems.map((item) => ({
      costCodeId: item.costCodeId,
      costTypeId: item.costType ?? null,
      qty: item.qty && item.qty !== "" ? parseFloat(item.qty) : null,
      uom: item.uom ?? null,
      unitCost:
        item.unitCost && item.unitCost !== ""
          ? parseFloat(item.unitCost)
          : null,
      amount: parseFloat(item.amount),
      allowZeroAmount: item.allowZeroAmount === true,
      description: item.description ?? null,
    }));

    const supabase = await createClient();

    // Post-execution amount lock: when a prime contract is executed, new
    // budget lines must be created at $0.00. Budget changes flow through
    // change orders. Controlled by NEXT_PUBLIC_LOCK_NEW_BUDGET_LINE_AMOUNTS_AFTER_CONTRACT_EXECUTION.
    const amountPolicy = await getBudgetLineAmountPolicy(
      supabase,
      projectIdNum,
    );
    if (amountPolicy.requireZeroAmount) {
      const violatingIndex = normalizedLineItems.findIndex(
        (item) => !isEffectivelyZero(item.amount),
      );
      if (violatingIndex !== -1) {
        return NextResponse.json(
          {
            error:
              "Budget amounts are locked after prime contract execution. New line items must be added at $0.00; budget changes flow through change orders.",
            code: "BUDGET_AMOUNT_LOCKED",
            violatingLineIndex: violatingIndex,
          },
          { status: 422 },
        );
      }
    }

    const runtimeSettingsClient = supabase as unknown as {
      from: (table: "project_budget_settings") => {
        select: (query: string) => {
          eq: (
            column: "project_id",
            value: number,
          ) => {
            maybeSingle: () => Promise<{
              data: { autocalculate_forecast_to_complete: boolean } | null;
              error: unknown;
            }>;
          };
        };
      };
    };
    // Get current user
    const user = await getApiRouteUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - please log in" },
        { status: 401 },
      );
    }

    // Applies project-level FTC defaults to newly created budget lines.
    const { data: settings } = await runtimeSettingsClient
      .from("project_budget_settings")
      .select("autocalculate_forecast_to_complete")
      .eq("project_id", projectIdNum)
      .maybeSingle();
    const defaultFtcMethod = settings?.autocalculate_forecast_to_complete === false
      ? "manual"
      : "automatic";

    // Look up cost code IDs from the code strings or IDs
    const costCodes = Array.from(
      new Set(normalizedLineItems.map((item) => item.costCodeId)),
    );
    const { data: costCodeData, error: codeError } = await supabase
      .from("cost_codes")
      .select("id")
      .in("id", costCodes);

    if (codeError) {
      return apiErrorResponse(codeError);
    }

    // Create a map of code ID to verify existence
    const validCostCodeIds = new Set((costCodeData || []).map((cc) => cc.id));

    // Resolve cost type values to UUIDs.
    // The client may send either a letter code ("L", "M", "S") or an already-resolved UUID.
    // UUIDs are passed through; letter codes are looked up via cost_code_types.code.
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const letterCodesToResolve = normalizedLineItems
      .map((item) => item.costTypeId)
      .filter((code): code is string => code !== null && !UUID_REGEX.test(code));

    let codeToUuidMap = new Map<string, string>();
    if (letterCodesToResolve.length > 0) {
      const { data: costTypeData, error: typeError } = await supabase
        .from("cost_code_types")
        .select("id, code")
        .in("code", letterCodesToResolve);

      if (typeError) {
        return apiErrorResponse(typeError);
      }
      codeToUuidMap = new Map((costTypeData || []).map((ct) => [ct.code, ct.id]));
    }

    // Replace letter codes with resolved UUIDs; pass UUIDs through unchanged
    const resolvedLineItems = normalizedLineItems.map((item) => ({
      ...item,
      costTypeId: item.costTypeId
        ? (UUID_REGEX.test(item.costTypeId) ? item.costTypeId : (codeToUuidMap.get(item.costTypeId) ?? null))
        : null,
    }));

    // Create or increment budget_lines atomically using a DB function.
    // This avoids read-then-write races under concurrent requests.
    const results = [];

    for (const item of resolvedLineItems) {
      if (!validCostCodeIds.has(item.costCodeId)) {
        return NextResponse.json(
          {
            error: "Cost code not found",
            costCodeId: item.costCodeId,
          },
          { status: 400 },
        );
      }

      // Create new budget_line. cost_type_id is required by the DB schema.
      if (!item.costTypeId) {
        return NextResponse.json(
          {
            error:
              "cost_type_id is required for new budget lines. Cost type could not be resolved.",
            costCodeId: item.costCodeId,
          },
          { status: 400 },
        );
      }

      const { data: existingLine, error: existingLineError } = await supabase
        .from("budget_lines")
        .select(
          "id, original_amount, description, quantity, unit_of_measure, unit_cost",
        )
        .eq("project_id", projectIdNum)
        .eq("cost_code_id", item.costCodeId)
        .eq("cost_type_id", item.costTypeId)
        .is("sub_job_id", null)
        .maybeSingle();

      if (existingLineError) {
        return apiErrorResponse(existingLineError);
      }

      if (existingLine) {
        const { data: updatedLine, error: updateError } = await supabase
          .from("budget_lines")
          .update({
            original_amount:
              (Number(existingLine.original_amount) || 0) + (item.amount || 0),
            description: item.description || existingLine.description,
            quantity: item.qty ?? existingLine.quantity,
            unit_of_measure: item.uom ?? existingLine.unit_of_measure,
            unit_cost: item.unitCost ?? existingLine.unit_cost,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingLine.id)
          .select()
          .single();

        if (updateError) {
          return apiErrorResponse(updateError);
        }

        results.push(updatedLine);
        continue;
      }

      const runtimeSupabase = supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: unknown }>;
      };
      const { data: upsertedLine, error: upsertError } =
        await runtimeSupabase.rpc("upsert_budget_line_amount", {
          p_project_id: projectIdNum,
          p_cost_code_id: item.costCodeId,
          p_cost_type_id: item.costTypeId,
          p_sub_job_id: null,
          p_description: item.description || null,
          p_delta_amount: item.amount || 0,
          p_quantity: item.qty,
          p_unit_of_measure: item.uom,
          p_unit_cost: item.unitCost,
          p_actor: user.id,
        });

      if (upsertError) {
        return apiErrorResponse(upsertError);
      }

      const budgetLine = (Array.isArray(upsertedLine)
        ? upsertedLine[0]
        : upsertedLine) as { id?: string } | null | undefined;
      if (!budgetLine?.id) {
        return NextResponse.json(
          { error: "Failed to create or update budget line" },
          { status: 500 },
        );
      }

      results.push(budgetLine);

      // Sensitive financial behavior: ensure line-level default FTC method follows project settings.
      const { error: defaultMethodError } = await supabase
        .from("budget_lines")
        .update({
          default_ftc_method: defaultFtcMethod,
          forecasting_enabled: true,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", budgetLine.id);
      if (defaultMethodError) {
        return apiErrorResponse(defaultMethodError);
      }
    }

    // Recalculate budget summary once (single aggregate query) after all writes.
    // This is safer than per-row updates and avoids stale total drift.
    const { data: allBudgetLines, error: totalsError } = await supabase
      .from("budget_lines")
      .select("original_amount")
      .eq("project_id", projectIdNum);

    const totalBudget = (allBudgetLines || []).reduce(
      (sum, line) => sum + (Number(line.original_amount) || 0),
      0,
    );

    if (!totalsError) {
      const { error: projectUpdateError } = await supabase
        .from("projects")
        .update({
          budget: totalBudget,
        })
        .eq("id", projectIdNum);

      if (projectUpdateError) {
        // Don't fail the request - line items were created successfully
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      totalBudget,
      message: `Successfully created ${results.length} budget line(s)`,
    });
    },
);
