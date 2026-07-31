import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type RouteSupabaseClient = SupabaseClient<Database>;

export type CommitmentChangeOrderScopedRow =
  Database["public"]["Tables"]["contract_change_orders"]["Row"] & {
    commitment_number: string | null;
    project_id: number;
  };

// Loads a commitment CO and verifies that its linked commitment belongs to the requested project.
export async function getScopedCommitmentChangeOrder(
  supabase: RouteSupabaseClient,
  projectId: number,
  commitmentChangeOrderId: string,
): Promise<CommitmentChangeOrderScopedRow | null> {
  const { data: changeOrder, error: changeOrderError } = await supabase
    .from("contract_change_orders")
    .select("*")
    .eq("id", commitmentChangeOrderId)
    .single();

  if (changeOrderError || !changeOrder) {
    return null;
  }

  const { data: commitment, error: commitmentError } = await supabase
    .from("commitments_unified")
    .select("id, project_id, contract_number")
    .eq("id", changeOrder.contract_id)
    .is("deleted_at", null)
    .single();

  if (commitmentError || !commitment || commitment.project_id !== projectId) {
    return null;
  }

  return {
    ...changeOrder,
    commitment_number: commitment.contract_number ?? null,
    project_id: commitment.project_id,
  };
}
