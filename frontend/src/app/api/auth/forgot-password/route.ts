import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import ForgotPassword from "@/emails/auth/ForgotPassword";
import { APP_BASE_URL } from "@/lib/email/client";
import { buildPasswordResetUrl } from "@/lib/email/invite-links";
import { sendEmail } from "@/lib/email/send";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createServiceClient } from "@/lib/supabase/service";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const POST = withApiGuardrails("auth/forgot-password#POST", async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error_message: "A valid email is required." },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const serviceClient = createServiceClient();

    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${APP_BASE_URL}/auth/callback`,
      },
    });

    // Keep the public response neutral so the endpoint does not expose whether an
    // account exists for the submitted email.
    if (linkError || !linkData.properties?.action_link) {
      return NextResponse.json({ success: true });
    }

    const resetUrl = buildPasswordResetUrl(linkData.properties.action_link, email);
    const requestIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      undefined;
    const userId = linkData.user?.id ?? email;

    await sendEmail({
      template: "forgot-password",
      to: email,
      subject: "Reset your Alleato password",
      react: ForgotPassword({
        userName: linkData.user?.user_metadata?.full_name as string | undefined,
        resetUrl,
        expiresInMinutes: 60,
        requestIp,
      }),
      entity: { type: "password_reset", id: userId },
      userId: linkData.user?.id ?? undefined,
      idempotencyKey: `forgot-password/${userId}/${Date.now()}`,
      metadata: {
        source: "forgot-password-form",
        has_user: Boolean(linkData.user?.id),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[forgot-password] failed to process reset request", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Keep the public response neutral for all failures.
    return NextResponse.json({ success: true });
  }
});
