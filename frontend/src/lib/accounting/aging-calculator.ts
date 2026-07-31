/**
 * Aging and financial-guardrail logic for the accounting dashboard.
 *
 * Extracted from dashboard/route.ts so the route handler stays thin
 * and these business rules can be tested independently.
 */

// ---------------------------------------------------------------------------
// Types (re-exported so the route file doesn't need to re-declare them)
// ---------------------------------------------------------------------------

type AlertSeverity = "high" | "medium";

export interface FinancialGuardrailAlert {
  id: string;
  severity: AlertSeverity;
  category: "duplicate_outgoing_check" | "duplicate_incoming_payment" | "near_duplicate_outgoing_check";
  title: string;
  description: string;
  references: string[];
}

// ---------------------------------------------------------------------------
// Aging bucket classifier
// ---------------------------------------------------------------------------

/**
 * Classify a number of days-past-due into an AR/AP aging bucket label.
 *
 * Buckets follow standard aging conventions:
 *   "current"  = 0–30 days  (within payment terms)
 *   "31-60"    = 31–60 days past due
 *   "61-90"    = 61–90 days past due
 *   "90+"      = more than 90 days past due
 */
export function classifyAgingBucket(
  daysOutstanding: number,
): "current" | "31-60" | "61-90" | "90+" {
  if (daysOutstanding <= 30) return "current";
  if (daysOutstanding <= 60) return "31-60";
  if (daysOutstanding <= 90) return "61-90";
  return "90+";
}

// ---------------------------------------------------------------------------
// Guardrail alert detection
// ---------------------------------------------------------------------------

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function normalizeAmount(value: number | null | undefined): number {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

export function detectGuardrailAlerts(params: {
  checks: Array<{
    reference_nbr: string;
    vendor_id: string | null;
    vendor_name: string | null;
    payment_ref: string | null;
    payment_amount: number | null;
    application_date: string | null;
    status: string | null;
    cash_account: string | null;
  }>;
  payments: Array<{
    reference_nbr: string;
    customer_id: string | null;
    customer_name: string | null;
    payment_ref: string | null;
    external_ref: string | null;
    payment_amount: number | null;
    application_date: string | null;
    status: string | null;
  }>;
}): FinancialGuardrailAlert[] {
  const alerts: FinancialGuardrailAlert[] = [];
  const checkRows = params.checks.filter((row) => {
    const status = normalizeText(row.status);
    return status !== "VOIDED" && normalizeAmount(row.payment_amount) > 0;
  });
  const paymentRows = params.payments.filter((row) => {
    const status = normalizeText(row.status);
    return status !== "VOIDED" && normalizeAmount(row.payment_amount) > 0;
  });

  // Exact duplicate outgoing checks: same vendor + payment ref + amount + date + account
  const exactOutgoing = new Map<string, typeof checkRows>();
  for (const row of checkRows) {
    const key = [
      normalizeText(row.vendor_id),
      normalizeText(row.payment_ref),
      normalizeAmount(row.payment_amount).toFixed(2),
      row.application_date ?? "",
      normalizeText(row.cash_account),
    ].join("|");
    const group = exactOutgoing.get(key) ?? [];
    group.push(row);
    exactOutgoing.set(key, group);
  }

  for (const group of exactOutgoing.values()) {
    if (group.length < 2) continue;
    const references = Array.from(new Set(group.map((row) => row.reference_nbr))).slice(0, 6);
    if (references.length < 2) continue;
    const amount = normalizeAmount(group[0].payment_amount);
    const vendor = group[0].vendor_name ?? group[0].vendor_id ?? "Unknown vendor";
    alerts.push({
      id: `outgoing:${references.join(",")}`,
      severity: "high",
      category: "duplicate_outgoing_check",
      title: "Possible duplicate outgoing check payment",
      description: `${vendor} has ${references.length} checks with the same payment ref/date/amount (${amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}).`,
      references,
    });
  }

  // Near-duplicate outgoing checks: same vendor + amount, within 3 days, different reference
  const byVendorAndAmount = new Map<string, typeof checkRows>();
  for (const row of checkRows) {
    const key = [
      normalizeText(row.vendor_id),
      normalizeAmount(row.payment_amount).toFixed(2),
    ].join("|");
    const group = byVendorAndAmount.get(key) ?? [];
    group.push(row);
    byVendorAndAmount.set(key, group);
  }

  for (const group of byVendorAndAmount.values()) {
    if (group.length < 2) continue;
    const sorted = group
      .filter((row) => row.application_date)
      .sort((a, b) => (a.application_date ?? "").localeCompare(b.application_date ?? ""));
    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      if (!previous.application_date || !current.application_date) continue;
      const dayDiff =
        Math.abs(
          new Date(current.application_date).getTime() -
            new Date(previous.application_date).getTime(),
        ) /
        (1000 * 60 * 60 * 24);
      if (dayDiff > 3) continue;
      if (normalizeText(previous.reference_nbr) === normalizeText(current.reference_nbr)) continue;
      alerts.push({
        id: `near-outgoing:${previous.reference_nbr}:${current.reference_nbr}`,
        severity: "medium",
        category: "near_duplicate_outgoing_check",
        title: "Potential near-duplicate outgoing payment",
        description: `Two checks for ${current.vendor_name ?? current.vendor_id ?? "vendor"} have the same amount within ${Math.round(dayDiff)} day(s).`,
        references: [previous.reference_nbr, current.reference_nbr],
      });
    }
  }

  // Exact duplicate incoming payments: same customer + payment ref + amount + date
  const exactIncoming = new Map<string, typeof paymentRows>();
  for (const row of paymentRows) {
    const normalizedRef = normalizeText(row.payment_ref) || normalizeText(row.external_ref);
    if (!normalizedRef) continue;
    const key = [
      normalizeText(row.customer_id),
      normalizedRef,
      normalizeAmount(row.payment_amount).toFixed(2),
      row.application_date ?? "",
    ].join("|");
    const group = exactIncoming.get(key) ?? [];
    group.push(row);
    exactIncoming.set(key, group);
  }

  for (const group of exactIncoming.values()) {
    if (group.length < 2) continue;
    const references = Array.from(new Set(group.map((row) => row.reference_nbr))).slice(0, 6);
    if (references.length < 2) continue;
    const amount = normalizeAmount(group[0].payment_amount);
    const customer = group[0].customer_name ?? group[0].customer_id ?? "Unknown customer";
    alerts.push({
      id: `incoming:${references.join(",")}`,
      severity: "medium",
      category: "duplicate_incoming_payment",
      title: "Possible duplicate incoming payment",
      description: `${customer} has ${references.length} payments with the same payment reference and amount (${amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}).`,
      references,
    });
  }

  return alerts.slice(0, 25);
}
