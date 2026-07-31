import type { FileItem } from "./files-table-definition";

/**
 * File link resolution.
 *
 * Outlook attachments store `source_web_url` as a deeplink to the *parent email*
 * (outlook.office365.com/owa/?ItemID=…), not the file itself — so linking there
 * drops the user into Outlook instead of opening the document. Those must be
 * routed through the server download endpoint, which serves the stored copy or
 * streams the attachment bytes from Microsoft Graph. Everything else
 * (SharePoint / OneDrive / meetings) already exposes a direct file URL.
 */

export function isOutlookAttachment(
  item: Pick<FileItem, "source_system" | "source" | "source_web_url">,
): boolean {
  const sys = item.source_system ?? item.source ?? "";
  if (sys.includes("outlook_attachment")) return true;
  return Boolean(item.source_web_url?.includes("outlook.office"));
}

export function fileHref(
  item: Pick<FileItem, "id" | "source_system" | "source" | "source_web_url" | "url">,
): string | null {
  if (isOutlookAttachment(item)) {
    return `/api/files/${encodeURIComponent(item.id)}/download`;
  }
  return item.source_web_url ?? item.url ?? null;
}
