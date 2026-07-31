import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const CreateEmailTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  dueDate: z.string().trim().min(1).nullable().optional(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  status: z.enum(["open", "in_progress", "blocked"]).default("open"),
});

type EmailRow = {
  id: number;
  project_id: number | null;
  subject: string | null;
  body: string | null;
  body_html: string | null;
  body_text: string | null;
  from_name: string | null;
  from_email: string | null;
  to_list: string[] | null;
  received_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  graph_message_id: string | null;
  mailbox_user_id: string | null;
  conversation_id: string | null;
  web_link: string | null;
};

function normalizeTaskText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function emailDocumentId(email: Pick<EmailRow, "id" | "graph_message_id">): string {
  return email.graph_message_id
    ? `outlook-email-${email.graph_message_id}`
    : `project-email-${email.id}`;
}

export const POST = withApiGuardrails(
  "projects/[projectId]/emails/[emailId]/tasks#POST",
  async ({ request, params }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/emails/[emailId]/tasks#POST",
        message: "Authentication required.",
      });
    }

    const { projectId, emailId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    const numericEmailId = Number.parseInt(emailId, 10);

    if (!Number.isFinite(numericProjectId) || !Number.isFinite(numericEmailId)) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "projects/[projectId]/emails/[emailId]/tasks#POST",
        message: "Invalid project or email id.",
        status: 400,
      });
    }

    const body = await parseJsonBody(
      request,
      CreateEmailTaskSchema,
      "projects/[projectId]/emails/[emailId]/tasks#POST",
    );

    const { data: email, error: emailError } = await supabase
      .from("project_emails")
      .select(
        "id, project_id, subject, body, body_html, body_text, from_name, from_email, to_list, received_at, sent_at, created_at, graph_message_id, mailbox_user_id, conversation_id, web_link",
      )
      .eq("id", numericEmailId)
      .eq("project_id", numericProjectId)
      .is("deleted_at", null)
      .maybeSingle<EmailRow>();

    if (emailError) {
      return apiErrorResponse(emailError);
    }

    if (!email) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "projects/[projectId]/emails/[emailId]/tasks#POST",
        message: "Email not found.",
        status: 404,
      });
    }

    const normalizedTitle = normalizeTaskText(body.title);
    const normalizedDescription = normalizeTaskText(body.description);
    const fallbackMetadataId = emailDocumentId(email);
    const sourceSystem = email.graph_message_id ? "outlook_email" : "project_email";
    const sourceItemId = email.graph_message_id ?? `project-email-${email.id}`;

    const { data: existingDoc, error: existingDocError } = await supabase
      .from("document_metadata")
      .select("id")
      .eq("source_system", sourceSystem)
      .eq("source_item_id", sourceItemId)
      .maybeSingle();

    if (existingDocError) {
      return apiErrorResponse(existingDocError);
    }

    const metadataId = existingDoc?.id ?? fallbackMetadataId;

    if (!existingDoc) {
      const emailDate = email.received_at || email.sent_at || email.created_at;
      const plainBody = email.body_text?.trim() || email.body?.trim() || email.body_html?.trim() || "";
      const participants = [
        email.from_name || email.from_email || null,
        ...(email.to_list ?? []),
      ]
        .filter(Boolean)
        .join(", ");

      const { error: insertDocError } = await supabase.from("document_metadata").insert({
        id: metadataId,
        title: `Email: ${email.subject || "Untitled email"}`,
        source: "project_email",
        category: "email",
        type: "email",
        content: plainBody,
        date: emailDate ? emailDate.slice(0, 10) : null,
        participants: participants || null,
        status: "raw_ingested",
        project_id: numericProjectId,
        url: email.web_link,
        source_system: sourceSystem,
        source_item_id: sourceItemId,
        source_path: email.graph_message_id
          ? `outlook/${email.mailbox_user_id ?? "mailbox"}/${email.graph_message_id}.txt`
          : `project-emails/${email.id}.txt`,
        source_web_url: email.web_link,
        source_metadata: {
          project_email_id: email.id,
          graph_message_id: email.graph_message_id,
          mailbox_user_id: email.mailbox_user_id,
          conversation_id: email.conversation_id,
          from_name: email.from_name,
          from_email: email.from_email,
          to_list: email.to_list,
        },
      });

      if (insertDocError) {
        return apiErrorResponse(insertDocError);
      }
    }

    const { data: existingTask, error: existingTaskError } = await supabase
      .from("tasks")
      .select("id")
      .eq("metadata_id", metadataId)
      .eq("title", normalizedTitle)
      .eq("description", normalizedDescription)
      .limit(1)
      .maybeSingle();

    if (existingTaskError) {
      return apiErrorResponse(existingTaskError);
    }

    if (existingTask) {
      return NextResponse.json(
        {
          success: false,
          duplicate: true,
          taskId: existingTask.id,
          error: "A matching task already exists for this email.",
        },
        { status: 409 },
      );
    }

    const { data: task, error: insertTaskError } = await supabase
      .from("tasks")
      .insert({
        metadata_id: metadataId,
        title: normalizedTitle,
        description: normalizedDescription,
        due_date: body.dueDate || null,
        priority: body.priority,
        status: body.status,
        project_id: numericProjectId,
        project_ids: [numericProjectId],
        source_system: email.graph_message_id ? "outlook_email" : "email",
        assigned_by: user.id,
        extraction_source: "manual_thread_review",
        extraction_metadata: {
          created_from: "project_email_detail",
          project_email_id: email.id,
          graph_message_id: email.graph_message_id,
        },
        file_name: email.subject || "Email",
      })
      .select("id")
      .single();

    if (insertTaskError) {
      return apiErrorResponse(insertTaskError);
    }

    return NextResponse.json({ success: true, taskId: task.id });
  },
);
