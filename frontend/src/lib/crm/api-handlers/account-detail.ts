import { NextResponse } from "next/server";
// Dispatched by the consolidated CRM catch-all route.
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import {
  assertCrmOwnerOrAdmin,
  requireActiveInternalOwner,
  requireCrmAccess,
} from "@/lib/crm/server";

type Params = { companyId: string };

const PatchAccountSchema = z.object({
  lifecycle_stage: z
    .enum(["lead", "prospect", "active_client", "past_client", "dormant"])
    .optional(),
  owner_person_id: z.string().uuid().optional(),
  row_version: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500).optional(),
}).strict().refine(
  (value) => value.lifecycle_stage !== undefined || value.owner_person_id !== undefined,
  "At least one CRM profile field is required.",
);

export const GET = withApiGuardrails<Params>(
  "crm/accounts/[companyId]#GET",
  async ({ params }) => {
    assertNonNilUuid(params.companyId, "companyId", "crm/accounts/[companyId]#GET");
    const { db } = await requireCrmAccess("read");
    const { data, error } = await db
      .from("crm_account_profiles")
      .select("*")
      .eq("company_id", params.companyId)
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/accounts/[companyId]#GET",
        message: "This company is not enrolled in CRM.",
        status: 404,
      });
    }
    return NextResponse.json({ data });
  },
);

export const PATCH = withApiGuardrails<Params>(
  "crm/accounts/[companyId]#PATCH",
  async ({ request, params }) => {
    assertNonNilUuid(params.companyId, "companyId", "crm/accounts/[companyId]#PATCH");
    const { db, personId, isAdmin } = await requireCrmAccess("write");
    const parsed = PatchAccountSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/accounts/[companyId]#PATCH",
        message: "Invalid CRM profile update.",
        status: 400,
        details: { issues: parsed.error.flatten() },
      });
    }

    const { data: current, error: currentError } = await db
      .from("crm_account_profiles")
      .select("*")
      .eq("company_id", params.companyId)
      .maybeSingle();
    if (currentError) return apiErrorResponse(currentError);
    if (!current) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/accounts/[companyId]#PATCH",
        message: "This company is not enrolled in CRM.",
        status: 404,
      });
    }
    assertCrmOwnerOrAdmin({
      ownerPersonId: current.owner_person_id,
      personId,
      isAdmin,
      action: "crm/accounts/[companyId]#PATCH",
    });
    if (!isAdmin && parsed.data.owner_person_id !== undefined) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "crm/accounts/[companyId]#PATCH",
        message: "Only a CRM administrator can reassign an account.",
        status: 403,
      });
    }
    if (parsed.data.owner_person_id) {
      await requireActiveInternalOwner(
        parsed.data.owner_person_id,
        "crm/accounts/[companyId]#PATCH",
      );
    }

    const updates = {
      lifecycle_stage: parsed.data.lifecycle_stage,
      owner_person_id: parsed.data.owner_person_id,
    };
    const { data, error } = await db
      .from("crm_account_profiles")
      .update(updates)
      .eq("company_id", params.companyId)
      .eq("row_version", parsed.data.row_version)
      .select()
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!data) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/accounts/[companyId]#PATCH",
        message: "This account changed. Refresh before saving.",
        status: 409,
      });
    }

    const events = [
      parsed.data.lifecycle_stage !== undefined &&
      parsed.data.lifecycle_stage !== current.lifecycle_stage
        ? {
            company_id: params.companyId,
            field: "lifecycle_stage",
            old_value: current.lifecycle_stage,
            new_value: parsed.data.lifecycle_stage,
            changed_by_person_id: personId,
            change_source: "manual",
            reason: parsed.data.reason,
          }
        : null,
      parsed.data.owner_person_id !== undefined &&
      parsed.data.owner_person_id !== current.owner_person_id
        ? {
            company_id: params.companyId,
            field: "owner_person_id",
            old_value: current.owner_person_id,
            new_value: parsed.data.owner_person_id,
            changed_by_person_id: personId,
            change_source: "manual",
            reason: parsed.data.reason,
          }
        : null,
    ].filter((event): event is NonNullable<typeof event> => event !== null);
    if (events.length) {
      const { error: eventsError } = await db
        .from("crm_account_profile_events")
        .insert(events);
      if (eventsError) return apiErrorResponse(eventsError);
    }

    return NextResponse.json({ data });
  },
);
