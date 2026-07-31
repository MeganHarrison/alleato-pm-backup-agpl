import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { PermissionService } from "@/services/permissionService";

interface RouteParams {
  params: Promise<{ projectId: string; personId: string }>;
}

interface ScheduleNotificationPreferences {
  all_project_tasks_weekly: boolean;
  resource_tasks_assigned_to_id: string | null;
  upon_schedule_changes: boolean;
  upon_schedule_change_requests: boolean;
  project_schedule_lookahead_weekly: boolean;
}

/**
 * Get schedule notification preferences for a user in a project.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/directory/people/[personId]/schedule-notifications#GET",
  async ({ request, params }) => {
  
    const { projectId, personId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people/[personId]/schedule-notifications#GET", message: "Authentication required." });
    }

    // Check permissions
    const permissionService = new PermissionService(supabase);
    const hasPermission = await permissionService.hasPermission(
      user.id,
      projectId,
      "directory",
      "read",
    );

    if (!hasPermission) {
      return NextResponse.json(
        {
          error: "insufficient_permissions",
          message: "You do not have permission to view user notifications.",
          code: "PERMISSION_DENIED",
        },
        { status: 403 },
      );
    }

    const projectIdNum = Number.parseInt(projectId, 10);

    // Get schedule notification preferences
    const { data, error } = await supabase
      .from("user_schedule_notifications")
      .select("*")
      .eq("project_id", projectIdNum)
      .eq("person_id", personId)
      .maybeSingle();

    if (error) throw error;

    // If no record exists, return default preferences
    const preferences: ScheduleNotificationPreferences = data
      ? {
          all_project_tasks_weekly: data.all_project_tasks_weekly ?? false,
          resource_tasks_assigned_to_id:
            data.resource_tasks_assigned_to_id || null,
          upon_schedule_changes: data.upon_schedule_changes ?? false,
          upon_schedule_change_requests:
            data.upon_schedule_change_requests ?? false,
          project_schedule_lookahead_weekly:
            data.project_schedule_lookahead_weekly ?? false,
        }
      : {
          all_project_tasks_weekly: false,
          resource_tasks_assigned_to_id: null,
          upon_schedule_changes: false,
          upon_schedule_change_requests: false,
          project_schedule_lookahead_weekly: false,
        };

    return NextResponse.json({
      user_id: personId,
      preferences,
      updated_at: data?.updated_at || null,
    });
    },
);

/**
 * Update schedule notification preferences for a user in a project.
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/directory/people/[personId]/schedule-notifications#PATCH",
  async ({ request, params }) => {
  
    const { projectId, personId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people/[personId]/schedule-notifications#PATCH", message: "Authentication required." });
    }

    // Check permissions - users can update their own notifications
    // or admins can update anyone's
    const permissionService = new PermissionService(supabase);

    // Check if user is updating their own notifications
    const { data: personData } = await supabase
      .from("users_auth")
      .select("person_id")
      .eq("auth_user_id", user.id)
      .single();

    const isOwnNotifications = personData?.person_id === personId;

    if (!isOwnNotifications) {
      const hasAdminPermission = await permissionService.hasPermission(
        user.id,
        projectId,
        "directory",
        "admin",
      );

      if (!hasAdminPermission) {
        return NextResponse.json(
          {
            error: "insufficient_permissions",
            message:
              "You do not have permission to update this user's notifications.",
            code: "PERMISSION_DENIED",
          },
          { status: 403 },
        );
      }
    }

    // Parse request body
    const body = await request.json();
    const { preferences } = body;

    if (!preferences || typeof preferences !== "object") {
      return NextResponse.json(
        {
          error: "invalid_request",
          message: "Preferences object is required",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const projectIdNum = Number.parseInt(projectId, 10);

    // Upsert schedule notification preferences
    const { data, error } = await supabase
      .from("user_schedule_notifications")
      .upsert(
        {
          person_id: personId,
          project_id: projectIdNum,
          ...preferences,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "person_id,project_id",
        },
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      user_id: personId,
      preferences: {
        all_project_tasks_weekly: data.all_project_tasks_weekly,
        resource_tasks_assigned_to_id: data.resource_tasks_assigned_to_id,
        upon_schedule_changes: data.upon_schedule_changes,
        upon_schedule_change_requests: data.upon_schedule_change_requests,
        project_schedule_lookahead_weekly:
          data.project_schedule_lookahead_weekly,
      },
      updated_at: data.updated_at,
    });
    },
);
