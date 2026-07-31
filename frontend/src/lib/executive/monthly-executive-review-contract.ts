import type { GovernedExecutiveArtifact } from "./governed-executive-artifact";

export type MonthlyReviewReleaseState = "draft" | "blocked" | "approved";
export type MonthlyReviewEventAction = "issued" | "finance_closed" | "executive_approved" | "superseded";

export type MonthlyFinancialReadiness = { state: "ready" | "awaiting_close"; freshness: string; warnings: string[]; recovery: string };

export function monthlyReviewPeriod(artifact: GovernedExecutiveArtifact): string {
  const date = new Date(`${artifact.packet.businessDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Monthly review cannot be issued because the governed packet has no valid business date.");
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function monthlyFinancialReadiness(artifact: GovernedExecutiveArtifact): MonthlyFinancialReadiness {
  const financial = artifact.state?.inputs.find((input) => input.id === "financial_truth");
  const warnings = artifact.state?.financial.warnings ?? ["Financial source is unavailable in the governed artifact."];
  const state = financial?.freshness === "fresh" && warnings.length === 0 ? "ready" : "awaiting_close";
  return {
    state,
    freshness: financial?.freshness ?? "unknown",
    warnings,
    recovery: state === "ready" ? "Finance source readiness is present; record the finance close before executive approval." : "Finance owner must resolve the named financial source warning and record the finance close against this immutable review version.",
  };
}

export function monthlyReviewRelease(artifact: Pick<GovernedExecutiveArtifact, "integrity">, financial: MonthlyFinancialReadiness, events: Array<{ action: MonthlyReviewEventAction }>) {
  const financeClosed = events.some((event) => event.action === "finance_closed");
  const executiveApproved = events.some((event) => event.action === "executive_approved");
  const reasons: string[] = [];
  if (artifact.integrity !== "ready") reasons.push(`Governed artifact integrity is ${artifact.integrity}.`);
  if (financial.state !== "ready") reasons.push("Financial source readiness is not ready.");
  if (!financeClosed) reasons.push("Finance close has not been recorded.");
  if (!executiveApproved) reasons.push("Executive approval has not been recorded.");
  if (reasons.length) return { state: artifact.integrity === "blocked" || financial.state !== "ready" ? "blocked" as const : "draft" as const, reasons, recovery: "Repair the named source condition, then have an app admin record finance close and executive approval for this governed version." };
  return { state: "approved" as const, reasons: [], recovery: "Approved for delivery evidence through the existing packet-correlated AI Ops ledger." };
}
