import { NextResponse } from "next/server";
// Dispatched by the consolidated CRM catch-all route.
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertCrmOwnerOrAdmin, requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

type Params = { companyId: string };
const BodySchema = z.object({ row_version: z.number().int().positive() }).strict();

export const POST = withApiGuardrails<Params>(
  "crm/accounts/[companyId]/unarchive#POST",
  async ({ request, params }) => {
    assertNonNilUuid(params.companyId, "companyId", "crm/accounts/unarchive");
    const { db, personId, isAdmin } = await requireCrmAccess("write");
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/accounts/[companyId]/unarchive#POST",
        message: "The current row version is required.",
        status: 400,
      });
    }
    const { data: current, error: currentError } = await db
      .from("crm_account_profiles")
      .select("owner_person_id, archived_at")
      .eq("company_id", params.companyId)
      .maybeSingle();
    if (currentError) return apiErrorResponse(currentError);
    if (!current) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/accounts/[companyId]/unarchive#POST",
        message: "CRM account not found.",
        status: 404,
      });
    }
    assertCrmOwnerOrAdmin({
      ownerPersonId: current.owner_person_id,
      personId,
      isAdmin,
      action: "crm/accounts/[companyId]/unarchive#POST",
    });
    const { data, error } = await db
      .from("crm_account_profiles")
      .update({ archived_at: null })
      .eq("company_id", params.companyId)
      .eq("row_version", parsed.data.row_version)
      .select()
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!data) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/accounts/[companyId]/unarchive#POST",
        message: "This account changed. Refresh before restoring.",
        status: 409,
      });
    }
    const { error: eventError } = await db.from("crm_account_profile_events").insert({
      company_id: params.companyId,
      field: "archived_at",
      old_value: current.archived_at,
      new_value: null,
      changed_by_person_id: personId,
      change_source: "manual",
      reason: "Account restored.",
    });
    if (eventError) return apiErrorResponse(eventError);
    return NextResponse.json({ data });
  },
);
