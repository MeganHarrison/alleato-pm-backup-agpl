import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import { z } from "zod";
import { computeBudgetGrandTotals } from "@/lib/budget/compute-grand-totals";
import type { ForecastMethod } from "@/types/budget";

const forecastMethodSchema = z.enum([
  "automatic",
  "manual",
  "lump_sum",
  "monitored_resources",
]);

const saveForecastSchema = z.object({
  budgetLineId: z.string().uuid("budgetLineId must be a valid UUID"),
  forecastMethod: forecastMethodSchema,
  forecastAmount: z.number().min(0).optional(),
  notes: z.string().max(10000).nullable().optional(),
  lineItems: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        description: z.string().max(2000).default(""),
        quantity: z.number().min(0).default(1),
        units: z.string().max(32).optional(),
        unitCost: z.number().min(0).default(0),
        utilizationRate: z.number().min(0).max(100).nullable().optional(),
        startDate: z.string().date().nullable().optional(),
        endDate: z.string().date().nullable().optional(),
        unitsRemainingMode: z.enum(["weeks", "months"]).nullable().optional(),
        sortOrder: z.number().int().min(0).optional(),
      }),
    )
    .optional(),
});

type ForecastDetailLineItem = {
  id: string;
  description: string;
  quantity: number;
  units: string | null;
  unitCost: number;
  utilizationRate: number | null;
  startDate: string | null;
  endDate: string | null;
  unitsRemainingMode: "weeks" | "months" | null;
  sortOrder: number;
};

type RuntimeForecastLineItemClient = {
  from: (table: "budget_forecast_line_items") => {
    select: (query: string) => {
      eq: (column: string, value: unknown) => {
        eq: (column2: string, value2: unknown) => {
          order: (
            orderBy: string,
            options?: { ascending?: boolean },
          ) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
        order: (
          orderBy: string,
          options?: { ascending?: boolean },
        ) => Promise<{ data: unknown[] | null; error: unknown }>;
        delete?: never;
      };
      delete: () => {
        eq: (column: string, value: unknown) => {
          eq: (column2: string, value2: unknown) => Promise<{ error: unknown }>;
          then?: never;
        };
      };
    };
    delete: () => {
      eq: (column: string, value: unknown) => Promise<{ error: unknown }>;
    };
    insert: (
      rows: Array<Record<string, unknown>>,
    ) => Promise<{ error: unknown }>;
  };
};

// Detects missing-table schema cache errors to return actionable guidance.
function isMissingTableError(error: unknown, tableName: string): boolean {
  const serialized = JSON.stringify(error);
  return (
    serialized.includes(tableName) ||
    serialized.includes("PGRST205") ||
    serialized.includes("schema cache")
  );
}

// Parses and validates route project ids for forecast endpoints.
function parseProjectId(projectId: string, where: string): number {
  const parsed = parseInt(projectId, 10);
  if (Number.isNaN(parsed)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: "Invalid project ID.",
      details: [{ path: "projectId", message: "Project ID must be numeric." }],
    });
  }
  return parsed;
}

/**
 * GET /api/projects/[id]/budget/forecast
 *
 * Calculates budget forecast based on current trends
 * Returns:
 * - Projected budget (revised budget + pending changes)
 * - Projected costs (direct + committed + pending cost changes)
 * - Projected variance
 * - Forecast by cost code
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/budget/forecast#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseProjectId(
      projectId,
      "projects/[projectId]/budget/forecast#GET",
    );

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const budgetLineIdParam = request.nextUrl.searchParams.get("budgetLineId");
    if (budgetLineIdParam) {
      return getForecastLineDetail(projectIdNum, budgetLineIdParam);
    }

    const supabase = await createClient();
    const { lineItems } = await computeBudgetGrandTotals(supabase, projectIdNum);

    // Calculate forecasts
    let totalProjectedBudget = 0;
    let totalProjectedCosts = 0;
    let totalProjectedCostToComplete = 0;
    let totalEstimatedCostAtCompletion = 0;
    let totalOriginalBudget = 0;
    let totalRevisedBudget = 0;

    const forecastByCostCode: Array<{
      budgetLineId: string;
      costCode: string;
      costCodeName: string;
      forecastMethod: ForecastMethod;
      notes: string | null;
      projectedBudget: number;
      projectedCosts: number;
      projectedCostToComplete: number;
      estimatedCostAtCompletion: number;
      projectedVariance: number;
      forecastStartDate: string | null;
      forecastEndDate: string | null;
    }> = [];

    lineItems.forEach((line) => {
      const original = Number(line.originalBudgetAmount) || 0;
      const revised = Number(line.revisedBudget) || original;
      const projectedBudget = Number(line.projectedBudget) || revised;
      const projectedCosts = Number(line.projectedCosts) || 0;
      const projectedCostToComplete =
        Number(line.forecastToComplete) || Math.max(0, projectedBudget - projectedCosts);
      const estimatedCostAtCompletion =
        Number(line.estimatedCostAtCompletion) || projectedCosts + projectedCostToComplete;
      const projectedVariance =
        Number(line.projectedOverUnder) || projectedBudget - estimatedCostAtCompletion;

      totalOriginalBudget += original;
      totalRevisedBudget += revised;
      totalProjectedBudget += projectedBudget;
      totalProjectedCosts += projectedCosts;
      totalProjectedCostToComplete += projectedCostToComplete;
      totalEstimatedCostAtCompletion += estimatedCostAtCompletion;

      if (line.costCode) {
        forecastByCostCode.push({
          budgetLineId: line.id ?? "",
          costCode: line.costCode,
          costCodeName: line.costCodeDescription || "",
          forecastMethod: (line.forecastMethod as ForecastMethod) || "automatic",
          notes: line.forecastNotes ?? null,
          projectedBudget,
          projectedCosts,
          projectedCostToComplete,
          estimatedCostAtCompletion,
          projectedVariance,
          // Date columns for time-phased forecasting (Procore parity).
          // Backed by future budget_lines.forecast_start_date / forecast_end_date columns;
          // null until the schema migration lands and lines are populated.
          forecastStartDate: null,
          forecastEndDate: null,
        });
      }
    });

    const totalProjectedVariance = totalProjectedBudget - totalEstimatedCostAtCompletion;

    return NextResponse.json({
      summary: {
        totalOriginalBudget,
        totalRevisedBudget,
        totalProjectedBudget,
        totalProjectedCosts,
        totalProjectedCostToComplete,
        totalEstimatedCostAtCompletion,
        totalProjectedVariance,
        variancePercentage:
          totalProjectedBudget > 0
            ? (totalProjectedVariance / totalProjectedBudget) * 100
            : 0,
      },
      forecastByCostCode,
      generatedAt: new Date().toISOString(),
    });
    },
);

/**
 * POST /api/projects/[id]/budget/forecast
 *
 * Persists per-line FTC settings and values.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/budget/forecast#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const where = "projects/[projectId]/budget/forecast#POST";
    const projectIdNum = parseProjectId(projectId, where);

    const guard = await requirePermission(projectIdNum, "budget", "write");
    if (guard.denied) return guard.response;

    const body = await request.json();
    const parsed = saveForecastSchema.safeParse(body);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: "Invalid forecast payload.",
        details: parsed.error.flatten(),
      });
    }

    const {
      budgetLineId,
      forecastMethod,
      forecastAmount,
      notes,
      lineItems: forecastLineItems = [],
    } = parsed.data;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    const { data: line, error: lineError } = await supabase
      .from("budget_lines")
      .select("id, project_id")
      .eq("id", budgetLineId)
      .single();

    if (lineError || !line) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: "Budget line item not found.",
        status: 404,
        severity: "low",
      });
    }

    if (line.project_id !== projectIdNum) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where,
        message: "Budget line does not belong to this project.",
      });
    }

    const { lineItems: computedLineItems } = await computeBudgetGrandTotals(
      supabase,
      projectIdNum,
    );
    const budgetLine = computedLineItems.find((item) => item.id === budgetLineId);
    if (!budgetLine) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: "Budget line could not be resolved for forecast save.",
        status: 404,
        severity: "low",
      });
    }

    const autoForecast = Math.max(
      0,
      Number(budgetLine.projectedBudget) - Number(budgetLine.projectedCosts),
    );
    const resolvedAmount = resolveForecastAmount(
      forecastMethod,
      autoForecast,
      forecastAmount,
      forecastLineItems,
    );

    const today = new Date().toISOString().slice(0, 10);

    // Sensitive data-write path: forecast mode impacts financial rollups.
    const { error: methodUpdateError } = await supabase
      .from("budget_lines")
      .update({
        default_ftc_method: forecastMethod,
        forecasting_enabled: true,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", budgetLineId)
      .eq("project_id", projectIdNum);

    if (methodUpdateError) {
      throw methodUpdateError;
    }

    const runtimeForecastClient =
      supabase as unknown as RuntimeForecastLineItemClient;

    const { error: deleteDetailItemsError } = await runtimeForecastClient
      .from("budget_forecast_line_items")
      .delete()
      .eq("budget_line_id", budgetLineId);

    if (deleteDetailItemsError) {
      if (isMissingTableError(deleteDetailItemsError, "budget_forecast_line_items")) {
        throw new GuardrailError({
          code: "DB_MIGRATION_MISMATCH",
          where: "projects/[projectId]/budget/forecast#POST",
          message:
            "Budget forecast detail table is missing from the runtime database.",
          details: {
            table: "budget_forecast_line_items",
            originalError: deleteDetailItemsError,
          },
        });
      }
      throw deleteDetailItemsError;
    }

    const { error: existingDeleteError } = await supabase
      .from("cost_forecasts")
      .delete()
      .eq("budget_item_id", budgetLineId)
      .eq("forecast_date", today);

    if (existingDeleteError) {
      throw existingDeleteError;
    }

    const { error: insertError } = await supabase
      .from("cost_forecasts")
      .insert({
        budget_item_id: budgetLineId,
        forecast_date: today,
        forecast_to_complete: resolvedAmount,
        notes: notes ?? null,
        created_by: user.id,
      });

    if (insertError) {
      throw insertError;
    }

    if (
      (forecastMethod === "manual" || forecastMethod === "monitored_resources") &&
      forecastLineItems.length > 0
    ) {
      const rows = forecastLineItems.map((item, index) => ({
        project_id: projectIdNum,
        budget_line_id: budgetLineId,
        forecast_date: today,
        method: forecastMethod,
        description: item.description ?? "",
        quantity: item.quantity ?? 1,
        units: item.units ?? (forecastMethod === "manual" ? "ls" : "weeks"),
        unit_cost: item.unitCost ?? 0,
        utilization_rate: item.utilizationRate ?? null,
        start_date: item.startDate ?? null,
        end_date: item.endDate ?? null,
        units_remaining_mode: item.unitsRemainingMode ?? null,
        sort_order: item.sortOrder ?? index,
        created_by: user.id,
        updated_by: user.id,
      }));

      const { error: lineInsertError } = await runtimeForecastClient
        .from("budget_forecast_line_items")
        .insert(rows);

      if (lineInsertError) {
        if (isMissingTableError(lineInsertError, "budget_forecast_line_items")) {
          throw new GuardrailError({
            code: "INTERNAL_ERROR",
            where,
            message:
              "Forecast detail table is missing. Apply the latest Supabase migrations before saving monitored/manual forecast line items.",
            status: 500,
            severity: "high",
          });
        }
        throw lineInsertError;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        budgetLineId,
        forecastMethod,
        forecastAmount: resolvedAmount,
        notes: notes ?? null,
        lineItems: forecastLineItems,
      },
    });
  },
);

// Resolves a safe FTC amount from method, optional user override, and detail rows.
function resolveForecastAmount(
  method: ForecastMethod,
  autoForecast: number,
  userAmount?: number,
  lineItems: Array<{
    quantity: number;
    unitCost: number;
    startDate?: string | null;
    endDate?: string | null;
    unitsRemainingMode?: "weeks" | "months" | null;
    utilizationRate?: number | null;
  }> = [],
): number {
  if (method === "automatic") {
    return autoForecast;
  }
  if (method === "manual" && lineItems.length > 0) {
    return lineItems.reduce(
      (sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitCost) || 0),
      0,
    );
  }
  if (method === "monitored_resources" && lineItems.length > 0) {
    const today = new Date();
    return lineItems.reduce(
      (sum, item) => sum + computeMonitoredRemainingAmount(item, today),
      0,
    );
  }
  if (typeof userAmount === "number" && Number.isFinite(userAmount) && userAmount >= 0) {
    return userAmount;
  }
  return autoForecast;
}

// Computes monitored-resource FTC drawdown based on dates and cadence.
function computeMonitoredRemainingAmount(
  item: {
    unitCost: number;
    utilizationRate?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    unitsRemainingMode?: "weeks" | "months" | null;
  },
  today: Date,
): number {
  const unitCost = Math.max(0, Number(item.unitCost) || 0);
  const utilization = item.utilizationRate == null ? 100 : Math.max(0, Number(item.utilizationRate));
  const calculatedUnitCost = unitCost * (utilization / 100);
  const mode = item.unitsRemainingMode ?? "weeks";
  const start = item.startDate ? new Date(`${item.startDate}T00:00:00Z`) : null;
  const end = item.endDate ? new Date(`${item.endDate}T00:00:00Z`) : null;

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return calculatedUnitCost;
  }

  const totalUnits = mode === "months"
    ? monthUnitsInclusive(start, end)
    : weekUnitsInclusive(start, end);
  const elapsedUnits = mode === "months"
    ? elapsedMonthUnits(start, today)
    : elapsedWeekUnits(start, today);
  const unitsRemaining = Math.max(0, totalUnits - elapsedUnits);
  return calculatedUnitCost * unitsRemaining;
}

// Computes week buckets without pro-rating (8 days -> 2 weeks).
function weekUnitsInclusive(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayCount = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
  return Math.max(1, Math.ceil(dayCount / 7));
}

// Computes elapsed full week buckets since start date.
function elapsedWeekUnits(start: Date, today: Date): number {
  if (today <= start) return 0;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / msPerWeek));
}

// Computes month buckets (inclusive) without partial-month pro-rating.
function monthUnitsInclusive(start: Date, end: Date): number {
  const years = end.getUTCFullYear() - start.getUTCFullYear();
  const months = end.getUTCMonth() - start.getUTCMonth();
  return Math.max(1, years * 12 + months + 1);
}

// Computes elapsed full month buckets since start date.
function elapsedMonthUnits(start: Date, today: Date): number {
  if (today <= start) return 0;
  const years = today.getUTCFullYear() - start.getUTCFullYear();
  const months = today.getUTCMonth() - start.getUTCMonth();
  return Math.max(0, years * 12 + months);
}

// Returns forecast detail for a specific budget line (used by FTC modal).
async function getForecastLineDetail(projectIdNum: number, budgetLineId: string) {
  const parsedBudgetLineId = z.string().uuid().safeParse(budgetLineId);
  if (!parsedBudgetLineId.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "projects/[projectId]/budget/forecast#GET",
      message: "Invalid budgetLineId query parameter.",
      details: parsedBudgetLineId.error.flatten(),
    });
  }

  const supabase = await createClient();

  const { data: line, error: lineError } = await supabase
    .from("budget_lines")
    .select("id, project_id, default_ftc_method")
    .eq("id", parsedBudgetLineId.data)
    .single();

  if (lineError || !line) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "projects/[projectId]/budget/forecast#GET",
      message: "Budget line item not found.",
      status: 404,
      severity: "low",
    });
  }
  if (line.project_id !== projectIdNum) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where: "projects/[projectId]/budget/forecast#GET",
      message: "Budget line does not belong to this project.",
    });
  }

  const { lineItems } = await computeBudgetGrandTotals(supabase, projectIdNum);
  const budgetLine = lineItems.find((item) => item.id === parsedBudgetLineId.data);

  const { data: latestForecast, error: latestForecastError } = await supabase
    .from("cost_forecasts")
    .select("forecast_date, notes")
    .eq("budget_item_id", parsedBudgetLineId.data)
    .order("forecast_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestForecastError) {
    throw latestForecastError;
  }

  const runtimeForecastClient =
    supabase as unknown as RuntimeForecastLineItemClient;
  const forecastDate = latestForecast?.forecast_date ?? new Date().toISOString().slice(0, 10);
  const { data: detailRows, error: detailRowsError } = await runtimeForecastClient
    .from("budget_forecast_line_items")
    .select(
      "id, description, quantity, units, unit_cost, utilization_rate, start_date, end_date, units_remaining_mode, sort_order",
    )
    .eq("budget_line_id", parsedBudgetLineId.data)
    .eq("forecast_date", forecastDate)
    .order("sort_order", { ascending: true });

  if (detailRowsError) {
    if (!isMissingTableError(detailRowsError, "budget_forecast_line_items")) {
      throw detailRowsError;
    }
  }

  const normalizedLineItems: ForecastDetailLineItem[] = (detailRows || []).map(
    (row) => {
      const typed = row as Record<string, unknown>;
      return {
        id: String(typed.id ?? ""),
        description: String(typed.description ?? ""),
        quantity: Number(typed.quantity ?? 0),
        units: (typed.units as string | null) ?? null,
        unitCost: Number(typed.unit_cost ?? 0),
        utilizationRate:
          typed.utilization_rate == null ? null : Number(typed.utilization_rate),
        startDate: (typed.start_date as string | null) ?? null,
        endDate: (typed.end_date as string | null) ?? null,
        unitsRemainingMode:
          (typed.units_remaining_mode as "weeks" | "months" | null) ?? null,
        sortOrder: Number(typed.sort_order ?? 0),
      };
    },
  );

  return NextResponse.json({
    budgetLineId: parsedBudgetLineId.data,
    forecastMethod:
      (line.default_ftc_method as ForecastMethod | null) ?? "automatic",
    forecastAmount: budgetLine?.forecastToComplete ?? 0,
    projectedBudget: budgetLine?.projectedBudget ?? 0,
    projectedCosts: budgetLine?.projectedCosts ?? 0,
    notes: latestForecast?.notes ?? null,
    lineItems: normalizedLineItems,
  });
}
