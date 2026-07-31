import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient } from "@/lib/supabase/server";

// Compatibility-only reader for the active prime-invoice detail surface. New
// consumers must use /invoicing/billing-periods; writes are intentionally gone.
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/billing-periods#GET",
  async ({ params }) => {
    const projectIdNum = Number.parseInt(params.projectId, 10);
    if (!Number.isFinite(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID." },
        { status: 400 },
      );
    }

    const guard = await requirePermission(projectIdNum, "contracts", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("billing_periods")
      .select("*")
      .eq("project_id", projectIdNum)
      .order("start_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load billing periods.", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { items: data ?? [], total: data?.length ?? 0 },
      {
        headers: {
          Deprecation: "true",
          Link: `</api/projects/${projectIdNum}/invoicing/billing-periods>; rel=successor-version`,
        },
      },
    );
  },
);

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/billing-periods#POST",
  async ({ params }) =>
    NextResponse.json(
      {
        error: "This billing-period write path has been retired.",
        recovery: `/api/projects/${params.projectId}/invoicing/billing-periods`,
      },
      { status: 410 },
    ),
);
