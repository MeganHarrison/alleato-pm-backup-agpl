import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { createChangeOrderSchema } from "./validation";
import { requirePermission } from "@/lib/permissions-guard";
import type { Database } from "@/types/database.types";

interface RouteParams {
  params: Promise<{ projectId: string; contractId: string }>;
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

/**
 * GET /api/projects/[projectId]/contracts/[contractId]/change-orders
 * Legacy compatibility route for the prime contract detail page.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/change-orders#GET",
  async ({ request, params }) => {
    const { projectId, contractId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts/[contractId]/change-orders#GET",
        message: "Authentication required.",
      });
    }
    const numericProjectId = Number(projectId);

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
      .eq("project_id", numericProjectId)
      .or(`prime_contract_id.eq.${contractId},contract_id.eq.${contractId}`)
      .order("created_at", { ascending: true });

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json((data ?? []).map((row) => mapPrimeContractChangeOrder(row, contractId)));
  },
);

/**
 * POST /api/projects/[projectId]/contracts/[contractId]/change-orders
 * Legacy compatibility route that now writes to prime_contract_change_orders.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/change-orders#POST",
  async ({ request, params }) => {
    const { projectId, contractId } = await params;
    const numericProjectId = Number(projectId);
    const guard = await requirePermission(numericProjectId, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json();
    const validatedData = createChangeOrderSchema.parse({
      ...body,
      contract_id: contractId,
    });

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts/[contractId]/change-orders#POST",
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

    const { data: duplicate } = await supabase
      .from("prime_contract_change_orders")
      .select("id")
      .eq("project_id", numericProjectId)
      .or(`prime_contract_id.eq.${contractId},contract_id.eq.${contractId}`)
      .eq("pcco_number", validatedData.change_order_number)
      .maybeSingle();

    if (duplicate) {
      return NextResponse.json(
        { error: "Change order number already exists for this contract" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("prime_contract_change_orders")
      .insert({
        project_id: numericProjectId,
        contract_id: contractId,
        prime_contract_id: contractId,
        pcco_number: validatedData.change_order_number,
        title: body.title ?? validatedData.description,
        description: validatedData.description,
        total_amount: validatedData.amount,
        status: validatedData.status,
        submitted_at: validatedData.requested_date ?? new Date().toISOString(),
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(mapPrimeContractChangeOrder(data, contractId), { status: 201 });
  },
);
