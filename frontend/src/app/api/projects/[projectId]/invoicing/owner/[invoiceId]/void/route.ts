import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";

async function readOptionalVoidReason(request: Request): Promise<string | null> {
  const text = await request.text();
  if (!text.trim()) return null;
  try {
    const body = JSON.parse(text) as { reason?: unknown };
    return typeof body.reason === "string" ? body.reason.trim() || null : null;
  } catch (error) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "projects/[projectId]/invoicing/owner/[invoiceId]/void#POST",
      message: "Void invoice request body must be valid JSON when provided.",
      status: 400,
      cause: error,
    });
  }
}

// POST /api/projects/[projectId]/invoicing/owner/[invoiceId]/void
// Void an owner invoice. Pre-condition: must not already be paid or void.
export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/owner/[invoiceId]/void#POST",
  async ({ request, params }) => {
  
    const { projectId, invoiceId } = params;
    const projectIdNum = parseInt(projectId, 10);

    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const reason = await readOptionalVoidReason(request);

    const invoiceIdNum = parseInt(invoiceId, 10);

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
          where: "projects/[projectId]/invoicing/owner/[invoiceId]/void#POST",
          message: "Invoice not found",
          status: 404,
          severity: "low",
        });
      }

      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/void#POST",
        message: "Failed to verify invoice",
        details: { reason: fetchError.message },
        cause: fetchError,
      });
    }

    if (invoice.status === "paid" || invoice.status === "void") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/void#POST",
        message: `Invoice cannot be voided from status "${invoice.status}"`,
        status: 400,
        severity: "low",
      });
    }

    // Append the void reason to notes (preserving any prior notes)
    const voidNote = reason
      ? `[Voided ${new Date().toISOString().split("T")[0]}] ${reason}`
      : null;
    const mergedNotes = voidNote
      ? invoice.notes
        ? `${invoice.notes}\n\n${voidNote}`
        : voidNote
      : invoice.notes;

    const { data: updatedInvoice, error: updateError } = await supabase
      .from("owner_invoices")
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
          where: "projects/[projectId]/invoicing/owner/[invoiceId]/void#POST",
          message: "Permission denied",
          status: 403,
          severity: "medium",
        });
      }

      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/void#POST",
        message: "Failed to void invoice",
        details: { reason: updateError.message },
        cause: updateError,
      });
    }

    return NextResponse.json({
      data: updatedInvoice,
      message: "Invoice voided successfully",
    });
    },
);
