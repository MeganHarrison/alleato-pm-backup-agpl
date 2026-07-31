/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Directly adapted from Plane v1.4.0-rc1-11
 * (commit 39856932cd6b9bd17eab0920506d628190b47af2):
 * - apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/
 *   [projectId]/views/(list)/page.tsx
 * - apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/
 *   [projectId]/views/(list)/header.tsx
 * - apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/
 *   [projectId]/views/(list)/mobile-header.tsx
 * - apps/web/core/components/views/views-list.tsx
 * - apps/web/core/components/views/view-list-header.tsx
 * - apps/web/core/components/views/view-list-item.tsx
 * - apps/web/core/components/views/view-list-item-action.tsx
 * - apps/web/core/components/core/list/list-item.tsx
 *
 * Alleato adaptation: saved views remain read-only. Plane's creation and row
 * mutation affordances are intentionally disabled or omitted until a separate
 * permissions-and-mutations slice is authorized.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  ChevronRight,
  Eye,
  LayoutList,
  ListFilter,
  LockKeyhole,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  useSavedTableViews,
  type SavedViewFilterValue,
} from "@/hooks/use-saved-table-views";
import { cn } from "@/lib/utils";

import {
  applyProjectTaskViewFiltersToSearchParams,
  describeProjectTaskViewFilters,
  normalizeProjectTaskViewFilters,
} from "./view-query";

function textFilter(value: SavedViewFilterValue): string {
  return typeof value === "string" ? value : "";
}

export type PlaneProjectViewsIndexProps = {
  projectId: string;
  projectName?: string | null;
  taskRoute?: string;
};

export function PlaneProjectViewsIndex({
  projectId,
  projectName,
  taskRoute = `/${projectId}/tasks`,
}: PlaneProjectViewsIndexProps) {
  const router = useRouter();
  const scopeKey = `project-tasks-${projectId}`;
  const { data: views = [], isLoading, error } = useSavedTableViews(scopeKey);

  const [query, setQuery] = React.useState("");
  const [defaultOnly, setDefaultOnly] = React.useState(false);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "asc",
  );
  const filteredViews = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return views
      .filter((view) => !defaultOnly || view.is_default)
      .filter((view) => {
        if (!normalizedQuery) return true;
        const filters = normalizeProjectTaskViewFilters(view.filters);
        return (
          view.name.toLocaleLowerCase().includes(normalizedQuery) ||
          textFilter(filters.description)
            .toLocaleLowerCase()
            .includes(normalizedQuery)
        );
      })
      .sort((left, right) => {
        const result = left.name.localeCompare(right.name);
        return sortDirection === "asc" ? result : -result;
      });
  }, [defaultOnly, query, sortDirection, views]);

  function openView(view: (typeof views)[number]) {
    const params = applyProjectTaskViewFiltersToSearchParams(
      new URLSearchParams(),
      view.filters,
    );
    params.set("saved_view", view.id);
    router.push(`${taskRoute}?${params.toString()}`);
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-background"
      aria-label={`${projectName ?? "Project"} saved views`}
    >
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden max-w-44 truncate text-sm text-muted-foreground sm:inline">
            {projectName ?? "Project"}
          </span>
          <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />
          <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h1 className="truncate text-sm font-medium">Views</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 md:flex">
            <div className="relative flex h-8 w-8 items-center overflow-hidden rounded-md border border-transparent focus-within:w-52 focus-within:border-border focus-within:px-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search views"
                aria-label="Search views"
                className="h-7 min-w-0 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() =>
                setSortDirection((current) =>
                  current === "asc" ? "desc" : "asc",
                )
              }
              aria-label={`Order views by name ${sortDirection === "asc" ? "descending" : "ascending"}`}
            >
              {sortDirection === "asc" ? (
                <ArrowDownAZ className="h-4 w-4" />
              ) : (
                <ArrowUpAZ className="h-4 w-4" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("h-8 px-2", defaultOnly && "bg-muted")}
                  aria-label="Filter views"
                >
                  <ListFilter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => setDefaultOnly(false)}>
                  {!defaultOnly ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="w-4" />
                  )}
                  All views
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDefaultOnly(true)}>
                  {defaultOnly ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="w-4" />
                  )}
                  Default view
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled
            aria-describedby="plane-view-create-status"
            title="View creation is unavailable in this read-only pilot"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add view</span>
          </Button>
          <span id="plane-view-create-status" className="sr-only">
            View creation is unavailable in this read-only pilot.
          </span>
        </div>
      </header>

      <div className="grid h-11 shrink-0 grid-cols-2 border-b border-border md:hidden">
        <button
          type="button"
          className="flex min-h-11 items-center justify-center gap-2 border-r border-border text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          onClick={() =>
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
          }
        >
          {sortDirection === "asc" ? (
            <ArrowDownAZ className="h-4 w-4" />
          ) : (
            <ArrowUpAZ className="h-4 w-4" />
          )}
          Order by
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                defaultOnly && "bg-muted text-foreground",
              )}
            >
              <ListFilter className="h-4 w-4" />
              Filters
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => setDefaultOnly(false)}>
              {!defaultOnly ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="w-4" />
              )}
              All views
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDefaultOnly(true)}>
              {defaultOnly ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="w-4" />
              )}
              Default view
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex h-11 shrink-0 items-center border-b border-border px-3 md:hidden">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search views"
          aria-label="Search views"
          className="h-8 min-w-0 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded text-muted-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-px">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-[52px] animate-pulse border-b border-border bg-muted/30"
              />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="mx-auto max-w-lg px-6 py-16 text-center">
            <p className="text-sm font-medium text-destructive">
              Saved views could not be loaded.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {error.message}
            </p>
          </div>
        ) : filteredViews.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
            <Eye className="h-7 w-7 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium">
              {views.length === 0 ? "No views yet" : "No views found"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {views.length === 0
                ? "Saved task views will appear here when they are available."
                : "Change the search or filter to see other views."}
            </p>
          </div>
        ) : (
          <div>
            {filteredViews.map((view) => {
              const filters = normalizeProjectTaskViewFilters(view.filters);
              const description = textFilter(filters.description);
              return (
                <div
                  key={view.id}
                  className="group flex min-h-[52px] flex-col border-b border-border px-3 py-2 hover:bg-muted/40 sm:flex-row sm:items-center"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openView(view)}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center text-muted-foreground">
                      <LayoutList className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {view.name}
                        </span>
                        {view.is_default ? (
                          <Star
                            className="h-3.5 w-3.5 shrink-0 fill-current text-amber-500"
                            aria-label="Default view"
                          />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                        {description ||
                          describeProjectTaskViewFilters(view.filters)}
                      </span>
                    </span>
                  </button>

                  <div className="ml-10 flex shrink-0 items-center gap-3 text-xs text-muted-foreground sm:ml-0">
                    <span className="hidden max-w-64 truncate md:block">
                      {describeProjectTaskViewFilters(view.filters)}
                    </span>
                    <span
                      className="flex h-7 items-center gap-1.5"
                      title="Private view"
                    >
                      <LockKeyhole className="h-3.5 w-3.5" />
                      <span className="sm:sr-only">Private</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export const ProjectViewsClient = PlaneProjectViewsIndex;
