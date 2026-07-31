import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const APPROVED_STATUSES = new Set(["approved"]);
const PENDING_STATUSES = new Set([
  "pending",
  "pending approval",
  "proposed",
  "submitted",
  "under_review",
  "under review",
  "revised",
]);
const DRAFT_STATUSES = new Set(["draft"]);

export interface LivePrimeContractChangeTotals {
  approved: number;
  pending: number;
  draft: number;
}

export interface PrimeContractFinancialSummary {
  approved_change_orders?: number | null;
  pending_change_orders?: number | null;
  draft_change_orders?: number | null;
  revised_contract_amount?: number | null;
  pending_revised_contract_amount?: number | null;
}

const emptyTotals = (): LivePrimeContractChangeTotals => ({
  approved: 0,
  pending: 0,
  draft: 0,
});

function normalizeStatus(status: string | null): string {
  return (status ?? "").trim().toLowerCase();
}

function getContractKey(
  changeOrder: {
    prime_contract_id: string | null;
    contract_id: string | null;
  },
  knownContractIds: Set<string>,
): string | null {
  if (changeOrder.prime_contract_id && knownContractIds.has(changeOrder.prime_contract_id)) {
    return changeOrder.prime_contract_id;
  }
  if (changeOrder.contract_id && knownContractIds.has(changeOrder.contract_id)) {
    return changeOrder.contract_id;
  }
  return null;
}

export async function fetchLivePrimeContractChangeTotals(
  supabase: SupabaseClient<Database>,
  projectId: number,
  contractIds: string[],
): Promise<Map<string, LivePrimeContractChangeTotals>> {
  const uniqueContractIds = Array.from(new Set(contractIds.filter(Boolean)));
  const totalsByContractId = new Map<string, LivePrimeContractChangeTotals>();

  if (uniqueContractIds.length === 0) {
    return totalsByContractId;
  }

  const idList = uniqueContractIds.join(",");
  const { data, error } = await supabase
    .from("prime_contract_change_orders")
    .select("prime_contract_id, contract_id, status, total_amount")
    .eq("project_id", projectId)
    .or(`prime_contract_id.in.(${idList}),contract_id.in.(${idList})`);

  if (error) {
    throw error;
  }

  const knownContractIds = new Set(uniqueContractIds);

  for (const changeOrder of data ?? []) {
    const contractId = getContractKey(changeOrder, knownContractIds);
    if (!contractId) continue;

    const totals = totalsByContractId.get(contractId) ?? emptyTotals();
    const amount = changeOrder.total_amount ?? 0;
    const status = normalizeStatus(changeOrder.status);

    if (APPROVED_STATUSES.has(status)) {
      totals.approved += amount;
    } else if (PENDING_STATUSES.has(status)) {
      totals.pending += amount;
    } else if (DRAFT_STATUSES.has(status)) {
      totals.draft += amount;
    }

    totalsByContractId.set(contractId, totals);
  }

  return totalsByContractId;
}

export function mergePrimeContractFinancials(
  originalContractValue: number,
  summary: PrimeContractFinancialSummary | null | undefined,
  liveTotals: LivePrimeContractChangeTotals | null | undefined,
) {
  const hasLiveTotals = liveTotals !== null && liveTotals !== undefined;
  const approvedChangeOrders = hasLiveTotals
    ? liveTotals.approved
    : summary?.approved_change_orders ?? 0;
  const pendingChangeOrders = hasLiveTotals
    ? liveTotals.pending
    : summary?.pending_change_orders ?? 0;
  const draftChangeOrders = hasLiveTotals
    ? liveTotals.draft
    : summary?.draft_change_orders ?? 0;
  const revisedContractValue = originalContractValue + approvedChangeOrders;
  const pendingRevisedContractValue =
    revisedContractValue + pendingChangeOrders + draftChangeOrders;

  return {
    approved_change_orders: approvedChangeOrders,
    pending_change_orders: pendingChangeOrders,
    draft_change_orders: draftChangeOrders,
    revised_contract_value: revisedContractValue,
    pending_revised_contract_value: pendingRevisedContractValue,
  };
}
