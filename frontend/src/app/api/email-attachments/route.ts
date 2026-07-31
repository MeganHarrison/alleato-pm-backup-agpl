import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { filterEmailAttachments } from "@/lib/email/attachment-filter";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface EmailAttachmentRow {
  id: number;
  email_id: number;
  file_name: string;
  file_url: string;
  file_size: number | null;
  content_type: string | null;
  created_at: string | null;
  extracted_text: string | null;
  graph_attachment_id: string | null;
  checksum_sha256: string | null;
  attachment_type: string | null;
  attachment_category: string | null;
  project_emails: {
    id: number;
    project_id: number;
    subject: string;
    from_name: string | null;
    from_email: string | null;
    received_at: string | null;
    sent_at: string | null;
    created_at: string | null;
    projects: {
      id: number;
      name: string | null;
      project_number: string | null;
    } | null;
  } | null;
}

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

export const GET = withApiGuardrails("email-attachments#GET", async () => {
  const supabase = await assertAdminAccess("email-attachments#GET");

  const { data, error } = await supabase
    .from("email_attachments")
    .select(
      `
        id,
        email_id,
        file_name,
        file_url,
        file_size,
        content_type,
        created_at,
        extracted_text,
        graph_attachment_id,
        checksum_sha256,
        attachment_type,
        attachment_category,
        project_emails!inner (
          id,
          project_id,
          subject,
          from_name,
          from_email,
          received_at,
          sent_at,
          created_at,
          projects!project_emails_project_id_fkey (
            id,
            name,
            project_number
          )
        )
      `,
    )
    .is("project_emails.deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "email-attachments#GET",
      message: error.message,
    });
  }

  const attachments = ((data ?? []) as unknown as EmailAttachmentRow[]).map(
    (attachment) => ({
      id: attachment.id,
      emailId: attachment.email_id,
      fileName: attachment.file_name,
      fileUrl: attachment.file_url,
      fileSize: attachment.file_size,
      contentType: attachment.content_type,
      createdAt: attachment.created_at,
      textLength: attachment.extracted_text?.length ?? 0,
      graphAttachmentId: attachment.graph_attachment_id,
      checksumSha256: attachment.checksum_sha256,
      attachmentType: attachment.attachment_type,
      attachmentCategory: attachment.attachment_category,
      project: attachment.project_emails?.projects
        ? {
            id: attachment.project_emails.projects.id,
            name: attachment.project_emails.projects.name,
            projectNumber: attachment.project_emails.projects.project_number,
          }
        : null,
      email: attachment.project_emails
        ? {
            id: attachment.project_emails.id,
            subject: attachment.project_emails.subject,
            fromName: attachment.project_emails.from_name,
            fromEmail: attachment.project_emails.from_email,
            receivedAt: attachment.project_emails.received_at,
            sentAt: attachment.project_emails.sent_at,
            createdAt: attachment.project_emails.created_at,
          }
        : null,
    }),
  );

  return NextResponse.json(filterEmailAttachments(attachments));
});
