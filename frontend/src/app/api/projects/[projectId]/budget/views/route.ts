import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import type { CreateBudgetViewRequest } from "@/types/budget-views";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import { logger } from "@/lib/logger";

// GET /api/projects/[id]/budget/views
// Fetch all budget views for a project
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/views#GET",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId } = await params;

    // Check authentication
    const user = await getApiRouteUser();
    const authError = null as Error | null;

    if (authError) {
      return NextResponse.json(
        { error: "Authentication failed", details: authError.message },
        { status: 401 },
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 },
      );
    }
    // Validate project ID
    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID", details: `Project ID must be a number, got: ${projectId}` },
        { status: 400 },
      );
    }

    // Permission check: reading budget views requires "read" on budget
    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    // Fetch views with their columns
    const { data: views, error: viewsError } = await supabase
      .from("budget_views")
      .select(
        `
        *,
        columns:budget_view_columns(*)
      `,
      )
      .eq("project_id", projectIdNum)
      .order("created_at", { ascending: true });

    if (viewsError) {
      logger.error({ msg: "Budget views fetch error:", data: {
        error: viewsError,
        projectId: projectIdNum,
        userId: user.id
      } });
      return NextResponse.json(
        {
          error: "Failed to fetch budget views",
          details: viewsError.message,
          code: viewsError.code,
          hint: viewsError.hint
        },
        { status: 500 },
      );
    }

    // Sort columns by display_order
    const viewsWithSortedColumns = views?.map((view) => ({
      ...view,
      columns:
        view.columns?.sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order) || [],
    }));

    return NextResponse.json({ views: viewsWithSortedColumns });
    },
);

// POST /api/projects/[id]/budget/views
// Create a new budget view
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/views#POST",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId } = await params;
    const body: CreateBudgetViewRequest = await request.json();

    const { name, description, is_default = false, columns } = body;

    // Validate required fields
    if (!name || !columns || columns.length === 0) {
      return NextResponse.json(
        { error: "Name and columns are required" },
        { status: 400 },
      );
    }

    // Get current user
    const user = await getApiRouteUser();
    const userError = null as Error | null;
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", details: userError?.message },
        { status: 401 },
      );
    }

    // Validate project ID
    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID", details: `Project ID must be a number, got: ${projectId}` },
        { status: 400 },
      );
    }

    // Permission check: managing budget views requires "write" on budget
    const guard = await requirePermission(projectIdNum, "budget", "write");
    if (guard.denied) return guard.response;

    // Create the view
    const { data: view, error: viewError } = await supabase
      .from("budget_views")
      .insert({
        project_id: projectIdNum,
        name,
        description: description || null,
        is_default,
        is_system: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (viewError) {
      logger.error({ msg: "Budget view creation error:", data: {
        error: viewError,
        projectId: projectIdNum,
        userId: user.id,
        viewName: name
      } });
      return NextResponse.json(
        {
          error: "Failed to create budget view",
          details: viewError.message,
          code: viewError.code,
          hint: viewError.hint
        },
        { status: 500 },
      );
    }

    // Create the columns
    const columnsToInsert = columns.map((col) => ({
      view_id: view.id,
      column_key: col.column_key,
      display_name: col.display_name || null,
      display_order: col.display_order,
      width: col.width || null,
      is_visible: col.is_visible !== undefined ? col.is_visible : true,
      is_locked: col.is_locked !== undefined ? col.is_locked : false,
    }));

    const { data: createdColumns, error: columnsError } = await supabase
      .from("budget_view_columns")
      .insert(columnsToInsert)
      .select();

    if (columnsError) {
      logger.error({ msg: "Budget view columns creation error:", data: {
        error: columnsError,
        viewId: view.id,
        columns: columnsToInsert
      } });
      // Rollback: delete the view
      await supabase.from("budget_views").delete().eq("id", view.id);
      return NextResponse.json(
        {
          error: "Failed to create budget view columns",
          details: columnsError.message,
          code: columnsError.code,
          hint: columnsError.hint
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        view: {
          ...view,
          columns: createdColumns.sort(
            (a, b) => a.display_order - b.display_order,
          ),
        },
      },
      { status: 201 },
    );
    },
);
