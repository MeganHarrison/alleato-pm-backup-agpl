import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

type NormalizedInvoicePayment = {
  id: string;
  project_id: number;
  owner_invoice_id: number | null;
  subcontractor_invoice_id: number | null;
  payment_number: string | null;
  payment_method: string | null;
  amount: number;
  payment_date: string | null;
  check_number: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  invoice_type: "owner" | "subcontractor" | null;
  invoice_number: string | null;
};

// GET /api/projects/[projectId]/invoicing/payments
// List all payments for a project, joined with owner/subcontractor invoice info.
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/invoicing/payments#GET",
  async ({ params }) => {
    const supabase = await createClient();
    const { projectId } = params;

    const user = await getApiRouteUser();
    const authError = null as Error | null;

    if (authError) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/payments#GET",
        message: "Authentication failed.",
        details: authError.message,
      });
    }

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/payments#GET",
        message: "Authentication required.",
      });
    }

    const projectIdNum = parseInt(projectId, 10);
    if (!Number.isFinite(projectIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/payments#GET",
        message: "Invalid project id.",
      });
    }

    const [manualResult, commitmentResult, primeResult] = await Promise.all([
      supabase
        .from("invoice_payments")
        .select(
          `
          *,
          owner_invoice:owner_invoices(id, invoice_number),
          subcontractor_invoice:subcontractor_invoices(id, invoice_number)
        `,
        )
        .eq("project_id", projectIdNum),
      supabase
        .from("commitment_payments")
        .select(
          `
          id,
          project_id,
          subcontractor_invoice_id,
          payment_number,
          payment_method,
          amount,
          payment_date,
          payment_ref,
          status,
          created_at,
          updated_at,
          subcontractor_invoice:subcontractor_invoices(id, invoice_number)
        `,
        )
        .eq("project_id", projectIdNum),
      supabase
        .from("prime_contract_payments")
        .select(
          "id, project_id, payment_application_id, payment_number, method, amount, payment_date, reference_number, notes, created_at, updated_at",
        )
        .eq("project_id", projectIdNum),
    ]);

    if (manualResult.error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/payments#GET",
        message: "Failed to fetch manual invoice payments.",
        details: manualResult.error.message,
      });
    }

    if (commitmentResult.error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/payments#GET",
        message: "Failed to fetch Acumatica subcontractor payments.",
        details: commitmentResult.error.message,
      });
    }

    if (primeResult.error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/payments#GET",
        message: "Failed to fetch Acumatica owner payments.",
        details: primeResult.error.message,
      });
    }

    const primePaymentApplicationIds = [
      ...new Set(
        (primeResult.data ?? [])
          .map((payment) => payment.payment_application_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const ownerInvoiceByPaymentApplicationId = new Map<
      string,
      { id: number; invoice_number: string | null }
    >();

    if (primePaymentApplicationIds.length > 0) {
      const { data: ownerInvoices, error: ownerInvoicesError } = await supabase
        .from("owner_invoices")
        .select("id, invoice_number, payment_application_id")
        .in("payment_application_id", primePaymentApplicationIds);

      if (ownerInvoicesError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "projects/[projectId]/invoicing/payments#GET",
          message: "Failed to resolve owner invoices for Acumatica payments.",
          details: ownerInvoicesError.message,
        });
      }

      for (const invoice of ownerInvoices ?? []) {
        if (!invoice.payment_application_id) continue;
        ownerInvoiceByPaymentApplicationId.set(invoice.payment_application_id, {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
        });
      }
    }

    const manualPayments: NormalizedInvoicePayment[] = (manualResult.data ?? []).map((row) => {
      const owner = Array.isArray(row.owner_invoice)
        ? row.owner_invoice[0]
        : (row.owner_invoice as { id: number; invoice_number: string | null } | null);
      const sub = Array.isArray(row.subcontractor_invoice)
        ? row.subcontractor_invoice[0]
        : (row.subcontractor_invoice as { id: number; invoice_number: string | null } | null);

      const invoice_type: "owner" | "subcontractor" | null = row.owner_invoice_id
        ? "owner"
        : row.subcontractor_invoice_id
          ? "subcontractor"
          : null;

      const invoice_number =
        invoice_type === "owner"
          ? (owner?.invoice_number ?? null)
          : invoice_type === "subcontractor"
            ? (sub?.invoice_number ?? null)
            : null;

      return {
        id: `invoice:${row.id}`,
        project_id: row.project_id,
        owner_invoice_id: row.owner_invoice_id,
        subcontractor_invoice_id: row.subcontractor_invoice_id,
        payment_number: row.payment_number,
        payment_method: row.payment_method,
        amount: Number(row.amount) || 0,
        payment_date: row.payment_date,
        check_number: row.check_number,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        invoice_type,
        invoice_number,
      };
    });

    const commitmentPayments: NormalizedInvoicePayment[] = (commitmentResult.data ?? []).map((row) => {
      const sub = Array.isArray(row.subcontractor_invoice)
        ? row.subcontractor_invoice[0]
        : (row.subcontractor_invoice as { id: number; invoice_number: string | null } | null);

      return {
        id: `commitment:${row.id}`,
        project_id: row.project_id ?? projectIdNum,
        owner_invoice_id: null,
        subcontractor_invoice_id: row.subcontractor_invoice_id,
        payment_number: row.payment_number,
        payment_method: row.payment_method,
        amount: Number(row.amount) || 0,
        payment_date: row.payment_date,
        check_number: row.payment_ref,
        notes: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        invoice_type: row.subcontractor_invoice_id ? "subcontractor" : null,
        invoice_number: sub?.invoice_number ?? null,
      };
    });

    const primePayments: NormalizedInvoicePayment[] = (primeResult.data ?? []).map((row) => {
      const ownerInvoice = row.payment_application_id
        ? ownerInvoiceByPaymentApplicationId.get(row.payment_application_id)
        : null;

      return {
        id: `prime:${row.id}`,
        project_id: row.project_id,
        owner_invoice_id: ownerInvoice?.id ?? null,
        subcontractor_invoice_id: null,
        payment_number: row.payment_number,
        payment_method: row.method,
        amount: Number(row.amount) || 0,
        payment_date: row.payment_date,
        check_number: row.reference_number,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        invoice_type: ownerInvoice ? "owner" : null,
        invoice_number: ownerInvoice?.invoice_number ?? null,
      };
    });

    const payments = [...manualPayments, ...commitmentPayments, ...primePayments].sort((a, b) => {
      const dateA = a.payment_date ? Date.parse(a.payment_date) : 0;
      const dateB = b.payment_date ? Date.parse(b.payment_date) : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ data: payments });
  },
);

// POST /api/projects/[projectId]/invoicing/payments
// Invoice payments are read-only Acumatica inbound records.
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/invoicing/payments#POST",
  async () => {
    throw new GuardrailError({
      code: "READ_ONLY_RESOURCE",
      where: "projects/[projectId]/invoicing/payments#POST",
      message:
        "Invoice payments are synced from Acumatica and cannot be created in Alleato.",
      status: 405,
      severity: "low",
    });
  },
);
