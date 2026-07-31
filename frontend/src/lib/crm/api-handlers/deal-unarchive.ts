import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertCrmOwnerOrAdmin, requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

type Params = { dealId: string };
const BodySchema = z
  .object({ row_version: z.number().int().positive() })
  .strict();

export const POST = withApiGuardrails<Params>(
  "crm/deals/[dealId]/unarchive#POST",
  async ({ request, params }) => {
    assertNonNilUuid(params.dealId, "dealId", "crm/deals/unarchive");
    const { db, personId, isAdmin } = await requireCrmAccess("write");
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/deals/[dealId]/unarchive#POST",
        message: "The current row version is required.",
        status: 400,
      });
    }
    const { data: current, error: currentError } = await db
      .from("crm_deals")
      .select("owner_person_id, archived_at")
      .eq("id", params.dealId)
      .maybeSingle();
    if (currentError) return apiErrorResponse(currentError);
    if (!current) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/deals/unarchive",
        message: "Deal not found.",
        status: 404,
      });
    }
    assertCrmOwnerOrAdmin({
      ownerPersonId: current.owner_person_id,
      personId,
      isAdmin,
      action: "crm/deals/[dealId]/unarchive#POST",
    });
    const { data, error } = await db
      .from("crm_deals")
      .update({ archived_at: null })
      .eq("id", params.dealId)
      .eq("row_version", parsed.data.row_version)
      .select()
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!data) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/deals/[dealId]/unarchive#POST",
        message: "This deal changed. Refresh before restoring.",
        status: 409,
      });
    }
    return NextResponse.json({ data });
  },
);
