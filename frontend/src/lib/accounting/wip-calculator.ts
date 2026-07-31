import { roundMoney } from "@/lib/accounting/utils";

/**
 * WIP position and earned-revenue outputs for a single project.
 * Computed via the percentage-of-completion method.
 */
export type WipPosition = {
  percentComplete: number;
  earnedRevenue: number;
  overUnderBilling: number;
  /** "balanced" means within ±$0.01 — floating-point noise below this threshold is not meaningful. */
  position: "overbilled" | "underbilled" | "balanced";
};

/**
 * Percentage-of-completion WIP calculation.
 *
 * earnedRevenue  = contractValue × (costToDate / estimatedFinalCost)
 * overUnderBilling = billedToDate − earnedRevenue
 *   > +$0.01 → overbilled   (billed more than earned)
 *   < -$0.01 → underbilled  (earned more than billed)
 *   otherwise → balanced
 *
 * The $0.01 threshold suppresses floating-point noise; amounts within
 * one cent are treated as balanced.
 */
export function calculateWipPosition(
  contractValue: number,
  costToDate: number,
  estimatedFinalCost: number,
  billedToDate: number,
): WipPosition {
  const percentCompleteRaw = estimatedFinalCost > 0 ? costToDate / estimatedFinalCost : 0;
  const percentComplete = Math.min(Math.max(percentCompleteRaw, 0), 1);
  const earnedRevenue = contractValue * percentComplete;
  const overUnderBilling = billedToDate - earnedRevenue;

  const position: WipPosition["position"] =
    overUnderBilling > 0.01
      ? "overbilled"
      : overUnderBilling < -0.01
        ? "underbilled"
        : "balanced";

  return {
    percentComplete: roundMoney(percentComplete),
    earnedRevenue: roundMoney(earnedRevenue),
    overUnderBilling: roundMoney(overUnderBilling),
    position,
  };
}

/**
 * Statuses Acumatica treats as closed for AR invoices.
 * Keep this set in sync with Acumatica's AR invoice status enum if new
 * closed statuses are ever added on the ERP side.
 */
const CLOSED_AR_INVOICE_STATUSES = new Set(["Voided"]);

export function isClosedInvoiceStatus(status: string | null): boolean {
  return CLOSED_AR_INVOICE_STATUSES.has(status ?? "");
}
