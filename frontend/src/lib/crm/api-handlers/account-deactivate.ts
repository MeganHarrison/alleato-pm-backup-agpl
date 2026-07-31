import { NextResponse } from "next/server";
// Dispatched by the consolidated CRM catch-all route.
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertCrmOwnerOrAdmin, requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

type Params = { companyId: string };
const BodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
  row_version: z.number().int().positive(),
}).strict();

export const POST = withApiGuardrails<Params>(
  "crm/accounts/[companyId]/deactivate#POST",
  async ({ request, params }) => {
    assertNonNilUuid(params.companyId, "companyId", "crm/accounts/deactivate");
    const { db, personId, isAdmin } = await requireCrmAccess("write");
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/accounts/[companyId]/deactivate#POST",
        message: "An archive reason and current row version are required.",
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
        where: "crm/accounts/[companyId]/deactivate#POST",
        message: "CRM account not found.",
        status: 404,
      });
    }
    assertCrmOwnerOrAdmin({
      ownerPersonId: current.owner_person_id,
      personId,
      isAdmin,
      action: "crm/accounts/[companyId]/deactivate#POST",
    });
    const { count, error: dealError } = await db
      .from("crm_deals")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.companyId)
      .eq("status", "open")
      .is("archived_at", null);
    if (dealError) return apiErrorResponse(dealError);
    if ((count ?? 0) > 0) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/accounts/[companyId]/deactivate#POST",
        message: "Archive or close the account's open deals first.",
        status: 409,
      });
    }
    const archivedAt = new Date().toISOString();
    const { data, error } = await db
      .from("crm_account_profiles")
      .update({ archived_at: archivedAt })
      .eq("company_id", params.companyId)
      .eq("row_version", parsed.data.row_version)
      .select()
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!data) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/accounts/[companyId]/deactivate#POST",
        message: "This account changed. Refresh before archiving.",
        status: 409,
      });
    }
    const { error: eventError } = await db.from("crm_account_profile_events").insert({
      company_id: params.companyId,
      field: "archived_at",
      old_value: current.archived_at,
      new_value: archivedAt,
      changed_by_person_id: personId,
      change_source: "manual",
      reason: parsed.data.reason,
    });
    if (eventError) return apiErrorResponse(eventError);
    return NextResponse.json({ data });
  },
);
