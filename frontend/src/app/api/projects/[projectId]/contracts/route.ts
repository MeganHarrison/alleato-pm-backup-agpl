import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createContractRequestSchema } from "./validation";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import { logger } from "@/lib/logger";
import { getCurrentUser, getIsAdmin } from "@/lib/auth/current-user";
import {
  fetchLivePrimeContractChangeTotals,
  type LivePrimeContractChangeTotals,
  mergePrimeContractFinancials,
} from "@/lib/prime-contracts/live-change-order-totals";
import {
  createPrimeContract,
  createSupabasePrimeContractCreationStore,
  PrimeContractCreationError,
} from "@/lib/prime-contracts/create-prime-contract";

const WHERE = "projects/[projectId]/contracts#POST";

/**
 * GET /api/projects/[id]/contracts
 * Returns all prime contracts for a specific project with calculated financial data
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/contracts#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts#GET",
        message: "Authentication required.",
      });
    }
    const { searchParams } = new URL(request.url);

    const projectIdNum = parseInt(projectId, 10);

    // Optional filters
    const status = searchParams.get("status");
    const erpStatus = searchParams.get("erp_status");
    const search = searchParams.get("search");

    const CONTRACT_STATUSES = [
      "draft",
      "out_for_signature",
      "approved",
      "complete",
      "terminated",
    ] as const;
    type ContractStatus = (typeof CONTRACT_STATUSES)[number];

    const ERP_STATUSES = ["unsynced", "synced", "error"] as const;
    type ErpStatus = (typeof ERP_STATUSES)[number];

    // Build contract query with optional filters
    let contractQuery = supabase
      .from("prime_contracts")
      .select(
        `
        *,
        vendor:companies!prime_contracts_contractor_id_fkey(id, name),
        client:companies!prime_contracts_client_company_id_fkey(id, name),
        contract_company:companies!prime_contracts_contract_company_id_fkey(id, name)
      `,
      )
      .eq("project_id", projectIdNum)
      .order("created_at", { ascending: false });

    if (status) {
      if (!(CONTRACT_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json(
          {
            error: `Invalid status "${status}". Expected one of: ${CONTRACT_STATUSES.join(", ")}.`,
          },
          { status: 400 },
        );
      }
      contractQuery = contractQuery.eq("status", status as ContractStatus);
    }

    if (erpStatus) {
      if (!(ERP_STATUSES as readonly string[]).includes(erpStatus)) {
        return NextResponse.json(
          {
            error: `Invalid erp_status "${erpStatus}". Expected one of: ${ERP_STATUSES.join(", ")}.`,
          },
          { status: 400 },
        );
      }
      contractQuery = contractQuery.eq("erp_status", erpStatus as ErpStatus);
    }

    if (search) {
      // Use OR with ilike — GIN trigram indexes (idx_prime_contracts_contract_number_trgm
      // and idx_prime_contracts_title_trgm) make %term% patterns index-scannable.
      contractQuery = contractQuery.or(
        `contract_number.ilike.%${search}%,title.ilike.%${search}%,description.ilike.%${search}%`,
      );
    }

    // Fetch contracts, financial summaries, and attachment counts in parallel.
    const [contractsResult, financialResult, attachmentCountsResult] = await Promise.all([
      contractQuery,
      supabase
        .from("prime_contract_financial_summary")
        .select("contract_id, approved_change_orders, pending_change_orders, draft_change_orders, revised_contract_amount, invoiced_amount, payments_received, remaining_balance, percent_paid")
        .eq("project_id", projectIdNum),
      supabase
        .from("prime_contract_documents")
        .select("prime_contract_id"),
    ]);

    if (contractsResult.error) {
      return apiErrorResponse(contractsResult.error);
    }

    // Build lookup maps for O(1) merge
    const financialByContractId = new Map(
      (financialResult.data ?? []).map((f) => [f.contract_id, f]),
    );
    const attachmentCountByContractId = new Map<string, number>();
    for (const att of attachmentCountsResult.data ?? []) {
      const id = att.prime_contract_id as string;
      attachmentCountByContractId.set(id, (attachmentCountByContractId.get(id) ?? 0) + 1);
    }

    // Privacy filter: remove private contracts the current user is not allowed to see
    const [currentUser, currentUserIsAdmin] = await Promise.all([
      getCurrentUser(),
      getIsAdmin(),
    ]);
    const currentUserId = currentUser?.id ?? "";

    const visibleContracts = (contractsResult.data ?? []).filter((contract) => {
      if (!contract.is_private) return true;
      if (currentUserIsAdmin) return true;
      const allowedIds: string[] = (contract as { allowed_user_ids?: string[] }).allowed_user_ids ?? [];
      return allowedIds.includes(currentUserId);
    });

    let liveChangeTotalsByContractId = new Map<string, LivePrimeContractChangeTotals>();
    try {
      liveChangeTotalsByContractId = await fetchLivePrimeContractChangeTotals(
        supabase,
        projectIdNum,
        visibleContracts.map((contract) => contract.id),
      );
    } catch (error) {
      return apiErrorResponse(error);
    }

    const enrichedContracts = visibleContracts.map((contract) => {
      const fin = financialByContractId.get(contract.id);
      const originalValue = contract.original_contract_value ?? 0;
      const financials = mergePrimeContractFinancials(
        originalValue,
        fin,
        liveChangeTotalsByContractId.get(contract.id),
      );
      // Use contract_company as fallback when client_id is not set
      const clientData = (contract as Record<string, unknown>).client
        ?? (contract as Record<string, unknown>).contract_company
        ?? null;
      return {
        ...contract,
        client: clientData,
        approved_change_orders: financials.approved_change_orders,
        pending_change_orders: financials.pending_change_orders,
        draft_change_orders: financials.draft_change_orders,
        revised_contract_value: financials.revised_contract_value,
        invoiced_amount: fin?.invoiced_amount ?? 0,
        payments_received: fin?.payments_received ?? 0,
        remaining_balance: fin?.remaining_balance ?? financials.revised_contract_value,
        percent_paid: fin?.percent_paid ?? 0,
        attachment_count: attachmentCountByContractId.get(contract.id) ?? 0,
      };
    });

    return NextResponse.json(enrichedContracts);
    },
);

/**
 * POST /api/projects/[id]/contracts
 * Creates a new prime contract for a specific project
 */
export const POST = withApiGuardrails<{ projectId: string }>(
  WHERE,
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json().catch(() => {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: WHERE,
        message: "Malformed prime contract payload.",
      });
    });

    // Validate request body
    const parsed = createContractRequestSchema.safeParse({
      ...body,
      project_id: projectIdNum,
    });
    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: WHERE,
        message: "Invalid prime contract payload.",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    const { line_items: lineItems, ...validatedData } = parsed.data;

    // Get current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
    }

    try {
      const result = await createPrimeContract({
        store: createSupabasePrimeContractCreationStore(supabase),
        userId: user.id,
        contract: validatedData,
        lineItems,
      });

      if (result.receipt.status === "partial") {
        logger.warn({
          msg: "[POST /contracts] Prime contract created with partial SOV",
          projectId: projectIdNum,
          contractId: result.contract.id,
          failures: result.receipt.lineItems.failed,
        });
      }

      return NextResponse.json(
        {
          ...result.contract,
          creation_receipt: result.receipt,
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof PrimeContractCreationError) {
        const status =
          error.code === "DUPLICATE_CONTRACT_NUMBER"
            ? 409
            : error.code === "CONTRACT_INSERT_FAILED" ||
                error.code === "PRIME_CONTRACT_LOOKUP_FAILED"
              ? 500
              : 400;
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status },
        );
      }

      logger.error({
        msg: "[POST /contracts] Unexpected creation failure",
        error: error instanceof Error ? error.message : String(error),
      });
      return apiErrorResponse(error);
    }
    },
);
