"use client";

import { apiFetch } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";

export interface Project {
  id: number;
  name: string | null;
  project_number: string | null;
  company_id: string | null;
  phase: string | null;
  state: string | null;
  address: string | null;
  budget: number | null;
  budget_used: number | null;
  health_status: string | null;
  health_score: number | null;
  completion_percentage: number | null;
  project_manager: number | null;
  created_at: string;
  archived: boolean;
  // Joined data
  manager?: {
    id: number;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export interface ProjectOption {
  value: string;
  label: string;
  projectNumber?: string;
}

interface UseProjectsOptions {
  // Filter projects by search term
  search?: string;
  // Filter by phase
  phase?: string;
  // Whether to include archived projects
  includeArchived?: boolean;
  // Filter by company ID
  companyId?: string;
  // Limit number of results
  limit?: number;
  // Whether to auto-fetch on mount
  enabled?: boolean;
}

interface UseProjectsReturn {
  projects: Project[];
  options: ProjectOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

type ProjectsApiResponse = {
  data?: Project[];
};

/**
 * Hook for fetching projects from Supabase
 * Used in project selection dropdowns, contract forms, etc.
 */
export function useProjects(
  options: UseProjectsOptions = {},
): UseProjectsReturn {
  const {
    search,
    phase,
    includeArchived = false,
    companyId,
    limit = 100,
    enabled = true,
  } = options;
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        includeClient: "false",
      });

      if (search) {
        params.set("search", search);
      }

      if (phase) {
        params.set("phase", phase);
      }

      if (!includeArchived) {
        params.set("archived", "false");
      }

      if (companyId) {
        params.set("companyId", companyId);
      }

      const response = await apiFetch<ProjectsApiResponse>(`/api/projects?${params.toString()}`);
      setProjects(response.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch projects"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [search, phase, includeArchived, companyId, limit, enabled]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Transform projects to options for dropdowns
  const projectOptions: ProjectOption[] = projects.map((project) => {
    const label = project.project_number
      ? `${project.project_number} - ${project.name || "Unnamed Project"}`
      : project.name || "Unnamed Project";

    return {
      value: project.id.toString(),
      label,
      projectNumber: project.project_number || undefined,
    };
  });

  return {
    projects,
    options: projectOptions,
    isLoading,
    error,
    refetch: fetchProjects,
  };
}
