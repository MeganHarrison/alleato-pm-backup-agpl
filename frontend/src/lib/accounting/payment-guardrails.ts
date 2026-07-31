import { GuardrailError } from "@/lib/guardrails/errors";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  detectGuardrailAlerts,
  type FinancialGuardrailAlert,
} from "@/lib/accounting/aging-calculator";

const DEFAULT_LOOKBACK_DAYS = 90;
const DEFAULT_ROW_LIMIT = 1000;

function dateDaysAgoIso(daysAgo: number): string {
  const now = new Date();
  now.setDate(now.getDate() - daysAgo);
  return now.toISOString().slice(0, 10);
}

export async function loadPaymentGuardrailAlerts({
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
  limit = DEFAULT_ROW_LIMIT,
}: {
  lookbackDays?: number;
  limit?: number;
} = {}): Promise<FinancialGuardrailAlert[]> {
  const lookbackStart = dateDaysAgoIso(lookbackDays);

  const [checksResult, paymentsResult] = await Promise.all([
    serviceDb
      .from("acumatica_checks")
      .select(
        "reference_nbr, vendor_id, vendor_name, payment_ref, payment_amount, application_date, status, cash_account",
      )
      .gte("application_date", lookbackStart)
      .limit(limit),
    serviceDb
      .from("acumatica_payments")
      .select(
        "reference_nbr, customer_id, customer_name, payment_ref, external_ref, payment_amount, application_date, status",
      )
      .gte("application_date", lookbackStart)
      .limit(limit),
  ]);

  const errors = [checksResult.error, paymentsResult.error].filter(Boolean);
  if (errors.length > 0) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "loadPaymentGuardrailAlerts",
      message: "Failed to load payment guardrail source data.",
      details: {
        reasons: errors.map((error) => error?.message).filter(Boolean),
        lookbackDays,
        limit,
      },
    });
  }

  return detectGuardrailAlerts({
    checks: checksResult.data ?? [],
    payments: paymentsResult.data ?? [],
  });
}
