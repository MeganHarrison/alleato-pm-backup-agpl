import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import {
  assertCrmOwnerOrAdmin,
  requireActiveInternalOwner,
  requireCrmAccess,
} from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";

const CreateDealSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    company_id: z.string().uuid().nullable().optional(),
    lead_id: z.string().uuid().nullable().optional(),
    pipeline_id: z.string().uuid(),
    stage_id: z.string().uuid(),
    owner_person_id: z.string().uuid(),
    value_estimate: z.number().nonnegative().default(0),
    probability: z.number().int().min(0).max(100),
    expected_close_date: z.string().date().nullable().optional(),
    source: z.string().trim().min(1).max(200).default("manual"),
  })
  .strict()
  .refine((data) => Boolean(data.company_id) !== Boolean(data.lead_id), {
    message: "Choose exactly one CRM relationship.",
    path: ["company_id"],
  });

export const GET = withApiGuardrails("crm/deals#GET", async ({ request }) => {
  const { db } = await requireCrmAccess("read");
  const companyId = request.nextUrl.searchParams.get("companyId");
  const leadId = request.nextUrl.searchParams.get("leadId");
  const status = request.nextUrl.searchParams.get("status");
  let query = db
    .from("crm_deals")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(250);
  if (companyId) query = query.eq("company_id", companyId);
  if (leadId) query = query.eq("lead_id", leadId);
  if (status && ["open", "won", "lost"].includes(status)) {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) return apiErrorResponse(error);
  return NextResponse.json({ data: data ?? [] });
});

export const POST = withApiGuardrails("crm/deals#POST", async ({ request }) => {
  const { db, personId, isAdmin } = await requireCrmAccess("write");
  const parsed = CreateDealSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "crm/deals#POST",
      message: "Invalid CRM deal.",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }
  await requireActiveInternalOwner(
    parsed.data.owner_person_id,
    "crm/deals#POST",
  );
  const { data: stage, error: stageError } = await db
    .from("crm_stages")
    .select("pipeline_id, stage_type")
    .eq("id", parsed.data.stage_id)
    .eq("pipeline_id", parsed.data.pipeline_id)
    .is("archived_at", null)
    .maybeSingle();
  if (stageError) return apiErrorResponse(stageError);
  if (!stage || stage.stage_type !== "open") {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "crm/deals#POST",
      message:
        "New deals must begin in an open stage in the selected pipeline.",
      status: 400,
    });
  }
  const relationshipResult = parsed.data.company_id
    ? await db
        .from("crm_account_profiles")
        .select("owner_person_id")
        .eq("company_id", parsed.data.company_id)
        .is("archived_at", null)
        .maybeSingle()
    : await db
        .from("crm_leads")
        .select("owner_person_id")
        .eq("id", parsed.data.lead_id!)
        .is("archived_at", null)
        .maybeSingle();
  if (relationshipResult.error)
    return apiErrorResponse(relationshipResult.error);
  if (
    !relationshipResult.data ||
    relationshipResult.data.owner_person_id !== parsed.data.owner_person_id
  ) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "crm/deals#POST",
      message:
        "The selected CRM relationship was not found or has a different owner.",
      status: 400,
    });
  }
  assertCrmOwnerOrAdmin({
    ownerPersonId: relationshipResult.data.owner_person_id,
    personId,
    isAdmin,
    action: "crm/deals#POST",
  });
  const { data, error } = await db
    .from("crm_deals")
    .insert({
      ...parsed.data,
      owner_person_id: relationshipResult.data.owner_person_id,
      status: "open",
      currency_code: "USD",
    })
    .select()
    .single();
  if (error) return apiErrorResponse(error);
  return NextResponse.json({ data }, { status: 201 });
});
