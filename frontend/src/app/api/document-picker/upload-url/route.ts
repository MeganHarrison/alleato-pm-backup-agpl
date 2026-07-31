import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-error';
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  buildPatternCStoragePath,
  resolvePatternCEntity,
} from '@/lib/documents/pattern-c-attachments';
import {
  ATTACHMENT_MAX_UPLOAD_BYTES,
  ATTACHMENT_MAX_UPLOAD_LABEL,
} from '@/lib/documents/attachment-constraints';

export const dynamic = 'force-dynamic';

function validationError(message: string, status: number): Response {
  return Response.json({ success: false, error_message: message, error: message }, { status });
}

interface SignedUploadRequest {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  entityType?: string;
  entityId?: string;
  projectId?: string | number;
}

/**
 * POST /api/document-picker/upload-url
 *
 * Step 1 of the direct-to-storage attachment upload. Authorizes the upload,
 * resolves the Pattern C entity, validates the file size, and returns a
 * short-lived Supabase Storage signed upload URL. The browser uploads the file
 * bytes straight to Storage (bypassing Vercel's ~4.5MB request-body limit),
 * then calls POST /api/document-picker/register to finalize.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    return validationError('Unauthorized', 401);
  }

  let body: SignedUploadRequest;
  try {
    body = (await req.json()) as SignedUploadRequest;
  } catch {
    return validationError('Invalid JSON body', 400);
  }

  const { fileName, fileSize, fileType, entityType, entityId, projectId } = body;

  if (!fileName || !entityType || !entityId || projectId === undefined || projectId === null) {
    return validationError('Required fields: fileName, entityType, entityId, projectId', 400);
  }

  if (!Number.isFinite(fileSize) || (fileSize as number) <= 0) {
    return validationError('A valid fileSize is required', 400);
  }

  if ((fileSize as number) > ATTACHMENT_MAX_UPLOAD_BYTES) {
    return validationError(`File too large. Maximum size is ${ATTACHMENT_MAX_UPLOAD_LABEL}.`, 400);
  }

  const projectIdNum = parseInt(String(projectId), 10);
  if (!Number.isFinite(projectIdNum)) {
    return validationError('projectId must be a valid integer', 400);
  }

  const resolved = await resolvePatternCEntity(supabase, entityType, entityId);
  if ('error' in resolved) {
    return validationError(resolved.error, resolved.status);
  }

  const storagePath = buildPatternCStoragePath({
    projectId: projectIdNum,
    entityType: resolved.entityType,
    entityId: resolved.entityId,
    fileName,
  });

  try {
    // Sensitive: this endpoint authorizes a direct object write into project storage.
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient.storage
      .from('project-files')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      return apiErrorResponse(
        new Error(`Failed to create signed upload URL: ${error?.message ?? 'Unknown error'}`),
      );
    }

    return NextResponse.json({
      path: data.path,
      token: data.token,
      contentType: fileType?.trim() || 'application/octet-stream',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
