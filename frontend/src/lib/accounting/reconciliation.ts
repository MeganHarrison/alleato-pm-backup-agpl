/**
 * Job Planner <-> Acumatica reconciliation analyzer.
 *
 * Pure functions: take Job Planner data (Phase 1) and Acumatica actuals
 * (Phase 2) and return findings. No network or DB access — the unit-tested core.
 *
 * Phase 1 — cross-system health from Job Planner's own `externalObject` sync metadata:
 *   - unlinked records   -> never pushed to Acumatica (no externalObject)
 *   - post-sync drift    -> record modified in JP after its last Acumatica sync
 *   - value mismatch     -> live JP actuals differ from the Acumatica snapshot
 *                           (MED until confirmed in Phase 2)
 *   - budget-health      -> underwater cost basis / thin margin / overbilled
 *
 * Phase 2 — `applyAcumaticaActuals` checks each MED value-mismatch against the
 * real Acumatica ledger (synced `acumatica_project_budgets`), matched on
 * project + cost code + cost type. If the live JP actual equals the live
 * Acumatica actual, the finding was a false positive (stale snapshot) and is
 * cleared; if they genuinely differ, it is promoted to HIGH (confirmed).
 */

import type {
  JpBudget,
  JpBudgetLine,
  JpChangeOrder,
  JpCostCode,
  JpCostType,
  JpProject,
} from "@/lib/jobplanner/client";

export type FindingTier = "HIGH" | "MED" | "INFO";

export type FindingKind =
  | "unlinked-budget-line"
  | "drift-budget-line"
  | "value-mismatch-actuals"
  | "unlinked-cco"
  | "unlinked-pcco"
  | "underwater-budget"
  | "thin-margin"
  | "billed-over-contract"
  | "duplicate-ap-bill"
  | "stale-on-hold-bill";

export type ReconciliationFinding = {
  /** Stable fingerprint for cross-run dedup / triage. */
  fingerprint: string;
  jpProjectId: number;
  jpProjectName: string;
  state: string | null;
  recordType: "budget_line" | "commitment_co" | "prime_co" | "budget" | "ap_bill";
  recordRef: string;
  /** Resolved cost code, e.g. "013120 · Vice President". */
  costCodeLabel: string | null;
  /** Raw cost code, e.g. "013120" — for the Acumatica join. */
  costCode: string | null;
  /** Cost type letter (L/E/M/S/X) — for the Acumatica join. */
  costType: string | null;
  kind: FindingKind;
  tier: FindingTier;
  detail: string;
  amountCents: number | null;
  jpValueCents: number | null;
  acuValueCents: number | null;
  jpModifiedOn: string | null;
  lastSyncedOn: string | null;
  externalId: string | null;
  externalModel: string | null;
  /** True once the value has been verified against the live Acumatica ledger. */
  acumaticaChecked: boolean;
  /** Structured supporting data (e.g. the AP bill copies behind a duplicate). */
  evidence: FindingEvidence | null;
};

export type ProjectReport = {
  jpProjectId: number;
  jpProjectName: string;
  state: string | null;
  lineCount: number;
  ccoCount: number;
  pccoCount: number;
  findings: ReconciliationFinding[];
};

export type ReconciliationSummary = {
  projects: number;
  totalFindings: number;
  highCount: number;
  byKind: Record<string, number>;
  dollarsAtRiskCents: number;
  acumaticaChecked: boolean;
  clearedByAcumatica: number;
};

/** Acumatica actuals keyed by `${projectCode}|${costCode}|${costType}` -> cents. */
export type AcumaticaActuals = {
  byKey: Map<string, number>;
  knownProjectCodes: Set<string>;
};

/** A synced Acumatica AP bill (from `acumatica_ap_bills`). Amounts are dollars. */
export type AcuApBill = {
  externalKey: string;
  vendorId: string | null;
  /** The vendor's own invoice number — same value on two bills = same invoice. */
  vendorRef: string | null;
  amount: number;
  balance: number | null;
  projectCode: string | null;
  status: string | null;
  hold: boolean;
  postPeriod: string | null;
  date: string | null;
  referenceNbr: string | null;
  documentType: string | null;
};

/** One AP bill copy in a duplicate cluster, for the side-by-side comparison. */
export type ApBillCopy = {
  ref: string | null;
  invoiceNo: string | null;
  status: string | null;
  date: string | null;
  amountCents: number;
  balanceCents: number | null;
  docType: string | null;
  role: "keep" | "void";
};

/** Structured evidence persisted on a finding (currently duplicate-bill copies). */
export type FindingEvidence = {
  invoiceMatch?: boolean;
  matchedInvoiceNo?: string | null;
  copies?: ApBillCopy[];
};

const THIN_MARGIN_PCT = 3;

export function centsToUsd(cents: number | null | undefined): string {
  return (Number(cents || 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** Derive the Acumatica project code from a Job Planner project name
 *  ("24-115 Westfield Collective" -> "24115"). Returns null when no job number. */
export function acumaticaProjectCode(jpProjectName: string): string | null {
  const match = jpProjectName.match(/(\d{2})\s*-\s*(\d{2,3})/);
  return match ? `${match[1]}${match[2]}` : null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function liveActuals(line: JpBudgetLine): number {
  const values = line.directCostValues || {};
  return Object.values(values).reduce((sum, v) => sum + Number(v?.amount || 0), 0);
}

function costCodeLabel(
  line: JpBudgetLine,
  codes: Map<number, JpCostCode>,
): string | null {
  if (line.costCodeId == null) return line.description || null;
  const cc = codes.get(line.costCodeId);
  if (!cc) return line.description || `cost code ${line.costCodeId}`;
  const name = cc.name && cc.name !== "Do Not Use" ? cc.name : line.description || "";
  return name ? `${cc.code} · ${name}` : cc.code;
}

export function analyzeProject(
  project: JpProject,
  budget: JpBudget | null,
  ccos: JpChangeOrder[],
  pccos: JpChangeOrder[],
  costCodes: JpCostCode[] = [],
  costTypes: JpCostType[] = [],
): ProjectReport {
  const findings: ReconciliationFinding[] = [];
  const codeMap = new Map(costCodes.map((c) => [c.id, c]));
  const typeMap = new Map(costTypes.map((t) => [t.id, t]));

  const push = (
    f: Partial<ReconciliationFinding> &
      Pick<ReconciliationFinding, "recordType" | "recordRef" | "kind" | "tier" | "detail">,
  ) => {
    findings.push({
      jpProjectId: project.projectId,
      jpProjectName: project.projectName,
      state: project.state ?? null,
      fingerprint: `${project.projectId}:${f.recordType}:${f.recordRef}:${f.kind}`,
      costCodeLabel: null,
      costCode: null,
      costType: null,
      amountCents: null,
      jpValueCents: null,
      acuValueCents: null,
      jpModifiedOn: null,
      lastSyncedOn: null,
      externalId: null,
      externalModel: null,
      acumaticaChecked: false,
      evidence: null,
      ...f,
    });
  };

  const lineItems = budget?.lineItems ?? [];

  for (const line of lineItems) {
    const label = costCodeLabel(line, codeMap);
    const display = label || `line ${line.id}`;
    const ref = String(line.id);
    const rawCode = line.costCodeId != null ? codeMap.get(line.costCodeId)?.code ?? null : null;
    const typeLetter = line.costTypeId != null ? typeMap.get(line.costTypeId)?.code ?? null : null;
    const eo = line.externalObject;

    if (!eo) {
      push({
        recordType: "budget_line", recordRef: ref, kind: "unlinked-budget-line", tier: "HIGH",
        costCodeLabel: label, costCode: rawCode, costType: typeLetter,
        detail: `Budget line ${display} exists in Job Planner but was never pushed to Acumatica.`,
        jpValueCents: liveActuals(line), jpModifiedOn: line.modifiedOn,
      });
      continue;
    }

    const lastSync = parseDate(eo.lastSync);
    const modified = parseDate(line.modifiedOn);
    if (lastSync && modified && modified > lastSync) {
      push({
        recordType: "budget_line", recordRef: ref, kind: "drift-budget-line", tier: "HIGH",
        costCodeLabel: label, costCode: rawCode, costType: typeLetter,
        detail: `Budget line ${display} was edited in Job Planner after its last Acumatica sync.`,
        jpValueCents: liveActuals(line), acuValueCents: Number(eo.data?.act_amt || 0),
        jpModifiedOn: line.modifiedOn, lastSyncedOn: eo.lastSync,
        externalId: eo.externalId, externalModel: eo.externalModel,
      });
    }

    const live = liveActuals(line);
    const pushed = Number(eo.data?.act_amt || 0);
    if (live !== pushed) {
      push({
        recordType: "budget_line", recordRef: ref, kind: "value-mismatch-actuals", tier: "MED",
        costCodeLabel: label, costCode: rawCode, costType: typeLetter,
        detail: `Budget line ${display} actual cost differs: Job Planner ${centsToUsd(live)} vs Acumatica ${centsToUsd(pushed)}.`,
        amountCents: live - pushed, jpValueCents: live, acuValueCents: pushed,
        jpModifiedOn: line.modifiedOn, lastSyncedOn: eo.lastSync,
        externalId: eo.externalId, externalModel: eo.externalModel,
      });
    }
  }

  const scanChangeOrders = (
    rows: JpChangeOrder[],
    recordType: "commitment_co" | "prime_co",
    kind: "unlinked-cco" | "unlinked-pcco",
    label: string,
  ) => {
    for (const co of rows) {
      if (!co.externalObject) {
        push({
          recordType, recordRef: String(co.id), kind, tier: "HIGH",
          detail: `${label} change order #${co.number} (${centsToUsd(co.totalAmount)}) exists in Job Planner but is not linked to Acumatica.`,
          amountCents: co.totalAmount, jpValueCents: co.totalAmount, jpModifiedOn: co.createdOn,
        });
      }
    }
  };
  scanChangeOrders(ccos, "commitment_co", "unlinked-cco", "Commitment");
  scanChangeOrders(pccos, "prime_co", "unlinked-pcco", "Prime-contract");

  if (budget) {
    const { revisedBudget, budgetedCost, contractAmount, budgetProfit, billedToDate } = budget;
    const eo = budget.externalObject;
    const dates = {
      lastSyncedOn: eo?.lastSync ?? null,
      externalId: eo?.externalId ?? null,
      externalModel: eo?.externalModel ?? null,
    };
    if (Number(budgetedCost) > Number(revisedBudget)) {
      push({
        recordType: "budget", recordRef: "summary", kind: "underwater-budget", tier: "INFO",
        detail: `Budgeted cost ${centsToUsd(budgetedCost)} exceeds the revised budget ${centsToUsd(revisedBudget)} — projected to overspend by ${centsToUsd(budgetedCost - revisedBudget)}.`,
        amountCents: budgetedCost - revisedBudget, jpValueCents: budgetedCost, acuValueCents: revisedBudget,
        ...dates,
      });
    }
    if (Number(contractAmount) > 0) {
      const marginPct = (Number(budgetProfit) / Number(contractAmount)) * 100;
      if (marginPct < THIN_MARGIN_PCT) {
        push({
          recordType: "budget", recordRef: "summary", kind: "thin-margin", tier: "INFO",
          detail: `Projected profit ${centsToUsd(budgetProfit)} is ${marginPct.toFixed(1)}% of the contract ${centsToUsd(contractAmount)} (below ${THIN_MARGIN_PCT}%).`,
          amountCents: budgetProfit, jpValueCents: budgetProfit, ...dates,
        });
      }
      if (Number(billedToDate) > Number(contractAmount)) {
        push({
          recordType: "budget", recordRef: "summary", kind: "billed-over-contract", tier: "INFO",
          detail: `Billed to date ${centsToUsd(billedToDate)} exceeds the contract ${centsToUsd(contractAmount)} — over by ${centsToUsd(billedToDate - contractAmount)}.`,
          amountCents: billedToDate - contractAmount, jpValueCents: billedToDate, acuValueCents: contractAmount, ...dates,
        });
      }
    }
  }

  return {
    jpProjectId: project.projectId,
    jpProjectName: project.projectName,
    state: project.state ?? null,
    lineCount: lineItems.length,
    ccoCount: ccos.length,
    pccoCount: pccos.length,
    findings,
  };
}

/**
 * Phase 2: verify the raw "value mismatch" candidates against the live Acumatica
 * ledger (synced actuals). In Alleato's workflow, actual costs are recorded in
 * Acumatica (AP bills), not Job Planner — so a JP-vs-Acumatica actuals difference
 * is only a genuine discrepancy when BOTH systems recorded an actual and they
 * still differ. We therefore:
 *   - clear   when JP actual == Acumatica actual (agree)
 *   - drop    when one side is zero (expected: cost lives only in Acumatica, or
 *             a JP line not yet costed) or when the line can't be matched
 *   - keep    (HIGH, confirmed) only when both are non-zero and differ
 */
export function applyAcumaticaActuals(
  reports: ProjectReport[],
  actuals: AcumaticaActuals,
): { reports: ProjectReport[]; cleared: number } {
  let cleared = 0;
  const enriched = reports.map((report) => {
    const projectCode = acumaticaProjectCode(report.jpProjectName);
    const projectKnown = projectCode != null && actuals.knownProjectCodes.has(projectCode);

    const next: ReconciliationFinding[] = [];
    for (const finding of report.findings) {
      if (finding.kind !== "value-mismatch-actuals") {
        next.push(finding);
        continue;
      }
      if (!projectKnown || !finding.costCode || !finding.costType) {
        cleared += 1; // can't verify against Acumatica -> not a confirmed discrepancy
        continue;
      }
      const acu = actuals.byKey.get(`${projectCode}|${finding.costCode}|${finding.costType}`) ?? 0;
      const jp = finding.jpValueCents ?? 0;
      if (jp === acu || jp === 0 || acu === 0) {
        cleared += 1; // agree, or one-sided (expected: actuals live in Acumatica)
        continue;
      }
      next.push({
        ...finding,
        tier: "HIGH",
        acumaticaChecked: true,
        acuValueCents: acu,
        amountCents: jp - acu,
        detail: `${finding.costCodeLabel ?? "Budget line"} actual cost is recorded differently in each system: Job Planner ${centsToUsd(jp)} vs Acumatica ${centsToUsd(acu)} (Δ ${centsToUsd(jp - acu)}).`,
      });
    }
    return { ...report, findings: next };
  });
  return { reports: enriched, cleared };
}

// ---------------------------------------------------------------------------
// Acumatica AP bill detectors: duplicate billing + on-hold pile.

function amountCentsOf(bill: AcuApBill): number {
  return Math.round(Number(bill.amount || 0) * 100);
}

// Status drives the logic — the `hold` boolean is unreliable (almost always false);
// Acumatica's on-hold state lives in `status` ("Hold"). Closed = paid history.
function isVoided(bill: AcuApBill): boolean {
  return /void/i.test(bill.status ?? "");
}
function isClosed(bill: AcuApBill): boolean {
  return /clos|paid/i.test(bill.status ?? "");
}
function isOnHold(bill: AcuApBill): boolean {
  return /hold/i.test(bill.status ?? "");
}
/** Live = still affecting current AP (Hold or Open) — not paid, not voided. */
function isLive(bill: AcuApBill): boolean {
  return !isVoided(bill) && !isClosed(bill);
}

/**
 * Semantic dedup key: vendor + amount + project + post period. reference_nbr is
 * unreliable (Job Planner regenerates it). Including the period means legitimate
 * recurring charges (same vendor/amount/job in different months) never cluster.
 */
export function apDuplicateKey(bill: AcuApBill): string {
  return `${bill.vendorId ?? ""}|${amountCentsOf(bill)}|${bill.projectCode ?? ""}|${bill.postPeriod ?? ""}`;
}

function projectLabel(code: string | null, projectName: (code: string) => string): string {
  if (!code) return "(no project)";
  const name = projectName(code);
  return name && name !== code ? `${code} · ${name}` : code;
}

function apFinding(
  fields: Pick<
    ReconciliationFinding,
    "fingerprint" | "recordType" | "recordRef" | "kind" | "tier" | "detail"
  > &
    Partial<ReconciliationFinding>,
  projectCode: string | null,
  projectName: (code: string) => string,
): ReconciliationFinding {
  return {
    jpProjectId: 0,
    jpProjectName: projectCode ? projectLabel(projectCode, projectName) : "(Acumatica AP)",
    state: null,
    costCodeLabel: null,
    costCode: null,
    costType: null,
    amountCents: null,
    jpValueCents: null,
    acuValueCents: null,
    jpModifiedOn: null,
    lastSyncedOn: null,
    externalId: null,
    externalModel: "ap_bill",
    acumaticaChecked: true,
    evidence: null,
    ...fields,
  };
}

/**
 * Duplicate AP bills: the same vendor billed the same amount on the same job in
 * the same post period more than once. This is exactly how the accountants spot
 * them by hand. Only clusters with at least one *live* (Hold/Open) copy are
 * reported — all-Closed clusters are paid history, not actionable. All are HIGH
 * (same-period duplication is unambiguous; recurring charges land in different
 * periods and never cluster).
 */
export function detectDuplicateBills(
  bills: AcuApBill[],
  projectName: (code: string) => string = (c) => c,
): ReconciliationFinding[] {
  const groups = new Map<string, AcuApBill[]>();
  for (const bill of bills) {
    if (isVoided(bill) || amountCentsOf(bill) <= 0 || !bill.vendorId || !bill.projectCode) continue;
    const key = apDuplicateKey(bill);
    const list = groups.get(key) ?? [];
    list.push(bill);
    groups.set(key, list);
  }

  const findings: ReconciliationFinding[] = [];
  for (const [key, copies] of groups) {
    if (copies.length < 2) continue;
    const liveCount = copies.filter(isLive).length;
    if (liveCount === 0) continue; // all paid history — not an active overstatement

    const amountCents = amountCentsOf(copies[0]);
    const live = copies.filter(isLive);
    const paid = copies.filter(isClosed);
    // Keep one legitimate copy (the already-paid one if there is one, else the
    // first live copy); every other live copy is a duplicate to void.
    const keep = paid[0] ?? live[0];
    const toVoid = paid.length > 0 ? live : live.slice(1);
    const ref = (b: AcuApBill) => `${b.referenceNbr ?? "?"} (${(b.status ?? "?").toLowerCase()})`;
    const voidList = toVoid.map(ref).join(", ");

    // The vendor's own invoice number is the verification key: the same number on
    // every copy means it's literally the same invoice entered more than once.
    const vendorRefs = [...new Set(copies.map((b) => b.vendorRef).filter(Boolean))];
    const invoiceMatch = vendorRefs.length === 1;
    const confirmation = invoiceMatch
      ? `Same vendor invoice ${vendorRefs[0]} on every copy — confirmed duplicate.`
      : `Same amount but the vendor invoice numbers differ (${vendorRefs.join(", ") || "none recorded"}) — open both to confirm before voiding.`;

    const keepSet = new Set(keep ? [keep] : []);
    const evidenceCopies: ApBillCopy[] = copies.map((b) => ({
      ref: b.referenceNbr,
      invoiceNo: b.vendorRef,
      status: b.status,
      date: b.date,
      amountCents: amountCentsOf(b),
      balanceCents: b.balance == null ? null : Math.round(b.balance * 100),
      docType: b.documentType,
      role: keepSet.has(b) || (paid.length === 0 && b === live[0]) ? "keep" : "void",
    }));

    findings.push(
      apFinding(
        {
          fingerprint: `dup-ap:${key}`,
          recordType: "ap_bill",
          recordRef: key,
          kind: "duplicate-ap-bill",
          tier: "HIGH",
          detail: `${copies[0].vendorId} was billed ${centsToUsd(amountCents)} ${copies.length}× on ${projectLabel(copies[0].projectCode, projectName)} (period ${copies[0].postPeriod ?? "?"}). ${confirmation} Keep ${keep ? ref(keep) : "?"}; void ${voidList} in Acumatica.`,
          amountCents: amountCents * toVoid.length,
          acuValueCents: amountCents,
          costCodeLabel: copies[0].vendorId,
          jpModifiedOn: copies.map((b) => b.date).filter(Boolean).sort().slice(-1)[0] ?? null,
          externalId: copies.map((b) => b.referenceNbr).filter(Boolean).join(" / ") || null,
          evidence: {
            invoiceMatch,
            matchedInvoiceNo: invoiceMatch ? vendorRefs[0] : null,
            copies: evidenceCopies,
          },
        },
        copies[0].projectCode,
        projectName,
      ),
    );
  }
  return findings;
}

function ageDays(fromIso: string | null, asOfIso: string): number | null {
  const from = parseDate(fromIso);
  const asOf = parseDate(asOfIso);
  if (!from || !asOf) return null;
  return Math.max(0, Math.floor((asOf.getTime() - from.getTime()) / 86_400_000));
}

function ageBucket(days: number | null): string {
  if (days == null) return "unknown age";
  if (days < 30) return "0–30 days";
  if (days < 60) return "30–60 days";
  if (days < 90) return "60–90 days";
  if (days < 180) return "90–180 days";
  return "180+ days";
}

/**
 * On-hold AP bills: synced but never reviewed/released. One finding per bill.
 *   - HIGH  bill is also part of a duplicate cluster (likely the copy to void).
 *   - INFO  otherwise, bucketed by age so the pile gets worked down.
 */
export function detectOnHoldBills(
  bills: AcuApBill[],
  asOfIso: string,
  duplicateKeys: Set<string> = new Set(),
  projectName: (code: string) => string = (c) => c,
): ReconciliationFinding[] {
  const findings: ReconciliationFinding[] = [];
  for (const bill of bills) {
    if (!isOnHold(bill) || amountCentsOf(bill) === 0) continue;
    const days = ageDays(bill.date ?? bill.postPeriod, asOfIso);
    const isDup = duplicateKeys.has(`dup-ap:${apDuplicateKey(bill)}`);
    findings.push(
      apFinding(
        {
          fingerprint: `onhold:${bill.externalKey}`,
          recordType: "ap_bill",
          recordRef: bill.externalKey,
          kind: "stale-on-hold-bill",
          tier: isDup ? "HIGH" : "INFO",
          detail: `On hold ${ageBucket(days)}: ${centsToUsd(amountCentsOf(bill))} to ${bill.vendorId ?? "?"} on ${projectLabel(bill.projectCode, projectName)} (period ${bill.postPeriod ?? "?"}).${isDup ? " Also appears in a duplicate cluster — likely the copy to void." : ""}`,
          amountCents: amountCentsOf(bill),
          acuValueCents: amountCentsOf(bill),
          costCodeLabel: bill.vendorId,
          jpModifiedOn: bill.date,
          externalId: bill.referenceNbr,
        },
        bill.projectCode,
        projectName,
      ),
    );
  }
  return findings;
}

export function summarize(
  reports: ProjectReport[],
  opts: { acumaticaChecked?: boolean; cleared?: number } = {},
): ReconciliationSummary {
  const byKind: Record<string, number> = {};
  let highCount = 0;
  let dollarsAtRiskCents = 0;
  for (const report of reports) {
    for (const finding of report.findings) {
      byKind[finding.kind] = (byKind[finding.kind] || 0) + 1;
      if (finding.tier === "HIGH") highCount += 1;
      if (finding.tier === "HIGH") dollarsAtRiskCents += Math.abs(finding.amountCents || 0);
    }
  }
  return {
    projects: reports.filter((r) => r.jpProjectId > 0).length,
    totalFindings: reports.reduce((n, r) => n + r.findings.length, 0),
    highCount,
    byKind,
    dollarsAtRiskCents,
    acumaticaChecked: opts.acumaticaChecked ?? false,
    clearedByAcumatica: opts.cleared ?? 0,
  };
}
