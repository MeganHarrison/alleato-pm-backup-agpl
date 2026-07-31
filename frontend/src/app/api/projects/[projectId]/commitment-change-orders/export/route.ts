import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * GET /api/projects/[projectId]/commitment-change-orders/export
 * Export CCOs as CSV
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders/export#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/commitment-change-orders/export#GET",
        message: "Authentication required.",
      });
    }
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");

    // Two-step query: get commitment IDs for this project, then fetch their COs
    const { data: commitments, error: commitmentsError } = await supabase
      .from("commitments_unified")
      .select("id")
      .eq("project_id", Number(projectId))
      .is("deleted_at", null);

    if (commitmentsError) {
      return apiErrorResponse(commitmentsError);
    }

    const commitmentIds = (commitments ?? []).map((c) => c.id).filter(Boolean) as string[];

    if (commitmentIds.length === 0) {
      const csv = ["CO Number,Description,Status,Amount,Requested Date,Approved Date,Created"].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="commitment-change-orders.csv"`,
        },
      });
    }

    let query = supabase
      .from("contract_change_orders")
      .select("*")
      .in("contract_id", commitmentIds)
      .order("change_order_number");

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    const rows = data || [];
    const headers = [
      "CO Number",
      "Description",
      "Status",
      "Amount",
      "Requested Date",
      "Approved Date",
      "Created",
    ];

    const csvRows = rows.map((co) => [
      co.change_order_number || "",
      `"${(co.description || "").replace(/"/g, '""')}"`,
      co.status || "",
      co.amount ?? 0,
      co.requested_date || "",
      co.approved_date || "",
      co.created_at ? new Date(co.created_at).toLocaleDateString() : "",
    ]);

    const csv = [headers.join(","), ...csvRows.map((r) => r.join(","))].join(
      "\n",
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="commitment-change-orders.csv"`,
      },
    });
    },
);
