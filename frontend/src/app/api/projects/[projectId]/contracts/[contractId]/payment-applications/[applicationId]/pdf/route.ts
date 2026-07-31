import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { renderPaymentApplicationPdfBuffer, type PaymentApplicationPdfData } from "@/lib/prime-contracts/payment-application-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PdfFetchResult =
  | { data: PaymentApplicationPdfData; error: null }
  | { data: null; error: null | { code?: string; message: string } };

function parseApplicationSequence(applicationNumber: string): number | null {
  const parsed = Number.parseInt(applicationNumber, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function isBeforeCurrentApplication(
  candidate: { application_number: string; billing_date: string | null; created_at: string },
  current: { application_number: string; billing_date: string | null; created_at: string },
): boolean {
  const candidateSequence = parseApplicationSequence(candidate.application_number);
  const currentSequence = parseApplicationSequence(current.application_number);

  if (candidateSequence !== null && currentSequence !== null) {
    return candidateSequence < currentSequence;
  }

  const candidateBillingTime = candidate.billing_date
    ? new Date(candidate.billing_date).getTime()
    : 0;
  const currentBillingTime = current.billing_date
    ? new Date(current.billing_date).getTime()
    : 0;

  if (candidateBillingTime !== currentBillingTime) {
    return candidateBillingTime < currentBillingTime;
  }

  return new Date(candidate.created_at).getTime() < new Date(current.created_at).getTime();
}

async function fetchPaymentApplicationPdfData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: number,
  contractId: string,
  applicationId: string,
): Promise<PdfFetchResult> {
  const { data: application, error: applicationError } = await supabase
    .from("prime_contract_payment_applications")
    .select(
      `
      id,
      application_number,
      status,
      billing_date,
      period_from,
      period_to,
      notes,
      created_at,
      contract_id,
      project_id,
      prime_contracts!inner(
        id,
        project_id,
        contract_number,
        title,
        start_date,
        original_contract_value,
        revised_contract_value
      )
    `,
    )
    .eq("id", applicationId)
    .eq("contract_id", contractId)
    .eq("project_id", projectId)
    .eq("prime_contracts.project_id", projectId)
    .single();

  if (applicationError) {
    return {
      data: null,
      error: { code: applicationError.code, message: applicationError.message },
    };
  }

  if (!application) {
    return { data: null, error: null };
  }

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("payment_application_line_items")
    .select(
      `
      scheduled_value,
      total_completed,
      retainage_this_period_work,
      retainage_previous_work,
      retainage_released_work,
      retainage_this_period_materials,
      retainage_previous_materials,
      retainage_released_materials
    `,
    )
    .eq("payment_application_id", applicationId)
    .order("sort_order", { ascending: true });

  if (lineItemsError) {
    return {
      data: null,
      error: { code: lineItemsError.code, message: lineItemsError.message },
    };
  }

  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select("id, name, project_number, address, state")
    .eq("id", projectId)
    .single();

  if (projectError) {
    return {
      data: null,
      error: { code: projectError.code, message: projectError.message },
    };
  }

  const { data: applications, error: applicationsError } = await supabase
    .from("prime_contract_payment_applications")
    .select("id, application_number, billing_date, created_at, status, net_amount, amount, retention_amount")
    .eq("contract_id", contractId)
    .eq("project_id", projectId);

  if (applicationsError) {
    return {
      data: null,
      error: { code: applicationsError.code, message: applicationsError.message },
    };
  }

  const previousPaymentDue = (applications ?? [])
    .filter(
      (candidate) =>
        candidate.id !== applicationId &&
        candidate.status === "approved" &&
        isBeforeCurrentApplication(candidate, application),
    )
    .reduce(
      (sum, candidate) =>
        sum + (candidate.net_amount ?? candidate.amount - candidate.retention_amount),
      0,
    );

  const contractJoin = Array.isArray(application.prime_contracts)
    ? application.prime_contracts[0]
    : application.prime_contracts;

  return {
    data: {
      id: application.id,
      applicationNumber: application.application_number,
      status: application.status ?? "draft",
      billingDate: application.billing_date,
      periodFrom: application.period_from,
      periodTo: application.period_to,
      notes: application.notes ?? null,
      previousPaymentDue,
      lineItems: (lineItems ?? []).map((lineItem) => ({
        scheduled_value: lineItem.scheduled_value ?? 0,
        total_completed: lineItem.total_completed ?? 0,
        retainage_this_period_work: lineItem.retainage_this_period_work ?? 0,
        retainage_previous_work: lineItem.retainage_previous_work ?? 0,
        retainage_released_work: lineItem.retainage_released_work ?? 0,
        retainage_this_period_materials: lineItem.retainage_this_period_materials ?? 0,
        retainage_previous_materials: lineItem.retainage_previous_materials ?? 0,
        retainage_released_materials: lineItem.retainage_released_materials ?? 0,
      })),
      project: projectRow
        ? {
            name: projectRow.name ?? null,
            number: projectRow.project_number ?? null,
            address: projectRow.address ?? null,
            state: projectRow.state ?? null,
          }
        : null,
      contract: {
        title: contractJoin?.title ?? "Prime Contract",
        contractNumber: contractJoin?.contract_number ?? null,
        startDate: contractJoin?.start_date ?? null,
        originalContractValue: contractJoin?.original_contract_value ?? 0,
        revisedContractValue: contractJoin?.revised_contract_value ?? 0,
      },
    },
    error: null,
  };
}

export const GET = withApiGuardrails<{
  projectId: string;
  contractId: string;
  applicationId: string;
}>(
  "projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]/pdf#GET",
  async ({ params }) => {
    const where =
      "projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]/pdf#GET";
    const supabase = await createClient();
    const { projectId, contractId, applicationId } = params;
    const projectIdNum = Number.parseInt(projectId, 10);

    const result = await fetchPaymentApplicationPdfData(
      supabase,
      projectIdNum,
      contractId,
      applicationId,
    );

    if (result.error) {
      if (result.error.code === "PGRST116") {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: "Payment application not found.",
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
        message: "Payment application not found.",
        status: 404,
        severity: "low",
      });
    }

    const pdfBuffer = await renderPaymentApplicationPdfBuffer(result.data);
    const filename = `invoice-${result.data.applicationNumber || result.data.id}.pdf`;

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
