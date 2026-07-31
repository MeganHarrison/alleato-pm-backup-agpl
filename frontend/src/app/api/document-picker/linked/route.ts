import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-error';
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  deletePatternCDocumentLink,
  listLinkedPatternCDocuments,
  resolvePatternCEntity,
  updatePatternCDocumentType,
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
 * GET /api/document-picker/linked?entityType=<type>&entityId=<id>
 *
 * Returns all document_metadata records linked to the given entity via
 * the Pattern C junction table, with signed download URLs for file-backed docs.
 *
 * DELETE /api/document-picker/linked?entityType=<type>&entityId=<id>&documentMetadataId=<id>
 *
 * Removes the junction row. Does NOT delete document_metadata or the storage file.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');

  if (!entityType || !entityId) {
    return validationError('Required query params: entityType, entityId', 400);
  }

  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    return validationError('Unauthorized', 401);
  }
  const serviceClient = createServiceClient();

  const resolved = await resolvePatternCEntity(supabase, entityType, entityId);
  if ('error' in resolved) {
    return validationError(resolved.error, resolved.status);
  }

  try {
    const result = await listLinkedPatternCDocuments({
      supabase,
      serviceClient,
      entityType: resolved.entityType,
      entityId: resolved.entityId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[document-picker/linked] fetch failed:', error);
    return apiErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  const documentMetadataId = searchParams.get('documentMetadataId');

  if (!entityType || !entityId || !documentMetadataId) {
    return validationError('Required query params: entityType, entityId, documentMetadataId', 400);
  }

  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    return validationError('Unauthorized', 401);
  }

  const resolved = await resolvePatternCEntity(supabase, entityType, entityId);
  if ('error' in resolved) {
    return validationError(resolved.error, resolved.status);
  }

  try {
    await deletePatternCDocumentLink({
      supabase,
      entityType: resolved.entityType,
      entityId: resolved.entityId,
      documentMetadataId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[document-picker/linked] delete failed:', error);
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  let body: {
    entityType?: string;
    entityId?: string;
    documentMetadataId?: string;
    documentType?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return validationError('Invalid JSON body', 400);
  }

  const { entityType, entityId, documentMetadataId } = body;
  const documentType =
    typeof body.documentType === 'string' && body.documentType.trim()
      ? body.documentType.trim()
      : null;

  if (!entityType || !entityId || !documentMetadataId) {
    return validationError('Required fields: entityType, entityId, documentMetadataId', 400);
  }

  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    return validationError('Unauthorized', 401);
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
    await updatePatternCDocumentType({
      supabase,
      entityType: resolved.entityType,
      entityId: resolved.entityId,
      documentMetadataId,
      documentType,
    });
    return NextResponse.json({
      success: true,
      entityType: resolved.entityType,
      entityId: resolved.entityId,
      documentMetadataId,
      documentType,
    });
  } catch (error) {
    console.error('[document-picker/linked] update document type failed:', error);
    return apiErrorResponse(error);
  }
}
