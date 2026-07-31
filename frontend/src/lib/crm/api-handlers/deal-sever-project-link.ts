import { NextResponse } from "next/server";
// Dispatched by the consolidated CRM catch-all route.
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

type Params = { dealId: string };
const BodySchema = z.object({
  reason: z.string().trim().min(1).max(1000),
  row_version: z.number().int().positive(),
}).strict();

export const POST = withApiGuardrails<Params>(
  "crm/deals/[dealId]/sever-project-link#POST",
  async ({ request, params }) => {
    assertNonNilUuid(params.dealId, "dealId", "crm/deals/sever-project-link");
    const { db, personId } = await requireCrmAccess("admin");
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/deals/[dealId]/sever-project-link#POST",
        message: "A reason and current row version are required.",
        status: 400,
      });
    }
    const { data: current, error: currentError } = await db
      .from("crm_deals")
      .select("project_id, project_sync_status")
      .eq("id", params.dealId)
      .maybeSingle();
    if (currentError) return apiErrorResponse(currentError);
    if (!current?.project_id) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/deals/[dealId]/sever-project-link#POST",
        message: "This deal does not have a project link.",
        status: 409,
      });
    }
    if (current.project_sync_status === "erp_synchronized") {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/deals/[dealId]/sever-project-link#POST",
        message: "An Acumatica-synchronized deal is final. Create a new deal instead.",
        status: 409,
      });
    }
    const { data, error } = await db
      .from("crm_deals")
      .update({ project_id: null, project_sync_status: "not_started" })
      .eq("id", params.dealId)
      .eq("row_version", parsed.data.row_version)
      .select()
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!data) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/deals/[dealId]/sever-project-link#POST",
        message: "This deal changed. Refresh before severing the project link.",
        status: 409,
      });
    }
    const { error: eventError } = await db.from("crm_deal_stage_events").insert({
      deal_id: params.dealId,
      from_stage_id: data.stage_id,
      to_stage_id: data.stage_id,
      changed_by_person_id: personId,
      reason: `Project ${current.project_id} link severed: ${parsed.data.reason}`,
    });
    if (eventError) return apiErrorResponse(eventError);
    return NextResponse.json({ data });
  },
);
