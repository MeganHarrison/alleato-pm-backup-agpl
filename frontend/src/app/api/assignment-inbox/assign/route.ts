export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import {
  extractTitleKeywords,
  recordAttributionAssignmentFeedback,
} from "@/lib/ai/services/feedback-event-service";

const WHERE = "api.assignment-inbox.assign.POST";

const AssignSchema = z.object({
  sourceTable: z.enum(["document_metadata", "outlook_email_intake", "tasks"]),
  itemId: z.string().trim().min(1),
  projectId: z.number().int().positive(),
  suggestedProjectId: z.number().int().positive().nullable().optional(),
});

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Sign in before assigning items to a project.",
      status: 401,
    });
  }

  const body = await parseJsonBody(request, AssignSchema, WHERE);
  const supabase = createServiceClient();
  const intakeSupabase = createOutlookIntakeServiceClient();

  // Resolve + validate the destination project.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", body.projectId)
    .single();

  if (projectError || !project) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: WHERE,
      message: "Selected project does not exist.",
      status: 400,
      details: projectError?.message,
    });
  }

  let contentType: "meeting" | "email" | "teams" | "document" = "document";
  let fromEmail: string | null = null;
  let title: string | null = null;

  if (body.sourceTable === "document_metadata") {
    const { data: doc, error: docError } = await supabase
      .from("document_metadata")
      .select("id, title, file_name, type, category, host_email, organizer_email")
      .eq("id", body.itemId)
      .maybeSingle();

    if (docError || !doc) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "Item not found.",
        status: 404,
        details: docError?.message,
      });
    }

    contentType = deriveContentType(doc.type, doc.category);
    fromEmail = doc.host_email ?? doc.organizer_email ?? null;
    title = doc.title ?? doc.file_name ?? null;

    const { error: updateError } = await supabase
      .from("document_metadata")
      .update({ project_id: project.id, project: project.name })
      .eq("id", body.itemId);

    if (updateError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE,
        message: "Failed to assign the item to the project.",
        details: updateError.message,
      });
    }
  } else if (body.sourceTable === "outlook_email_intake") {
    const emailId = Number(body.itemId);
    if (!Number.isInteger(emailId) || emailId <= 0) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: WHERE,
        message: "Invalid email id.",
        status: 400,
      });
    }

    const { data: email, error: emailError } = await intakeSupabase
      .from("outlook_email_intake")
      .select(`
        id,
        subject,
        body,
        body_text,
        from_name,
        from_email,
        to_list,
        cc_list,
        status,
        received_at,
        has_attachments,
        graph_message_id,
        mailbox_user_id,
        conversation_id,
        document_metadata_id,
        project_email_id
      `)
      .eq("id", emailId)
      .is("deleted_at", null)
      .maybeSingle();

    if (emailError || !email) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "Item not found.",
        status: 404,
        details: emailError?.message,
      });
    }

    contentType = "email";
    fromEmail = email.from_email ?? null;
    title = email.subject ?? null;

    const linkedProjectEmailId = await upsertLinkedProjectEmail({
      supabase,
      email,
      projectId: project.id,
    });

    if (email.document_metadata_id) {
      const { error: documentUpdateError } = await supabase
        .from("document_metadata")
        .update({
          project_id: project.id,
          project: project.name,
        })
        .eq("id", email.document_metadata_id);

      if (documentUpdateError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: WHERE,
          message: "Failed to sync the linked document record to the assigned project.",
          details: documentUpdateError.message,
        });
      }
    }

    const { error: updateError } = await intakeSupabase
      .from("outlook_email_intake")
      .update({
        project_id: project.id,
        project_email_id: linkedProjectEmailId,
        match_status: "matched",
        assignment_method: "manual",
        assignment_confidence: 1.0,
      })
      .eq("id", emailId);

    if (updateError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE,
        message: "Failed to assign the email to the project.",
        details: updateError.message,
      });
    }
  } else {
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, title, description")
      .eq("id", body.itemId)
      .maybeSingle();

    if (taskError || !task) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "Item not found.",
        status: 404,
        details: taskError?.message,
      });
    }

    title = task.title ?? task.description ?? null;

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        project_id: project.id,
        project_ids: [project.id],
      })
      .eq("id", body.itemId);

    if (updateError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE,
        message: "Failed to assign the task to the project.",
        details: updateError.message,
      });
    }
  }

  // Record the manual assignment so the learning loop can mine it for patterns.
  // Feedback recording must never block the assignment itself.
  if (body.sourceTable !== "tasks") {
    try {
      await recordAttributionAssignmentFeedback({
        userId: user.id,
        projectId: project.id,
        projectName: project.name,
        sourceTable: body.sourceTable,
        sourceRecordId: String(body.itemId),
        contentType,
        fromEmail,
        titleKeywords: extractTitleKeywords(title),
        suggestedProjectId: body.suggestedProjectId ?? null,
        matchedSuggestion:
          body.suggestedProjectId != null &&
          body.suggestedProjectId === project.id,
      });
    } catch (feedbackError) {
      console.error(`[${WHERE}] feedback recording failed`, feedbackError);
    }
  }

  return NextResponse.json({
    success: true,
    project: { id: project.id, name: project.name },
  });
});

function deriveContentType(
  type: string | null,
  category: string | null,
): "meeting" | "teams" | "document" {
  const t = (type ?? "").toLowerCase();
  const c = (category ?? "").toLowerCase();
  if (t === "meeting" || t.includes("meeting")) return "meeting";
  if (t.startsWith("teams") || c === "teams_message" || c.includes("teams")) {
    return "teams";
  }
  return "document";
}

type LinkedOutlookEmail = {
  id: number;
  subject: string | null;
  body: string | null;
  body_text: string | null;
  from_name: string | null;
  from_email: string | null;
  to_list: string[] | null;
  cc_list: string[] | null;
  status: string | null;
  received_at: string | null;
  has_attachments: boolean | null;
  graph_message_id: string | null;
  mailbox_user_id: string | null;
  conversation_id: string | null;
  document_metadata_id: string | null;
  project_email_id: number | null;
};

async function upsertLinkedProjectEmail({
  supabase,
  email,
  projectId,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  email: LinkedOutlookEmail;
  projectId: number;
}): Promise<number | null> {
  const payload = {
    project_id: projectId,
    subject: email.subject ?? "(no subject)",
    body: email.body ?? email.body_text,
    body_text: email.body_text ?? email.body,
    from_name: email.from_name,
    from_email: email.from_email,
    to_list: email.to_list ?? [],
    cc_list: email.cc_list ?? [],
    status: email.status ?? "Received",
    received_at: email.received_at,
    has_attachments: email.has_attachments ?? false,
    graph_message_id: email.graph_message_id,
    mailbox_user_id: email.mailbox_user_id,
    conversation_id: email.conversation_id,
    deleted_at: null,
  };

  if (email.project_email_id) {
    const { error } = await supabase
      .from("project_emails")
      .update(payload)
      .eq("id", email.project_email_id);

    if (error) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE,
        message: "Failed to sync the linked project email to the assigned project.",
        details: error.message,
      });
    }

    return email.project_email_id;
  }

  if (email.graph_message_id) {
    const { data: existingProjectEmail, error: existingProjectEmailError } =
      await supabase
        .from("project_emails")
        .select("id")
        .eq("graph_message_id", email.graph_message_id)
        .is("deleted_at", null)
        .maybeSingle();

    if (existingProjectEmailError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE,
        message: "Failed to load the linked project email for this Outlook message.",
        details: existingProjectEmailError.message,
      });
    }

    if (existingProjectEmail?.id) {
      const { error } = await supabase
        .from("project_emails")
        .update(payload)
        .eq("id", existingProjectEmail.id);

      if (error) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: WHERE,
          message: "Failed to sync the existing project email to the assigned project.",
          details: error.message,
        });
      }

      return existingProjectEmail.id;
    }
  }

  const { data: insertedProjectEmail, error: insertProjectEmailError } =
    await supabase
      .from("project_emails")
      .insert(payload)
      .select("id")
      .single();

  if (insertProjectEmailError || !insertedProjectEmail?.id) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Failed to create the linked project email for this Outlook message.",
      details: insertProjectEmailError?.message,
    });
  }

  return insertedProjectEmail.id;
}
