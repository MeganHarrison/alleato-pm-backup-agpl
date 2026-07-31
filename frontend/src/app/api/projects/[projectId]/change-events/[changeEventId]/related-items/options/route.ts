import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

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

interface RelatedItemOption {
  id: string;
  relatedNumber: string | null;
  relatedTitle: string;
  relatedStatus: string | null;
}

function optionSort(a: RelatedItemOption, b: RelatedItemOption): number {
  return (a.relatedNumber || a.relatedTitle).localeCompare(b.relatedNumber || b.relatedTitle, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/related-items/options#GET",
  async ({ request, params }) => {
  
    const { projectId, changeEventId } = await params;

    // Auth first — before any param validation — so unauthenticated callers
    // always get 401, never a 400 for a missing/invalid query param.
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/change-events/[changeEventId]/related-items/options#GET",
        message: "Authentication required.",
      });
    }

    const parsedProjectId = Number.parseInt(projectId, 10);
    if (Number.isNaN(parsedProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const typeParam = request.nextUrl.searchParams.get("type")?.trim().toLowerCase();
    if (!typeParam || !isSupportedRelatedType(typeParam)) {
      return NextResponse.json({ error: "Invalid related item type" }, { status: 400 });
    }

    const search = request.nextUrl.searchParams.get("search")?.trim() || "";
    const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);
    const safeLimit = Number.isNaN(limit) ? 50 : Math.max(1, Math.min(limit, 100));

    const supabase = await createClient();

    let options: RelatedItemOption[] = [];

    switch (typeParam) {
      case "change_event": {
        let query = supabase
          .from("change_events")
          .select("id, number, title, status")
          .eq("project_id", parsedProjectId)
          .is("deleted_at", null)
          .neq("id", changeEventId)
          .order("number", { ascending: true })
          .limit(safeLimit);

        if (search) {
          query = query.or(`title.ilike.%${search}%,number.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
          return apiErrorResponse(error);
        }

        options = (data || []).map((item) => ({
          id: item.id,
          relatedNumber: item.number,
          relatedTitle: item.title,
          relatedStatus: item.status,
        }));
        break;
      }

      case "document": {
        let query = supabase
          .from("project_documents")
          .select("id, title, file_name, status")
          .eq("project_id", parsedProjectId)
          .is("deleted_at", null)
          .order("title", { ascending: true })
          .limit(safeLimit);

        if (search) {
          query = query.or(`title.ilike.%${search}%,file_name.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
          return apiErrorResponse(error);
        }

        options = (data || []).map((item) => ({
          id: String(item.id),
          relatedNumber: null,
          relatedTitle: item.title || item.file_name,
          relatedStatus: item.status,
        }));
        break;
      }

      case "rfi": {
        let query = supabase
          .from("rfis")
          .select("id, number, subject, status")
          .eq("project_id", parsedProjectId)
          .order("number", { ascending: true })
          .limit(safeLimit);

        if (search) {
          query = query.or(`subject.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
          return apiErrorResponse(error);
        }

        options = (data || []).map((item) => ({
          id: item.id,
          relatedNumber: String(item.number),
          relatedTitle: item.subject,
          relatedStatus: item.status,
        }));

        if (search) {
          const searchLower = search.toLowerCase();
          options = options.filter(
            (item) =>
              (item.relatedNumber || "").toLowerCase().includes(searchLower) ||
              item.relatedTitle.toLowerCase().includes(searchLower),
          );
        }
        break;
      }

      case "submittal": {
        let query = supabase
          .from("submittals")
          .select("id, submittal_number, title, status")
          .eq("project_id", parsedProjectId)
          .is("deleted_at", null)
          .order("submittal_number", { ascending: true })
          .limit(safeLimit);

        if (search) {
          query = query.or(`title.ilike.%${search}%,submittal_number.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
          return apiErrorResponse(error);
        }

        options = (data || []).map((item) => ({
          id: item.id,
          relatedNumber: item.submittal_number,
          relatedTitle: item.title,
          relatedStatus: item.status,
        }));
        break;
      }

      case "drawing": {
        let query = supabase
          .from("drawings")
          .select("id, drawing_number, title")
          .eq("project_id", parsedProjectId)
          .order("drawing_number", { ascending: true })
          .limit(safeLimit);

        if (search) {
          query = query.or(`title.ilike.%${search}%,drawing_number.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
          return apiErrorResponse(error);
        }

        options = (data || []).map((item) => ({
          id: item.id,
          relatedNumber: item.drawing_number,
          relatedTitle: item.title,
          relatedStatus: null,
        }));
        break;
      }

      case "meeting": {
        let query = supabase
          .from("document_metadata")
          .select("id, title, file_name, date, status")
          .eq("project_id", parsedProjectId)
          .eq("type", "meeting")
          .is("deleted_at", null)
          .order("date", { ascending: false })
          .limit(safeLimit);

        if (search) {
          query = query.or(`title.ilike.%${search}%,file_name.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
          return apiErrorResponse(error);
        }

        options = (data || []).map((item) => ({
          id: item.id,
          relatedNumber: item.date,
          relatedTitle: item.title || item.file_name || "Meeting",
          relatedStatus: item.status,
        }));
        break;
      }

      case "specification": {
        let query = supabase
          .from("specification_sections")
          .select("id, section_number, title, status")
          .eq("project_id", parsedProjectId)
          .order("section_number", { ascending: true })
          .limit(safeLimit);

        if (search) {
          query = query.or(`title.ilike.%${search}%,section_number.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
          return apiErrorResponse(error);
        }

        options = (data || []).map((item) => ({
          id: String(item.id),
          relatedNumber: item.section_number,
          relatedTitle: item.title,
          relatedStatus: item.status,
        }));
        break;
      }

      case "prime_contract_change_order": {
        let query = supabase
          .from("prime_contract_change_orders")
          .select("id, pcco_number, title, status")
          .eq("project_id", parsedProjectId)
          .order("pcco_number", { ascending: true })
          .limit(safeLimit);

        if (search) {
          query = query.or(`title.ilike.%${search}%,pcco_number.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
          return apiErrorResponse(error);
        }

        options = (data || []).map((item) => ({
          id: String(item.id),
          relatedNumber: item.pcco_number,
          relatedTitle: item.title,
          relatedStatus: item.status,
        }));
        break;
      }

      case "commitment_co": {
        let query = supabase
          .from("commitment_pcos")
          .select("id, pco_number, title, status")
          .eq("project_id", parsedProjectId)
          .order("pco_number", { ascending: true })
          .limit(safeLimit);

        if (search) {
          query = query.or(`title.ilike.%${search}%,pco_number.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
          return apiErrorResponse(error);
        }

        options = (data || []).map((item) => ({
          id: String(item.id),
          relatedNumber: item.pco_number,
          relatedTitle: item.title,
          relatedStatus: item.status,
        }));
        break;
      }

      case "commitment": {
        let query = supabase
          .from("commitments_unified")
          .select("id, contract_number, title, status")
          .eq("project_id", parsedProjectId)
          .is("deleted_at", null)
          .order("contract_number", { ascending: true })
          .limit(safeLimit);

        if (search) {
          query = query.or(`title.ilike.%${search}%,contract_number.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
          return apiErrorResponse(error);
        }

        options = (data || []).map((item) => ({
          id: String(item.id),
          relatedNumber: item.contract_number,
          relatedTitle: item.title || item.contract_number || "Commitment",
          relatedStatus: item.status,
        }));
        break;
      }
    }

    return NextResponse.json({ data: options.sort(optionSort) });
    },
);
