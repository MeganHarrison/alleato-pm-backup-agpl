import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createOutlookIntakeServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

interface RouteParams {
  attachmentId: string;
}

interface IntakeAttachmentDownloadRow {
  id: number;
  file_name: string;
  content: string | number[] | null;
  content_type: string | null;
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
  "outlook-intake/attachments/[attachmentId]/download#GET",
  async ({ request, params }) => {
    const attachmentIdNumber = Number.parseInt(params.attachmentId, 10);
    const disposition =
      request.nextUrl.searchParams.get("disposition") === "inline"
        ? "inline"
        : "attachment";

    if (!Number.isInteger(attachmentIdNumber)) {
      throw new GuardrailError({
        code: "INVALID_INPUT",
        where: "outlook-intake/attachments/[attachmentId]/download#GET",
        message: "Attachment id must be a number.",
        status: 400,
      });
    }

    await assertAdminAccess(
      "outlook-intake/attachments/[attachmentId]/download#GET",
    );
    const intakeService = createOutlookIntakeServiceClient();

    const { data, error } = await intakeService
      .from("outlook_email_intake_attachments")
      .select("id, file_name, content, content_type")
      .eq("id", attachmentIdNumber)
      .single();

    if (error) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "outlook-intake/attachments/[attachmentId]/download#GET",
        message: "Outlook intake attachment was not found.",
        status: 404,
      });
    }

    const attachment = data as unknown as IntakeAttachmentDownloadRow;
    const fileBuffer = decodeBytea(attachment.content);

    if (fileBuffer.byteLength === 0) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "outlook-intake/attachments/[attachmentId]/download#GET",
        message: "Outlook intake attachment has no stored file content.",
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
