export const dynamic = "force-dynamic";

import { z } from "zod";
import { NextResponse } from "next/server";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createOutlookIntakeServiceClient } from "@/lib/supabase/service";

const PatchSchema = z.object({
  attachmentType: z.string().trim().max(100).nullable(),
});

export const PATCH = withApiGuardrails<{ attachmentId: string }>(
  "email-inbox/attachments/[attachmentId]#PATCH",
  async ({ request, params }) => {
    const supabase = await createClient();
    const intakeService = createOutlookIntakeServiceClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "email-inbox/attachments/[attachmentId]#PATCH",
        message: "Authentication required.",
      });
    }

    const { attachmentId: rawId } = await params;
    const attachmentId = parseInt(rawId, 10);

    if (!Number.isFinite(attachmentId) || attachmentId <= 0) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "email-inbox/attachments/[attachmentId]#PATCH",
        message: "Invalid attachment ID.",
        status: 400,
      });
    }

    const parsed = await parseJsonBody(
      request,
      PatchSchema,
      "email-inbox/attachments/[attachmentId]#PATCH",
    );

    // Fetch existing record to merge source_metadata
    const { data: existing, error: fetchErr } = await intakeService
      .from("outlook_email_intake_attachments")
      .select("id, source_metadata, intake_email_id")
      .eq("id", attachmentId)
      .maybeSingle();

    if (fetchErr || !existing) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "email-inbox/attachments/[attachmentId]#PATCH",
        message: "Attachment not found.",
        status: 404,
      });
    }

    // Verify user can access this email's attachment
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.is_admin === true;

    if (!isAdmin) {
      const { data: parentEmail } = await intakeService
        .from("outlook_email_intake")
        .select("mailbox_user_id")
        .eq("id", existing.intake_email_id)
        .maybeSingle();

      if (!parentEmail || parentEmail.mailbox_user_id !== user.email) {
        throw new GuardrailError({
          code: "FORBIDDEN",
          where: "email-inbox/attachments/[attachmentId]#PATCH",
          message: "Not authorized to modify this attachment.",
          status: 403,
        });
      }
    }

    const existingMeta =
      (existing.source_metadata as Record<string, unknown>) ?? {};
    const existingInbox = (existingMeta._inbox as Record<string, unknown>) ?? {};
    const updatedMeta = {
      ...existingMeta,
      _inbox: {
        ...existingInbox,
        type: parsed.attachmentType,
      },
    };

    const { data, error } = await intakeService
      .from("outlook_email_intake_attachments")
      .update({ source_metadata: updatedMeta })
      .eq("id", attachmentId)
      .select("id, source_metadata")
      .single();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-inbox/attachments/[attachmentId]#PATCH",
        message: error.message,
      });
    }

    return NextResponse.json(data);
  },
);
