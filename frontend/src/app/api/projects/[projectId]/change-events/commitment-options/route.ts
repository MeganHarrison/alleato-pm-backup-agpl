import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const requestSchema = z.object({
  change_event_ids: z.array(z.string().uuid()).min(1),
  scope: z.enum(["all_contracts", "matching_cost_codes"]).default("all_contracts"),
  commitment_type_filter: z
    .enum(["any", "subcontract", "purchase_order"])
    .default("any"),
});

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export const POST = withApiGuardrails(
  "projects/[projectId]/change-events/commitment-options#POST",
  async ({ request, params }) => {
  
    const { projectId: projectIdParam } = await params;
    const projectId = Number.parseInt(projectIdParam, 10);

    if (Number.isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const body = requestSchema.parse(await request.json());
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/commitment-options#POST", message: "Authentication required." });
    }

    let baseCommitmentsQuery = supabase
      .from("commitments_unified")
      .select("id, commitment_number:contract_number, title, status, commitment_type, contract_company_id")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("contract_number", { ascending: true });

    if (body.commitment_type_filter !== "any") {
      baseCommitmentsQuery = baseCommitmentsQuery.eq(
        "commitment_type",
        body.commitment_type_filter,
      );
    }

    const { data: commitments, error: commitmentsError } = await baseCommitmentsQuery;
    if (commitmentsError) {
      return apiErrorResponse(commitmentsError);
    }

    // Resolve vendor names from contract_company_id in a single batch query
    const companyIds = [
      ...new Set(
        (commitments ?? [])
          .map((c) => (c as Record<string, unknown>).contract_company_id as string | null)
          .filter((id): id is string => !!id),
      ),
    ];

    const vendorNameById = new Map<string, string>();
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);
      for (const company of companies ?? []) {
        if (company.id && company.name) {
          vendorNameById.set(company.id, company.name);
        }
      }
    }

    const allCommitments = (commitments ?? []).map((c) => {
      const companyId = (c as Record<string, unknown>).contract_company_id as string | null;
      return {
        ...c,
        vendor_name: companyId ? (vendorNameById.get(companyId) ?? null) : null,
      };
    });

    if (body.scope === "matching_cost_codes") {
      const { data: lineItems, error: lineItemsError } = await supabase
        .from("change_event_line_items")
        .select("change_event_id, commitment_id, budget_code_id")
        .in("change_event_id", body.change_event_ids);

      if (lineItemsError) {
        return apiErrorResponse(lineItemsError);
      }

      const linkedCommitmentIds = new Set<string>(
        (lineItems ?? [])
          .map((lineItem) => lineItem.commitment_id)
          .filter((value): value is string => !!value),
      );

      const budgetLineIds = [
        ...new Set(
          (lineItems ?? [])
            .map((lineItem) => lineItem.budget_code_id)
            .filter((value): value is string => !!value),
        ),
      ];

      const budgetCodeCandidates = new Set<string>();
      if (budgetLineIds.length > 0) {
        const { data: budgetLines, error: budgetLinesError } = await supabase
          .from("budget_lines")
          .select("id, cost_code_id, cost_type_id, project_budget_code_id")
          .in("id", budgetLineIds)
          .eq("project_id", projectId);

        if (budgetLinesError) {
          return apiErrorResponse(budgetLinesError);
        }

        const costTypeIds = [
          ...new Set(
            (budgetLines ?? [])
              .map((budgetLine) => budgetLine.cost_type_id)
              .filter((value): value is string => !!value),
          ),
        ];

        const costTypeCodeById = new Map<string, string>();
        if (costTypeIds.length > 0) {
          const { data: costTypes, error: costTypesError } = await supabase
            .from("cost_code_types")
            .select("id, code")
            .in("id", costTypeIds);
          if (costTypesError) {
            return apiErrorResponse(costTypesError);
          }
          for (const costType of costTypes ?? []) {
            if (costType.id && costType.code) {
              costTypeCodeById.set(costType.id, String(costType.code));
            }
          }
        }

        for (const budgetLine of budgetLines ?? []) {
          budgetCodeCandidates.add(budgetLine.id);
          budgetCodeCandidates.add(budgetLine.cost_code_id);
          if (budgetLine.project_budget_code_id) {
            budgetCodeCandidates.add(budgetLine.project_budget_code_id);
          }
          const costTypeCode = costTypeCodeById.get(budgetLine.cost_type_id);
          if (costTypeCode) {
            budgetCodeCandidates.add(`${budgetLine.cost_code_id}.${costTypeCode}`);
          }
        }
      }

      const matchedCommitmentIds = new Set<string>(linkedCommitmentIds);
      const budgetCodeValues = [...budgetCodeCandidates];
      if (budgetCodeValues.length > 0) {
        const subcontractIds = allCommitments
          .filter((commitment) => commitment.commitment_type === "subcontract")
          .map((commitment) => commitment.id)
          .filter((value): value is string => !!value);

        const purchaseOrderIds = allCommitments
          .filter((commitment) => commitment.commitment_type === "purchase_order")
          .map((commitment) => commitment.id)
          .filter((value): value is string => !!value);

        if (subcontractIds.length > 0) {
          const { data: subcontractMatches, error: subcontractMatchError } = await supabase
            .from("subcontract_sov_items")
            .select("subcontract_id")
            .in("subcontract_id", subcontractIds)
            .in("budget_code", budgetCodeValues);
          if (subcontractMatchError) {
            return apiErrorResponse(subcontractMatchError);
          }
          for (const row of subcontractMatches ?? []) {
            if (row.subcontract_id) matchedCommitmentIds.add(row.subcontract_id);
          }
        }

        if (purchaseOrderIds.length > 0) {
          const { data: purchaseOrderMatches, error: purchaseOrderMatchError } = await supabase
            .from("purchase_order_sov_items")
            .select("purchase_order_id")
            .in("purchase_order_id", purchaseOrderIds)
            .in("budget_code", budgetCodeValues);
          if (purchaseOrderMatchError) {
            return apiErrorResponse(purchaseOrderMatchError);
          }
          for (const row of purchaseOrderMatches ?? []) {
            if (row.purchase_order_id) matchedCommitmentIds.add(row.purchase_order_id);
          }
        }
      }

      const matchedCommitments = allCommitments.filter((commitment) =>
        commitment.id ? matchedCommitmentIds.has(commitment.id) : false,
      );

      return NextResponse.json({
        data: matchedCommitments,
        scope: body.scope,
        count: matchedCommitments.length,
      });
    }

    return NextResponse.json({
      data: allCommitments,
      scope: body.scope,
      count: allCommitments.length,
    });
    },
);
