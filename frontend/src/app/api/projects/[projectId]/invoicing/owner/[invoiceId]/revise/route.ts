import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import { syncLinkedOwnerPaymentApplication } from "@/lib/invoicing/owner-payment-application-sync";

// POST /api/projects/[projectId]/invoicing/owner/[invoiceId]/revise
// Request revision of an invoice (UNDER REVIEW → REVISE AND RESUBMIT)
export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/owner/[invoiceId]/revise#POST",
  async ({ request, params }) => {
  
    const { projectId, invoiceId } = params;
    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    // Verify invoice exists and belongs to the project
    const { data: invoice, error: fetchError } = await supabase
      .from("owner_invoices")
      .select(`id, status, prime_contract_id, payment_application_id, prime_contracts!inner(project_id)`)
      .eq("id", invoiceIdNum)
      .eq("prime_contracts.project_id", projectIdNum)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        throw new GuardrailError({
          code: "ROUTE_BINDING_MISSING",
          where: "projects/[projectId]/invoicing/owner/[invoiceId]/revise#POST",
          message: "Invoice not found.",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/revise#POST",
        message: "Failed to fetch invoice.",
        details: fetchError.message,
      });
    }

    // Only under_review invoices can be sent back for revision
    if (invoice.status !== "under_review") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/revise#POST",
        message:
          "Cannot request revision. Only invoices under review can be sent back.",
        details: `Current status: ${invoice.status}`,
      });
    }

    const updatePayload: Record<string, unknown> = { status: "revise_and_resubmit" };
    if (reason) updatePayload.notes = reason;

    const { data: updated, error: updateError } = await supabase
      .from("owner_invoices")
      .update(updatePayload)
      .eq("id", invoiceIdNum)
      .select()
      .single();

    if (updateError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/revise#POST",
        message: "Failed to update invoice status.",
        details: updateError.message,
      });
    }

    await syncLinkedOwnerPaymentApplication({
      supabase,
      projectId: projectIdNum,
      invoice,
      status: "revise_and_resubmit",
      where: "projects/[projectId]/invoicing/owner/[invoiceId]/revise#POST",
    });

    return NextResponse.json({
      data: updated,
      message: "Invoice returned for revision",
    });
    },
);
