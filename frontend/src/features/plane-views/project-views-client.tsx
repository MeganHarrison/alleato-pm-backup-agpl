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
 * Alleato adaptation: Plane's create and row mutation affordances are wired to
 * Alleato's private, user-scoped saved table view contract. Plane controls for
 * favorites, publishing, and public access are omitted because those states
 * are not persisted by user_table_views.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  ChevronRight,
  Copy,
  Eye,
  LayoutGrid,
  LayoutList,
  ListFilter,
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type SavedTableView,
  useCreateSavedTableView,
  useDeleteSavedTableView,
  useSavedTableViews,
  useUpdateSavedTableView,
  type SavedViewFilterValue,
} from "@/hooks/use-saved-table-views";
import { cn } from "@/lib/utils";
import {
  PlaneAlertDialogContent,
  PlaneDialogContent,
  PlaneDropdownMenuContent,
  PlaneSelectContent,
} from "@/features/plane-work-items/plane-overlay";

import {
  applyProjectTaskViewFiltersToSearchParams,
  describeProjectTaskViewFilters,
  normalizeProjectTaskViewFilters,
} from "./view-query";
import {
  buildDuplicateSavedViewInput,
  buildProjectTaskViewFilters,
  type ProjectTaskViewEditorValues,
} from "./view-mutations";

function textFilter(value: SavedViewFilterValue): string {
  return typeof value === "string" ? value : "";
}

export type PlaneProjectViewsIndexProps = {
  projectId: string;
  projectName?: string | null;
  taskRoute?: string;
};

type ViewEditorState = ProjectTaskViewEditorValues & {
  viewId: string | null;
};

function blankEditor(): ViewEditorState {
  return {
    viewId: null,
    name: "",
    description: "",
    layout: "list",
    status: "open",
    priority: "",
    dueDateFrom: "",
    dueDateTo: "",
    isDefault: false,
  };
}

function editorForView(view: SavedTableView): ViewEditorState {
  const filters = normalizeProjectTaskViewFilters(view.filters);
  return {
    viewId: view.id,
    name: view.name,
    description: textFilter(filters.description),
    layout: filters.view === "board" ? "board" : "list",
    status: filters.status === "done" ? "done" : "open",
    priority:
      typeof filters.priority === "string"
        ? (filters.priority as ViewEditorState["priority"])
        : "",
    dueDateFrom: textFilter(filters.due_date_from),
    dueDateTo: textFilter(filters.due_date_to),
    isDefault: view.is_default,
  };
}

export function PlaneProjectViewsIndex({
  projectId,
  projectName,
  taskRoute = `/${projectId}/tasks`,
}: PlaneProjectViewsIndexProps) {
  const router = useRouter();
  const scopeKey = `project-tasks-${projectId}`;
  const { data: views = [], isLoading, error } = useSavedTableViews(scopeKey);
  const createView = useCreateSavedTableView(scopeKey);
  const updateView = useUpdateSavedTableView(scopeKey);
  const deleteView = useDeleteSavedTableView(scopeKey);

  const [query, setQuery] = React.useState("");
  const [defaultOnly, setDefaultOnly] = React.useState(false);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "asc",
  );
  const [editor, setEditor] = React.useState<ViewEditorState | null>(null);
  const [editorError, setEditorError] = React.useState<string | null>(null);
  const [operationError, setOperationError] = React.useState<string | null>(
    null,
  );
  const [viewPendingDelete, setViewPendingDelete] =
    React.useState<SavedTableView | null>(null);
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

  function updateEditor<Key extends keyof ViewEditorState>(
    key: Key,
    value: ViewEditorState[Key],
  ) {
    setEditor((current) => (current ? { ...current, [key]: value } : current));
  }

  function openCreateEditor() {
    setEditorError(null);
    setEditor(blankEditor());
  }

  function openEditEditor(view: SavedTableView) {
    setEditorError(null);
    setEditor(editorForView(view));
  }

  async function submitEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;

    const name = editor.name.trim();
    if (!name) {
      setEditorError("Enter a name for this view.");
      return;
    }

    setEditorError(null);
    try {
      const input = {
        name,
        is_default: editor.isDefault,
        filters: buildProjectTaskViewFilters(editor),
      };
      if (editor.viewId) {
        await updateView.mutateAsync({ viewId: editor.viewId, input });
      } else {
        await createView.mutateAsync(input);
      }
      setEditor(null);
    } catch (mutationError) {
      setEditorError(
        mutationError instanceof Error
          ? mutationError.message
          : "The view could not be saved.",
      );
    }
  }

  async function duplicateSavedView(view: SavedTableView) {
    setOperationError(null);
    try {
      await createView.mutateAsync(
        buildDuplicateSavedViewInput(
          view,
          views.map((savedView) => savedView.name),
        ),
      );
    } catch (mutationError) {
      setOperationError(
        mutationError instanceof Error
          ? mutationError.message
          : "The view could not be duplicated.",
      );
    }
  }

  async function toggleDefaultView(view: SavedTableView) {
    setOperationError(null);
    try {
      await updateView.mutateAsync({
        viewId: view.id,
        input: { is_default: !view.is_default },
      });
    } catch (mutationError) {
      setOperationError(
        mutationError instanceof Error
          ? mutationError.message
          : "The default view could not be changed.",
      );
    }
  }

  async function confirmDeleteView() {
    if (!viewPendingDelete) return;
    setOperationError(null);
    try {
      await deleteView.mutateAsync(viewPendingDelete.id);
      setViewPendingDelete(null);
    } catch (mutationError) {
      setOperationError(
        mutationError instanceof Error
          ? mutationError.message
          : "The view could not be deleted.",
      );
    }
  }

  const editorPending = createView.isPending || updateView.isPending;

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
              <PlaneDropdownMenuContent align="end" className="w-44">
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
              </PlaneDropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={openCreateEditor}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add view</span>
          </Button>
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
          <PlaneDropdownMenuContent align="end" className="w-44">
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
          </PlaneDropdownMenuContent>
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
        {operationError ? (
          <p
            role="alert"
            className="border-b border-border px-3 py-2 text-sm text-destructive"
          >
            {operationError}
          </p>
        ) : null}
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
              const isBoard = filters.view === "board";
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
                      {isBoard ? (
                        <LayoutGrid className="h-4 w-4" />
                      ) : (
                        <LayoutList className="h-4 w-4" />
                      )}
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:size-8"
                          aria-label={`Actions for ${view.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <PlaneDropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => openEditEditor(view)}>
                          <Pencil className="size-4" />
                          Edit view
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void duplicateSavedView(view)}
                        >
                          <Copy className="size-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void toggleDefaultView(view)}
                        >
                          <Star className="size-4" />
                          {view.is_default
                            ? "Remove as default"
                            : "Set as default"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setViewPendingDelete(view)}
                        >
                          <Trash2 className="size-4" />
                          Delete view
                        </DropdownMenuItem>
                      </PlaneDropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open && !editorPending) setEditor(null);
        }}
      >
        <PlaneDialogContent
          size="notification"
          onInteractOutside={(event) => {
            if (editorPending) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editor?.viewId ? "Edit view" : "Create view"}
            </DialogTitle>
            <DialogDescription>
              Save a private task layout and filter set for this project.
            </DialogDescription>
          </DialogHeader>
          {editor ? (
            <form className="space-y-5" onSubmit={submitEditor}>
              <div className="space-y-2">
                <label
                  htmlFor="plane-view-name"
                  className="text-sm font-medium"
                >
                  Name
                </label>
                <Input
                  id="plane-view-name"
                  value={editor.name}
                  onChange={(event) => updateEditor("name", event.target.value)}
                  autoFocus
                  disabled={editorPending}
                  placeholder="View name"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="plane-view-description"
                  className="text-sm font-medium"
                >
                  Description
                </label>
                <Input
                  id="plane-view-description"
                  value={editor.description}
                  onChange={(event) =>
                    updateEditor("description", event.target.value)
                  }
                  disabled={editorPending}
                  placeholder="Optional"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Layout</label>
                  <Select
                    value={editor.layout}
                    onValueChange={(value: "list" | "board") =>
                      updateEditor("layout", value)
                    }
                    disabled={editorPending}
                  >
                    <SelectTrigger aria-label="View layout">
                      <SelectValue />
                    </SelectTrigger>
                    <PlaneSelectContent>
                      <SelectItem value="list">List</SelectItem>
                      <SelectItem value="board">Board</SelectItem>
                    </PlaneSelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={editor.status}
                    onValueChange={(value: "open" | "done") =>
                      updateEditor("status", value)
                    }
                    disabled={editorPending}
                  >
                    <SelectTrigger aria-label="Task status">
                      <SelectValue />
                    </SelectTrigger>
                    <PlaneSelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </PlaneSelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select
                  value={editor.priority || "all"}
                  onValueChange={(value) =>
                    updateEditor(
                      "priority",
                      value === "all"
                        ? ""
                        : (value as ViewEditorState["priority"]),
                    )
                  }
                  disabled={editorPending}
                >
                  <SelectTrigger aria-label="Task priority">
                    <SelectValue />
                  </SelectTrigger>
                  <PlaneSelectContent>
                    <SelectItem value="all">All priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </PlaneSelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="plane-view-due-from"
                    className="text-sm font-medium"
                  >
                    Due from
                  </label>
                  <Input
                    id="plane-view-due-from"
                    value={editor.dueDateFrom}
                    onChange={(event) =>
                      updateEditor("dueDateFrom", event.target.value)
                    }
                    disabled={editorPending}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="plane-view-due-to"
                    className="text-sm font-medium"
                  >
                    Due to
                  </label>
                  <Input
                    id="plane-view-due-to"
                    value={editor.dueDateTo}
                    onChange={(event) =>
                      updateEditor("dueDateTo", event.target.value)
                    }
                    disabled={editorPending}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>

              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Checkbox
                  checked={editor.isDefault}
                  onCheckedChange={(checked) =>
                    updateEditor("isDefault", checked === true)
                  }
                  disabled={editorPending}
                />
                Open this view by default
              </label>

              {editorError ? (
                <p role="alert" className="text-sm text-destructive">
                  {editorError}
                </p>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditor(null)}
                  disabled={editorPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editorPending}>
                  {editorPending
                    ? "Saving..."
                    : editor.viewId
                      ? "Save changes"
                      : "Create view"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </PlaneDialogContent>
      </Dialog>

      <AlertDialog
        open={viewPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteView.isPending) setViewPendingDelete(null);
        }}
      >
        <PlaneAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this view?</AlertDialogTitle>
            <AlertDialogDescription>
              “{viewPendingDelete?.name}” will be removed from your private
              saved views. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {operationError ? (
            <p role="alert" className="text-sm text-destructive">
              {operationError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteView.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteView();
              }}
              disabled={deleteView.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteView.isPending ? "Deleting..." : "Delete view"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </PlaneAlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export const ProjectViewsClient = PlaneProjectViewsIndex;
