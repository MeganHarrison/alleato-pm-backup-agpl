import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { PermissionService } from "@/services/permissionService";

interface RouteParams {
  params: Promise<{ projectId: string; personId: string }>;
}

interface EmailNotificationPreferences {
  emails_default: boolean;
  rfis_default: boolean;
  submittals_default: boolean;
  punchlist_items_default: boolean;
  weather_delay_email: boolean;
  weather_delay_phone: boolean;
  daily_log_default: boolean;
  delay_log_default: boolean;
}

/**
 * Get email notification preferences for a user in a project.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/directory/people/[personId]/email-notifications#GET",
  async ({ request, params }) => {
  
    const { projectId, personId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people/[personId]/email-notifications#GET", message: "Authentication required." });
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

    // Get email notification preferences
    const { data, error } = await supabase
      .from("user_email_notifications")
      .select("*")
      .eq("project_id", projectIdNum)
      .eq("person_id", personId)
      .maybeSingle();

    if (error) throw error;

    // If no record exists, return default preferences
    const preferences: EmailNotificationPreferences = data
      ? {
          emails_default: data.emails_default ?? false,
          rfis_default: data.rfis_default ?? false,
          submittals_default: data.submittals_default ?? false,
          punchlist_items_default: data.punchlist_items_default ?? false,
          weather_delay_email: data.weather_delay_email ?? false,
          weather_delay_phone: data.weather_delay_phone ?? false,
          daily_log_default: data.daily_log_default ?? false,
          delay_log_default: data.delay_log_default ?? false,
        }
      : {
          emails_default: false,
          rfis_default: false,
          submittals_default: false,
          punchlist_items_default: false,
          weather_delay_email: false,
          weather_delay_phone: false,
          daily_log_default: false,
          delay_log_default: false,
        };

    return NextResponse.json({
      user_id: personId,
      preferences,
      updated_at: data?.updated_at || null,
    });
    },
);

/**
 * Update email notification preferences for a user in a project.
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/directory/people/[personId]/email-notifications#PATCH",
  async ({ request, params }) => {
  
    const { projectId, personId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people/[personId]/email-notifications#PATCH", message: "Authentication required." });
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

    // Upsert email notification preferences
    const { data, error } = await supabase
      .from("user_email_notifications")
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
        emails_default: data.emails_default,
        rfis_default: data.rfis_default,
        submittals_default: data.submittals_default,
        punchlist_items_default: data.punchlist_items_default,
        weather_delay_email: data.weather_delay_email,
        weather_delay_phone: data.weather_delay_phone,
        daily_log_default: data.daily_log_default,
        delay_log_default: data.delay_log_default,
      },
      updated_at: data.updated_at,
    });
    },
);
