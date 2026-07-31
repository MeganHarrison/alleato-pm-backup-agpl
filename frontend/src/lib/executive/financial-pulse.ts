/**
 * Financial Pulse — structured financial data for the executive daily brief.
 *
 * Queries the PM APP Supabase DB (NOT the RAG vector store) for ground-truth
 * financial signals: overdue AR, pending change orders, and project totals.
 *
 * This data is passed as authoritative context to the LLM synthesis so the brief
 * contains real dollar figures instead of only vague communication excerpts.
 */
import { serviceDb } from "@/lib/supabase/service-db";

export type ARProjectSnapshot = {
  projectId: number;
  projectName: string;
  jobNumber: string | null;
  phase: string | null;
  invoiceCount: number;
  /** Total outstanding balance (any open invoice) */
  totalBalance: number;
  /** Balance where due_date < today */
  overdueBalance: number;
  /** Most recent due date for reference */
  latestDueDate: string | null;
};

export type PendingCOProjectSnapshot = {
  projectId: number;
  projectName: string;
  jobNumber: string | null;
  coCount: number;
  /** Sum of cost_budget_change_total for On Hold COs */
  pendingCost: number;
  /** Sum of revenue_budget_change_total for On Hold COs */
  pendingRevenue: number;
  /** Oldest pending CO change_date */
  oldestDate: string | null;
};

export type FinancialPulseData = {
  generatedAt: string;
  /** Total outstanding AR across all open invoices */
  totalOutstandingAR: number;
  /** Subset of totalOutstandingAR that is past due */
  totalOverdueAR: number;
  /** Per-project AR breakdown, sorted by overdue balance desc */
  arByProject: ARProjectSnapshot[];
  /** Total pending/on-hold change order revenue across all projects */
  totalPendingCORevenue: number;
  /** Per-project pending CO breakdown (2026 COs only), sorted by revenue desc */
  pendingCOsByProject: PendingCOProjectSnapshot[];
  warnings: string[];
};

function fmt(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }
  return `$${Math.round(amount)}`;
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

/**
 * Formats the financial pulse data as a plaintext context block for LLM prompts.
 * Designed to be injected verbatim into the synthesis and enrichment prompts.
 */
export function financialPulseToSynthesisContext(pulse: FinancialPulseData): string {
  if (pulse.warnings.length > 0 && pulse.arByProject.length === 0 && pulse.pendingCOsByProject.length === 0) {
    return "FINANCIAL GROUND TRUTH: Data unavailable this run.";
  }

  const lines: string[] = [
    "=== FINANCIAL GROUND TRUTH (authoritative — from Acumatica ERP, treat as facts) ===",
  ];

  // AR Summary
  lines.push("");
  lines.push("ACCOUNTS RECEIVABLE:");
  lines.push(`  Total outstanding: ${fmt(pulse.totalOutstandingAR)} across ${pulse.arByProject.length} projects`);
  lines.push(`  Total OVERDUE (past due date): ${fmt(pulse.totalOverdueAR)}`);
  if (pulse.arByProject.length > 0) {
    lines.push("  By project (sorted by overdue amount):");
    for (const ar of pulse.arByProject.slice(0, 10)) {
      const overduePart =
        ar.overdueBalance > 0
          ? ` — ${fmt(ar.overdueBalance)} OVERDUE${ar.latestDueDate ? ` (due ${ar.latestDueDate}, ${daysSince(ar.latestDueDate)}d past due)` : ""}`
          : ar.latestDueDate
            ? ` — due ${ar.latestDueDate}`
            : "";
      lines.push(
        `    • ${ar.projectName} (${ar.jobNumber ?? ar.projectId}): ${fmt(ar.totalBalance)} outstanding [${ar.invoiceCount} invoice${ar.invoiceCount !== 1 ? "s" : ""}]${overduePart}`,
      );
    }
  }

  // Change Orders
  if (pulse.pendingCOsByProject.length > 0) {
    lines.push("");
    lines.push("PENDING (ON HOLD) CHANGE ORDERS — 2026 only, awaiting approval:");
    lines.push(
      `  Total pending revenue: ${fmt(pulse.totalPendingCORevenue)} across ${pulse.pendingCOsByProject.length} projects`,
    );
    for (const co of pulse.pendingCOsByProject.slice(0, 8)) {
      const agePart = co.oldestDate
        ? ` — oldest pending since ${co.oldestDate} (${daysSince(co.oldestDate)}d)`
        : "";
      lines.push(
        `    • ${co.projectName} (${co.jobNumber ?? co.projectId}): ${co.coCount} CO${co.coCount !== 1 ? "s" : ""} on hold, ${fmt(co.pendingRevenue)} revenue pending${agePart}`,
      );
    }
  } else {
    lines.push("");
    lines.push("PENDING CHANGE ORDERS: None with significant pending revenue in 2026.");
  }

  lines.push("");
  lines.push("=== END FINANCIAL GROUND TRUTH ===");

  return lines.join("\n");
}

export async function loadFinancialPulse(): Promise<FinancialPulseData> {
    const warnings: string[] = [];

  // --- AR Invoices ---
  const { data: arRows, error: arError } = await serviceDb.from("acumatica_ar_invoices")
    .select(
      "project_id,reference_nbr,amount,balance,due_date,status",
    )
    .in("status", ["Open", "On Hold", "Hold"])
    .gt("balance", 0);

  if (arError) {
    warnings.push(`AR invoice query failed: ${arError.message}`);
  }

  // --- Pending Change Orders (2026 only, to avoid noise from stale legacy COs) ---
  const { data: coRows, error: coError } = await serviceDb.from("acumatica_change_orders")
    .select(
      "project_id,project_code,reference_nbr,cost_budget_change_total,revenue_budget_change_total,change_date,status",
    )
    .eq("status", "On Hold")
    .gte("change_date", "2026-01-01")
    .not("project_id", "is", null);

  if (coError) {
    warnings.push(`Change order query failed: ${coError.message}`);
  }

  // --- Project names for both sets ---
  const allProjectIds = [
    ...new Set([
      ...((arRows ?? []).map((r) => r.project_id).filter(Boolean) as number[]),
      ...((coRows ?? []).map((r) => r.project_id).filter(Boolean) as number[]),
    ]),
  ];

  const projectNames = new Map<number, { name: string; jobNumber: string | null; phase: string | null }>();
  if (allProjectIds.length > 0) {
    const { data: projects, error: projError } = await serviceDb.from("projects")
      .select(`id,name,"job number",phase`)
      .in("id", allProjectIds);

    if (projError) {
      warnings.push(`Project name lookup failed: ${projError.message}`);
    } else {
      for (const p of projects ?? []) {
        projectNames.set(p.id as number, {
          name: (p.name as string | null) ?? `Project ${p.id}`,
          jobNumber: (p["job number"] as string | null) ?? null,
          phase: (p.phase as string | null) ?? null,
        });
      }
    }
  }

  // --- Aggregate AR by project ---
  const arByProjectMap = new Map<
    number,
    { total: number; overdue: number; count: number; latestDue: string | null }
  >();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const row of arRows ?? []) {
    if (!row.project_id || !row.balance) continue;
    const existing = arByProjectMap.get(row.project_id) ?? {
      total: 0,
      overdue: 0,
      count: 0,
      latestDue: null,
    };
    existing.total += Number(row.balance);
    existing.count += 1;

    if (row.due_date) {
      const dueDate = new Date(row.due_date);
      if (!isNaN(dueDate.getTime()) && dueDate < today) {
        existing.overdue += Number(row.balance);
      }
      if (!existing.latestDue || row.due_date > existing.latestDue) {
        existing.latestDue = row.due_date;
      }
    }

    arByProjectMap.set(row.project_id, existing);
  }

  const arByProject: ARProjectSnapshot[] = [...arByProjectMap.entries()]
    .map(([projectId, agg]) => {
      const proj = projectNames.get(projectId);
      return {
        projectId,
        projectName: proj?.name ?? `Project ${projectId}`,
        jobNumber: proj?.jobNumber ?? null,
        phase: proj?.phase ?? null,
        invoiceCount: agg.count,
        totalBalance: agg.total,
        overdueBalance: agg.overdue,
        latestDueDate: agg.latestDue,
      };
    })
    .filter((ar) => ar.totalBalance > 1000) // filter trivial amounts
    .sort((a, b) => b.overdueBalance - a.overdueBalance || b.totalBalance - a.totalBalance);

  const totalOutstandingAR = arByProject.reduce((sum, ar) => sum + ar.totalBalance, 0);
  const totalOverdueAR = arByProject.reduce((sum, ar) => sum + ar.overdueBalance, 0);

  // --- Aggregate COs by project ---
  const coByProjectMap = new Map<
    number,
    { count: number; cost: number; revenue: number; oldestDate: string | null }
  >();

  for (const row of coRows ?? []) {
    if (!row.project_id) continue;
    const existing = coByProjectMap.get(row.project_id) ?? {
      count: 0,
      cost: 0,
      revenue: 0,
      oldestDate: null,
    };
    existing.count += 1;
    existing.cost += Number(row.cost_budget_change_total ?? 0);
    existing.revenue += Number(row.revenue_budget_change_total ?? 0);
    if (row.change_date) {
      if (!existing.oldestDate || row.change_date < existing.oldestDate) {
        existing.oldestDate = row.change_date;
      }
    }
    coByProjectMap.set(row.project_id, existing);
  }

  const pendingCOsByProject: PendingCOProjectSnapshot[] = [...coByProjectMap.entries()]
    .map(([projectId, agg]) => {
      const proj = projectNames.get(projectId);
      return {
        projectId,
        projectName: proj?.name ?? `Project ${projectId}`,
        jobNumber: proj?.jobNumber ?? null,
        coCount: agg.count,
        pendingCost: agg.cost,
        pendingRevenue: agg.revenue,
        oldestDate: agg.oldestDate,
      };
    })
    .filter((co) => co.pendingRevenue > 5000)
    .sort((a, b) => b.pendingRevenue - a.pendingRevenue);

  const totalPendingCORevenue = pendingCOsByProject.reduce(
    (sum, co) => sum + co.pendingRevenue,
    0,
  );

  return {
    generatedAt: new Date().toISOString(),
    totalOutstandingAR,
    totalOverdueAR,
    arByProject,
    totalPendingCORevenue,
    pendingCOsByProject,
    warnings,
  };
}
