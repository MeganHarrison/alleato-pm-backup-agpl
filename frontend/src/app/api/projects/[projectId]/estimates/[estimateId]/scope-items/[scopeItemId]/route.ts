import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "projects/[projectId]/estimates/[estimateId]/scope-items/[scopeItemId]";
type Params = { projectId: string; estimateId: string; scopeItemId: string };

/**
 * PATCH /api/projects/[projectId]/estimates/[estimateId]/scope-items/[scopeItemId]
 * Updates a scope item (description, notes, is_checked, sort_order).
 */
export const PATCH = withApiGuardrails<Params>(WHERE + "#PATCH", async ({ request, params }) => {
  const { estimateId, scopeItemId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  const estimateIdNum = parseInt(estimateId, 10);
  const scopeItemIdNum = parseInt(scopeItemId, 10);
  if (isNaN(estimateIdNum) || isNaN(scopeItemIdNum)) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Invalid scope item ID." });
  }

  const body = await request.json().catch(() => ({}));

  const { data, error } = await supabase
    .from("estimate_sublist_scope_items")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", scopeItemIdNum)
    .eq("estimate_id", estimateIdNum)
    .select()
    .single();

  if (error) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: error.message, details: error });
  }

  return NextResponse.json(data);
});

/**
 * DELETE /api/projects/[projectId]/estimates/[estimateId]/scope-items/[scopeItemId]
 */
export const DELETE = withApiGuardrails<Params>(WHERE + "#DELETE", async ({ params }) => {
  const { estimateId, scopeItemId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  const estimateIdNum = parseInt(estimateId, 10);
  const scopeItemIdNum = parseInt(scopeItemId, 10);
  if (isNaN(estimateIdNum) || isNaN(scopeItemIdNum)) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Invalid scope item ID." });
  }

  const { error } = await supabase
    .from("estimate_sublist_scope_items")
    .delete()
    .eq("id", scopeItemIdNum)
    .eq("estimate_id", estimateIdNum);

  if (error) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: error.message, details: error });
  }

  return new Response(null, { status: 204 });
});
