"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { UserPermissions } from "@/lib/permissions-shared";
import type { CurrentUserProfile } from "@/hooks/use-current-user-profile";

export interface ProjectShellProject {
  id: number;
  name: string;
  number?: string;
  status?: string;
  client?: string;
  start_date?: string;
  end_date?: string;
}

export interface ProjectShellData {
  project: ProjectShellProject;
  permissions: UserPermissions;
  userType: string | null;
  profile: CurrentUserProfile;
}

export const projectShellQueryKey = (projectId: number | null) => [
  "project-shell",
  projectId,
] as const;

export const currentUserProfileQueryKey = ["current-user-profile"] as const;

async function loadProjectShell(projectId: number): Promise<ProjectShellData> {
  return apiFetch<ProjectShellData>(`/api/projects/${projectId}/shell`);
}

export function useProjectShell(projectId: number | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: projectShellQueryKey(projectId),
    queryFn: () => loadProjectShell(projectId as number),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (query.data?.profile) {
      queryClient.setQueryData(currentUserProfileQueryKey, {
        profile: query.data.profile,
      });
    }
  }, [query.data?.profile, queryClient]);

  return query;
}
