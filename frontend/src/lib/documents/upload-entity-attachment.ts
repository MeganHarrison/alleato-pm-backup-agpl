import { apiFetch } from "@/lib/api-client";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { getAttachmentSizeError } from "@/lib/documents/attachment-constraints";

export interface UploadEntityAttachmentResult {
  documentMetadataId: string;
  pipelineQueued?: boolean;
  pipelineMessage?: string | null;
}

/**
 * Uploads a single file as an entity attachment DIRECTLY to Supabase Storage,
 * then links it to the entity via Pattern C.
 *
 * This is the one and only client-side attachment upload path. It does NOT
 * stream the file through a Next.js route (which on Vercel caps request bodies
 * at ~4.5MB and produces "Upload is too large for the server request limit").
 * Instead it:
 *   1. POSTs metadata to /api/document-picker/upload-url → signed upload URL
 *   2. Uploads the bytes straight to Storage via uploadToSignedUrl
 *   3. POSTs to /api/document-picker/register to create the record + link
 *
 * Any new attachment uploader MUST use this helper rather than re-implementing
 * an API-proxy upload.
 */
export async function uploadEntityAttachment({
  file,
  entityType,
  entityId,
  projectId,
  documentType,
}: {
  file: File;
  entityType: string;
  entityId: string;
  projectId: string | number;
  documentType?: string;
}): Promise<UploadEntityAttachmentResult> {
  const sizeError = getAttachmentSizeError(file);
  if (sizeError) {
    throw new Error(sizeError);
  }

  const signed = await apiFetch<{ path: string; token: string; contentType: string }>(
    "/api/document-picker/upload-url",
    {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        entityType,
        entityId,
        projectId: String(projectId),
      }),
    },
  );

  const supabase = createSupabaseClient();
  const { error: directUploadError } = await supabase.storage
    .from("project-files")
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (directUploadError) {
    throw new Error(`Failed to upload file to storage: ${directUploadError.message}`);
  }

  return apiFetch<UploadEntityAttachmentResult>("/api/document-picker/register", {
    method: "POST",
    body: JSON.stringify({
      storagePath: signed.path,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      entityType,
      entityId,
      projectId: String(projectId),
      documentType,
    }),
  });
}
