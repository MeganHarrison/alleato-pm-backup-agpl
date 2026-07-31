import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

// GET → list related items for this invoice
// POST → link a related item  { related_type, related_id, description? }
// DELETE ?id=123 → unlink
export const GET = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/related-items#GET",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { invoiceId } = params;
    const invoiceIdNum = parseInt(invoiceId, 10);

    const { data, error } = await supabase
      .from("subcontractor_invoice_related_items")
      .select("*")
      .eq("invoice_id", invoiceIdNum)
      .order("linked_at", { ascending: false });

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/related-items#GET",
        message: "Failed to fetch related items.",
        details: error.message,
      });
    }

    return NextResponse.json({ data: data ?? [] });
    },
);

export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/related-items#POST",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { invoiceId } = params;
    const invoiceIdNum = parseInt(invoiceId, 10);

    const user = await getApiRouteUser();
    if (!user) throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/related-items#POST", message: "Authentication required." });

    const body = await request.json().catch(() => ({}));
    const { related_type, related_id, description } = body ?? {};
    if (!related_type || !related_id) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/related-items#POST",
        message: "related_type and related_id required.",
      });
    }

    const { data, error } = await supabase
      .from("subcontractor_invoice_related_items")
      .insert({
        invoice_id: invoiceIdNum,
        related_type,
        related_id: String(related_id),
        description: description ?? null,
        linked_by_user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/related-items#POST",
        message: "Failed to link item.",
        details: error.message,
      });
    }

    return NextResponse.json({ data });
    },
);

export const DELETE = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/related-items#DELETE",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { invoiceId } = params;
    const invoiceIdNum = parseInt(invoiceId, 10);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/related-items#DELETE",
        message: "id query param required.",
      });
    }

    const { error } = await supabase
      .from("subcontractor_invoice_related_items")
      .delete()
      .eq("id", Number(id))
      .eq("invoice_id", invoiceIdNum);

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/related-items#DELETE",
        message: "Failed to unlink item.",
        details: error.message,
      });
    }

    return NextResponse.json({ message: "Unlinked" });
    },
);
