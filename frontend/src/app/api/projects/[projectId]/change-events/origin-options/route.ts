import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const ORIGIN_TYPES = ["emails", "meetings", "rfis"] as const;
type OriginType = (typeof ORIGIN_TYPES)[number];

function isValidOriginType(value: string): value is OriginType {
  return (ORIGIN_TYPES as readonly string[]).includes(value);
}

interface OriginOption {
  id: string;
  label: string;
  number: string | null;
  status: string | null;
}

/**
 * GET /api/projects/[projectId]/change-events/origin-options?type=rfis
 * Returns specific records for a given origin type so the user can pick
 * the exact meeting, email, or RFI that originated the change event.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/origin-options#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;

    // Auth first — before any param handling or early returns — so an
    // unauthenticated caller always gets 401, never a 200 empty list.
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/change-events/origin-options#GET",
        message: "Authentication required.",
      });
    }

    const parsedProjectId = Number.parseInt(projectId, 10);
    if (Number.isNaN(parsedProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const typeParam = request.nextUrl.searchParams.get("type")?.trim().toLowerCase();
    // Non-linkable origin types (internal, field, owner, etc.) have no associated
    // records to look up — return an empty list rather than a 400 error.
    if (!typeParam || !isValidOriginType(typeParam)) {
      return NextResponse.json({ data: [] });
    }

    const search = request.nextUrl.searchParams.get("search")?.trim() || "";
    const supabase = await createClient();
    let options: OriginOption[] = [];

    switch (typeParam) {
      case "rfis": {
        let query = supabase
          .from("rfis")
          .select("id, number, subject, status")
          .eq("project_id", parsedProjectId)
          .order("number", { ascending: true })
          .limit(100);

        if (search) {
          query = query.or(`subject.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) return apiErrorResponse(error);

        options = (data || []).map((r) => ({
          id: r.id,
          label: `RFI #${r.number} — ${r.subject}`,
          number: String(r.number),
          status: r.status,
        }));
        break;
      }

      case "meetings": {
        let query = supabase
          .from("document_metadata")
          .select("id, title, date, status")
          .eq("project_id", parsedProjectId)
          .eq("type", "meeting")
          .order("date", { ascending: false })
          .limit(100);

        if (search) {
          query = query.ilike("title", `%${search}%`);
        }

        const { data, error } = await query;
        if (error) return apiErrorResponse(error);

        options = (data || []).map((m) => {
          const safeTitle = m.title ?? "Untitled";
          return {
            id: String(m.id),
            label: m.date ? `${safeTitle} (${m.date})` : safeTitle,
            number: null,
            status: m.status ?? null,
          };
        });
        break;
      }

      case "emails": {
        let query = supabase
          .from("project_emails")
          .select("id, subject, from_name, status, created_at")
          .eq("project_id", parsedProjectId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(100);

        if (search) {
          query = query.or(`subject.ilike.%${search}%,from_name.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) return apiErrorResponse(error);

        options = (data || []).map((e) => {
          const subject = e.subject ?? "(no subject)";
          return {
            id: String(e.id),
            label: e.from_name ? `${subject} (from ${e.from_name})` : subject,
            number: null,
            status: e.status ?? null,
          };
        });
        break;
      }
    }

    return NextResponse.json({ data: options });
    },
);
