import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";

type CommitmentPaymentRow = {
  id: number;
  project_id: number;
  subcontract_id: string | null;
  purchase_order_id: string | null;
  subcontractor_invoice_id: number | null;
  acumatica_check_id: number | null;
  acumatica_ap_bill_id: number | null;
  external_key: string;
  payment_number: string | null;
  payment_ref: string | null;
  payment_method: string | null;
  payment_date: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  amount: number;
  status: string | null;
  source: string;
  acumatica_sync_at: string | null;
  subcontractor_invoice?: { id: number; invoice_number: string | null } | null;
};

export const GET = withApiGuardrails<{
  projectId: string;
  commitmentId: string;
}>(
  "projects/[projectId]/commitments/[commitmentId]/payments#GET",
  async ({ params }) => {
    const { projectId, commitmentId } = params;
    const projectIdNum = parseInt(projectId, 10);

    if (!Number.isFinite(projectIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/commitments/[commitmentId]/payments#GET",
        message: "Invalid project id.",
        status: 400,
        severity: "low",
      });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("commitment_payments")
      .select(
        `
        id,
        project_id,
        subcontract_id,
        purchase_order_id,
        subcontractor_invoice_id,
        acumatica_check_id,
        acumatica_ap_bill_id,
        external_key,
        payment_number,
        payment_ref,
        payment_method,
        payment_date,
        vendor_id,
        vendor_name,
        amount,
        status,
        source,
        acumatica_sync_at,
        subcontractor_invoice:subcontractor_invoices(id, invoice_number)
      `,
      )
      .eq("project_id", projectIdNum)
      .or(
        `subcontract_id.eq.${commitmentId},purchase_order_id.eq.${commitmentId}`,
      )
      .order("payment_date", { ascending: false, nullsFirst: false });

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/commitments/[commitmentId]/payments#GET",
        message: "Failed to fetch commitment payments.",
        details: error.message,
        cause: error,
      });
    }

    return NextResponse.json({
      data: (data ?? []) as CommitmentPaymentRow[],
    });
  },
);
