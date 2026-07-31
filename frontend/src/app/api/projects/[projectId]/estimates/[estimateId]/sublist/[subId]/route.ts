import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { z } from "zod";

const WHERE = "projects/[projectId]/estimates/[estimateId]/sublist/[subId]";

const sublistUpdateSchema = z.object({
  company_id: z.string().uuid().nullable().optional(),
  company: z.string().trim().max(200).nullable().optional(),
  contact_name: z.string().trim().max(160).nullable().optional(),
  email: z.string().trim().email().or(z.literal("")).nullable().optional(),
  cell: z.string().trim().max(60).nullable().optional(),
  price: z.number().finite().min(0).nullable().optional(),
  comments: z.string().trim().max(2000).nullable().optional(),
  intend_to_submit: z.enum(["", "Yes", "No"]).nullable().optional(),
  email_sent: z.enum(["", "Yes", "No", "Other"]).nullable().optional(),
  phone_follow_up: z.enum(["", "Yes", "No", "Voicemail"]).nullable().optional(),
  bid_received: z.enum(["", "Yes", "No", "Other"]).nullable().optional(),
}).strict();

async function parseAndVerifyParams(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  estimateId: string,
  subId: string,
): Promise<{ estimateIdNum: number; subIdNum: number }> {
  const projectIdNum = parseInt(projectId, 10);
  const estimateIdNum = parseInt(estimateId, 10);
  const subIdNum = parseInt(subId, 10);
  if (isNaN(projectIdNum) || isNaN(estimateIdNum) || isNaN(subIdNum)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Invalid project, estimate, or sublist ID.",
      details: { projectId, estimateId, subId },
    });
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
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE,
      message: "Sublist row not found for this project estimate.",
      details: { projectId, estimateId, subId },
    });
  }

  return { estimateIdNum, subIdNum };
}

export const PATCH = withApiGuardrails<{ projectId: string; estimateId: string; subId: string }>(
  "projects/[projectId]/estimates/[estimateId]/sublist/[subId]#PATCH",
  async ({ request, params }) => {
    const { projectId, estimateId, subId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "sublist/[subId]#PATCH", message: "Authentication required." });
    }

    const { estimateIdNum, subIdNum } = await parseAndVerifyParams(supabase, projectId, estimateId, subId);
    const parsed = sublistUpdateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "sublist/[subId]#PATCH",
        message: "Invalid sublist row update payload.",
        details: parsed.error.flatten(),
      });
    }

    const { data, error } = await supabase
      .from("estimate_sublist_subs")
      .update(parsed.data)
      .eq("id", subIdNum)
      .eq("estimate_id", estimateIdNum)
      .select()
      .single();

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "sublist/[subId]#PATCH",
        message: error.message,
        cause: error,
      });
    }

    return NextResponse.json(data);
  }
);

export const DELETE = withApiGuardrails<{ projectId: string; estimateId: string; subId: string }>(
  "projects/[projectId]/estimates/[estimateId]/sublist/[subId]#DELETE",
  async ({ params }) => {
    const { projectId, estimateId, subId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "sublist/[subId]#DELETE", message: "Authentication required." });
    }

    const { estimateIdNum, subIdNum } = await parseAndVerifyParams(supabase, projectId, estimateId, subId);

    const { error } = await supabase
      .from("estimate_sublist_subs")
      .delete()
      .eq("id", subIdNum)
      .eq("estimate_id", estimateIdNum);

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "sublist/[subId]#DELETE",
        message: error.message,
        cause: error,
      });
    }

    return new Response(null, { status: 204 });
  }
);
