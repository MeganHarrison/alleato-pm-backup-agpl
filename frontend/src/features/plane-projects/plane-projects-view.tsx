/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md for source and modification details.
 */

"use client";

import Link from "next/link";
import {
  Archive,
  ArrowDownAZ,
  FolderKanban,
  Grid2X2,
  List,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getProjectHref,
  getProjectIdentifier,
  getProjectInitials,
  getProjectName,
  getProjectSecondaryLabel,
  getProjectTone,
  type PlaneProject,
  type PlaneProjectsSort,
  type PlaneProjectsStatus,
  type PlaneProjectsView,
} from "./plane-projects-model";

export interface PlaneProjectsViewProps {
  projects: readonly PlaneProject[];
  totalProjects: number;
  query: string;
  status: PlaneProjectsStatus;
  sort: PlaneProjectsSort;
  view: PlaneProjectsView;
  isLoading: boolean;
  error: Error | null;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: PlaneProjectsStatus) => void;
  onSortChange: (value: PlaneProjectsSort) => void;
  onViewChange: (value: PlaneProjectsView) => void;
  onRetry: () => void;
}

const statusLabels: Record<PlaneProjectsStatus, string> = {
  active: "Active projects",
  archived: "Archived projects",
  all: "All projects",
};

const sortLabels: Record<PlaneProjectsSort, string> = {
  name: "Name",
  newest: "Newest",
  oldest: "Oldest",
};

function ProjectMark({ project }: { project: PlaneProject }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-md bg-gradient-to-br text-xs font-semibold text-white",
        getProjectTone(project),
      )}
    >
      {getProjectInitials(project)}
    </span>
  );
}

function ProjectCard({ project }: { project: PlaneProject }) {
  return (
    <Link
      href={getProjectHref(project)}
      className="group flex min-h-52 w-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className={cn(
          "relative flex h-[118px] items-end overflow-hidden bg-gradient-to-br p-4",
          getProjectTone(project),
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        <div className="relative flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary-foreground/15 text-xs font-semibold text-primary-foreground ring-1 ring-primary-foreground/15">
            {getProjectInitials(project)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-primary-foreground">
              {getProjectName(project)}
            </span>
            <span className="block truncate text-[11px] font-medium text-primary-foreground/80">
              {getProjectIdentifier(project)}
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 p-4">
        <p className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">
          {project.address?.trim() ||
            project.state?.trim() ||
            "Open the project workspace"}
        </p>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate text-muted-foreground">
            {getProjectSecondaryLabel(project)}
          </span>
          {project.archived ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Archive className="size-3" />
              Archived
            </span>
          ) : (
            <span className="size-2 shrink-0 rounded-full bg-status-success" aria-label="Active" />
          )}
        </div>
      </div>
    </Link>
  );
}

function ProjectRow({ project }: { project: PlaneProject }) {
  return (
    <Link
      href={getProjectHref(project)}
      className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-2.5 transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.7fr)_minmax(7rem,0.6fr)] sm:px-4"
    >
      <span className="flex min-w-0 items-center gap-3">
        <ProjectMark project={project} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">
            {getProjectName(project)}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {getProjectIdentifier(project)}
          </span>
        </span>
      </span>
      <span className="hidden truncate text-sm text-muted-foreground sm:block">
        {getProjectSecondaryLabel(project)}
      </span>
      <span className="justify-self-end text-xs text-muted-foreground">
        {project.archived ? "Archived" : project.state?.trim() || "Active"}
      </span>
    </Link>
  );
}

function LoadingState({ view }: { view: PlaneProjectsView }) {
  if (view === "list") {
    return (
      <div className="overflow-hidden border-y border-border bg-card sm:rounded-lg sm:border">
        {[0, 1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="flex min-h-14 animate-pulse items-center gap-3 border-b border-border px-4 last:border-b-0"
          >
            <span className="size-9 rounded-md bg-muted" />
            <span className="h-3 w-40 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          className="min-h-52 animate-pulse overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="h-[118px] bg-muted" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyProjects({
  hasProjects,
  hasFilters,
  onClear,
}: {
  hasProjects: boolean;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-5 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <FolderKanban className="size-5" />
      </span>
      <SectionRuleHeading
        as="h2"
        className="mb-0 mt-4 justify-center pb-0"
        label={hasProjects ? "No projects match these filters" : "No projects yet"}
      />
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasProjects
          ? "Try another search or clear the current project filters."
          : "Create the first project to start organizing work."}
      </p>
      {hasFilters ? (
        <Button className="mt-5" variant="outline" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      ) : (
        <Button className="mt-5" size="sm" asChild>
          <Link href="/create-project">
            <Plus className="size-4" />
            Create project
          </Link>
        </Button>
      )}
    </div>
  );
}

export function PlaneProjectsView({
  projects,
  totalProjects,
  query,
  status,
  sort,
  view,
  isLoading,
  error,
  onQueryChange,
  onStatusChange,
  onSortChange,
  onViewChange,
  onRetry,
}: PlaneProjectsViewProps) {
  const hasFilters = query.trim().length > 0 || status !== "active";

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background" aria-label="Projects workspace">
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
          <h1 className="truncate text-sm font-medium text-foreground">Projects</h1>
        </div>

        <div className="flex items-center gap-1.5">
          <ExpandableSearch
            value={query}
            onChange={onQueryChange}
            placeholder="Search projects..."
            ariaLabel="Search projects"
            className="hidden md:flex"
            inputClassName="w-56 rounded-lg"
          />
          <Button size="sm" asChild>
            <Link href="/create-project">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Create project</span>
              <span className="sm:hidden">Project</span>
            </Link>
          </Button>
        </div>
      </header>

      <div className="border-b border-border px-3 py-2 md:hidden">
        <ExpandableSearch
          value={query}
          onChange={onQueryChange}
          placeholder="Search projects..."
          ariaLabel="Search projects"
          defaultExpanded
          collapsible={false}
          inputClassName="h-9"
        />
      </div>

      <div className="flex min-h-11 items-center justify-between gap-2 border-b border-border px-3 py-1.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <Select
            value={status}
            onValueChange={(value) => onStatusChange(value as PlaneProjectsStatus)}
          >
            <SelectTrigger
              size="sm"
              aria-label="Project status"
              className="h-8 w-auto min-w-32 rounded-lg px-2.5 text-xs font-medium"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="hidden sm:block">
            <Select
              value={sort}
              onValueChange={(value) => onSortChange(value as PlaneProjectsSort)}
            >
              <SelectTrigger
                size="sm"
                aria-label="Project order"
                className="h-8 w-28 rounded-lg px-2 text-xs"
              >
                <ArrowDownAZ className="size-3 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {Object.entries(sortLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="truncate text-xs text-muted-foreground" aria-live="polite">
            {isLoading ? "Loading" : `${projects.length} of ${totalProjects}`}
          </span>
        </div>

        <div className="flex rounded-lg bg-muted p-0.5" aria-label="Project view">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => onViewChange("grid")}
            className={cn(
              "size-7 rounded-md text-muted-foreground hover:bg-transparent",
              view === "grid" && "bg-background text-foreground shadow-xs",
            )}
          >
            <Grid2X2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => onViewChange("list")}
            className={cn(
              "size-7 rounded-md text-muted-foreground hover:bg-transparent",
              view === "list" && "bg-background text-foreground shadow-xs",
            )}
          >
            <List className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
        {error ? (
          <div
            role="alert"
            className="flex min-h-[45vh] flex-col items-center justify-center px-5 text-center"
          >
            <SectionRuleHeading
              as="h2"
              className="mb-0 justify-center pb-0"
              label="Projects could not be loaded"
            />
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {error.message || "The project request failed. Try again."}
            </p>
            <Button className="mt-5" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <LoadingState view={view} />
        ) : projects.length === 0 ? (
          <EmptyProjects
            hasProjects={totalProjects > 0}
            hasFilters={hasFilters}
            onClear={() => {
              onQueryChange("");
              onStatusChange("active");
            }}
          />
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden border-y border-border bg-card sm:rounded-lg sm:border">
            {projects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
