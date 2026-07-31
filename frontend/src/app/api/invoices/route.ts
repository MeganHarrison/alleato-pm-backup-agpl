import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { z } from "zod";

const LEGACY_STATUSES = ["draft", "submitted", "approved", "paid", "void"] as const;

type LegacyInvoiceStatus = (typeof LEGACY_STATUSES)[number];

function toLegacyStatus(status: string | null): LegacyInvoiceStatus {
  const normalized = (status ?? "").trim().toLowerCase();
  if (LEGACY_STATUSES.includes(normalized as LegacyInvoiceStatus)) {
    return normalized as LegacyInvoiceStatus;
  }

  switch (normalized) {
    case "open":
      return "submitted";
    case "closed":
      return "paid";
    case "hold":
      return "draft";
    case "voided":
      return "void";
    default:
      return "draft";
  }
}

function toAcumaticaStatus(status: LegacyInvoiceStatus): string {
  switch (status) {
    case "draft":
      return "Hold";
    case "submitted":
    case "approved":
      return "Open";
    case "paid":
      return "Closed";
    case "void":
      return "Voided";
    default:
      return "Open";
  }
}

// Zod schema for invoice creation
// OWASP: Input validation on financial data endpoints (A03:2021 - Injection, A04:2021 - Insecure Design)
const createInvoiceSchema = z.object({
  invoice_number: z
    .string()
    .trim()
    .min(1, "Invoice number is required")
    .max(100, "Invoice number must be at most 100 characters"),
  project_id: z.coerce.number().int().positive().nullable().optional(),
  invoice_date: z
    .string()
    .min(1, "Invoice date is required")
    .refine(
      (val) => !Number.isNaN(Date.parse(val)),
      "Must be a valid date string",
    ),
  status: z
    .enum(LEGACY_STATUSES)
    .default("draft"),
  amount: z.coerce.number().default(0),
  tax_amount: z.coerce.number().optional().default(0),
  notes: z.string().trim().max(2000, "Notes must be at most 2000 characters").optional().nullable(),
});

export const GET = withApiGuardrails(
  "invoices#GET",
  async ({ request }) => {
  
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "invoices#GET", message: "Authentication required." });
    }
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const projectId = searchParams.get("project_id") ?? searchParams.get("projectId");

    let query = supabase
      .from("acumatica_ar_invoices")
      .select("id, reference_nbr, status, date, description, amount, balance, tax_total, project_id, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(
        `reference_nbr.ilike.%${search}%,description.ilike.%${search}%,customer.ilike.%${search}%,project.ilike.%${search}%`,
      );
    }

    if (status) {
      query = query.ilike("status", status);
    }

    if (projectId) {
      query = query.eq("project_id", parseInt(projectId));
    }

    const { data, error } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    const mapped = (data ?? []).map((row) => {
      const amount = row.amount ?? 0;
      const balance = row.balance ?? amount;
      const paidAmount = Math.max(amount - balance, 0);

      return {
        id: String(row.id),
        commitment_id: "",
        number: row.reference_nbr,
        billing_period_start: row.date,
        billing_period_end: row.date,
        status: toLegacyStatus(row.status),
        invoice_date: row.date,
        due_date: null,
        subtotal: amount,
        tax_amount: row.tax_total ?? 0,
        retention_amount: 0,
        total_amount: amount,
        paid_amount: paidAmount,
        payment_date: null,
        notes: row.description,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return NextResponse.json({ data: mapped });
    },
);

export const POST = withApiGuardrails(
  "invoices#POST",
  async ({ request }) => {
  
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "invoices#POST", message: "Authentication required." });
    }
    const body = await request.json();

    // Validate request body with Zod schema
    const validation = createInvoiceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const validated = validation.data;

    const { data, error } = await supabase
      .from("acumatica_ar_invoices")
      .insert({
        // external_key is required by the table — for locally-created invoices
        // (not synced from Acumatica yet) we namespace with a local: prefix so
        // a future Acumatica import can update the row via its real external key.
        external_key: `local:${validated.invoice_number}:${Date.now()}`,
        reference_nbr: validated.invoice_number,
        type: "Invoice",
        status: toAcumaticaStatus(validated.status),
        date: validated.invoice_date,
        project_id: validated.project_id ?? null,
        amount: validated.amount,
        balance: validated.status === "paid" ? 0 : validated.amount,
        tax_total: validated.tax_amount ?? 0,
        hold: validated.status === "draft",
        description: validated.notes,
      })
      .select("id, reference_nbr, status, date, description, amount, balance, tax_total, project_id, created_at, updated_at")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    const amount = data.amount ?? 0;
    const balance = data.balance ?? amount;
    const mapped = {
      id: String(data.id),
      commitment_id: "",
      number: data.reference_nbr,
      billing_period_start: data.date,
      billing_period_end: data.date,
      status: toLegacyStatus(data.status),
      invoice_date: data.date,
      due_date: null,
      subtotal: amount,
      tax_amount: data.tax_total ?? 0,
      retention_amount: 0,
      total_amount: amount,
      paid_amount: Math.max(amount - balance, 0),
      payment_date: null,
      notes: data.description,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    return NextResponse.json({ data: mapped }, { status: 201 });
    },
);
