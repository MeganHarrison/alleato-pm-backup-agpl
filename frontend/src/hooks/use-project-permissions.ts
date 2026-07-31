"use client";

import { useMemo } from "react";
import type { PermissionModule } from "@/lib/navigation-config";
import { getPermissionLevel, type UserPermissions } from "@/lib/permissions-shared";
import { useProjectShell } from "@/hooks/use-project-shell";

interface ProjectPermissions {
  permissions: Record<string, string[]>;
  userType: string | null;
  isAppAdmin: boolean;
  isDeveloper: boolean;
  isLoading: boolean;
}

type ProjectPermissionsResult = Omit<ProjectPermissions, "isLoading">;

const ADMIN_PERMISSIONS: Record<string, string[]> = {
  directory: ["read", "write", "admin"],
  budget: ["read", "write", "admin"],
  contracts: ["read", "write", "admin"],
  commitments: ["read", "write", "admin"],
  estimates: ["read", "write", "admin"],
  documents: ["read", "write", "admin"],
  schedule: ["read", "write", "admin"],
  submittals: ["read", "write", "admin"],
  rfis: ["read", "write", "admin"],
  change_orders: ["read", "write", "admin"],
  change_events: ["read", "write", "admin"],
  emails: ["read", "write", "admin"],
};

function mapProjectPermissions(
  userPermissions: UserPermissions,
  userType: string | null,
  isDeveloper: boolean,
): ProjectPermissionsResult {
  if (userPermissions.isAdmin) {
    return {
      permissions: ADMIN_PERMISSIONS,
      userType: userType ?? "admin",
      isAppAdmin: true,
      isDeveloper,
    };
  }

  return {
    permissions: Object.fromEntries(
      ([
        "directory",
        "budget",
        "contracts",
        "commitments",
        "estimates",
        "documents",
        "schedule",
        "submittals",
        "rfis",
        "change_orders",
        "change_events",
        "emails",
      ] as PermissionModule[]).map((module) => [
        module,
        getPermissionLevel(userPermissions, module) === "none"
          ? []
          : [getPermissionLevel(userPermissions, module)],
      ]),
    ),
    userType: userType || "employee",
    isAppAdmin: false,
    isDeveloper,
  };
}

/**
 * Fetches the current user's module permissions and user_type for a project.
 * Returns empty permissions when no projectId is provided.
 */
export function useProjectPermissions(
  projectId: number | null
): ProjectPermissions {
  const shell = useProjectShell(projectId);

  const mapped = useMemo(() => {
    if (!shell.data?.permissions) {
      return {
        permissions: {},
        userType: null,
        isAppAdmin: false,
        isDeveloper: false,
      };
    }

    return mapProjectPermissions(
      shell.data.permissions,
      shell.data.userType,
      shell.data.profile.isDeveloper === true,
    );
  }, [shell.data?.permissions, shell.data?.profile.isDeveloper, shell.data?.userType]);

  return { ...mapped, isLoading: shell.isLoading };
}

/**
 * Check if the user has at least the given permission level for a module.
 * admin > write > read (hierarchical).
 */
export function hasModulePermission(
  permissions: Record<string, string[]>,
  module: PermissionModule,
  level: "read" | "write" | "admin" = "read"
): boolean {
  const modulePerms = permissions[module] || [];

  if (modulePerms.includes("admin")) return true;
  if (level === "read" && modulePerms.includes("write")) return true;
  return modulePerms.includes(level);
}
