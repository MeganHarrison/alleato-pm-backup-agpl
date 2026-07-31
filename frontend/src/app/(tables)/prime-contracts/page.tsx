export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { PrimeContractsGlobalClient } from "./prime-contracts-client";

export default async function GlobalPrimeContractsPage() {
  const supabase = await createClient();

  // Step 1: get all prime contracts with project + company joins
  const { data: contracts } = await supabase
    .from("prime_contracts")
    .select(`
      *,
      projects(id, name),
      client:companies!prime_contracts_client_company_id_fkey(id, name)
    `)
    .order("created_at", { ascending: false });

  // Step 2: get financial summaries for all contracts
  const contractIds = (contracts ?? []).map((c) => c.id);
  const { data: financials } =
    contractIds.length > 0
      ? await supabase
          .from("prime_contract_financial_summary")
          .select(
            "contract_id, approved_change_orders, pending_change_orders, draft_change_orders, revised_contract_amount, invoiced_amount, payments_received, remaining_balance, percent_paid",
          )
          .in("contract_id", contractIds)
      : { data: [] };

  // Step 3: merge financial data onto each contract
  const financialMap = new Map((financials ?? []).map((f) => [f.contract_id, f]));
  const merged = (contracts ?? []).map((c) => ({
    ...c,
    approved_change_orders: financialMap.get(c.id)?.approved_change_orders ?? null,
    pending_change_orders: financialMap.get(c.id)?.pending_change_orders ?? null,
    draft_change_orders: financialMap.get(c.id)?.draft_change_orders ?? null,
    revised_contract_value: financialMap.get(c.id)?.revised_contract_amount ?? null,
    invoiced_amount: financialMap.get(c.id)?.invoiced_amount ?? null,
    payments_received: financialMap.get(c.id)?.payments_received ?? null,
    remaining_balance: financialMap.get(c.id)?.remaining_balance ?? null,
    percent_paid: financialMap.get(c.id)?.percent_paid ?? null,
  }));

  type Props = Parameters<typeof PrimeContractsGlobalClient>[0];
  return <PrimeContractsGlobalClient contracts={merged as unknown as Props["contracts"]} />;
}
