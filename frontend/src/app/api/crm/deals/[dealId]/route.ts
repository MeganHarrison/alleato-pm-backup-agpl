import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient } from "@/lib/supabase/server";

type DealRouteParams = { dealId: string };

const UpdateDealSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    stage_id: z.string().uuid().optional(),
    status: z.enum(["open", "won", "lost"]).optional(),
    value: z.number().nonnegative().nullable().optional(),
    expected_close_date: z.string().date().nullable().optional(),
    owner_id: z.string().uuid().nullable().optional(),
    primary_contact_id: z.string().uuid().nullable().optional(),
    lead_source: z.string().trim().max(200).nullable().optional(),
    description: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "No fields to update.",
  });

export const PATCH = withApiGuardrails<DealRouteParams>(
  "crm/deals/[dealId]#PATCH",
  async ({ request, params }) => {
    const { dealId } = params;
    assertNonNilUuid(dealId, "dealId", "crm/deals/[dealId]#PATCH");

    const parsed = UpdateDealSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/deals/[dealId]#PATCH",
        message: parsed.error.issues[0]?.message ?? "Invalid deal payload.",
        status: 400,
        severity: "low",
      });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("crm_deals")
      .update(parsed.data)
      .eq("id", dealId)
      .select("id")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data });
  },
);

export const DELETE = withApiGuardrails<DealRouteParams>(
  "crm/deals/[dealId]#DELETE",
  async ({ params }) => {
    const { dealId } = params;
    assertNonNilUuid(dealId, "dealId", "crm/deals/[dealId]#DELETE");

    const supabase = await createClient();
    const { error } = await supabase.from("crm_deals").delete().eq("id", dealId);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true });
  },
);
