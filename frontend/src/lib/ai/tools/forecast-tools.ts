import { tool } from "ai";
import { z } from "zod";
import { type ToolTracePayload, asNumber, resolveProject, withTrace as _withTrace } from "./tool-utils";
import { createToolContext, type ToolContext } from "./tool-context";

import { type AnyRow } from "./types";

type CreateForecastToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  pinnedProjectId?: number;
  // Injected data seam; defaults to building a real context when omitted.
  ctx?: ToolContext;
};

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateForecastToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "This financial data source failed during retrieval. Be explicit about the missing source and do not invent totals.",
  );
}

export function createForecastTools(
  userId: string,
  options: CreateForecastToolsOptions = {},
) {
  const ctx = options.ctx ?? createToolContext({ userId, pinnedProjectId: options.pinnedProjectId });
  const supabase = ctx.db;
  const guardrails = ctx.guardrails;

  return {
    getForecastComparison: tool({
      description:
        "Compare original budget vs. revised budget vs. actual costs for a project. " +
        "Shows budget line-by-line variance, cost code analysis, and over/under budget items. " +
        "Use when asked about forecast, budget vs actual, variance analysis, " +
        "or which cost codes are over budget.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        sortBy: z
          .enum(["variance", "amount", "code"])
          .optional()
          .default("variance")
          .describe("Sort budget lines by variance (default), amount, or code"),
      }),
      execute: withTrace(
        "getForecastComparison",
        options,
        async ({ projectId, projectName, sortBy }) => {
          const resolved = await resolveProject(
            supabase,
            guardrails,
            projectId,
            projectName,
          );
          if ("error" in resolved) return resolved;

          // Fetch budget lines with full financial data
          const { data: budgetRows, error } = await supabase
            .from("v_budget_lines" as never)
            .select("*")
            .eq("project_id", resolved.id) as { data: Array<Record<string, unknown>> | null; error: { message: string } | null };

          if (error) return { error: error.message };
          const lines = (budgetRows ?? []) as AnyRow[];

          // Compute per-line variance
          const enrichedLines = lines.map((line) => {
            const original = asNumber(line.original_amount);
            const revised = asNumber(line.revised_budget);
            const approvedCOs = asNumber(line.approved_co_total);
            const budgetMods = asNumber(line.budget_mod_total);
            const variance = revised - original;
            const variancePct =
              original > 0
                ? Math.round((variance / original) * 100)
                : 0;

            return {
              costCode: line.cost_code,
              description: line.description,
              originalBudget: original,
              revisedBudget: revised,
              approvedCOs,
              budgetModifications: budgetMods,
              variance,
              variancePct,
              isOverBudget: variance > 0,
            };
          });

          // Sort
          if (sortBy === "variance") {
            enrichedLines.sort(
              (a, b) => Math.abs(b.variance) - Math.abs(a.variance),
            );
          } else if (sortBy === "amount") {
            enrichedLines.sort((a, b) => b.revisedBudget - a.revisedBudget);
          } else {
            enrichedLines.sort((a, b) =>
              ((a.costCode as string) ?? "").localeCompare(
                (b.costCode as string) ?? "",
              ),
            );
          }

          // Portfolio totals
          const totalOriginal = enrichedLines.reduce(
            (sum, l) => sum + l.originalBudget,
            0,
          );
          const totalRevised = enrichedLines.reduce(
            (sum, l) => sum + l.revisedBudget,
            0,
          );
          const totalVariance = totalRevised - totalOriginal;
          const overBudgetItems = enrichedLines.filter((l) => l.isOverBudget);
          const underBudgetItems = enrichedLines.filter(
            (l) => l.variance < 0,
          );

          return {
            project: { id: resolved.id, name: resolved.name },
            summary: {
              totalBudgetLines: lines.length,
              totalOriginalBudget: totalOriginal,
              totalRevisedBudget: totalRevised,
              totalVariance,
              variancePct:
                totalOriginal > 0
                  ? Math.round((totalVariance / totalOriginal) * 100)
                  : 0,
              overBudgetLineCount: overBudgetItems.length,
              underBudgetLineCount: underBudgetItems.length,
            },
            topVariances: enrichedLines.slice(0, 20),
            overBudgetItems: overBudgetItems.slice(0, 10).map((l) => ({
              costCode: l.costCode,
              description: l.description,
              original: l.originalBudget,
              revised: l.revisedBudget,
              variance: l.variance,
              variancePct: l.variancePct,
            })),
          };
        },
      ),
    }),
  };
}
