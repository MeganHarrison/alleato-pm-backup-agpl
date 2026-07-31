import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { PermissionService } from "@/services/permissionService";
import { DirectoryPreferencesService } from "@/services/directoryPreferencesService";
import type { DirectoryFilters } from "@/components/directory/DirectoryFilters";
import type { ColumnConfig } from "@/components/directory/ColumnManager";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/directory/preferences#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/preferences#GET", message: "Authentication required." });
    }

    const permissionService = new PermissionService(supabase);
    await permissionService.requirePermission(
      user.id,
      projectId,
      "directory",
      "read",
    );

    const prefService = new DirectoryPreferencesService(supabase);
    const [lastFilters, columnPreferences] = await Promise.all([
      prefService.getLastFilters(user.id, projectId),
      prefService.getColumnPreferences(user.id, projectId),
    ]);

    return NextResponse.json({ data: { lastFilters, columnPreferences } });
    },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/directory/preferences#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/preferences#POST", message: "Authentication required." });
    }

    const permissionService = new PermissionService(supabase);
    await permissionService.requirePermission(
      user.id,
      projectId,
      "directory",
      "read",
    );

    const body = (await request.json()) as {
      lastFilters?: DirectoryFilters;
      columnPreferences?: ColumnConfig[];
    };

    const prefService = new DirectoryPreferencesService(supabase);
    if (body.lastFilters) {
      await prefService.saveLastFilters(user.id, projectId, body.lastFilters);
    }
    if (body.columnPreferences) {
      await prefService.saveColumnPreferences(
        user.id,
        projectId,
        body.columnPreferences,
      );
    }

    return NextResponse.json({ success: true });
    },
);
