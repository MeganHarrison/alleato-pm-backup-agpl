import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import {
  requireActiveInternalOwner,
  requireCrmAccess,
} from "@/lib/crm/server";

const CreateAccountSchema = z.object({
  company_id: z.string().uuid(),
  owner_person_id: z.string().uuid().optional(),
  lifecycle_stage: z
    .enum(["lead", "prospect", "active_client", "past_client", "dormant"])
    .default("lead"),
}).strict();

export const GET = withApiGuardrails("crm/accounts#GET", async ({ request }) => {
  const { db } = await requireCrmAccess("read");
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
  const cursor = searchParams.get("cursor");
  const lifecycle = searchParams.get("lifecycle");
  const owner = searchParams.get("owner");
  const health = searchParams.get("health");

  let query = db
    .from("crm_account_profiles")
    .select("*")
    .is("archived_at", null)
    .order("company_id", { ascending: false })
    .limit(limit + 1);
  if (cursor) query = query.lt("company_id", cursor);
  if (lifecycle) query = query.eq("lifecycle_stage", lifecycle);
  if (owner) query = query.eq("owner_person_id", owner);
  if (health) query = query.eq("health_status", health);

  const { data: profiles, error } = await query;
  if (error) return apiErrorResponse(error);

  const page = profiles ?? [];
  const visible = page.slice(0, limit);
  const companyIds = visible.map((profile) => profile.company_id);
  const ownerIds = Array.from(new Set(visible.map((profile) => profile.owner_person_id)));
  const [{ data: companies, error: companiesError }, { data: owners, error: ownersError }] =
    await Promise.all([
      companyIds.length
        ? db.from("companies").select("id, name").in("id", companyIds)
        : Promise.resolve({ data: [], error: null }),
      ownerIds.length
        ? db.from("people").select("id, first_name, last_name").in("id", ownerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (companiesError) return apiErrorResponse(companiesError);
  if (ownersError) return apiErrorResponse(ownersError);

  const companyById = new Map((companies ?? []).map((company) => [company.id, company]));
  const ownerById = new Map((owners ?? []).map((person) => [person.id, person]));
  const data = visible.map((profile) => ({
    ...profile,
    company: companyById.get(profile.company_id) ?? null,
    owner: ownerById.get(profile.owner_person_id) ?? null,
  }));

  return NextResponse.json({
    data,
    nextCursor: page.length > limit ? visible.at(-1)?.company_id ?? null : null,
  });
});

export const POST = withApiGuardrails("crm/accounts#POST", async ({ request }) => {
  const { db, personId, isAdmin } = await requireCrmAccess("write");
  const parsed = CreateAccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "crm/accounts#POST",
      message: "Invalid CRM account payload.",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }
  const ownerPersonId = parsed.data.owner_person_id ?? personId;
  if (!isAdmin && ownerPersonId !== personId) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "crm/accounts#POST",
      message: "Only a CRM administrator can assign another account owner.",
      status: 403,
    });
  }
  await requireActiveInternalOwner(ownerPersonId, "crm/accounts#POST");

  const { data: company, error: companyError } = await db
    .from("companies")
    .select("id")
    .eq("id", parsed.data.company_id)
    .maybeSingle();
  if (companyError) return apiErrorResponse(companyError);
  if (!company) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "crm/accounts#POST",
      message: "The selected company was not found.",
      status: 404,
    });
  }

  const { data, error } = await db
    .from("crm_account_profiles")
    .insert({ ...parsed.data, owner_person_id: ownerPersonId })
    .select()
    .single();
  if (error) return apiErrorResponse(error);

  const { error: eventError } = await db.from("crm_account_profile_events").insert({
    company_id: parsed.data.company_id,
    field: "lifecycle_stage",
    old_value: null,
    new_value: parsed.data.lifecycle_stage,
    changed_by_person_id: personId,
    change_source: "manual",
  });
  if (eventError) return apiErrorResponse(eventError);

  return NextResponse.json({ data }, { status: 201 });
});
