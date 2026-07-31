import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-error';
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  resolvePatternCEntity,
  uploadAndLinkPatternCDocument,
} from '@/lib/documents/pattern-c-attachments';

export const dynamic = 'force-dynamic';

function validationError(message: string, status: number): Response {
  return Response.json({ success: false, error_message: message, error: message }, { status });
}

function taxonomyEntityType(entityType: string): string {
  return entityType === 'subcontract' || entityType === 'purchase_order'
    ? 'commitment'
    : entityType;
}

/**
 * POST /api/document-picker/upload
 *
 * Uploads a file to Supabase Storage, creates a document_metadata row,
 * and links it to the entity via the correct Pattern C junction table.
 *
 * FormData fields:
 *   file         — the file blob
 *   entityType   — one of the DocumentPickerEntityType values
 *   entityId     — the entity primary key (string)
 *   projectId    — the project integer id (for storage path + document_metadata)
 *   documentType — (optional) taxonomy type_key
 *
 * Returns:
 *   {
 *     documentMetadataId,
 *     title,
 *     fileName,
 *     fileSize,
 *     signedUrl,
 *     pipelineQueued,
 *     pipelineMessage
 *   }
 */

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  const user = await getApiRouteUser();
  if (!user) {
    return validationError('Unauthorized', 401);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return validationError('Invalid form data', 400);
  }

  const file = formData.get('file') as File | null;
  const entityType = formData.get('entityType') as string | null;
  const entityId = formData.get('entityId') as string | null;
  const projectId = formData.get('projectId') as string | null;
  const documentType = formData.get('documentType') as string | null;

  if (!file || !entityType || !entityId || !projectId) {
    return validationError('Required fields: file, entityType, entityId, projectId', 400);
  }

  const resolved = await resolvePatternCEntity(supabase, entityType, entityId);
  if ('error' in resolved) {
    return validationError(resolved.error, resolved.status);
  }

  if (documentType) {
    const { data: taxonomyRow, error: taxonomyError } = await supabase
      .from('document_type_taxonomy')
      .select('type_key')
      .eq('type_key', documentType)
      .eq('is_active', true)
      .contains('applies_to', [taxonomyEntityType(resolved.entityType)])
      .maybeSingle();

    if (taxonomyError) {
      return apiErrorResponse(taxonomyError);
    }

    if (!taxonomyRow) {
      return validationError(`Document type "${documentType}" is not available for ${taxonomyEntityType(resolved.entityType)} attachments.`, 400);
    }
  }

  try {
    const uploaded = await uploadAndLinkPatternCDocument({
      supabase,
      serviceClient,
      file,
      projectId: parseInt(projectId, 10),
      entityType: resolved.entityType,
      entityId: resolved.entityId,
      userId: user.id,
      documentType,
    });

    return NextResponse.json(uploaded);
  } catch (error) {
    console.error('[document-picker/upload] upload failed:', error);
    return apiErrorResponse(error);
  }
}
