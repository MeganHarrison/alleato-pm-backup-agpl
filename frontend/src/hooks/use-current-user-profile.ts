import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { useOptionalProject } from "@/contexts/project-context";
import { currentUserProfileQueryKey, useProjectShell } from "@/hooks/use-project-shell";

export type CurrentUserProfile = {
  id: string;
  personId: string | null;
  fullName: string;
  email: string;
  avatarUrl?: string;
  company?: string;
  title?: string;
  role?: string;
  phone?: string;
  location?: string;
  timezone?: string;
  region?: string;
  licenseNumber?: string;
  specialties?: string[];
  workHours?: string;
  communicationPreference?: string;
  profileCompleteness: number;
  isAdmin?: boolean;
  isDeveloper?: boolean;
  onboardingCompletedAt?: string | null;
};

type LoadProfileResult = {
  profile: CurrentUserProfile | null;
  error: string | null;
};

type CurrentUserProfileResponse = {
  profile: CurrentUserProfile;
};

async function loadCurrentUserProfile(): Promise<LoadProfileResult> {
  const response = await apiFetch<CurrentUserProfileResponse>("/api/users/me/profile");
  return {
    profile: response.profile,
    error: null,
  };
}

export const useCurrentUserProfile = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
  const projectContext = useOptionalProject();
  const projectId = projectContext?.projectId ?? null;
  const shell = useProjectShell(enabled ? projectId : null);
  const profileQuery = useQuery({
    queryKey: currentUserProfileQueryKey,
    queryFn: loadCurrentUserProfile,
    enabled: enabled && !projectId && !shell.data?.profile,
    staleTime: 60_000,
  });

  const queryData = profileQuery.data;
  const queryError = profileQuery.error;
  const profile = shell.data?.profile ?? queryData?.profile ?? null;
  const error = queryData?.error ?? (queryError instanceof Error ? queryError.message : null);

  return {
    profile,
    isLoading: enabled && !profile && (shell.isLoading || profileQuery.isLoading),
    error,
  };
};
