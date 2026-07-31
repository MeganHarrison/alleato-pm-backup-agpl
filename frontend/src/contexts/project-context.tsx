"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useProjectShell } from "@/hooks/use-project-shell";

interface Project {
  id: number;
  name: string;
  number?: string;
  status?: string;
  client?: string;
  start_date?: string;
  end_date?: string;
}

interface ProjectContextType {
  selectedProject: Project | null;
  projectId: number | null;
  setSelectedProject: (project: Project | null) => void;
  isLoading: boolean;
  requireProject: () => boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [selectedProject, setSelectedProjectState] = useState<Project | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname()! ?? "";
  const router = useRouter();
  const searchParams = useSearchParams()! ?? new URLSearchParams();

  // Extract project ID from URL path (e.g., /123/home -> 123) or query params (e.g., ?project=123)
  const projectIdFromUrl = React.useMemo(() => {
    // First check URL path segments
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length > 0 && /^\d+$/.test(segments[0])) {
      return parseInt(segments[0], 10);
    }

    // Then check query parameters
    const projectParam = searchParams.get("project");
    if (projectParam && /^\d+$/.test(projectParam)) {
      return parseInt(projectParam, 10);
    }

    return null;
  }, [pathname, searchParams]);

  // Persist last visited project ID so dev-panel tools can link to project pages
  useEffect(() => {
    if (projectIdFromUrl) {
      localStorage.setItem("last-project-id", String(projectIdFromUrl));
    }
  }, [projectIdFromUrl]);

  const projectShell = useProjectShell(projectIdFromUrl);

  // Hydrate project details from the shared shell payload when URL changes.
  useEffect(() => {
    if (!projectIdFromUrl) {
      setSelectedProjectState(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(projectShell.isLoading);

    if (projectShell.data?.project) {
      setSelectedProjectState(projectShell.data.project);
      setIsLoading(false);
      return;
    }

    if (projectShell.error) {
      console.error("Failed to fetch project shell:", projectShell.error);
      setSelectedProjectState(null);
      setIsLoading(false);
    }
  }, [projectIdFromUrl, projectShell.data?.project, projectShell.error, projectShell.isLoading]);

  // Manually set project (for programmatic updates)
  const setSelectedProject = useCallback((project: Project | null) => {
    setSelectedProjectState(project);
  }, []);

  // Check if project is required and redirect if not selected
  const requireProject = useCallback(() => {
    if (!selectedProject && !isLoading) {
      // Redirect to projects list or show selection modal
      router.push("/");
      return false;
    }
    return true;
  }, [selectedProject, isLoading, router]);

  const value: ProjectContextType = {
    selectedProject,
    projectId: selectedProject?.id || projectIdFromUrl,
    setSelectedProject,
    isLoading,
    requireProject,
  };

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

export function useOptionalProject() {
  return useContext(ProjectContext) ?? null;
}

// Hook that requires a project to be selected
export function useRequireProject() {
  const {
    selectedProject,
    projectId,
    setSelectedProject,
    isLoading,
    requireProject,
  } = useProject();

  useEffect(() => {
    if (!isLoading && !selectedProject) {
      // Project is required but not selected
      requireProject();
    }
  }, [isLoading, selectedProject, requireProject]);

  return {
    selectedProject,
    projectId,
    setSelectedProject,
    isLoading,
    requireProject,
  };
}
