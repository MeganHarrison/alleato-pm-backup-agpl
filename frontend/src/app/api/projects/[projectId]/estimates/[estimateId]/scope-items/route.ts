import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "projects/[projectId]/estimates/[estimateId]/scope-items";
type Params = { projectId: string; estimateId: string };

/**
 * GET /api/projects/[projectId]/estimates/[estimateId]/scope-items?division_code=XX
 * Returns scope items for the estimate (optionally filtered by division).
 */
export const GET = withApiGuardrails<Params>(WHERE + "#GET", async ({ request, params }) => {
  const { estimateId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  const estimateIdNum = parseInt(estimateId, 10);
  if (isNaN(estimateIdNum)) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Invalid estimate ID." });
  }

  const url = new URL(request.url);
  const divisionCode = url.searchParams.get("division_code");

  let query = supabase
    .from("estimate_sublist_scope_items")
    .select("*")
    .eq("estimate_id", estimateIdNum)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (divisionCode) {
    query = query.eq("division_code", divisionCode);
  }

  const { data, error } = await query;
  if (error) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: error.message, details: error });
  }

  return NextResponse.json(data ?? []);
});

/**
 * POST /api/projects/[projectId]/estimates/[estimateId]/scope-items
 * Creates a new scope item.
 * Body: { division_code, description, notes?, sort_order?, source? }
 */
export const POST = withApiGuardrails<Params>(WHERE + "#POST", async ({ request, params }) => {
  const { estimateId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  const estimateIdNum = parseInt(estimateId, 10);
  if (isNaN(estimateIdNum)) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Invalid estimate ID." });
  }

  const body = await request.json().catch(() => ({})) as {
    division_code?: string;
    description?: string;
    notes?: string;
    sort_order?: number;
    source?: string;
    is_checked?: boolean;
  };

  if (!body.division_code || !body.description?.trim()) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "division_code and description are required.",
    });
  }

  const { data, error } = await supabase
    .from("estimate_sublist_scope_items")
    .insert({
      estimate_id: estimateIdNum,
      division_code: body.division_code,
      description: body.description.trim(),
      notes: body.notes?.trim() || null,
      sort_order: body.sort_order ?? 0,
      source: (body.source === "estimate_line_item" ? "estimate_line_item" : "manual") as "estimate_line_item" | "manual",
      is_checked: body.is_checked ?? true,
    })
    .select()
    .single();

  if (error) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: error.message, details: error });
  }

  return NextResponse.json(data, { status: 201 });
});

/**
 * POST /api/projects/[projectId]/estimates/[estimateId]/scope-items/seed
 * Seeds scope items from the estimate's detail items for a specific division.
 * This is handled in scope-items/seed/route.ts
 */
