import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type Supabase = SupabaseClient<Database>;

export interface CommitmentNumberInfo {
  contract_number: string | null;
}

export interface CommitmentReference {
  commitment_id: string | null | undefined;
  commitment_type?: string | null | undefined;
}

/**
 * change_event_line_items.commitment_id is a polymorphic reference to either
 * purchase_orders or subcontracts, disambiguated by commitment_type.
 */
export async function resolveLineItemCommitmentNumbers(
  supabase: Supabase,
  references: CommitmentReference[],
): Promise<Map<string, CommitmentNumberInfo>> {
  const commitmentMap = new Map<string, CommitmentNumberInfo>();
  const purchaseOrderIds = new Set<string>();
  const subcontractIds = new Set<string>();
  const unsupportedTypes = new Set<string>();

  for (const reference of references) {
    const id = reference.commitment_id;
    if (!id) continue;

    if (reference.commitment_type === "purchase_order") {
      purchaseOrderIds.add(id);
      continue;
    }

    if (reference.commitment_type === "subcontract") {
      subcontractIds.add(id);
      continue;
    }

    unsupportedTypes.add(reference.commitment_type ?? "missing");
  }

  if (unsupportedTypes.size > 0) {
    throw new Error(
      `Invalid change event commitment type(s) for PDF export: ${[...unsupportedTypes].sort().join(", ")}`,
    );
  }

  if (purchaseOrderIds.size === 0 && subcontractIds.size === 0) return commitmentMap;

  const purchaseOrderQuery =
    purchaseOrderIds.size > 0
      ? supabase
          .from("purchase_orders")
          .select("id, contract_number")
          .in("id", [...purchaseOrderIds])
      : Promise.resolve({ data: [], error: null });
  const subcontractQuery =
    subcontractIds.size > 0
      ? supabase
          .from("subcontracts")
          .select("id, contract_number")
          .in("id", [...subcontractIds])
      : Promise.resolve({ data: [], error: null });

  const [purchaseOrdersResult, subcontractsResult] = await Promise.all([
    purchaseOrderQuery,
    subcontractQuery,
  ]);

  if (purchaseOrdersResult.error) {
    throw new Error(
      `Failed to resolve purchase order numbers for change event PDF export: ${purchaseOrdersResult.error.message}`,
    );
  }

  if (subcontractsResult.error) {
    throw new Error(
      `Failed to resolve subcontract numbers for change event PDF export: ${subcontractsResult.error.message}`,
    );
  }

  for (const po of purchaseOrdersResult.data || []) {
    commitmentMap.set(po.id, { contract_number: po.contract_number });
  }
  for (const sub of subcontractsResult.data || []) {
    commitmentMap.set(sub.id, { contract_number: sub.contract_number });
  }

  return commitmentMap;
}
