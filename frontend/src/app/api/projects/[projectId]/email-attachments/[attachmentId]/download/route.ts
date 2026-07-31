import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams {
  projectId: string;
  attachmentId: string;
}

interface AttachmentDownloadRow {
  id: number;
  file_name: string;
  content: string | number[] | null;
  content_type: string | null;
  project_emails: {
    project_id: number;
  } | null;
}

function decodeBytea(value: string | number[] | null): Buffer {
  if (!value) {
    return Buffer.alloc(0);
  }

  if (Array.isArray(value)) {
    return Buffer.from(value);
  }

  if (value.startsWith("\\x")) {
    return Buffer.from(value.slice(2), "hex");
  }

  return Buffer.from(value, "base64");
}

function attachmentFilename(fileName: string): string {
  return fileName.replace(/["\r\n]/g, "_");
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

export const GET = withApiGuardrails<RouteParams>(
  "projects/[projectId]/email-attachments/[attachmentId]/download#GET",
  async ({ request, params }) => {
    const { projectId, attachmentId } = params;
    const projectIdNumber = Number.parseInt(projectId, 10);
    const attachmentIdNumber = Number.parseInt(attachmentId, 10);
    const disposition =
      request.nextUrl.searchParams.get("disposition") === "inline"
        ? "inline"
        : "attachment";

    if (!Number.isInteger(projectIdNumber) || !Number.isInteger(attachmentIdNumber)) {
      throw new GuardrailError({
        code: "INVALID_INPUT",
        where: "projects/[projectId]/email-attachments/[attachmentId]/download#GET",
        message: "Project id and attachment id must be numbers.",
        status: 400,
      });
    }

    const supabase = await assertAdminAccess(
      "projects/[projectId]/email-attachments/[attachmentId]/download#GET",
    );

    const { data, error } = await supabase
      .from("email_attachments")
      .select(
        `
          id,
          file_name,
          content,
          content_type,
          project_emails!inner (
            project_id
          )
        `,
      )
      .eq("id", attachmentIdNumber)
      .eq("project_emails.project_id", projectIdNumber)
      .is("project_emails.deleted_at", null)
      .single();

    if (error) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "projects/[projectId]/email-attachments/[attachmentId]/download#GET",
        message: "Email attachment was not found for this project.",
        status: 404,
      });
    }

    const attachment = data as unknown as AttachmentDownloadRow;
    const fileBuffer = decodeBytea(attachment.content);

    if (fileBuffer.byteLength === 0) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/email-attachments/[attachmentId]/download#GET",
        message: "Email attachment has no stored file content.",
        status: 500,
      });
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": attachment.content_type || "application/octet-stream",
        "Content-Length": String(fileBuffer.byteLength),
        "Content-Disposition": `${disposition}; filename="${attachmentFilename(attachment.file_name)}"`,
      },
    });
  },
);
