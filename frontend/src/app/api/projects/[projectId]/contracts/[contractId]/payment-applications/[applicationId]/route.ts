import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ZodError } from "zod";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{
    projectId: string;
    contractId: string;
    applicationId: string;
  }>;
}

const editableStatuses = new Set(["draft", "revise_and_resubmit"]);

function parseApplicationSequence(applicationNumber: string): number | null {
  const parsed = Number.parseInt(applicationNumber, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function compareApplications(
  a: { application_number: string; billing_date: string | null; created_at: string },
  b: { application_number: string; billing_date: string | null; created_at: string },
): number {
  const seqA = parseApplicationSequence(a.application_number);
  const seqB = parseApplicationSequence(b.application_number);

  if (seqA !== null && seqB !== null && seqA !== seqB) {
    return seqA - seqB;
  }

  const billingDateA = a.billing_date ? new Date(a.billing_date).getTime() : 0;
  const billingDateB = b.billing_date ? new Date(b.billing_date).getTime() : 0;
  if (billingDateA !== billingDateB) {
    return billingDateA - billingDateB;
  }

  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

async function getRetainageCapabilities(
  supabase: Awaited<ReturnType<typeof createClient>>,
  application: {
    id: string;
    contract_id: string;
    project_id: number;
    billing_period_id: string | null;
    status: string;
    application_number: string;
    billing_date: string | null;
    created_at: string;
  },
) {
  let query = supabase
    .from("prime_contract_payment_applications")
    .select("id, application_number, billing_date, created_at")
    .eq("contract_id", application.contract_id)
    .eq("project_id", application.project_id);

  if (application.billing_period_id) {
    query = query.eq("billing_period_id", application.billing_period_id);
  }

  const { data: scopedApplications, error } = await query;
  if (error) {
    throw error;
  }

  const latestApplicationId = (scopedApplications ?? [])
    .sort(compareApplications)
    .at(-1)?.id;
  const isLatest = latestApplicationId === application.id;
  const isEditableStatus = editableStatuses.has(application.status);

  let blockReason: string | null = null;
  if (!isEditableStatus) {
    blockReason =
      "Retainage can only be edited on draft or revise-and-resubmit invoices.";
  } else if (!isLatest) {
    blockReason =
      "Retainage can only be edited on the most recent invoice in this billing period.";
  }

  return {
    can_edit_retainage: isEditableStatus && isLatest,
    can_release_retainage: isEditableStatus && isLatest,
    retainage_edit_block_reason: blockReason,
  };
}

/**
 * GET /api/projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]
 * Fetch a single payment application with billing period data
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]#GET",
  async ({ request, params }) => {
  
    const { projectId, contractId, applicationId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("prime_contract_payment_applications")
      .select("*, billing_period:billing_periods(*)")
      .eq("id", applicationId)
      .eq("contract_id", contractId)
      .eq("project_id", parseInt(projectId, 10))
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Payment application not found" },
        { status: 404 },
      );
    }

    const retainageCapabilities = await getRetainageCapabilities(supabase, data);

    return NextResponse.json({
      ...data,
      ...retainageCapabilities,
    });
    },
);

const updatePaymentApplicationSchema = z.object({
  application_number: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  retention_amount: z.number().min(0).optional(),
  status: z
    .enum(["draft", "under_review", "revise_and_resubmit", "approved"])
    .optional(),
  billing_period_id: z.string().uuid().nullable().optional(),
  billing_date: z.string().nullable().optional(),
  period_from: z.string().nullable().optional(),
  period_to: z.string().nullable().optional(),
  submitted_at: z.string().nullable().optional(),
  submitted_by: z.string().nullable().optional(),
  approved_at: z.string().nullable().optional(),
  approved_by: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * PATCH /api/projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]
 * Updates a payment application
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]#PATCH",
  async ({ request, params }) => {
  
    const { projectId, contractId, applicationId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json();

    const validatedData = updatePaymentApplicationSchema.parse(body);

    const { data: existing } = await supabase
      .from("prime_contract_payment_applications")
      .select("id")
      .eq("id", applicationId)
      .eq("contract_id", contractId)
      .eq("project_id", parseInt(projectId, 10))
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Payment application not found" },
        { status: 404 },
      );
    }

    const { data, error } = await supabase
      .from("prime_contract_payment_applications")
      .update(validatedData)
      .eq("id", applicationId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update payment application", details: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(data);
    },
);

/**
 * DELETE /api/projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]
 * Deletes a payment application
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, contractId, applicationId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("prime_contract_payment_applications")
      .select("id")
      .eq("id", applicationId)
      .eq("contract_id", contractId)
      .eq("project_id", parseInt(projectId, 10))
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Payment application not found" },
        { status: 404 },
      );
    }

    const { error } = await supabase
      .from("prime_contract_payment_applications")
      .delete()
      .eq("id", applicationId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete payment application", details: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: "Payment application deleted" });
    },
);
