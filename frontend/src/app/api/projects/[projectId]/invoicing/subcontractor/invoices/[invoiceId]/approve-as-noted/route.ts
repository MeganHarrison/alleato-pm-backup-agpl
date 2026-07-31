import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { notifySubcontractorOfInvoiceDecision } from "@/lib/invoicing/subcontractor-invoice-notifications";
import { stampSubcontractorInvoiceStatusAuditActor } from "@/lib/invoicing/subcontractor-invoice-audit";

// POST /api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/approve-as-noted
// Transition invoice to approved_as_noted. Pre-condition: must be under_review.
export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/approve-as-noted#POST",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId, invoiceId } = params;

    const user = await getApiRouteUser();
    const authError = null as Error | null;

    if (authError) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/approve-as-noted#POST",
        message: "Authentication failed",
        status: 401,
        severity: "medium",
        details: { reason: authError.message },
        cause: authError,
      });
    }

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/approve-as-noted#POST", message: "Authentication required." });
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
          where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/approve-as-noted#POST",
          message: "Invoice not found",
          status: 404,
          severity: "low",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/approve-as-noted#POST",
        message: "Failed to verify invoice",
        details: { reason: fetchError.message },
        cause: fetchError,
      });
    }

    if (invoice.status !== "under_review") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/approve-as-noted#POST",
        message: "Invoice must be Under Review to approve as noted",
        status: 400,
        severity: "low",
      });
    }

    const transitionStartedAt = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: "approved_as_noted",
      approved_at: new Date().toISOString(),
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
          where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/approve-as-noted#POST",
          message: "Permission denied",
          status: 403,
          severity: "medium",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/approve-as-noted#POST",
        message: "Failed to approve invoice as noted",
        details: { reason: updateError.message },
        cause: updateError,
      });
    }

    const auditStamp = await stampSubcontractorInvoiceStatusAuditActor({
      supabase,
      invoiceId: invoiceIdNum,
      fromStatus: invoice.status,
      toStatus: "approved_as_noted",
      transitionStartedAt,
      actor: user,
    });
    if (!auditStamp.ok) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/approve-as-noted#POST",
        message: "Invoice approved as noted, but the audit actor could not be recorded.",
        details: { reason: auditStamp.reason },
      });
    }

    // Fire-and-forget: notify the subcontractor of the approval.
    void notifySubcontractorOfInvoiceDecision({
      projectId: projectIdNum,
      invoiceId: invoiceIdNum,
      decision: "approved_as_noted",
      notes: notes?.trim() || null,
    });

    return NextResponse.json({
      data: updated,
      message: "Invoice approved as noted successfully",
    });
    },
);
