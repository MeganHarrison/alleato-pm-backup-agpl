import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

interface HistoryParams {
  params: Promise<{
    projectId: string;
  }>;
}

/**
 * GET /api/projects/[id]/budget/history
 *
 * Fetches budget change history (audit trail)
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/budget/history#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/budget/history#GET", message: "Authentication required." });
    }

    // Fetch change history (no FK from changed_by → auth.users, so join separately)
    const { data: changes, error: changesError } = await supabase
      .from("budget_line_history")
      .select(
        `
        id,
        budget_line_id,
        field_name,
        old_value,
        new_value,
        change_type,
        changed_at,
        changed_by,
        budget_lines (
          cost_code_id,
          description,
          cost_codes (
            id,
            title
          )
        )
      `,
      )
      .eq("project_id", projectIdNum)
      .order("changed_at", { ascending: false })
      .limit(100);

    if (changesError) {
      return NextResponse.json(
        { error: "Failed to fetch change history" },
        { status: 500 },
      );
    }

    // Look up user emails from user_profiles for the unique changed_by UUIDs
    const changedByIds = [...new Set((changes || []).map((c) => c.changed_by).filter(Boolean))];
    const userEmailMap: Record<string, string> = {};
    if (changedByIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, email, full_name")
        .in("id", changedByIds as string[]);
      for (const p of profiles ?? []) {
        userEmailMap[p.id] = p.full_name || p.email || p.id;
      }
    }

    // Format changes for display
    const formattedChanges = (changes || []).map((change) => {
      const budgetLine = change.budget_lines as unknown as {
        cost_codes: { id: string; title: string | null } | null;
        description: string;
      } | null;

      return {
        id: change.id,
        timestamp: change.changed_at,
        user: (change.changed_by ? userEmailMap[change.changed_by] : null) ?? "Unknown User",
        action: change.change_type,
        field: change.field_name,
        oldValue: change.old_value,
        newValue: change.new_value,
        costCode: budgetLine?.cost_codes
          ? `${budgetLine.cost_codes.id} - ${budgetLine.cost_codes.title ?? ""}`
          : null,
        description: budgetLine?.description || null,
      };
    });

    // Calculate statistics
    const now = new Date();
    const thisMonth = formattedChanges.filter((change) => {
      const changeDate = new Date(change.timestamp);
      return (
        changeDate.getMonth() === now.getMonth() &&
        changeDate.getFullYear() === now.getFullYear()
      );
    });

    const uniqueUsers = new Set(formattedChanges.map((c) => c.user));
    const lastChange =
      formattedChanges.length > 0 ? formattedChanges[0].timestamp : null;

    return NextResponse.json({
      changes: formattedChanges,
      statistics: {
        totalChanges: formattedChanges.length,
        changesThisMonth: thisMonth.length,
        activeUsers: uniqueUsers.size,
        lastChange,
      },
    });
    },
);
