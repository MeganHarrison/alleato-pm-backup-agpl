import { NextResponse } from "next/server";
// Dispatched by the consolidated CRM catch-all route.
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

type Params = { activityId: string };
const PatchSchema = z.object({
  activity_type: z.enum(["call", "email", "meeting", "note"]).optional(),
  subject: z.string().trim().min(1).max(300).optional(),
  body: z.string().trim().max(8000).nullable().optional(),
  occurred_at: z.string().datetime({ offset: true }).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required.");

async function requireEditableActivity(activityId: string) {
  const access = await requireCrmAccess("write");
  const { data, error } = await access.db
    .from("crm_activities")
    .select("id, record_origin, created_by_person_id")
    .eq("id", activityId)
    .maybeSingle();
  if (error) return { access, response: apiErrorResponse(error) };
  if (!data) {
    throw new GuardrailError({ code: "NOT_FOUND", where: "crm/activities/[activityId]", message: "Activity not found.", status: 404 });
  }
  if (data.record_origin !== "manual") {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: "crm/activities/[activityId]",
      message: "Automatically sourced activity must be corrected through candidate review.",
      status: 409,
    });
  }
  if (!access.isAdmin && data.created_by_person_id !== access.personId) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "crm/activities/[activityId]",
      message: "Only the activity author or a CRM administrator can change it.",
      status: 403,
    });
  }
  return { access, response: null };
}

export const PATCH = withApiGuardrails<Params>(
  "crm/activities/[activityId]#PATCH",
  async ({ request, params }) => {
    assertNonNilUuid(params.activityId, "activityId", "crm/activities/[activityId]#PATCH");
    const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/activities/[activityId]#PATCH",
        message: "Invalid activity correction.",
        status: 400,
      });
    }
    const { access, response } = await requireEditableActivity(params.activityId);
    if (response) return response;
    const { data, error } = await access.db
      .from("crm_activities")
      .update(parsed.data)
      .eq("id", params.activityId)
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data });
  },
);

export const DELETE = withApiGuardrails<Params>(
  "crm/activities/[activityId]#DELETE",
  async ({ params }) => {
    assertNonNilUuid(params.activityId, "activityId", "crm/activities/[activityId]#DELETE");
    const { access, response } = await requireEditableActivity(params.activityId);
    if (response) return response;
    const { data, error } = await access.db
      .from("crm_activities")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.activityId)
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data });
  },
);
