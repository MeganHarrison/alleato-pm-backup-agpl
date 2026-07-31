/**
 * Adapted from Plane's project sidebar, project issue header, list layout,
 * list block, and quick-add templates in makeplane/plane revision
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 *
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md and /source for corresponding source information.
 */

"use client";

import {
  CalendarDays,
  ChartNoAxesGantt,
  ChevronDown,
  ChevronRight,
  Circle,
  Columns3,
  Copy,
  Ellipsis,
  Filter,
  Layers3,
  List,
  MoveRight,
  Plus,
  Table2,
  Tag,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";
import { type TasksRow } from "@/features/tasks/task-utils";
import {
  normalizePlaneWorkItemStatus,
  planeWorkItemIdentifier,
  planeWorkItemStatusLabel,
  planeWorkItemTitle,
} from "./plane-work-items-model";
import {
  PlaneWorkItemsAnalyticsDialog,
  PlaneWorkItemsDisplayMenu,
  type PlaneWorkItemDisplayProperties,
  type PlaneWorkItemStatusFilter,
} from "./plane-work-items-controls";
import { PlaneWorkspaceShell } from "./plane-workspace-shell";

type Layout = "list" | "board" | "calendar" | "spreadsheet" | "gantt";

type InitialWorkItemFilters = {
  status: PlaneWorkItemStatusFilter;
  priority: string | null;
  dueFrom: string | null;
  dueTo: string | null;
};

type PlaneWorkItemMutationFailure = {
  kind: "authentication" | "permission" | "request";
  message: string;
  retryable: boolean;
  recoveryHref?: string;
};

type PlaneWorkItemStatusMutation = {
  phase: "saving" | "error";
  requestId: number;
  previousStatus: string | null;
  targetStatus: string;
  failure?: PlaneWorkItemMutationFailure;
};

type PlaneWorkItemCreateState =
  | { phase: "idle" }
  | { phase: "saving" }
  | {
      phase: "error";
      failure: PlaneWorkItemMutationFailure;
    };

export function validatePlaneWorkItemDescription(description: string) {
  const value = description.trim();
  if (!value) return "Work item title is required.";
  if (value.length > 500) {
    return "Work item title must be 500 characters or fewer.";
  }
  return null;
}

export function classifyPlaneWorkItemMutationFailure(
  cause: unknown,
  action: "create" | "status",
): PlaneWorkItemMutationFailure {
  if (cause instanceof ApiError && cause.status === 401) {
    return {
      kind: "authentication",
      message: "Your session has expired. Sign in again to continue.",
      retryable: false,
      recoveryHref: "/auth/login",
    };
  }

  if (cause instanceof ApiError && cause.status === 403) {
    return {
      kind: "permission",
      message:
        action === "create"
          ? "You do not have permission to create work items in this project."
          : "You do not have permission to change this work item’s status.",
      retryable: false,
    };
  }

  return {
    kind: "request",
    message:
      action === "create"
        ? "The work item could not be created. Check your connection and retry."
        : "The status change could not be saved. Retry the change.",
    retryable: true,
  };
}

export type PlaneWorkItemMutationMutex = { current: boolean };

export async function runWithPlaneWorkItemMutationMutex<T>({
  mutex,
  persist,
}: {
  mutex: PlaneWorkItemMutationMutex;
  persist: () => Promise<T>;
}) {
  if (mutex.current) return { status: "busy" as const };
  mutex.current = true;
  try {
    return { status: "completed" as const, value: await persist() };
  } finally {
    mutex.current = false;
  }
}

export async function runPlaneWorkItemStatusMutation({
  task,
  targetStatus,
  requestId,
  isLatest,
  persist,
  applyStatus,
  setMutation,
}: {
  task: TasksRow;
  targetStatus: string;
  requestId: number;
  isLatest: (requestId: number) => boolean;
  persist: () => Promise<unknown>;
  applyStatus: (status: string | null) => void;
  setMutation: (mutation: PlaneWorkItemStatusMutation | null) => void;
}) {
  const previousStatus = task.status;
  applyStatus(targetStatus);
  setMutation({
    phase: "saving",
    requestId,
    previousStatus,
    targetStatus,
  });

  try {
    await persist();
    if (!isLatest(requestId)) return "stale" as const;
    setMutation(null);
    return "saved" as const;
  } catch (cause) {
    if (!isLatest(requestId)) return "stale" as const;
    applyStatus(previousStatus);
    setMutation({
      phase: "error",
      requestId,
      previousStatus,
      targetStatus,
      failure: classifyPlaneWorkItemMutationFailure(cause, "status"),
    });
    return "rejected" as const;
  }
}

export function getInitialPlaneWorkItemsLayout(
  view: string | null | undefined,
): Layout {
  return view === "board" ? "board" : "list";
}

export function getInitialPlaneWorkItemFilters(
  searchParams: Pick<URLSearchParams, "get">,
): InitialWorkItemFilters {
  const status = searchParams.get("status");
  const priority = searchParams.get("priority")?.trim().toLowerCase() || null;

  return {
    status:
      status === "open" || status === "in_progress" || status === "done"
        ? status
        : "all",
    priority:
      priority && ["low", "medium", "high", "urgent"].includes(priority)
        ? priority
        : null,
    dueFrom: searchParams.get("due_from")?.trim() || null,
    dueTo: searchParams.get("due_to")?.trim() || null,
  };
}

export function buildPlaneWorkItemsPeekHref(
  pathname: string,
  searchParams: Pick<URLSearchParams, "toString">,
  taskId: string | null,
) {
  const next = new URLSearchParams(searchParams.toString());
  if (taskId) next.set("peek", taskId);
  else next.delete("peek");
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function restorePlaneWorkItemsOrigin(
  scrollContainer: Pick<HTMLElement, "scrollTop"> | null,
  scrollTop: number,
  origin: Pick<HTMLElement, "focus"> | null,
) {
  if (scrollContainer) scrollContainer.scrollTop = scrollTop;
  origin?.focus();
}

function WorkItemMutationStatus({
  mutation,
  onRetry,
}: {
  mutation: PlaneWorkItemStatusMutation | undefined;
  onRetry: () => void;
}) {
  if (!mutation) return null;
  if (mutation.phase === "saving") {
    return (
      <span className="text-[11px] text-[#69707a]" aria-live="polite">
        Saving…
      </span>
    );
  }

  return (
    <span
      className="flex items-center gap-1 text-[11px] text-destructive"
      role="alert"
    >
      {mutation.failure?.message}
      {mutation.failure?.recoveryHref ? (
        <Button type="button" variant="ghost" size="xs" asChild>
          <a href={mutation.failure.recoveryHref}>Sign in</a>
        </Button>
      ) : mutation.failure?.retryable ? (
        <Button type="button" variant="ghost" size="xs" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </span>
  );
}

export function WorkItemStatusControl({
  task,
  mutation,
  onChange,
  onRetry,
}: {
  task: TasksRow;
  mutation: PlaneWorkItemStatusMutation | undefined;
  onChange: (status: string) => void;
  onRetry: () => void;
}) {
  const label = planeWorkItemTitle(task);

  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <select
        aria-label={`Change status for ${label}`}
        value={normalizePlaneWorkItemStatus(task.status)}
        disabled={!task.id || mutation?.phase === "saving"}
        onChange={(event) => onChange(event.target.value)}
        className="h-6 rounded border border-[#d9dce1] bg-white px-1.5 text-[11px] text-[#4f5660]"
      >
        <option value="open">Backlog</option>
        <option value="in_progress">In progress</option>
        <option value="done">Done</option>
      </select>
      <WorkItemMutationStatus mutation={mutation} onRetry={onRetry} />
    </span>
  );
}

function WorkItemDetail({
  task,
  onStatusChange,
  statusMutation,
  onRetryStatus,
  onClose,
}: {
  task: TasksRow;
  onStatusChange: (task: TasksRow, status: string) => Promise<void>;
  statusMutation: PlaneWorkItemStatusMutation | undefined;
  onRetryStatus: () => void;
  onClose: () => void;
}) {
  async function copyLink() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("peek", task.id ?? "");
      await navigator.clipboard.writeText(url.toString());
      toast.success("Work item link copied");
    } catch {
      toast.error("The work item link could not be copied.");
    }
  }

  return (
    <div className="min-h-full bg-white px-6 py-5">
      <div className="flex items-center justify-between border-b border-[#eceef0] pb-4">
        <div className="flex items-center gap-3 text-[#69707a]">
          <button type="button" onClick={onClose} aria-label="Close work item peek">
            <MoveRight className="size-4" />
          </button>
          <span className="flex items-center gap-1.5 text-xs">
            <Circle className="size-3.5" />
            Work item
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            aria-label="Copy work item link"
            className="grid size-7 place-items-center rounded border border-[#d9dce1] text-[#69707a]"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Work item actions"
            className="grid size-7 place-items-center rounded border border-[#d9dce1] text-[#69707a]"
          >
            <Ellipsis className="size-3.5" />
          </button>
        </div>
      </div>
      {/* Plane's peek title is the record heading, not an Alleato section rule. */}
      {/* eslint-disable-next-line design-system/no-raw-heading -- exact Plane-derived detail hierarchy */}
      <h2 className="mt-5 text-xl font-semibold leading-snug text-[#202124]">
        {planeWorkItemTitle(task)}
      </h2>
      <dl className="mt-7 divide-y divide-[#eceef0] text-sm">
        <div className="grid grid-cols-[110px_1fr] py-3">
          <dt className="text-[#7b8189]">Status</dt>
          <dd>
            <select
              aria-label={`Change status for ${planeWorkItemTitle(task)} in inspector`}
              value={normalizePlaneWorkItemStatus(task.status)}
              onChange={(event) => void onStatusChange(task, event.target.value)}
              disabled={statusMutation?.phase === "saving"}
              className="h-7 rounded border border-[#d9dce1] bg-white px-2 text-xs"
            >
              <option value="open">Backlog</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
            <WorkItemMutationStatus
              mutation={statusMutation}
              onRetry={onRetryStatus}
            />
          </dd>
        </div>
        <div className="grid grid-cols-[110px_1fr] py-3">
          <dt className="text-[#7b8189]">Assignee</dt>
          <dd className="text-[#30343a]">{task.assignee_name || task.assignee_email || "Unassigned"}</dd>
        </div>
        <div className="grid grid-cols-[110px_1fr] py-3">
          <dt className="text-[#7b8189]">Priority</dt>
          <dd className="capitalize text-[#30343a]">{task.priority || "None"}</dd>
        </div>
        <div className="grid grid-cols-[110px_1fr] py-3">
          <dt className="text-[#7b8189]">Due date</dt>
          <dd className="text-[#30343a]">{task.due_date || "No due date"}</dd>
        </div>
        <div className="grid grid-cols-[110px_1fr] py-3">
          <dt className="text-[#7b8189]">Source</dt>
          <dd className="text-[#30343a]">{task.source_title || task.source_system || "Manual"}</dd>
        </div>
      </dl>
    </div>
  );
}

export function WorkItemInspectorDialog({
  task,
  onStatusChange,
  statusMutation,
  onRetryStatus,
  onClose,
  onRestoreFocus,
}: {
  task: TasksRow;
  onStatusChange: (task: TasksRow, status: string) => Promise<void>;
  statusMutation: PlaneWorkItemStatusMutation | undefined;
  onRetryStatus: () => void;
  onClose: () => void;
  onRestoreFocus: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-modal="true"
        aria-describedby={undefined}
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
        className="inset-y-0 right-0 left-auto top-0 h-svh w-full max-w-xl translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-r-0 p-0"
      >
        <DialogTitle className="sr-only">
          {planeWorkItemTitle(task)}
        </DialogTitle>
        <WorkItemDetail
          task={task}
          onStatusChange={onStatusChange}
          statusMutation={statusMutation}
          onRetryStatus={onRetryStatus}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

export function PlaneWorkItemsPage({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilters = getInitialPlaneWorkItemFilters(searchParams);
  const mainRef = useRef<HTMLElement>(null);
  const inspectorOriginRef = useRef<HTMLElement | null>(null);
  const inspectorScrollTopRef = useRef(0);
  const statusRequestIdRef = useRef(0);
  const latestStatusRequestRef = useRef<Record<string, number>>({});
  const statusMutationMutexesRef = useRef<
    Record<string, PlaneWorkItemMutationMutex>
  >({});
  const createMutationMutexRef = useRef<PlaneWorkItemMutationMutex>({
    current: false,
  });
  const [items, setItems] = useState<TasksRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout>(() =>
    getInitialPlaneWorkItemsLayout(searchParams.get("view")),
  );
  const [statusFilter, setStatusFilter] =
    useState<PlaneWorkItemStatusFilter>(initialFilters.status);
  const [displayProperties, setDisplayProperties] =
    useState<PlaneWorkItemDisplayProperties>({
      assignee: true,
      dueDate: true,
      priority: true,
    });
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [createState, setCreateState] =
    useState<PlaneWorkItemCreateState>({ phase: "idle" });
  const [createValidationError, setCreateValidationError] = useState<
    string | null
  >(null);
  const [statusMutations, setStatusMutations] = useState<
    Record<string, PlaneWorkItemStatusMutation>
  >({});
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddStatus, setQuickAddStatus] = useState<
    "open" | "in_progress" | "done"
  >("open");
  const [newItem, setNewItem] = useState("");
  const [selectedTask, setSelectedTask] = useState<TasksRow | null>(null);
  const peekId = searchParams.get("peek");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ data?: TasksRow[] }>(
        `/api/tasks?project_id=${projectId}&scope=all`,
      );
      setItems(response.data ?? []);
    } catch (cause) {
      const message =
        cause instanceof ApiError
          ? cause.message
          : "The work-item list could not be loaded.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const restoreInspectorOrigin = useCallback(() => {
    window.requestAnimationFrame(() => {
      restorePlaneWorkItemsOrigin(
        mainRef.current,
        inspectorScrollTopRef.current,
        inspectorOriginRef.current,
      );
      inspectorOriginRef.current = null;
    });
  }, []);

  useEffect(() => {
    if (!peekId) {
      if (selectedTask) {
        setSelectedTask(null);
      }
      return;
    }
    const peekTask = items.find((item) => item.id === peekId);
    if (peekTask && selectedTask?.id !== peekTask.id) {
      setSelectedTask(peekTask);
    }
  }, [items, peekId, restoreInspectorOrigin, selectedTask]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const pendingStatusMutation = item.id
        ? statusMutations[item.id]
        : undefined;
      if (
        statusFilter !== "all" &&
        normalizePlaneWorkItemStatus(item.status) !== statusFilter &&
        pendingStatusMutation?.phase !== "saving"
      ) {
        return false;
      }
      if (
        initialFilters.priority &&
        item.priority?.toLowerCase() !== initialFilters.priority
      ) {
        return false;
      }
      if (
        initialFilters.dueFrom &&
        (!item.due_date || item.due_date < initialFilters.dueFrom)
      ) {
        return false;
      }
      if (
        initialFilters.dueTo &&
        (!item.due_date || item.due_date > initialFilters.dueTo)
      ) {
        return false;
      }
      return true;
    });
  }, [
    initialFilters.dueFrom,
    initialFilters.dueTo,
    initialFilters.priority,
    items,
    statusFilter,
    statusMutations,
  ]);

  function openInspector(task: TasksRow, origin: HTMLElement) {
    if (!task.id) return;
    inspectorOriginRef.current = origin;
    inspectorScrollTopRef.current = mainRef.current?.scrollTop ?? 0;
    router.push(
      buildPlaneWorkItemsPeekHref(pathname, searchParams, task.id),
      { scroll: false },
    );
  }

  function closeInspector() {
    router.replace(buildPlaneWorkItemsPeekHref(pathname, searchParams, null), {
      scroll: false,
    });
  }

  async function createItem(status = quickAddStatus) {
    const description = newItem.trim();
    const validationError = validatePlaneWorkItemDescription(newItem);
    if (validationError) {
      setCreateValidationError(validationError);
      return;
    }
    setCreateValidationError(null);
    try {
      await runWithPlaneWorkItemMutationMutex({
        mutex: createMutationMutexRef.current,
        persist: async () => {
          setCreateState({ phase: "saving" });
          await apiFetch("/api/tasks", {
            method: "POST",
            body: JSON.stringify({
              description,
              project_id: Number(projectId),
              status,
            }),
          });
          setNewItem("");
          setQuickAddOpen(false);
          setCreateState({ phase: "idle" });
          await loadItems();
          toast.success("Work item created");
        },
      });
    } catch (cause) {
      const failure = classifyPlaneWorkItemMutationFailure(cause, "create");
      setCreateState({ phase: "error", failure });
      toast.error(failure.message);
    }
  }

  function openQuickAdd(status: "open" | "in_progress" | "done" = "open") {
    if (!["list", "board"].includes(layout)) setLayout("list");
    setQuickAddStatus(status);
    setQuickAddOpen(true);
    setCreateValidationError(null);
    setCreateState({ phase: "idle" });
    window.setTimeout(() => document.getElementById("plane-new-work-item")?.focus(), 0);
  }

  const applyStatus = useCallback(
    (taskId: string, status: string | null) => {
      setItems((current) =>
        current.map((item) =>
          item.id === taskId ? { ...item, status } : item,
        ),
      );
      setSelectedTask((current) =>
        current?.id === taskId ? { ...current, status } : current,
      );
    },
    [],
  );

  async function updateStatus(task: TasksRow, status: string) {
    if (!task.id) return;
    const taskId = task.id;
    const mutex =
      statusMutationMutexesRef.current[taskId] ??
      (statusMutationMutexesRef.current[taskId] = { current: false });
    const requestId = ++statusRequestIdRef.current;
    await runWithPlaneWorkItemMutationMutex({
      mutex,
      persist: async () => {
        latestStatusRequestRef.current[taskId] = requestId;
        await runPlaneWorkItemStatusMutation({
          task,
          targetStatus: status,
          requestId,
          isLatest: (candidateRequestId) =>
            latestStatusRequestRef.current[taskId] === candidateRequestId,
          persist: () =>
            apiFetch(`/api/tasks/${taskId}`, {
              method: "PATCH",
              body: JSON.stringify({ status }),
            }),
          applyStatus: (nextStatus) => applyStatus(taskId, nextStatus),
          setMutation: (mutation) =>
            setStatusMutations((current) => {
              if (!mutation) {
                const { [taskId]: _removed, ...remaining } = current;
                return remaining;
              }
              return { ...current, [taskId]: mutation };
            }),
        });
      },
    });
  }

  function retryStatus(taskId: string) {
    const mutation = statusMutations[taskId];
    const task = items.find((item) => item.id === taskId);
    if (!mutation || !task || !mutation.failure?.retryable) return;
    void updateStatus(task, mutation.targetStatus);
  }

  return (
    <PlaneWorkspaceShell
      projectId={projectId}
      projectName={projectName}
      activeSurface="work-items"
    >
        <PlaneWorkItemsAnalyticsDialog
          items={items}
          open={analyticsOpen}
          onOpenChange={setAnalyticsOpen}
        />
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#e5e7eb] px-4">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden size-4 place-items-center rounded bg-[#eef2ff] text-[9px] text-[#4338ca] sm:grid">A</span>
            <span className="hidden max-w-[155px] truncate text-[#5e6670] sm:block">{projectName}</span>
            <ChevronRight className="hidden size-3.5 text-[#9aa0a8] sm:block" />
            <Layers3 className="size-4 text-[#5e6670]" />
            <span className="whitespace-nowrap font-medium text-[#272b31]">Work Items</span>
            <span className="rounded-full bg-[#dff1fb] px-2 py-0.5 text-[11px] text-[#27637f]">
              {filteredItems.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center rounded-md bg-[#f1f2f3] p-1 md:flex">
              <button
                type="button"
                className={cn("grid size-7 place-items-center rounded", layout === "list" && "bg-white shadow-sm")}
                onClick={() => setLayout("list")}
                aria-label="List view"
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                className={cn("grid size-7 place-items-center rounded", layout === "board" && "bg-white shadow-sm")}
                onClick={() => setLayout("board")}
                aria-label="Board view"
              >
                <Columns3 className="size-4" />
              </button>
              <button
                type="button"
                className={cn("grid size-7 place-items-center rounded", layout === "calendar" && "bg-white shadow-sm")}
                onClick={() => setLayout("calendar")}
                aria-label="Calendar view"
              >
                <CalendarDays className="size-4" />
              </button>
              <button
                type="button"
                className={cn("grid size-7 place-items-center rounded", layout === "spreadsheet" && "bg-white shadow-sm")}
                onClick={() => setLayout("spreadsheet")}
                aria-label="Spreadsheet view"
              >
                <Table2 className="size-4" />
              </button>
              <button
                type="button"
                className={cn("grid size-7 place-items-center rounded", layout === "gantt" && "bg-white shadow-sm")}
                onClick={() => setLayout("gantt")}
                aria-label="Gantt view"
              >
                <ChartNoAxesGantt className="size-4" />
              </button>
            </div>
            <button
              type="button"
              className={cn(
                "hidden h-7 items-center gap-1.5 rounded border border-[#d9dce1] px-2.5 text-xs md:flex",
                statusFilter !== "all" && "border-[#93c5d8] bg-[#eaf5fa]",
              )}
              aria-label={`Filter work items: ${
                statusFilter === "all"
                  ? "All"
                  : planeWorkItemStatusLabel(statusFilter)
              }`}
              title="Cycle status filter"
              onClick={() =>
                setStatusFilter((current) => {
                  if (current === "all") return "open";
                  if (current === "open") return "in_progress";
                  if (current === "in_progress") return "done";
                  return "all";
                })
              }
            >
              <Filter className="size-3.5" />
            </button>
            <PlaneWorkItemsDisplayMenu
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              properties={displayProperties}
              onPropertyChange={(property, checked) =>
                setDisplayProperties((current) => ({
                  ...current,
                  [property]: checked,
                }))
              }
              trigger={
                <button type="button" className="hidden h-7 items-center gap-1 rounded border border-[#d9dce1] px-3 text-xs sm:flex">
                  Display
                  <ChevronDown className="size-3" />
                </button>
              }
            />
            <button
              type="button"
              className="hidden h-7 rounded border border-[#d9dce1] px-3 text-xs lg:block"
              onClick={() => setAnalyticsOpen(true)}
            >
              Analytics
            </button>
            <button
              type="button"
              className="h-7 rounded bg-[#075985] px-3 text-xs font-medium text-white hover:bg-[#064e6e]"
              onClick={() => openQuickAdd()}
            >
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add work item</span>
            </button>
          </div>
        </div>

        <div className="flex h-10 shrink-0 items-center border-b border-[#e5e7eb] bg-white md:hidden">
          <div className="flex flex-1 items-center justify-center gap-3">
            <button type="button" onClick={() => setLayout("list")} aria-label="Mobile list view">
              <List className={cn("size-4", layout === "list" ? "text-[#202124]" : "text-[#9aa0a8]")} />
            </button>
            <button type="button" onClick={() => setLayout("board")} aria-label="Mobile board view">
              <Columns3 className={cn("size-4", layout === "board" ? "text-[#202124]" : "text-[#9aa0a8]")} />
            </button>
            <button type="button" onClick={() => setLayout("calendar")} aria-label="Mobile calendar view">
              <CalendarDays className={cn("size-4", layout === "calendar" ? "text-[#202124]" : "text-[#9aa0a8]")} />
            </button>
          </div>
          <PlaneWorkItemsDisplayMenu
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            properties={displayProperties}
            onPropertyChange={(property, checked) =>
              setDisplayProperties((current) => ({
                ...current,
                [property]: checked,
              }))
            }
            trigger={
              <button
                type="button"
                className="flex h-full flex-1 items-center justify-center border-l border-[#e5e7eb] text-xs text-[#59616b]"
              >
                Display
                <ChevronDown className="ml-1.5 size-3.5" />
              </button>
            }
          />
          <button
            type="button"
            className="flex h-full flex-1 items-center justify-center border-l border-[#e5e7eb] text-xs text-[#59616b]"
            onClick={() => setAnalyticsOpen(true)}
          >
            Analytics
          </button>
        </div>

        <main ref={mainRef} className="min-h-0 flex-1 overflow-auto">
          <div className="flex h-11 items-center justify-between border-b border-[#e5e7eb] px-5">
            <div className="flex items-center gap-2">
              <Circle className="size-3.5 stroke-[1.5]" />
              <span className="text-sm font-medium">All work items</span>
              <span className="text-xs text-[#7b8189]">{filteredItems.length}</span>
            </div>
            <Plus className="size-4 text-[#616872]" />
          </div>

          {error && (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-medium">Work items could not be loaded</p>
              <p className="mt-1 text-xs text-[#7b8189]">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadItems()}>
                Try again
              </Button>
            </div>
          )}

          {loading && !error && (
            <div className="divide-y divide-[#eceef0]" role="status">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-11 animate-pulse bg-[#fafafa]" />
              ))}
            </div>
          )}

          {!loading && !error && layout === "list" && (
            <div className="divide-y divide-[#e9ebed]">
              {filteredItems.map((item, index) => (
                <div
                  key={item.id ?? index}
                  className="group flex min-h-11 w-full items-center gap-3 px-5 text-left text-[13px] hover:bg-[#f7f8f9]"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
                    onClick={(event) =>
                      openInspector(item, event.currentTarget)
                    }
                  >
                    <span className="w-[92px] shrink-0 text-[11px] text-[#7b8189]">
                      {planeWorkItemIdentifier(item, index)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-[#282c31]">
                      {planeWorkItemTitle(item)}
                    </span>
                  </button>
                  <WorkItemStatusControl
                    task={item}
                    mutation={item.id ? statusMutations[item.id] : undefined}
                    onChange={(status) => void updateStatus(item, status)}
                    onRetry={() => {
                      if (item.id) retryStatus(item.id);
                    }}
                  />
                  {displayProperties.assignee && (
                    <span className="hidden text-[11px] text-[#7b8189] md:block">
                      {item.assignee_name || item.assignee_email || "Unassigned"}
                    </span>
                  )}
                  {displayProperties.dueDate && item.due_date && (
                    <span className="hidden text-[11px] text-[#7b8189] lg:block">{item.due_date}</span>
                  )}
                  {displayProperties.priority && item.priority && (
                    <Tag className="hidden size-3.5 text-[#7b8189] lg:block" />
                  )}
                  <Ellipsis className="size-4 shrink-0 text-[#7b8189] opacity-0 group-hover:opacity-100" />
                </div>
              ))}
              {quickAddOpen ? (
                <div className="min-h-11 px-5 py-1">
                  <div className="flex items-center gap-2">
                    <Plus className="size-3.5 text-[#59616b]" />
                    <Input
                      id="plane-new-work-item"
                      value={newItem}
                      onChange={(event) => {
                        setNewItem(event.target.value);
                        setCreateValidationError(null);
                        if (createState.phase === "error") {
                          setCreateState({ phase: "idle" });
                        }
                      }}
                      onBlur={() => {
                        if (
                          !newItem.trim() &&
                          !createValidationError &&
                          createState.phase === "idle"
                        ) {
                          setQuickAddOpen(false);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void createItem();
                        if (
                          event.key === "Escape" &&
                          createState.phase !== "saving"
                        ) {
                          setNewItem("");
                          setQuickAddOpen(false);
                        }
                      }}
                      placeholder="New work item"
                      disabled={createState.phase === "saving"}
                      aria-invalid={Boolean(createValidationError)}
                      aria-describedby="plane-new-work-item-feedback"
                      className="h-8 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <div
                    id="plane-new-work-item-feedback"
                    className="pl-5 text-[11px]"
                  >
                    {createState.phase === "saving" ? (
                      <span className="text-[#69707a]" aria-live="polite">
                        Saving…
                      </span>
                    ) : null}
                    {createValidationError ? (
                      <span className="text-destructive" role="alert">
                        {createValidationError}
                      </span>
                    ) : null}
                    {createState.phase === "error" ? (
                      <span
                        className="flex items-center gap-1 text-destructive"
                        role="alert"
                      >
                        {createState.failure.message}
                        {createState.failure.recoveryHref ? (
                          <Button type="button" variant="ghost" size="xs" asChild>
                            <a href={createState.failure.recoveryHref}>Sign in</a>
                          </Button>
                        ) : createState.failure.retryable ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => void createItem()}
                          >
                            Retry
                          </Button>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openQuickAdd()}
                  className="flex h-11 w-full items-center gap-2 px-5 text-left text-[13px] text-[#59616b] hover:bg-[#f7f8f9]"
                >
                  <Plus className="size-3.5" />
                  New work item
                </button>
              )}
            </div>
          )}

          {!loading && !error && layout === "board" && (
            <div className="grid min-h-full min-w-[780px] grid-cols-3 gap-3 bg-[#f7f8f9] p-3">
              {(["open", "in_progress", "done"] as const).map((status) => {
                const statusItems = filteredItems.filter(
                  (item) => normalizePlaneWorkItemStatus(item.status) === status,
                );
                return (
                  <section
                    key={status}
                    className="min-w-0"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const taskId = event.dataTransfer.getData("text/plain");
                      const task = items.find((item) => item.id === taskId);
                      if (
                        task &&
                        !statusMutations[taskId] &&
                        normalizePlaneWorkItemStatus(task.status) !== status
                      ) {
                        void updateStatus(task, status);
                      }
                    }}
                  >
                    <div className="flex h-9 items-center justify-between px-1 text-xs font-medium text-[#555d66]">
                      <span>{status === "open" ? "Backlog" : status === "in_progress" ? "In progress" : "Done"}</span>
                      <span>{statusItems.length}</span>
                    </div>
                    <div className="space-y-2">
                      {statusItems.map((item) => (
                        <div
                          key={item.id}
                          draggable={
                            Boolean(item.id) &&
                            !Boolean(item.id && statusMutations[item.id])
                          }
                          onDragStart={(event) => {
                            if (item.id && !statusMutations[item.id]) {
                              event.dataTransfer.setData("text/plain", item.id);
                            } else {
                              event.preventDefault();
                            }
                          }}
                          className="w-full rounded-md border border-[#dfe2e5] bg-white p-3 text-left hover:border-[#c9cdd2]"
                        >
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={(event) =>
                              openInspector(item, event.currentTarget)
                            }
                          >
                            <span className="mb-2 block text-[10px] text-[#7b8189]">
                              {planeWorkItemIdentifier(item, items.indexOf(item))}
                            </span>
                            <span className="block text-[13px] font-medium leading-snug">
                              {planeWorkItemTitle(item)}
                            </span>
                            <span className="mt-3 flex items-center justify-between text-[11px] text-[#7b8189]">
                              {displayProperties.assignee && (
                                <span>{item.assignee_name || "Unassigned"}</span>
                              )}
                              <span className="flex items-center gap-2">
                                {displayProperties.dueDate && item.due_date && <span>{item.due_date}</span>}
                                {displayProperties.priority && item.priority && <Tag className="size-3.5" />}
                              </span>
                            </span>
                          </button>
                          <div className="mt-2">
                            <WorkItemStatusControl
                              task={item}
                              mutation={
                                item.id ? statusMutations[item.id] : undefined
                              }
                              onChange={(nextStatus) =>
                                void updateStatus(item, nextStatus)
                              }
                              onRetry={() => {
                                if (item.id) retryStatus(item.id);
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      {quickAddOpen && quickAddStatus === status ? (
                        <div className="rounded-md border border-[#dfe2e5] bg-white p-2">
                          <Input
                            id="plane-new-work-item"
                            value={newItem}
                            onChange={(event) => {
                              setNewItem(event.target.value);
                              setCreateValidationError(null);
                              if (createState.phase === "error") {
                                setCreateState({ phase: "idle" });
                              }
                            }}
                            onBlur={() => {
                              if (
                                !newItem.trim() &&
                                !createValidationError &&
                                createState.phase === "idle"
                              ) {
                                setQuickAddOpen(false);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void createItem(status);
                              if (
                                event.key === "Escape" &&
                                createState.phase !== "saving"
                              ) {
                                setNewItem("");
                                setQuickAddOpen(false);
                              }
                            }}
                            placeholder="Work item title"
                            disabled={createState.phase === "saving"}
                            aria-invalid={Boolean(createValidationError)}
                            aria-describedby="plane-new-work-item-feedback"
                            className="h-8 text-xs"
                          />
                          <div
                            id="plane-new-work-item-feedback"
                            className="mt-1 text-[11px]"
                          >
                            {createState.phase === "saving" ? (
                              <span
                                className="text-[#69707a]"
                                aria-live="polite"
                              >
                                Saving…
                              </span>
                            ) : null}
                            {createValidationError ? (
                              <span className="text-destructive" role="alert">
                                {createValidationError}
                              </span>
                            ) : null}
                            {createState.phase === "error" ? (
                              <span
                                className="flex items-center gap-1 text-destructive"
                                role="alert"
                              >
                                {createState.failure.message}
                                {createState.failure.recoveryHref ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    asChild
                                  >
                                    <a href={createState.failure.recoveryHref}>
                                      Sign in
                                    </a>
                                  </Button>
                                ) : createState.failure.retryable ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => void createItem(status)}
                                  >
                                    Retry
                                  </Button>
                                ) : null}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openQuickAdd(status)}
                          className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-xs text-[#69707a] hover:bg-white"
                        >
                          <Plus className="size-3.5" />
                          New work item
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {!loading && !error && layout === "calendar" && (
            <div className="grid min-w-[760px] grid-cols-7 divide-x divide-[#e5e7eb] border-b border-[#e5e7eb]">
              {Array.from({ length: 7 }, (_, offset) => {
                const date = new Date();
                date.setDate(date.getDate() + offset);
                const isoDate = date.toISOString().slice(0, 10);
                const dayItems = filteredItems.filter((item) => item.due_date === isoDate);
                return (
                  <section key={isoDate} className="min-h-[520px] bg-white">
                    <div className="border-b border-[#e5e7eb] px-3 py-2 text-xs text-[#69707a]">
                      <span className="block font-medium text-[#30343a]">
                        {date.toLocaleDateString(undefined, { weekday: "short" })}
                      </span>
                      {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                    <div className="space-y-1.5 p-2">
                      {dayItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(event) =>
                            openInspector(item, event.currentTarget)
                          }
                          className="w-full rounded border border-[#dfe2e5] bg-[#f7f8f9] p-2 text-left text-[11px] leading-snug"
                        >
                          {planeWorkItemTitle(item)}
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {!loading && !error && layout === "spreadsheet" && (
            <div className="min-w-[860px] text-xs">
              <div className="grid h-9 grid-cols-[110px_minmax(320px,1fr)_140px_180px_120px] items-center border-b border-[#dfe2e5] bg-[#f7f8f9] px-5 font-medium text-[#59616b]">
                <span>ID</span>
                <span>Work item</span>
                <span>Status</span>
                <span>Assignee</span>
                <span>Due date</span>
              </div>
              {filteredItems.map((item, index) => (
                <button
                  key={item.id ?? index}
                  type="button"
                  onClick={(event) =>
                    openInspector(item, event.currentTarget)
                  }
                  className="grid min-h-10 w-full grid-cols-[110px_minmax(320px,1fr)_140px_180px_120px] items-center border-b border-[#eceef0] px-5 text-left hover:bg-[#f7f8f9]"
                >
                  <span className="text-[#7b8189]">{planeWorkItemIdentifier(item, index)}</span>
                  <span className="truncate font-medium">{planeWorkItemTitle(item)}</span>
                  <span>{planeWorkItemStatusLabel(item.status)}</span>
                  <span className="truncate">{item.assignee_name || item.assignee_email || "Unassigned"}</span>
                  <span>{item.due_date || "—"}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && !error && layout === "gantt" && (
            <div className="min-w-[900px] bg-white">
              <div className="grid h-9 grid-cols-[320px_1fr] items-center border-b border-[#dfe2e5] bg-[#f7f8f9] px-5 text-xs font-medium text-[#59616b]">
                <span>Work item</span>
                <span>Timeline</span>
              </div>
              {filteredItems.map((item, index) => {
                const due = item.due_date ? new Date(item.due_date) : null;
                const offset = due && !Number.isNaN(due.getTime())
                  ? Math.max(0, Math.min(90, (due.getDate() / 31) * 90))
                  : 4;
                return (
                  <button
                    key={item.id ?? index}
                    type="button"
                    onClick={(event) =>
                      openInspector(item, event.currentTarget)
                    }
                    className="grid min-h-11 w-full grid-cols-[320px_1fr] items-center border-b border-[#eceef0] px-5 text-left text-xs hover:bg-[#f7f8f9]"
                  >
                    <span className="truncate pr-5">{planeWorkItemTitle(item)}</span>
                    <span className="relative h-5 rounded bg-[#f1f2f3]">
                      <span
                        className="absolute top-1 h-3 min-w-8 rounded bg-[#93c5d8]"
                        style={{ left: `${offset}%`, width: "8%" }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </main>

      {selectedTask ? (
        <WorkItemInspectorDialog
          task={selectedTask}
          onStatusChange={updateStatus}
          statusMutation={
            selectedTask.id ? statusMutations[selectedTask.id] : undefined
          }
          onRetryStatus={() => {
            if (selectedTask.id) retryStatus(selectedTask.id);
          }}
          onClose={closeInspector}
          onRestoreFocus={restoreInspectorOrigin}
        />
      ) : null}
    </PlaneWorkspaceShell>
  );
}
