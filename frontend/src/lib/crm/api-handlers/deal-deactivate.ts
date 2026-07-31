import { NextResponse } from "next/server";
// Dispatched by the consolidated CRM catch-all route.
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertCrmOwnerOrAdmin, requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

type Params = { dealId: string };
const BodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
  row_version: z.number().int().positive(),
}).strict();

export const POST = withApiGuardrails<Params>(
  "crm/deals/[dealId]/deactivate#POST",
  async ({ request, params }) => {
    assertNonNilUuid(params.dealId, "dealId", "crm/deals/deactivate");
    const { db, personId, isAdmin } = await requireCrmAccess("write");
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/deals/[dealId]/deactivate#POST",
        message: "An archive reason and current row version are required.",
        status: 400,
      });
    }
    const { data: current, error: currentError } = await db
      .from("crm_deals")
      .select("owner_person_id")
      .eq("id", params.dealId)
      .maybeSingle();
    if (currentError) return apiErrorResponse(currentError);
    if (!current) {
      throw new GuardrailError({ code: "NOT_FOUND", where: "crm/deals/deactivate", message: "Deal not found.", status: 404 });
    }
    assertCrmOwnerOrAdmin({
      ownerPersonId: current.owner_person_id,
      personId,
      isAdmin,
      action: "crm/deals/[dealId]/deactivate#POST",
    });
    const { data, error } = await db
      .from("crm_deals")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", params.dealId)
      .eq("row_version", parsed.data.row_version)
      .select()
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!data) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/deals/[dealId]/deactivate#POST",
        message: "This deal changed. Refresh before archiving.",
        status: 409,
      });
    }
    const { error: eventError } = await db.from("crm_deal_stage_events").insert({
      deal_id: params.dealId,
      from_stage_id: data.stage_id,
      to_stage_id: data.stage_id,
      changed_by_person_id: personId,
      reason: `Deal archived: ${parsed.data.reason}`,
    });
    if (eventError) return apiErrorResponse(eventError);
    return NextResponse.json({ data, reason: parsed.data.reason });
  },
);
