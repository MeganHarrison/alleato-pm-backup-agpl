import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { PermissionService } from "@/services/permissionService";
import { DirectoryPreferencesService } from "@/services/directoryPreferencesService";
import type { DirectoryFilters } from "@/components/directory/DirectoryFilters";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/directory/filters#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/filters#GET", message: "Authentication required." });
    }

    const permissionService = new PermissionService(supabase);
    await permissionService.requirePermission(
      user.id,
      projectId,
      "directory",
      "read",
    );

    const prefService = new DirectoryPreferencesService(supabase);
    const filters = await prefService.listSavedFilters(user.id, projectId);

    return NextResponse.json({ data: filters });
    },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/directory/filters#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/filters#POST", message: "Authentication required." });
    }

    const permissionService = new PermissionService(supabase);
    await permissionService.requirePermission(
      user.id,
      projectId,
      "directory",
      "write",
    );

    const body = (await request.json()) as {
      id?: string;
      name: string;
      description?: string;
      filters: DirectoryFilters;
      search?: string;
    };

    if (!body?.name || !body?.filters) {
      return NextResponse.json(
        { error: "Filter name and filters payload are required" },
        { status: 400 },
      );
    }

    const prefService = new DirectoryPreferencesService(supabase);
    const savedFilter = await prefService.saveFilter(
      user.id,
      projectId,
      body,
    );

    return NextResponse.json({ data: savedFilter });
    },
);

export const DELETE = withApiGuardrails(
  "projects/[projectId]/directory/filters#DELETE",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/filters#DELETE", message: "Authentication required." });
    }

    const permissionService = new PermissionService(supabase);
    await permissionService.requirePermission(
      user.id,
      projectId,
      "directory",
      "write",
    );

    const filterId = request.nextUrl.searchParams.get("id");
    if (!filterId) {
      return NextResponse.json(
        { error: "Filter id is required" },
        { status: 400 },
      );
    }

    const prefService = new DirectoryPreferencesService(supabase);
    await prefService.deleteFilter(user.id, projectId, filterId);

    return NextResponse.json({ success: true });
    },
);
