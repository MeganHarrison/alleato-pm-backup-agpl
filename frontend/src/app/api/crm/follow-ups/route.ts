import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { requireActiveInternalOwner, requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";

const CreateFollowUpSchema = z
  .object({
    company_id: z.string().uuid().nullable().optional(),
    crm_lead_id: z.string().uuid().nullable().optional(),
    crm_deal_id: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1).max(4000),
    assignee_person_id: z.string().uuid(),
    due_date: z.string().date(),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  })
  .strict()
  .refine((data) => Boolean(data.company_id) !== Boolean(data.crm_lead_id), {
    message: "Choose exactly one CRM relationship.",
    path: ["company_id"],
  });

export const POST = withApiGuardrails(
  "crm/follow-ups#POST",
  async ({ request }) => {
    const { db, user } = await requireCrmAccess("write");
    const parsed = CreateFollowUpSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/follow-ups#POST",
        message: "Invalid CRM follow-up.",
        status: 400,
        details: { issues: parsed.error.flatten() },
      });
    }

    await requireActiveInternalOwner(
      parsed.data.assignee_person_id,
      "crm/follow-ups#POST",
    );

    const relationshipResult = parsed.data.company_id
      ? await db
          .from("crm_account_profiles")
          .select("company_id")
          .eq("company_id", parsed.data.company_id)
          .is("archived_at", null)
          .maybeSingle()
      : await db
          .from("crm_leads")
          .select("id")
          .eq("id", parsed.data.crm_lead_id!)
          .is("archived_at", null)
          .maybeSingle();
    if (relationshipResult.error)
      return apiErrorResponse(relationshipResult.error);
    if (!relationshipResult.data) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/follow-ups#POST",
        message: "Follow-ups require an active CRM relationship.",
        status: 400,
      });
    }

    if (parsed.data.crm_deal_id) {
      const { data: deal, error: dealError } = await db
        .from("crm_deals")
        .select("id, company_id, lead_id")
        .eq("id", parsed.data.crm_deal_id)
        .is("archived_at", null)
        .maybeSingle();
      if (dealError) return apiErrorResponse(dealError);
      if (
        !deal ||
        deal.company_id !== (parsed.data.company_id ?? null) ||
        deal.lead_id !== (parsed.data.crm_lead_id ?? null)
      ) {
        throw new GuardrailError({
          code: "VALIDATION_ERROR",
          where: "crm/follow-ups#POST",
          message:
            "The selected deal does not belong to this CRM relationship.",
          status: 400,
        });
      }
    }

    const { data, error } = await db
      .from("tasks")
      .insert({
        metadata_id: null,
        source_system: "crm",
        source_type: "crm_follow_up",
        source_url: parsed.data.crm_deal_id
          ? `/crm/deals/${parsed.data.crm_deal_id}`
          : parsed.data.company_id
            ? `/crm/companies/${parsed.data.company_id}`
            : `/crm/leads?leadId=${encodeURIComponent(parsed.data.crm_lead_id)}`,
        status: "open",
        title: parsed.data.title,
        description: parsed.data.description,
        due_date: parsed.data.due_date,
        priority: parsed.data.priority,
        assignee_person_id: parsed.data.assignee_person_id,
        assigned_by: user.id,
        company_id: parsed.data.company_id ?? null,
        crm_lead_id: parsed.data.crm_lead_id ?? null,
        crm_deal_id: parsed.data.crm_deal_id ?? null,
        project_ids: [],
      })
      .select()
      .single();
    if (error) return apiErrorResponse(error);

    return NextResponse.json({ data }, { status: 201 });
  },
);
