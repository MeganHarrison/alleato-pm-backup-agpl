/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from Plane profile work-item list roots, list groups, list blocks,
 * peek behavior, and profile empty-state templates at revision
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 * Alleato's canonical Tasks APIs, authorization, create dialog, and task
 * adapters remain the data and behavior owners.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckSquare2, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

import { StatusDot } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { NewTaskDialog } from "@/features/tasks/new-task-dialog";
import {
  getTaskSourceLabel,
  getTaskSourceTarget,
  getTaskSourceTitle,
  type TasksRow,
} from "@/features/tasks/task-utils";
import {
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
} from "@/features/tasks/task-values";
import { buildPlaneWorkItemsHref } from "@/features/plane-work-items-contracts/work-items-query";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import { apiFetch } from "@/lib/api-client";
import { getErrorDetail } from "@/lib/format-error";
import { appToast as toast } from "@/lib/toast/app-toast";
import {
  filterPlaneYourWorkTasks,
  formatPlaneTaskDate,
  groupPlaneTasksByProject,
  isPlaneTaskDone,
  normalizePlaneTaskStatus,
  type PlaneYourWorkScope,
  type PlaneYourWorkStatusFilter,
} from "./plane-your-work-model";
import {
  PlaneYourWorkGroups,
  PlaneYourWorkScopeTabs,
  PlaneYourWorkStatusTabs,
} from "./plane-your-work-view";

type TaskPatch = {
  status?: string;
  due_date?: string | null;
  project_id?: number | null;
  priority?: string | null;
  assignee_person_id?: string | null;
};

type ProjectOption = {
  id: number;
  name: string | null;
  project_number?: string | null;
  "job number"?: string | null;
};

type UserOption = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  person_id?: string | null;
};

function DetailProperty({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-4 border-b border-border/60 py-2 text-sm">
      <div className="w-28 shrink-0 text-muted-foreground">{label}</div>
      <div className="min-w-0 flex-1 text-foreground">{children}</div>
    </div>
  );
}

function displayTaskTitle(task: TasksRow): string {
  return task.title || task.description || "Untitled task";
}

function projectLabel(project: ProjectOption): string {
  const number = project.project_number ?? project["job number"] ?? null;
  const name = project.name ?? `Project ${project.id}`;
  return number ? `${number} - ${name}` : name;
}

function parseTaskDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function PlaneTaskDueDatePicker({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedDate = parseTaskDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          className="h-9 w-full max-w-56 justify-start border-transparent px-3 font-normal shadow-none"
          aria-label="Task due date"
        >
          {selectedDate ? format(selectedDate, "MMM d, yyyy") : "No due date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : null);
            setOpen(false);
          }}
        />
        {selectedDate ? (
          <div className="border-t px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start px-2 text-xs"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Clear due date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function PlaneYourWorkDetail({
  task,
  projects,
  users,
  updating,
  deleting,
  detailError,
  onRetryDetail,
  onUpdate,
  onDelete,
}: {
  task: TasksRow;
  projects: ProjectOption[];
  users: UserOption[];
  updating: boolean;
  deleting: boolean;
  detailError: Error | null;
  onRetryDetail: () => void;
  onUpdate: (patch: TaskPatch, localPatch?: Partial<TasksRow>) => void;
  onDelete: () => void;
}) {
  const taskId = task.id;
  const projectId = task.project_id ?? task.project_ids?.[0] ?? null;
  const sourceTarget = getTaskSourceTarget(
    task,
    projectId === null ? null : String(projectId),
  );
  const sourceTitle = getTaskSourceTitle(task);
  const sourceLabel = getTaskSourceLabel(task);

  return (
    <>
      <SheetHeader className="pb-4">
        <div className="pr-8 text-xs font-medium text-muted-foreground">
          {task.project_name || "No project"}
        </div>
        <SheetTitle className="pr-8 text-lg leading-6">
          {displayTaskTitle(task)}
        </SheetTitle>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
        {task.description && task.description !== task.title ? (
          <p className="border-b border-border/60 py-5 text-base leading-7 text-foreground">
            {task.description}
          </p>
        ) : null}

        {detailError ? (
          <div className="border-b border-border/60 py-4">
            <p className="text-sm font-medium text-foreground">
              Task details could not load
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {getErrorDetail(detailError)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onRetryDetail}
            >
              Retry
            </Button>
          </div>
        ) : null}

        <div className="pt-2">
          <DetailProperty label="Status">
            <Select
              value={normalizePlaneTaskStatus(task.status)}
              disabled={updating}
              onValueChange={(status) => onUpdate({ status }, { status })}
            >
              <SelectTrigger
                className="h-9 w-full max-w-56 border-transparent shadow-none"
                aria-label="Task status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUS_VALUES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailProperty>
          <DetailProperty label="Priority">
            <Select
              value={task.priority?.toLowerCase() || "__none__"}
              disabled={updating}
              onValueChange={(value) =>
                onUpdate(
                  { priority: value === "__none__" ? null : value },
                  { priority: value === "__none__" ? null : value },
                )
              }
            >
              <SelectTrigger
                className="h-9 w-full max-w-56 border-transparent shadow-none"
                aria-label="Task priority"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No priority</SelectItem>
                {TASK_PRIORITY_VALUES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailProperty>
          <DetailProperty label="Due date">
            <PlaneTaskDueDatePicker
              value={task.due_date}
              disabled={updating}
              onChange={(value) =>
                onUpdate({ due_date: value }, { due_date: value })
              }
            />
          </DetailProperty>
          <DetailProperty label="Project">
            <Select
              value={projectId === null ? "__none__" : String(projectId)}
              disabled={updating}
              onValueChange={(value) => {
                const nextProjectId =
                  value === "__none__" ? null : Number(value);
                const project = projects.find(
                  (candidate) => candidate.id === nextProjectId,
                );
                onUpdate(
                  { project_id: nextProjectId },
                  {
                    project_id: nextProjectId,
                    project_ids: nextProjectId === null ? [] : [nextProjectId],
                    project_name: project?.name ?? null,
                  },
                );
              }}
            >
              <SelectTrigger
                className="h-9 w-full max-w-72 border-transparent shadow-none"
                aria-label="Task project"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {projectLabel(project)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailProperty>
          <DetailProperty label="Assignee">
            <Select
              value={task.assignee_person_id ?? "__unassigned__"}
              disabled={updating}
              onValueChange={(value) => {
                const personId = value === "__unassigned__" ? null : value;
                const user = users.find(
                  (candidate) => candidate.person_id === personId,
                );
                onUpdate(
                  { assignee_person_id: personId },
                  {
                    assignee_person_id: personId,
                    assignee_name: user?.full_name ?? null,
                    assignee_email: user?.email ?? null,
                  },
                );
              }}
            >
              <SelectTrigger
                className="h-9 w-full max-w-72 border-transparent shadow-none"
                aria-label="Task assignee"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {users
                  .filter((user) => user.person_id)
                  .map((user) => (
                    <SelectItem key={user.id} value={user.person_id as string}>
                      {user.full_name || user.email || "Unnamed user"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </DetailProperty>
          <DetailProperty label="Created">
            {task.created_at ? formatPlaneTaskDate(task.created_at) : "Not set"}
          </DetailProperty>
          <DetailProperty label="Source">
            {sourceTarget ? (
              <a
                href={sourceTarget.href}
                target={sourceTarget.external ? "_blank" : undefined}
                rel={sourceTarget.external ? "noreferrer" : undefined}
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                {sourceTitle}
                <ArrowRight className="size-4" />
              </a>
            ) : (
              <span>{sourceLabel}</span>
            )}
          </DetailProperty>
        </div>

        {task.source_context ? (
          <section className="pt-5">
            <SectionRuleHeading as="h3" label="Source context" />
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {task.source_context}
            </p>
          </section>
        ) : null}
      </div>

      <SheetFooter>
        <Button
          type="button"
          variant="ghost"
          className="mr-auto text-destructive hover:text-destructive"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
        {projectId !== null ? (
          <Button asChild variant="outline">
            <Link href={buildPlaneWorkItemsHref(projectId, { peekId: taskId })}>
              Open work item
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : null}
      </SheetFooter>
    </>
  );
}

export function PlaneYourWorkSurface() {
  const { profile } = useCurrentUserProfile();
  const isAdmin = profile?.isAdmin === true;
  const [scope, setScope] = React.useState<PlaneYourWorkScope>("mine");
  const [statusFilter, setStatusFilter] =
    React.useState<PlaneYourWorkStatusFilter>("open");
  const [projectFilter, setProjectFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [tasks, setTasks] = React.useState<TasksRow[]>([]);
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [users, setUsers] = React.useState<UserOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = React.useState<
    TasksRow | null | undefined
  >(undefined);
  const [detailError, setDetailError] = React.useState<Error | null>(null);
  const [detailReload, setDetailReload] = React.useState(0);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const loadTasks = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<{ data?: TasksRow[] }>(
        `/api/tasks?scope=${scope}`,
        { cache: "no-store" },
      );
      setTasks(payload.data ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError
          : new Error("An unexpected task loading error occurred."),
      );
    } finally {
      setLoading(false);
    }
  }, [scope]);

  React.useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  React.useEffect(() => {
    if (!isAdmin && scope === "all") setScope("mine");
  }, [isAdmin, scope]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      try {
        const [projectPayload, userPayload] = await Promise.all([
          apiFetch<{ data?: ProjectOption[] }>(
            "/api/projects?limit=250&archived=false",
            { cache: "no-store" },
          ),
          apiFetch<{ users?: UserOption[] }>("/api/users", {
            cache: "no-store",
          }),
        ]);
        if (!cancelled) {
          setProjects(projectPayload.data ?? []);
          setUsers(userPayload.users ?? []);
        }
      } catch (optionsError) {
        console.error(
          "[plane-your-work] Failed to load task project or assignee options",
          optionsError,
        );
        if (!cancelled) {
          toast.error("Task editing options could not load", {
            description:
              "Project and assignee choices may be unavailable until the page is refreshed.",
          });
        }
      }
    }
    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(undefined);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setSelectedDetail(undefined);
    setDetailError(null);
    apiFetch<{ task: TasksRow }>(`/api/tasks/${selectedId}`, {
      cache: "no-store",
    })
      .then((payload) => {
        if (!cancelled) setSelectedDetail(payload.task);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setSelectedDetail(null);
          setDetailError(
            loadError instanceof Error
              ? loadError
              : new Error("An unexpected task detail error occurred."),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [detailReload, selectedId]);

  const counts = React.useMemo(
    () => ({
      open: tasks.filter((task) => !isPlaneTaskDone(task)).length,
      done: tasks.filter(isPlaneTaskDone).length,
    }),
    [tasks],
  );
  const filteredTasks = React.useMemo(
    () => filterPlaneYourWorkTasks(tasks, statusFilter, projectFilter, query),
    [projectFilter, query, statusFilter, tasks],
  );
  const groups = React.useMemo(
    () => groupPlaneTasksByProject(filteredTasks),
    [filteredTasks],
  );
  const selectedTask =
    selectedDetail ?? tasks.find((task) => task.id === selectedId) ?? null;

  async function updateTask(
    taskId: string,
    patch: TaskPatch,
    localPatch: Partial<TasksRow> = patch,
  ) {
    setUpdatingId(taskId);
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, ...localPatch } : task,
        ),
      );
      setSelectedDetail((current) =>
        current?.id === taskId ? { ...current, ...localPatch } : current,
      );
      toast.success("Task updated");
    } catch (updateError) {
      console.error(
        `[plane-your-work] Failed to update task ${taskId} fields ${Object.keys(patch).join(",")}`,
        updateError,
      );
      toast.error("Could not update task", {
        description: "The task change did not save.",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteTask() {
    if (!selectedId) return;
    setDeletingId(selectedId);
    try {
      await apiFetch(`/api/tasks/${selectedId}`, { method: "DELETE" });
      setTasks((current) => current.filter((task) => task.id !== selectedId));
      setDeleteOpen(false);
      setSelectedId(null);
      toast.success("Task deleted");
    } catch (deleteError) {
      console.error(
        `[plane-your-work] Failed to delete task ${selectedId}`,
        deleteError,
      );
      toast.error("Could not delete task", {
        description: "The task remains in Your Work.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col bg-background"
      data-plane-your-work-surface
    >
      <div className="flex min-h-12 shrink-0 items-center gap-3 border-b border-border/70 px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <CheckSquare2
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <h1 className="truncate text-base font-semibold text-foreground">
            Your Work
          </h1>
          {tasks.length > 0 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {tasks.length}
            </span>
          ) : null}
        </div>
        <NewTaskDialog
          projects={projects}
          users={users}
          onCreated={() => void loadTasks()}
          trigger={
            <Button type="button" className="ml-auto h-11 md:h-8">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add Task</span>
              <span className="sm:hidden">Add</span>
            </Button>
          }
        />
      </div>

      <div className="flex shrink-0 flex-col border-b border-border/70">
        <div className="flex items-center justify-between overflow-x-auto">
          <PlaneYourWorkScopeTabs
            scope={scope}
            showCompany={isAdmin}
            onScopeChange={(nextScope) => {
              setScope(nextScope);
              setSelectedId(null);
            }}
          />
          <PlaneYourWorkStatusTabs
            filter={statusFilter}
            counts={counts}
            onFilterChange={setStatusFilter}
          />
        </div>
        <div className="flex flex-col gap-3 px-3 pb-3 md:flex-row md:items-center md:justify-end md:px-4">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger
              className="h-11 w-full md:h-8 md:w-56"
              aria-label="Filter tasks by project"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              <SelectItem value="unscoped">No project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {projectLabel(project)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ExpandableSearch
            value={query}
            onChange={setQuery}
            placeholder="Search your work"
            ariaLabel="Search your work"
            defaultExpanded
            collapsible={false}
            className="w-full md:w-64"
            inputClassName="h-11 md:h-8"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-1 p-4" aria-label="Loading your work">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex min-h-72 flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="text-base font-medium text-foreground">
            Your work could not load
          </div>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {getErrorDetail(error)}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void loadTasks()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <PlaneYourWorkGroups
          groups={groups}
          updatingId={updatingId}
          onSelect={setSelectedId}
          onToggleDone={(task, done) => {
            if (!task.id) return;
            void updateTask(
              task.id,
              { status: done ? "done" : "open" },
              { status: done ? "done" : "open" },
            );
          }}
        />
      )}

      <Sheet
        open={selectedTask !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent className="gap-0 p-0 sm:max-w-2xl">
          {selectedTask ? (
            <PlaneYourWorkDetail
              task={selectedTask}
              projects={projects}
              users={users}
              updating={updatingId === selectedTask.id}
              deleting={deletingId === selectedTask.id}
              detailError={detailError}
              onRetryDetail={() => setDetailReload((value) => value + 1)}
              onUpdate={(patch, localPatch) => {
                if (selectedTask.id) {
                  void updateTask(selectedTask.id, patch, localPatch);
                }
              }}
              onDelete={() => setDeleteOpen(true)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void deleteTask();
              }}
            >
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
