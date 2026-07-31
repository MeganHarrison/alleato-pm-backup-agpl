import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string; primeCoId: string }>;
}

/**
 * GET /api/projects/[projectId]/prime-contract-change-orders/[primeCoId]/line-items
 * Returns all line items for a PCCO, ordered by created_at ASC
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]/line-items#GET",
  async ({ request, params }) => {
  
    const { projectId, primeCoId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]/line-items#GET", message: "Authentication required." });
    }

    // Verify the PCCO belongs to the requested project
    const { data: pcco, error: pccoError } = await supabase
      .from("prime_contract_change_orders")
      .select("id")
      .eq("id", Number(primeCoId))
      .eq("project_id", Number(projectId))
      .single();

    if (pccoError || !pcco) {
      return NextResponse.json(
        { error: "Change order not found" },
        { status: 404 },
      );
    }

    const { data: lineItems, error } = await supabase
      .from("pcco_line_items")
      .select("*")
      .eq("pcco_id", Number(primeCoId))
      .order("created_at", { ascending: true });

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data: lineItems ?? [] });
    },
);

/**
 * POST /api/projects/[projectId]/prime-contract-change-orders/[primeCoId]/line-items
 * Create a new line item. Calculates line_amount = quantity * unit_cost.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]/line-items#POST",
  async ({ request, params }) => {
  
    const { projectId, primeCoId } = await params;

    const guard = await requirePermission(Number(projectId), "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]/line-items#POST", message: "Authentication required." });
    }

    // Verify the PCCO belongs to the requested project
    const { data: pcco, error: pccoError } = await supabase
      .from("prime_contract_change_orders")
      .select("id")
      .eq("id", Number(primeCoId))
      .eq("project_id", Number(projectId))
      .single();

    if (pccoError || !pcco) {
      return NextResponse.json(
        { error: "Change order not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { description, cost_code, quantity, uom, unit_cost } = body as {
      description?: string;
      cost_code?: string;
      quantity?: number;
      uom?: string;
      unit_cost?: number;
    };

    const qty = quantity ?? 0;
    const uc = unit_cost ?? 0;
    // NOTE: line_amount is a GENERATED ALWAYS AS column in PostgreSQL (quantity * unit_cost).
    // It must NOT be included in the INSERT — the database computes it automatically.

    const { data: lineItem, error } = await supabase
      .from("pcco_line_items")
      .insert({
        pcco_id: Number(primeCoId),
        description: description ?? null,
        cost_code: cost_code ?? null,
        quantity: qty,
        uom: uom ?? null,
        unit_cost: uc,
      })
      .select()
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data: lineItem }, { status: 201 });
    },
);
