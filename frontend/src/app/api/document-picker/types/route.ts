import { NextResponse } from 'next/server';
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/document-picker/types?for=<entityType>
 *
 * Returns document_type_taxonomy rows where applies_to contains the given
 * entity type. Used by DocumentPicker to show only relevant document types.
 *
 * entityType values: project | subcontract | purchase_order | commitment |
 *   prime_contract | change_order | invoice | submittal | rfi | drawing | company
 *
 * 'commitment' is resolved to both 'subcontract' and 'purchase_order' at the
 * taxonomy level — the taxonomy uses 'commitment' in applies_to so we pass it
 * through directly.
 */
const WHERE = "/api/document-picker/types#GET";

export const GET = withApiGuardrails(WHERE, async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Unauthorized",
      status: 401,
    });
  }

  const entityType = request.nextUrl.searchParams.get('for');

  if (!entityType) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: 'Missing required query param: for',
      status: 400,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('document_type_taxonomy')
    .select('type_key, display_name, category, sort_order')
    .eq('is_active', true)
    .contains('applies_to', [entityType])
    .order('category')
    .order('sort_order');

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: WHERE,
      message: "Failed to load document types.",
      details: { reason: error.message },
    });
  }

  return NextResponse.json(data ?? []);
});
