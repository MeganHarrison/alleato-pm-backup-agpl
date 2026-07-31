import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { requirePermission } from "@/lib/permissions-guard";
import { normalizeBudgetCodeLookupKey } from "@/lib/budget/compute-grand-totals";
import type {
  BudgetDetailLineItem,
  DetailType,
} from "@/components/budget/budget-details-table";
import { apiErrorResponse } from "@/lib/api-error";

interface BudgetDetailParams {
  params: Promise<{
    projectId: string;
  }>;
}

type CostCodeRef = {
  id?: string;
  projectId: string;
  title: string | null;
};

const APPROVED_DIRECT_COST_STATUSES = ["Approved"];
const PRIME_CHANGE_ORDER_LINES_TABLE = "change_order_lines";
const PENDING_SUBCONTRACT_STATUSES = ["out for signature", "pending"];
const PENDING_PO_STATUSES = ["draft", "sent", "acknowledged"];

interface RuntimePendingChangeOrderLinesClient {
  from: (tableName: string) => {
    select: (selectedColumns: string) => {
      eq: (column: string, value: number) => {
        like: (
          column: string,
          pattern: string,
        ) => Promise<{
          data: Array<Record<string, unknown>> | null;
          error: unknown;
        }>;
      };
    };
  };
}

interface CompanyLookupClient {
  from: (tableName: "companies") => {
    select: (selectedColumns: "id, name") => {
      in: (
        column: "id",
        values: string[],
      ) => Promise<{
        data: Array<{ id: string; name: string | null }> | null;
        error: unknown;
      }>;
    };
  };
}

async function loadCompanyNameMap(
  supabase: CompanyLookupClient,
  companyIds: string[],
) {
  const uniqueCompanyIds = Array.from(new Set(companyIds.filter(Boolean)));
  if (uniqueCompanyIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .in("id", uniqueCompanyIds);

  if (error) throw error;
  return new Map((data ?? []).map((company) => [company.id, company.name ?? ""]));
}

/**
 * GET /api/projects/[projectId]/budget/details
 *
 * Fetches budget detail line items for the Budget Detail tab
 * Aggregates data from:
 * - budget_lines (original budget)
 * - budget_modifications (budget changes)
 * - contract_change_orders (prime contract COs)
 * - commitments (committed costs)
 * - commitment_change_orders (commitment COs)
 * - change_events (change events)
 * - direct_costs (direct costs)
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/budget/details#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;
    const supabase = authResult.serviceClient;

    const details: BudgetDetailLineItem[] = [];

    // 1. Fetch Original Budget items
    const { data: budgetLines, error: budgetError } = await supabase
      .from("budget_lines")
      .select(
        `
        id,
        original_amount,
        description,
        cost_code_id,
        cost_type_id,
        cost_codes (
          id,
          title
        )
      `,
      )
      .eq("project_id", projectIdNum);

    if (budgetError) {
      return NextResponse.json(
        { error: "Failed to load budget lines" },
        { status: 500 },
      );
    }

    const canonicalBudgetCodeByLookupKey = new Map<string, string>();
    for (const line of budgetLines ?? []) {
      if (line.cost_code_id) {
        canonicalBudgetCodeByLookupKey.set(
          normalizeBudgetCodeLookupKey(line.cost_code_id),
          line.cost_code_id,
        );
      }
    }
    const canonicalBudgetCode = (budgetCode: string | null | undefined) => {
      if (!budgetCode) return "";
      return (
        canonicalBudgetCodeByLookupKey.get(normalizeBudgetCodeLookupKey(budgetCode)) ??
        budgetCode
      );
    };

    if (!budgetError && budgetLines) {
      budgetLines.forEach((line) => {
        const costCode = line.cost_codes as unknown as CostCodeRef | null;

        details.push({
          id: `budget-${line.id}`,
          budgetCode: line.cost_code_id || costCode?.id || "",
          budgetCodeDescription: costCode?.title || "",
          item: "Original Budget",
          detailType: "original_budget" as DetailType,
          description: line.description || "",
          status: "Current",
          originalBudgetAmount: Number(line.original_amount) || 0,
        });
      });
    }

    // 2. Fetch Budget Modifications (approved)
    const { data: budgetMods, error: modsError } = await supabase
      .from("budget_mod_lines")
      .select(
        `
        id,
        amount,
        description,
        cost_code_id,
        budget_modifications!inner (
          id,
          status,
          number,
          title
        ),
        cost_codes (
          id,
          title
        )
      `,
      )
      .eq("project_id", projectIdNum)
      .eq("budget_modifications.status", "approved");

    if (!modsError && budgetMods) {
      budgetMods.forEach((mod) => {
        const costCode = mod.cost_codes as unknown as CostCodeRef | null;
        const modification = mod.budget_modifications as unknown as {
          number: string;
          title: string;
        };

        details.push({
          id: `mod-${mod.id}`,
          budgetCode: mod.cost_code_id || costCode?.id || "",
          budgetCodeDescription: costCode?.title || "",
          item: modification
            ? `${modification.number} - ${modification.title}`
            : "",
          detailType: "budget_changes" as DetailType,
          description: mod.description || "",
          status: "Approved",
          budgetChanges: Number(mod.amount) || 0,
        });
      });
    }

    // 3. Fetch Pending Budget Modifications
    const { data: pendingMods, error: pendingModsError } = await supabase
      .from("budget_mod_lines")
      .select(
        `
        id,
        amount,
        description,
        cost_code_id,
        budget_modifications!inner (
          id,
          status,
          number,
          title
        ),
        cost_codes (
          id,
          title
        )
      `,
      )
      .eq("project_id", projectIdNum)
      .in("budget_modifications.status", ["pending", "draft"]);

    if (!pendingModsError && pendingMods) {
      pendingMods.forEach((mod) => {
        const costCode = mod.cost_codes as unknown as CostCodeRef | null;
        const modification = mod.budget_modifications as unknown as {
          status: string;
          number: string;
          title: string;
        };

        details.push({
          id: `pending-mod-${mod.id}`,
          budgetCode: mod.cost_code_id || costCode?.id || "",
          budgetCodeDescription: costCode?.title || "",
          item: modification
            ? `${modification.number} - ${modification.title}`
            : "",
          detailType: "budget_changes" as DetailType,
          description: mod.description || "",
          status: modification?.status || "Pending",
          pendingBudgetChanges: Number(mod.amount) || 0,
        });
      });
    }

    // 4. Fetch Prime Contract Change Orders (approved)
    const { data: contractCOs, error: contractCOsError } = await supabase
      .from("contract_change_orders")
      .select(
        `
        id,
        amount,
        description,
        change_order_number,
        status,
        prime_contracts!inner (
          contract_number
        )
      `,
      )
      .eq("prime_contracts.project_id", projectIdNum)
      .eq("status", "approved");

    if (!contractCOsError && contractCOs) {
      contractCOs.forEach((co) => {
        const contract = co.prime_contracts as unknown as {
          contract_number: string;
        };

        details.push({
          id: `contract-co-${co.id}`,
          budgetCode: contract ? contract.contract_number : "",
          budgetCodeDescription: "Prime Contract",
          item: `CO ${co.change_order_number}`,
          detailType: "prime_contract_change_orders" as DetailType,
          description: co.description || "",
          status: co.status || "Approved",
          detailHref: co.id ? `/${projectIdNum}/change-orders/prime/${co.id}` : null,
          approvedCOs: Number(co.amount) || 0,
        });
      });
    }

    // 4b. Fetch Pending Prime Contract Change Orders
     
    const pendingContractCOsResult =
      await (async () => {
        const runtimeSupabase =
          supabase as unknown as RuntimePendingChangeOrderLinesClient;
        const result = await runtimeSupabase
          .from(PRIME_CHANGE_ORDER_LINES_TABLE)
          .select(
            `
          id,
          amount,
          description,
          cost_code_id,
          change_orders!inner (
            id,
            status,
            change_order_number,
            project_id
          )
        `,
          )
          .eq("change_orders.project_id", projectIdNum)
          .like("change_orders.status", "Pending%");

        const errStr = JSON.stringify(result.error);
        const isMissingTable =
          errStr.includes(PRIME_CHANGE_ORDER_LINES_TABLE) ||
          errStr.includes("PGRST205") ||
          errStr.includes("schema cache");

        if (result.error && isMissingTable) {
          return { data: [], error: null };
        }

        return result;
      })();
    const { data: pendingContractCOs, error: pendingContractCOsError } =
      pendingContractCOsResult as {
        data: Array<{
          id: string;
          amount: number | null;
          description: string | null;
          cost_code_id: string | null;
          change_orders: { id: string; status: string; change_order_number: string; project_id: number };
        }> | null;
        error: unknown;
      };

    if (!pendingContractCOsError && pendingContractCOs) {
      pendingContractCOs.forEach((co) => {
        const changeOrder = co.change_orders as unknown as {
          id: string;
          status: string;
          change_order_number: string;
        };

        details.push({
          id: `pending-contract-co-${co.id}`,
          budgetCode: co.cost_code_id || "",
          budgetCodeDescription: "",
          item: changeOrder
            ? `CO ${changeOrder.change_order_number}`
            : "",
          detailType: "budget_changes" as DetailType,
          description: co.description || "",
          status: changeOrder?.status || "Pending",
          detailHref: changeOrder?.id
            ? `/${projectIdNum}/change-orders/prime/${changeOrder.id}`
            : null,
          pendingBudgetChanges: Number(co.amount) || 0,
        });
      });
    }

    // 5. Fetch Subcontract SOV Items (committed costs)
    const { data: subcontractSovItems, error: subcontractsError } =
      await supabase
        .from("subcontract_sov_items")
        .select(
          `
        id,
        amount,
        description,
        budget_code,
        subcontracts!inner (
          id,
          status,
          contract_number,
          project_id,
          contract_company_id
        )
      `,
        )
        .in("subcontracts.status", ["approved", "Approved", "complete", "Complete"])
        .eq("subcontracts.project_id", projectIdNum);

    if (subcontractsError) {
      return apiErrorResponse(subcontractsError);
    }

    const subcontractCompanyIds = (subcontractSovItems ?? [])
      .map((line) => {
        const subcontract = Array.isArray(line.subcontracts)
          ? line.subcontracts[0]
          : line.subcontracts;
        return subcontract?.contract_company_id ?? "";
      })
      .filter(Boolean);
    let subcontractCompanyNames: Map<string, string>;
    try {
      subcontractCompanyNames = await loadCompanyNameMap(
        supabase as unknown as CompanyLookupClient,
        subcontractCompanyIds,
      );
    } catch (error) {
      return apiErrorResponse(error);
    }

    if (!subcontractsError && subcontractSovItems) {
      subcontractSovItems.forEach((line) => {
        const subcontract = Array.isArray(line.subcontracts)
          ? line.subcontracts[0]
          : line.subcontracts;

        details.push({
          id: `subcontract-${line.id}`,
          budgetCode: canonicalBudgetCode(line.budget_code),
          budgetCodeDescription: "",
          vendor: subcontract?.contract_company_id
            ? (subcontractCompanyNames.get(subcontract.contract_company_id) ?? "")
            : "",
          item: subcontract ? subcontract.contract_number : "",
          detailType: "commitments" as DetailType,
          description: line.description || "",
          status: subcontract?.status || "",
          detailHref: subcontract?.id
            ? `/${projectIdNum}/commitments/${subcontract.id}`
            : null,
          committedCosts: Number(line.amount) || 0,
        });
      });
    }

    // 5b. Fetch Purchase Order SOV Items (committed costs)
    const { data: poSovItems, error: poError } = await supabase
      .from("purchase_order_sov_items")
      .select(
        `
        id,
        amount,
        description,
        budget_code,
        purchase_orders!inner (
          id,
          status,
          contract_number,
          project_id,
          contract_company_id
        )
      `,
      )
      .in("purchase_orders.status", ["approved", "Approved", "complete", "Complete"])
      .eq("purchase_orders.project_id", projectIdNum);

    if (poError) {
      return apiErrorResponse(poError);
    }

    const purchaseOrderCompanyIds = (poSovItems ?? [])
      .map((line) => {
        const purchaseOrder = Array.isArray(line.purchase_orders)
          ? line.purchase_orders[0]
          : line.purchase_orders;
        return purchaseOrder?.contract_company_id ?? "";
      })
      .filter(Boolean);
    let purchaseOrderCompanyNames: Map<string, string>;
    try {
      purchaseOrderCompanyNames = await loadCompanyNameMap(
        supabase as unknown as CompanyLookupClient,
        purchaseOrderCompanyIds,
      );
    } catch (error) {
      return apiErrorResponse(error);
    }

    if (!poError && poSovItems) {
      poSovItems.forEach((line) => {
        const purchaseOrder = Array.isArray(line.purchase_orders)
          ? line.purchase_orders[0]
          : line.purchase_orders;

        details.push({
          id: `po-${line.id}`,
          budgetCode: canonicalBudgetCode(line.budget_code),
          budgetCodeDescription: "",
          vendor: purchaseOrder?.contract_company_id
            ? (purchaseOrderCompanyNames.get(purchaseOrder.contract_company_id) ?? "")
            : "",
          item: purchaseOrder ? purchaseOrder.contract_number : "",
          detailType: "commitments" as DetailType,
          description: line.description || "",
          status: purchaseOrder?.status || "",
          detailHref: purchaseOrder?.id
            ? `/${projectIdNum}/commitments/${purchaseOrder.id}`
            : null,
          committedCosts: Number(line.amount) || 0,
        });
      });
    }

    // 5c. Fetch Pending Subcontract / Purchase Order SOV Items
    const { data: pendingSubcontractSovItems, error: pendingSubcontractsError } =
      await supabase
        .from("subcontract_sov_items")
        .select(
          `
        id,
        amount,
        description,
        budget_code,
        subcontracts!inner (
          id,
          status,
          contract_number,
          project_id,
          contract_company_id
        )
      `,
        )
        .in("subcontracts.status", PENDING_SUBCONTRACT_STATUSES)
        .eq("subcontracts.project_id", projectIdNum);

    if (pendingSubcontractsError) {
      return apiErrorResponse(pendingSubcontractsError);
    }

    const { data: pendingPoSovItems, error: pendingPoError } = await supabase
      .from("purchase_order_sov_items")
      .select(
        `
        id,
        amount,
        description,
        budget_code,
        purchase_orders!inner (
          id,
          status,
          contract_number,
          project_id,
          contract_company_id
        )
      `,
      )
      .in("purchase_orders.status", PENDING_PO_STATUSES)
      .eq("purchase_orders.project_id", projectIdNum);

    if (pendingPoError) {
      return apiErrorResponse(pendingPoError);
    }

    const pendingCompanyIds = [
      ...(pendingSubcontractSovItems ?? []).map((line) => {
        const subcontract = Array.isArray(line.subcontracts)
          ? line.subcontracts[0]
          : line.subcontracts;
        return subcontract?.contract_company_id ?? "";
      }),
      ...(pendingPoSovItems ?? []).map((line) => {
        const purchaseOrder = Array.isArray(line.purchase_orders)
          ? line.purchase_orders[0]
          : line.purchase_orders;
        return purchaseOrder?.contract_company_id ?? "";
      }),
    ].filter(Boolean);

    let pendingCompanyNames: Map<string, string>;
    try {
      pendingCompanyNames = await loadCompanyNameMap(
        supabase as unknown as CompanyLookupClient,
        pendingCompanyIds,
      );
    } catch (error) {
      return apiErrorResponse(error);
    }

    for (const line of pendingSubcontractSovItems ?? []) {
      const subcontract = Array.isArray(line.subcontracts)
        ? line.subcontracts[0]
        : line.subcontracts;

      details.push({
        id: `pending-subcontract-${line.id}`,
        budgetCode: canonicalBudgetCode(line.budget_code),
        budgetCodeDescription: "",
        vendor: subcontract?.contract_company_id
          ? (pendingCompanyNames.get(subcontract.contract_company_id) ?? "")
          : "",
        item: subcontract ? subcontract.contract_number : "",
        detailType: "commitments" as DetailType,
        description: line.description || "",
        status: subcontract?.status || "Pending",
        detailHref: subcontract?.id
          ? `/${projectIdNum}/commitments/${subcontract.id}`
          : null,
        pendingCostChanges: Number(line.amount) || 0,
      });
    }

    for (const line of pendingPoSovItems ?? []) {
      const purchaseOrder = Array.isArray(line.purchase_orders)
        ? line.purchase_orders[0]
        : line.purchase_orders;

      details.push({
        id: `pending-po-${line.id}`,
        budgetCode: canonicalBudgetCode(line.budget_code),
        budgetCodeDescription: "",
        vendor: purchaseOrder?.contract_company_id
          ? (pendingCompanyNames.get(purchaseOrder.contract_company_id) ?? "")
          : "",
        item: purchaseOrder ? purchaseOrder.contract_number : "",
        detailType: "commitments" as DetailType,
        description: line.description || "",
        status: purchaseOrder?.status || "Pending",
        detailHref: purchaseOrder?.id
          ? `/${projectIdNum}/commitments/${purchaseOrder.id}`
          : null,
        pendingCostChanges: Number(line.amount) || 0,
      });
    }

    // 6. Fetch Commitment Change Orders (approved)
    const { data: commitmentCOs, error: commitmentCOsError } = await supabase
      .from("commitment_change_order_lines")
      .select(
        `
        id,
        amount,
        description,
        cost_code_id,
        commitment_change_orders!inner (
          id,
          status,
          change_order_number,
          commitments!inner (
            commitment_number,
            project_id,
            vendors (
              name
            )
          )
        ),
        cost_codes (
          id,
          title
        )
      `,
      )
      .eq("commitment_change_orders.status", "approved")
      .eq("commitment_change_orders.commitments.project_id", projectIdNum);

    if (!commitmentCOsError && commitmentCOs) {
      commitmentCOs.forEach((co) => {
        const costCode = co.cost_codes as unknown as CostCodeRef | null;
        const changeOrder = co.commitment_change_orders as unknown as {
          id: string;
          status: string;
          change_order_number: string;
          commitments: {
            commitment_number: string;
            vendors: { name: string } | null;
          };
        };

        details.push({
          id: `commitment-co-${co.id}`,
          budgetCode: co.cost_code_id || costCode?.id || "",
          budgetCodeDescription: costCode?.title || "",
          vendor: changeOrder?.commitments?.vendors?.name || "",
          item: `CO ${changeOrder?.change_order_number || ""}`,
          detailType: "commitment_change_orders" as DetailType,
          description: co.description || "",
          status: changeOrder?.status || "Approved",
          detailHref: changeOrder?.id
            ? `/${projectIdNum}/change-orders/commitment/${changeOrder.id}`
            : null,
          approvedCOs: Number(co.amount) || 0,
        });
      });
    }

    // 7. Fetch Change Events
    const { data: changeEventLines, error: changeEventsError } = await supabase
      .from("change_event_line_items")
      .select(
        `
        id,
        description,
        budget_code_id,
        change_events!inner (
          id,
          number,
          title,
          project_id
        )
      `,
      )
      .eq("change_events.project_id", projectIdNum);

    if (!changeEventsError && changeEventLines) {
      changeEventLines.forEach((line) => {
        const event = line.change_events as
          | {
              id: string;
              number: string;
              title: string;
            }
          | null;

        details.push({
          id: `change-event-${line.id}`,
          budgetCode: line.budget_code_id || "",
          budgetCodeDescription: "",
          item: event ? `${event.number} - ${event.title}` : "",
          detailType: "change_events" as DetailType,
          description: line.description || "",
          status: "Open",
          detailHref: event?.id
            ? `/${projectIdNum}/change-events/${event.id}`
            : null,
        });
      });
    }

    // 8. Fetch Direct Costs (approved)
    const { data: directCostLineItems, error: directCostsError } =
      await supabase
        .from("direct_cost_line_items")
        .select(
          `
        id,
        budget_code_id,
        line_total,
        quantity,
        unit_cost,
        description,
        direct_costs!inner (
          id,
          cost_type,
          status,
          project_id,
          vendor_id,
          invoice_number,
          date,
          vendors (
            name
          )
        )
      `,
        )
        .eq("direct_costs.project_id", projectIdNum)
        .in("direct_costs.status", APPROVED_DIRECT_COST_STATUSES);

    if (!directCostsError && directCostLineItems) {
      directCostLineItems.forEach((line) => {
        const directCost = line.direct_costs as unknown as
          | {
              vendor_id: string | null;
              vendors: { name: string } | null;
              invoice_number: string | null;
              date: string | null;
              id: string;
              status: string | null;
            }
          | null;

        const amount =
          (line.line_total as number | null) ??
          ((line.quantity as number | null) || 0) *
            ((line.unit_cost as number | null) || 0);

        details.push({
          id: `direct-cost-${line.id}`,
          budgetCode: line.budget_code_id || "",
          budgetCodeDescription: "",
          vendor: directCost?.vendors?.name || directCost?.vendor_id || "",
          item: directCost?.invoice_number || "",
          detailType: "direct_costs" as DetailType,
          description: line.description || "",
          status: directCost?.status || "",
          detailHref: directCost?.id
            ? `/${projectIdNum}/direct-costs/${directCost.id}`
            : null,
          directCosts: Number(amount) || 0,
        });
      });
    }

    // Calculate Forecast to Complete for each budget line
    // Forecast to Complete = Revised Budget - (Committed Costs + Direct Costs)
    const budgetLineMap = new Map<
      string,
      {
        revisedBudget: number;
        pendingBudgetChanges: number;
        committedCosts: number;
        directCosts: number;
        projectedBudget: number;
      }
    >();

    details.forEach((detail) => {
      if (!budgetLineMap.has(detail.budgetCode)) {
        budgetLineMap.set(detail.budgetCode, {
          revisedBudget: 0,
          pendingBudgetChanges: 0,
          committedCosts: 0,
          directCosts: 0,
          projectedBudget: 0,
        });
      }

      const summary = budgetLineMap.get(detail.budgetCode)!;

      if (detail.detailType === "original_budget") {
        summary.revisedBudget += detail.originalBudgetAmount || 0;
      }
      if (detail.detailType === "budget_changes") {
        summary.revisedBudget += detail.budgetChanges || 0;
        summary.pendingBudgetChanges += detail.pendingBudgetChanges || 0;
      }
      if (detail.detailType === "prime_contract_change_orders") {
        summary.revisedBudget += detail.approvedCOs || 0;
      }
      if (detail.detailType === "commitments") {
        summary.committedCosts += detail.committedCosts || 0;
      }
      if (detail.detailType === "direct_costs") {
        summary.directCosts += detail.directCosts || 0;
      }
    });

    // Add Forecast to Complete rows
    budgetLineMap.forEach((summary, budgetCode) => {
      summary.projectedBudget =
        summary.revisedBudget + summary.pendingBudgetChanges;
      const forecastToComplete =
        summary.projectedBudget -
        (summary.committedCosts + summary.directCosts);

      details.push({
        id: `forecast-${budgetCode}`,
        budgetCode,
        budgetCodeDescription: "Forecast",
        item: "Calculated forecast",
        detailType: "forecast_to_complete" as DetailType,
        status: "Calculated",
        forecastToComplete,
      });
    });

    return NextResponse.json({
      details,
      count: details.length,
    });
    },
);
