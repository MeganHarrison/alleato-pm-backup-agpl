/**
 * Reconciliation runner: scans Job Planner, verifies against Acumatica (Phase 2),
 * and persists findings + an audit run row. Used by the API route and (later) a
 * daily cron. Triage state (review_status/reviewed_by) is preserved across runs.
 */

import "server-only";

import type { Json } from "@/types/database.types";
import {
  getBudget,
  getCommitmentChangeOrders,
  getCostCodes,
  getCostTypes,
  getPrimeContractChangeOrders,
  listProjects,
  type JpBudget,
  type JpChangeOrder,
  type JpCostCode,
  type JpCostType,
} from "@/lib/jobplanner/client";
import {
  analyzeProject,
  applyAcumaticaActuals,
  detectDuplicateBills,
  detectOnHoldBills,
  summarize,
  type ProjectReport,
  type ReconciliationFinding,
  type ReconciliationSummary,
} from "./reconciliation";
import { loadAcumaticaActuals } from "./acumatica-actuals";
import { loadApBills } from "./acumatica-ap-bills";
import { serviceDb } from "@/lib/supabase/service-db";
import { logger } from "@/lib/logger";

const SKIP_PROJECT_NAMES = new Set(["JobPlanner test", "Training Library"]);
const CONCURRENCY = 5;
const UPSERT_CHUNK = 500;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function emptyReport(projectId: number, projectName: string, state: string | null): ProjectReport {
  return {
    jpProjectId: projectId,
    jpProjectName: projectName,
    state,
    lineCount: 0,
    ccoCount: 0,
    pccoCount: 0,
    findings: [],
  };
}

function toRow(finding: ReconciliationFinding, runId: number) {
  return {
    fingerprint: finding.fingerprint,
    jp_project_id: finding.jpProjectId,
    jp_project_name: finding.jpProjectName,
    record_type: finding.recordType,
    record_ref: finding.recordRef,
    cost_code_label: finding.costCodeLabel,
    cost_code: finding.costCode,
    cost_type: finding.costType,
    kind: finding.kind,
    tier: finding.tier,
    detail: finding.detail,
    amount_cents: finding.amountCents,
    jp_value_cents: finding.jpValueCents,
    acu_value_cents: finding.acuValueCents,
    jp_modified_on: finding.jpModifiedOn,
    last_synced_on: finding.lastSyncedOn,
    external_id: finding.externalId,
    external_model: finding.externalModel,
    acumatica_checked: finding.acumaticaChecked,
    evidence: (finding.evidence ?? null) as Json,
    is_active: true,
    last_seen_at: new Date().toISOString(),
    last_run_id: runId,
  };
}

export async function runReconciliation(
  source: "manual" | "cron" = "manual",
): Promise<ReconciliationSummary> {
    const { data: runRow, error: runErr } = await serviceDb.from("reconciliation_runs")
    .insert({ source, status: "running" })
    .select("id")
    .single();
  if (runErr || !runRow) {
    throw new Error(`reconciliation run insert failed: ${runErr?.message ?? "no row"}`);
  }
  const runId = runRow.id;

  try {
    const projects = (await listProjects()).filter((p) => !SKIP_PROJECT_NAMES.has(p.projectName));

    const reports0 = await mapWithConcurrency(projects, CONCURRENCY, async (project) => {
      try {
        const [budget, ccos, pccos, costCodes, costTypes] = await Promise.all([
          getBudget(project.projectId).catch(() => null as JpBudget | null),
          getCommitmentChangeOrders(project.projectId).catch(() => [] as JpChangeOrder[]),
          getPrimeContractChangeOrders(project.projectId).catch(() => [] as JpChangeOrder[]),
          getCostCodes(project.projectId).catch(() => [] as JpCostCode[]),
          getCostTypes(project.projectId).catch(() => [] as JpCostType[]),
        ]);
        return analyzeProject(project, budget, ccos, pccos, costCodes, costTypes);
      } catch (err) {
        logger.warn({
          msg: "reconciliation: project scan failed",
          projectId: project.projectId,
          error: err instanceof Error ? err.message : String(err),
        });
        return emptyReport(project.projectId, project.projectName, project.state ?? null);
      }
    });

    const actuals = await loadAcumaticaActuals();
    const { reports, cleared } = applyAcumaticaActuals(reports0, actuals);

    // Acumatica AP detectors: duplicate billing + on-hold pile.
    const { bills, projectNameByCode } = await loadApBills();
    const projectName = (code: string) => projectNameByCode.get(code) ?? code;
    const dupFindings = detectDuplicateBills(bills, projectName);
    const dupKeys = new Set(dupFindings.map((f) => f.fingerprint));
    const onHoldFindings = detectOnHoldBills(
      bills,
      new Date().toISOString(),
      dupKeys,
      projectName,
    );
    const apReport: ProjectReport = {
      jpProjectId: 0,
      jpProjectName: "(Acumatica AP)",
      state: null,
      lineCount: 0,
      ccoCount: 0,
      pccoCount: 0,
      findings: [...dupFindings, ...onHoldFindings],
    };

    const reportsAll = [...reports, apReport];
    const summary = summarize(reportsAll, { acumaticaChecked: true, cleared });

    const rows = reportsAll.flatMap((r) => r.findings).map((f) => toRow(f, runId));
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const { error } = await serviceDb.from("reconciliation_findings")
        .upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: "fingerprint" });
      if (error) throw new Error(`findings upsert failed: ${error.message}`);
    }

    // Findings not seen in this run are no longer active discrepancies.
    await serviceDb.from("reconciliation_findings")
      .update({ is_active: false })
      .neq("last_run_id", runId);

    await serviceDb.from("reconciliation_runs")
      .update({
        status: "complete",
        finished_at: new Date().toISOString(),
        projects_scanned: summary.projects,
        findings_total: summary.totalFindings,
        high_count: summary.highCount,
        dollars_at_risk_cents: summary.dollarsAtRiskCents,
        acumatica_checked: true,
      })
      .eq("id", runId);

    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : "reconciliation failed";
    await serviceDb.from("reconciliation_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
      .eq("id", runId);
    throw err;
  }
}
