/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md for source and modification details.
 */

"use client";

import { useMemo, useState } from "react";
import { useProjects } from "@/hooks/use-projects";
import {
  filterAndSortProjects,
  type PlaneProjectsSort,
  type PlaneProjectsStatus,
  type PlaneProjectsView as PlaneProjectsViewMode,
} from "./plane-projects-model";
import { PlaneProjectsView } from "./plane-projects-view";

export function PlaneProjectsSurface() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PlaneProjectsStatus>("active");
  const [sort, setSort] = useState<PlaneProjectsSort>("name");
  const [view, setView] = useState<PlaneProjectsViewMode>("grid");
  const { projects, isLoading, error, refetch } = useProjects({
    includeArchived: true,
    limit: 500,
  });

  const visibleProjects = useMemo(
    () => filterAndSortProjects(projects, { query, status, sort }),
    [projects, query, sort, status],
  );

  return (
    <PlaneProjectsView
      projects={visibleProjects}
      totalProjects={projects.length}
      query={query}
      status={status}
      sort={sort}
      view={view}
      isLoading={isLoading}
      error={error}
      onQueryChange={setQuery}
      onStatusChange={setStatus}
      onSortChange={setSort}
      onViewChange={setView}
      onRetry={() => void refetch()}
    />
  );
}
