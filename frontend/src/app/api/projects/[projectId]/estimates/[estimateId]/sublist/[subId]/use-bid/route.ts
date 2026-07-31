import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "projects/[projectId]/estimates/[estimateId]/sublist/[subId]/use-bid#POST";

/**
 * POST /api/projects/[projectId]/estimates/[estimateId]/sublist/[subId]/use-bid
 *
 * Flows an awarded sub's bid price into the estimate as a detail item.
 * Creates or updates a "Trade Contractor" line item for the sub's division,
 * recording the sub name and awarded bid amount.
 *
 * This is idempotent: if a bid-sourced item already exists for this sub,
 * it updates it instead of creating a duplicate.
 */
export const POST = withApiGuardrails<{
  projectId: string;
  estimateId: string;
  subId: string;
}>(WHERE, async ({ params }) => {
  const { projectId, estimateId, subId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  const projectIdNum = parseInt(projectId, 10);
  const estimateIdNum = parseInt(estimateId, 10);
  const subIdNum = parseInt(subId, 10);
  if (isNaN(projectIdNum) || isNaN(estimateIdNum) || isNaN(subIdNum)) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Invalid IDs." });
  }

  // Load sub
  const { data: sub, error: subError } = await supabase
    .from("estimate_sublist_subs")
    .select("*, estimates!inner(estimate_id, project_id, is_deleted)")
    .eq("id", subIdNum)
    .eq("estimate_id", estimateIdNum)
    .eq("estimates.project_id", projectIdNum)
    .eq("estimates.is_deleted", false)
    .maybeSingle();

  if (subError || !sub) {
    throw new GuardrailError({ code: "NOT_FOUND", where: WHERE, message: "Sub not found in this estimate." });
  }

  if (!sub.price || sub.price <= 0) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Sub has no bid price. Enter a price before flowing into the estimate.",
    });
  }

  const divisionName = sub.division_name ?? sub.division_code ?? "";
  const companyLabel = sub.company ?? "Trade Contractor";
  const itemDescription = `Trade Contractor — ${companyLabel}`;

  // Look for an existing bid-sourced item for this sub
  const { data: existing } = await supabase
    .from("estimate_detail_items")
    .select("id")
    .eq("estimate_id", estimateIdNum)
    .eq("division_code", sub.division_code)
    .eq("sub_name", sub.company ?? "")
    .maybeSingle();

  let result;

  if (existing?.id) {
    // Update in-place
    const { data, error } = await supabase
      .from("estimate_detail_items")
      .update({
        estimated_amount: sub.price,
        work_description: itemDescription,
        sub_name: companyLabel,
        cost_code_name: itemDescription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: error.message, details: error });
    }
    result = { action: "updated", item: data };
  } else {
    // Insert new bid-sourced line item
    const { data: maxSortRow } = await supabase
      .from("estimate_detail_items")
      .select("sort_order")
      .eq("estimate_id", estimateIdNum)
      .eq("division_code", sub.division_code)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sortOrder = (maxSortRow?.sort_order ?? 0) + 10;

    const { data, error } = await supabase
      .from("estimate_detail_items")
      .insert({
        estimate_id: estimateIdNum,
        division_code: sub.division_code,
        division_name: divisionName,
        cost_code: null,
        cost_code_name: itemDescription,
        cost_type: "Subcontract",
        sub_name: companyLabel,
        estimated_amount: sub.price,
        work_description: itemDescription,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: error.message, details: error });
    }
    result = { action: "created", item: data };
  }

  return NextResponse.json({
    success: true,
    ...result,
    division_code: sub.division_code,
    amount: sub.price,
    company: companyLabel,
  });
});
