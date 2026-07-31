import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { sendEmail } from "@/lib/email/send";
import ForgotPassword from "@/emails/auth/ForgotPassword";
import { APP_BASE_URL } from "@/lib/email/client";

/**
 * Admin endpoint to resend password reset emails to users who received broken links.
 * This should only be called once after the fix is deployed.
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    // Query for password reset emails sent in the past 7 days
    const { data: emailEvents, error: queryError } = await serviceDb.from("email_events")
      .select("to_email, created_at")
      .eq("template", "forgot-password")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    if (queryError) {
      return NextResponse.json({ error: queryError }, { status: 500 });
    }

    if (!emailEvents || emailEvents.length === 0) {
      return NextResponse.json({
        message: "No password reset emails found in the past 7 days",
        count: 0,
      });
    }

    // Deduplicate by email
    const uniqueEmails = [...new Set(emailEvents.map((e) => e.to_email))];

    console.log(`[resend-password-reset] Found ${uniqueEmails.length} affected users`);

    // For each email, generate a fresh password reset link
    const results = [];
    for (const email of uniqueEmails) {
      try {
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo: `${APP_BASE_URL}/auth/callback`,
          },
        });

        if (linkError || !linkData.properties?.action_link) {
          console.warn(`[resend-password-reset] Failed to generate link for ${email}:`, linkError);
          results.push({ email, success: false, error: linkError?.message });
          continue;
        }

        // Build the confirm URL with proper token encoding
        const actionUrl = new URL(linkData.properties.action_link);
        const token = actionUrl.searchParams.get("token");
        const resetUrl = `${APP_BASE_URL}/auth/confirm?token_hash=${encodeURIComponent(token || "")}&type=recovery&next=${encodeURIComponent("/auth/update-password?email=" + encodeURIComponent(email))}`;

        // Send email
        await sendEmail({
          template: "forgot-password",
          to: email,
          subject: "Password Reset Link (Fixed)",
          react: ForgotPassword({
            userName: linkData.user?.user_metadata?.full_name as string | undefined,
            resetUrl,
            expiresInMinutes: 60,
          }),
          entity: { type: "password_reset_resend", id: email },
          userId: linkData.user?.id ?? undefined,
          idempotencyKey: `resend-password-reset/${email}/${Date.now()}`,
          metadata: {
            source: "admin-resend",
            original_request: "pre-fix-token-encoding-bug",
          },
        });

        results.push({ email, success: true });
        console.log(`[resend-password-reset] Sent to ${email}`);
      } catch (error) {
        console.error(`[resend-password-reset] Error for ${email}:`, error);
        results.push({
          email,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Resent password reset emails`,
      total: uniqueEmails.length,
      successful: successCount,
      failed: uniqueEmails.length - successCount,
      results,
    });
  } catch (error) {
    console.error("[resend-password-reset] Endpoint error:", error);
    return apiErrorResponse(error);
  }
}
