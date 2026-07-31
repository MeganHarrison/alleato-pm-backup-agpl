import { apiErrorResponse } from "@/lib/api-error";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { NextResponse } from "next/server";

interface ProjectDocumentDownloadRow {
  id: number;
  file_name: string;
  file_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  source_system: string | null;
  source_web_url: string | null;
  source_metadata: {
    outlook_intake_attachment_id?: number | null;
    text_storage_bucket?: string | null;
    text_storage_path?: string | null;
  } | null;
}

interface OutlookIntakeAttachmentRow {
  id: number;
  file_name: string;
  content: string | number[] | null;
  content_type: string | null;
  project_id: number | null;
}

function isReachableUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isMicrosoftContainerUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname.endsWith("sharepoint.com") ||
      hostname.endsWith("office.com") ||
      hostname.endsWith("office365.com") ||
      hostname.endsWith("microsoft.com") ||
      hostname.endsWith("1drv.ms")
    );
  } catch {
    return false;
  }
}

function canUseUrlForInlinePreview(url: string): boolean {
  return !isMicrosoftContainerUrl(url);
}

function redirectTo(url: string, headers?: HeadersInit): NextResponse {
  return NextResponse.redirect(new URL(url), { headers });
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

async function streamExtractedTextPreview(
  document: ProjectDocumentDownloadRow,
): Promise<NextResponse | null> {
  const textStorageBucket = document.source_metadata?.text_storage_bucket;
  const textStoragePath = document.source_metadata?.text_storage_path;

  if (!textStorageBucket || !textStoragePath) {
    return null;
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.storage
    .from(textStorageBucket)
    .download(textStoragePath);

  if (error || !data) {
    console.error(
      JSON.stringify({
        event: "project_document_text_preview_failed",
        document_id: document.id,
        text_storage_bucket: textStorageBucket,
        text_storage_path: textStoragePath,
        error: error?.message ?? "Text preview object was not returned.",
      }),
    );
    return null;
  }

  const text = await data.text();
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `inline; filename="${attachmentFilename(
        `${document.file_name}.txt`,
      )}"`,
      "x-document-source": "extracted-text-preview",
    },
  });
}

/**
 * GET /api/projects/[projectId]/documents/[documentId]/download
 * Opens the durable Supabase Storage copy when available, then falls back to the
 * original source URL for legacy/imported records that have not been copied yet.
 */
export const GET = withApiGuardrails<{ projectId: string; documentId: string }>(
  "projects/[projectId]/documents/[documentId]/download#GET",
  async ({ request, params }) => {
    const { projectId, documentId } = await params;
    const supabase = await createClient();
    const disposition =
      request.nextUrl.searchParams.get("disposition") === "inline"
        ? "inline"
        : "attachment";

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/documents/[documentId]/download#GET",
        message: "Authentication required.",
      });
    }

    const { data: document, error } = await supabase
      .from("project_documents")
      .select(
        "id, file_name, file_url, storage_bucket, storage_path, source_system, source_web_url, source_metadata",
      )
      .eq("id", Number(documentId))
      .eq("project_id", Number(projectId))
      .is("deleted_at", null)
      .single<ProjectDocumentDownloadRow>();

    if (error) {
      if (error.code === "PGRST116") {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where: "projects/[projectId]/documents/[documentId]/download#GET",
          message: "Document not found.",
          status: 404,
        });
      }
      return apiErrorResponse(error);
    }

    // Prefer durable Supabase Storage copy
    if (document.storage_bucket && document.storage_path) {
      const serviceClient = createServiceClient();
      const { data: signedUrlData, error: signedUrlError } =
        await serviceClient.storage
          .from(document.storage_bucket)
          .createSignedUrl(
            document.storage_path,
            3600,
            disposition === "attachment"
              ? {
                  download: document.file_name,
                }
              : undefined,
          );

      if (signedUrlData?.signedUrl && !signedUrlError) {
        return redirectTo(signedUrlData.signedUrl, {
          "x-document-source": "supabase-storage",
        });
      }

      console.error(
        JSON.stringify({
          event: "project_document_signed_url_failed",
          project_id: Number(projectId),
          document_id: Number(documentId),
          storage_bucket: document.storage_bucket,
          storage_path: document.storage_path,
          error: signedUrlError?.message ?? "Signed URL was not returned.",
        }),
      );
    }

    const outlookIntakeAttachmentId =
      document.source_system === "outlook_attachment"
        ? document.source_metadata?.outlook_intake_attachment_id
        : null;

    if (outlookIntakeAttachmentId) {
      const intakeService = createOutlookIntakeServiceClient();
      const { data: attachment, error: attachmentError } = await intakeService
        .from("outlook_email_intake_attachments")
        .select("id, file_name, content, content_type, project_id")
        .eq("id", outlookIntakeAttachmentId)
        .eq("project_id", Number(projectId))
        .single<OutlookIntakeAttachmentRow>();

      if (!attachmentError && attachment) {
        const fileBuffer = decodeBytea(attachment.content);

        if (fileBuffer.byteLength > 0) {
          return new NextResponse(new Uint8Array(fileBuffer), {
            headers: {
              "Content-Type":
                attachment.content_type || "application/octet-stream",
              "Content-Length": String(fileBuffer.byteLength),
              "Content-Disposition": `${disposition}; filename="${attachmentFilename(
                attachment.file_name || document.file_name,
              )}"`,
              "x-document-source": "outlook-intake-attachment",
            },
          });
        }
      } else {
        console.error(
          JSON.stringify({
            event: "project_document_outlook_attachment_lookup_failed",
            project_id: Number(projectId),
            document_id: Number(documentId),
            outlook_intake_attachment_id: outlookIntakeAttachmentId,
            error:
              attachmentError?.message ??
              "Attachment bytes were not returned for promoted Outlook document.",
          }),
        );
      }
    }

    if (disposition === "inline") {
      const extractedTextPreview = await streamExtractedTextPreview(document);
      if (extractedTextPreview) {
        return extractedTextPreview;
      }
    }

    // Fall back to file_url first. This is the durable per-file URL for legacy
    // records and Outlook attachment promotions, while source_web_url can point
    // at the parent container (for example the email thread or OneDrive page).
    // Relative paths and non-http schemes (e.g. onedrive://) would produce a
    // browser error, so we reject them explicitly.
    if (
      isReachableUrl(document.file_url) &&
      (disposition !== "inline" || canUseUrlForInlinePreview(document.file_url))
    ) {
      return redirectTo(document.file_url, {
        "x-document-source": "file-url",
      });
    }

    // Last resort: use the source page link when no direct file URL exists.
    if (
      isReachableUrl(document.source_web_url) &&
      (disposition !== "inline" ||
        canUseUrlForInlinePreview(document.source_web_url))
    ) {
      return redirectTo(document.source_web_url, {
        "x-document-source": "source-web-url",
      });
    }

    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "projects/[projectId]/documents/[documentId]/download#GET",
      message: "This document does not have a downloadable file attached. It may have been synced from OneDrive without a local copy.",
      status: 404,
    });
  },
);
