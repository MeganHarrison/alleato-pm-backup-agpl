/**
 * GET  /api/reconciliation/findings  — read persisted active findings + summary.
 *      Runs an initial scan synchronously if none exists yet.
 * POST /api/reconciliation/findings  — trigger a fresh scan (JP + Acumatica), persist.
 *
 * Findings live in `reconciliation_findings`; triage state survives re-scans.
 *
 * Auth: every handler enforces the `view_accounting` capability itself. A page
 * layout cannot gate a route handler — API routes are reachable directly, and
 * `shouldBypassSessionMiddleware` exempts all of `/api/` except `/api/admin/`.
 * These handlers read and write with the service client (RLS bypassed), so the
 * capability check IS the access control.
 */

import { NextResponse } from "next/server";

import { runReconciliation } from "@/lib/accounting/reconciliation-runner";
import type {
  FindingEvidence,
  FindingKind,
  ReconciliationFinding,
} from "@/lib/accounting/reconciliation";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type FindingRow = {
  fingerprint: string;
  jp_project_id: number;
  jp_project_name: string;
  state?: string | null;
  record_type: string;
  record_ref: string;
  cost_code_label: string | null;
  cost_code: string | null;
  cost_type: string | null;
  kind: string;
  tier: string;
  detail: string;
  amount_cents: number | null;
  jp_value_cents: number | null;
  acu_value_cents: number | null;
  jp_modified_on: string | null;
  last_synced_on: string | null;
  external_id: string | null;
  external_model: string | null;
  acumatica_checked: boolean;
  evidence: FindingEvidence | null;
  review_status: string;
};

export type PersistedFinding = ReconciliationFinding & {
  reviewStatus: "open" | "reviewed" | "resolved";
};

function toFinding(row: FindingRow): PersistedFinding {
  return {
    fingerprint: row.fingerprint,
    jpProjectId: row.jp_project_id,
    jpProjectName: row.jp_project_name,
    state: row.state ?? null,
    recordType: row.record_type as ReconciliationFinding["recordType"],
    recordRef: row.record_ref,
    costCodeLabel: row.cost_code_label,
    costCode: row.cost_code,
    costType: row.cost_type,
    kind: row.kind as FindingKind,
    tier: row.tier as ReconciliationFinding["tier"],
    detail: row.detail,
    amountCents: row.amount_cents,
    jpValueCents: row.jp_value_cents,
    acuValueCents: row.acu_value_cents,
    jpModifiedOn: row.jp_modified_on,
    lastSyncedOn: row.last_synced_on,
    externalId: row.external_id,
    externalModel: row.external_model,
    acumaticaChecked: row.acumatica_checked,
    evidence: row.evidence ?? null,
    reviewStatus: (row.review_status as PersistedFinding["reviewStatus"]) ?? "open",
  };
}

async function latestCompleteRun(supabase: ReturnType<typeof createServiceClient>) {
  const { data } = await supabase
    .from("reconciliation_runs")
    .select("*")
    .eq("status", "complete")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

const GET_WHERE = "/api/reconciliation/findings#GET";
const POST_WHERE = "/api/reconciliation/findings#POST";

export const GET = withApiGuardrails(GET_WHERE, async () => {
  await requireCurrentUserAppCapability(
    "view_accounting",
    GET_WHERE,
    "Accounting access required.",
  );

  const supabase = createServiceClient();
  let run = await latestCompleteRun(supabase);
  if (!run) {
    await runReconciliation("manual");
    run = await latestCompleteRun(supabase);
  }

  const { data: rows, error } = await supabase
    .from("reconciliation_findings")
    .select("*")
    .eq("is_active", true);
  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: GET_WHERE,
      message: "Failed to load reconciliation findings.",
      details: { reason: error.message },
    });
  }

  const findings = (rows ?? []).map((r) => toFinding(r as FindingRow));
  const byKind: Record<string, number> = {};
  for (const f of findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;

  return NextResponse.json({
    generatedAt: run?.finished_at ?? null,
    summary: run
      ? {
          projects: run.projects_scanned,
          totalFindings: run.findings_total,
          highCount: run.high_count,
          dollarsAtRiskCents: run.dollars_at_risk_cents,
          acumaticaChecked: run.acumatica_checked,
          byKind,
        }
      : null,
    findings,
  });
});

export const POST = withApiGuardrails(POST_WHERE, async () => {
  await requireCurrentUserAppCapability(
    "view_accounting",
    POST_WHERE,
    "Accounting access required.",
  );

  const summary = await runReconciliation("manual");
  return NextResponse.json({ summary });
});
