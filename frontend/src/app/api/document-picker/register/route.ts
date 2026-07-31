import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-error';
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  registerUploadedPatternCDocument,
  resolvePatternCEntity,
  validatePatternCDocumentType,
} from '@/lib/documents/pattern-c-attachments';

export const dynamic = 'force-dynamic';

function validationError(message: string, status: number): Response {
  return Response.json({ success: false, error_message: message, error: message }, { status });
}

interface RegisterRequest {
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  entityType?: string;
  entityId?: string;
  projectId?: string | number;
  documentType?: string | null;
}

/**
 * POST /api/document-picker/register
 *
 * Step 2 of the direct-to-storage attachment upload. The file has already been
 * uploaded to Storage via the signed URL from /api/document-picker/upload-url.
 * This creates the document_metadata row, links it to the entity via the correct
 * Pattern C junction table, and queues the ingestion pipeline.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  const user = await getApiRouteUser();
  if (!user) {
    return validationError('Unauthorized', 401);
  }

  let body: RegisterRequest;
  try {
    body = (await req.json()) as RegisterRequest;
  } catch {
    return validationError('Invalid JSON body', 400);
  }

  const { storagePath, fileName, fileSize, fileType, entityType, entityId, projectId, documentType } = body;

  if (!storagePath || !fileName || !entityType || !entityId || projectId === undefined || projectId === null) {
    return validationError('Required fields: storagePath, fileName, entityType, entityId, projectId', 400);
  }

  if (!Number.isFinite(fileSize) || (fileSize as number) < 0) {
    return validationError('A valid fileSize is required', 400);
  }

  const projectIdNum = parseInt(String(projectId), 10);
  if (!Number.isFinite(projectIdNum)) {
    return validationError('projectId must be a valid integer', 400);
  }

  const resolved = await resolvePatternCEntity(supabase, entityType, entityId);
  if ('error' in resolved) {
    return validationError(resolved.error, resolved.status);
  }

  // Guard against a client uploading to a path outside the resolved entity's
  // folder (the signed-URL route always builds `${projectId}/<folder>/<entityId>/…`).
  if (!storagePath.startsWith(`${projectIdNum}/`)) {
    return validationError('storagePath does not belong to this project', 400);
  }

  const typeCheck = await validatePatternCDocumentType(supabase, resolved.entityType, documentType);
  if (!typeCheck.ok) {
    return validationError(typeCheck.error, typeCheck.status);
  }

  try {
    const uploaded = await registerUploadedPatternCDocument({
      supabase,
      serviceClient,
      storagePath,
      fileName,
      fileSize: fileSize as number,
      fileType,
      projectId: projectIdNum,
      entityType: resolved.entityType,
      entityId: resolved.entityId,
      userId: user.id,
      documentType,
    });

    return NextResponse.json(uploaded);
  } catch (error) {
    console.error('[document-picker/register] finalize failed:', error);
    return apiErrorResponse(error);
  }
}
