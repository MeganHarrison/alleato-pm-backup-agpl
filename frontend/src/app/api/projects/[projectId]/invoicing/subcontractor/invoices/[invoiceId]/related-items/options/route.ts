import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string; invoiceId: string }>;
}

export interface RelatedItemOption {
  id: string;
  relatedNumber: string | null;
  relatedTitle: string;
  relatedStatus: string | null;
}

function optionSort(a: RelatedItemOption, b: RelatedItemOption): number {
  return (a.relatedNumber || "").localeCompare(b.relatedNumber || "", undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export const GET = withApiGuardrails(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/related-items/options#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const parsedProjectId = Number.parseInt(projectId, 10);
    if (Number.isNaN(parsedProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const typeParam = request.nextUrl.searchParams.get("type")?.trim().toLowerCase() ?? "";
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10) || 50),
    );

    const supabase = await createClient();
    let options: RelatedItemOption[] = [];

    switch (typeParam) {
      case "change_event": {
        let q = supabase
          .from("change_events")
          .select("id, number, title, status")
          .eq("project_id", parsedProjectId)
          .is("deleted_at", null)
          .limit(limit);
        if (search) q = q.or(`title.ilike.%${search}%,number.ilike.%${search}%`);
        const { data, error } = await q;
        if (error) return apiErrorResponse(error);
        options = (data ?? []).map((r) => ({
          id: r.id,
          relatedNumber: r.number,
          relatedTitle: r.title,
          relatedStatus: r.status,
        }));
        break;
      }

      case "change_order_request": {
        let q = supabase
          .from("prime_contract_change_orders")
          .select("id, pcco_number, title, status")
          .eq("project_id", parsedProjectId)
          .limit(limit);
        if (search) q = q.or(`title.ilike.%${search}%,pcco_number.ilike.%${search}%`);
        const { data, error } = await q;
        if (error) return apiErrorResponse(error);
        options = (data ?? []).map((r) => ({
          id: String(r.id),
          relatedNumber: r.pcco_number,
          relatedTitle: r.title,
          relatedStatus: r.status,
        }));
        break;
      }

      case "commitment": {
        // subcontracts
        let qSub = supabase
          .from("subcontracts")
          .select("id, contract_number, title, status")
          .eq("project_id", parsedProjectId)
          .is("deleted_at", null)
          .limit(limit);
        if (search) qSub = qSub.or(`title.ilike.%${search}%,contract_number.ilike.%${search}%`);

        // purchase orders
        let qPo = supabase
          .from("purchase_orders")
          .select("id, contract_number, title, status")
          .eq("project_id", parsedProjectId)
          .is("deleted_at", null)
          .limit(limit);
        if (search) qPo = qPo.or(`title.ilike.%${search}%,contract_number.ilike.%${search}%`);

        const [subRes, poRes] = await Promise.all([qSub, qPo]);
        if (subRes.error) return apiErrorResponse(subRes.error);
        if (poRes.error) return apiErrorResponse(poRes.error);

        const subs = (subRes.data ?? []).map((r) => ({
          id: r.id,
          relatedNumber: r.contract_number,
          relatedTitle: r.title ?? r.contract_number,
          relatedStatus: r.status,
        }));
        const pos = (poRes.data ?? []).map((r) => ({
          id: r.id,
          relatedNumber: r.contract_number,
          relatedTitle: r.title ?? r.contract_number,
          relatedStatus: r.status,
        }));
        options = [...subs, ...pos];
        break;
      }

      case "contract": {
        let q = supabase
          .from("prime_contracts")
          .select("id, contract_number, title, status")
          .eq("project_id", parsedProjectId)
          .limit(limit);
        if (search) q = q.or(`title.ilike.%${search}%,contract_number.ilike.%${search}%`);
        const { data, error } = await q;
        if (error) return apiErrorResponse(error);
        options = (data ?? []).map((r) => ({
          id: r.id,
          relatedNumber: r.contract_number,
          relatedTitle: r.title,
          relatedStatus: r.status,
        }));
        break;
      }

      case "company": {
        let q = supabase
          .from("companies")
          .select("id, name, type, status")
          .limit(limit);
        if (search) q = q.or(`name.ilike.%${search}%`);
        else q = q.order("name", { ascending: true });
        const { data, error } = await q;
        if (error) return apiErrorResponse(error);
        options = (data ?? []).map((r) => ({
          id: r.id,
          relatedNumber: null,
          relatedTitle: r.name,
          relatedStatus: r.type ?? r.status,
        }));
        break;
      }

      case "contact": {
        let q = supabase
          .from("people")
          .select("id, first_name, last_name, email, job_title")
          .limit(limit);
        if (search) {
          q = q.or(
            `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
          );
        } else {
          q = q.order("last_name", { ascending: true });
        }
        const { data, error } = await q;
        if (error) return apiErrorResponse(error);
        options = (data ?? []).map((r) => ({
          id: r.id,
          relatedNumber: null,
          relatedTitle: `${r.first_name} ${r.last_name}`,
          relatedStatus: r.job_title ?? r.email,
        }));
        break;
      }

      case "cost_code": {
        // project_budget_codes joined with cost_codes
        const q = supabase
          .from("project_budget_codes")
          .select("id, cost_codes!inner(id, title, division_title)")
          .eq("project_id", parsedProjectId)
          .eq("is_active", true)
          .limit(limit);

        const { data, error } = await q;
        if (error) return apiErrorResponse(error);

        // Filter in memory if search
        const searchLower = search.toLowerCase();
        options = (data ?? [])
          .filter((r) => {
            const cc = r.cost_codes as unknown as { title?: string | null; division_title?: string | null } | null;
            if (!cc) return false;
            if (!search) return true;
            const haystack = `${cc.title ?? ""} ${cc.division_title ?? ""}`.toLowerCase();
            return haystack.includes(searchLower);
          })
          .map((r) => {
            const cc = r.cost_codes as unknown as { id: string; title?: string | null; division_title?: string | null };
            const label = cc.division_title ? `${cc.division_title} — ${cc.title ?? ""}` : (cc.title ?? "Unknown");
            return {
              id: r.id,
              relatedNumber: null,
              relatedTitle: label,
              relatedStatus: null,
            };
          });
        break;
      }

      case "direct_cost": {
        let q = supabase
          .from("direct_costs")
          .select("id, invoice_number, description, status, cost_type, date")
          .eq("project_id", parsedProjectId)
          .is("is_deleted", null)
          .order("date", { ascending: false })
          .limit(limit);
        if (search) {
          q = q.or(`description.ilike.%${search}%,invoice_number.ilike.%${search}%`);
        }
        const { data, error } = await q;
        if (error) return apiErrorResponse(error);
        options = (data ?? []).map((r) => ({
          id: r.id,
          relatedNumber: r.invoice_number,
          relatedTitle: r.description ?? r.cost_type ?? r.date,
          relatedStatus: r.status,
        }));
        break;
      }

      case "document": {
        let q = supabase
          .from("document_metadata")
          .select("id, title, file_name, source")
          .eq("project_id", parsedProjectId)
          .is("deleted_at", null)
          .limit(limit);
        if (search) q = q.or(`title.ilike.%${search}%,file_name.ilike.%${search}%`);
        else q = q.order("created_at", { ascending: false });
        const { data, error } = await q;
        if (error) return apiErrorResponse(error);
        options = (data ?? []).map((r) => ({
          id: r.id,
          relatedNumber: null,
          relatedTitle: r.title ?? r.file_name ?? "Document",
          relatedStatus: r.source,
        }));
        break;
      }

      case "drawing": {
        let q = supabase
          .from("drawings")
          .select("id, drawing_number, title")
          .eq("project_id", parsedProjectId)
          .limit(limit);
        if (search) q = q.or(`title.ilike.%${search}%,drawing_number.ilike.%${search}%`);
        else q = q.order("drawing_number", { ascending: true });
        const { data, error } = await q;
        if (error) return apiErrorResponse(error);
        options = (data ?? []).map((r) => ({
          id: r.id,
          relatedNumber: r.drawing_number,
          relatedTitle: r.title,
          relatedStatus: null,
        }));
        break;
      }

      case "drawing_revision": {
        const q = supabase
          .from("drawing_revisions")
          .select("id, revision_number, description, status, drawings!inner(drawing_number, title, project_id)")
          .limit(limit);

        const { data, error } = await q;
        if (error) return apiErrorResponse(error);

        const searchLower = search.toLowerCase();
        options = (data ?? [])
          .filter((r) => {
            const d = r.drawings as unknown as { project_id: number; drawing_number?: string | null; title?: string | null } | null;
            if (!d || d.project_id !== parsedProjectId) return false;
            if (!search) return true;
            const haystack = `${d.drawing_number ?? ""} ${d.title ?? ""} ${r.revision_number}`.toLowerCase();
            return haystack.includes(searchLower);
          })
          .map((r) => {
            const d = r.drawings as unknown as { drawing_number?: string | null; title?: string | null };
            return {
              id: r.id,
              relatedNumber: `${d.drawing_number ?? ""}  Rev ${r.revision_number}`,
              relatedTitle: d.title ?? "Drawing Revision",
              relatedStatus: r.status,
            };
          })
          .slice(0, limit);
        break;
      }

      case "rfi": {
        let q = supabase
          .from("rfis")
          .select("id, number, subject, status")
          .eq("project_id", parsedProjectId)
          .order("number", { ascending: true })
          .limit(limit);
        if (search) q = q.or(`subject.ilike.%${search}%`);
        const { data, error } = await q;
        if (error) return apiErrorResponse(error);
        const searchLower = search.toLowerCase();
        options = (data ?? [])
          .filter((r) => !search || String(r.number).includes(searchLower) || r.subject.toLowerCase().includes(searchLower))
          .map((r) => ({
            id: r.id,
            relatedNumber: String(r.number),
            relatedTitle: r.subject,
            relatedStatus: r.status,
          }));
        break;
      }

      case "punch_list": {
        let q = supabase
          .from("punch_items")
          .select("id, number, title, status")
          .eq("project_id", parsedProjectId)
          .eq("is_deleted", false)
          .order("number", { ascending: true })
          .limit(limit);
        if (search) q = q.or(`title.ilike.%${search}%`);
        const { data, error } = await q;
        if (error) return apiErrorResponse(error);
        options = (data ?? []).map((r) => ({
          id: r.id,
          relatedNumber: String(r.number),
          relatedTitle: r.title,
          relatedStatus: r.status,
        }));
        break;
      }

      case "specification": {
        let q = supabase
          .from("specification_sections")
          .select("id, section_number, title, status")
          .eq("project_id", parsedProjectId)
          .order("section_number", { ascending: true })
          .limit(limit);
        if (search) q = q.or(`title.ilike.%${search}%,section_number.ilike.%${search}%`);
        const { data, error } = await q;
        if (error) return apiErrorResponse(error);
        options = (data ?? []).map((r) => ({
          id: String(r.id),
          relatedNumber: r.section_number,
          relatedTitle: r.title,
          relatedStatus: r.status,
        }));
        break;
      }

      case "submittal": {
        let q = supabase
          .from("submittals")
          .select("id, submittal_number, title, status")
          .eq("project_id", parsedProjectId)
          .is("deleted_at", null)
          .order("submittal_number", { ascending: true })
          .limit(limit);
        if (search) q = q.or(`title.ilike.%${search}%,submittal_number.ilike.%${search}%`);
        const { data, error } = await q;
        if (error) return apiErrorResponse(error);
        options = (data ?? []).map((r) => ({
          id: r.id,
          relatedNumber: r.submittal_number,
          relatedTitle: r.title,
          relatedStatus: r.status,
        }));
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid related item type" }, { status: 400 });
    }

    return NextResponse.json({ data: options.sort(optionSort) });
    },
);
