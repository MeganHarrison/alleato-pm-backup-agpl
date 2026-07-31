import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  buildOwnerInvoiceLineItemSovFields,
  normalizeOwnerInvoiceLineItems,
} from "@/lib/invoicing/owner-invoice-line-items";

// Helper to verify invoice belongs to project and return editable status
async function verifyInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceIdNum: number,
  projectIdNum: number,
) {
  const { data, error } = await supabase
    .from("owner_invoices")
    .select(`id, status, prime_contracts!inner(project_id)`)
    .eq("id", invoiceIdNum)
    .eq("prime_contracts.project_id", projectIdNum)
    .single();

  if (error) {
    if (error.code === "PGRST116") return { invoice: null, notFound: true, error: null };
    return { invoice: null, notFound: false, error };
  }
  return { invoice: data, notFound: false, error: null };
}

// GET /api/projects/[projectId]/invoicing/owner/[invoiceId]/line-items
// Return all line items for an invoice
export const GET = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#GET",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId, invoiceId } = params;

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#GET", message: "Authentication required." });
    }

    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    const { invoice, notFound, error } = await verifyInvoice(supabase, invoiceIdNum, projectIdNum);
    if (notFound) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#GET",
        message: "Invoice not found.",
      });
    }
    if (error || !invoice) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#GET",
        message: "Failed to verify invoice.",
        details: error?.message ?? undefined,
      });
    }

    const { data: lineItems, error: lineItemsError } = await supabase
      .from("owner_invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceIdNum)
      .order("sort_order", { ascending: true });

    if (lineItemsError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#GET",
        message: "Failed to fetch line items.",
        details: lineItemsError.message,
      });
    }

    return NextResponse.json({ data: normalizeOwnerInvoiceLineItems(lineItems) });
    },
);

// POST /api/projects/[projectId]/invoicing/owner/[invoiceId]/line-items
// Add a new line item to an invoice
export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#POST",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId, invoiceId } = params;

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#POST", message: "Authentication required." });
    }

    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    const { invoice, notFound, error: verifyError } = await verifyInvoice(supabase, invoiceIdNum, projectIdNum);
    if (notFound) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#POST",
        message: "Invoice not found.",
      });
    }
    if (verifyError || !invoice) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#POST",
        message: "Failed to verify invoice.",
        details: verifyError?.message ?? undefined,
      });
    }

    const editableStatuses = ["draft", "revise_and_resubmit"];
    if (!editableStatuses.includes(invoice.status ?? "")) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#POST",
        message: `Invoice status '${invoice.status}' does not allow editing.`,
      });
    }

    const body = await request.json();
    const {
      description,
      category,
      approved_amount = 0,
      sort_order = 0,
    } = body;
    const sovFields = buildOwnerInvoiceLineItemSovFields(approved_amount);

    const { data: lineItem, error: insertError } = await supabase
      .from("owner_invoice_line_items")
      .insert({
        invoice_id: invoiceIdNum,
        description: description ?? null,
        category: category ?? null,
        approved_amount,
        scheduled_value: body.scheduled_value ?? sovFields.scheduled_value,
        work_completed_previous: body.work_completed_previous ?? sovFields.work_completed_previous,
        work_completed_period: body.work_completed_period ?? sovFields.work_completed_period,
        materials_stored: body.materials_stored ?? sovFields.materials_stored,
        total_completed_stored: body.total_completed_stored ?? sovFields.total_completed_stored,
        work_completed_pct: body.work_completed_pct ?? sovFields.work_completed_pct,
        retainage_pct: body.retainage_pct ?? 0,
        retainage_amount: body.retainage_amount ?? sovFields.retainage_amount,
        retainage_released: body.retainage_released ?? sovFields.retainage_released,
        net_amount_this_period: body.net_amount_this_period ?? sovFields.net_amount_this_period,
        balance_to_finish: body.balance_to_finish ?? sovFields.balance_to_finish,
        sort_order,
      })
      .select()
      .single();

    if (insertError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#POST",
        message: "Failed to create line item.",
        details: insertError.message,
      });
    }

    return NextResponse.json({ data: lineItem }, { status: 201 });
    },
);

// PATCH /api/projects/[projectId]/invoicing/owner/[invoiceId]/line-items
// Bulk update editable fields on line items
// Body: Array of { id, work_completed_period?, materials_stored?, retainage_pct?, retainage_released? }
export const PATCH = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#PATCH",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId, invoiceId } = params;

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#PATCH", message: "Authentication required." });
    }

    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    const { invoice, notFound, error: verifyError } = await verifyInvoice(supabase, invoiceIdNum, projectIdNum);
    if (notFound) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#PATCH",
        message: "Invoice not found.",
      });
    }
    if (verifyError || !invoice) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#PATCH",
        message: "Failed to verify invoice.",
        details: verifyError?.message ?? undefined,
      });
    }

    const editableStatuses = ["draft", "revise_and_resubmit"];
    if (!editableStatuses.includes(invoice.status ?? "")) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#PATCH",
        message: `Invoice status '${invoice.status}' does not allow editing.`,
      });
    }

    const body = await request.json();
    const updates = Array.isArray(body) ? body : body?.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#PATCH",
        message:
          "Request body must include a non-empty 'updates' array of line item updates.",
      });
    }

    const ALLOWED_UPDATE_FIELDS = [
      "work_completed_period",
      "materials_stored",
      "retainage_pct",
      "retainage_amount",
      "retainage_released",
    ] as const;

    type AllowedField = (typeof ALLOWED_UPDATE_FIELDS)[number];

    // Perform each update — use individual upserts scoped to the invoice
    const results: unknown[] = [];
    for (const item of updates) {
      const { id, ...rest } = item as { id: number } & Partial<Record<AllowedField, number>>;
      if (typeof id !== "number") continue;

      const updatePayload: Partial<Record<AllowedField, number>> = {};
      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (field in rest && typeof rest[field] === "number") {
          updatePayload[field] = rest[field];
        }
      }
      if (Object.keys(updatePayload).length === 0) continue;

      const { data: updated, error: updateError } = await supabase
        .from("owner_invoice_line_items")
        .update(updatePayload)
        .eq("id", id)
        .eq("invoice_id", invoiceIdNum)
        .select()
        .single();

      if (updateError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "projects/[projectId]/invoicing/owner/[invoiceId]/line-items#PATCH",
          message: `Failed to update line item ${id}.`,
          details: updateError.message,
        });
      }

      results.push(updated);
    }

    return NextResponse.json({ data: results });
    },
);
