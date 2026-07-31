/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md for source and modification details.
 */

import type { Project } from "@/hooks/use-projects";

export type PlaneProjectsStatus = "active" | "archived" | "all";
export type PlaneProjectsSort = "name" | "newest" | "oldest";
export type PlaneProjectsView = "grid" | "list";

export type PlaneProject = Project;

export interface PlaneProjectsFilters {
  query: string;
  status: PlaneProjectsStatus;
  sort: PlaneProjectsSort;
}

function normalized(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

export function filterAndSortProjects(
  projects: readonly PlaneProject[],
  filters: PlaneProjectsFilters,
): PlaneProject[] {
  const query = normalized(filters.query);

  return projects
    .filter((project) => {
      if (filters.status === "active" && project.archived) return false;
      if (filters.status === "archived" && !project.archived) return false;
      if (!query) return true;

      return [
        project.name,
        project.project_number,
        project.phase,
        project.state,
        project.address,
      ].some((value) => normalized(value).includes(query));
    })
    .sort((left, right) => {
      if (filters.sort === "newest") {
        return Date.parse(right.created_at) - Date.parse(left.created_at);
      }
      if (filters.sort === "oldest") {
        return Date.parse(left.created_at) - Date.parse(right.created_at);
      }
      return (left.name ?? "").localeCompare(right.name ?? "", undefined, {
        sensitivity: "base",
      });
    });
}

export function getProjectName(project: PlaneProject): string {
  return project.name?.trim() || "Untitled project";
}

export function getProjectIdentifier(project: PlaneProject): string {
  return project.project_number?.trim() || String(project.id);
}

export function getProjectInitials(project: PlaneProject): string {
  const words = getProjectName(project)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word[0]?.toLocaleUpperCase()).join("") || "P";
}

export function getProjectSecondaryLabel(project: PlaneProject): string {
  return (
    project.phase?.trim() ||
    project.state?.trim() ||
    (project.archived ? "Archived" : "Active")
  );
}

export function getProjectHref(project: PlaneProject): string {
  return `/${project.id}/home`;
}

export function getProjectTone(project: PlaneProject): string {
  const tones = [
    "from-slate-700 to-slate-500",
    "from-zinc-700 to-zinc-500",
    "from-sky-800 to-slate-600",
    "from-indigo-800 to-slate-600",
    "from-emerald-800 to-slate-600",
  ] as const;
  const index = Math.abs(project.id) % tones.length;
  return tones[index];
}
