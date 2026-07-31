import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { requireUserManagementAccess } from "@/lib/auth/user-management-access";
import { serviceDb } from "@/lib/supabase/service-db";
import { ALL_GRANULAR_FLAGS, type GranularFlag } from "@/lib/permissions-shared";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ personId: string }>;
}

const GranularOverrideBody = z.object({
  flag: z.enum(ALL_GRANULAR_FLAGS as [GranularFlag, ...GranularFlag[]]),
  effect: z.enum(["allow", "deny"]),
  project_id: z.coerce.number().int().positive().nullable().optional(),
});

const RemoveGranularOverrideBody = z.object({
  flag: z.enum(ALL_GRANULAR_FLAGS as [GranularFlag, ...GranularFlag[]]),
  project_id: z.coerce.number().int().positive().nullable().optional(),
});

async function requireAdmin(where: string) {
  return requireUserManagementAccess(where);
}

export const PUT = withApiGuardrails(
  "permissions/users/[personId]/granular-overrides#PUT",
  async ({ request, params }) => {
    const actor = await requireAdmin("permissions/users/[personId]/granular-overrides#PUT");
    const { personId } = await params;
    const parsed = GranularOverrideBody.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid granular permission override.",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const body = parsed.data;

    const { data: person, error: personError } = await serviceDb.from("people")
      .select("id")
      .eq("id", personId)
      .maybeSingle();

    if (personError || !person) {
      return NextResponse.json({ error: "Selected employee no longer exists." }, { status: 404 });
    }

    const existingQuery = serviceDb.from("user_granular_permission_overrides")
      .select("id")
      .eq("person_id", personId)
      .eq("flag", body.flag);

    const { data: existing, error: existingError } =
      body.project_id == null
        ? await existingQuery.is("project_id", null).maybeSingle()
        : await existingQuery.eq("project_id", body.project_id).maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: `Could not check existing override: ${existingError.message}` },
        { status: 500 },
      );
    }

    const payload = {
      project_id: body.project_id ?? null,
      person_id: personId,
      flag: body.flag,
      effect: body.effect,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    };

    const write =
      existing?.id
        ? await serviceDb.from("user_granular_permission_overrides")
            .update(payload)
            .eq("id", existing.id)
            .select("id, project_id, flag, effect")
            .single()
        : await serviceDb.from("user_granular_permission_overrides")
            .insert(payload)
            .select("id, project_id, flag, effect")
            .single();

    if (write.error || !write.data) {
      return NextResponse.json(
        { error: `Could not save granular override: ${write.error?.message ?? "no row returned"}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: write.data });
  },
);

export const DELETE = withApiGuardrails(
  "permissions/users/[personId]/granular-overrides#DELETE",
  async ({ request, params }) => {
    await requireAdmin("permissions/users/[personId]/granular-overrides#DELETE");
    const { personId } = await params;
    const parsed = RemoveGranularOverrideBody.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid granular permission override removal.",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const body = parsed.data;
        const deleteQuery = serviceDb.from("user_granular_permission_overrides")
      .delete()
      .eq("person_id", personId)
      .eq("flag", body.flag);

    const { error } =
      body.project_id == null
        ? await deleteQuery.is("project_id", null)
        : await deleteQuery.eq("project_id", body.project_id);

    if (error) {
      return NextResponse.json(
        { error: `Could not remove granular override: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  },
);
