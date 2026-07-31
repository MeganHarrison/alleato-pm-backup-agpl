import type { PermissionTemplate } from "@/lib/permissions-shared";

export type PageRoleAccessMode = "inherit_requirement" | "explicit_allowlist";

export type PageRoleAccessPolicy = {
  route: string;
  mode: PageRoleAccessMode;
  allowedPermissionTemplateIds: string[];
  notes: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type PageRoleAccessPolicyInput = {
  route: string;
  mode: PageRoleAccessMode;
  allowedPermissionTemplateIds: string[];
  notes?: string | null;
};

export type PageRoleAccessDecision =
  | {
      allowed: true;
      reason:
        | "no-explicit-policy"
        | "inherited"
        | "admin-bypass"
        | "role-allowed";
    }
  | {
      allowed: false;
      reason: "missing-template" | "role-denied" | "policy-load-failed";
    };

export function canonicalizeProjectPath(pathname: string): string | null {
  const match = pathname.match(/^\/\d+(\/.*)?$/);
  if (!match) return null;

  const suffix = match[1] ?? "";
  const route = `/[projectId]${suffix}`;
  return route.length > 1 && route.endsWith("/") ? route.slice(0, -1) : route;
}

export function sortPermissionTemplates(
  templates: PermissionTemplate[],
): PermissionTemplate[] {
  return [...templates].sort((left, right) => {
    const scopeOrder = getScopeOrder(left.scope) - getScopeOrder(right.scope);
    if (scopeOrder !== 0) return scopeOrder;
    return left.name.localeCompare(right.name);
  });
}

export function formatAllowedRoleNames(
  policy: PageRoleAccessPolicy | null | undefined,
  templates: PermissionTemplate[],
): string {
  if (!policy || policy.mode === "inherit_requirement") return "Inherited";

  const names = new Map(
    templates.map((template) => [template.id, template.name]),
  );
  const selectedNames = policy.allowedPermissionTemplateIds
    .map((id) => names.get(id))
    .filter((name): name is string => Boolean(name))
    .sort((left, right) => left.localeCompare(right));

  if (selectedNames.length === 0) return "No roles";
  if (selectedNames.length <= 3) return selectedNames.join(", ");
  return `${selectedNames.slice(0, 3).join(", ")} +${selectedNames.length - 3}`;
}

function getScopeOrder(scope: string | undefined): number {
  if (scope === "project") return 0;
  if (scope === "company") return 1;
  if (scope === "global") return 2;
  return 3;
}
