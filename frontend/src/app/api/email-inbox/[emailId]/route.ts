export const dynamic = "force-dynamic";

import { z } from "zod";
import { NextResponse } from "next/server";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createOutlookIntakeServiceClient } from "@/lib/supabase/service";

const PatchSchema = z.object({
  project_id: z.number().int().positive().nullable().optional(),
  starred: z.boolean().optional(),
  tags: z.array(z.string().trim().max(50)).max(10).optional(),
});

export const PATCH = withApiGuardrails<{ emailId: string }>(
  "email-inbox/[emailId]#PATCH",
  async ({ request, params }) => {
    const supabase = await createClient();
    const intakeService = createOutlookIntakeServiceClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "email-inbox/[emailId]#PATCH",
        message: "Authentication required.",
      });
    }

    const { emailId: rawId } = await params;
    const emailId = parseInt(rawId, 10);

    if (!Number.isFinite(emailId) || emailId <= 0) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "email-inbox/[emailId]#PATCH",
        message: "Invalid email ID.",
        status: 400,
      });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.is_admin === true;

    // Verify the user can modify this email
    const { data: existing, error: fetchError } = await intakeService
      .from("outlook_email_intake")
      .select("id, mailbox_user_id, project_id, source_metadata")
      .eq("id", emailId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError || !existing) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "email-inbox/[emailId]#PATCH",
        message: "Email not found.",
        status: 404,
      });
    }

    if (!isAdmin && existing.mailbox_user_id !== user.email) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "email-inbox/[emailId]#PATCH",
        message: "Not authorized to modify this email.",
        status: 403,
      });
    }

    const parsed = await parseJsonBody(request, PatchSchema, "email-inbox/[emailId]#PATCH");
    const update: Record<string, unknown> = {};

    if (parsed.project_id !== undefined) {
      update.project_id = parsed.project_id;
      update.match_status = parsed.project_id ? "matched" : "unassigned";
      update.assignment_method = "manual";
      update.assignment_confidence = parsed.project_id ? 1.0 : null;
    }

    // Merge inbox metadata (starred, tags) into source_metadata._inbox namespace
    if (parsed.starred !== undefined || parsed.tags !== undefined) {
      const existingMeta =
        (existing.source_metadata as Record<string, unknown>) ?? {};
      const existingInbox =
        (existingMeta._inbox as Record<string, unknown>) ?? {};
      const inboxUpdate: Record<string, unknown> = { ...existingInbox };
      if (parsed.starred !== undefined) inboxUpdate.starred = parsed.starred;
      if (parsed.tags !== undefined) inboxUpdate.tags = parsed.tags;
      update.source_metadata = { ...existingMeta, _inbox: inboxUpdate };
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ id: emailId });
    }

    const { data, error } = await intakeService
      .from("outlook_email_intake")
      .update(update)
      .eq("id", emailId)
      .select(
        "id, project_id, match_status, assignment_method, assignment_confidence, source_metadata",
      )
      .single();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-inbox/[emailId]#PATCH",
        message: error.message,
      });
    }

    return NextResponse.json(data);
  },
);
