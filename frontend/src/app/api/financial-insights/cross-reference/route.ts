import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { createAcumaticaClient } from "@/lib/acumatica/client";
import { logger } from "@/lib/logger";


/**
 * POST /api/financial-insights/cross-reference
 *
 * Performs a detailed budget cross-reference for a single project by
 * comparing Alleato budget line items against Acumatica budget data,
 * matching by cost code.
 *
 * Request body: { projectId: number }
 *
 * Returns:
 * {
 *   project: { id, name, acumaticaProjectId },
 *   summary: { alleatoTotal, acumaticaTotal, variance, variancePercent },
 *   lineItems: [
 *     { costCode, description, alleatoBudget, acumaticaActual, acumaticaCommitted, variance }
 *   ]
 * }
 */
export const POST = withApiGuardrails(
  "financial-insights/cross-reference#POST",
  async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "financial-insights/cross-reference#POST", message: "Authentication required." });
  }

  try {
    const body = await request.json();
    const { projectId } = body as { projectId?: number };

    if (!projectId || typeof projectId !== "number") {
      return NextResponse.json(
        { error: "Request body must include projectId as a number" },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // 1. Look up the project to get the Acumatica mapping.
    const { data: rawProject, error: projectError } = await serviceDb.from("projects")
      .select("id, name, acumatica_project_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) {
      logger.error({ msg: "[financial-insights/cross-reference] Project lookup failed", error: projectError.message });
      return NextResponse.json(
        { error: `Could not look up project: ${projectError.message}` },
        { status: 500 },
      );
    }

    if (!rawProject) {
      return NextResponse.json(
        { error: `Project with ID ${projectId} not found` },
        { status: 404 },
      );
    }

    const acumaticaProjectId = rawProject.acumatica_project_id;

    if (!acumaticaProjectId) {
      return NextResponse.json(
        {
          error: `Project "${rawProject.name ?? projectId}" does not have an Acumatica project ID configured. Please set the acumatica_project_id field on the project to enable cross-referencing with ERP data.`,
        },
        { status: 400 },
      );
    }

    // 2. Fetch Alleato budget line items with cost code details
    const { data: budgetLines, error: budgetError } = await serviceDb.from("budget_lines")
      .select(`
        id,
        original_amount,
        description,
        cost_code_id,
        cost_codes:cost_code_id (
          id,
          title
        )
      `)
      .eq("project_id", projectId);

    if (budgetError) {
      logger.error({ msg: "[financial-insights/cross-reference] Budget fetch failed", error: budgetError.message });
      return NextResponse.json(
        { error: `Could not fetch Alleato budget data: ${budgetError.message}` },
        { status: 500 },
      );
    }

    // 3. Fetch Acumatica budget summary
    const acumatica = createAcumaticaClient();
    try {
      await acumatica.login();
    } catch (loginErr) {
      logger.error({ msg: "[financial-insights/cross-reference] Acumatica login failed", error: loginErr instanceof Error ? loginErr.message : String(loginErr) });
      return NextResponse.json(
        { error: "Unable to connect to Acumatica ERP. Please try again later." },
        { status: 502 },
      );
    }

    let acuSummary;
    try {
      acuSummary = await acumatica.getProjectBudgetSummary(acumaticaProjectId);
    } catch (acuErr) {
      logger.error({ msg: "[financial-insights/cross-reference] Acumatica budget fetch failed", error: acuErr instanceof Error ? acuErr.message : String(acuErr) });
      return NextResponse.json(
        {
          error: `Failed to fetch Acumatica budget for project code "${acumaticaProjectId}": ${acuErr instanceof Error ? acuErr.message : String(acuErr)}`,
        },
        { status: 502 },
      );
    }

    // 4. Build cost code index from Acumatica expense lines.
    //    CostCode in Acumatica is something like "00-0000" or an account group identifier.
    const acuByCostCode = new Map<
      string,
      {
        actual: number;
        committed: number;
        revisedBudget: number;
        description: string;
      }
    >();

    for (const line of acuSummary.linesByType.expense) {
      const costCode = line.CostCode ?? line.AccountGroup ?? "UNKNOWN";
      const existing = acuByCostCode.get(costCode) ?? {
        actual: 0,
        committed: 0,
        revisedBudget: 0,
        description: line.Description ?? "",
      };
      existing.actual += line.ActualAmount ?? 0;
      existing.committed += line.RevisedCommittedAmount ?? 0;
      existing.revisedBudget += line.RevisedBudgetedAmount ?? 0;
      if (!existing.description && line.Description) {
        existing.description = line.Description;
      }
      acuByCostCode.set(costCode, existing);
    }

    // 5. Build Alleato cost code index
    const alleatoByCostCode = new Map<
      string,
      { budget: number; description: string }
    >();

    for (const line of budgetLines ?? []) {
      const costCodeId = line.cost_code_id;
      const costCodeData = line.cost_codes as
        | { id?: string; title?: string }
        | { id?: string; title?: string }[]
        | null;
      // cost_codes join may return an object or array depending on Supabase version
      const costCodeObj = Array.isArray(costCodeData) ? costCodeData[0] : costCodeData;
      const existing = alleatoByCostCode.get(costCodeId) ?? {
        budget: 0,
        description: costCodeObj?.title ?? line.description ?? "",
      };
      existing.budget += Number(line.original_amount) || 0;
      alleatoByCostCode.set(costCodeId, existing);
    }

    // 6. Merge into comparison line items
    const allCostCodes = new Set([
      ...alleatoByCostCode.keys(),
      ...acuByCostCode.keys(),
    ]);

    interface ComparisonLineItem {
      costCode: string;
      description: string;
      alleatoBudget: number;
      acumaticaActual: number;
      acumaticaCommitted: number;
      variance: number;
    }

    const lineItems: ComparisonLineItem[] = [];
    let alleatoTotal = 0;
    let acumaticaTotal = 0;

    for (const costCode of allCostCodes) {
      const alleato = alleatoByCostCode.get(costCode);
      const acu = acuByCostCode.get(costCode);

      const alleatoBudget = alleato?.budget ?? 0;
      const acumaticaActual = acu?.actual ?? 0;
      const acumaticaCommitted = acu?.committed ?? 0;
      const variance = alleatoBudget - acumaticaActual;

      alleatoTotal += alleatoBudget;
      acumaticaTotal += acumaticaActual;

      lineItems.push({
        costCode,
        description: alleato?.description ?? acu?.description ?? "",
        alleatoBudget,
        acumaticaActual,
        acumaticaCommitted,
        variance,
      });
    }

    // Sort by absolute variance descending (biggest variances first)
    lineItems.sort(
      (a, b) => Math.abs(b.variance) - Math.abs(a.variance),
    );

    const totalVariance = alleatoTotal - acumaticaTotal;
    const variancePercent =
      alleatoTotal > 0
        ? (totalVariance / alleatoTotal) * 100
        : 0;

    return NextResponse.json({
      project: {
        id: rawProject.id,
        name: rawProject.name,
        acumaticaProjectId,
      },
      summary: {
        alleatoTotal,
        acumaticaTotal,
        variance: totalVariance,
        variancePercent: Math.round(variancePercent * 100) / 100,
      },
      lineItems,
    });
  } catch (err) {
    logger.error({ msg: "[financial-insights/cross-reference] Unexpected error", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
  },
);
