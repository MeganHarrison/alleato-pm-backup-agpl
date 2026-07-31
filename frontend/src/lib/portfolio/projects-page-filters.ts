import type { Project } from "@/types/portfolio";

export const DEFAULT_PROJECT_PHASE_FILTER = "Current";

interface ProjectPortfolioFilters {
  phaseFilter: string | null;
  categoryFilter: string | null;
  clientFilter: string | null;
}

export function filterPortfolioProjects(
  projects: Project[],
  { phaseFilter, categoryFilter, clientFilter }: ProjectPortfolioFilters,
): Project[] {
  return projects.filter((project) => {
    if (
      phaseFilter &&
      phaseFilter !== "all" &&
      project.phase?.toLowerCase() !== phaseFilter.toLowerCase()
    ) {
      return false;
    }

    if (categoryFilter && project.category !== categoryFilter) {
      return false;
    }

    if (clientFilter && project.client !== clientFilter) {
      return false;
    }

    return true;
  });
}
