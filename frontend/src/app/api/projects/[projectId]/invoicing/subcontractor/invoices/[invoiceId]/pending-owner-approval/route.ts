import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { stampSubcontractorInvoiceStatusAuditActor } from "@/lib/invoicing/subcontractor-invoice-audit";

// POST /api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/pending-owner-approval
// Transition invoice to pending_owner_approval. Pre-condition: must be under_review.
// Mirrors Procore: GC has reviewed but the owner still needs to sign off before
// the cost reflects in the budget.
export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/pending-owner-approval#POST",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId, invoiceId } = params;

    const user = await getApiRouteUser();
    const authError = null as Error | null;

    if (authError) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/pending-owner-approval#POST",
        message: "Authentication failed",
        status: 401,
        severity: "medium",
        details: { reason: authError.message },
        cause: authError,
      });
    }

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/pending-owner-approval#POST", message: "Authentication required." });
    }

    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);
    const body = await request.json().catch(() => ({}));
    const { notes } = body as { notes?: string };

    const { data: invoice, error: fetchError } = await supabase
      .from("subcontractor_invoices")
      .select("id, status")
      .eq("id", invoiceIdNum)
      .eq("project_id", projectIdNum)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        throw new GuardrailError({
          code: "ROUTE_BINDING_MISSING",
          where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/pending-owner-approval#POST",
          message: "Invoice not found",
          status: 404,
          severity: "low",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/pending-owner-approval#POST",
        message: "Failed to verify invoice",
        details: { reason: fetchError.message },
        cause: fetchError,
      });
    }

    if (invoice.status !== "under_review") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/pending-owner-approval#POST",
        message: "Invoice must be Under Review to send for owner approval",
        status: 400,
        severity: "low",
      });
    }

    const transitionStartedAt = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: "pending_owner_approval",
    };
    if (notes?.trim()) {
      updatePayload.notes = notes.trim();
    }

    const { data: updated, error: updateError } = await supabase
      .from("subcontractor_invoices")
      .update(updatePayload)
      .eq("id", invoiceIdNum)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "42501") {
        throw new GuardrailError({
          code: "AUTH_FORBIDDEN",
          where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/pending-owner-approval#POST",
          message: "Permission denied",
          status: 403,
          severity: "medium",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/pending-owner-approval#POST",
        message: "Failed to send invoice for owner approval",
        details: { reason: updateError.message },
        cause: updateError,
      });
    }

    const auditStamp = await stampSubcontractorInvoiceStatusAuditActor({
      supabase,
      invoiceId: invoiceIdNum,
      fromStatus: invoice.status,
      toStatus: "pending_owner_approval",
      transitionStartedAt,
      actor: user,
    });
    if (!auditStamp.ok) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/pending-owner-approval#POST",
        message: "Invoice sent for owner approval, but the audit actor could not be recorded.",
        details: { reason: auditStamp.reason },
      });
    }

    return NextResponse.json({
      data: updated,
      message: "Invoice sent for owner approval",
    });
    },
);
