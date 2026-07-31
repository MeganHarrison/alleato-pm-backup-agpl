/**
 * React Hooks for Permission Management
 *
 * This module provides React hooks for checking and managing permissions.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  type UserPermissions,
  type PermissionModule,
  type PermissionLevel,
  type PermissionTemplate,
  hasPermission,
  getPermissionLevel,
} from "@/lib/permissions-shared";

/**
 * Hook to load and manage user permissions for a project
 */
export function useUserPermissions(projectId: string | number) {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadPermissions = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data } = await apiFetch<{ data: UserPermissions }>(
        `/api/projects/${projectId}/permissions`
      );
      setPermissions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("an unexpected error occurred — please try again"));
      setPermissions(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  return {
    permissions,
    isLoading,
    error,
    refetch: loadPermissions,
    hasPermission: useCallback(
      (module: PermissionModule, level: PermissionLevel) => {
        return permissions ? hasPermission(permissions, module, level) : false;
      },
      [permissions]
    ),
    getLevel: useCallback(
      (module: PermissionModule) => {
        return permissions ? getPermissionLevel(permissions, module) : "none";
      },
      [permissions]
    ),
  };
}

/**
 * Hook to load available permission templates
 */
export function usePermissionTemplates() {
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data } = await apiFetch<{ data: PermissionTemplate[] }>(
        "/api/permissions/templates"
      );
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("an unexpected error occurred — please try again"));
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const assignTemplate = useCallback(
    async (projectId: string | number, personId: string, templateId: string) => {
      return await apiFetch<unknown>(
        `/api/projects/${projectId}/permissions/assign`,
        {
          method: "POST",
          body: JSON.stringify({
            person_id: personId,
            template_id: templateId,
          }),
        }
      );
    },
    []
  );

  return {
    templates,
    isLoading,
    error,
    refetch: loadTemplates,
    assignTemplate,
  };
}

/**
 * Hook to manage permission overrides
 */
export function usePermissionOverrides(projectId: string | number) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const setOverride = useCallback(
    async (
      personId: string,
      module: PermissionModule,
      level: PermissionLevel
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        return await apiFetch<unknown>(
          `/api/projects/${projectId}/permissions/override`,
          {
            method: "POST",
            body: JSON.stringify({
              person_id: personId,
              module,
              level,
            }),
          }
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error("an unexpected error occurred — please try again");
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId]
  );

  const removeOverride = useCallback(
    async (personId: string, module: PermissionModule) => {
      setIsLoading(true);
      setError(null);

      try {
        return await apiFetch<unknown>(
          `/api/projects/${projectId}/permissions/override?person_id=${personId}&module=${module}`,
          {
            method: "DELETE",
          }
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error("an unexpected error occurred — please try again");
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId]
  );

  return {
    isLoading,
    error,
    setOverride,
    removeOverride,
  };
}

/**
 * Convenience hook to check a specific permission
 */
export function useHasPermission(
  projectId: string | number,
  module: PermissionModule,
  level: PermissionLevel
) {
  const { permissions, isLoading } = useUserPermissions(projectId);

  return {
    hasPermission: permissions ? hasPermission(permissions, module, level) : false,
    isLoading,
  };
}

/**
 * Hook to get permission level for a module
 */
export function usePermissionLevel(
  projectId: string | number,
  module: PermissionModule
) {
  const { permissions, isLoading } = useUserPermissions(projectId);

  return {
    level: permissions ? getPermissionLevel(permissions, module) : "none",
    isLoading,
  };
}