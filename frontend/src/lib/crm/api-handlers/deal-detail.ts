import { NextResponse } from "next/server";
// Dispatched by the consolidated CRM catch-all route.
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertCrmOwnerOrAdmin, requireActiveInternalOwner, requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

type Params = { dealId: string };
const PatchSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  owner_person_id: z.string().uuid().optional(),
  value_estimate: z.number().nonnegative().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expected_close_date: z.string().date().nullable().optional(),
  source: z.string().trim().min(1).max(200).optional(),
  row_version: z.number().int().positive(),
}).strict().refine((value) => Object.keys(value).some((key) => key !== "row_version"), {
  message: "At least one editable deal field is required.",
});

export const GET = withApiGuardrails<Params>(
  "crm/deals/[dealId]#GET",
  async ({ params }) => {
    assertNonNilUuid(params.dealId, "dealId", "crm/deals/[dealId]#GET");
    const { db } = await requireCrmAccess("read");
    const [dealResult, contactsResult, stagesResult, activitiesResult, tasksResult, documentsResult] =
      await Promise.all([
        db.from("crm_deals").select("*").eq("id", params.dealId).maybeSingle(),
        db.from("crm_deal_contacts").select("*").eq("deal_id", params.dealId),
        db.from("crm_deal_stage_events").select("*").eq("deal_id", params.dealId).order("changed_at", { ascending: false }),
        db.from("crm_activities").select("*").eq("deal_id", params.dealId).eq("visibility_scope", "standard").is("deleted_at", null).order("occurred_at", { ascending: false }),
        db.from("tasks").select("*").eq("crm_deal_id", params.dealId).order("due_date", { ascending: true }),
        db.from("crm_deal_documents").select("*").eq("deal_id", params.dealId),
      ]);
    const firstError = dealResult.error ?? contactsResult.error ?? stagesResult.error ??
      activitiesResult.error ?? tasksResult.error ?? documentsResult.error;
    if (firstError) return apiErrorResponse(firstError);
    if (!dealResult.data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/deals/[dealId]#GET",
        message: "CRM deal not found.",
        status: 404,
      });
    }
    return NextResponse.json({
      data: {
        ...dealResult.data,
        contacts: contactsResult.data ?? [],
        stage_history: stagesResult.data ?? [],
        activities: activitiesResult.data ?? [],
        follow_ups: tasksResult.data ?? [],
        documents: documentsResult.data ?? [],
      },
    });
  },
);

export const PATCH = withApiGuardrails<Params>(
  "crm/deals/[dealId]#PATCH",
  async ({ request, params }) => {
    assertNonNilUuid(params.dealId, "dealId", "crm/deals/[dealId]#PATCH");
    const { db, personId, isAdmin } = await requireCrmAccess("write");
    const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/deals/[dealId]#PATCH",
        message: "Invalid CRM deal update.",
        status: 400,
        details: { issues: parsed.error.flatten() },
      });
    }
    const { data: current, error: currentError } = await db
      .from("crm_deals")
      .select("owner_person_id")
      .eq("id", params.dealId)
      .maybeSingle();
    if (currentError) return apiErrorResponse(currentError);
    if (!current) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/deals/[dealId]#PATCH",
        message: "CRM deal not found.",
        status: 404,
      });
    }
    assertCrmOwnerOrAdmin({
      ownerPersonId: current.owner_person_id,
      personId,
      isAdmin,
      action: "crm/deals/[dealId]#PATCH",
    });
    if (parsed.data.owner_person_id) {
      if (!isAdmin) {
        throw new GuardrailError({
          code: "FORBIDDEN",
          where: "crm/deals/[dealId]#PATCH",
          message: "Only a CRM administrator can reassign a deal.",
          status: 403,
        });
      }
      await requireActiveInternalOwner(parsed.data.owner_person_id, "crm/deals/[dealId]#PATCH");
    }
    const { row_version, ...updates } = parsed.data;
    const { data, error } = await db
      .from("crm_deals")
      .update(updates)
      .eq("id", params.dealId)
      .eq("row_version", row_version)
      .select()
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!data) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/deals/[dealId]#PATCH",
        message: "This deal changed. Refresh before saving.",
        status: 409,
      });
    }
    return NextResponse.json({ data });
  },
);
