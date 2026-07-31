import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import type { CloneBudgetViewRequest } from "@/types/budget-views";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

// POST /api/projects/[id]/budget/views/[viewId]/clone
// Clone an existing budget view
export const POST = withApiGuardrails<{ projectId: string; viewId: string }>(
  "projects/[projectId]/budget/views/[viewId]/clone#POST",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/budget/views/[viewId]/clone#POST", message: "Authentication required." });
    }
    const { projectId, viewId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(viewId)) {
      return NextResponse.json({ error: "Invalid view ID" }, { status: 404 });
    }

    const guard = await requirePermission(projectIdNum, "budget", "write");
    if (guard.denied) return guard.response;
    const body: CloneBudgetViewRequest = await request.json();

    const { new_name, new_description } = body;

    // Validate required fields
    if (!new_name) {
      return NextResponse.json(
        { error: "New name is required" },
        { status: 400 },
      );
    }

    // Ensure source view belongs to this project.
    const { data: sourceView, error: sourceViewError } = await supabase
      .from("budget_views")
      .select("id")
      .eq("id", viewId)
      .eq("project_id", projectIdNum)
      .single();

    if (sourceViewError || !sourceView) {
      return NextResponse.json({ error: "Budget view not found" }, { status: 404 });
    }

    // Call the database function to clone the view
    const { data, error } = await supabase.rpc("clone_budget_view", {
      source_view_id: viewId,
      new_name,
      new_description: new_description ?? undefined,
    });

    if (error) {
      return apiErrorResponse(error);
    }

    // Fetch the cloned view
    const { data: clonedView, error: fetchError } = await supabase
      .from("budget_views")
      .select(
        `
        *,
        columns:budget_view_columns(*)
      `,
      )
      .eq("id", data)
      .eq("project_id", projectIdNum)
      .single();

    if (fetchError) {
      return NextResponse.json(
        {
          error: "Failed to fetch cloned budget view",
          details: fetchError.message,
        },
        { status: 500 },
      );
    }

    // Sort columns by display_order
    const viewWithSortedColumns = {
      ...clonedView,
      columns:
        clonedView.columns?.sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order) ||
        [],
    };

    return NextResponse.json({ view: viewWithSortedColumns }, { status: 201 });
    },
);
