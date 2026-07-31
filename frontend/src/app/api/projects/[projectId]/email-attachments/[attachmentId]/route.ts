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

export const PATCH = withApiGuardrails<{ projectId: string; attachmentId: string }>(
  "projects/[projectId]/email-attachments/[attachmentId]#PATCH",
  async ({ request, params }) => {
    const { projectId, attachmentId } = params;
    const projectIdNumber = Number.parseInt(projectId, 10);
    const id = Number.parseInt(attachmentId, 10);

    if (!Number.isInteger(projectIdNumber) || !Number.isInteger(id)) {
      throw new GuardrailError({
        code: "INVALID_INPUT",
        where: "projects/[projectId]/email-attachments/[attachmentId]#PATCH",
        message: "Project id and attachment id must be numbers.",
        status: 400,
      });
    }

    const supabase = await assertAdminAccess(
      "projects/[projectId]/email-attachments/[attachmentId]#PATCH",
    );

    const body: unknown = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_INPUT",
        where: "projects/[projectId]/email-attachments/[attachmentId]#PATCH",
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
        currentProjectId: projectIdNumber,
        where: "projects/[projectId]/email-attachments/[attachmentId]#PATCH",
      });
    } else {
      // Verify the attachment belongs to the project via its email before field-only updates.
      const { data: existing, error: lookupError } = await supabase
        .from("email_attachments")
        .select("id, project_emails!inner(project_id)")
        .eq("id", id)
        .eq("project_emails.project_id", projectIdNumber)
        .single();

      if (lookupError || !existing) {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where: "projects/[projectId]/email-attachments/[attachmentId]#PATCH",
          message: "Attachment not found for this project.",
          status: 404,
        });
      }
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
        where: "projects/[projectId]/email-attachments/[attachmentId]#PATCH",
        message: error.message,
      });
    }

    return NextResponse.json({ success: true, project });
  },
);

export const DELETE = withApiGuardrails<{ projectId: string; attachmentId: string }>(
  "projects/[projectId]/email-attachments/[attachmentId]#DELETE",
  async ({ params }) => {
    const { projectId, attachmentId } = params;
    const projectIdNumber = Number.parseInt(projectId, 10);
    const id = Number.parseInt(attachmentId, 10);

    if (!Number.isInteger(projectIdNumber) || !Number.isInteger(id)) {
      throw new GuardrailError({
        code: "INVALID_INPUT",
        where: "projects/[projectId]/email-attachments/[attachmentId]#DELETE",
        message: "Project id and attachment id must be numbers.",
        status: 400,
      });
    }

    const supabase = await assertAdminAccess(
      "projects/[projectId]/email-attachments/[attachmentId]#DELETE",
    );
    const intakeSupabase = createOutlookIntakeServiceClient();

    // Verify the attachment belongs to the project
    const { data: existing, error: lookupError } = await supabase
      .from("email_attachments")
      .select("id, project_emails!inner(project_id)")
      .eq("id", id)
      .eq("project_emails.project_id", projectIdNumber)
      .single();

    if (lookupError || !existing) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "projects/[projectId]/email-attachments/[attachmentId]#DELETE",
        message: "Attachment not found for this project.",
        status: 404,
      });
    }

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
        where: "projects/[projectId]/email-attachments/[attachmentId]#DELETE",
        message: error.message,
      });
    }

    return NextResponse.json({ success: true });
  },
);
