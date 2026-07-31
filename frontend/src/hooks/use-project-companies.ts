import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type {
  ProjectCompany,
  CompanyCreateDTO,
  CompanyUpdateDTO,
  CompanyFilters,
} from "@/services/companyService";
import {
  CompanyListResponseSchema,
  ProjectCompanySchema,
  type CompanyListResponse as CompanyListResponseParsed,
  type ProjectCompanyResponse,
} from "@/lib/validation/companies";
import { safeParse } from "@/lib/validation/schemas";

interface UseProjectCompaniesResult {
  companies: ProjectCompany[];
  pagination: CompanyListResponseParsed["pagination"] | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useProjectCompanies(
  projectId: string,
  filters: CompanyFilters = {},
): UseProjectCompaniesResult {
  const query = useQuery<CompanyListResponseParsed, Error>({
    queryKey: ["project-companies", projectId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.company_type)
        params.set("company_type", filters.company_type);
      if (filters.sort) params.set("sort", filters.sort);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.per_page) params.set("per_page", String(filters.per_page));

      const payload = await apiFetch<unknown>(
        `/api/projects/${projectId}/directory/companies?${params}`,
      );
      const parsed = safeParse(CompanyListResponseSchema, payload);
      if (!parsed.success) {
        throw new Error("Invalid companies response from server");
      }
      return parsed.data;
    },
    enabled: !!projectId,
  });

  return {
    companies: (query.data?.data || []) as ProjectCompany[],
    pagination: query.data?.pagination || null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

interface UseProjectCompanyResult {
  company: ProjectCompany | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useProjectCompany(
  projectId: string,
  companyId: string | null,
): UseProjectCompanyResult {
  const query = useQuery<ProjectCompanyResponse, Error>({
    queryKey: ["project-company", projectId, companyId],
    queryFn: async () => {
      const payload = await apiFetch<unknown>(
        `/api/projects/${projectId}/directory/companies/${companyId}`,
      );
      const parsed = safeParse(ProjectCompanySchema, payload);
      if (!parsed.success) {
        throw new Error("Invalid company response from server");
      }
      return parsed.data;
    },
    enabled: !!projectId && !!companyId,
  });

  return {
    company: (query.data || null) as ProjectCompany | null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateProjectCompany(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CompanyCreateDTO) => {
      const payload = await apiFetch<unknown>(
        `/api/projects/${projectId}/directory/companies`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      );
      const parsed = safeParse(ProjectCompanySchema, payload);
      if (!parsed.success) {
        throw new Error("Invalid company response from server");
      }
      return parsed.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-companies", projectId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create company");
    },
  });
}

export function useUpdateProjectCompany(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      data,
    }: {
      companyId: string;
      data: CompanyUpdateDTO;
    }) => {
      const payload = await apiFetch<unknown>(
        `/api/projects/${projectId}/directory/companies/${companyId}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      );
      const parsed = safeParse(ProjectCompanySchema, payload);
      if (!parsed.success) {
        throw new Error("Invalid company response from server");
      }
      return parsed.data;
    },
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({
        queryKey: ["project-companies", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-company", projectId, companyId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update company");
    },
  });
}

export function useDeleteProjectCompany(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string) => {
      await apiFetch(
        `/api/projects/${projectId}/directory/companies/${companyId}`,
        {
          method: "DELETE",
        },
      );
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-companies", projectId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete company");
    },
  });
}
