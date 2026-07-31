import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { exportSubcontractorInvoiceToAcumatica } from "@/lib/acumatica/export-service";

// POST → resend this invoice to the ERP (Acumatica).
export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/erp-resend#POST",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId, invoiceId } = params;
    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    if (!Number.isFinite(projectIdNum) || !Number.isFinite(invoiceIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/erp-resend#POST",
        message: "Invalid project or invoice id.",
      });
    }

    const user = await getApiRouteUser();
    if (!user) throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/erp-resend#POST", message: "Authentication required." });

    // Verify the invoice exists
    const { data: invoice, error: fetchError } = await supabase
      .from("subcontractor_invoices")
      .select("id, status")
      .eq("id", invoiceIdNum)
      .eq("project_id", projectIdNum)
      .single();

    if (fetchError || !invoice) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/erp-resend#POST",
        message: "Invoice not found.",
      });
    }

    if (!["approved", "approved_as_noted", "paid"].includes(invoice.status)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/erp-resend#POST",
        message: "Invoice must be approved before it can be sent to the ERP.",
        details: `Current status: ${invoice.status}`,
      });
    }

    const result = await exportSubcontractorInvoiceToAcumatica(
      projectIdNum,
      invoiceIdNum,
      { userId: user.id },
    );

    const success = result.errors.length === 0;

    await supabase.from("subcontractor_invoice_audit_log").insert({
      invoice_id: invoiceIdNum,
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      event_type: success ? "erp.exported" : "erp.export_failed",
      notes: success
        ? "Exported to Acumatica AP Bill"
        : result.errors.slice(0, 3).join(" | "),
    });

    if (!success) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/erp-resend#POST",
        message: "Failed to export subcontractor invoice to Acumatica.",
        details: result.errors,
      });
    }

    return NextResponse.json({
      message: "ERP export complete",
      status: "exported",
      result,
    });
    },
);
