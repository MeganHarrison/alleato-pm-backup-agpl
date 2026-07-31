import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ProjectCreationLogItem } from "@/features/project-creation-log/project-creation-log-table-config";

interface ProjectCreationLogParams {
  page: number;
  perPage: number;
  search: string;
  createdVia: string;
  attributionStatus: string;
}

interface ProjectCreationLogResponse {
  items: ProjectCreationLogItem[];
  total: number;
  page: number;
  perPage: number;
}

export const projectCreationLogKeys = {
  all: ["project-creation-log"] as const,
  list: (params: ProjectCreationLogParams) =>
    ["project-creation-log", "list", params] as const,
};

export function useProjectCreationLog(params: ProjectCreationLogParams) {
  return useQuery({
    queryKey: projectCreationLogKeys.list(params),
    queryFn: () => {
      const query = new URLSearchParams({
        page: String(params.page),
        perPage: String(params.perPage),
        ...(params.search ? { search: params.search } : {}),
        ...(params.createdVia ? { created_via: params.createdVia } : {}),
        ...(params.attributionStatus
          ? { attribution_status: params.attributionStatus }
          : {}),
      });
      return apiFetch<ProjectCreationLogResponse>(
        `/api/admin/project-creation-log?${query}`,
      );
    },
    staleTime: 30_000,
  });
}
