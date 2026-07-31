/**
 * Payment application (AIA G702/G703) financials — the single owner of invoice money math.
 *
 * This module is the deep seam for the schedule-of-values (SOV) calculation shared by
 * subcontractor invoices (the API route, the SOV editor tabs, the PDF) and — as a
 * fast-follow — owner/prime payment applications. Before it existed the math was forked
 * across four call sites that disagreed on AIA Lines 8 and 9. See `CONTEXT.md` →
 * "Invoicing / payment applications" for the domain terms.
 *
 * The nine G702 certificate lines:
 *   1 Original Contract Sum
 *   2 Net Change by Change Orders
 *   3 Contract Sum to Date            (1 ± 2)
 *   4 Total Completed & Stored to Date
 *   5 Retainage                        (5a work + 5b materials)
 *   6 Total Earned Less Retainage      (4 − 5)
 *   7 Less Previous Certificates for Payment
 *   8 Current Payment Due              (6 − 7; on a retainage release, the released amount)
 *   9 Balance to Finish, Incl. Retainage (3 − 6)
 *
 * ── Behavior-preserving extraction (Slice 1) ────────────────────────────────────────
 * `computeSubcontractorRollup` reproduces the previous inline rollup EXACTLY (numbers
 * unchanged). Two correctness discrepancies were found while unifying and are tracked as
 * SEPARATE, independently-verified fixes — deliberately NOT changed here, because altering
 * them changes live payment-due amounts:
 *   (A) Line 5 sums THIS-period retainage (`retainage_amount`) rather than cumulative
 *       retainage held (`previous + this − released`). "Currently retained" is tracked
 *       cumulatively elsewhere. See `getWorkCurrentlyRetained` semantics.
 *   (B) The prime-side calc's Line 9 uses `scheduledValue − completedAndStored`, which is
 *       non-AIA. Line 9 must be `contractSumToDate − totalEarnedLessRetainage` (as the
 *       subcontractor path already does).
 * See docs/ops/handoffs for the correctness-fix follow-up.
 */

/** Per-line inputs the SOV editor and server write path operate on. */
export interface PaymentApplicationLineInput {
  scheduled_value?: number | null;
  work_completed_previous?: number | null;
  work_completed_period?: number | null;
  materials_stored?: number | null;
  retainage_pct?: number | null;
  materials_retainage_pct?: number | null;
  work_retainage_released?: number | null;
  materials_retainage_released?: number | null;
  previous_work_retainage?: number | null;
  previous_materials_retainage?: number | null;
}

/** Per-line derived figures. Mirrors the Postgres GENERATED columns + editor preview. */
export interface PaymentApplicationLineFinancials {
  /** = work_completed_previous + work_completed_period + materials_stored (DB generated). */
  total_completed_stored: number;
  /** = total_completed_stored / scheduled_value * 100 (0 when scheduled is 0). */
  work_completed_pct: number;
  /** = scheduled_value − total_completed_stored (DB generated). */
  balance_to_finish: number;
  /** = work_completed_period * retainage_pct / 100 (this-period work retainage). */
  retainage_amount: number;
  /** = materials_stored * materials_retainage_pct / 100 (this-period materials retainage). */
  materials_retainage_amount: number;
  /**
   * = (work_completed_period + materials_stored)
   *   − (retainage_amount + materials_retainage_amount)
   *   + (work_retainage_released + materials_retainage_released)   (DB generated).
   */
  net_amount_this_period: number;
  /** Cumulative work retainage held: previous + this − released. */
  work_currently_retained: number;
  /** Cumulative materials retainage held: previous + this − released. */
  materials_currently_retained: number;
  /** Max releasable this period: previous_work_retainage + retainage_amount. */
  max_work_releasable: number;
  /** Max releasable this period: previous_materials_retainage + materials_retainage_amount. */
  max_materials_releasable: number;
}

/** The 9-line G702 rollup (snake_case to match the API/hook/tab contract). */
export interface PaymentApplicationRollup {
  original_contract_sum: number;
  net_change_by_change_orders: number;
  contract_sum_to_date: number;
  total_completed_and_stored: number;
  total_work_retainage: number;
  total_materials_retainage: number;
  total_retainage: number;
  total_earned_less_retainage: number;
  less_previous_certificates: number;
  current_payment_due: number;
  balance_to_finish_including_retainage: number;
}

const num = (value: number | null | undefined): number => Number(value) || 0;

/**
 * Derive per-line figures from raw inputs. Retainage amounts are recomputed from their
 * percentages (this-period only), matching the SOV editor preview and the server write
 * path. `total_completed_stored`, `balance_to_finish`, and `net_amount_this_period` are
 * pinned by test to the Postgres GENERATED column expressions.
 */
export function computeLineFinancials(
  input: PaymentApplicationLineInput,
): PaymentApplicationLineFinancials {
  const scheduled = num(input.scheduled_value);
  const previous = num(input.work_completed_previous);
  const thisPeriod = num(input.work_completed_period);
  const stored = num(input.materials_stored);
  const workPct = num(input.retainage_pct);
  const matPct = num(input.materials_retainage_pct);
  const workReleased = num(input.work_retainage_released);
  const matReleased = num(input.materials_retainage_released);
  const prevWorkRet = num(input.previous_work_retainage);
  const prevMatRet = num(input.previous_materials_retainage);

  const total_completed_stored = previous + thisPeriod + stored;
  // Retainage applies to THIS period's billing, not cumulative.
  const retainage_amount = (thisPeriod * workPct) / 100;
  const materials_retainage_amount = (stored * matPct) / 100;

  return {
    total_completed_stored,
    work_completed_pct:
      scheduled > 0 ? (total_completed_stored / scheduled) * 100 : 0,
    balance_to_finish: scheduled - total_completed_stored,
    retainage_amount,
    materials_retainage_amount,
    net_amount_this_period:
      thisPeriod +
      stored -
      (retainage_amount + materials_retainage_amount) +
      workReleased +
      matReleased,
    work_currently_retained: prevWorkRet + retainage_amount - workReleased,
    materials_currently_retained:
      prevMatRet + materials_retainage_amount - matReleased,
    max_work_releasable: prevWorkRet + retainage_amount,
    max_materials_releasable: prevMatRet + materials_retainage_amount,
  };
}

/** A persisted line's cumulative work retainage held: previous + this-period − released. */
export function workCurrentlyRetained(line: {
  previous_work_retainage?: number | null;
  retainage_amount?: number | null;
  work_retainage_released?: number | null;
}): number {
  return (
    num(line.previous_work_retainage) +
    num(line.retainage_amount) -
    num(line.work_retainage_released)
  );
}

/** A persisted line's cumulative materials retainage held: previous + this-period − released. */
export function materialsCurrentlyRetained(line: {
  previous_materials_retainage?: number | null;
  materials_retainage_amount?: number | null;
  materials_retainage_released?: number | null;
}): number {
  return (
    num(line.previous_materials_retainage) +
    num(line.materials_retainage_amount) -
    num(line.materials_retainage_released)
  );
}

/** Persisted per-line figures the rollup sums. Read from the DB (generated columns). */
export interface PaymentApplicationRollupLine {
  total_completed_stored?: number | null;
  retainage_amount?: number | null;
  materials_retainage_amount?: number | null;
  net_amount_this_period?: number | null;
  // Prior-period + released retainage — needed for the cumulative AIA Line 5.
  previous_work_retainage?: number | null;
  previous_materials_retainage?: number | null;
  work_retainage_released?: number | null;
  materials_retainage_released?: number | null;
}

/**
 * A per-line view normalized across surfaces (subcontractor invoices and prime payment
 * applications carry the same figures under different column names). The shared core rollup
 * operates only on this shape so the AIA math lives in exactly one place.
 */
interface NormalizedG702Line {
  totalCompleted: number;
  workRetainageThisPeriod: number;
  workRetainagePrevious: number;
  workRetainageReleased: number;
  materialsRetainageThisPeriod: number;
  materialsRetainagePrevious: number;
  materialsRetainageReleased: number;
  netAmountThisPeriod: number;
}

/**
 * The single source of truth for the AIA G702 rollup. Both surfaces map their line shape to
 * NormalizedG702Line and call this, so Lines 5, 6, 8, and 9 can never drift between them.
 *
 * - Line 5 (Retainage) is CUMULATIVE held to date: Σ(this-period + previous − released).
 * - Line 9 (Balance to Finish) is the true AIA definition: contractSumToDate − Line 6.
 */
function g702Rollup(params: {
  lines: NormalizedG702Line[];
  originalContractSum: number;
  netChangeByChangeOrders: number;
  previousCertificates: number;
  isRetainageRelease: boolean;
}): PaymentApplicationRollup {
  const {
    lines,
    originalContractSum,
    netChangeByChangeOrders,
    isRetainageRelease,
  } = params;

  const total_completed_and_stored = lines.reduce(
    (sum, l) => sum + l.totalCompleted,
    0,
  );
  // Line 5a/5b: retainage HELD TO DATE = this period + previous − released.
  const total_work_retainage = lines.reduce(
    (sum, l) =>
      sum +
      l.workRetainageThisPeriod +
      l.workRetainagePrevious -
      l.workRetainageReleased,
    0,
  );
  const total_materials_retainage = lines.reduce(
    (sum, l) =>
      sum +
      l.materialsRetainageThisPeriod +
      l.materialsRetainagePrevious -
      l.materialsRetainageReleased,
    0,
  );
  const invoice_net_amount = lines.reduce(
    (sum, l) => sum + l.netAmountThisPeriod,
    0,
  );

  const total_retainage = total_work_retainage + total_materials_retainage;
  const total_earned_less_retainage =
    total_completed_and_stored - total_retainage;
  const contract_sum_to_date = originalContractSum + netChangeByChangeOrders;

  // On a retainage release, previous certificates are derived so that current payment due
  // equals only the released amount.
  const less_previous_certificates = isRetainageRelease
    ? Math.max(total_earned_less_retainage - invoice_net_amount, 0)
    : params.previousCertificates;

  const current_payment_due = isRetainageRelease
    ? invoice_net_amount
    : total_earned_less_retainage - less_previous_certificates;

  // AIA Line 9 — Balance to Finish, Including Retainage = Line 3 − Line 6.
  const balance_to_finish_including_retainage =
    contract_sum_to_date - total_earned_less_retainage;

  return {
    original_contract_sum: originalContractSum,
    net_change_by_change_orders: netChangeByChangeOrders,
    contract_sum_to_date,
    total_completed_and_stored,
    total_work_retainage,
    total_materials_retainage,
    total_retainage,
    total_earned_less_retainage,
    less_previous_certificates,
    current_payment_due,
    balance_to_finish_including_retainage,
  };
}

/**
 * Compute the 9-line subcontractor rollup. The caller supplies `original_contract_sum`,
 * `net_change_by_change_orders`, and the pre-computed `less_previous_certificates` (sum of
 * prior approved invoices' net amounts). Line 5 is cumulative retainage held (a no-op vs the
 * prior this-period sum for any invoice with no carried-forward retainage).
 */
export function computeSubcontractorRollup(params: {
  lineItems: PaymentApplicationRollupLine[];
  original_contract_sum: number;
  net_change_by_change_orders: number;
  less_previous_certificates: number;
  is_retainage_release: boolean;
}): PaymentApplicationRollup {
  return g702Rollup({
    lines: params.lineItems.map((li) => ({
      totalCompleted: num(li.total_completed_stored),
      workRetainageThisPeriod: num(li.retainage_amount),
      workRetainagePrevious: num(li.previous_work_retainage),
      workRetainageReleased: num(li.work_retainage_released),
      materialsRetainageThisPeriod: num(li.materials_retainage_amount),
      materialsRetainagePrevious: num(li.previous_materials_retainage),
      materialsRetainageReleased: num(li.materials_retainage_released),
      netAmountThisPeriod: num(li.net_amount_this_period),
    })),
    originalContractSum: params.original_contract_sum,
    netChangeByChangeOrders: params.net_change_by_change_orders,
    previousCertificates: params.less_previous_certificates,
    isRetainageRelease: params.is_retainage_release,
  });
}

// ── Prime payment application (owner/GC side) ────────────────────────────────────────────

/** Per-line inputs for a prime contract payment application (AIA G703 line). */
export interface PaymentApplicationSummaryLineItem {
  scheduled_value: number;
  total_completed: number | null;
  retainage_this_period_work: number;
  retainage_previous_work: number;
  retainage_released_work: number;
  retainage_this_period_materials: number;
  retainage_previous_materials: number;
  retainage_released_materials: number;
}

export interface PaymentApplicationContractSummary {
  original_contract_value: number;
  revised_contract_value: number;
}

export interface PaymentApplicationSummaryLine {
  number: string;
  label: string;
  value: number;
  indent?: boolean;
  highlight?: boolean;
}

export interface PaymentApplicationSummary extends PaymentApplicationRollup {
  lines: PaymentApplicationSummaryLine[];
}

/** Format a rollup as the 9 labelled AIA G702 certificate lines. */
export function formatG702Lines(
  rollup: PaymentApplicationRollup,
): PaymentApplicationSummaryLine[] {
  return [
    { number: "1", label: "Original Contract Sum", value: rollup.original_contract_sum },
    { number: "2", label: "Net Change by Change Orders", value: rollup.net_change_by_change_orders },
    { number: "3", label: "Contract Sum to Date (1 +/- 2)", value: rollup.contract_sum_to_date },
    { number: "4", label: "Total Completed and Stored to Date", value: rollup.total_completed_and_stored },
    { number: "5a", label: "Retainage: % of Completed Work", value: rollup.total_work_retainage, indent: true },
    { number: "5b", label: "Retainage: % of Stored Material", value: rollup.total_materials_retainage, indent: true },
    { number: "5", label: "Total Retainage (5a + 5b)", value: rollup.total_retainage },
    { number: "6", label: "Total Earned Less Retainage (4 - 5)", value: rollup.total_earned_less_retainage },
    { number: "7", label: "Less Previous Certificates for Payment", value: rollup.less_previous_certificates },
    { number: "8", label: "Current Payment Due", value: rollup.current_payment_due, highlight: true },
    { number: "9", label: "Balance to Finish, Including Retainage", value: rollup.balance_to_finish_including_retainage },
  ];
}

/**
 * Compute a prime contract payment application through the shared core, then format the
 * certificate lines. Replaces the former `calculatePaymentApplicationSummary`, correcting
 * Line 9 to the true AIA definition (was `scheduledValue − completedAndStored`).
 */
export function computePrimePaymentApplication(params: {
  lineItems: PaymentApplicationSummaryLineItem[];
  contract: PaymentApplicationContractSummary;
  previousPaymentDue: number;
}): PaymentApplicationSummary {
  const rollup = g702Rollup({
    lines: params.lineItems.map((li) => ({
      totalCompleted: num(li.total_completed),
      workRetainageThisPeriod: num(li.retainage_this_period_work),
      workRetainagePrevious: num(li.retainage_previous_work),
      workRetainageReleased: num(li.retainage_released_work),
      materialsRetainageThisPeriod: num(li.retainage_this_period_materials),
      materialsRetainagePrevious: num(li.retainage_previous_materials),
      materialsRetainageReleased: num(li.retainage_released_materials),
      netAmountThisPeriod: 0,
    })),
    originalContractSum: params.contract.original_contract_value,
    netChangeByChangeOrders:
      params.contract.revised_contract_value -
      params.contract.original_contract_value,
    previousCertificates: params.previousPaymentDue,
    isRetainageRelease: false,
  });
  return { ...rollup, lines: formatG702Lines(rollup) };
}
