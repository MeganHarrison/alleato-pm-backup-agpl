export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { serviceDb } from "@/lib/supabase/service-db";

export const GET = withApiGuardrails(
  "/api/accounting/ap-invoices#GET",
  async () => {
    await requireCurrentUserAppCapability(
      "view_accounting",
      "/api/accounting/ap-invoices#GET",
      "Accounting access required.",
    );


    // 1. Fetch subcontractor invoices that have been synced to Acumatica
    const { data: invoices, error: invoicesError } = await serviceDb.from("subcontractor_invoices")
      .select(
        "id, acumatica_ap_bill_id, acumatica_ref_nbr, acumatica_doc_type, invoice_number, project_id, billing_date, status, notes, subcontract_id, purchase_order_id, acumatica_sync_at, created_at",
      )
      .not("acumatica_ap_bill_id", "is", null)
      .order("billing_date", { ascending: false });

    if (invoicesError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/accounting/ap-invoices#GET",
        message: "Failed to load AP invoice records.",
        details: { reason: invoicesError.message },
        cause: invoicesError,
      });
    }

    const rows = invoices ?? [];

    if (rows.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Collect bill IDs and project IDs for enrichment lookups
    const billIds = [
      ...new Set(
        rows
          .map((r) => r.acumatica_ap_bill_id)
          .filter((id): id is number => id !== null),
      ),
    ];
    const projectIds = [
      ...new Set(
        rows
          .map((r) => r.project_id)
          .filter((id): id is number => id !== null),
      ),
    ];

    // 3. Parallel fetch of AP bills (for amount + vendor_id) and projects (for name)
    const [billsResult, projectsResult] = await Promise.all([
      billIds.length > 0
        ? serviceDb.from("acumatica_ap_bills")
            .select("id, vendor_id, amount, date")
            .in("id", billIds)
        : Promise.resolve({ data: [], error: null }),
      projectIds.length > 0
        ? serviceDb.from("projects")
            .select("id, name")
            .in("id", projectIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (billsResult.error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/accounting/ap-invoices#GET",
        message: "Failed to load AP bill details.",
        details: { reason: billsResult.error.message },
        cause: billsResult.error,
      });
    }

    if (projectsResult.error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/accounting/ap-invoices#GET",
        message: "Failed to load project names.",
        details: { reason: projectsResult.error.message },
        cause: projectsResult.error,
      });
    }

    // 4. Build lookup maps
    const billById = new Map(
      (billsResult.data ?? []).map((b) => [b.id, b]),
    );
    const projectById = new Map(
      (projectsResult.data ?? []).map((p) => [p.id, p.name]),
    );

    // 5. Enrich and return
    const enriched = rows.map((row) => {
      const bill = row.acumatica_ap_bill_id
        ? billById.get(row.acumatica_ap_bill_id)
        : undefined;

      return {
        id: row.id,
        acumatica_ap_bill_id: row.acumatica_ap_bill_id,
        acumatica_ref_nbr: row.acumatica_ref_nbr,
        acumatica_doc_type: row.acumatica_doc_type,
        invoice_number: row.invoice_number,
        vendor_id: bill?.vendor_id ?? null,
        project_id: row.project_id,
        project_name: row.project_id
          ? (projectById.get(row.project_id) ?? null)
          : null,
        billing_date: row.billing_date,
        status: row.status,
        amount: bill?.amount ?? null,
        notes: row.notes,
        subcontract_id: row.subcontract_id,
        purchase_order_id: row.purchase_order_id,
        acumatica_sync_at: row.acumatica_sync_at,
        created_at: row.created_at,
      };
    });

    return NextResponse.json(enriched);
  },
);
