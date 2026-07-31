import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

// DELETE /api/projects/[projectId]/invoicing/owner/[invoiceId]/line-items/[lineItemId]
// Delete a single line item. Only allowed when invoice is draft or revise_and_resubmit.
export const DELETE = withApiGuardrails<{ projectId: string; invoiceId: string; lineItemId: string }>(
  "projects/[projectId]/invoicing/owner/[invoiceId]/line-items/[lineItemId]#DELETE",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId, invoiceId, lineItemId } = params;

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items/[lineItemId]#DELETE", message: "Authentication required." });
    }

    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);
    const lineItemIdNum = parseInt(lineItemId, 10);

    if (
      Number.isNaN(projectIdNum) ||
      Number.isNaN(invoiceIdNum) ||
      Number.isNaN(lineItemIdNum)
    ) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items/[lineItemId]#DELETE",
        message: "Invalid id parameter.",
      });
    }

    // Verify invoice belongs to project + fetch status
    const { data: invoice, error: verifyError } = await supabase
      .from("owner_invoices")
      .select(`id, status, prime_contracts!inner(project_id)`)
      .eq("id", invoiceIdNum)
      .eq("prime_contracts.project_id", projectIdNum)
      .single();

    if (verifyError) {
      if (verifyError.code === "PGRST116") {
        throw new GuardrailError({
          code: "ROUTE_BINDING_MISSING",
          where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items/[lineItemId]#DELETE",
          message: "Invoice not found.",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items/[lineItemId]#DELETE",
        message: "Failed to verify invoice.",
        details: verifyError.message,
      });
    }

    const editableStatuses = ["draft", "revise_and_resubmit"];
    if (!editableStatuses.includes(invoice.status ?? "")) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items/[lineItemId]#DELETE",
        message: `Invoice status '${invoice.status}' does not allow editing.`,
      });
    }

    const { error: deleteError } = await supabase
      .from("owner_invoice_line_items")
      .delete()
      .eq("id", lineItemIdNum)
      .eq("invoice_id", invoiceIdNum);

    if (deleteError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items/[lineItemId]#DELETE",
        message: "Failed to delete line item.",
        details: deleteError.message,
      });
    }

    return NextResponse.json({ success: true });
    },
);
