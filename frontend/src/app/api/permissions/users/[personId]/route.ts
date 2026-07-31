import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireUserManagementAccess } from "@/lib/auth/user-management-access";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database } from "@/types/database.types";

async function requireAdmin(where: string) {
  return requireUserManagementAccess(where);
}

const PatchUserBody = z
  .object({
    first_name: z.string().trim().min(1).optional(),
    last_name: z.string().trim().optional(),
    email: z.string().trim().email().optional(),
    person_type: z.string().trim().min(1).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one editable user field is required.",
  });

export const PATCH = withApiGuardrails(
  "permissions/users/[personId]#PATCH",
  async ({ request, params }) => {
    await requireAdmin("permissions/users/[personId]#PATCH");
    const { personId } = await params;
    const parsed = PatchUserBody.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid user update." },
        { status: 400 },
      );
    }

    const service = createServiceClient();
    const { data: person, error: personError } = await serviceDb.from("people")
      .select("id, auth_user_id, first_name, last_name, email")
      .eq("id", personId)
      .maybeSingle();

    if (personError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users/[personId]#PATCH:load-person",
        message: "Failed to load user.",
        details: personError,
      });
    }

    if (!person) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "permissions/users/[personId]#PATCH",
        message: "User not found.",
        status: 404,
      });
    }

    const updates = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await serviceDb.from("people")
      .update(updates)
      .eq("id", personId);

    if (updateError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users/[personId]#PATCH:update-person",
        message: "Failed to update user.",
        details: updateError,
      });
    }

    if (person.auth_user_id) {
      const firstName = parsed.data.first_name ?? person.first_name ?? "";
      const lastName = parsed.data.last_name ?? person.last_name ?? "";
      const profileUpdates: Database["public"]["Tables"]["user_profiles"]["Update"] = {
        updated_at: new Date().toISOString(),
      };

      if (
        parsed.data.first_name !== undefined ||
        parsed.data.last_name !== undefined
      ) {
        profileUpdates.full_name =
          [firstName, lastName].filter(Boolean).join(" ") ||
          parsed.data.email ||
          person.email ||
          "";
      }

      if (parsed.data.email) {
        profileUpdates.email = parsed.data.email;
      }

      if (Object.keys(profileUpdates).length > 1) {
        const { error: profileError } = await serviceDb.from("user_profiles")
          .update(profileUpdates)
          .eq("id", person.auth_user_id);

        if (profileError) {
          throw new GuardrailError({
            code: "UPSTREAM_FAILURE",
            where: "permissions/users/[personId]#PATCH:update-profile",
            message: "Failed to update the user profile.",
            details: profileError,
          });
        }
      }

      if (parsed.data.email && parsed.data.email !== person.email) {
        const { error: authError } = await service.auth.admin.updateUserById(
          person.auth_user_id,
          { email: parsed.data.email },
        );

        if (authError) {
          throw new GuardrailError({
            code: "UPSTREAM_FAILURE",
            where: "permissions/users/[personId]#PATCH:update-auth-email",
            message: "Failed to update the authentication email.",
            details: authError,
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  },
);

export const DELETE = withApiGuardrails(
  "permissions/users/[personId]#DELETE",
  async ({ params }) => {
    await requireAdmin("permissions/users/[personId]#DELETE");
    const { personId } = await params;
    const service = createServiceClient();

    const { data: person, error: personError } = await serviceDb.from("people")
      .select("id, auth_user_id")
      .eq("id", personId)
      .maybeSingle();

    if (personError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users/[personId]#DELETE",
        message: "Failed to load user.",
        details: personError,
      });
    }

    if (!person) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "permissions/users/[personId]#DELETE",
        message: "User not found.",
        status: 404,
      });
    }

    const { error: companyTemplateError } = await serviceDb.from("person_company_templates")
      .delete()
      .eq("person_id", personId);

    if (companyTemplateError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users/[personId]#DELETE:company-template",
        message: "Failed to remove company-wide access.",
        details: companyTemplateError,
      });
    }

    const { error: companyOverrideError } = await serviceDb.from("user_granular_permission_overrides")
      .delete()
      .eq("person_id", personId)
      .is("project_id", null);

    if (companyOverrideError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "permissions/users/[personId]#DELETE:company-overrides",
        message: "Failed to remove company-wide permission exceptions.",
        details: companyOverrideError,
      });
    }

    if (person.auth_user_id) {
      const { error: profileError } = await serviceDb.from("user_profiles")
        .update({ is_admin: false, updated_at: new Date().toISOString() })
        .eq("id", person.auth_user_id);

      if (profileError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "permissions/users/[personId]#DELETE:user-profile",
          message: "Failed to remove admin access.",
          details: profileError,
        });
      }
    }

    return NextResponse.json({ success: true });
  },
);
