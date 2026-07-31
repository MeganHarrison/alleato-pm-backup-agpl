import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse, classifyError } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { updateContractSchema } from "../validation";
import { ZodError } from "zod";
import { requirePermission } from "@/lib/permissions-guard";
import { logger } from "@/lib/logger";
import { getCurrentUser, getIsAdmin } from "@/lib/auth/current-user";
import {
  fetchLivePrimeContractChangeTotals,
  mergePrimeContractFinancials,
} from "@/lib/prime-contracts/live-change-order-totals";

interface RouteParams {
  params: Promise<{ projectId: string; contractId: string }>;
}

/**
 * GET /api/projects/[id]/contracts/[contractId]
 * Returns a single prime contract by ID with calculated financial data
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]#GET",
  async ({ request, params }) => {

    const { projectId, contractId } = await params;
    const supabase = await createClient();

    // Fetch contract and financial summary in parallel.
    // contract_company is now included in the initial join (fixes N+1).
    // prime_contract_financial_summary view handles all aggregation in Postgres
    // (eliminates 3 extra round-trips + JS aggregation).
    const [contractResult, financialResult] = await Promise.all([
      supabase
        .from("prime_contracts")
        .select(
          `
          *,
          vendor:companies!prime_contracts_vendor_id_fkey(id, name, contact_name, contact_email, contact_phone),
          client:companies!prime_contracts_client_company_id_fkey(id, name),
          contractor:companies!prime_contracts_contractor_id_fkey(id, name),
          architect_engineer:companies!prime_contracts_architect_engineer_id_fkey(id, name),
          contract_company:companies!prime_contracts_contract_company_id_fkey(id, name)
        `,
        )
        .eq("id", contractId)
        .single(),
      supabase
        .from("prime_contract_financial_summary")
        .select("approved_change_orders, pending_change_orders, draft_change_orders, revised_contract_amount, pending_revised_contract_amount, invoiced_amount, payments_received, remaining_balance, percent_paid")
        .eq("contract_id", contractId)
        .single(),
    ]);

    if (contractResult.error) {
      if (contractResult.error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Contract not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch contract", details: contractResult.error.message },
        { status: 400 },
      );
    }

    const contract = contractResult.data;

    // Privacy gate: if contract is private, only admins and users in allowed_user_ids may view it
    if (contract.is_private) {
      const [user, isAdmin] = await Promise.all([getCurrentUser(), getIsAdmin()]);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const allowedIds: string[] = (contract as { allowed_user_ids?: string[] }).allowed_user_ids ?? [];
      const isAllowed = isAdmin || allowedIds.includes(user.id);
      if (!isAllowed) {
        return NextResponse.json({ error: "Contract not found" }, { status: 404 });
      }
    }

    // Financial summary may not exist yet for brand-new contracts with no COs/payments
    const fin = financialResult.data ?? {
      approved_change_orders: 0,
      pending_change_orders: 0,
      draft_change_orders: 0,
      revised_contract_amount: contract.original_contract_value ?? 0,
      pending_revised_contract_amount: contract.original_contract_value ?? 0,
      invoiced_amount: 0,
      payments_received: 0,
      remaining_balance: contract.original_contract_value ?? 0,
      percent_paid: 0,
    };
    let liveTotals;
    try {
      liveTotals = (await fetchLivePrimeContractChangeTotals(
        supabase,
        parseInt(projectId, 10),
        [contractId],
      )).get(contractId);
    } catch (error) {
      return apiErrorResponse(error);
    }
    const financials = mergePrimeContractFinancials(
      contract.original_contract_value ?? 0,
      fin,
      liveTotals,
    );

    return NextResponse.json({
      ...contract,
      approved_change_orders: financials.approved_change_orders,
      pending_change_orders: financials.pending_change_orders,
      draft_change_orders: financials.draft_change_orders,
      pending_revised_contract_amount: financials.pending_revised_contract_value,
      revised_contract_value: financials.revised_contract_value,
      invoiced_amount: fin.invoiced_amount,
      payments_received: fin.payments_received,
      remaining_balance: fin.remaining_balance ?? financials.revised_contract_value,
      percent_paid: fin.percent_paid,
    });
    },
);

/**
 * PUT /api/projects/[id]/contracts/[contractId]
 * Updates a prime contract
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]#PUT",
  async ({ request, params }) => {
  
    const { projectId, contractId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json();

    // Validate request body
    const validatedData = updateContractSchema.parse(body);

    // Get current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/contracts/[contractId]#PUT", message: "Authentication required." });
    }

    // Check if contract exists and belongs to this project
    const { data: existingContract } = await supabase
      .from("prime_contracts")
      .select("id, contract_number, original_contract_value")
      .eq("id", contractId)
      .eq("project_id", parseInt(projectId, 10))
      .maybeSingle();

    if (!existingContract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    // Business rule: approved contracts must have a non-zero contract value.
    // The stored original_contract_value can be stale or 0 for imported/migrated
    // contracts whose displayed total is computed live from line items, so fall
    // back to the actual SOV line-item total before blocking — and heal the
    // stored column when we do, so it stops lying.
    if (validatedData.status === "approved") {
      let effectiveValue = validatedData.original_contract_value !== undefined
        ? validatedData.original_contract_value
        : Number(existingContract.original_contract_value ?? 0);
      if (effectiveValue <= 0) {
        const { data: sovLines } = await supabase
          .from("contract_line_items")
          .select("quantity, unit_cost, total_cost")
          .eq("contract_id", contractId);
        effectiveValue = (sovLines ?? []).reduce((sum, line) => {
          const qtyUnit =
            (Number(line.quantity) || 0) * (Number(line.unit_cost) || 0);
          return sum + (qtyUnit || Number(line.total_cost) || 0);
        }, 0);
        if (
          effectiveValue > 0 &&
          validatedData.original_contract_value === undefined
        ) {
          validatedData.original_contract_value = effectiveValue;
        }
      }
      if (effectiveValue <= 0) {
        return NextResponse.json(
          { error: "Cannot approve a contract with $0 contract value. Add line items with amounts before approving." },
          { status: 400 },
        );
      }
    }

    // If updating contract_number, check for uniqueness
    if (
      validatedData.contract_number &&
      validatedData.contract_number !== existingContract.contract_number
    ) {
      const { data: duplicateContract } = await supabase
        .from("prime_contracts")
        .select("id")
        .eq("project_id", parseInt(projectId, 10))
        .eq("contract_number", validatedData.contract_number)
        .neq("id", contractId)
        .maybeSingle();

      if (duplicateContract) {
        return NextResponse.json(
          { error: "Contract number already exists for this project" },
          { status: 400 },
        );
      }
    }

    // Update the contract
    const { data, error } = await supabase
      .from("prime_contracts")
      .update(validatedData)
      .eq("id", contractId)
      .eq("project_id", parseInt(projectId, 10))
      .select(
        `
        *,
        vendor:companies!prime_contracts_vendor_id_fkey(id, name, contact_name, contact_email, contact_phone)
      `,
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update contract", details: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(data);
    },
);

/**
 * DELETE /api/projects/[id]/contracts/[contractId]
 * Deletes a prime contract
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, contractId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    // Get current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/contracts/[contractId]#DELETE", message: "Authentication required." });
    }

    // Guard: SOV line items belong to the contract and are safe to cascade.
    // Financial history must fail loudly so invoices, payments, and change
    // orders are not silently destroyed by a broad delete.
    const [
      changeOrdersResult,
      paymentApplicationsResult,
      paymentsResult,
      ownerInvoicesResult,
    ] = await Promise.all([
      supabase
        .from("prime_contract_change_orders")
        .select("id", { count: "exact", head: true })
        .or(`contract_id.eq.${contractId},prime_contract_id.eq.${contractId}`),
      supabase
        .from("prime_contract_payment_applications")
        .select("id", { count: "exact", head: true })
        .eq("contract_id", contractId),
      supabase
        .from("prime_contract_payments")
        .select("id", { count: "exact", head: true })
        .eq("contract_id", contractId),
      supabase
        .from("owner_invoices")
        .select("id", { count: "exact", head: true })
        .eq("prime_contract_id", contractId),
    ]);

    const blockerQueryError =
      changeOrdersResult.error ??
      paymentApplicationsResult.error ??
      paymentsResult.error ??
      ownerInvoicesResult.error;

    if (blockerQueryError) {
      return NextResponse.json(
        {
          error: "Failed to verify contract delete dependencies",
          details: blockerQueryError.message,
        },
        { status: 400 },
      );
    }

    const blockerCounts = {
      changeOrders: changeOrdersResult.count ?? 0,
      paymentApplications: paymentApplicationsResult.count ?? 0,
      payments: paymentsResult.count ?? 0,
      ownerInvoices: ownerInvoicesResult.count ?? 0,
    };
    const totalBlockers = Object.values(blockerCounts).reduce(
      (sum, count) => sum + count,
      0,
    );

    if (totalBlockers > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete contract because it has financial history. Remove or void related change orders, payment applications, payments, and owner invoices first.",
          details: {
            code: "PRIME_CONTRACT_HAS_FINANCIAL_HISTORY",
            blockerCounts,
          },
        },
        { status: 409 },
      );
    }

    // Delete directly — cascade FKs handle child cleanup automatically.
    // Skipping the pre-check eliminates a race condition and a round-trip;
    // "0 rows affected" is treated the same as a 404 (contract not found).
    const { error, count } = await supabase
      .from("prime_contracts")
      .delete({ count: "exact" })
      .eq("id", contractId)
      .eq("project_id", parseInt(projectId, 10));

    if (!error && count === 0) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    if (error) {
      logger.error({ msg: "[DELETE /contracts/:id] Supabase error:", error: error instanceof Error ? error.message : String(error) });
      const classified = classifyError(error);
      return NextResponse.json(
        { error: classified.message },
        { status: classified.status },
      );
    }

    return NextResponse.json(
      { message: "Contract deleted successfully" },
      { status: 200 },
    );
    },
);
