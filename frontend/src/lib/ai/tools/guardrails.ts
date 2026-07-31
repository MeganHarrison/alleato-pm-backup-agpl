import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createServiceClient } from "@/lib/supabase/service";

export type ToolScope = {
  userId: string;
  personId: string | null;
  isAdmin: boolean;
  /**
   * True only for company leadership (user_profiles.is_leadership). Gates
   * leadership-restricted content (access_level='leadership', e.g. Annual
   * Review meetings). NOT implied by isAdmin.
   */
  isLeadership: boolean;
  allowedProjectIds: number[];
  allowedBusinessAreaIds: number[];
  allowedCompanyIds: string[];
  pinnedProjectId: number | null;
};

export type ToolGuardrails = {
  getScope: () => Promise<ToolScope>;
  getScopedProjectIds: (
    requestedProjectId?: number | null,
  ) => Promise<number[]>;
  getScopedBusinessAreaIds: () => Promise<number[]>;
  enforceProjectAccess: (
    projectId: number,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  enforceBusinessAreaAccess: (
    businessAreaId: number,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  applyPinnedProject: (
    requestedProjectId?: number | null,
  ) => Promise<number | null>;
};

export type DocumentBusinessAreaScope =
  | { kind: "none" }
  | { kind: "valid"; businessAreaId: number }
  | { kind: "invalid"; rawValue: unknown };

export function readDocumentBusinessAreaScope(
  metadata: unknown,
): DocumentBusinessAreaScope {
  if (!metadata || typeof metadata !== "object") {
    return { kind: "none" };
  }

  const record = metadata as Record<string, unknown>;
  if (
    !Object.prototype.hasOwnProperty.call(record, "business_area_id") ||
    record.business_area_id === null ||
    typeof record.business_area_id === "undefined"
  ) {
    return { kind: "none" };
  }

  const value = record.business_area_id;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return { kind: "invalid", rawValue: value };
  }

  return { kind: "valid", businessAreaId: value };
}

export function isDocumentScopeAllowed({
  scope,
  projectId,
  metadata,
  requestedProjectId,
  requestedBusinessAreaId,
}: {
  scope: ToolScope;
  projectId: unknown;
  metadata: unknown;
  requestedProjectId?: number | null;
  requestedBusinessAreaId?: number | null;
}): boolean {
  if (
    typeof requestedProjectId === "number" &&
    typeof requestedBusinessAreaId === "number"
  ) {
    return false;
  }

  const businessAreaScope = readDocumentBusinessAreaScope(metadata);
  if (businessAreaScope.kind === "invalid") {
    return false;
  }

  if (businessAreaScope.kind === "valid") {
    if (typeof requestedProjectId === "number") {
      return false;
    }
    return (
      (typeof requestedBusinessAreaId !== "number" ||
        businessAreaScope.businessAreaId === requestedBusinessAreaId) &&
      scope.allowedBusinessAreaIds.includes(businessAreaScope.businessAreaId)
    );
  }

  if (typeof requestedBusinessAreaId === "number") {
    return false;
  }

  if (typeof requestedProjectId === "number") {
    return projectId === requestedProjectId;
  }

  if (scope.isAdmin) {
    return true;
  }

  return (
    typeof projectId === "number" && scope.allowedProjectIds.includes(projectId)
  );
}

export function resolveAllowedBusinessAreaIds({
  businessAreas,
  activeMembershipIds,
  isAdmin,
}: {
  businessAreas: Array<{ id: number; is_restricted: boolean }>;
  activeMembershipIds: ReadonlySet<number>;
  isAdmin: boolean;
}): number[] {
  return businessAreas
    .filter(
      (area) =>
        isAdmin ||
        area.is_restricted !== true ||
        activeMembershipIds.has(area.id),
    )
    .map((area) => area.id);
}

export function isCommunicationSourceAllowed({
  scope,
  sourceType,
  metadata,
}: {
  scope: ToolScope;
  sourceType: unknown;
  metadata: unknown;
}): boolean {
  const isCommunicationSource = [
    "email",
    "teams_message",
    "teams_channel",
    "teams_dm",
  ].includes(String(sourceType ?? ""));

  if (!isCommunicationSource || scope.isAdmin) {
    return true;
  }

  const businessAreaScope = readDocumentBusinessAreaScope(metadata);
  return (
    businessAreaScope.kind === "valid" &&
    scope.allowedBusinessAreaIds.includes(businessAreaScope.businessAreaId)
  );
}

export function resolveCommunicationSourceType({
  category,
  sourceType,
}: {
  category: unknown;
  sourceType: unknown;
}): unknown {
  const normalizedCategory = String(category ?? "");
  if (
    normalizedCategory === "email" ||
    normalizedCategory === "teams_message"
  ) {
    return normalizedCategory;
  }
  return sourceType;
}

type CreateToolGuardrailsOptions = {
  pinnedProjectId?: number;
  /** Injected DB client. Defaults to a fresh service client when omitted. */
  db?: SupabaseClient<Database>;
};

export function createToolGuardrails(
  userId: string,
  options: CreateToolGuardrailsOptions = {},
): ToolGuardrails {
  const supabase = options.db ?? createServiceClient();
  let scopePromise: Promise<ToolScope> | null = null;

  async function loadScope(): Promise<ToolScope> {
    const [
      { data: authLink, error: authLinkError },
      { data: profile, error: profileError },
    ] = await Promise.all([
      supabase
        .from("users_auth")
        .select("person_id")
        .eq("auth_user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("is_admin, is_leadership")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    if (authLinkError) {
      throw new Error(
        `Failed to load user authorization link: ${authLinkError.message}`,
      );
    }
    if (profileError) {
      throw new Error(
        `Failed to load user authorization profile: ${profileError.message}`,
      );
    }

    const personId = authLink?.person_id ?? null;
    const isAdmin = profile?.is_admin === true;
    const isLeadership = profile?.is_leadership === true;

    const allowedProjectIds: number[] = [];
    const allowedBusinessAreaIds: number[] = [];
    const allowedCompanyIdsSet = new Set<string>();

    const { data: businessAreas, error: businessAreasError } = await supabase
      .from("business_areas")
      .select("id, is_restricted")
      .limit(2000);

    if (businessAreasError) {
      throw new Error(
        `Failed to load Business Area authorization scope: ${businessAreasError.message}`,
      );
    }

    let activeBusinessAreaMembershipIds = new Set<number>();
    if (!isAdmin && personId) {
      const {
        data: businessAreaMemberships,
        error: businessAreaMembershipsError,
      } = await supabase
        .from("business_area_memberships")
        .select("business_area_id")
        .eq("person_id", personId)
        .eq("status", "active")
        .limit(2000);

      if (businessAreaMembershipsError) {
        throw new Error(
          `Failed to load Business Area memberships: ${businessAreaMembershipsError.message}`,
        );
      }

      activeBusinessAreaMembershipIds = new Set(
        (businessAreaMemberships ?? [])
          .map((row) => row.business_area_id)
          .filter(
            (businessAreaId): businessAreaId is number =>
              typeof businessAreaId === "number",
          ),
      );
    }

    allowedBusinessAreaIds.push(
      ...resolveAllowedBusinessAreaIds({
        businessAreas: (businessAreas ?? []).filter(
          (
            area,
          ): area is {
            id: number;
            is_restricted: boolean;
          } => typeof area.id === "number",
        ),
        activeMembershipIds: activeBusinessAreaMembershipIds,
        isAdmin,
      }),
    );

    if (isAdmin) {
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id, company_id")
        .eq("archived", false)
        .limit(2000);

      if (projectsError) {
        throw new Error(
          `Failed to load admin project authorization scope: ${projectsError.message}`,
        );
      }

      for (const row of projects ?? []) {
        if (typeof row.id === "number") {
          allowedProjectIds.push(row.id);
        }
        if (typeof row.company_id === "string" && row.company_id.trim()) {
          allowedCompanyIdsSet.add(row.company_id);
        }
      }
    } else if (personId) {
      const { data: memberships, error: membershipsError } = await supabase
        .from("project_directory_memberships")
        .select("project_id")
        .eq("person_id", personId)
        .eq("status", "active")
        .limit(2000);

      if (membershipsError) {
        throw new Error(
          `Failed to load project memberships: ${membershipsError.message}`,
        );
      }

      for (const row of memberships ?? []) {
        if (typeof row.project_id === "number") {
          allowedProjectIds.push(row.project_id);
        }
      }

      if (allowedProjectIds.length > 0) {
        const { data: projects, error: projectsError } = await supabase
          .from("projects")
          .select("id, company_id")
          .in("id", allowedProjectIds)
          .limit(2000);

        if (projectsError) {
          throw new Error(
            `Failed to load project authorization scope: ${projectsError.message}`,
          );
        }

        for (const row of projects ?? []) {
          if (typeof row.company_id === "string" && row.company_id.trim()) {
            allowedCompanyIdsSet.add(row.company_id);
          }
        }
      }
    }

    let pinnedProjectId: number | null = null;
    if (
      typeof options.pinnedProjectId === "number" &&
      Number.isFinite(options.pinnedProjectId)
    ) {
      if (isAdmin || allowedProjectIds.includes(options.pinnedProjectId)) {
        pinnedProjectId = options.pinnedProjectId;
      }
    }

    return {
      userId,
      personId,
      isAdmin,
      isLeadership,
      allowedProjectIds,
      allowedBusinessAreaIds,
      allowedCompanyIds: [...allowedCompanyIdsSet],
      pinnedProjectId,
    };
  }

  function getScope(): Promise<ToolScope> {
    if (!scopePromise) {
      scopePromise = loadScope();
    }
    return scopePromise;
  }

  async function getScopedProjectIds(
    requestedProjectId?: number | null,
  ): Promise<number[]> {
    const scope = await getScope();

    if (scope.allowedProjectIds.length === 0 && !scope.isAdmin) {
      return [];
    }

    if (typeof scope.pinnedProjectId === "number") {
      return [scope.pinnedProjectId];
    }

    const effectiveProjectId =
      typeof requestedProjectId === "number" &&
      Number.isFinite(requestedProjectId)
        ? requestedProjectId
        : null;

    if (typeof effectiveProjectId === "number") {
      if (
        !scope.isAdmin &&
        !scope.allowedProjectIds.includes(effectiveProjectId)
      ) {
        return [];
      }
      return [effectiveProjectId];
    }

    return scope.allowedProjectIds;
  }

  async function enforceProjectAccess(
    projectId: number,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const scope = await getScope();

    if (!Number.isFinite(projectId)) {
      return { ok: false, error: "Invalid project ID." };
    }

    if (
      typeof scope.pinnedProjectId === "number" &&
      projectId !== scope.pinnedProjectId
    ) {
      return {
        ok: false,
        error:
          "That tool call targeted a different project than the selected project context. Keep the selected project context or clear it before querying another project.",
      };
    }

    if (scope.isAdmin || scope.allowedProjectIds.includes(projectId)) {
      return { ok: true };
    }

    return {
      ok: false,
      error:
        "You do not have access to that project. Pick a project you are assigned to or change the project context.",
    };
  }

  async function getScopedBusinessAreaIds(): Promise<number[]> {
    const scope = await getScope();
    return scope.allowedBusinessAreaIds;
  }

  async function enforceBusinessAreaAccess(
    businessAreaId: number,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const scope = await getScope();

    if (!Number.isSafeInteger(businessAreaId) || businessAreaId <= 0) {
      return { ok: false, error: "Invalid Business Area ID." };
    }

    if (scope.allowedBusinessAreaIds.includes(businessAreaId)) {
      return { ok: true };
    }

    return {
      ok: false,
      error:
        "You do not have access to that Alleato Brain branch. Ask the branch owner or an app admin to review membership.",
    };
  }

  async function applyPinnedProject(
    requestedProjectId?: number | null,
  ): Promise<number | null> {
    const scope = await getScope();
    if (typeof scope.pinnedProjectId === "number") {
      return scope.pinnedProjectId;
    }
    if (
      typeof requestedProjectId === "number" &&
      Number.isFinite(requestedProjectId)
    ) {
      return requestedProjectId;
    }
    return scope.pinnedProjectId;
  }

  return {
    getScope,
    getScopedProjectIds,
    getScopedBusinessAreaIds,
    enforceProjectAccess,
    enforceBusinessAreaAccess,
    applyPinnedProject,
  };
}
