import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertCrmOwnerOrAdmin, requireCrmAccess } from "@/lib/crm/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

export const GET = withApiGuardrails(
  "crm/leads/[leadId]/email-history#GET",
  async ({ request, params }) => {
    const { leadId } = await params;
    if (!z.string().uuid().safeParse(leadId).success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]/email-history#GET",
        message: "A valid CRM lead is required.",
        status: 400,
      });
    }
    const cursor = new URL(request.url).searchParams.get("before");
    if (cursor && Number.isNaN(Date.parse(cursor))) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]/email-history#GET",
        message: "The email-history cursor is invalid.",
        status: 400,
      });
    }
    const { db, personId, isAdmin } = await requireCrmAccess("read");
    const { data: lead, error: leadError } = await db
      .from("crm_leads")
      .select("owner_person_id")
      .eq("id", leadId)
      .is("archived_at", null)
      .maybeSingle();
    if (leadError) return apiErrorResponse(leadError);
    if (!lead)
      return NextResponse.json({ message: "Lead not found." }, { status: 404 });
    assertCrmOwnerOrAdmin({
      ownerPersonId: lead.owner_person_id,
      personId,
      isAdmin,
      action: "crm/leads/[leadId]/email-history#GET",
    });
    let query = db
      .from("crm_activities")
      .select("id, subject, occurred_at, source_external_key")
      .eq("lead_id", leadId)
      .eq("activity_type", "email")
      .eq("source_system", "outlook")
      .eq("record_origin", "auto")
      .eq("visibility_scope", "standard")
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(51);
    if (cursor) query = query.lt("occurred_at", cursor);
    const { data, error } = await query;
    if (error) return apiErrorResponse(error);
    const rows = data ?? [];
    return NextResponse.json({
      data: rows.slice(0, 50).map((activity) => ({
        id: activity.id,
        subject: activity.subject,
        occurredAt: activity.occurred_at,
        sourceExternalKey: activity.source_external_key,
      })),
      nextCursor: rows.length > 50 ? (rows[49]?.occurred_at ?? null) : null,
    });
  },
);
