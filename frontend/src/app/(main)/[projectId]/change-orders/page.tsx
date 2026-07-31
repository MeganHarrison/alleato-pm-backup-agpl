import { getProjectInfo } from "@/lib/supabase/project-fetcher";
import { ChangeOrdersClient } from "./change-orders-client";
import type { PrimeContractCO, CommitmentCO } from "@/features/change-orders/change-orders-table-config";

export default async function ProjectChangeOrdersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { numericProjectId, supabase } = await getProjectInfo(projectId);

  const [primeResponse, contractIdsResponse] = await Promise.all([
    supabase
      .from("prime_contract_change_orders")
      .select("*")
      .eq("project_id", numericProjectId)
      .order("created_at", { ascending: false }),

    supabase
      .from("financial_contracts")
      .select("id")
      .eq("project_id", numericProjectId),
  ]);

  if (primeResponse.error) {
    console.error("Error loading prime contract change orders:", primeResponse.error);
    return <ChangeOrdersClient projectId={projectId} primeCOs={[]} commitmentCOs={[]} />;
  }

  const contractIds = (contractIdsResponse.data || []).map((c) => c.id);

  // A commitment CO belongs to this project if EITHER it hangs off one of the
  // project's contracts OR it is stamped directly with project_id. The second
  // branch covers Acumatica project-level change orders whose commitment header
  // was never synced (contract_id points at a deleted "ghost" commitment) —
  // see scripts/jobplanner/backfill-cco-project-id.mjs (2026-07-09). project_id
  // now exists on contract_change_orders, so the old "no FK to project" workaround
  // (resolve only via contract IDs) hid 132 real COs on Westfield Collective.
  // PostgREST returns each row once, so overlapping matches are not double-counted.
  const orFilters = [`project_id.eq.${numericProjectId}`];
  if (contractIds.length > 0) {
    orFilters.push(`contract_id.in.(${contractIds.join(",")})`);
  }
  const commitmentResponse = await supabase
    .from("contract_change_orders")
    .select("*")
    .or(orFilters.join(","))
    .order("created_at", { ascending: false });

  if (commitmentResponse.error) {
    console.error("Error loading commitment change orders:", commitmentResponse.error);
  }

   
  const primeCOs: PrimeContractCO[] = (primeResponse.data || []).map((co: any) => ({
    id: co.id,
    pcco_number: co.pcco_number,
    title: co.title ?? null,
    status: co.status,
    total_amount: co.total_amount,
    contract_id: co.contract_id,
    prime_contract_id: co.prime_contract_id ?? null,
    executed: co.executed ?? false,
    revision: co.revision ?? null,
    contract_company: co.contract_company ?? null,
    change_reason: co.change_reason ?? null,
    due_date: co.due_date ?? null,
    submitted_at: co.submitted_at ?? null,
    approved_at: co.approved_at ?? null,
    created_at: co.created_at ?? null,
    project_id: co.project_id,
    designated_reviewer: co.designated_reviewer ?? null,
    review_date: co.review_date ?? null,
  }));

   
  const commitmentCOs: CommitmentCO[] = (commitmentResponse.data || []).map((co: any) => ({
    id: co.id,
    change_order_number: co.change_order_number ?? null,
    title: co.title ?? null,
    description: co.description ?? null,
    status: co.status,
    amount: co.amount,
    contract_id: co.contract_id,
    contract_type: co.contract_type ?? null,
    change_reason: co.change_reason ?? null,
    requested_by: co.requested_by ?? null,
    requested_date: co.requested_date ?? null,
    approved_by: co.approved_by ?? null,
    approved_date: co.approved_date ?? null,
    rejection_reason: co.rejection_reason ?? null,
    due_date: co.due_date ?? null,
    designated_reviewer: co.designated_reviewer ?? null,
    created_at: co.created_at ?? null,
  }));

  return (
    <ChangeOrdersClient
      projectId={projectId}
      primeCOs={primeCOs}
      commitmentCOs={commitmentCOs}
    />
  );
}
