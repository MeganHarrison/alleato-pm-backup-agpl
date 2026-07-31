import { DirectCostsClient } from "./direct-costs-client";
import type { DirectCostRow } from "./direct-costs-client";
import { ErrorState } from "@/components/ds";
import { getProjectInfo } from "@/lib/supabase/project-fetcher";
import type { CostCodeDetailRow } from "./direct-costs-table-utils";

export default async function ProjectDirectCostsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, numericProjectId, supabase } = await getProjectInfo(projectId);

  const { data: directCosts, error } = await supabase
    .from("direct_costs")
    .select(`
      *,
      vendor:companies(name),
      line_items:direct_cost_line_items(
        id,
        budget_code_id,
        description,
        line_total,
        quantity,
        unit_cost
      )
    `)
    .eq("project_id", numericProjectId)
    .eq("is_deleted", false)
    .order("date", { ascending: false });

  if (error) {
    return (
      <ErrorState error="Error loading direct costs. Please try again later." />
    );
  }

  const directCostRows: DirectCostRow[] = (directCosts || []).map((row) => ({
    id: row.id,
    date: row.date,
    invoice_number: row.invoice_number,
    cost_type: row.cost_type,
    status: row.status,
    description: row.description,
    total_amount: row.total_amount,
    received_date: row.received_date,
    paid_date: row.paid_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    vendor: row.vendor as { name: string } | null,
    acumatica_ref_nbr: row.acumatica_ref_nbr,
    acumatica_doc_type: row.acumatica_doc_type,
    acumatica_sync_at: row.acumatica_sync_at,
  }));

  const budgetCodeIds = Array.from(
    new Set(
      (directCosts || [])
        .flatMap((row) => (row.line_items as Array<{ budget_code_id: string }> | null) || [])
        .map((lineItem) => lineItem.budget_code_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const { data: projectCostCodes } =
    budgetCodeIds.length > 0
      ? await supabase
          .from("project_budget_codes")
          .select("id,cost_code_id")
          .in("id", budgetCodeIds)
      : { data: [] as Array<{ id: string; cost_code_id: string | null }> };

  const costCodeIds = Array.from(
    new Set(
      (projectCostCodes || [])
        .map((row) => row.cost_code_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const { data: costCodes } =
    costCodeIds.length > 0
      ? await supabase
          .from("cost_codes")
          .select("id,title,division_title")
          .in("id", costCodeIds)
      : { data: [] as Array<{ id: string; title: string | null; division_title: string | null }> };

  const costCodeById = new Map((costCodes || []).map((row) => [row.id, row]));
  const projectCostCodeMap = new Map(
    (projectCostCodes || []).map((row) => [row.id, row.cost_code_id ? costCodeById.get(row.cost_code_id) : null]),
  );

  const costCodeDetails: CostCodeDetailRow[] = (directCosts || []).flatMap((row) => {
    const lineItems =
      (row.line_items as Array<{
        id: string;
        budget_code_id: string;
        description: string | null;
        line_total: number | null;
        quantity: number | null;
        unit_cost: number | null;
      }> | null) || [];

    return lineItems.map((lineItem) => {
      const costCode = projectCostCodeMap.get(lineItem.budget_code_id) ?? null;
      const amount =
        lineItem.line_total ??
        (lineItem.quantity ?? 0) * (lineItem.unit_cost ?? 0);

      return {
        id: `${row.id}-${lineItem.id}`,
        direct_cost_id: row.id,
        budget_code_id: lineItem.budget_code_id,
        budget_code: costCode?.title ?? lineItem.budget_code_id,
        budget_description: lineItem.description ?? row.description ?? "",
        division_label: costCode?.division_title ?? "Uncategorized",
        date: row.date,
        vendor_name: (row.vendor as { name: string } | null)?.name ?? "Internal",
        employee_name: null,
        cost_type: row.cost_type,
        invoice_number: row.invoice_number,
        status: row.status,
        description: row.description ?? lineItem.description,
        amount,
        received_date: row.received_date,
      };
    });
  });

  return (
    <DirectCostsClient
      projectId={projectId}
      directCosts={directCostRows}
      costCodeDetails={costCodeDetails}
      projectName={project.name ?? `Project ${projectId}`}
    />
  );
}
