import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";

const CreateActivitySchema = z
  .object({
    company_id: z.string().uuid().nullable().optional(),
    lead_id: z.string().uuid().nullable().optional(),
    deal_id: z.string().uuid().nullable().optional(),
    activity_type: z.enum(["call", "email", "meeting", "note"]),
    subject: z.string().trim().min(1).max(300),
    body: z.string().trim().max(8000).nullable().optional(),
    occurred_at: z.string().datetime({ offset: true }),
    contact_person_ids: z.array(z.string().uuid()).max(100).default([]),
  })
  .strict()
  .refine((data) => Boolean(data.company_id) !== Boolean(data.lead_id), {
    message: "Choose exactly one CRM relationship.",
    path: ["company_id"],
  });

export const GET = withApiGuardrails(
  "crm/activities#GET",
  async ({ request }) => {
    const { db } = await requireCrmAccess("read");
  const companyId = request.nextUrl.searchParams.get("companyId");
  const leadId = request.nextUrl.searchParams.get("leadId");
    const dealId = request.nextUrl.searchParams.get("dealId");
    let query = db
      .from("crm_activities")
      .select("*")
      .eq("visibility_scope", "standard")
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(250);
  if (companyId) query = query.eq("company_id", companyId);
  if (leadId) query = query.eq("lead_id", leadId);
    if (dealId) query = query.eq("deal_id", dealId);
    const { data, error } = await query;
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data: data ?? [] });
  },
);

export const POST = withApiGuardrails(
  "crm/activities#POST",
  async ({ request }) => {
    const { db, personId } = await requireCrmAccess("write");
    const parsed = CreateActivitySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/activities#POST",
        message: "Invalid CRM activity.",
        status: 400,
        details: { issues: parsed.error.flatten() },
      });
    }
    const { contact_person_ids, ...activity } = parsed.data;
    if (activity.deal_id) {
      const { data: deal, error: dealError } = await db
        .from("crm_deals")
        .select("company_id, lead_id")
        .eq("id", activity.deal_id)
        .is("archived_at", null)
        .maybeSingle();
      if (dealError) return apiErrorResponse(dealError);
      if (
        !deal ||
        deal.company_id !== (activity.company_id ?? null) ||
        deal.lead_id !== (activity.lead_id ?? null)
      ) {
        throw new GuardrailError({
          code: "VALIDATION_ERROR",
          where: "crm/activities#POST",
          message:
            "The selected deal does not belong to this CRM relationship.",
          status: 400,
        });
      }
    }
    const { data, error } = await db
      .from("crm_activities")
      .insert({
        ...activity,
        created_by_person_id: personId,
        record_origin: "manual",
        visibility_scope: "standard",
      })
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    if (contact_person_ids.length) {
      const { error: contactsError } = await db
        .from("crm_activity_contacts")
        .insert(
          contact_person_ids.map((contactPersonId) => ({
            activity_id: data.id,
            person_id: contactPersonId,
          })),
        );
      if (contactsError) {
        await db.from("crm_activities").delete().eq("id", data.id);
        return apiErrorResponse(contactsError);
      }
    }
    return NextResponse.json({ data }, { status: 201 });
  },
);
