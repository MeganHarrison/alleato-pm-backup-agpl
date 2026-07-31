import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import type { UpdateBudgetViewRequest } from "@/types/budget-views";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import { logger } from "@/lib/logger";

// GET /api/projects/[id]/budget/views/[viewId]
// Fetch a single budget view
export const GET = withApiGuardrails<{ projectId: string; viewId: string }>(
  "projects/[projectId]/budget/views/[viewId]#GET",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/budget/views/[viewId]#GET", message: "Authentication required." });
    }
    const { projectId, viewId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(viewId)) {
      return NextResponse.json({ error: "Invalid view ID" }, { status: 404 });
    }

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const { data: view, error } = await supabase
      .from("budget_views")
      .select(
        `
        *,
        columns:budget_view_columns(*)
      `,
      )
      .eq("id", viewId)
      .eq("project_id", projectIdNum)
      .single();

    if (error) {
      logger.error({ msg: "Budget view fetch error:", data: {
        error,
        viewId,
        userId: user.id
      } });

      // Handle specific error cases
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Budget view not found" },
          { status: 404 },
        );
      }

      return apiErrorResponse(error);
    }

    if (!view) {
      return NextResponse.json(
        { error: "Budget view not found" },
        { status: 404 },
      );
    }

    // Sort columns by display_order
    const viewWithSortedColumns = {
      ...view,
      columns:
        view.columns?.sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order) || [],
    };

    return NextResponse.json({ view: viewWithSortedColumns });
    },
);

// PATCH /api/projects/[id]/budget/views/[viewId]
// Update a budget view
export const PATCH = withApiGuardrails<{ projectId: string; viewId: string }>(
  "projects/[projectId]/budget/views/[viewId]#PATCH",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/budget/views/[viewId]#PATCH", message: "Authentication required." });
    }
    const { projectId, viewId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const guard = await requirePermission(projectIdNum, "budget", "write");
    if (guard.denied) return guard.response;
    const body: UpdateBudgetViewRequest = await request.json();

    // Check if view is a system view
    const { data: existingView, error: fetchError } = await supabase
      .from("budget_views")
      .select("is_system")
      .eq("id", viewId)
      .eq("project_id", projectIdNum)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch budget view", details: fetchError.message },
        { status: 500 },
      );
    }

    if (!existingView) {
      return NextResponse.json(
        { error: "Budget view not found" },
        { status: 404 },
      );
    }

    if (existingView.is_system) {
      return NextResponse.json(
        { error: "Cannot modify system views" },
        { status: 403 },
      );
    }

    const { name, description, is_default, columns } = body;

    // Update the view metadata
    if (name || description !== undefined || is_default !== undefined) {
      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (is_default !== undefined) updateData.is_default = is_default;

      const { error: updateError } = await supabase
        .from("budget_views")
        .update(updateData)
        .eq("id", viewId)
        .eq("project_id", projectIdNum);

      if (updateError) {
        return NextResponse.json(
          {
            error: "Failed to update budget view",
            details: updateError.message,
          },
          { status: 500 },
        );
      }
    }

    // Update columns if provided
    if (columns && columns.length > 0) {
      // Delete existing columns
      const { error: deleteError } = await supabase
        .from("budget_view_columns")
        .delete()
        .eq("view_id", viewId);

      if (deleteError) {
        return NextResponse.json(
          {
            error: "Failed to update budget view columns",
            details: deleteError.message,
          },
          { status: 500 },
        );
      }

      // Insert new columns
      const columnsToInsert = columns.map((col) => ({
        view_id: viewId,
        column_key: col.column_key,
        display_name: col.display_name || null,
        display_order: col.display_order,
        width: col.width || null,
        is_visible: col.is_visible !== undefined ? col.is_visible : true,
        is_locked: col.is_locked !== undefined ? col.is_locked : false,
      }));

      const { error: insertError } = await supabase
        .from("budget_view_columns")
        .insert(columnsToInsert);

      if (insertError) {
        return NextResponse.json(
          {
            error: "Failed to update budget view columns",
            details: insertError.message,
          },
          { status: 500 },
        );
      }
    }

    // Fetch the updated view
    const { data: updatedView, error: fetchUpdatedError } = await supabase
      .from("budget_views")
      .select(
        `
        *,
        columns:budget_view_columns(*)
      `,
      )
      .eq("id", viewId)
      .eq("project_id", projectIdNum)
      .single();

    if (fetchUpdatedError) {
      return NextResponse.json(
        {
          error: "Failed to fetch updated budget view",
          details: fetchUpdatedError.message,
        },
        { status: 500 },
      );
    }

    // Sort columns by display_order
    const viewWithSortedColumns = {
      ...updatedView,
      columns:
        updatedView.columns?.sort(
          (a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order,
        ) || [],
    };

    return NextResponse.json({ view: viewWithSortedColumns });
    },
);

// DELETE /api/projects/[id]/budget/views/[viewId]
// Delete a budget view
export const DELETE = withApiGuardrails<{ projectId: string; viewId: string }>(
  "projects/[projectId]/budget/views/[viewId]#DELETE",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/budget/views/[viewId]#DELETE", message: "Authentication required." });
    }
    const { projectId, viewId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const guard = await requirePermission(projectIdNum, "budget", "admin");
    if (guard.denied) return guard.response;

    // Check if view is a system view
    const { data: existingView, error: fetchError } = await supabase
      .from("budget_views")
      .select("is_system, is_default")
      .eq("id", viewId)
      .eq("project_id", projectIdNum)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch budget view", details: fetchError.message },
        { status: 500 },
      );
    }

    if (!existingView) {
      return NextResponse.json(
        { error: "Budget view not found" },
        { status: 404 },
      );
    }

    if (existingView.is_system) {
      return NextResponse.json(
        { error: "Cannot delete system views" },
        { status: 403 },
      );
    }

    // Delete the view (cascade will delete columns)
    const { error: deleteError } = await supabase
      .from("budget_views")
      .delete()
      .eq("id", viewId)
      .eq("project_id", projectIdNum);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete budget view", details: deleteError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
    },
);
