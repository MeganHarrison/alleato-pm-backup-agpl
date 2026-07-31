/**
 * Upload constraints for entity attachments (document-picker / EntityAttachments).
 *
 * These uploads go DIRECTLY to Supabase Storage via a signed upload URL, so they
 * are NOT bound by Vercel's ~4.5MB serverless request-body limit. The ceiling
 * below is the product limit, enforced on both the client (fast feedback) and
 * the signed-URL route (authoritative — a client can't bypass it).
 */
export const ATTACHMENT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const ATTACHMENT_MAX_UPLOAD_LABEL = "100 MB";

export function getAttachmentSizeError(
  file: Pick<File, "name" | "size">,
): string | null {
  if (file.size > ATTACHMENT_MAX_UPLOAD_BYTES) {
    return `${file.name} exceeds the ${ATTACHMENT_MAX_UPLOAD_LABEL} limit.`;
  }
  return null;
}
