import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  renderInvoicePdfBuffer,
  type InvoicePdfData,
  type InvoicePdfLineItem,
} from "@/lib/invoice-pdf";
import { normalizeOwnerInvoiceLineItems } from "@/lib/invoicing/owner-invoice-line-items";

// Node runtime required by @react-pdf/renderer
export const runtime = "nodejs";

type InvoicePdfFetchResult =
  | { data: InvoicePdfData; error: null }
  | { data: null; error: null | { code?: string; message: string } };

// Fetch the invoice PDF payload and preserve query errors so the route can fail accurately.
export async function fetchInvoicePdfData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectIdNum: number,
  invoiceIdNum: number,
): Promise<InvoicePdfFetchResult> {
  const { data: invoice, error } = await supabase
    .from("owner_invoices")
    .select(
      `
      *,
      owner_invoice_line_items(*),
      prime_contracts!inner(
        project_id,
        retention_percentage,
        contract_number,
        title,
        contract_company_id
      )
    `,
    )
    .eq("id", invoiceIdNum)
    .eq("prime_contracts.project_id", projectIdNum)
    .single();

  if (error) {
    return { data: null, error: { code: error.code, message: error.message } };
  }

  if (!invoice) {
    return { data: null, error: null };
  }

  const { data: projectRow } = await supabase
    .from("projects")
    .select("id, name, project_number, address, state")
    .eq("id", projectIdNum)
    .single();

  const project = projectRow
    ? {
        id: projectRow.id,
        name: projectRow.name,
        number: projectRow.project_number ?? null,
        address: projectRow.address ?? null,
        city: null,
        state: projectRow.state ?? null,
      }
    : null;

  // Resolve contract company name if possible
  const contractJoin = Array.isArray(invoice.prime_contracts)
    ? invoice.prime_contracts[0]
    : invoice.prime_contracts;

  let companyName: string | null = null;
  if (contractJoin?.contract_company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", contractJoin.contract_company_id)
      .single();
    companyName = company?.name ?? null;
  }

  const lineItems: InvoicePdfLineItem[] = normalizeOwnerInvoiceLineItems(
    invoice.owner_invoice_line_items,
  ).map(
    (li: {
      id: number;
      description: string | null;
      scheduled_value: number | null;
      work_completed_previous: number | null;
      work_completed_period: number | null;
      materials_stored: number | null;
      retainage_pct: number | null;
      retainage_amount: number | null;
      sort_order?: number | null;
    }) => ({
      id: li.id,
      description: li.description,
      scheduled_value: li.scheduled_value ?? 0,
      work_completed_previous: li.work_completed_previous ?? 0,
      work_completed_period: li.work_completed_period ?? 0,
      materials_stored: li.materials_stored ?? 0,
      retainage_pct: li.retainage_pct ?? 0,
      retainage_amount: li.retainage_amount ?? 0,
    }),
  );

  // Sort by sort_order if present
  lineItems.sort((a, b) => a.id - b.id);

  return {
    data: {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      status: invoice.status ?? "draft",
      billing_date: invoice.billing_date,
      period_start: invoice.period_start,
      period_end: invoice.period_end,
      notes: invoice.notes ?? null,
      lineItems,
      project: project ?? null,
      contract: {
        contract_number: contractJoin?.contract_number ?? null,
        contract_title: contractJoin?.title ?? null,
        company_name: companyName,
        retention_percentage: contractJoin?.retention_percentage ?? null,
      },
    },
    error: null,
  };
}

export const GET = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/owner/[invoiceId]/pdf#GET",
  async ({ request, params }) => {
    const where = "projects/[projectId]/invoicing/owner/[invoiceId]/pdf#GET";
    const supabase = await createClient();
    const { projectId, invoiceId } = params;

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Authentication required." });
    }

    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    const result = await fetchInvoicePdfData(supabase, projectIdNum, invoiceIdNum);
    if (result.error) {
      if (result.error.code === "PGRST116") {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: "Invoice not found.",
          status: 404,
          severity: "low",
        });
      }
      return apiErrorResponse(result.error);
    }

    if (!result.data) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: "Invoice not found.",
        status: 404,
        severity: "low",
      });
    }

    const data = result.data;
    const pdfBuffer = await renderInvoicePdfBuffer(data);
    const filename = `invoice-${data.invoice_number || data.id}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
    },
);
