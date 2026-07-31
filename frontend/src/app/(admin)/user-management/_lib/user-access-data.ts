import { apiFetch } from "@/lib/api-client";
import type {
  GranularFlag,
  PermissionTemplate,
} from "@/lib/permissions-shared";

export type TemplateScope = "company" | "project";
export type PermissionUsersAccess = "app" | "project";
export type GranularOverrideEffect = "allow" | "deny";

export type PermissionUser = {
  personId: string;
  authUserId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  personType: string;
  profilePhotoUrl: string | null;
  isAdmin: boolean;
  companyTemplateId: string | null;
  companyTemplateName: string | null;
  teamsAccount: {
    platformUserId: string;
    displayName: string | null;
    linkedAt: string;
  } | null;
  memberships: Array<{
    projectId: number | string;
    projectName: string | null;
    templateId: string | null;
    templateName: string | null;
  }>;
  granularOverrides: Array<{
    projectId: number | string | null;
    flag: GranularFlag;
    effect: GranularOverrideEffect;
  }>;
};

export type UserLinkDiagnostic = {
  authUserId: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  issues: Array<
    | "missing_person_auth_link"
    | "missing_users_auth_link"
    | "mismatched_users_auth_link"
    | "duplicate_people_email"
  >;
};

export type PermissionUsersResponse = {
  data: PermissionUser[];
  diagnostics?: {
    missingAuthLinks?: UserLinkDiagnostic[];
  };
};

export type UserAccessSummary = {
  id: string;
  personId: string;
  authUserId: string | null;
  fullName: string;
  initials: string;
  email: string;
  personType: string;
  profilePhotoUrl: string | null;
  isAdmin: boolean;
  companyTemplateId: string | null;
  companyTemplateName: string | null;
  teamsAccount: PermissionUser["teamsAccount"];
  projectCount: number;
  assignedProjectCount: number;
  missingTemplateCount: number;
  primaryTemplateName: string;
  memberships: PermissionUser["memberships"];
  granularOverrides: PermissionUser["granularOverrides"];
};

export async function fetchTemplates(scope: TemplateScope): Promise<PermissionTemplate[]> {
  const { data } = await apiFetch<{ data: PermissionTemplate[] }>(
    `/api/permissions/templates?scope=${scope}`,
  );
  return data;
}

export async function fetchAllTemplates(): Promise<PermissionTemplate[]> {
  const { data } = await apiFetch<{ data: PermissionTemplate[] }>(
    "/api/permissions/templates",
  );
  return data;
}

function normalizeTemplateName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getProjectRoleTemplates(templates: PermissionTemplate[]): PermissionTemplate[] {
  const seen = new Set<string>();
  const roleTemplates: PermissionTemplate[] = [];

  for (const template of templates) {
    if (template.scope === "company") continue;

    const normalizedName = normalizeTemplateName(template.name);
    if (seen.has(normalizedName)) continue;

    seen.add(normalizedName);
    roleTemplates.push(template);
  }

  return roleTemplates;
}

export async function fetchUsers(access?: PermissionUsersAccess): Promise<PermissionUsersResponse> {
  const suffix = access ? `?access=${access}` : "";
  return apiFetch<PermissionUsersResponse>(`/api/permissions/users${suffix}`);
}

function getInitials(firstName: string, lastName: string, fallback: string): string {
  const initials = [firstName, lastName]
    .map((name) => name.charAt(0))
    .filter(Boolean)
    .join("")
    .toUpperCase();

  return initials || fallback.charAt(0).toUpperCase() || "?";
}

export function toAccessSummary(user: PermissionUser): UserAccessSummary {
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "Unnamed user";
  const assignedProjectCount = user.memberships.filter((m) => !!m.templateId).length;
  const missingTemplateCount = user.isAdmin ? 0 : user.memberships.length - assignedProjectCount;
  const primaryTemplateName = user.isAdmin
    ? "Admin"
    : user.companyTemplateName ?? user.memberships[0]?.templateName ?? "No role";

  return {
    id: user.personId,
    personId: user.personId,
    authUserId: user.authUserId,
    fullName,
    initials: getInitials(user.firstName, user.lastName, user.email),
    email: user.email,
    personType: user.personType,
    profilePhotoUrl: user.profilePhotoUrl,
    isAdmin: user.isAdmin,
    companyTemplateId: user.companyTemplateId,
    companyTemplateName: user.companyTemplateName,
    teamsAccount: user.teamsAccount ?? null,
    projectCount: user.memberships.length,
    assignedProjectCount,
    missingTemplateCount,
    primaryTemplateName,
    memberships: user.memberships,
    granularOverrides: user.granularOverrides ?? [],
  };
}

export function formatProjectCount(count: number) {
  return `${count} ${count === 1 ? "project" : "projects"}`;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikePersonId(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

/**
 * Turn a display name into a URL-safe slug (kebab-case, ASCII only).
 * Falls back to "user" when a name slugifies to nothing.
 */
export function slugifyName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/['’]/g, "") // drop apostrophes so "o'brien" -> "obrien"
    .replace(/[^a-z0-9]+/g, "-") // any run of non-alphanumerics -> single hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens

  return slug || "user";
}

export type UserSlugMaps = {
  /** personId -> canonical slug (e.g. "john-smith", "john-smith-2") */
  slugByPersonId: Map<string, string>;
  /** slug -> personId */
  personIdBySlug: Map<string, string>;
};

/**
 * Build a stable, collision-free slug for every user.
 *
 * The first user with a given name keeps the bare slug; each subsequent
 * duplicate gets a numeric suffix ("-2", "-3", ...). Numbering is made
 * deterministic by sorting on personId, so the same person always resolves to
 * the same slug regardless of fetch/render order — which is required for the
 * list page (link generation) and detail page (slug resolution) to agree.
 */
export function buildUserSlugMaps(users: UserAccessSummary[]): UserSlugMaps {
  const slugByPersonId = new Map<string, string>();
  const personIdBySlug = new Map<string, string>();
  const baseCounts = new Map<string, number>();
  // Tracks every final slug that has been assigned, so we can detect when a
  // generated suffix collides with another user's natural base slug (e.g.
  // "John Smith 2" naturally slugifies to "john-smith-2", which would otherwise
  // be silently overwritten when two "John Smith" entries generate that suffix).
  const usedSlugs = new Set<string>();

  const ordered = [...users].sort((a, b) => a.personId.localeCompare(b.personId));

  for (const user of ordered) {
    const base = slugifyName(user.fullName);
    const nextCount = (baseCounts.get(base) ?? 0) + 1;
    baseCounts.set(base, nextCount);
    let candidate = nextCount === 1 ? base : `${base}-${nextCount}`;

    // Walk forward until we find a slug not yet claimed by any other user.
    let bump = nextCount;
    while (usedSlugs.has(candidate)) {
      bump++;
      candidate = `${base}-${bump}`;
    }

    usedSlugs.add(candidate);
    slugByPersonId.set(user.personId, candidate);
    personIdBySlug.set(candidate, user.personId);
  }

  return { slugByPersonId, personIdBySlug };
}
