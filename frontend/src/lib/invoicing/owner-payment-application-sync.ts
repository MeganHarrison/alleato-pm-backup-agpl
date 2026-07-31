import type { SupabaseClient } from "@supabase/supabase-js";

import { GuardrailError } from "@/lib/guardrails/errors";
import type { Database } from "@/types/database.types";

type Supabase = SupabaseClient<Database>;
type PaymentApplicationStatus =
  | "draft"
  | "under_review"
  | "revise_and_resubmit"
  | "approved";
type PaymentApplicationUpdate =
  Database["public"]["Tables"]["prime_contract_payment_applications"]["Update"];

interface LinkedOwnerInvoice {
  id: number;
  prime_contract_id: string | null;
  payment_application_id: string | null;
}

interface SyncLinkedOwnerPaymentApplicationInput {
  supabase: Supabase;
  projectId: number;
  invoice: LinkedOwnerInvoice;
  status: PaymentApplicationStatus;
  where: string;
}

export async function syncLinkedOwnerPaymentApplication({
  supabase,
  projectId,
  invoice,
  status,
  where,
}: SyncLinkedOwnerPaymentApplicationInput): Promise<void> {
  if (!invoice.payment_application_id) return;

  const now = new Date().toISOString();
  const updatePayload: PaymentApplicationUpdate = {
    status,
    updated_at: now,
  };

  if (status === "under_review") {
    updatePayload.submitted_at = now;
  }

  if (status === "approved") {
    updatePayload.approved_at = now;
  }

  let query = supabase
    .from("prime_contract_payment_applications")
    .update(updatePayload)
    .eq("id", invoice.payment_application_id)
    .eq("project_id", projectId);

  if (invoice.prime_contract_id) {
    query = query.eq("contract_id", invoice.prime_contract_id);
  }

  const { data, error } = await query.select("id").maybeSingle();

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: "Failed to sync linked prime contract payment application.",
      details: {
        ownerInvoiceId: invoice.id,
        paymentApplicationId: invoice.payment_application_id,
        status,
        reason: error.message,
      },
      cause: error,
    });
  }

  if (!data) {
    throw new GuardrailError({
      code: "ROUTE_BINDING_MISSING",
      where,
      message: "Linked prime contract payment application was not found for this owner invoice.",
      details: {
        ownerInvoiceId: invoice.id,
        paymentApplicationId: invoice.payment_application_id,
        status,
      },
      status: 404,
      severity: "medium",
    });
  }
}
