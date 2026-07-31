import { withApiGuardrails } from "@/lib/guardrails/api";
import { reassignEmailAttachmentProject } from "@/lib/email/email-attachment-updates";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createOutlookIntakeServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { z } from "zod";

async function assertAdminAccess(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Authentication required.",
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: profileError.message,
    });
  }

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Admin access required.",
      status: 403,
    });
  }

  return supabase;
}

const patchSchema = z.object({
  attachmentType: z.string().trim().max(100).nullable().optional(),
  attachmentCategory: z.string().trim().max(100).nullable().optional(),
  projectId: z.number().int().positive().optional(),
});

export const PATCH = withApiGuardrails<{ attachmentId: string }>(
  "email-attachments/[attachmentId]#PATCH",
  async ({ request, params }) => {
    const { attachmentId } = params;
    const id = Number.parseInt(attachmentId, 10);

    if (!Number.isInteger(id)) {
      throw new GuardrailError({
        code: "INVALID_INPUT",
        where: "email-attachments/[attachmentId]#PATCH",
        message: "Attachment id must be a number.",
        status: 400,
      });
    }

    const supabase = await assertAdminAccess(
      "email-attachments/[attachmentId]#PATCH",
    );

    const body: unknown = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_INPUT",
        where: "email-attachments/[attachmentId]#PATCH",
        message: parsed.error.message,
        status: 400,
      });
    }

    const updates: Record<string, string | null> = {};
    if (parsed.data.attachmentType !== undefined) {
      updates.attachment_type = parsed.data.attachmentType;
    }
    if (parsed.data.attachmentCategory !== undefined) {
      updates.attachment_category = parsed.data.attachmentCategory;
    }

    let project: {
      id: number;
      name: string | null;
      projectNumber: string | null;
    } | null = null;

    if (parsed.data.projectId !== undefined) {
      project = await reassignEmailAttachmentProject({
        supabase,
        attachmentId: id,
        nextProjectId: parsed.data.projectId,
        where: "email-attachments/[attachmentId]#PATCH",
      });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, project });
    }

    const { error } = await supabase
      .from("email_attachments")
      .update(updates)
      .eq("id", id);

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-attachments/[attachmentId]#PATCH",
        message: error.message,
      });
    }

    return NextResponse.json({ success: true, project });
  },
);

export const DELETE = withApiGuardrails<{ attachmentId: string }>(
  "email-attachments/[attachmentId]#DELETE",
  async ({ params }) => {
    const { attachmentId } = params;
    const id = Number.parseInt(attachmentId, 10);

    if (!Number.isInteger(id)) {
      throw new GuardrailError({
        code: "INVALID_INPUT",
        where: "email-attachments/[attachmentId]#DELETE",
        message: "Attachment id must be a number.",
        status: 400,
      });
    }

    const supabase = await assertAdminAccess(
      "email-attachments/[attachmentId]#DELETE",
    );
    const intakeSupabase = createOutlookIntakeServiceClient();

    // Remove junction table rows first to avoid FK violations
    await intakeSupabase
      .from("outlook_email_intake_attachments")
      .delete()
      .eq("email_attachment_id", id);

    const { error } = await supabase
      .from("email_attachments")
      .delete()
      .eq("id", id);

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-attachments/[attachmentId]#DELETE",
        message: error.message,
      });
    }

    return NextResponse.json({ success: true });
  },
);
