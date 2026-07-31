"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  DirectoryService,
  type DirectoryFilters,
} from "@/services/directoryService";

export function useProjectUsers(projectId: string, filters?: DirectoryFilters) {
  const supabase = createClient();
  const directoryService = new DirectoryService(supabase);

  const query = useQuery({
    queryKey: ["project-users", projectId, filters],
    queryFn: async () => {
      const response = await directoryService.getPeople(projectId, {
        ...filters,
        type: filters?.type || "user",
      });
      return response;
    },
    enabled: !!projectId,
  });

  return {
    users: query.data?.data || [],
    groups: query.data?.groups,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
