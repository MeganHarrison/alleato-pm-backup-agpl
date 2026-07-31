import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireAdmin } from "@/app/api/admin/_shared";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { sendEmail } from "@/lib/email/send";
import InviteUser from "@/emails/auth/InviteUser";
import { APP_BASE_URL } from "@/lib/email/client";
import {
  buildInviteAcceptUrl,
  buildPasswordResetUrl,
} from "@/lib/email/invite-links";

const WHERE = "directory/employees/[employeeId]/resend-invite#POST";

type ActionLink = { type: "invite" | "recovery"; actionLink: string };

/**
 * Get a fresh Supabase Auth action link for the person, picking the right kind
 * automatically:
 *   - "invite"   creates the account (if none) or re-issues the invite for an
 *                unconfirmed account.
 *   - "recovery" is the fallback for an account that already exists and is
 *                confirmed, so the person can set a password and sign in.
 * Trying invite first and falling back to recovery avoids having to pre-classify
 * the account state.
 */
async function generateActionLink(
  service: ReturnType<typeof createServiceClient>,
  email: string,
  fullName: string,
  role: string,
): Promise<ActionLink> {
  const invite = await service.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: `${APP_BASE_URL}/auth/callback`,
      data: { full_name: fullName, role },
    },
  });

  if (!invite.error && invite.data?.properties?.action_link) {
    return { type: "invite", actionLink: invite.data.properties.action_link };
  }

  const recovery = await service.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (!recovery.error && recovery.data?.properties?.action_link) {
    return { type: "recovery", actionLink: recovery.data.properties.action_link };
  }

  throw new GuardrailError({
    code: "UPSTREAM_FAILURE",
    where: WHERE,
    message:
      recovery.error?.message ??
      invite.error?.message ??
      "Could not create an invite link.",
    details: { invite: invite.error, recovery: recovery.error },
  });
}

/**
 * Resend an app-login invite to an Alleato employee so they can set a password
 * and sign in. Admin-only. Used by the "Resend invite" action on the Employees
 * directory page for people whose access status is "invited".
 */
export const POST = withApiGuardrails(WHERE, async ({ params }) => {
  await requireAdmin(WHERE);
  const actor = await getApiRouteUser();

  const { employeeId } = (await params) as { employeeId?: string };
  if (!employeeId) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Missing employee id.",
    });
  }

  const { data: person, error: personError } = await serviceDb
    .from("people")
    .select("id, first_name, last_name, email, job_title, auth_user_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (personError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Could not load the employee.",
      details: personError,
    });
  }

  if (!person) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE,
      message: "Employee not found.",
      status: 404,
    });
  }

  const email = person.email?.trim();
  if (!email) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message:
        "This employee has no email address on file, so no invite can be sent.",
    });
  }

  const fullName =
    `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || email;
  const role = person.job_title || "Team Member";

  const service = createServiceClient();
  const link = await generateActionLink(service, email, fullName, role);

  const acceptUrl =
    link.type === "invite"
      ? buildInviteAcceptUrl(link.actionLink, email)
      : buildPasswordResetUrl(link.actionLink, email);

  const emailResult = await sendEmail({
    template: "user-invite",
    to: email,
    subject: "You're invited to Alleato",
    react: InviteUser({
      inviterName: actor?.email ?? "Alleato",
      inviteeName: fullName,
      email,
      role,
      acceptUrl,
      expiresInHours: 24,
    }),
    entity: { type: "user_invite_resend", id: person.auth_user_id ?? email },
    userId: person.auth_user_id ?? undefined,
    idempotencyKey: `resend-invite/${person.id}/${Date.now()}`,
    metadata: { source: "employees-directory", linkType: link.type },
  });

  if (emailResult.error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: `${WHERE}:send-email`,
      message: `Could not send the invite email: ${emailResult.error.message}`,
      details: emailResult.error,
    });
  }

  return NextResponse.json({ success: true, linkType: link.type });
});
