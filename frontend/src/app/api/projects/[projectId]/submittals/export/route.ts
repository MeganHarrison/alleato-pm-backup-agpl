import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * GET /api/projects/[projectId]/submittals/export?format=csv
 * Server-side fallback: returns CSV of all non-deleted submittals for the project.
 * The primary export path is client-side (handled in the page component).
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/submittals/export#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/export#GET",
        message: "Authentication required.",
      });
    }
    const format = new URL(request.url).searchParams.get("format") ?? "csv";

    const { data, error } = await supabase
      .from("submittals")
      .select(
        `id, submittal_number, revision, title, status, specification_section,
         division, ball_in_court, is_private, final_due_date, sent_date, created_at,
         submittal_type:submittal_types(name),
         submittal_package:submittal_packages(name)`,
      )
      .eq("project_id", parseInt(projectId, 10))
      .is("deleted_at", null)
      .order("submittal_number");

    if (error) return apiErrorResponse(error);

    if (format !== "csv") {
      return NextResponse.json(data ?? []);
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;

    const headers = [
      "Number",
      "Title",
      "Revision",
      "Status",
      "Spec Section",
      "Division",
      "Type",
      "Package",
      "Ball In Court",
      "Final Due Date",
      "Sent Date",
      "Created At",
    ];

    function cell(v: unknown): string {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""').replace(/\n/g, " ");
      return s.includes(",") || s.includes('"') ? `"${s}"` : s;
    }

    const csvRows = rows.map((r) => {
      const typeName =
        r.submittal_type && typeof r.submittal_type === "object"
          ? (r.submittal_type as { name?: string }).name ?? ""
          : "";
      const pkgName =
        r.submittal_package && typeof r.submittal_package === "object"
          ? (r.submittal_package as { name?: string }).name ?? ""
          : "";
      return [
        cell(r.submittal_number),
        cell(r.title),
        cell(r.revision),
        cell(r.status),
        cell(r.specification_section),
        cell(r.division),
        cell(typeName),
        cell(pkgName),
        cell(r.ball_in_court),
        cell(r.final_due_date),
        cell(r.sent_date),
        cell(r.created_at),
      ].join(",");
    });

    const csv = [headers.join(","), ...csvRows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="submittals-${projectId}.csv"`,
      },
    });
    },
);
