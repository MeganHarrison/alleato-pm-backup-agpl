import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { serviceDb } from "@/lib/supabase/service-db";

export const GET = withApiGuardrails("/api/accounting/payments#GET", async () => {
  await requireCurrentUserAppCapability(
    "view_accounting",
    "/api/accounting/payments#GET",
    "Accounting access required.",
  );


  // Fetch payments and payment applications in parallel
  const [paymentsResult, applicationsResult] = await Promise.all([
    serviceDb.from("acumatica_payments")
      .select("id, external_key, reference_nbr, document_type, customer_id, customer_name, status, description, payment_method, payment_ref, external_ref, cash_account, currency_id, application_date, payment_amount, available_balance, last_modified_at, acumatica_sync_at")
      .order("application_date", { ascending: false }),
    serviceDb.from("acumatica_payment_applications")
      .select("payment_reference_nbr, invoice_reference_nbr, amount_applied"),
  ]);

  if (paymentsResult.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/accounting/payments#GET",
      message: "Failed to load accounting payments.",
      details: { reason: paymentsResult.error.message },
      cause: paymentsResult.error,
    });
  }

  if (applicationsResult.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/accounting/payments#GET",
      message: "Failed to load accounting payment applications.",
      details: { reason: applicationsResult.error.message },
      cause: applicationsResult.error,
    });
  }

  // Build a map: payment_reference_nbr → [{invoiceRef, amount}]
  const invoiceMap = new Map<string, Array<{ invoiceRef: string; amount: number }>>();
  for (const app of applicationsResult.data ?? []) {
    if (!app.payment_reference_nbr || !app.invoice_reference_nbr) continue;
    const existing = invoiceMap.get(app.payment_reference_nbr) ?? [];
    existing.push({ invoiceRef: app.invoice_reference_nbr, amount: app.amount_applied ?? 0 });
    invoiceMap.set(app.payment_reference_nbr, existing);
  }

  // Filter out Credit Memos — they exist in BOTH acumatica_payments and
  // acumatica_ar_invoices. Keeping them only in invoices (where they belong
  // as accounting adjustments) prevents double-counting on the payments page.
  const payments = (paymentsResult.data ?? []).filter(
    (p) => p.document_type !== "Credit Memo",
  );

  // Enrich each payment with linked invoices
  const enriched = payments.map((payment) => ({
    ...payment,
    linked_invoices: invoiceMap.get(payment.reference_nbr ?? "") ?? [],
  }));

  return NextResponse.json(enriched);
});
