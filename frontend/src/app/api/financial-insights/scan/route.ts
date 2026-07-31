import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import { createAcumaticaClient } from "@/lib/acumatica/client";
import type { ProjectBudgetSummary } from "@/lib/acumatica/types";
import type { Database, Json } from "@/types/database.types";
import {
  resolveTargetIdsForProjects,
  severityToConfidence,
} from "@/lib/ai/insight-cards";

type InsightCardInsert = Database["public"]["Tables"]["insight_cards"]["Insert"];

/**
 * Internal draft type — captures the fields we know about a financial alert
 * before we resolve project_id → primary_target_id.
 */
type FinancialAlertDraft = {
  projectId: number;
  projectName: string;
  title: string;
  summary: string;
  severity: "critical" | "warning" | "info";
  cardType: "financial_exposure";
  financialImpact: number;
  businessImpact: string;
  metadata: Record<string, unknown>;
};

/**
 * POST /api/financial-insights/scan
 *
 * Triggers a budget health scan across all projects that have an
 * acumatica_project_id. For each project it compares Alleato budget data
 * against Acumatica actuals and writes Pipeline B insight_cards for:
 *   - Budget overruns (actual > budget)
 *   - Budget mismatches (Alleato budget vs Acumatica revised budget >10% diff)
 *   - Negative net position (expenses > income)
 *
 * Returns: { scanned: number, alertsGenerated: number, errors: string[] }
 */
export const POST = withApiGuardrails(
  "financial-insights/scan#POST",
  async () => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "financial-insights/scan#POST", message: "Authentication required." });
  }

  const supabase = createServiceClient();
  const errors: string[] = [];
  let scannedCount = 0;
  let alertsGenerated = 0;

  try {
    // Fetch all projects that have an Acumatica project mapping.
    // The acumatica_project_id column stores the ERP project code (e.g. "25108").
    const { data: rawProjects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, budget, acumatica_project_id")
      .not("acumatica_project_id", "is", null)
      .neq("acumatica_project_id", "");

    if (projectsError) {
      logger.error({ msg: "[financial-insights/scan] Failed to fetch projects", error: projectsError.message });
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500 },
      );
    }

    const projects = rawProjects ?? [];

    if (projects.length === 0) {
      return NextResponse.json({
        scanned: 0,
        alertsGenerated: 0,
        errors: ["No projects with acumatica_project_id found"],
      });
    }

    // Resolve all project ids → intelligence_targets ids once up front.
    const targetMap = await resolveTargetIdsForProjects(
      supabase,
      projects.map((p) => p.id),
    );

    // Initialize Acumatica client
    const acumatica = createAcumaticaClient();
    try {
      await acumatica.login();
    } catch (loginErr) {
      logger.error({ msg: "[financial-insights/scan] Acumatica login failed", error: loginErr instanceof Error ? loginErr.message : String(loginErr) });
      return NextResponse.json(
        {
          scanned: 0,
          alertsGenerated: 0,
          errors: [
            `Acumatica login failed: ${loginErr instanceof Error ? loginErr.message : String(loginErr)}`,
          ],
        },
        { status: 502 },
      );
    }

    // Process each project
    for (const project of projects) {
      const acumaticaProjectId = project.acumatica_project_id;
      if (!acumaticaProjectId) continue;

      const projectName = project.name ?? `Project ${project.id}`;

      try {
        scannedCount++;

        // 1. Fetch Alleato budget data
        const { data: budgetLines } = await supabase
          .from("budget_lines")
          .select("original_amount")
          .eq("project_id", project.id);

        const alleatoBudgetTotal = (budgetLines ?? []).reduce(
          (sum, line) => sum + (Number(line.original_amount) || 0),
          0,
        );

        // 2. Fetch Acumatica budget summary
        let acuSummary: ProjectBudgetSummary;
        try {
          acuSummary = await acumatica.getProjectBudgetSummary(acumaticaProjectId);
        } catch (acuErr) {
          const msg = `Acumatica fetch failed for project ${projectName} (${acumaticaProjectId}): ${acuErr instanceof Error ? acuErr.message : String(acuErr)}`;
          logger.error({ msg: `[financial-insights/scan] ${msg}` });
          errors.push(msg);
          continue;
        }

        const drafts: FinancialAlertDraft[] = [];

        // 3a. Check: Budget Overrun — Acumatica actual cost > Alleato budget
        if (alleatoBudgetTotal > 0 && acuSummary.totals.actualCosts > alleatoBudgetTotal) {
          const overrunPercent = (acuSummary.totals.actualCosts / alleatoBudgetTotal) * 100;
          let severity: "critical" | "warning" | "info";
          if (overrunPercent > 150) {
            severity = "critical";
          } else if (overrunPercent > 120) {
            severity = "warning";
          } else {
            severity = "info";
          }

          const overrunAmount = acuSummary.totals.actualCosts - alleatoBudgetTotal;

          drafts.push({
            projectId: project.id,
            projectName,
            title: `Budget Overrun: ${projectName}`,
            summary: `Acumatica actual costs ($${acuSummary.totals.actualCosts.toLocaleString()}) exceed the Alleato budget ($${alleatoBudgetTotal.toLocaleString()}) by ${overrunPercent.toFixed(1)}%. Overrun amount: $${overrunAmount.toLocaleString()}.`,
            severity,
            cardType: "financial_exposure",
            financialImpact: overrunAmount,
            businessImpact: severity === "critical"
              ? "Severe cost overrun requiring immediate executive attention"
              : "Budget variance detected — review recommended",
            metadata: {
              alert_subtype: "budget_overrun",
              alleato_budget: alleatoBudgetTotal,
              acumatica_actual: acuSummary.totals.actualCosts,
              overrun_percent: overrunPercent,
              acumatica_project_id: acumaticaProjectId,
              financial_impact: overrunAmount,
              scan_timestamp: new Date().toISOString(),
            },
          });
        }

        // 3b. Check: Budget Mismatch — Alleato budget vs Acumatica revised budget >10%
        if (alleatoBudgetTotal > 0 && acuSummary.totals.revisedBudget > 0) {
          const diff = Math.abs(alleatoBudgetTotal - acuSummary.totals.revisedBudget);
          const diffPercent = (diff / alleatoBudgetTotal) * 100;

          if (diffPercent > 10) {
            drafts.push({
              projectId: project.id,
              projectName,
              title: `Budget Mismatch: ${projectName}`,
              summary: `Alleato budget ($${alleatoBudgetTotal.toLocaleString()}) and Acumatica revised budget ($${acuSummary.totals.revisedBudget.toLocaleString()}) differ by ${diffPercent.toFixed(1)}% ($${diff.toLocaleString()}).`,
              severity: "warning",
              cardType: "financial_exposure",
              financialImpact: diff,
              businessImpact: "Budget records are out of sync between systems — reconciliation needed",
              metadata: {
                alert_subtype: "budget_mismatch",
                alleato_budget: alleatoBudgetTotal,
                acumatica_revised_budget: acuSummary.totals.revisedBudget,
                difference_percent: diffPercent,
                acumatica_project_id: acumaticaProjectId,
                financial_impact: diff,
                scan_timestamp: new Date().toISOString(),
              },
            });
          }
        }

        // 3c. Check: Negative Net Position — expenses > income
        if (acuSummary.totals.expenses > acuSummary.totals.income && acuSummary.totals.expenses > 0) {
          const deficit = acuSummary.totals.expenses - acuSummary.totals.income;
          const severity: "critical" | "warning" = deficit > 100_000 ? "critical" : "warning";

          drafts.push({
            projectId: project.id,
            projectName,
            title: `Negative Net Position: ${projectName}`,
            summary: `Project expenses ($${acuSummary.totals.expenses.toLocaleString()}) exceed income ($${acuSummary.totals.income.toLocaleString()}) by $${deficit.toLocaleString()}.`,
            severity,
            cardType: "financial_exposure",
            financialImpact: deficit,
            businessImpact: severity === "critical"
              ? "Significant cash flow deficit — immediate review required"
              : "Project is currently operating at a loss",
            metadata: {
              alert_subtype: "negative_net_position",
              acumatica_income: acuSummary.totals.income,
              acumatica_expenses: acuSummary.totals.expenses,
              deficit,
              acumatica_project_id: acumaticaProjectId,
              financial_impact: deficit,
              scan_timestamp: new Date().toISOString(),
            },
          });
        }

        // 4. Upsert alerts — use title + primary_target_id as natural key
        const targetId = targetMap.get(project.id);
        if (!targetId) {
          // No active intelligence_target for this project. Skip — we cannot
          // write an insight_card without a target.
          if (drafts.length > 0) {
            errors.push(
              `No active intelligence_target for project ${projectName} (id ${project.id}); skipped ${drafts.length} alert(s).`,
            );
          }
          continue;
        }

        const nowIso = new Date().toISOString();

        for (const draft of drafts) {
          // Look up existing card by title + target — equivalent to old
          // (title, project_id) natural key.
          const { data: existing } = await supabase
            .from("insight_cards")
            .select("id")
            .eq("title", draft.title)
            .eq("primary_target_id", targetId)
            .in("card_type", ["financial_exposure", "risk", "change_management"])
            .maybeSingle();

          if (existing) {
            const { error: updateError } = await supabase
              .from("insight_cards")
              .update({
                summary: draft.summary,
                why_it_matters: draft.businessImpact,
                confidence: severityToConfidence(draft.severity),
                current_status: "open",
                last_seen_at: nowIso,
                metadata: draft.metadata as Json,
                compiler_version: "financial_insights_scan_v1",
              })
              .eq("id", existing.id);

            if (updateError) {
              logger.error({ msg: `[financial-insights/scan] Failed to update alert for ${draft.projectName}`, error: updateError.message });
              errors.push(`Failed to update alert "${draft.title}": ${updateError.message}`);
            } else {
              alertsGenerated++;
            }
          } else {
            const insert: InsightCardInsert = {
              primary_target_id: targetId,
              card_type: draft.cardType,
              title: draft.title,
              summary: draft.summary,
              why_it_matters: draft.businessImpact,
              confidence: severityToConfidence(draft.severity),
              current_status: "open",
              attribution_status: "auto_assigned",
              first_seen_at: nowIso,
              last_seen_at: nowIso,
              source_count: 1,
              compiler_version: "financial_insights_scan_v1",
              metadata: draft.metadata as Json,
            };

            const { error: insertError } = await supabase
              .from("insight_cards")
              .insert(insert);

            if (insertError) {
              logger.error({ msg: `[financial-insights/scan] Failed to insert alert for ${draft.projectName}`, error: insertError.message });
              errors.push(`Failed to insert alert "${draft.title}": ${insertError.message}`);
            } else {
              alertsGenerated++;
            }
          }
        }
      } catch (projectErr) {
        const msg = `Unexpected error scanning project ${projectName} (ID: ${project.id}): ${projectErr instanceof Error ? projectErr.message : String(projectErr)}`;
        logger.error({ msg: `[financial-insights/scan] ${msg}` });
        errors.push(msg);
      }
    }

    return NextResponse.json({
      scanned: scannedCount,
      alertsGenerated,
      errors,
    });
  } catch (err) {
    logger.error({ msg: "[financial-insights/scan] Unexpected error", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      {
        scanned: scannedCount,
        alertsGenerated,
        errors: [
          ...errors,
          `Top-level error: ${err instanceof Error ? err.message : String(err)}`,
        ],
      },
      { status: 500 },
    );
  }
  },
);
