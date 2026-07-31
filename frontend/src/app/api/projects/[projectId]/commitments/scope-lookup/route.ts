import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  buildCommitmentScopeRecords,
  costCodeLookupKeys,
  searchCommitmentScopeRecords,
  type CommitmentScopeLine,
  type CommitmentScopeSource,
  type CostCodeInsight,
} from "@/lib/commitments/scope-finder";

type SubcontractRow = {
  id: string | null;
  project_id: number | null;
  contract_company_id: string | null;
  company_name: string | null;
  contract_number: string | null;
  title: string | null;
  description: string | null;
  inclusions: string | null;
  exclusions: string | null;
  status: string | null;
  contract_date: string | null;
};

type PurchaseOrderRow = {
  id: string | null;
  project_id: number | null;
  contract_company_id: string | null;
  company_name: string | null;
  contract_number: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  contract_date: string | null;
};

type PurchaseOrderScopeRow = {
  id: string | null;
  inclusions: string | null;
  exclusions: string | null;
};

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned : null;
}

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/commitments/scope-lookup#GET",
  async ({ request, params }) => {
    const { projectId } = await params;
    const projectIdNumber = Number(projectId);
    if (!Number.isInteger(projectIdNumber) || projectIdNumber <= 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/commitments/scope-lookup#GET",
        message: "Project ID must be a positive integer.",
      });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/commitments/scope-lookup#GET",
        message: "Authentication required.",
      });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const companyId = searchParams.get("companyId");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || "8"), 1), 20);

    if (query.length < 2) {
      return NextResponse.json({ data: [] });
    }

    let subcontractQuery = supabase
      .from("subcontracts_with_totals")
      .select("id,project_id,contract_company_id,company_name,contract_number,title,description,inclusions,exclusions,status,contract_date")
      .eq("project_id", projectIdNumber)
      .limit(250);

    let purchaseOrderQuery = supabase
      .from("purchase_orders_with_totals")
      .select("id,project_id,contract_company_id,company_name,contract_number,title,description,status,contract_date")
      .eq("project_id", projectIdNumber)
      .limit(250);

    if (companyId) {
      subcontractQuery = subcontractQuery.eq("contract_company_id", companyId);
      purchaseOrderQuery = purchaseOrderQuery.eq("contract_company_id", companyId);
    }

    const [subcontractsResult, purchaseOrdersResult] = await Promise.all([
      subcontractQuery,
      purchaseOrderQuery,
    ]);

    if (subcontractsResult.error) throw subcontractsResult.error;
    if (purchaseOrdersResult.error) throw purchaseOrdersResult.error;

    const subcontracts = (subcontractsResult.data || []) as SubcontractRow[];
    const purchaseOrders = (purchaseOrdersResult.data || []) as PurchaseOrderRow[];
    const subcontractIds = subcontracts.map((row) => row.id).filter((id): id is string => Boolean(id));
    const purchaseOrderIds = purchaseOrders.map((row) => row.id).filter((id): id is string => Boolean(id));

    const [
      subcontractSovResult,
      purchaseOrderSovResult,
      purchaseOrderScopeResult,
    ] = await Promise.all([
      subcontractIds.length > 0
        ? supabase
            .from("subcontract_sov_items")
            .select("subcontract_id,budget_code,description,amount,line_number")
            .in("subcontract_id", subcontractIds)
        : Promise.resolve({ data: [], error: null }),
      purchaseOrderIds.length > 0
        ? supabase
            .from("purchase_order_sov_items")
            .select("purchase_order_id,budget_code,description,amount,line_number")
            .in("purchase_order_id", purchaseOrderIds)
        : Promise.resolve({ data: [], error: null }),
      purchaseOrderIds.length > 0
        ? supabase
            .from("purchase_orders")
            .select("id,inclusions,exclusions")
            .in("id", purchaseOrderIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (subcontractSovResult.error) throw subcontractSovResult.error;
    if (purchaseOrderSovResult.error) throw purchaseOrderSovResult.error;
    if (purchaseOrderScopeResult.error) throw purchaseOrderScopeResult.error;

    const scopeLines: CommitmentScopeLine[] = [
      ...((subcontractSovResult.data || []).map((row) => ({
        commitmentId: row.subcontract_id,
        budgetCode: row.budget_code,
        description: row.description,
        amount: row.amount,
        lineNumber: row.line_number,
      })) as CommitmentScopeLine[]),
      ...((purchaseOrderSovResult.data || []).map((row) => ({
        commitmentId: row.purchase_order_id,
        budgetCode: row.budget_code,
        description: row.description,
        amount: row.amount,
        lineNumber: row.line_number,
      })) as CommitmentScopeLine[]),
    ];

    const budgetCodes = Array.from(
      new Set(scopeLines.flatMap((row) => (row.budgetCode ? costCodeLookupKeys(row.budgetCode) : []))),
    );

    const costCodeByBudgetCode = new Map<string, CostCodeInsight>();
    if (budgetCodes.length > 0) {
      const { data: costCodeRows, error: costCodeError } = await supabase
        .from("cost_codes")
        .select("id,title,division_title")
        .in("id", budgetCodes);

      if (costCodeError) throw costCodeError;

      for (const row of costCodeRows || []) {
        const insight = {
          divisionTitle: cleanText(row.division_title),
          title: cleanText(row.title),
        };
        if (insight.divisionTitle || insight.title) {
          for (const key of costCodeLookupKeys(row.id)) {
            costCodeByBudgetCode.set(key, insight);
          }
        }
      }
    }

    const purchaseOrderScopeById = new Map<string, PurchaseOrderScopeRow>();
    for (const row of (purchaseOrderScopeResult.data || []) as PurchaseOrderScopeRow[]) {
      if (row.id) purchaseOrderScopeById.set(row.id, row);
    }

    const sources: CommitmentScopeSource[] = [
      ...subcontracts
        .filter((row): row is SubcontractRow & { id: string } => Boolean(row.id))
        .map((row) => ({
          id: row.id,
          projectId: row.project_id,
          commitmentType: "subcontract" as const,
          contractCompanyId: row.contract_company_id,
          companyName: row.company_name,
          contractNumber: row.contract_number,
          title: row.title,
          description: row.description,
          inclusions: row.inclusions,
          exclusions: row.exclusions,
        })),
      ...purchaseOrders
        .filter((row): row is PurchaseOrderRow & { id: string } => Boolean(row.id))
        .map((row) => {
          const scopeRow = purchaseOrderScopeById.get(row.id);
          return {
            id: row.id,
            projectId: row.project_id,
            commitmentType: "purchase_order" as const,
            contractCompanyId: row.contract_company_id,
            companyName: row.company_name,
            contractNumber: row.contract_number,
            title: row.title,
            description: row.description,
            inclusions: scopeRow?.inclusions ?? null,
            exclusions: scopeRow?.exclusions ?? null,
          };
        }),
    ];

    const scopeRecordsById = buildCommitmentScopeRecords(
      sources,
      scopeLines,
      costCodeByBudgetCode,
    );
    const scopeRecords = Array.from(scopeRecordsById.values());
    const matches = searchCommitmentScopeRecords(scopeRecords, query, limit);

    return NextResponse.json({
      data: matches.map((match) => {
        const record = scopeRecordsById.get(match.id);
        if (!record) return null;

        return {
          id: record.id,
          commitment_type: record.commitmentType,
          contract_company_id: record.contractCompanyId,
          contract_company_name: record.companyName,
          contract_number: record.contractNumber,
          title: record.title,
          trade_names: record.tradeNames,
          scope_summary: record.scopeSummary,
          inclusion_summary: record.inclusionSummary,
          exclusion_summary: record.exclusionSummary,
          match_reason: match.matchReason,
          matched_text: match.matchedText,
          score: match.score,
        };
      }).filter(Boolean),
    });
  },
);
