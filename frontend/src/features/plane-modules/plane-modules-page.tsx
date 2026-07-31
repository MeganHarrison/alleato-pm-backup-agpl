/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 * Directly adapted from Plane v1.3.1 ModulesListHeader, ModuleViewHeader,
 * ModulesListMobileHeader, and ModulesListView templates.
 */

"use client";

import * as React from "react";
import {
  ArrowUpDown,
  Boxes,
  GanttChartSquare,
  LayoutGrid,
  List,
  ListFilter,
  Plus,
  Search,
  X,
} from "lucide-react";

import { EmptyState, ErrorState } from "@/components/ds";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useProjectPermissions,
  hasModulePermission,
} from "@/hooks/use-project-permissions";
import { useScheduleTasks } from "@/hooks/use-schedule-tasks";
import { apiFetch } from "@/lib/api-client";
import { getErrorDetail } from "@/lib/format-error";
import { cn } from "@/lib/utils";
import { appToast as toast } from "@/lib/toast/app-toast";
import type {
  ScheduleTaskWithHierarchy,
  TaskStatus,
} from "@/types/scheduling";

import { ModuleCardItem } from "./module-card-item";
import { ModuleFormDialog } from "./module-form-dialog";
import { ModuleListItem, ModuleProgressRing } from "./module-list-item";
import {
  canMutateModules,
  formatModuleDateRange,
  MODULE_STATUS_LABELS,
  moduleChildCount,
  normalizeModuleProgress,
} from "./module-model";

export interface PlaneModulesPageProps {
  projectId: number;
  allowMutations: boolean;
}

type ModuleLayout = "list" | "board";
type ModuleSort = "name" | "start_date" | "progress";

function ModulesLoading({ layout }: { layout: ModuleLayout }) {
  if (layout === "board") {
    return (
      <div
        className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2 xl:grid-cols-3"
        aria-label="Loading modules"
      >
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} className="h-44 rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div aria-label="Loading modules">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="flex min-h-[52px] items-center gap-4 border-b px-4"
        >
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="ml-auto hidden h-7 w-72 lg:block" />
        </div>
      ))}
    </div>
  );
}

export function PlaneModulesPage({
  projectId,
  allowMutations,
}: PlaneModulesPageProps) {
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [layout, setLayout] = React.useState<ModuleLayout>("list");
  const [sortBy, setSortBy] = React.useState<ModuleSort>("name");
  const [statusFilters, setStatusFilters] = React.useState<TaskStatus[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingModule, setEditingModule] =
    React.useState<ScheduleTaskWithHierarchy | null>(null);
  const [inspectedModule, setInspectedModule] =
    React.useState<ScheduleTaskWithHierarchy | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<ScheduleTaskWithHierarchy | null>(null);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const { permissions, isLoading: permissionsLoading } =
    useProjectPermissions(projectId);
  const { data, error, isLoading, refetch } = useScheduleTasks({
    projectId: String(projectId),
  });
  const canEdit = canMutateModules({
    allowMutations,
    permissionsLoading,
    hasWritePermission: hasModulePermission(permissions, "schedule", "write"),
  });

  const modules = React.useMemo(
    () => (data?.tasks ?? []).filter((task) => task.parent_task_id === null),
    [data?.tasks],
  );
  const filteredModules = React.useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = modules.filter((module) => {
      const matchesQuery =
        !normalized || module.name.toLocaleLowerCase().includes(normalized);
      const matchesStatus =
        statusFilters.length === 0 || statusFilters.includes(module.status);
      return matchesQuery && matchesStatus;
    });

    return filtered.toSorted((left, right) => {
      if (sortBy === "progress") {
        return (
          normalizeModuleProgress(right) - normalizeModuleProgress(left)
        );
      }
      if (sortBy === "start_date") {
        return (left.start_date ?? "9999").localeCompare(
          right.start_date ?? "9999",
        );
      }
      return left.name.localeCompare(right.name);
    });
  }, [modules, query, sortBy, statusFilters]);

  function openCreate() {
    if (!allowMutations) return;
    setEditingModule(null);
    setDialogOpen(true);
  }

  function openEdit(module: ScheduleTaskWithHierarchy) {
    if (!allowMutations) return;
    setEditingModule(module);
    setDialogOpen(true);
  }

  function toggleStatusFilter(status: TaskStatus) {
    setStatusFilters((current) =>
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status],
    );
  }

  async function updateStatus(
    module: ScheduleTaskWithHierarchy,
    status: TaskStatus,
  ) {
    if (!allowMutations) {
      toast.error("Module changes are disabled in this environment");
      return;
    }

    setUpdatingId(module.id);
    try {
      await apiFetch(
        `/api/projects/${projectId}/scheduling/tasks/${module.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      toast.success("Module updated");
      await refetch();
    } catch (updateError) {
      toast.error("Module was not updated", {
        description: getErrorDetail(updateError),
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteModule() {
    if (!allowMutations || !deleteTarget) return;
    setIsDeleting(true);

    try {
      await apiFetch(
        `/api/projects/${projectId}/scheduling/tasks/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      toast.success("Module deleted");
      if (inspectedModule?.id === deleteTarget.id) setInspectedModule(null);
      setDeleteTarget(null);
      await refetch();
    } catch (deleteError) {
      toast.error("Module was not deleted", {
        description: getErrorDetail(deleteError),
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const moduleItemProps = {
    canEdit,
    onInspect: setInspectedModule,
    onEdit: openEdit,
    onDelete: setDeleteTarget,
    onStatusChange: updateStatus,
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Boxes className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">Modules</span>
          <span className="text-muted-foreground">{modules.length}</span>
        </div>

        <div className="flex h-full items-center gap-2">
          <div className="hidden items-center sm:flex">
            {!isSearchOpen ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => {
                  setIsSearchOpen(true);
                  window.requestAnimationFrame(() =>
                    searchInputRef.current?.focus(),
                  );
                }}
                aria-label="Search modules"
              >
                <Search className="size-4" />
              </Button>
            ) : (
              <div className="flex h-8 w-64 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-muted-foreground">
                <Search className="size-3.5" />
                <input
                  ref={searchInputRef}
                  className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
                  placeholder="Search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      if (query) setQuery("");
                      else setIsSearchOpen(false);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setIsSearchOpen(false);
                  }}
                  aria-label="Close search"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden h-8 gap-1.5 px-2 sm:flex"
              >
                <ArrowUpDown className="size-3.5" />
                <span className="sr-only">Order modules</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Order by</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sortBy}
                onValueChange={(value) => setSortBy(value as ModuleSort)}
              >
                <DropdownMenuRadioItem value="name">
                  Name
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="start_date">
                  Start date
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="progress">
                  Progress
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "hidden h-8 gap-1.5 px-2 sm:flex",
                  statusFilters.length > 0 && "border-primary",
                )}
              >
                <ListFilter className="size-3.5" />
                <span className="sr-only">Filter modules</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {Object.entries(MODULE_STATUS_LABELS).map(([value, label]) => (
                <DropdownMenuCheckboxItem
                  key={value}
                  checked={statusFilters.includes(value as TaskStatus)}
                  onCheckedChange={() =>
                    toggleStatusFilter(value as TaskStatus)
                  }
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
              {statusFilters.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setStatusFilters([])}>
                    Clear filters
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden items-center gap-1 rounded bg-muted p-1 md:flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-[22px] w-7 rounded-sm",
                layout === "list" && "bg-background",
              )}
              onClick={() => setLayout("list")}
              aria-label="List layout"
            >
              <List className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-[22px] w-7 rounded-sm",
                layout === "board" && "bg-background",
              )}
              onClick={() => setLayout("board")}
              aria-label="Board layout"
            >
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-[22px] w-7 cursor-not-allowed rounded-sm opacity-45"
              disabled
              title="Gantt layout requires a consolidated scheduling adapter"
              aria-label="Gantt layout unavailable"
            >
              <GanttChartSquare className="size-3.5" />
            </Button>
          </div>

          {canEdit ? (
            <Button
              type="button"
              size="sm"
              className="h-8 px-2.5"
              onClick={openCreate}
            >
              <Plus className="size-4 sm:hidden" />
              <span className="hidden sm:inline">Add module</span>
              <span className="sr-only sm:hidden">Add module</span>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex shrink-0 justify-center border-b border-border py-2 md:hidden">
        <div className="flex items-center gap-1 rounded bg-muted p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-7", layout === "list" && "bg-background")}
            onClick={() => setLayout("list")}
          >
            <List className="size-3.5" />
            List
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-7", layout === "board" && "bg-background")}
            onClick={() => setLayout("board")}
          >
            <LayoutGrid className="size-3.5" />
            Board
          </Button>
        </div>
      </div>

      {!permissionsLoading && !canEdit ? (
        <p className="border-b px-4 py-2 text-xs text-muted-foreground">
          You have read-only access to project modules.
        </p>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto">
        {isLoading || permissionsLoading ? (
          <ModulesLoading layout={layout} />
        ) : null}

        {!isLoading && error ? (
          <div className="p-6">
            <ErrorState
              title="Modules could not be loaded"
              error={error}
              onRetry={() => void refetch()}
            />
          </div>
        ) : null}

        {!isLoading && !error && modules.length === 0 ? (
          <div className="grid min-h-72 place-items-center p-6">
            <EmptyState
              title="No modules yet"
              description="Create a module to group the project's schedule work."
              action={
                canEdit ? (
                  <Button type="button" onClick={openCreate}>
                    Create module
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : null}

        {!isLoading && !error && modules.length > 0 ? (
          filteredModules.length === 0 ? (
            <div className="grid min-h-72 place-items-center p-6 text-center">
              <div>
                <p className="text-sm font-medium">
                  No modules match your filters
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => {
                    setQuery("");
                    setStatusFilters([]);
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          ) : layout === "list" ? (
            <div>
              {filteredModules.map((module) => (
                <ModuleListItem
                  key={module.id}
                  module={module}
                  isUpdating={updatingId === module.id}
                  {...moduleItemProps}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredModules.map((module) => (
                <ModuleCardItem
                  key={module.id}
                  module={module}
                  isUpdating={updatingId === module.id}
                  {...moduleItemProps}
                />
              ))}
            </div>
          )
        ) : null}
      </main>

      <ModuleFormDialog
        projectId={projectId}
        module={editingModule}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={refetch}
      />

      <Sheet
        open={Boolean(inspectedModule)}
        onOpenChange={(open) => {
          if (!open) setInspectedModule(null);
        }}
      >
        <SheetContent className="gap-0 p-0 sm:max-w-md lg:w-[36rem]">
          {inspectedModule ? (
            <>
              <SheetHeader className="border-b px-5 py-4">
                <div className="flex items-center gap-3 pr-8">
                  <ModuleProgressRing
                    progress={normalizeModuleProgress(inspectedModule)}
                    size={34}
                  />
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-sm">
                      {inspectedModule.name}
                    </SheetTitle>
                    <SheetDescription>Module overview</SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="space-y-6 p-5 text-sm">
                <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-4">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{MODULE_STATUS_LABELS[inspectedModule.status]}</dd>
                  <dt className="text-muted-foreground">Progress</dt>
                  <dd>{normalizeModuleProgress(inspectedModule)}%</dd>
                  <dt className="text-muted-foreground">Work items</dt>
                  <dd>{moduleChildCount(inspectedModule)}</dd>
                  <dt className="text-muted-foreground">Date range</dt>
                  <dd>
                    {formatModuleDateRange(
                      inspectedModule.start_date,
                      inspectedModule.finish_date,
                    )}
                  </dd>
                </dl>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openEdit(inspectedModule)}
                  >
                    Edit module
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete module?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" and its nested schedule work will be removed.`
                : "This module and its nested schedule work will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deleteModule();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
