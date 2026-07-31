import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "projects/[projectId]/estimates/[estimateId]/scope-items/seed#POST";

/**
 * POST /api/projects/[projectId]/estimates/[estimateId]/scope-items/seed
 *
 * Seeds scope items for a division from the estimate's existing detail items.
 * Each detail item (cost_code_name or work_description) becomes a scope checklist item.
 * Items that already exist (by description) are skipped — idempotent.
 *
 * Body: { division_code: string }
 */
export const POST = withApiGuardrails<{
  projectId: string;
  estimateId: string;
}>(WHERE, async ({ request, params }) => {
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

  const body = await request.json().catch(() => ({})) as { division_code?: string };
  if (!body.division_code) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "division_code is required." });
  }

  // Load estimate detail items for this division
  const { data: detailItems, error: detailError } = await supabase
    .from("estimate_detail_items")
    .select("cost_code_name, work_description, cost_code, cost_type")
    .eq("estimate_id", estimateIdNum)
    .eq("division_code", body.division_code)
    .not("cost_code", "is", null)
    .order("sort_order", { ascending: true });

  if (detailError) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: detailError.message });
  }

  if (!detailItems || detailItems.length === 0) {
    return NextResponse.json({
      seeded: 0,
      skipped: 0,
      message: "No detail items found for this division in the estimate.",
    });
  }

  // Load existing scope items to avoid duplicates
  const { data: existingItems } = await supabase
    .from("estimate_sublist_scope_items")
    .select("description")
    .eq("estimate_id", estimateIdNum)
    .eq("division_code", body.division_code);

  const existingDescriptions = new Set(
    (existingItems ?? []).map((item) => item.description.toLowerCase().trim())
  );

  // Build candidates from detail items
  const candidates = detailItems
    .map((item) => (item.cost_code_name ?? item.work_description ?? "").trim())
    .filter((desc) => desc.length > 0)
    .filter((desc) => !existingDescriptions.has(desc.toLowerCase()));

  // Deduplicate within the candidate list
  const uniqueCandidates = [...new Set(candidates)];

  if (uniqueCandidates.length === 0) {
    return NextResponse.json({
      seeded: 0,
      skipped: detailItems.length,
      message: "All detail items already exist as scope items.",
    });
  }

  const toInsert = uniqueCandidates.map((desc, idx) => ({
    estimate_id: estimateIdNum,
    division_code: body.division_code!,
    description: desc,
    source: "estimate_line_item" as const,
    sort_order: (existingItems?.length ?? 0) + idx,
    is_checked: true,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("estimate_sublist_scope_items")
    .insert(toInsert)
    .select();

  if (insertError) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: insertError.message, details: insertError });
  }

  return NextResponse.json({
    seeded: inserted?.length ?? 0,
    skipped: detailItems.length - uniqueCandidates.length,
    items: inserted ?? [],
  });
});
