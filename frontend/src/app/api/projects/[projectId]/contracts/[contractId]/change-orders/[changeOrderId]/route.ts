import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { updateChangeOrderSchema } from "../validation";
import { requirePermission } from "@/lib/permissions-guard";
import {
  canDeletePrimeContractChangeOrderStatus,
  primeContractChangeOrderDeleteBlockedMessage,
} from "@/lib/change-orders/prime-contract-change-order-statuses";
import type { Database } from "@/types/database.types";

interface RouteParams {
  params: Promise<{ projectId: string; contractId: string; changeOrderId: string }>;
}

type PrimeContractChangeOrderRow =
  Database["public"]["Tables"]["prime_contract_change_orders"]["Row"];

// Maps the revenue-side PCCO row into the legacy contract page response shape.
function mapPrimeContractChangeOrder(
  row: PrimeContractChangeOrderRow,
  contractId: string,
) {
  const requestedDate =
    row.submitted_at ??
    row.created_at ??
    row.review_date ??
    row.approved_at ??
    new Date().toISOString();

  const updatedAt =
    row.review_date ??
    row.approved_at ??
    row.submitted_at ??
    row.created_at ??
    new Date().toISOString();

  return {
    id: String(row.id),
    contract_id: row.prime_contract_id ?? row.contract_id ?? contractId,
    change_order_number: row.pcco_number ?? "",
    description: row.description ?? "",
    title: row.title ?? null,
    amount: Number(row.total_amount ?? 0),
    status: (row.status ?? "pending").toLowerCase(),
    revision: row.revision ?? null,
    executed: row.executed ?? null,
    requested_by: row.created_by ?? null,
    requested_date: requestedDate,
    due_date: row.due_date ?? null,
    review_date: row.review_date ?? null,
    designated_reviewer: row.designated_reviewer ?? null,
    approved_by: null,
    approved_date: row.approved_at ?? null,
    rejection_reason: row.rejection_reason ?? null,
    created_at: row.created_at ?? requestedDate,
    updated_at: updatedAt,
  };
}

// Resolves the legacy route id into the numeric PCCO id used by the revenue-side table.
function parsePrimeChangeOrderId(changeOrderId: string): number | null {
  const numericId = Number(changeOrderId);
  return Number.isFinite(numericId) && numericId > 0 ? numericId : null;
}

/**
 * GET /api/projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]#GET",
  async ({ request, params }) => {
    const { projectId, contractId, changeOrderId } = await params;
    const numericProjectId = Number(projectId);
    const numericChangeOrderId = parsePrimeChangeOrderId(changeOrderId);

    if (!numericChangeOrderId) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    const supabase = await createClient();

    const { data: contract } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", contractId)
      .eq("project_id", numericProjectId)
      .single();

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("prime_contract_change_orders")
      .select("*")
      .eq("id", numericChangeOrderId)
      .eq("project_id", numericProjectId)
      .or(`prime_contract_id.eq.${contractId},contract_id.eq.${contractId}`)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Change order not found" }, { status: 404 });
      }
      return apiErrorResponse(error);
    }

    return NextResponse.json(mapPrimeContractChangeOrder(data, contractId));
  },
);

/**
 * PUT /api/projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]#PUT",
  async ({ request, params }) => {
    const { projectId, contractId, changeOrderId } = await params;
    const numericProjectId = Number(projectId);
    const numericChangeOrderId = parsePrimeChangeOrderId(changeOrderId);
    const guard = await requirePermission(numericProjectId, "contracts", "write");
    if (guard.denied) return guard.response;

    if (!numericChangeOrderId) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const validatedData = updateChangeOrderSchema.parse(body);

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]#PUT",
        message: "Authentication required.",
      });
    }

    const { data: contract } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", contractId)
      .eq("project_id", numericProjectId)
      .single();

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (validatedData.change_order_number) {
      const { data: duplicate } = await supabase
        .from("prime_contract_change_orders")
        .select("id")
        .eq("project_id", numericProjectId)
        .or(`prime_contract_id.eq.${contractId},contract_id.eq.${contractId}`)
        .eq("pcco_number", validatedData.change_order_number)
        .neq("id", numericChangeOrderId)
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json(
          { error: "Change order number already exists for this contract" },
          { status: 400 },
        );
      }
    }

    const updateData: Database["public"]["Tables"]["prime_contract_change_orders"]["Update"] = {
      pcco_number: validatedData.change_order_number,
      description: validatedData.description,
      title: validatedData.description,
      total_amount: validatedData.amount,
      rejection_reason: validatedData.rejection_reason,
    };

    const { data, error } = await supabase
      .from("prime_contract_change_orders")
      .update(updateData)
      .eq("id", numericChangeOrderId)
      .eq("project_id", numericProjectId)
      .or(`prime_contract_id.eq.${contractId},contract_id.eq.${contractId}`)
      .select("*")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(mapPrimeContractChangeOrder(data, contractId));
  },
);

/**
 * DELETE /api/projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]#DELETE",
  async ({ request, params }) => {
    const { projectId, contractId, changeOrderId } = await params;
    const numericProjectId = Number(projectId);
    const numericChangeOrderId = parsePrimeChangeOrderId(changeOrderId);
    const guard = await requirePermission(numericProjectId, "contracts", "admin");
    if (guard.denied) return guard.response;

    if (!numericChangeOrderId) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts/[contractId]/change-orders/[changeOrderId]#DELETE",
        message: "Authentication required.",
      });
    }

    const { data: contract } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", contractId)
      .eq("project_id", numericProjectId)
      .single();

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("prime_contract_change_orders")
      .select("id, status")
      .eq("id", numericChangeOrderId)
      .eq("project_id", numericProjectId)
      .or(`prime_contract_id.eq.${contractId},contract_id.eq.${contractId}`)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    if (!canDeletePrimeContractChangeOrderStatus(existing.status)) {
      return NextResponse.json(
        {
          error: primeContractChangeOrderDeleteBlockedMessage(existing.status),
        },
        { status: 409 },
      );
    }

    const { error } = await supabase
      .from("prime_contract_change_orders")
      .delete()
      .eq("id", numericChangeOrderId)
      .eq("project_id", numericProjectId)
      .or(`prime_contract_id.eq.${contractId},contract_id.eq.${contractId}`);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ message: "Change order deleted successfully" });
  },
);
