import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { z } from "zod";

const WHERE = "projects/[projectId]/estimates/[estimateId]/sublist/[subId]/award#POST";
const awardSchema = z.object({ revoke: z.boolean().optional() }).strict();

/**
 * POST /api/projects/[projectId]/estimates/[estimateId]/sublist/[subId]/award
 *
 * Awards a sub for their division. Atomically:
 *   1. Clears is_awarded on all other subs in the same estimate+division
 *   2. Sets is_awarded=true on the target sub
 *
 * Send an empty POST body to award, or { revoke: true } to un-award without awarding another.
 */
export const POST = withApiGuardrails<{
  projectId: string;
  estimateId: string;
  subId: string;
}>(WHERE, async ({ request, params }) => {
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
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Invalid project, estimate, or sub ID.",
    });
  }

  const parsed = awardSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Invalid award payload.",
      details: parsed.error.flatten(),
    });
  }
  const revoking = parsed.data.revoke === true;

  // Look up the target sub to get its division_code
  const { data: targetSub, error: lookupError } = await supabase
    .from("estimate_sublist_subs")
    .select("id, division_code, is_awarded, estimates!inner(estimate_id, project_id, is_deleted)")
    .eq("id", subIdNum)
    .eq("estimate_id", estimateIdNum)
    .eq("estimates.project_id", projectIdNum)
    .eq("estimates.is_deleted", false)
    .maybeSingle();

  if (lookupError || !targetSub) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE,
      message: "Sub not found in this estimate.",
    });
  }

  // Un-award all subs in this estimate+division (including the target if revoking)
  const { error: clearError } = await supabase
    .from("estimate_sublist_subs")
    .update({ is_awarded: false })
    .eq("estimate_id", estimateIdNum)
    .eq("division_code", targetSub.division_code);

  if (clearError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: WHERE,
      message: "Failed to clear previous award.",
      details: clearError.message,
    });
  }

  if (revoking) {
    return NextResponse.json({ awarded: false, division_code: targetSub.division_code });
  }

  // Award the target sub
  const { data: awarded, error: awardError } = await supabase
    .from("estimate_sublist_subs")
    .update({ is_awarded: true })
    .eq("id", subIdNum)
    .select()
    .single();

  if (awardError) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: WHERE,
      message: "Failed to award sub.",
      details: awardError.message,
    });
  }

  return NextResponse.json(awarded);
});
