import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { GuardrailError } from "@/lib/guardrails/errors";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { isOwnerEmail } from "@/lib/auth/owner";
import { buildRequestProjectCreationAttribution } from "@/lib/projects/creation-attribution";

function normalizeOptionalDate(value: unknown): string | null | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value.trim() === "" ? null : value;
  }
  return String(value);
}

const CreateProjectSchema = z
  .object({
    name: z.string().min(1, "Project name is required"),
  })
  .passthrough();

type ProjectApiRow = Record<string, unknown> & {
  id: number;
  company_id?: string | null;
};

type PrimeContractClientRow = {
  project_id: number;
  client_id: string | null;
  contract_company_id: string | null;
};

type CompanyNameRow = {
  id: string;
  name: string | null;
};

type UserAuthLinkRow = {
  person_id: string | null;
};

type UserProfileRow = {
  is_admin: boolean | null;
};

type ProjectDirectoryMembershipRow = {
  project_id: number | null;
};

type ProjectRoleMembershipRow = {
  project_role: { project_id: number | null } | null;
};

const PROJECT_FIELD_MAP: Record<string, string> = {
  id: "id",
  name: "name",
  project_number: "project_number",
  projectNumber: "project_number",
  "job number": "\"job number\"",
  job_number: "\"job number\"",
  jobNumber: "\"job number\"",
  phase: "phase",
  state: "state",
  archived: "archived",
  company_id: "company_id",
  companyId: "company_id",
  created_at: "created_at",
  createdAt: "created_at",
};

function getProjectSelect(fieldsParam: string | null, includeClientResolution: boolean): string {
  if (!fieldsParam) return "*";

  const selectedFields = fieldsParam
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean)
    .map((field) => PROJECT_FIELD_MAP[field])
    .filter((field): field is string => Boolean(field));

  if (selectedFields.length === 0) return "*";

  const requiredFields = includeClientResolution ? ["id", "company_id"] : ["id"];
  return Array.from(new Set([...requiredFields, ...selectedFields])).join(",");
}

function cleanClientName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^E2E-/i.test(trimmed)) return null;
  return trimmed;
}

function uniqueFiniteProjectIds(values: Array<number | null | undefined>): number[] {
  return Array.from(
    new Set(
      values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    ),
  );
}

async function resolveVisibleProjectIdsForUser(
  supabase: ReturnType<typeof createServiceClient>,
  user: { id: string; email?: string | null },
): Promise<{ isAdmin: boolean; isOwner: boolean; allowedProjectIds: number[] | null }> {
  const userId = user.id;

  const { data: authLink, error: authLinkError } = await supabase
    .from("users_auth")
    .select("person_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (authLinkError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/projects#GET",
      message: "Failed to resolve project access identity.",
      details: { reason: authLinkError.message },
      cause: authLinkError,
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/projects#GET",
      message: "Failed to resolve project access profile.",
      details: { reason: profileError.message },
      cause: profileError,
    });
  }

  const isAdmin = (profile as UserProfileRow | null)?.is_admin === true;

  // Project visibility is membership-scoped for EVERYONE — including admins.
  // Only the single workspace owner sees the entire portfolio. `is_admin`
  // grants elevated tool/permission access elsewhere, but it must NOT widen
  // which projects appear in the dashboard / portfolio list.
  const isOwner = isOwnerEmail(user.email);
  if (isOwner) {
    return { isAdmin, isOwner, allowedProjectIds: null };
  }

  const personId = (authLink as UserAuthLinkRow | null)?.person_id;
  if (!personId) {
    return { isAdmin, isOwner, allowedProjectIds: [] };
  }

  const { data: directoryMemberships, error: directoryMembershipsError } = await supabase
    .from("project_directory_memberships")
    .select("project_id")
    .eq("person_id", personId)
    .eq("status", "active");

  if (directoryMembershipsError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/projects#GET",
      message: "Failed to resolve project directory assignments.",
      details: { reason: directoryMembershipsError.message },
      cause: directoryMembershipsError,
    });
  }

  const { data: roleMemberships, error: roleMembershipsError } = await supabase
    .from("project_role_members")
    .select("project_role:project_roles!inner(project_id)")
    .eq("person_id", personId);

  if (roleMembershipsError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/projects#GET",
      message: "Failed to resolve project role assignments.",
      details: { reason: roleMembershipsError.message },
      cause: roleMembershipsError,
    });
  }

  const directoryProjectIds = ((directoryMemberships ?? []) as ProjectDirectoryMembershipRow[]).map(
    (membership) => membership.project_id,
  );
  const roleProjectIds = ((roleMemberships ?? []) as ProjectRoleMembershipRow[]).map(
    (membership) => membership.project_role?.project_id,
  );

  return {
    isAdmin,
    isOwner,
    allowedProjectIds: uniqueFiniteProjectIds([...directoryProjectIds, ...roleProjectIds]),
  };
}

/**
 * Resolves a display client name for each project from:
 * 1. projects.company_id → companies.name (canonical)
 * 2. Fallback: most recent prime_contracts.client_id or contract_company_id → companies.name
 *
 * Injects as `client` on the response object for backwards-compatible display.
 */
async function applyResolvedClientNames(
  supabase: ReturnType<typeof createServiceClient>,
  projects: ProjectApiRow[],
): Promise<ProjectApiRow[]> {
  const projectIds = projects.map((project) => project.id).filter(Number.isFinite);
  if (projectIds.length === 0) {
    return projects;
  }

  // Fallback: prime contract client lookup
  const { data: primeContracts, error: primeContractsError } = await supabase
    .from("prime_contracts")
    .select("project_id, client_id, contract_company_id, created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (primeContractsError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/projects#GET",
      message: "Failed to fetch prime contract clients.",
      details: { reason: primeContractsError.message },
      cause: primeContractsError,
    });
  }

  const primeClientByProjectId = new Map<number, string>();
  for (const contract of (primeContracts ?? []) as PrimeContractClientRow[]) {
    if (primeClientByProjectId.has(contract.project_id)) continue;
    const companyId = contract.client_id ?? contract.contract_company_id;
    if (companyId) {
      primeClientByProjectId.set(contract.project_id, companyId);
    }
  }

  const companyIds = Array.from(
    new Set(
      [
        ...projects.map((p) => p.company_id).filter((id): id is string => typeof id === "string" && id.trim().length > 0),
        ...primeClientByProjectId.values(),
      ],
    ),
  );

  if (companyIds.length === 0) {
    return projects.map((project) => ({ ...project, client: null }));
  }

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name")
    .in("id", companyIds);

  if (companiesError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/projects#GET",
      message: "Failed to fetch company names.",
      details: { reason: companiesError.message },
      cause: companiesError,
    });
  }

  const companyNameById = new Map(
    ((companies ?? []) as CompanyNameRow[]).map((company) => [company.id, cleanClientName(company.name)]),
  );

  return projects.map((project) => {
    const clientName =
      (project.company_id ? companyNameById.get(project.company_id) : null) ??
      (primeClientByProjectId.get(project.id)
        ? companyNameById.get(primeClientByProjectId.get(project.id) as string)
        : null);

    return clientName ? { ...project, client: clientName } : { ...project, client: null };
  });
}

export const GET = withApiGuardrails("/api/projects#GET", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/projects#GET",
      message: "Unauthorized projects request.",
      status: 401,
      severity: "medium",
    });
  }

  const supabase = createServiceClient();
  const { isAdmin, allowedProjectIds } = await resolveVisibleProjectIdsForUser(supabase, user);

  const { searchParams } = new URL(request.url);

  // Pagination params
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const offset = (page - 1) * limit;

  // Filter params
  const search = searchParams.get("search");
  const state = searchParams.get("state");
  const excludeState = searchParams.get("excludeState");
  const phase = searchParams.get("phase");
  const archived = searchParams.get("archived");
  const companyId = searchParams.get("companyId");
  const fields = searchParams.get("fields");
  const skipClientResolution = searchParams.get("includeClient") === "false";
  const projectSelect = getProjectSelect(fields, !skipClientResolution);

  if (allowedProjectIds !== null && allowedProjectIds.length === 0) {
    return NextResponse.json({
      data: [],
      meta: { page, limit, total: 0, totalPages: 0 },
    });
  }

  let query = supabase
    .from("projects")
    .select(projectSelect, { count: "exact" })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  // Filter to only projects the user has membership in (unless admin)
  if (allowedProjectIds !== null) {
    query = query.in("id", allowedProjectIds);
  }

  // Add state filter if provided (case-insensitive)
  if (state) {
    query = query.ilike("state", state);
  }

  // Exclude specific state if provided (case-insensitive)
  if (excludeState) {
    query = query.not("state", "ilike", excludeState);
  }

  // Add search filter if provided
  if (search) {
    query = query.or(`name.ilike.%${search}%,"job number".ilike.%${search}%`);
  }

  // Add phase filter if provided
  if (phase) {
    query = query.ilike("phase", phase);
  }

  // Add archived filter if provided
  if (archived !== null) {
    query = query.eq("archived", archived === "true");
  }

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/projects#GET",
      message: "Failed to fetch projects.",
      details: { reason: error.message },
      cause: error,
    });
  }

  const projects = (data as unknown as ProjectApiRow[]) ?? [];
  const responseProjects = skipClientResolution
    ? projects
    : await applyResolvedClientNames(supabase, projects);

  return NextResponse.json({
    data: responseProjects,
    meta: {
      page,
      limit,
      total: count,
      totalPages: count ? Math.ceil(count / limit) : 0,
      isAdmin,
    },
  });
});

export const POST = withApiGuardrails("/api/projects#POST", async ({ request, requestId }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/projects#POST",
      message: "Unauthorized project creation request.",
      status: 401,
      severity: "medium",
    });
  }
  const supabase = createServiceClient();
  const body = await parseJsonBody(request, CreateProjectSchema, "/api/projects#POST");
  const bodyRecord = body as Record<string, unknown>;

  // Resolve the creator before inserting the project so a project cannot be
  // created without an owner membership.
  const { data: authLink, error: authLinkError } = await supabase
    .from("users_auth")
    .select("person_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (authLinkError || !authLink?.person_id) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: "/api/projects#POST",
      message: "Project creator is not linked to a directory person.",
      status: 412,
      severity: "high",
      details: {
        reason: authLinkError?.message ?? "Missing users_auth.person_id",
        authUserId: user.id,
      },
      cause: authLinkError ?? undefined,
    });
  }

  const { data: adminTemplate, error: adminTemplateError } = await supabase
    .from("permission_templates")
    .select("id")
    .eq("is_system", true)
    .eq("name", "Project Admin")
    .maybeSingle();

  if (adminTemplateError || !adminTemplate?.id) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: "/api/projects#POST",
      message: "Project Admin permission template is required to create a project.",
      status: 412,
      severity: "high",
      details: {
        reason: adminTemplateError?.message ?? "Missing system admin permission template",
      },
      cause: adminTemplateError ?? undefined,
    });
  }

  // Set default phase to "Current" if not provided
  const projectData: Record<string, unknown> = {
    phase: "Current",
    ...bodyRecord,
    ...buildRequestProjectCreationAttribution({
      source: "web_app",
      actorUserId: user.id,
      requestId,
    }),
  };
  const normalizedStartDate = normalizeOptionalDate(bodyRecord["start date"]);
  if (typeof normalizedStartDate !== "undefined") {
    projectData["start date"] = normalizedStartDate;
  }
  const normalizedEstCompletion = normalizeOptionalDate(bodyRecord["est completion"]);
  if (typeof normalizedEstCompletion !== "undefined") {
    projectData["est completion"] = normalizedEstCompletion;
  }

  const { data, error } = await supabase
    .from("projects")
    .insert(projectData)
    .select()
    .single();

  if (error) {
    const attributionFailure =
      error.code === "23514" &&
      [
        "Project creation source is required",
        "Project creator is required for request-driven creation",
        "Project creation request ID is required",
        "Project creation run ID is required",
      ].some((message) => error.message.includes(message));

    throw new GuardrailError({
      code: attributionFailure ? "SCHEMA_MISMATCH" : "INTERNAL_ERROR",
      where: "/api/projects#POST",
      message: attributionFailure
        ? `Project creation attribution was rejected: ${error.message}`
        : "Failed to create project.",
      details: {
        reason: error.message,
        payloadKeys: Object.keys(projectData),
      },
      cause: error,
    });
  }

  // Auto-add the creator as a project member with admin permissions
  const { error: membershipError } = await supabase.from("project_directory_memberships").insert({
    person_id: authLink.person_id,
    project_id: data.id,
    user_type: "employee",
    status: "active",
    role: "Project Admin",
    permission_template_id: adminTemplate.id,
  });

  if (membershipError) {
    const { error: cleanupError } = await supabase
      .from("projects")
      .delete()
      .eq("id", data.id);

    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/projects#POST",
      message: "Project was not created because creator access could not be assigned.",
      status: 500,
      severity: "high",
      details: {
        projectId: data.id,
        membershipReason: membershipError.message,
        cleanupReason: cleanupError?.message ?? null,
      },
      cause: membershipError,
    });
  }

  return NextResponse.json(data, { status: 201 });
});
