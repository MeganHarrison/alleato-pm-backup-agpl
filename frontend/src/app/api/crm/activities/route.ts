import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const ACTIVITY_SELECT = `
  id, company_id, deal_id, person_id, activity_type, subject, body,
  due_at, completed_at, created_by, created_at,
  person:people!crm_activities_person_id_fkey(id, first_name, last_name),
  deal:crm_deals!crm_activities_deal_id_fkey(id, name)
`;

export const GET = withApiGuardrails("crm/activities#GET", async ({ request }) => {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const dealId = searchParams.get("dealId");

  let query = supabase
    .from("crm_activities")
    .select(ACTIVITY_SELECT)
    .order("created_at", { ascending: false })
    .limit(200);

  if (companyId) {
    query = query.eq("company_id", companyId);
  }
  if (dealId) {
    query = query.eq("deal_id", dealId);
  }

  const { data, error } = await query;

  if (error) {
    return apiErrorResponse(error);
  }

  return NextResponse.json({ data: data ?? [] });
});

const CreateActivitySchema = z.object({
  company_id: z.string().uuid(),
  deal_id: z.string().uuid().nullable().optional(),
  person_id: z.string().uuid().nullable().optional(),
  activity_type: z.enum(["call", "email", "meeting", "note", "follow_up"]),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  body: z.string().trim().max(8000).nullable().optional(),
  due_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export const POST = withApiGuardrails("crm/activities#POST", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "crm/activities#POST",
      message: "Sign in to log an activity.",
      status: 401,
      severity: "medium",
    });
  }

  const parsed = CreateActivitySchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "crm/activities#POST",
      message: parsed.error.issues[0]?.message ?? "Invalid activity payload.",
      status: 400,
      severity: "low",
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_activities")
    .insert({ ...parsed.data, created_by: user.id })
    .select(ACTIVITY_SELECT)
    .single();

  if (error) {
    return apiErrorResponse(error);
  }

  return NextResponse.json({ data }, { status: 201 });
});
