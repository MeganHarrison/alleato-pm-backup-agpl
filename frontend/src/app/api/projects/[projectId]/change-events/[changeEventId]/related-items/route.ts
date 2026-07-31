import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string; changeEventId: string }>;
}

const RELATED_ITEM_TYPES = [
  "change_event",
  "document",
  "drawing",
  "meeting",
  "rfi",
  "specification",
  "submittal",
  "prime_contract_change_order",
  "commitment_co",
  "commitment",
] as const;

type RelatedItemType = (typeof RELATED_ITEM_TYPES)[number];

function isSupportedRelatedType(value: string): value is RelatedItemType {
  return (RELATED_ITEM_TYPES as readonly string[]).includes(value);
}

function parseNumericRelatedId(relatedId: string): number | null {
  const parsed = Number.parseInt(relatedId, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildRelatedHref(projectId: number, type: RelatedItemType, id: string): string {
  switch (type) {
    case "change_event":
      return `/${projectId}/change-events/${id}`;
    case "document":
      return `/${projectId}/documents/${id}`;
    case "drawing":
      return `/${projectId}/drawings/${id}`;
    case "meeting":
      return `/${projectId}/meetings/${id}`;
    case "rfi":
      return `/${projectId}/rfis/${id}`;
    case "specification":
      return `/${projectId}/specifications/${id}`;
    case "submittal":
      return `/${projectId}/submittals/${id}`;
    case "prime_contract_change_order":
      return `/${projectId}/prime-contracts/change-orders/${id}`;
    case "commitment_co":
      return `/${projectId}/commitments/change-orders/${id}`;
    case "commitment":
      return `/${projectId}/commitments/${id}`;
    default:
      return `/${projectId}`;
  }
}

interface RelatedSourceRecord {
  relatedNumber: string | null;
  relatedTitle: string;
  relatedStatus: string | null;
}

async function getRelatedSourceRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: number,
  changeEventId: string,
  relatedType: RelatedItemType,
  relatedId: string,
): Promise<RelatedSourceRecord | null> {
  switch (relatedType) {
    case "change_event": {
      if (relatedId === changeEventId) return null;
      const { data, error } = await supabase
        .from("change_events")
        .select("id, number, title, status, deleted_at")
        .eq("project_id", projectId)
        .eq("id", relatedId)
        .is("deleted_at", null)
        .single();

      if (error || !data) return null;
      return {
        relatedNumber: data.number,
        relatedTitle: data.title,
        relatedStatus: data.status,
      };
    }

    case "document": {
      const parsedRelatedId = parseNumericRelatedId(relatedId);
      if (parsedRelatedId === null) return null;

      const { data, error } = await supabase
        .from("project_documents")
        .select("id, title, file_name, status, deleted_at")
        .eq("project_id", projectId)
        .eq("id", parsedRelatedId)
        .is("deleted_at", null)
        .single();

      if (error || !data) return null;
      return {
        relatedNumber: null,
        relatedTitle: data.title || data.file_name,
        relatedStatus: data.status,
      };
    }

    case "rfi": {
      const { data, error } = await supabase
        .from("rfis")
        .select("id, number, subject, status")
        .eq("project_id", projectId)
        .eq("id", relatedId)
        .single();

      if (error || !data) return null;
      return {
        relatedNumber: String(data.number),
        relatedTitle: data.subject,
        relatedStatus: data.status,
      };
    }

    case "submittal": {
      const { data, error } = await supabase
        .from("submittals")
        .select("id, submittal_number, title, status, deleted_at")
        .eq("project_id", projectId)
        .eq("id", relatedId)
        .is("deleted_at", null)
        .single();

      if (error || !data) return null;
      return {
        relatedNumber: data.submittal_number,
        relatedTitle: data.title,
        relatedStatus: data.status,
      };
    }

    case "drawing": {
      const { data, error } = await supabase
        .from("drawings")
        .select("id, drawing_number, title")
        .eq("project_id", projectId)
        .eq("id", relatedId)
        .single();

      if (error || !data) return null;
      return {
        relatedNumber: data.drawing_number,
        relatedTitle: data.title,
        relatedStatus: null,
      };
    }

    case "meeting": {
      const { data, error } = await supabase
        .from("document_metadata")
        .select("id, title, file_name, date, status, deleted_at")
        .eq("project_id", projectId)
        .eq("id", relatedId)
        .eq("type", "meeting")
        .is("deleted_at", null)
        .single();

      if (error || !data) return null;
      return {
        relatedNumber: data.date,
        relatedTitle: data.title || data.file_name || "Meeting",
        relatedStatus: data.status,
      };
    }

    case "specification": {
      const parsedRelatedId = parseNumericRelatedId(relatedId);
      if (parsedRelatedId === null) return null;

      const { data, error } = await supabase
        .from("specification_sections")
        .select("id, section_number, title, status")
        .eq("project_id", projectId)
        .eq("id", parsedRelatedId)
        .single();

      if (error || !data) return null;
      return {
        relatedNumber: data.section_number,
        relatedTitle: data.title,
        relatedStatus: data.status,
      };
    }

    case "prime_contract_change_order": {
      const parsedRelatedId = parseNumericRelatedId(relatedId);
      if (parsedRelatedId === null) return null;

      const { data, error } = await supabase
        .from("prime_contract_change_orders")
        .select("id, pcco_number, title, status")
        .eq("project_id", projectId)
        .eq("id", parsedRelatedId)
        .single();

      if (error || !data) return null;
      return {
        relatedNumber: data.pcco_number,
        relatedTitle: data.title,
        relatedStatus: data.status,
      };
    }

    case "commitment_co": {
      const { data, error } = await supabase
        .from("commitment_pcos")
        .select("id, pco_number, title, status")
        .eq("project_id", projectId)
        .eq("id", relatedId)
        .single();

      if (error || !data) return null;
      return {
        relatedNumber: data.pco_number,
        relatedTitle: data.title,
        relatedStatus: data.status,
      };
    }

    case "commitment": {
      const { data, error } = await supabase
        .from("commitments_unified")
        .select("id, contract_number, title, status, deleted_at")
        .eq("project_id", projectId)
        .eq("id", relatedId)
        .is("deleted_at", null)
        .single();

      if (error || !data) return null;
      return {
        relatedNumber: data.contract_number,
        relatedTitle: data.title || data.contract_number || "Commitment",
        relatedStatus: data.status,
      };
    }

    default:
      return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/related-items#GET",
  async ({ params }) => {

    const { projectId, changeEventId } = await params;
    const parsedProjectId = Number.parseInt(projectId, 10);
    if (Number.isNaN(parsedProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }
    if (!UUID_RE.test(changeEventId)) {
      return NextResponse.json({ error: "Invalid change event id" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/change-events/[changeEventId]/related-items#GET",
        message: "Authentication required.",
      });
    }
    const { data, error } = await supabase
      .from("change_event_related_items")
      .select("id, related_type, related_id, related_number, related_title, related_status, related_url, created_at")
      .eq("project_id", parsedProjectId)
      .eq("change_event_id", changeEventId)
      .order("created_at", { ascending: false });

    if (error) {
      if (
        error.code === "42P01" ||
        error.message?.includes("Could not find") ||
        error.message?.includes("schema cache")
      ) {
        return NextResponse.json({ data: [] });
      }

      return apiErrorResponse(error);
    }

    const response = (data || []).map((item) => {
      const type = isSupportedRelatedType(item.related_type)
        ? item.related_type
        : "change_event";

      return {
        id: item.id,
        relatedType: item.related_type,
        relatedId: item.related_id,
        relatedNumber: item.related_number,
        relatedTitle: item.related_title,
        relatedStatus: item.related_status,
        relatedUrl:
          item.related_url || buildRelatedHref(parsedProjectId, type, item.related_id),
        createdAt: item.created_at,
      };
    });

    return NextResponse.json({ data: response });
    },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/related-items#POST",
  async ({ request, params }) => {
  
    const { projectId, changeEventId } = await params;
    const parsedProjectId = Number.parseInt(projectId, 10);
    if (Number.isNaN(parsedProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const guard = await requirePermission(parsedProjectId, "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/related-items#POST", message: "Authentication required." });
    }

    const body = (await request.json()) as {
      relatedType?: string;
      relatedId?: string;
    };

    const relatedType = body.relatedType?.trim().toLowerCase();
    const relatedId = body.relatedId?.trim();

    if (!relatedType || !isSupportedRelatedType(relatedType)) {
      return NextResponse.json({ error: "Invalid related item type" }, { status: 400 });
    }

    if (!relatedId) {
      return NextResponse.json({ error: "Related item id is required" }, { status: 400 });
    }

    const { data: parentEvent, error: parentError } = await supabase
      .from("change_events")
      .select("id")
      .eq("id", changeEventId)
      .eq("project_id", parsedProjectId)
      .is("deleted_at", null)
      .single();

    if (parentError || !parentEvent) {
      return NextResponse.json({ error: "Change event not found" }, { status: 404 });
    }

    const sourceRecord = await getRelatedSourceRecord(
      supabase,
      parsedProjectId,
      changeEventId,
      relatedType,
      relatedId,
    );

    if (!sourceRecord) {
      return NextResponse.json(
        { error: "Related record not found for this project" },
        { status: 404 },
      );
    }

    const { data, error } = await supabase
      .from("change_event_related_items")
      .insert({
        project_id: parsedProjectId,
        change_event_id: changeEventId,
        related_type: relatedType,
        related_id: relatedId,
        related_number: sourceRecord.relatedNumber,
        related_title: sourceRecord.relatedTitle,
        related_status: sourceRecord.relatedStatus,
        related_url: buildRelatedHref(parsedProjectId, relatedType, relatedId),
        created_by: user.id,
      })
      .select("id, related_type, related_id, related_number, related_title, related_status, related_url, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This item is already linked" },
          { status: 409 },
        );
      }

      if (
        error.code === "42P01" ||
        error.message?.includes("Could not find") ||
        error.message?.includes("schema cache")
      ) {
        return NextResponse.json(
          { error: "Related items are unavailable until migrations are applied" },
          { status: 503 },
        );
      }

      return apiErrorResponse(error);
    }

    return NextResponse.json(
      {
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
      },
      { status: 201 },
    );
    },
);
