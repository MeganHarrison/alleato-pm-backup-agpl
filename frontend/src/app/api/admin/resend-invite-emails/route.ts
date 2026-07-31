import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { sendEmail } from "@/lib/email/send";
import InviteUser from "@/emails/auth/InviteUser";
import { APP_BASE_URL } from "@/lib/email/client";
import { buildInviteAcceptUrl } from "@/lib/email/invite-links";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: emailEvents, error: queryError } = await serviceDb.from("email_events")
      .select("to_email, created_at")
      .eq("template", "user-invite")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false });

    if (queryError) {
      return NextResponse.json({ error: queryError }, { status: 500 });
    }

    if (!emailEvents || emailEvents.length === 0) {
      return NextResponse.json({
        message: "No invite emails found in the past 7 days",
        count: 0,
      });
    }

    const uniqueEmails = [...new Set(emailEvents.map((e) => e.to_email))];

    const results = [];
    for (const email of uniqueEmails) {
      try {
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: "invite",
          email,
          options: { redirectTo: APP_BASE_URL + "/auth/callback" },
        });

        if (linkError || !linkData.properties?.action_link) {
          results.push({ email, success: false, error: linkError?.message });
          continue;
        }

        const inviteUrl = buildInviteAcceptUrl(linkData.properties.action_link, email);

        await sendEmail({
          template: "user-invite",
          to: email,
          subject: "You're invited to Alleato",
          react: InviteUser({ inviterName: "Alleato", email, acceptUrl: inviteUrl }),
          entity: { type: "user_invite_resend", id: email },
          userId: linkData.user?.id ?? undefined,
          idempotencyKey: "resend-invite/" + email + "/" + Date.now(),
          metadata: {
            source: "admin-resend",
            reason: "fixed-token-encoding-bug",
          },
        });

        results.push({ email, success: true });
      } catch (error) {
        results.push({
          email,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({
      message: "Resent invite emails to new accounts",
      total: uniqueEmails.length,
      successful: successCount,
      failed: uniqueEmails.length - successCount,
      results,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
