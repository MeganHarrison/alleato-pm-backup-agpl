import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * GET /api/projects/[projectId]/prime-contract-change-orders/export
 * Export PCCOs as CSV
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/export#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/prime-contract-change-orders/export#GET",
        message: "Authentication required.",
      });
    }
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");

    let query = supabase
      .from("prime_contract_change_orders")
      .select("*")
      .eq("project_id", Number(projectId))
      .order("pcco_number");

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    const rows = data || [];
    const headers = [
      "PCCO Number",
      "Title",
      "Status",
      "Amount",
      "Executed",
      "Submitted",
      "Approved",
      "Created",
    ];

    const csvRows = rows.map((co) => [
      co.pcco_number || "",
      `"${(co.title || "").replace(/"/g, '""')}"`,
      co.status || "",
      co.total_amount ?? 0,
      co.executed ? "Yes" : "No",
      co.submitted_at ? new Date(co.submitted_at).toLocaleDateString() : "",
      co.approved_at ? new Date(co.approved_at).toLocaleDateString() : "",
      co.created_at ? new Date(co.created_at).toLocaleDateString() : "",
    ]);

    const csv = [headers.join(","), ...csvRows.map((r) => r.join(","))].join(
      "\n",
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="prime-contract-change-orders.csv"`,
      },
    });
    },
);
