import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient } from "@/lib/supabase/server";

const ConvertLeadSchema = z
  .object({
    company_id: z.string().uuid(),
    row_version: z.number().int().positive(),
  })
  .strict();

export const POST = withApiGuardrails(
  "crm/leads/[leadId]/convert#POST",
  async ({ request, params }) => {
    const { leadId } = await params;
    if (!leadId || !z.string().uuid().safeParse(leadId).success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]/convert#POST",
        message: "A valid CRM lead is required.",
        status: 400,
      });
    }

    const parsed = ConvertLeadSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]/convert#POST",
        message: "Choose a company and refresh the lead before converting it.",
        status: 400,
        details: { issues: parsed.error.flatten() },
      });
    }

    await requireCrmAccess("write");
    const sessionClient = await createClient();
    const { data, error } = await sessionClient.rpc(
      "crm_convert_lead_to_company",
      {
        p_company_id: parsed.data.company_id,
        p_expected_row_version: parsed.data.row_version,
        p_lead_id: leadId,
      },
    );
    if (error) return apiErrorResponse(error);

    return NextResponse.json({ data });
  },
);
