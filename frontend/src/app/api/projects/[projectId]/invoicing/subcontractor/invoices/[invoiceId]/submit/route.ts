import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { sendEmail } from "@/lib/email/send";
import InvoiceSubmittedToPM from "@/emails/subcontractor/InvoiceSubmittedToPM";
import { APP_BASE_URL } from "@/lib/email/client";

interface NotificationResult {
  sent: string[];
  failed: Array<{ email: string; reason: string }>;
}

// POST /api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit
// Transition invoice to under_review. Pre-condition: must be draft or revise_and_resubmit.
export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit#POST",
  async ({ request, params }) => {

    const supabase = await createClient();
    const { projectId, invoiceId } = params;

    const user = await getApiRouteUser();
    const authError = null as Error | null;

    if (authError) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit#POST",
        message: "Authentication failed",
        status: 401,
        severity: "medium",
        details: { reason: authError.message },
        cause: authError,
      });
    }

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit#POST", message: "Authentication required." });
    }

    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    const { data: invoice, error: fetchError } = await supabase
      .from("subcontractor_invoices")
      .select("id, status")
      .eq("id", invoiceIdNum)
      .eq("project_id", projectIdNum)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        throw new GuardrailError({
          code: "ROUTE_BINDING_MISSING",
          where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit#POST",
          message: "Invoice not found",
          status: 404,
          severity: "low",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit#POST",
        message: "Failed to verify invoice",
        details: { reason: fetchError.message },
        cause: fetchError,
      });
    }

    const submittableStatuses = [
      "draft",
      "invited",
      "revise_and_resubmit",
    ] as const;
    if (!(submittableStatuses as readonly string[]).includes(invoice.status)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit#POST",
        message: "Invoice must be in Draft, Invited, or Revise & Resubmit status to submit",
        status: 400,
        severity: "low",
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from("subcontractor_invoices")
      .update({
        status: "under_review",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", invoiceIdNum)
      .eq("project_id", projectIdNum)
      .in("status", submittableStatuses)
      .is("acumatica_ref_nbr", null)
      .is("acumatica_doc_type", null)
      .is("acumatica_sync_at", null)
      .is("acumatica_ap_bill_id", null)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "PGRST116") {
        throw new GuardrailError({
          code: "INVALID_PAYLOAD",
          where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit#POST",
          message:
            "The invoice status or accounting link changed. Refresh and try again.",
          status: 409,
          severity: "low",
        });
      }
      if (updateError.code === "42501") {
        throw new GuardrailError({
          code: "AUTH_FORBIDDEN",
          where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit#POST",
          message: "Permission denied",
          status: 403,
          severity: "medium",
        });
      }
      if (
        updateError.code === "23514" &&
        updateError.message.toLowerCase().includes("schedule")
      ) {
        throw new GuardrailError({
          code: "PRECONDITION_FAILED",
          where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit#POST",
          message:
            "This invoice is out of sync with the commitment SOV or approved change orders. Return it to Draft and refresh the SOV before submitting.",
          status: 409,
          severity: "medium",
          details: { reason: updateError.message },
          cause: updateError,
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit#POST",
        message: "Failed to submit invoice",
        details: { reason: updateError.message },
        cause: updateError,
      });
    }

    const notificationResult = await notifyProjectManagersOfInvoiceSubmission({
      projectId: projectIdNum,
      invoiceId: invoiceIdNum,
    });

    if (notificationResult.failed.length > 0) {
      return NextResponse.json(
        {
          error: "Invoice submitted, but PM notification failed",
          notification: notificationResult,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      data: updated,
      notification: notificationResult,
      message: "Invoice submitted successfully",
    });
    },
);

async function notifyProjectManagersOfInvoiceSubmission(args: {
  projectId: number;
  invoiceId: number;
}): Promise<NotificationResult> {
  const { projectId, invoiceId } = args;
  const supabase = createServiceClient();

  // Load invoice details with project, subcontract, and line-item totals
  const { data: invoice } = await serviceDb.from("subcontractor_invoices")
    .select(
      "id, invoice_number, period_start, period_end, project_id, subcontract_id",
    )
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) {
    return {
      sent: [],
      failed: [{ email: "project-managers", reason: "Invoice not found for PM notification" }],
    };
  }

  const projectPromise = serviceDb.from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();

  const subcontractPromise: Promise<{
    data: { title: string | null; contract_company_id: string | null } | null;
  }> = invoice.subcontract_id
    ? (serviceDb.from("subcontracts")
        .select("title, contract_company_id")
        .eq("id", invoice.subcontract_id)
        .maybeSingle() as unknown as Promise<{
        data: { title: string | null; contract_company_id: string | null } | null;
      }>)
    : Promise.resolve({ data: null });

  const lineItemsPromise: Promise<{
    data: Array<{
      work_completed_period: number | null;
      materials_stored: number | null;
      retainage_amount: number | null;
      materials_retainage_amount: number | null;
      work_retainage_released: number | null;
      materials_retainage_released: number | null;
    }> | null;
  }> = serviceDb.from("subcontractor_invoice_line_items")
    .select("work_completed_period, materials_stored, retainage_amount, materials_retainage_amount, work_retainage_released, materials_retainage_released")
    .eq("invoice_id", invoiceId) as unknown as Promise<{
    data: Array<{
      work_completed_period: number | null;
      materials_stored: number | null;
      retainage_amount: number | null;
      materials_retainage_amount: number | null;
      work_retainage_released: number | null;
      materials_retainage_released: number | null;
    }> | null;
  }>;

  const [{ data: project }, { data: subcontract }, { data: lineItems }] =
    await Promise.all([projectPromise, subcontractPromise, lineItemsPromise]);

  // Compute total amount from line items
  const total: number = (lineItems || []).reduce((sum, row) => {
    const work = Number(row.work_completed_period ?? 0);
    const mat = Number(row.materials_stored ?? 0);
    const ret =
      Number(row.retainage_amount ?? 0) +
      Number(row.materials_retainage_amount ?? 0);
    const released =
      Number(row.work_retainage_released ?? 0) +
      Number(row.materials_retainage_released ?? 0);
    return sum + work + mat - ret + released;
  }, 0);
  const amountFormatted = total.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  // Subcontractor display name
  let subcontractorName = subcontract?.title || "A subcontractor";
  if (subcontract?.contract_company_id) {
    const { data: vendor } = await serviceDb.from("companies")
      .select("name")
      .eq("id", subcontract.contract_company_id)
      .maybeSingle();
    if (vendor?.name) subcontractorName = vendor.name;
  }

  const billingPeriod =
    invoice.period_start && invoice.period_end
      ? `${new Date(invoice.period_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(invoice.period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : "—";

  // Find PMs on the project
  const { data: pmMembers } = await serviceDb.from("project_directory_memberships")
    .select("person_id, role")
    .eq("project_id", projectId)
    .eq("status", "active");

  const pmPersonIds = (pmMembers || [])
    .filter((m: { role: string | null }) => {
      const r = (m.role || "").toLowerCase();
      return r.includes("project manager") || r === "pm";
    })
    .map((m: { person_id: string }) => m.person_id);

  if (pmPersonIds.length === 0) {
    return {
      sent: [],
      failed: [{ email: "project-managers", reason: "No active project manager recipients found" }],
    };
  }

  const { data: people } = await serviceDb.from("people")
    .select("id, first_name, last_name, email")
    .in("id", pmPersonIds);

  const recipients: Array<{ name: string; email: string }> = (people || [])
    .filter((p: { email: string | null }) => !!p.email)
    .map((p: { first_name: string | null; last_name: string | null; email: string | null }) => ({
      name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Project manager",
      email: p.email as string,
    }));

  if (recipients.length === 0) {
    return {
      sent: [],
      failed: [{ email: "project-managers", reason: "Project manager recipients have no email addresses" }],
    };
  }

  const reviewUrl = `${APP_BASE_URL}/${projectId}/invoicing/subcontractor/${invoiceId}`;
  const invoiceNumber = invoice.invoice_number || `#${invoice.id}`;
  const subject = `Invoice ${invoiceNumber} from ${subcontractorName} — review needed`;

  const results = await Promise.all(
    recipients.map(async (r) => {
      const result = await sendEmail({
        template: "invoice-submitted-to-pm",
        to: r.email,
        subject,
        react: InvoiceSubmittedToPM({
          pmName: r.name,
          subcontractorName,
          projectName: project?.name || `Project #${projectId}`,
          invoiceNumber,
          invoiceAmount: amountFormatted,
          billingPeriod,
          reviewUrl,
        }),
        entity: { type: "subcontractor_invoice", id: invoiceId },
        idempotencyKey: `invoice-submitted/${invoiceId}/${r.email}`,
        metadata: {
          project_id: projectId,
          invoice_id: invoiceId,
          invoice_number: invoiceNumber,
          subcontractor_name: subcontractorName,
          recipient_email: r.email,
        },
      });

      return {
        email: r.email,
        result,
      };
    }),
  );

  return {
    sent: results
      .filter(({ result }) => !result.error)
      .map(({ email }) => email),
    failed: results
      .filter(({ result }) => result.error)
      .map(({ email, result }) => ({
        email,
        reason: result.error?.message ?? "Unknown email send failure",
      })),
  };
}
