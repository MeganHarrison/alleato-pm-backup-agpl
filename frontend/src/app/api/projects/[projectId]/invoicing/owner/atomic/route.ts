import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import type { Json } from "@/types/database.types";
import { z } from "zod";

/**
 * POST /api/projects/[projectId]/invoicing/owner/atomic
 *
 * Creates an owner invoice — payment application + invoice header + all line
 * items — in a SINGLE database transaction via the create_owner_invoice_atomic
 * RPC. Either every row is written or none are; a failure on any step leaves no
 * orphaned payment application or header invoice behind. This replaces the old
 * three-call sequence in the New Invoice page, which could leave partial data.
 */

// Map the PL/pgSQL SQLSTATE raised by the RPC to an HTTP status.
function statusForPgCode(code: string | undefined): number {
  switch (code) {
    case "23505": // unique_violation -> duplicate application number
      return 409;
    case "23514": // check_violation -> contract not approved
      return 422;
    case "02000": // no_data_found -> contract not found for project
    case "P0002": // no_data_found (NO_DATA_FOUND)
      return 404;
    case "22P02": // invalid_text_representation -> bad numeric / uuid / date
    case "22007":
    case "22008":
      return 400;
    default:
      return 400;
  }
}

interface AtomicInvoicePayload {
  prime_contract_id?: string;
  payment_application?: {
    application_number?: string;
    billing_period_id?: Json;
  } & Record<string, Json>;
  invoice?: Record<string, Json>;
  line_items?: Json[];
}

const billingPeriodIdSchema = z.string().uuid();

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/invoicing/owner/atomic#POST",
  async ({ request, params }) => {
    const where = "projects/[projectId]/invoicing/owner/atomic#POST";
    const { projectId } = params;
    const projectIdNum = parseInt(projectId, 10);

    if (!Number.isFinite(projectIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: `Invalid project id '${projectId}'.`,
      });
    }

    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const body = (await request.json()) as AtomicInvoicePayload;

    if (!body.prime_contract_id) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: "prime_contract_id is required.",
        details: [
          { path: "prime_contract_id", message: "Prime contract is required." },
        ],
      });
    }

    if (!body.payment_application?.application_number) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: "An application/invoice number is required.",
      });
    }

    const supabase = await createClient();
    const paymentApplicationPeriodId =
      typeof body.payment_application?.billing_period_id === "string"
        ? body.payment_application.billing_period_id.trim()
        : "";
    const invoicePeriodId =
      typeof body.invoice?.billing_period_id === "string"
        ? body.invoice.billing_period_id.trim()
        : "";

    if (!paymentApplicationPeriodId && !invoicePeriodId) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message:
          "billing_period_id is required. Select a project billing period before creating the invoice.",
        details: [
          {
            path: "billing_period_id",
            message: "A canonical billing-period record is required.",
          },
        ],
      });
    }

    if (
      paymentApplicationPeriodId &&
      invoicePeriodId &&
      paymentApplicationPeriodId !== invoicePeriodId
    ) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message:
          "The payment application and owner invoice must use the same billing_period_id.",
      });
    }

    const billingPeriodId = paymentApplicationPeriodId || invoicePeriodId;
    if (!billingPeriodIdSchema.safeParse(billingPeriodId).success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: "billing_period_id must be a valid billing-period record ID.",
      });
    }

    const { data: billingPeriod, error: billingPeriodError } = await supabase
      .from("billing_periods")
      .select("id, start_date, end_date, due_date")
      .eq("id", billingPeriodId)
      .eq("project_id", projectIdNum)
      .maybeSingle();

    if (billingPeriodError) {
      return NextResponse.json(
        {
          error:
            "The selected billing period could not be validated. No invoice was created.",
          error_message: billingPeriodError.message,
        },
        { status: 500 },
      );
    }

    if (!billingPeriod) {
      return NextResponse.json(
        {
          error:
            "The selected billing period is not available for this project. Refresh the page and select another period.",
          error_message:
            "No invoice was created because the billing period was missing, stale, or belonged to another project.",
        },
        { status: 422 },
      );
    }

    body.payment_application = {
      ...body.payment_application,
      billing_period_id: billingPeriod.id,
      period_from: billingPeriod.start_date,
      period_to: billingPeriod.end_date,
      billing_date:
        body.payment_application?.billing_date ?? billingPeriod.end_date,
    };
    body.invoice = {
      ...body.invoice,
      billing_period_id: billingPeriod.id,
      period_start: billingPeriod.start_date,
      period_end: billingPeriod.end_date,
      billing_date: body.invoice?.billing_date ?? billingPeriod.end_date,
      due_date: body.invoice?.due_date ?? billingPeriod.due_date,
    };

    const { data, error } = await supabase.rpc("create_owner_invoice_atomic", {
      p_project_id: projectIdNum,
      p_contract_id: body.prime_contract_id,
      p_payment_application: body.payment_application ?? {},
      p_invoice: body.invoice ?? {},
      p_line_items: body.line_items ?? [],
    });

    if (error) {
      const status = statusForPgCode(error.code);
      const message =
        error.message?.trim() ||
        "Failed to create the invoice. No changes were saved.";
      // The whole transaction rolled back — nothing partial was written.
      return NextResponse.json(
        { error: message, error_message: message },
        { status },
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  },
);
