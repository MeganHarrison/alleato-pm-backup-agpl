import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";

// GET /api/projects/[id]/budget/lines/[lineId]/history - Get change history for a budget line item
export const GET = withApiGuardrails<{ projectId: string; lineId: string }>(
  "projects/[projectId]/budget/lines/[lineId]/history#GET",
  async ({ request, params }) => {
  
    const { projectId, lineId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lineId)) {
      return NextResponse.json({ error: "Invalid line ID" }, { status: 404 });
    }

    // Permission check: reading budget line history requires "read" on budget
    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // Get current user
    const user = await getApiRouteUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - please log in" },
        { status: 401 },
      );
    }

    // TODO: Add project membership validation when project_team_members table exists
    // For now, all authenticated users can view history (will be restricted by RLS)

    // Fetch change history for this budget line
    const { data: historyData, error: historyError } = await supabase
      .from("budget_line_history")
      .select(
        `
        id,
        field_name,
        old_value,
        new_value,
        changed_by,
        changed_at,
        change_type,
        notes
      `,
      )
      .eq("budget_line_id", lineId)
      .eq("project_id", projectIdNum)
      .order("changed_at", { ascending: false });

    if (historyError) {
      return NextResponse.json(
        { error: "Failed to fetch change history" },
        { status: 500 },
      );
    }

    // Get unique user IDs from history (filter out nulls)
    const userIds = [
      ...new Set(
        historyData
          .map((h) => h.changed_by)
          .filter((id): id is string => id !== null),
      ),
    ];

    // Fetch user details for all users who made changes
    const { data: usersData, error: usersError } = await supabase
      .from("people")
      .select("id, email, first_name, last_name")
      .in("id", userIds);

    if (usersError) {
      // Don't fail the request - just return history without user details
    }

    // Create a map of user ID to user details
    const usersMap = new Map(
      (usersData || []).map((u) => [
        u.id,
        {
          id: u.id,
          email: u.email,
          name:
            u.first_name && u.last_name
              ? `${u.first_name} ${u.last_name}`
              : u.first_name || u.last_name || u.email,
        },
      ]),
    );

    // Transform history data to include user details
    const history = historyData.map((h) => ({
      id: h.id,
      field_name: h.field_name,
      old_value: h.old_value,
      new_value: h.new_value,
      changed_by: (h.changed_by ? usersMap.get(h.changed_by) : null) || {
        id: h.changed_by,
        email: "Unknown User",
        name: "Unknown User",
      },
      changed_at: h.changed_at,
      change_type: h.change_type,
      notes: h.notes,
    }));

    return NextResponse.json({ history });
    },
);
