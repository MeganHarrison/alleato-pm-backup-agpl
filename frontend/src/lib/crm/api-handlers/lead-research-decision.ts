import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertCrmOwnerOrAdmin, requireCrmAccess } from "@/lib/crm/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";

const DecisionSchema = z
  .object({
    decision: z.enum(["apply", "reject"]),
    row_version: z.number().int().positive(),
  })
  .strict();

export const POST = withApiGuardrails(
  "crm/leads/[leadId]/research/[artifactId]/decision#POST",
  async ({ request, params }) => {
    const { leadId, artifactId } = await params;
    if (
      !z.string().uuid().safeParse(leadId).success ||
      !z.string().uuid().safeParse(artifactId).success
    ) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]/research/[artifactId]/decision#POST",
        message: "A valid lead research draft is required.",
        status: 400,
      });
    }
    const parsed = DecisionSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]/research/[artifactId]/decision#POST",
        message: "Choose whether to apply or reject this draft.",
        status: 400,
      });
    const { db, personId, isAdmin } = await requireCrmAccess("write");
    const { data: lead, error } = await db
      .from("crm_leads")
      .select("owner_person_id")
      .eq("id", leadId)
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!lead)
      return NextResponse.json({ message: "Lead not found." }, { status: 404 });
    assertCrmOwnerOrAdmin({
      ownerPersonId: lead.owner_person_id,
      personId,
      isAdmin,
      action: "crm/leads/[leadId]/research/[artifactId]/decision#POST",
    });
    if (parsed.data.decision === "apply") {
      const sessionClient = await createClient();
      const { data, error: applyError } = await sessionClient.rpc(
        "crm_apply_lead_research",
        {
          p_lead_id: leadId,
          p_artifact_id: artifactId,
          p_expected_lead_row_version: parsed.data.row_version,
        },
      );
      if (applyError) return apiErrorResponse(applyError);
      return NextResponse.json({ data });
    }
    const { data, error: rejectError } = await db
      .from("crm_ai_artifacts")
      .update({
        review_status: "rejected",
        reviewed_by_person_id: personId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", artifactId)
      .eq("lead_id", leadId)
      .eq("artifact_type", "lead_research")
      .eq("review_status", "draft")
      .select()
      .single();
    if (rejectError) return apiErrorResponse(rejectError);
    return NextResponse.json({ data });
  },
);
