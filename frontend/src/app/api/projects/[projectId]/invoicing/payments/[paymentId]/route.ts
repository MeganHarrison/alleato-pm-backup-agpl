import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

type Ctx = { params: { projectId: string; paymentId: string } };

async function getAuthedClient() {
  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) return { supabase, error: "Not authenticated" as const };
  return { supabase, user, error: null };
}

function readOnlyPaymentError(where: string): GuardrailError {
  return new GuardrailError({
    code: "READ_ONLY_RESOURCE",
    where,
    message:
      "Invoice payments are synced from Acumatica and cannot be edited in Alleato.",
    status: 405,
    severity: "low",
  });
}

// GET /api/projects/[projectId]/invoicing/payments/[paymentId]
export const GET = withApiGuardrails(
  "projects/[projectId]/invoicing/payments/[paymentId]#GET",
  async ({ params }: Ctx) => {
    const { supabase, error: authErr } = await getAuthedClient();
    if (authErr) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/payments/[paymentId]#GET",
        message: authErr,
      });
    }

    const { projectId, paymentId } = params;
    const projectIdNum = parseInt(projectId, 10);
    const paymentIdNum = parseInt(paymentId, 10);

    const { data, error } = await supabase
      .from("invoice_payments")
      .select(
        `
        *,
        owner_invoice:owner_invoices(id, invoice_number),
        subcontractor_invoice:subcontractor_invoices(id, invoice_number)
      `,
      )
      .eq("id", paymentIdNum)
      .eq("project_id", projectIdNum)
      .maybeSingle();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/payments/[paymentId]#GET",
        message: "Failed to fetch payment.",
        details: error.message,
      });
    }

    if (!data) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "projects/[projectId]/invoicing/payments/[paymentId]#GET",
        message: "Payment not found.",
      });
    }

    return NextResponse.json({ data });
  },
);

export const PATCH = withApiGuardrails(
  "projects/[projectId]/invoicing/payments/[paymentId]#PATCH",
  async () => {
    throw readOnlyPaymentError(
      "projects/[projectId]/invoicing/payments/[paymentId]#PATCH",
    );
  },
);

export const DELETE = withApiGuardrails(
  "projects/[projectId]/invoicing/payments/[paymentId]#DELETE",
  async () => {
    throw readOnlyPaymentError(
      "projects/[projectId]/invoicing/payments/[paymentId]#DELETE",
    );
  },
);
