import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import SubmittalDistributedNotification from "@/emails/submittals/SubmittalDistributedNotification";
import { apiErrorResponse } from "@/lib/api-error";
import { APP_BASE_URL } from "@/lib/email/client";
import { sendEmail } from "@/lib/email/send";
import { shouldSendSubmittalDistributionEmail } from "@/lib/submittals/distribution-email-settings";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

interface RouteParams {
  params: Promise<{ projectId: string; submittalId: string }>;
}

const distributeSchema = z.object({
  recipient_ids: z.array(z.string().uuid()).min(1, "At least one recipient required"),
  message: z.string().nullable().optional(),
});

/**
 * POST /api/projects/[projectId]/submittals/[submittalId]/distribute
 * Distributes the submittal to a list of recipients.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/distribute#POST",
  async ({ request, params }) => {

    const { projectId, submittalId } = await params;
    const numericProjectId = Number(projectId);
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/submittals/[submittalId]/distribute#POST", message: "Authentication required." });
    }

    const body = await request.json();
    const { recipient_ids, message } = distributeSchema.parse(body);

    const [
      { data: submittal, error: submittalError },
      { data: project },
      { data: senderProfile },
      { data: recipients, error: recipientsError },
      { data: emailSettings, error: emailSettingsError },
    ] = await Promise.all([
      serviceDb.from("submittals")
        .select("id, project_id, submittal_number, title")
        .eq("id", submittalId)
        .eq("project_id", numericProjectId)
        .maybeSingle(),
      serviceDb.from("projects")
        .select("name")
        .eq("id", numericProjectId)
        .maybeSingle(),
      serviceDb.from("user_profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle(),
      serviceDb.from("user_profiles")
        .select("id, full_name, email")
        .in("id", recipient_ids),
      serviceDb.from("submittal_project_settings")
        .select("email_notify_submittal_distributed")
        .eq("project_id", numericProjectId)
        .maybeSingle(),
    ]);

    if (submittalError || !submittal) {
      return NextResponse.json(
        { error: submittalError?.message ?? "Submittal not found." },
        { status: 404 },
      );
    }

    if (recipientsError) {
      return apiErrorResponse(recipientsError);
    }

    if (emailSettingsError) {
      return apiErrorResponse(emailSettingsError);
    }

    const shouldSendEmail =
      shouldSendSubmittalDistributionEmail(emailSettings);

    const recipientList = (recipients ?? []).filter((recipient) =>
      recipient.email?.trim(),
    );

    if (shouldSendEmail && recipientList.length === 0) {
      return NextResponse.json(
        { error: "No valid recipient email addresses were found." },
        { status: 422 },
      );
    }

    // Create the distribution record
    const { data: distribution, error: distError } = await supabase
      .from("submittal_distributions")
      .insert({
        submittal_id: submittalId,
        from_id: user.id,
        message: message ?? null,
        distributed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (distError) {
      return apiErrorResponse(distError);
    }

    // Create recipient records
    const recipientRows = recipient_ids.map((rid) => ({
      distribution_id: distribution.id,
      recipient_id: rid,
    }));

    const { error: recipError } = await supabase
      .from("submittal_distribution_recipients")
      .insert(recipientRows);

    if (recipError) {
      return apiErrorResponse(recipError);
    }

    // Update submittal status to Distributed
    const { error: statusError } = await supabase
      .from("submittals")
      .update({
        status: "Distributed",
        sent_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", submittalId);

    if (statusError) {
      return apiErrorResponse(statusError);
    }

    const projectName = project?.name ?? `Project #${numericProjectId}`;
    const distributedBy =
      senderProfile?.full_name?.trim() ||
      senderProfile?.email?.split("@")[0] ||
      user.email ||
      "A team member";
    const viewUrl = `${APP_BASE_URL}/${numericProjectId}/submittals/${submittalId}`;
    const subject = `${submittal.submittal_number} distributed - ${submittal.title}`;

    const emailResults = shouldSendEmail
      ? await Promise.all(
          recipientList.map((recipient) =>
            sendEmail({
              template: "submittal-notification",
              to: recipient.email,
              subject,
              react: SubmittalDistributedNotification({
                recipientName: recipient.full_name ?? recipient.email,
                projectName,
                submittalNumber: submittal.submittal_number,
                submittalTitle: submittal.title,
                distributedBy,
                message,
                viewUrl,
              }),
              entity: { type: "submittal", id: submittalId },
              userId: recipient.id,
              idempotencyKey: `submittal-distributed/${distribution.id}/${recipient.id}`,
              metadata: {
                project_id: numericProjectId,
                distribution_id: distribution.id,
                submittal_id: submittalId,
                recipient_id: recipient.id,
              },
            }),
          ),
        )
      : [];

    const failedEmail = emailResults.find((result) => result.error);
    if (failedEmail?.error) {
      return NextResponse.json(
        { error: `Submittal distributed, but notification email failed: ${failedEmail.error.message}` },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        ...distribution,
        email_count: emailResults.length,
        email_skipped_reason: shouldSendEmail
          ? null
          : "project_email_disabled",
      },
      { status: 201 },
    );
    },
);
