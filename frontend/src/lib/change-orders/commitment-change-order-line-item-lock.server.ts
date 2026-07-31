import type { SupabaseClient } from "@supabase/supabase-js";

import { getCommitmentChangeOrderLineItemLock } from "@/lib/change-orders/commitment-change-order-status";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { Database } from "@/types/database.types";

type RouteSupabaseClient = SupabaseClient<Database>;

export async function assertCommitmentChangeOrderLineItemsUnlocked(
  supabase: RouteSupabaseClient,
  projectId: number,
  commitmentChangeOrderId: string,
  where: string,
) {
  const { data, error } = await supabase
    .from("commitment_change_orders_with_scope")
    .select("id, project_id, status")
    .eq("id", commitmentChangeOrderId)
    .eq("project_id", projectId)
    .single();

  if (error || !data) {
    throw new GuardrailError({
      code: "ROUTE_BINDING_MISSING",
      where,
      message: "Commitment change order not found.",
      status: 404,
      severity: "low",
      details: { commitmentChangeOrderId, projectId },
      cause: error,
    });
  }

  const lock = getCommitmentChangeOrderLineItemLock(data.status);
  if (!lock.locked) {
    return data;
  }

  throw new GuardrailError({
    code: "PRECONDITION_FAILED",
    where,
    message: lock.message ?? "Approved commitment change orders are read-only.",
    details: {
      commitmentChangeOrderId,
      projectId,
      lockReason: "approved",
      errorCode: "COMMITMENT_CHANGE_ORDER_LINE_ITEMS_LOCKED",
    },
  });
}
