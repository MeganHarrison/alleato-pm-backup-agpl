import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiErrorResponse } from '@/lib/api-error';
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import {
  getPatternCConfig,
  resolvePatternCEntity,
  type PatternCEntityType,
} from '@/lib/documents/pattern-c-attachments';

export const dynamic = 'force-dynamic';

function validationError(message: string, status: number): Response {
  return Response.json({ success: false, error_message: message, error: message }, { status });
}

/**
 * POST /api/document-picker/attach
 *
 * Body: { entityType, entityId, documentMetadataId, documentType? }
 *
 * Inserts a row into the correct Pattern C junction table.
 * entityType → junction table mapping is hardcoded (never interpolated into SQL).
 *
 * 'commitment' entityType is resolved: we look up whether the entityId exists
 * in subcontracts or purchase_orders, then write to the correct junction.
 */

type EntityType =
  | PatternCEntityType
  | 'project'
  | 'subcontract'
  | 'purchase_order'
  | 'commitment'
  | 'prime_contract'
  | 'change_order'
  | 'invoice'
  | 'submittal'
  | 'rfi'
  | 'drawing'
  | 'company'
  | 'meeting'
  | 'meeting_item';

interface AttachBody {
  entityType: EntityType;
  entityId: string;
  documentMetadataId: string;
  documentType?: string | null;
}

export async function POST(req: NextRequest) {
  let body: AttachBody;
  try {
    body = (await req.json()) as AttachBody;
  } catch {
    return validationError('Invalid JSON body', 400);
  }

  const { entityType, entityId, documentMetadataId, documentType } = body;

  if (!entityType || !entityId || !documentMetadataId) {
    return validationError('Required fields: entityType, entityId, documentMetadataId', 400);
  }

  const supabase = await createClient();

  // Verify caller is authenticated
  const user = await getApiRouteUser();
  if (!user) {
    return validationError('Unauthorized', 401);
  }

  // Drawings: update drawings.document_metadata_id directly (simpler for initial wiring)
  if (entityType === 'drawing') {
    const { error: updateError } = await supabase
      .from('drawings')
      .update({
        document_metadata_id: documentMetadataId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entityId);

    if (updateError) {
      console.error('[document-picker/attach] drawing update error:', updateError);
      return apiErrorResponse(updateError);
    }

    return NextResponse.json({ success: true, entityType: 'drawing', entityId, documentMetadataId });
  }

  const resolved = await resolvePatternCEntity(supabase, entityType, entityId);
  if ('error' in resolved) {
    return validationError(resolved.error, resolved.status);
  }

  // All other entity types — insert into junction table
  const {
    table: tableName,
    fkColumn,
    timestampColumn = 'attached_at',
    actorColumn = 'attached_by',
    supportsDocumentType = true,
  } = getPatternCConfig(resolved.entityType);
  let attachmentActorId = user.id;
  if (resolved.entityType === 'crm_deal') {
    const { data: person, error: personError } = await supabase
      .from('people')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (personError || !person) {
      return validationError('CRM attachment actor could not be resolved', 403);
    }
    attachmentActorId = person.id;
  }

  const row: Record<string, unknown> = {
    [fkColumn]:             /^\d+$/.test(resolved.entityId) ? Number(resolved.entityId) : resolved.entityId,
    document_metadata_id:   documentMetadataId,
    [actorColumn]:          attachmentActorId,
    [timestampColumn]:      new Date().toISOString(),
  };
  if (documentType && supportsDocumentType) {
    row['document_type'] = documentType;
  }

  // TypeScript can't verify a dynamically-selected table against a 16-member
  // Insert union (postgrest-js's RejectExcessProperties can't structurally
  // match every member at once here), so this one call drops to the
  // untyped client. Shape is validated by the hardcoded FK_COLUMN +
  // JUNCTION_TABLE maps above, not by the type system, for this call only.
  const untypedDb = supabase as unknown as SupabaseClient;
  const { error: insertError } = await untypedDb
    .from(tableName)
    .insert(row);

  if (insertError) {
    // Conflict on PK = already linked — treat as success
    if (insertError.code === '23505') {
      return NextResponse.json({ success: true, alreadyLinked: true });
    }
    console.error('[document-picker/attach] insert error:', insertError);
    return apiErrorResponse(insertError);
  }

  return NextResponse.json({ success: true, entityType: resolved.entityType, entityId: resolved.entityId, documentMetadataId });
}
