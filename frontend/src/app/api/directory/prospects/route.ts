import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

// Prospects are companies with lifecycle_stage != 'active' — the CRM side of
// the shared identity table. There is deliberately NO separate prospects
// identity table (decision 2026-07-23); converting a prospect is a
// lifecycle_stage flip via /api/crm/companies/[companyId]/verify.

export interface ProspectListItem {
  id: string;
  name: string;
  lifecycle_stage: string;
  type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  state: string | null;
  created_at: string | null;
  open_deal_count: number;
  pipeline_value: number;
  owner_name: string | null;
  last_activity_at: string | null;
  last_activity_type: string | null;
  next_follow_up_at: string | null;
}

export const GET = withApiGuardrails("directory/prospects#GET", async () => {
  const supabase = await createClient();

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select(
      "id, name, lifecycle_stage, type, contact_name, contact_email, contact_phone, city, state, created_at",
    )
    .neq("lifecycle_stage", "active")
    .order("created_at", { ascending: false });

  if (companiesError) {
    return apiErrorResponse(companiesError);
  }

  const companyIds = (companies ?? []).map((company) => company.id);

  const [dealsResult, activitiesResult] = companyIds.length
    ? await Promise.all([
        supabase
          .from("crm_deals")
          .select(
            "company_id, value, status, owner:people!crm_deals_owner_id_fkey(first_name, last_name)",
          )
          .in("company_id", companyIds),
        supabase
          .from("crm_activities")
          .select("company_id, activity_type, created_at, due_at, completed_at")
          .in("company_id", companyIds)
          .order("created_at", { ascending: false })
          .limit(2000),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (dealsResult.error) {
    return apiErrorResponse(dealsResult.error);
  }
  if (activitiesResult.error) {
    return apiErrorResponse(activitiesResult.error);
  }

  type DealRow = {
    company_id: string;
    value: number | null;
    status: string;
    owner: { first_name: string | null; last_name: string | null } | null;
  };
  type ActivityRow = {
    company_id: string;
    activity_type: string;
    created_at: string | null;
    due_at: string | null;
    completed_at: string | null;
  };

  const dealsByCompany = new Map<string, DealRow[]>();
  for (const deal of (dealsResult.data ?? []) as DealRow[]) {
    const list = dealsByCompany.get(deal.company_id) ?? [];
    list.push(deal);
    dealsByCompany.set(deal.company_id, list);
  }

  const activitiesByCompany = new Map<string, ActivityRow[]>();
  for (const activity of (activitiesResult.data ?? []) as ActivityRow[]) {
    const list = activitiesByCompany.get(activity.company_id) ?? [];
    list.push(activity);
    activitiesByCompany.set(activity.company_id, list);
  }

  const items: ProspectListItem[] = (companies ?? []).map((company) => {
    const deals = dealsByCompany.get(company.id) ?? [];
    const openDeals = deals.filter((deal) => deal.status === "open");
    const activities = activitiesByCompany.get(company.id) ?? [];
    const lastActivity = activities[0] ?? null;
    const openFollowUps = activities
      .filter((activity) => activity.due_at && !activity.completed_at)
      .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
    const firstOwner = openDeals.find((deal) => deal.owner)?.owner ?? null;

    return {
      ...company,
      open_deal_count: openDeals.length,
      pipeline_value: openDeals.reduce((sum, deal) => sum + (deal.value ?? 0), 0),
      owner_name: firstOwner
        ? [firstOwner.first_name, firstOwner.last_name].filter(Boolean).join(" ") || null
        : null,
      last_activity_at: lastActivity?.created_at ?? null,
      last_activity_type: lastActivity?.activity_type ?? null,
      next_follow_up_at: openFollowUps[0]?.due_at ?? null,
    };
  });

  return NextResponse.json({ data: items });
});

const CreateProspectSchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(300),
  type: z.string().trim().max(100).nullable().optional(),
  contact_name: z.string().trim().max(200).nullable().optional(),
  contact_email: z.string().trim().email().nullable().optional(),
  contact_phone: z.string().trim().max(50).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  state: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export const POST = withApiGuardrails("directory/prospects#POST", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "directory/prospects#POST",
      message: "Sign in to add a prospect.",
      status: 401,
      severity: "medium",
    });
  }

  const parsed = CreateProspectSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "directory/prospects#POST",
      message: parsed.error.issues[0]?.message ?? "Invalid prospect payload.",
      status: 400,
      severity: "low",
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .insert({
      ...parsed.data,
      lifecycle_stage: "prospect",
      is_vendor: false,
      status: "active",
    })
    .select("id, name, lifecycle_stage")
    .single();

  if (error) {
    return apiErrorResponse(error);
  }

  return NextResponse.json({ data }, { status: 201 });
});
