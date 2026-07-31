import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import { z } from "zod";

const settingsSchema = z.object({
  redNegativeValues: z.boolean(),
  autocalculateForecastToComplete: z.boolean(),
  enableAdvancedForecasting: z.boolean(),
  allowModifyingGrandTotal: z.boolean(),
});

type ProjectBudgetSettingsRow = {
  red_negative_values: boolean;
  autocalculate_forecast_to_complete: boolean;
  enable_advanced_forecasting: boolean;
  allow_modifying_grand_total: boolean;
};

type RuntimeProjectBudgetSettingsClient = {
  from: (table: "project_budget_settings") => {
    select: (query: string) => {
      eq: (
        column: "project_id",
        value: number,
      ) => {
        maybeSingle: () => Promise<{
          data: ProjectBudgetSettingsRow | null;
          error: unknown;
        }>;
      };
    };
    upsert: (
      row: Record<string, unknown>,
      options: { onConflict: string },
    ) => Promise<{ error: unknown }>;
  };
};

// Detects schema-cache missing-table errors for clearer operator guidance.
function isMissingTableError(error: unknown, tableName: string): boolean {
  const serialized = JSON.stringify(error);
  return (
    serialized.includes(tableName) ||
    serialized.includes("PGRST205") ||
    serialized.includes("schema cache")
  );
}

// Parses project ids safely for budget settings requests.
function parseProjectId(projectId: string, where: string): number {
  const parsed = parseInt(projectId, 10);
  if (Number.isNaN(parsed)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: "Invalid project ID.",
      details: [{ path: "projectId", message: "Project ID must be a number." }],
    });
  }
  return parsed;
}

// Loads persisted settings or default values for a project budget.
export const GET = withApiGuardrails(
  "projects/[projectId]/budget/settings#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const where = "projects/[projectId]/budget/settings#GET";
    const projectIdNum = parseProjectId(projectId, where);

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const runtimeSettingsClient =
      supabase as unknown as RuntimeProjectBudgetSettingsClient;
    const { data, error } = await runtimeSettingsClient
      .from("project_budget_settings")
      .select(
        "red_negative_values, autocalculate_forecast_to_complete, enable_advanced_forecasting, allow_modifying_grand_total",
      )
      .eq("project_id", projectIdNum)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error, "project_budget_settings")) {
        return NextResponse.json({
          redNegativeValues: true,
          autocalculateForecastToComplete: true,
          enableAdvancedForecasting: true,
          allowModifyingGrandTotal: false,
        });
      }
      throw error;
    }

    return NextResponse.json({
      redNegativeValues: data?.red_negative_values ?? true,
      autocalculateForecastToComplete:
        data?.autocalculate_forecast_to_complete ?? true,
      enableAdvancedForecasting: data?.enable_advanced_forecasting ?? true,
      allowModifyingGrandTotal: data?.allow_modifying_grand_total ?? false,
    });
  },
);

// Persists budget settings for this project.
export const PUT = withApiGuardrails(
  "projects/[projectId]/budget/settings#PUT",
  async ({ request, params }) => {
    const { projectId } = await params;
    const where = "projects/[projectId]/budget/settings#PUT";
    const projectIdNum = parseProjectId(projectId, where);

    const guard = await requirePermission(projectIdNum, "budget", "admin");
    if (guard.denied) return guard.response;

    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: "Invalid budget settings payload.",
        details: parsed.error.flatten(),
      });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    // Sensitive settings write: affects forecast defaults and financial UX behavior.
    const runtimeSettingsClient =
      supabase as unknown as RuntimeProjectBudgetSettingsClient;
    const { error } = await runtimeSettingsClient
      .from("project_budget_settings")
      .upsert(
        {
          project_id: projectIdNum,
          red_negative_values: parsed.data.redNegativeValues,
          autocalculate_forecast_to_complete:
            parsed.data.autocalculateForecastToComplete,
          enable_advanced_forecasting: parsed.data.enableAdvancedForecasting,
          allow_modifying_grand_total: parsed.data.allowModifyingGrandTotal,
          updated_by: user.id,
        },
        {
          onConflict: "project_id",
        },
      );

    if (error) {
      if (isMissingTableError(error, "project_budget_settings")) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message:
            "Project budget settings table is missing. Apply the latest Supabase migrations before saving budget settings.",
          status: 500,
          severity: "high",
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      settings: parsed.data,
    });
  },
);
