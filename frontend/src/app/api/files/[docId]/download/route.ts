import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { fetchWithGuardrails } from "@/lib/fetch-with-guardrails";
import { getGraphToken } from "@/lib/microsoft-graph/calendar-invites";
import { isOutlookAttachment } from "@/features/files/file-link";

const WHERE = "files/[docId]/download#GET";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

type DocumentRow = {
  id: string;
  title: string | null;
  file_name: string | null;
  storage_bucket: string | null;
  file_path: string | null;
  url: string | null;
  source_web_url: string | null;
  source_system: string | null;
  source_path: string | null;
  source_metadata: Record<string, unknown> | null;
};

/**
 * Resolves the best displayable name for a downloaded file.
 */
function resolveFileName(doc: DocumentRow): string {
  return doc.file_name ?? doc.title ?? "document";
}

/**
 * Outlook attachments store `source_path` as `outlook/{mailbox}/{messageId}/{filename}`.
 * The mailbox segment is the Graph user we must address the message under.
 */
function parseMailbox(sourcePath: string | null): string | null {
  if (!sourcePath) return null;
  const segments = sourcePath.split("/").filter(Boolean);
  // segments[0] === "outlook", segments[1] === mailbox
  if (segments[0] === "outlook" && segments[1]?.includes("@")) {
    return segments[1];
  }
  return null;
}

/**
 * The Graph attachment id is the trailing segment of
 * `source_metadata.source_file_url` (`graph://messages/{msgId}/attachments/{attachmentId}`).
 */
function parseAttachmentId(sourceFileUrl: string | null): string | null {
  if (!sourceFileUrl) return null;
  const match = sourceFileUrl.match(/\/attachments\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

function docIsOutlookAttachment(doc: DocumentRow): boolean {
  if (
    isOutlookAttachment({
      source_system: doc.source_system,
      source: null,
      source_web_url: doc.source_web_url,
    })
  ) {
    return true;
  }
  const sourceFileUrl =
    typeof doc.source_metadata?.source_file_url === "string"
      ? (doc.source_metadata.source_file_url as string)
      : null;
  return Boolean(sourceFileUrl?.startsWith("graph://messages/"));
}

/**
 * Streams the actual attachment bytes from Microsoft Graph.
 * Returns null when any required pointer is missing or Graph rejects the call,
 * so the caller can fall back to the Outlook web link.
 */
async function streamOutlookAttachment(
  doc: DocumentRow,
  requestId: string,
): Promise<Response | null> {
  const metadata = doc.source_metadata ?? {};
  const mailbox =
    parseMailbox(doc.source_path) ??
    (typeof metadata.mailbox === "string" ? (metadata.mailbox as string) : null);
  const messageId =
    typeof metadata.outlook_message_id === "string"
      ? (metadata.outlook_message_id as string)
      : null;
  const attachmentId = parseAttachmentId(
    typeof metadata.source_file_url === "string"
      ? (metadata.source_file_url as string)
      : null,
  );

  if (!mailbox || !messageId || !attachmentId) return null;

  let token: string;
  try {
    token = await getGraphToken();
  } catch {
    return null;
  }

  const graphUrl =
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}` +
    `/messages/${encodeURIComponent(messageId)}` +
    `/attachments/${encodeURIComponent(attachmentId)}`;

  let response: Response;
  try {
    response = await fetchWithGuardrails(graphUrl, {
      requestId,
      where: WHERE,
      dependency: "microsoft-graph",
      headers: { authorization: `Bearer ${token}` },
      timeoutMs: 20_000,
      retries: 1,
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const attachment = (await response.json()) as {
    "@odata.type"?: string;
    name?: string;
    contentType?: string;
    contentBytes?: string;
  };

  // Only fileAttachment carries inline bytes; itemAttachment / reference types do not.
  if (!attachment.contentBytes) return null;

  const bytes = Buffer.from(attachment.contentBytes, "base64");
  const fileName = attachment.name ?? resolveFileName(doc);
  const contentType = attachment.contentType ?? "application/octet-stream";

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
      "content-disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "cache-control": "private, max-age=300",
    },
  });
}

export const GET = withApiGuardrails<{ docId: string }>(
  WHERE,
  async ({ params, requestId }) => {
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: WHERE,
        message: "Authentication required.",
      });
    }

    const { docId } = await params;
    const supabase = createServiceClient();

    const { data: doc, error } = await serviceDb.from("document_metadata")
      .select(
        "id, title, file_name, storage_bucket, file_path, url, source_web_url, source_system, source_path, source_metadata",
      )
      .eq("id", docId)
      .maybeSingle<DocumentRow>();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: WHERE,
        message: "Could not load the requested file.",
      });
    }

    if (!doc) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    // 1. A stored copy in Supabase storage is the best target — serve it directly.
    if (doc.storage_bucket && doc.file_path) {
      const { data: signed } = await supabase.storage
        .from(doc.storage_bucket)
        .createSignedUrl(doc.file_path, 300);
      if (signed?.signedUrl) {
        return NextResponse.redirect(signed.signedUrl);
      }
      // Public-bucket fallback: the stored copy URL lives in `url`.
      if (doc.url && doc.url.includes("/storage/v1/object/")) {
        return NextResponse.redirect(doc.url);
      }
    }

    // 2. Outlook attachment without a stored copy — pull the bytes from Graph.
    if (docIsOutlookAttachment(doc)) {
      const streamed = await streamOutlookAttachment(doc, requestId);
      if (streamed) return streamed;
      // Last resort: open the parent email in Outlook (previous behavior).
      if (doc.source_web_url) {
        return NextResponse.redirect(doc.source_web_url);
      }
    }

    // 3. Everything else (SharePoint / OneDrive / meetings) — go to the direct link.
    const fallback = doc.url ?? doc.source_web_url;
    if (fallback) {
      return NextResponse.redirect(fallback);
    }

    return NextResponse.json(
      { error: "No downloadable source is available for this file." },
      { status: 404 },
    );
  },
);
