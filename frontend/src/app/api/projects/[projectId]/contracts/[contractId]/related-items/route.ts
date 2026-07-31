import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string; contractId: string }>;
}

const RELATED_ITEM_TYPES = [
  "change_event",
  "drawing",
  "rfi",
  "specification",
  "submittal",
  "prime_contract_change_order",
  "commitment",
] as const;

type RelatedItemType = (typeof RELATED_ITEM_TYPES)[number];

/**
 * commitment_related_items currently constrains commitment_type to
 * ('subcontract', 'purchase_order'). Until a dedicated prime_contract type/table
 * is introduced, prime-contract links are stored under this legacy discriminator.
 */
const PRIME_CONTRACT_STORAGE_TYPE = "subcontract";

function isSupportedRelatedType(value: string): value is RelatedItemType {
  return (RELATED_ITEM_TYPES as readonly string[]).includes(value);
}

function buildRelatedHref(projectId: number, type: RelatedItemType, id: string): string {
  switch (type) {
    case "change_event":
      return `/${projectId}/change-events/${id}`;
    case "drawing":
      return `/${projectId}/drawings/${id}`;
    case "rfi":
      return `/${projectId}/rfis/${id}`;
    case "specification":
      return `/${projectId}/specifications/${id}`;
    case "submittal":
      return `/${projectId}/submittals/${id}`;
    case "prime_contract_change_order":
      return `/${projectId}/change-orders/prime/${id}`;
    case "commitment":
      return `/${projectId}/commitments/${id}`;
    default:
      return `/${projectId}`;
  }
}

async function resolveRelatedRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: number,
  type: RelatedItemType,
  relatedId: string,
) {
  switch (type) {
    case "change_event": {
      const { data } = await supabase
        .from("change_events")
        .select("id, number, title, status")
        .eq("project_id", projectId)
        .eq("id", relatedId)
        .is("deleted_at", null)
        .single();
      if (!data) return null;
      return { relatedNumber: data.number, relatedTitle: data.title, relatedStatus: data.status };
    }
    case "rfi": {
      const { data } = await supabase
        .from("rfis")
        .select("id, number, subject, status")
        .eq("project_id", projectId)
        .eq("id", relatedId)
        .single();
      if (!data) return null;
      return { relatedNumber: String(data.number), relatedTitle: data.subject, relatedStatus: data.status };
    }
    case "submittal": {
      const { data } = await supabase
        .from("submittals")
        .select("id, submittal_number, title, status")
        .eq("project_id", projectId)
        .eq("id", relatedId)
        .is("deleted_at", null)
        .single();
      if (!data) return null;
      return { relatedNumber: data.submittal_number, relatedTitle: data.title, relatedStatus: data.status };
    }
    case "drawing": {
      const { data } = await supabase
        .from("drawings")
        .select("id, drawing_number, title")
        .eq("project_id", projectId)
        .eq("id", relatedId)
        .single();
      if (!data) return null;
      return { relatedNumber: data.drawing_number, relatedTitle: data.title, relatedStatus: null };
    }
    case "specification": {
      const specificationSectionId = Number(relatedId);
      if (!Number.isSafeInteger(specificationSectionId)) return null;

      const { data } = await supabase
        .from("specification_sections")
        .select("id, section_number, title, status")
        .eq("project_id", projectId)
        .eq("id", specificationSectionId)
        .single();
      if (!data) return null;
      return { relatedNumber: data.section_number, relatedTitle: data.title, relatedStatus: data.status };
    }
    case "prime_contract_change_order": {
      const { data } = await supabase
        .from("prime_contract_change_orders")
        .select("id, pcco_number, title, status")
        .eq("project_id", projectId)
        .eq("id", Number(relatedId))
        .single();
      if (!data) return null;
      return { relatedNumber: data.pcco_number, relatedTitle: data.title, relatedStatus: data.status };
    }
    case "commitment": {
      const { data } = await supabase
        .from("commitments_unified")
        .select("id, contract_number, title, status")
        .eq("project_id", projectId)
        .eq("id", relatedId)
        .single();
      if (!data) return null;
      return { relatedNumber: data.contract_number, relatedTitle: data.title, relatedStatus: data.status };
    }
    default:
      return null;
  }
}

export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/related-items#GET",
  async ({ params }) => {
    const { projectId, contractId } = await params as Awaited<RouteParams["params"]>;
    const projectIdNum = Number(projectId);
    if (!Number.isFinite(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts/[contractId]/related-items#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("commitment_related_items")
      .select("id, related_type, related_id, related_number, related_title, related_status, related_url, created_at")
      .eq("project_id", projectIdNum)
      .eq("commitment_id", contractId)
      .eq("commitment_type", PRIME_CONTRACT_STORAGE_TYPE)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("schema cache")) {
        return NextResponse.json({ data: [] });
      }
      return apiErrorResponse(error);
    }

    const response = (data || []).map((item) => ({
      id: item.id,
      relatedType: item.related_type,
      relatedId: item.related_id,
      relatedNumber: item.related_number,
      relatedTitle: item.related_title,
      relatedStatus: item.related_status,
      relatedUrl: item.related_url,
      createdAt: item.created_at,
    }));

    return NextResponse.json({ data: response });
  },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/related-items#POST",
  async ({ request, params }) => {
    const { projectId, contractId } = await params as Awaited<RouteParams["params"]>;
    const projectIdNum = Number(projectId);
    if (!Number.isFinite(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts/[contractId]/related-items#POST",
        message: "Authentication required.",
      });
    }

    // Fail loudly if the contract does not belong to this project.
    const { data: contract, error: contractError } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", contractId)
      .eq("project_id", projectIdNum)
      .maybeSingle();
    if (contractError) return apiErrorResponse(contractError);
    if (!contract) {
      return NextResponse.json({ error: "Prime contract not found for project" }, { status: 404 });
    }

    const body = (await request.json()) as { relatedType?: string; relatedId?: string };
    const relatedType = body.relatedType?.trim().toLowerCase();
    const relatedId = body.relatedId?.trim();

    if (!relatedType || !isSupportedRelatedType(relatedType)) {
      return NextResponse.json({ error: "Invalid related item type" }, { status: 400 });
    }
    if (!relatedId) {
      return NextResponse.json({ error: "Related item id is required" }, { status: 400 });
    }

    const resolved = await resolveRelatedRecord(supabase, projectIdNum, relatedType, relatedId);
    if (!resolved) {
      return NextResponse.json({ error: "Related record not found for this project" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("commitment_related_items")
      .insert({
        commitment_id: contractId,
        commitment_type: PRIME_CONTRACT_STORAGE_TYPE,
        project_id: projectIdNum,
        related_type: relatedType,
        related_id: relatedId,
        related_number: resolved.relatedNumber ?? "",
        related_title: resolved.relatedTitle ?? "",
        related_status: resolved.relatedStatus,
        related_url: buildRelatedHref(projectIdNum, relatedType, relatedId),
        created_by: user.id,
      })
      .select("id, related_type, related_id, related_number, related_title, related_status, related_url, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "This item is already linked" }, { status: 409 });
      }
      return apiErrorResponse(error);
    }

    return NextResponse.json({
      data: {
        id: data.id,
        relatedType: data.related_type,
        relatedId: data.related_id,
        relatedNumber: data.related_number,
        relatedTitle: data.related_title,
        relatedStatus: data.related_status,
        relatedUrl: data.related_url,
        createdAt: data.created_at,
      },
    }, { status: 201 });
  },
);

export const DELETE = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/related-items#DELETE",
  async ({ request, params }) => {
    const { projectId, contractId } = await params as Awaited<RouteParams["params"]>;
    const projectIdNum = Number(projectId);
    if (!Number.isFinite(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts/[contractId]/related-items#DELETE",
        message: "Authentication required.",
      });
    }

    const { searchParams } = new URL(request.url);
    const relatedItemId = searchParams.get("id");
    if (!relatedItemId) {
      return NextResponse.json({ error: "id query param is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("commitment_related_items")
      .delete()
      .eq("id", relatedItemId)
      .eq("project_id", projectIdNum)
      .eq("commitment_id", contractId)
      .eq("commitment_type", PRIME_CONTRACT_STORAGE_TYPE);

    if (error) return apiErrorResponse(error);

    return NextResponse.json({ success: true });
  },
);
