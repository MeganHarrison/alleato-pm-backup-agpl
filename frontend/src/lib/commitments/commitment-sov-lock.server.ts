import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import {
  getCommitmentSovLockState,
  hasSubmittedCommitmentInvoice,
  type CommitmentSovLockState,
} from "./commitment-sov-lock";

type DbClient = SupabaseClient<Database>;

export async function getCommitmentSovLockStateForCommitment(
  supabase: DbClient,
  args: {
    commitmentId: string;
    commitmentType: "subcontract" | "purchase_order";
  },
): Promise<CommitmentSovLockState> {
  const foreignKey =
    args.commitmentType === "subcontract" ? "subcontract_id" : "purchase_order_id";

  const { data, error } = await supabase
    .from("subcontractor_invoices")
    .select("status, submitted_at, approved_at")
    .eq(foreignKey, args.commitmentId);

  if (error) {
    throw error;
  }

  return getCommitmentSovLockState({
    hasSubmittedInvoice: hasSubmittedCommitmentInvoice(data ?? []),
  });
}
