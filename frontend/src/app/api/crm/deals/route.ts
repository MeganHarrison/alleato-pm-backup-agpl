import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const DEAL_SELECT = `
  id, name, status, value, expected_close_date, lead_source, description,
  created_at, updated_at,
  company:companies!crm_deals_company_id_fkey(id, name, lifecycle_stage),
  stage:crm_pipeline_stages!crm_deals_stage_id_fkey(id, name, sort_order, is_terminal, outcome),
  owner:people!crm_deals_owner_id_fkey(id, first_name, last_name),
  primary_contact:people!crm_deals_primary_contact_id_fkey(id, first_name, last_name)
`;

export const GET = withApiGuardrails("crm/deals#GET", async ({ request }) => {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  let query = supabase
    .from("crm_deals")
    .select(DEAL_SELECT)
    .order("created_at", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error) {
    return apiErrorResponse(error);
  }

  return NextResponse.json({ data: data ?? [] });
});

const CreateDealSchema = z.object({
  name: z.string().trim().min(1, "Deal name is required"),
  company_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  value: z.number().nonnegative().nullable().optional(),
  expected_close_date: z.string().date().nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  primary_contact_id: z.string().uuid().nullable().optional(),
  lead_source: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
});

export const POST = withApiGuardrails("crm/deals#POST", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "crm/deals#POST",
      message: "Sign in to create a deal.",
      status: 401,
      severity: "medium",
    });
  }

  const parsed = CreateDealSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "crm/deals#POST",
      message: parsed.error.issues[0]?.message ?? "Invalid deal payload.",
      status: 400,
      severity: "low",
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_deals")
    .insert({ ...parsed.data, created_by: user.id })
    .select(DEAL_SELECT)
    .single();

  if (error) {
    return apiErrorResponse(error);
  }

  return NextResponse.json({ data }, { status: 201 });
});
