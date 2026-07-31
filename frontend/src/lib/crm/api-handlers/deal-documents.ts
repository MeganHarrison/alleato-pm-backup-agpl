import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertCrmOwnerOrAdmin, requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

type Params = { dealId: string; documentId?: string };
const BodySchema = z
  .object({ document_id: z.string().trim().min(1).max(500) })
  .strict();

async function requireEditableDeal(dealId: string) {
  const access = await requireCrmAccess("write");
  const { data, error } = await access.db
    .from("crm_deals")
    .select("owner_person_id, archived_at")
    .eq("id", dealId)
    .maybeSingle();
  if (error) return { access, response: apiErrorResponse(error) };
  if (!data) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "crm/deals/documents",
      message: "Deal not found.",
      status: 404,
    });
  }
  if (data.archived_at) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: "crm/deals/documents",
      message: "Restore the deal before changing its documents.",
      status: 409,
    });
  }
  assertCrmOwnerOrAdmin({
    ownerPersonId: data.owner_person_id,
    personId: access.personId,
    isAdmin: access.isAdmin,
    action: "crm/deals/documents",
  });
  return { access, response: null };
}

export const POST = withApiGuardrails<Params>(
  "crm/deals/[dealId]/documents#POST",
  async ({ request, params }) => {
    assertNonNilUuid(params.dealId, "dealId", "crm/deals/documents");
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/deals/[dealId]/documents#POST",
        message: "Choose a valid existing document.",
        status: 400,
      });
    }
    const { access, response } = await requireEditableDeal(params.dealId);
    if (response) return response;
    const { data: document, error: documentError } = await access.db
      .from("document_metadata")
      .select("id")
      .eq("id", parsed.data.document_id)
      .maybeSingle();
    if (documentError) return apiErrorResponse(documentError);
    if (!document) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/deals/[dealId]/documents#POST",
        message: "The selected document was not found.",
        status: 404,
      });
    }
    const { data, error } = await access.db
      .from("crm_deal_documents")
      .insert({
        deal_id: params.dealId,
        document_metadata_id: document.id,
        attached_by_person_id: access.personId,
      })
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data }, { status: 201 });
  },
);

export const DELETE = withApiGuardrails<Params>(
  "crm/deals/[dealId]/documents/[documentId]#DELETE",
  async ({ params }) => {
    assertNonNilUuid(params.dealId, "dealId", "crm/deals/documents");
    if (!params.documentId) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/deals/[dealId]/documents/[documentId]#DELETE",
        message: "Document identifier is required.",
        status: 400,
      });
    }
    const { access, response } = await requireEditableDeal(params.dealId);
    if (response) return response;
    const { data, error } = await access.db
      .from("crm_deal_documents")
      .delete()
      .eq("deal_id", params.dealId)
      .eq("document_metadata_id", params.documentId)
      .select()
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/deals/[dealId]/documents/[documentId]#DELETE",
        message: "This document is no longer linked to the deal.",
        status: 404,
      });
    }
    return NextResponse.json({ data });
  },
);
