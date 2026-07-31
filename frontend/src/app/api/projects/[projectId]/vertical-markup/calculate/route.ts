import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

interface MarkupItem {
  projectId: string;
  markup_type: string;
  percentage: number;
  compound: boolean;
  calculation_order: number;
}

interface CalculationResult {
  markup_type: string;
  percentage: number;
  compound: boolean;
  baseAmount: number;
  markupAmount: number;
  runningTotal: number;
}

/**
 * Calculate vertical markup with compound calculations
 *
 * For non-compound markups: markup is calculated on the base amount
 * For compound markups: markup is calculated on the running total (base + previous markups)
 *
 * Example with $100,000 base:
 * 1. Overhead 10% (non-compound): $100,000 * 10% = $10,000
 * 2. Profit 5% (compound): ($100,000 + $10,000) * 5% = $5,500
 * 3. Insurance 2% (compound): ($100,000 + $10,000 + $5,500) * 2% = $2,310
 * Total: $117,810
 */
function calculateMarkups(
  baseAmount: number,
  markups: MarkupItem[],
): {
  calculations: CalculationResult[];
  totalMarkup: number;
  finalAmount: number;
} {
  const sortedMarkups = [...markups].sort(
    (a, b) => a.calculation_order - b.calculation_order,
  );

  let runningTotal = baseAmount;
  let totalMarkup = 0;
  const calculations: CalculationResult[] = [];

  for (const markup of sortedMarkups) {
    const calculationBase = markup.compound ? runningTotal : baseAmount;
    const markupAmount = calculationBase * (markup.percentage / 100);

    runningTotal += markupAmount;
    totalMarkup += markupAmount;

    calculations.push({
      markup_type: markup.markup_type,
      percentage: markup.percentage,
      compound: markup.compound,
      baseAmount: calculationBase,
      markupAmount,
      runningTotal,
    });
  }

  return {
    calculations,
    totalMarkup,
    finalAmount: runningTotal,
  };
}

// POST /api/projects/[id]/vertical-markup/calculate - Calculate vertical markup for a given amount
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/vertical-markup/calculate#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { baseAmount } = body;

    if (baseAmount === undefined || typeof baseAmount !== "number") {
      return NextResponse.json(
        { error: "baseAmount is required and must be a number" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/vertical-markup/calculate#POST", message: "Authentication required." });
    }

    // Fetch project's vertical markup settings
    const { data: markups, error } = await supabase
      .from("vertical_markup")
      .select("*")
      .eq("project_id", projectIdNum)
      .order("calculation_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch vertical markup settings" },
        { status: 500 },
      );
    }

    if (!markups || markups.length === 0) {
      return NextResponse.json({
        baseAmount,
        calculations: [],
        totalMarkup: 0,
        finalAmount: baseAmount,
        message: "No vertical markup settings configured for this project",
      });
    }

    const normalizedMarkups: MarkupItem[] = markups.map((m) => ({
      projectId: String(m.project_id ?? ""),
      markup_type: m.markup_type,
      percentage: Number(m.percentage),
      compound: Boolean(m.compound),
      calculation_order: m.calculation_order,
    }));

    const result = calculateMarkups(baseAmount, normalizedMarkups);

    return NextResponse.json({
      baseAmount,
      ...result,
    });
    },
);
