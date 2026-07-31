import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { z } from "zod";

const WHERE = "projects/[projectId]/estimates/[estimateId]/sublist/[subId]/bid-items/[bidItemId]";
type Params = { projectId: string; estimateId: string; subId: string; bidItemId: string };
const bidItemUpdateSchema = z.object({
  description: z.string().trim().min(1).max(300).optional(),
  amount: z.number().finite().min(0).optional(),
  scope_item_id: z.number().int().positive().nullable().optional(),
  is_excluded: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();

async function parseAndVerifyParams(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  estimateId: string,
  subId: string,
  bidItemId: string,
): Promise<{ estimateIdNum: number; subIdNum: number; bidItemIdNum: number }> {
  const projectIdNum = parseInt(projectId, 10);
  const estimateIdNum = parseInt(estimateId, 10);
  const subIdNum = parseInt(subId, 10);
  const bidItemIdNum = parseInt(bidItemId, 10);
  if (isNaN(projectIdNum) || isNaN(subIdNum) || isNaN(estimateIdNum) || isNaN(bidItemIdNum)) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Invalid ID." });
  }

  const { data, error } = await supabase
    .from("estimate_sublist_subs")
    .select("id, estimates!inner(estimate_id, project_id, is_deleted)")
    .eq("id", subIdNum)
    .eq("estimate_id", estimateIdNum)
    .eq("estimates.project_id", projectIdNum)
    .eq("estimates.is_deleted", false)
    .maybeSingle();

  if (error) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: error.message, cause: error });
  }
  if (!data) {
    throw new GuardrailError({ code: "NOT_FOUND", where: WHERE, message: "Bid line item not found for this project estimate." });
  }

  return { estimateIdNum, subIdNum, bidItemIdNum };
}

/**
 * PATCH /api/projects/[projectId]/estimates/[estimateId]/sublist/[subId]/bid-items/[bidItemId]
 * Updates a bid line item.
 */
export const PATCH = withApiGuardrails<Params>(WHERE + "#PATCH", async ({ request, params }) => {
  const { projectId, estimateId, subId, bidItemId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  const { estimateIdNum, subIdNum, bidItemIdNum } = await parseAndVerifyParams(supabase, projectId, estimateId, subId, bidItemId);
  const parsed = bidItemUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Invalid bid line item update payload.",
      details: parsed.error.flatten(),
    });
  }

  const { data, error } = await supabase
    .from("estimate_sublist_bid_items")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", bidItemIdNum)
    .eq("sub_id", subIdNum)
    .select()
    .single();

  if (error) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: error.message, details: error });
  }

  // Recalculate price on the sub
  const { data: allItems } = await supabase
    .from("estimate_sublist_bid_items")
    .select("amount, is_excluded")
    .eq("sub_id", subIdNum);

  if (allItems) {
    const total = allItems.filter((i) => !i.is_excluded).reduce((sum, i) => sum + Number(i.amount), 0);
    await supabase
      .from("estimate_sublist_subs")
      .update({ price: total })
      .eq("id", subIdNum)
      .eq("estimate_id", estimateIdNum);
  }

  return NextResponse.json(data);
});

/**
 * DELETE /api/projects/[projectId]/estimates/[estimateId]/sublist/[subId]/bid-items/[bidItemId]
 */
export const DELETE = withApiGuardrails<Params>(WHERE + "#DELETE", async ({ params }) => {
  const { projectId, estimateId, subId, bidItemId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  const { estimateIdNum, subIdNum, bidItemIdNum } = await parseAndVerifyParams(supabase, projectId, estimateId, subId, bidItemId);

  const { error } = await supabase
    .from("estimate_sublist_bid_items")
    .delete()
    .eq("id", bidItemIdNum)
    .eq("sub_id", subIdNum);

  if (error) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: error.message, details: error });
  }

  // Recalculate price on the sub
  const { data: allItems } = await supabase
    .from("estimate_sublist_bid_items")
    .select("amount, is_excluded")
    .eq("sub_id", subIdNum);

  if (allItems !== null) {
    const total = allItems.filter((i) => !i.is_excluded).reduce((sum, i) => sum + Number(i.amount), 0);
    await supabase
      .from("estimate_sublist_subs")
      .update({ price: total })
      .eq("id", subIdNum)
      .eq("estimate_id", estimateIdNum);
  }

  return new Response(null, { status: 204 });
});
