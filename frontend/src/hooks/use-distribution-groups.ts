import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type {
  DistributionGroupWithMembers,
  GroupCreateDTO,
  GroupUpdateDTO,
} from "@/services/distributionGroupService";

interface UseDistributionGroupsResult {
  groups: DistributionGroupWithMembers[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useDistributionGroups(
  projectId: string,
  includeMembers = true,
  status: "active" | "inactive" | "all" = "active",
): UseDistributionGroupsResult {
  const query = useQuery<DistributionGroupWithMembers[], Error>({
    queryKey: ["distribution-groups", projectId, includeMembers, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        include_members: String(includeMembers),
        status,
      });
      return apiFetch<DistributionGroupWithMembers[]>(
        `/api/projects/${projectId}/directory/groups?${params}`,
      );
    },
    enabled: !!projectId,
  });

  return {
    groups: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useDistributionGroup(
  projectId: string,
  groupId: string | null,
) {
  return useQuery<DistributionGroupWithMembers, Error>({
    queryKey: ["distribution-group", projectId, groupId],
    queryFn: async () =>
      apiFetch<DistributionGroupWithMembers>(
        `/api/projects/${projectId}/directory/groups/${groupId}`,
      ),
    enabled: !!projectId && !!groupId,
  });
}

export function useCreateGroup(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: GroupCreateDTO) =>
      apiFetch<DistributionGroupWithMembers>(
        `/api/projects/${projectId}/directory/groups`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["distribution-groups", projectId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create group");
    },
  });
}

export function useUpdateGroup(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      data,
    }: {
      groupId: string;
      data: GroupUpdateDTO;
    }) =>
      apiFetch<DistributionGroupWithMembers>(
        `/api/projects/${projectId}/directory/groups/${groupId}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({
        queryKey: ["distribution-groups", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["distribution-group", projectId, groupId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update group");
    },
  });
}

export function useDeleteGroup(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) =>
      apiFetch(
        `/api/projects/${projectId}/directory/groups/${groupId}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["distribution-groups", projectId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete group");
    },
  });
}

export function useUpdateGroupMembers(projectId: string, groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (operation: {
      add_user_ids?: string[];
      remove_user_ids?: string[];
    }) =>
      apiFetch<DistributionGroupWithMembers>(
        `/api/projects/${projectId}/directory/groups/${groupId}/members`,
        {
          method: "PATCH",
          body: JSON.stringify(operation),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["distribution-groups", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["distribution-group", projectId, groupId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update group members");
    },
  });
}
