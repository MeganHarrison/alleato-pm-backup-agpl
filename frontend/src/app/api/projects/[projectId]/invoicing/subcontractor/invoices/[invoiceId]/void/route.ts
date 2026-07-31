import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

async function readOptionalVoidReason(request: Request): Promise<string | null> {
  const text = await request.text();
  if (!text.trim()) return null;
  try {
    const body = JSON.parse(text) as { reason?: unknown };
    return typeof body.reason === "string" ? body.reason.trim() || null : null;
  } catch (error) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where:
        "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/void#POST",
      message: "Void subcontractor invoice request body must be valid JSON when provided.",
      status: 400,
      cause: error,
    });
  }
}

// POST /api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/void
// Void a subcontractor invoice. Pre-condition: must not already be paid or void.
export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/void#POST",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId, invoiceId } = params;

    const user = await getApiRouteUser();
    const authError = null as Error | null;

    if (authError) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/void#POST",
        message: "Authentication failed",
        status: 401,
        severity: "medium",
        details: { reason: authError.message },
        cause: authError,
      });
    }

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/void#POST", message: "Authentication required." });
    }

    const reason = await readOptionalVoidReason(request);

    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    const { data: invoice, error: fetchError } = await supabase
      .from("subcontractor_invoices")
      .select("id, status, notes")
      .eq("id", invoiceIdNum)
      .eq("project_id", projectIdNum)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        throw new GuardrailError({
          code: "ROUTE_BINDING_MISSING",
          where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/void#POST",
          message: "Invoice not found",
          status: 404,
          severity: "low",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/void#POST",
        message: "Failed to verify invoice",
        details: { reason: fetchError.message },
        cause: fetchError,
      });
    }

    if (invoice.status === "paid" || invoice.status === "void") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/void#POST",
        message: `Invoice cannot be voided from status "${invoice.status}"`,
        status: 400,
        severity: "low",
      });
    }

    const existingNotes: string | null = invoice.notes ?? null;
    const voidNote = reason
      ? `[Voided ${new Date().toISOString()}] ${reason}`
      : `[Voided ${new Date().toISOString()}]`;
    const mergedNotes = existingNotes ? `${existingNotes}\n${voidNote}` : voidNote;

    const { data: updated, error: updateError } = await supabase
      .from("subcontractor_invoices")
      .update({
        status: "void",
        notes: mergedNotes,
      })
      .eq("id", invoiceIdNum)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "42501") {
        throw new GuardrailError({
          code: "AUTH_FORBIDDEN",
          where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/void#POST",
          message: "Permission denied",
          status: 403,
          severity: "medium",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/void#POST",
        message: "Failed to void invoice",
        details: { reason: updateError.message },
        cause: updateError,
      });
    }

    return NextResponse.json({
      data: updated,
      message: "Invoice voided successfully",
    });
    },
);
