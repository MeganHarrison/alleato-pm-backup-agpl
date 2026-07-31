import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { serviceDb } from "@/lib/supabase/service-db";

export const GET = withApiGuardrails("/api/accounting/bills#GET", async () => {
  await requireCurrentUserAppCapability(
    "view_accounting",
    "/api/accounting/bills#GET",
    "Accounting access required.",
  );

    const [billsResult, projectsResult] = await Promise.all([
    serviceDb.from("acumatica_ap_bills")
      .select("id, external_key, reference_nbr, document_type, vendor_id, vendor_ref, project_code, project_id, date, due_date, status, description, amount, balance, currency_id, terms, hold, approved_for_payment, last_modified_at, acumatica_sync_at")
      .order("date", { ascending: false }),
    serviceDb.from("acumatica_projects").select("project_id, description"),
  ]);

  if (billsResult.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/accounting/bills#GET",
      message: "Failed to load accounting bills.",
      details: { reason: billsResult.error.message },
      cause: billsResult.error,
    });
  }

  if (projectsResult.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/accounting/bills#GET",
      message: "Failed to load accounting project metadata for bills.",
      details: { reason: projectsResult.error.message },
      cause: projectsResult.error,
    });
  }

  const projectDescByCode = new Map<string, string>();
  for (const row of projectsResult.data ?? []) {
    if (row.project_id && row.description) {
      projectDescByCode.set(row.project_id, row.description);
    }
  }

  const enriched = (billsResult.data ?? []).map((bill) => ({
    ...bill,
    project_description: bill.project_code
      ? (projectDescByCode.get(bill.project_code) ?? null)
      : null,
  }));

  return NextResponse.json(enriched);
});
