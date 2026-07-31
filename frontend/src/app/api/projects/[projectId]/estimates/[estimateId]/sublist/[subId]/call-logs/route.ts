import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "projects/[projectId]/estimates/[estimateId]/sublist/[subId]/call-logs";

type Params = { projectId: string; estimateId: string; subId: string };

/**
 * GET /api/projects/[projectId]/estimates/[estimateId]/sublist/[subId]/call-logs
 * Returns all call log entries for a specific sub, newest first.
 */
export const GET = withApiGuardrails<Params>(WHERE + "#GET", async ({ params }) => {
  const { projectId, estimateId, subId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  const projectIdNum = parseInt(projectId, 10);
  const subIdNum = parseInt(subId, 10);
  const estimateIdNum = parseInt(estimateId, 10);
  if (isNaN(projectIdNum) || isNaN(subIdNum) || isNaN(estimateIdNum)) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Invalid sub or estimate ID." });
  }

  // Verify sub belongs to this estimate
  const { data: sub, error: subError } = await supabase
    .from("estimate_sublist_subs")
    .select("id, estimates!inner(estimate_id, project_id, is_deleted)")
    .eq("id", subIdNum)
    .eq("estimate_id", estimateIdNum)
    .eq("estimates.project_id", projectIdNum)
    .eq("estimates.is_deleted", false)
    .maybeSingle();

  if (subError || !sub) {
    throw new GuardrailError({ code: "NOT_FOUND", where: WHERE, message: "Sub not found in this estimate." });
  }

  const { data, error } = await supabase
    .from("estimate_sublist_call_logs")
    .select("*")
    .eq("sub_id", subIdNum)
    .order("called_at", { ascending: false });

  if (error) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: error.message, details: error });
  }

  return NextResponse.json(data ?? []);
});

/**
 * POST /api/projects/[projectId]/estimates/[estimateId]/sublist/[subId]/call-logs
 * Logs a phone call attempt for a sub.
 * Body: { outcome: "Reached" | "Voicemail" | "No Answer" | "Declined", notes?: string, called_at?: string }
 */
export const POST = withApiGuardrails<Params>(WHERE + "#POST", async ({ request, params }) => {
  const { projectId, estimateId, subId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  const projectIdNum = parseInt(projectId, 10);
  const subIdNum = parseInt(subId, 10);
  const estimateIdNum = parseInt(estimateId, 10);
  if (isNaN(projectIdNum) || isNaN(subIdNum) || isNaN(estimateIdNum)) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Invalid sub or estimate ID." });
  }

  const VALID_OUTCOMES = ["Reached", "Voicemail", "No Answer", "Declined"] as const;
  type Outcome = (typeof VALID_OUTCOMES)[number];

  const body = await request.json().catch(() => ({})) as { outcome?: string; notes?: string; called_at?: string };

  if (!body.outcome || !VALID_OUTCOMES.includes(body.outcome as Outcome)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: `outcome must be one of: ${VALID_OUTCOMES.join(", ")}`,
    });
  }

  // Verify sub belongs to this estimate
  const { data: sub, error: subError } = await supabase
    .from("estimate_sublist_subs")
    .select("id, estimates!inner(estimate_id, project_id, is_deleted)")
    .eq("id", subIdNum)
    .eq("estimate_id", estimateIdNum)
    .eq("estimates.project_id", projectIdNum)
    .eq("estimates.is_deleted", false)
    .maybeSingle();

  if (subError || !sub) {
    throw new GuardrailError({ code: "NOT_FOUND", where: WHERE, message: "Sub not found in this estimate." });
  }

  const { data, error } = await supabase
    .from("estimate_sublist_call_logs")
    .insert({
      sub_id: subIdNum,
      outcome: body.outcome as Outcome,
      notes: body.notes?.trim() || null,
      called_at: body.called_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: error.message, details: error });
  }

  return NextResponse.json(data, { status: 201 });
});

/**
 * DELETE /api/projects/[projectId]/estimates/[estimateId]/sublist/[subId]/call-logs/[logId]
 * is handled in a nested route file.
 */
