import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import { syncLinkedOwnerPaymentApplication } from "@/lib/invoicing/owner-payment-application-sync";

// POST /api/projects/[projectId]/invoicing/owner/[invoiceId]/approve
// Approve an invoice
export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/owner/[invoiceId]/approve#POST",
  async ({ request, params }) => {
  
    const { projectId, invoiceId } = params;
    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // First, verify the invoice exists and belongs to the project
    const { data: invoice, error: fetchError } = await supabase
      .from("owner_invoices")
      .select(
        `
        *,
        prime_contracts!inner(project_id)
      `,
      )
      .eq("id", invoiceIdNum)
      .eq("prime_contracts.project_id", projectIdNum)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        throw new GuardrailError({
          code: "ROUTE_BINDING_MISSING",
          where: "projects/[projectId]/invoicing/owner/[invoiceId]/approve#POST",
          message: "Invoice not found",
          status: 404,
          severity: "low",
        });
      }

      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/approve#POST",
        message: "Failed to verify invoice",
        details: { reason: fetchError.message },
        cause: fetchError,
      });
    }

    // Only under_review invoices can be approved
    if (invoice.status !== "under_review") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/approve#POST",
        message: "Invoice must be Under Review to approve",
        status: 400,
        severity: "low",
      });
    }

    // Update invoice status to approved
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("owner_invoices")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", invoiceIdNum)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "42501") {
        throw new GuardrailError({
          code: "AUTH_FORBIDDEN",
          where: "projects/[projectId]/invoicing/owner/[invoiceId]/approve#POST",
          message: "Permission denied",
          status: 403,
          severity: "medium",
        });
      }

      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/approve#POST",
        message: "Failed to approve invoice",
        details: { reason: updateError.message },
        cause: updateError,
      });
    }

    await syncLinkedOwnerPaymentApplication({
      supabase,
      projectId: projectIdNum,
      invoice,
      status: "approved",
      where: "projects/[projectId]/invoicing/owner/[invoiceId]/approve#POST",
    });

    return NextResponse.json({
      data: updatedInvoice,
      message: "Invoice approved successfully",
    });
    },
);
