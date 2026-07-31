export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { serviceDb } from "@/lib/supabase/service-db";

export const GET = withApiGuardrails(
  "/api/accounting/ap-payments#GET",
  async () => {
    await requireCurrentUserAppCapability(
      "view_accounting",
      "/api/accounting/ap-payments#GET",
      "Accounting access required.",
    );


    // 1. Fetch commitment payments that have been synced from Acumatica checks
    const { data: payments, error: paymentsError } = await serviceDb.from("commitment_payments")
      .select(
        "id, external_key, acumatica_check_id, payment_number, payment_ref, payment_method, payment_date, vendor_id, vendor_name, project_id, amount, status, source, acumatica_sync_at",
      )
      .not("acumatica_check_id", "is", null)
      .order("payment_date", { ascending: false });

    if (paymentsError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/accounting/ap-payments#GET",
        message: "Failed to load AP payment records.",
        details: { reason: paymentsError.message },
        cause: paymentsError,
      });
    }

    const rows = payments ?? [];

    if (rows.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Collect project IDs for name enrichment
    const projectIds = [
      ...new Set(
        rows
          .map((r) => r.project_id)
          .filter((id): id is number => id !== null),
      ),
    ];

    // 3. Fetch project names
    const { data: projects, error: projectsError } =
      projectIds.length > 0
        ? await serviceDb.from("projects")
            .select("id, name")
            .in("id", projectIds)
        : { data: [], error: null };

    if (projectsError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/accounting/ap-payments#GET",
        message: "Failed to load project names.",
        details: { reason: projectsError.message },
        cause: projectsError,
      });
    }

    const projectById = new Map(
      (projects ?? []).map((p) => [p.id, p.name]),
    );

    // 4. Enrich and return
    const enriched = rows.map((row) => ({
      id: row.id,
      external_key: row.external_key,
      acumatica_check_id: row.acumatica_check_id,
      payment_number: row.payment_number,
      payment_ref: row.payment_ref,
      payment_method: row.payment_method,
      payment_date: row.payment_date,
      vendor_id: row.vendor_id,
      vendor_name: row.vendor_name,
      project_id: row.project_id,
      project_name: row.project_id
        ? (projectById.get(row.project_id) ?? null)
        : null,
      amount: row.amount,
      status: row.status,
      source: row.source,
      acumatica_sync_at: row.acumatica_sync_at,
    }));

    return NextResponse.json(enriched);
  },
);
