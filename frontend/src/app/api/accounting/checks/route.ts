import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { serviceDb } from "@/lib/supabase/service-db";

// Extract bill reference numbers from Acumatica check raw_payload applications
function extractBillRefs(rawPayload: Record<string, unknown>): string[] {
  const refs: string[] = [];
  const APPLICATION_KEYS = ["Applications", "ApplicationHistory", "DocumentsToApply", "Adjustments", "Details"];
  const REF_KEYS = ["ReferenceNbr", "RefNbr", "DocRefNbr", "AdjdRefNbr", "AppliedToDocRef", "BillReferenceNbr", "DocumentRefNbr"];

  for (const key of APPLICATION_KEYS) {
    const list = rawPayload[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item !== "object" || item === null) continue;
      const obj = item as Record<string, unknown>;
      for (const refKey of REF_KEYS) {
        const val = obj[refKey];
        if (typeof val === "string" && val.trim()) {
          refs.push(val.trim());
          break;
        }
        // Acumatica wraps values as { value: "..." }
        if (typeof val === "object" && val !== null && typeof (val as Record<string, unknown>).value === "string") {
          const v = ((val as Record<string, unknown>).value as string).trim();
          if (v) { refs.push(v); break; }
        }
      }
    }
  }
  return [...new Set(refs)];
}

export const GET = withApiGuardrails("/api/accounting/checks#GET", async () => {
  await requireCurrentUserAppCapability(
    "view_accounting",
    "/api/accounting/checks#GET",
    "Accounting access required.",
  );


  const [checksResult, projectLinksResult] = await Promise.all([
    serviceDb.from("acumatica_checks")
      .select("id, external_key, reference_nbr, document_type, vendor_id, vendor_name, payment_ref, application_date, status, description, payment_method, cash_account, currency_id, payment_amount, applied_to_documents, raw_payload, last_modified_at, acumatica_sync_at")
      .order("application_date", { ascending: false }),

    // Primary path: commitment_payments → projects (populated when checks link to subcontractor invoices)
    serviceDb.from("commitment_payments")
      .select("acumatica_check_id, project_id, projects!inner(id, name, project_number, name_code)")
      .not("acumatica_check_id", "is", null),
  ]);

  if (checksResult.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/accounting/checks#GET",
      message: "Failed to load accounting checks.",
      details: { reason: checksResult.error.message },
      cause: checksResult.error,
    });
  }

  // Build check_id → projects map from commitment_payments (primary path)
  const projectsByCheckId = new Map<number, { name: string; number: string | null }[]>();
  if (!projectLinksResult.error) {
    for (const row of projectLinksResult.data ?? []) {
      if (!row.acumatica_check_id) continue;
      const proj = row.projects as { id: number; name: string | null; project_number: string | null; name_code: string | null } | null;
      if (!proj) continue;
      const label = proj.name_code ?? proj.name ?? String(row.project_id);
      const existing = projectsByCheckId.get(row.acumatica_check_id);
      const entry = { name: label, number: proj.project_number ?? null };
      if (existing) {
        if (!existing.some((p) => p.name === label)) existing.push(entry);
      } else {
        projectsByCheckId.set(row.acumatica_check_id, [entry]);
      }
    }
  }

  // Secondary path: extract bill refs from raw_payload → acumatica_ap_bills.project_code
  // Covers checks not yet linked via commitment_payments
  const checksData = checksResult.data ?? [];
  const checkBillRefs = new Map<number, string[]>();
  const allBillRefs = new Set<string>();

  for (const check of checksData) {
    if (projectsByCheckId.has(check.id)) continue; // already resolved via primary path
    const payload = check.raw_payload as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") continue;
    const refs = extractBillRefs(payload);
    if (refs.length > 0) {
      checkBillRefs.set(check.id, refs);
      for (const r of refs) allBillRefs.add(r);
    }
  }

  if (allBillRefs.size > 0) {
    const billsResult = await serviceDb.from("acumatica_ap_bills")
      .select("reference_nbr, project_code")
      .in("reference_nbr", [...allBillRefs])
      .not("project_code", "is", null);

    if (!billsResult.error) {
      const projectByBillRef = new Map<string, string>();
      for (const bill of billsResult.data ?? []) {
        if (bill.reference_nbr && bill.project_code) {
          projectByBillRef.set(bill.reference_nbr, bill.project_code);
        }
      }

      for (const [checkId, refs] of checkBillRefs) {
        const codes = [...new Set(refs.map((r) => projectByBillRef.get(r)).filter(Boolean) as string[])];
        if (codes.length > 0) {
          projectsByCheckId.set(checkId, codes.map((c) => ({ name: c, number: null })));
        }
      }
    }
  }

  // Strip raw_payload from response (internal use only)
  const enriched = checksData.map(({ raw_payload: _rp, ...check }) => ({
    ...check,
    projects: projectsByCheckId.get(check.id) ?? null,
  }));

  return NextResponse.json(enriched);
});
