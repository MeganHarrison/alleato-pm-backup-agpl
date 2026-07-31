import type { SupabaseClient } from "@supabase/supabase-js";

import { GuardrailError } from "@/lib/guardrails/errors";
import { createOutlookIntakeServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";

type ServerSupabaseClient = SupabaseClient<Database>;

interface ReassignEmailAttachmentProjectInput {
  supabase: ServerSupabaseClient;
  attachmentId: number;
  nextProjectId: number;
  where: string;
  currentProjectId?: number;
}

interface ReassignedProject {
  id: number;
  name: string | null;
  projectNumber: string | null;
}

export async function reassignEmailAttachmentProject({
  supabase,
  attachmentId,
  nextProjectId,
  where,
  currentProjectId,
}: ReassignEmailAttachmentProjectInput): Promise<ReassignedProject> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, project_number")
    .eq("id", nextProjectId)
    .maybeSingle();

  if (projectError || !project) {
    throw new GuardrailError({
      code: "INVALID_INPUT",
      where,
      message: "Selected project does not exist.",
      status: 400,
      details: projectError?.message,
    });
  }

  const { data: attachment, error: attachmentError } = await supabase
    .from("email_attachments")
    .select(
      `
        id,
        email_id,
        project_emails!inner (
          id,
          project_id,
          graph_message_id
        )
      `,
    )
    .eq("id", attachmentId)
    .maybeSingle();

  if (attachmentError || !attachment?.project_emails) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where,
      message: "Attachment not found.",
      status: 404,
      details: attachmentError?.message,
    });
  }

  if (
    currentProjectId !== undefined &&
    attachment.project_emails.project_id !== currentProjectId
  ) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where,
      message: "Attachment not found for this project.",
      status: 404,
    });
  }

  if (attachment.project_emails.project_id === nextProjectId) {
    return {
      id: project.id,
      name: project.name,
      projectNumber: project.project_number,
    };
  }

  const now = new Date().toISOString();
  const parentEmailId = attachment.project_emails.id;
  const graphMessageId = attachment.project_emails.graph_message_id;
  const intakeSupabase = createOutlookIntakeServiceClient();

  const { error: emailUpdateError } = await supabase
    .from("project_emails")
    .update({
      project_id: nextProjectId,
      updated_at: now,
    })
    .eq("id", parentEmailId);

  if (emailUpdateError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: "Failed to update the parent email project assignment.",
      details: emailUpdateError.message,
    });
  }

  const intakeUpdate = {
    project_id: nextProjectId,
    project_email_id: parentEmailId,
    match_status: "matched",
    assignment_method: "manual",
    assignment_confidence: 1,
    updated_at: now,
  };

  const { error: intakeByProjectEmailError } = await intakeSupabase
    .from("outlook_email_intake")
    .update(intakeUpdate)
    .eq("project_email_id", parentEmailId);

  if (intakeByProjectEmailError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: "Failed to sync the linked Outlook intake email.",
      details: intakeByProjectEmailError.message,
    });
  }

  if (graphMessageId) {
    const { error: intakeByGraphError } = await intakeSupabase
      .from("outlook_email_intake")
      .update(intakeUpdate)
      .eq("graph_message_id", graphMessageId);

    if (intakeByGraphError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: "Failed to sync the Outlook message assignment.",
        details: intakeByGraphError.message,
      });
    }
  }

  return {
    id: project.id,
    name: project.name,
    projectNumber: project.project_number,
  };
}
