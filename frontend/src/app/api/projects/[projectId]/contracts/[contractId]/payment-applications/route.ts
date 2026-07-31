import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ZodError } from "zod";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string; contractId: string }>;
}

const createPaymentApplicationSchema = z.object({
  application_number: z.string().min(1, "Application number is required"),
  amount: z.number().min(0, "Amount must be non-negative"),
  retention_amount: z.number().min(0).default(0),
  percent_complete: z.number().min(0).max(100).default(0),
  status: z
    .enum(["draft", "under_review", "revise_and_resubmit", "approved"])
    .default("draft"),
  period_from: z.string().nullable().optional(),
  period_to: z.string().nullable().optional(),
  billing_period_id: z.string().uuid().nullable().optional(),
  billing_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * GET /api/projects/[projectId]/contracts/[contractId]/payment-applications
 * Returns all payment applications for a prime contract
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/payment-applications#GET",
  async ({ request, params }) => {
  
    const { projectId, contractId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("prime_contract_payment_applications")
      .select("*, billing_period:billing_periods(*)")
      .eq("contract_id", contractId)
      .eq("project_id", parseInt(projectId, 10))
      .order("application_number", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch payment applications", details: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(data ?? []);
    },
);

/**
 * POST /api/projects/[projectId]/contracts/[contractId]/payment-applications
 * Creates a new payment application for a prime contract
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/payment-applications#POST",
  async ({ request, params }) => {
  
    const { projectId, contractId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json();

    const validatedData = createPaymentApplicationSchema.parse(body);

    // Verify contract exists for this project, and enforce approved-status gate
    const { data: contract } = await supabase
      .from("prime_contracts")
      .select("id, status")
      .eq("id", contractId)
      .eq("project_id", parseInt(projectId, 10))
      .single();

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Business rule: only approved contracts may have invoices/payment applications created
    if (contract.status !== "approved") {
      return NextResponse.json(
        {
          error: "Cannot create a payment application",
          details: `Contract must be in 'Approved' status before invoices can be created. Current status: ${contract.status ?? "unknown"}.`,
        },
        { status: 422 },
      );
    }

    // Check for duplicate application number
    const { data: existing } = await supabase
      .from("prime_contract_payment_applications")
      .select("id")
      .eq("contract_id", contractId)
      .eq("application_number", validatedData.application_number)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Application number already exists for this contract" },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("prime_contract_payment_applications")
      .insert({
        contract_id: contractId,
        project_id: parseInt(projectId, 10),
        application_number: validatedData.application_number,
        amount: validatedData.amount,
        retention_amount: validatedData.retention_amount,
        percent_complete: validatedData.percent_complete,
        status: validatedData.status,
        period_from: validatedData.period_from ?? null,
        period_to: validatedData.period_to ?? null,
        billing_period_id: validatedData.billing_period_id ?? null,
        billing_date: validatedData.billing_date ?? null,
        notes: validatedData.notes ?? null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create payment application", details: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(data, { status: 201 });
    },
);
