import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { PermissionService } from "@/services/permissionService";
import {
  DirectoryAdminService,
  type DirectoryExportColumn,
} from "@/services/directoryAdminService";
import type { DirectoryFilters } from "@/services/directoryService";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const DEFAULT_COLUMNS: DirectoryExportColumn[] = [
  { id: "name", label: "Name" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "job_title", label: "Job Title" },
  { id: "company", label: "Company" },
  { id: "permission_template", label: "Permission" },
  { id: "invite_status", label: "Invite Status" },
  { id: "status", label: "Status" },
];

function parseFilters(searchParams: URLSearchParams): DirectoryFilters {
  return {
    search: searchParams.get("search") || undefined,
    type: searchParams.get("type") as "user" | "contact" | "all" | undefined,
    status: searchParams.get("status") as
      | "active"
      | "inactive"
      | "all"
      | undefined,
    companyId: searchParams.get("company_id") || undefined,
    permissionTemplateId:
      searchParams.get("permission_template_id") || undefined,
    groupBy: (searchParams.get("group_by") as "company" | "none") || "none",
    sortBy: searchParams.get("sort")?.split(",") || undefined,
  };
}

function parseColumns(queryValue: string | null): DirectoryExportColumn[] {
  if (!queryValue) {
    return DEFAULT_COLUMNS;
  }

  try {
    const parsed = JSON.parse(queryValue);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          id: item.id,
          label: item.label || item.id,
        }))
        .filter((item) => item.id);
    }
    return DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

export const GET = withApiGuardrails(
  "projects/[projectId]/directory/export#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;
    const serviceSupabase = authResult.serviceClient;

    // Still need regular auth client for permission check
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/export#GET", message: "Authentication required." });
    }

    const permissionService = new PermissionService(supabase);
    await permissionService.requirePermission(
      user.id,
      projectId,
      "directory",
      "read",
    );

    const searchParams = request.nextUrl.searchParams;
    const filters = parseFilters(searchParams);
    const columns = parseColumns(searchParams.get("columns"));

    const adminService = new DirectoryAdminService(serviceSupabase);
    const stream = adminService.createExportStream(projectId, filters, columns);

    const filename = `directory-export-${projectId}-${Date.now()}.csv`;

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/csv",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
    },
);
