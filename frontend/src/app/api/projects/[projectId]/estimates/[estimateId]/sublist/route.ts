import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { z } from "zod";

const WHERE = "projects/[projectId]/estimates/[estimateId]/sublist";

const sublistCreateSchema = z.object({
  division_code: z.string().trim().regex(/^\d{2}$/).default("02"),
  division_name: z.string().trim().max(120).default(""),
  position: z.number().int().min(1).optional(),
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
});

async function assertEstimateBelongsToProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  estimateId: string,
): Promise<{ projectIdNum: number; estimateIdNum: number }> {
  const projectIdNum = parseInt(projectId, 10);
  const estimateIdNum = parseInt(estimateId, 10);
  if (isNaN(projectIdNum) || isNaN(estimateIdNum)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Invalid project or estimate ID.",
      details: { projectId, estimateId },
    });
  }

  const { data, error } = await supabase
    .from("estimates")
    .select("estimate_id")
    .eq("estimate_id", estimateIdNum)
    .eq("project_id", projectIdNum)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: error.message, cause: error });
  }
  if (!data) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE,
      message: "Estimate not found for this project.",
      details: { projectId, estimateId },
    });
  }

  return { projectIdNum, estimateIdNum };
}

export const GET = withApiGuardrails<{ projectId: string; estimateId: string }>(
  "projects/[projectId]/estimates/[estimateId]/sublist#GET",
  async ({ params }) => {
    const { projectId, estimateId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "sublist#GET", message: "Authentication required." });
    }

    const { estimateIdNum } = await assertEstimateBelongsToProject(supabase, projectId, estimateId);

    const { data, error } = await supabase
      .from("estimate_sublist_subs")
      .select("*")
      .eq("estimate_id", estimateIdNum)
      .order("division_code", { ascending: true })
      .order("position", { ascending: true });

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "sublist#GET",
        message: error.message,
        cause: error,
      });
    }

    return NextResponse.json(data ?? []);
  }
);

export const POST = withApiGuardrails<{ projectId: string; estimateId: string }>(
  "projects/[projectId]/estimates/[estimateId]/sublist#POST",
  async ({ request, params }) => {
    const { projectId, estimateId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "sublist#POST", message: "Authentication required." });
    }

    const { estimateIdNum } = await assertEstimateBelongsToProject(supabase, projectId, estimateId);

    const parsed = sublistCreateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "sublist#POST",
        message: "Invalid sublist row payload.",
        details: parsed.error.flatten(),
      });
    }
    const { division_code, division_name, ...rest } = parsed.data;

    // Compute next position for this division (auto-increment per division)
    const { data: maxRow } = await supabase
      .from("estimate_sublist_subs")
      .select("position")
      .eq("estimate_id", estimateIdNum)
      .eq("division_code", division_code)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = rest.position ?? (maxRow?.position ?? 0) + 1;

    // Uses INSERT (not upsert): estimate_sublist_subs has no unique constraint on
    // (estimate_id, division_code, position) — only PRIMARY KEY (id). Upsert with
    // onConflict:"estimate_id,division_code,position" caused HTTP 500 in production.
    const { data, error } = await supabase
      .from("estimate_sublist_subs")
      .insert({
        estimate_id: estimateIdNum,
        division_code,
        division_name,
        position: nextPosition,
        ...rest,
      })
      .select()
      .single();

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "sublist#POST",
        message: error.message,
        cause: error,
      });
    }

    return NextResponse.json(data, { status: 201 });
  }
);
