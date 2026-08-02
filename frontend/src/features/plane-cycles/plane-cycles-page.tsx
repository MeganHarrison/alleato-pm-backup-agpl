/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Directly derived from the Cycles list route and components in makeplane/plane
 * commit 39856932cd6b9bd17eab0920506d628190b47af2:
 * - cycles/(list)/{page,layout,header,mobile-header}.tsx
 * - core/components/cycles/{cycles-view,cycles-view-header}.tsx
 * - core/components/cycles/list/{root,cycle-list-group-header,cycles-list-item}.tsx
 * - core/components/cycles/active-cycle/{root,progress,productivity,cycle-stats}.tsx
 *
 * Plane's MobX stores and Propel primitives are adapted to Alleato's existing
 * project shell, schedule adapter, permissions, and shared UI primitives.
 * See /NOTICE-PLANE.md and /source for corresponding source information.
 */

"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  Circle,
  Ellipsis,
  Grid2X2,
  LayoutList,
  ListFilter,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { ErrorState } from "@/components/ds";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PlaneDialogContent,
  PlaneDropdownMenuContent,
} from "@/features/plane-work-items/plane-overlay";
import {
  hasModulePermission,
  useProjectPermissions,
} from "@/hooks/use-project-permissions";
import { useProjectShell } from "@/hooks/use-project-shell";
import { useScheduleTasks } from "@/hooks/use-schedule-tasks";
import { apiFetch } from "@/lib/api-client";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";
import type { ScheduleTaskWithHierarchy, TaskStatus } from "@/types/scheduling";

import { CycleFormModal, type CycleFormValue } from "./cycle-form-modal";
import {
  canMutateCycles,
  countCycleWork,
  cycleDescendants,
  cycleGroup,
  cycleProgress,
  dateRangesOverlap,
  durationDays,
  type CycleGroup,
} from "./cycle-model";

const GROUPS: ReadonlyArray<{
  id: CycleGroup;
  label: string;
}> = [
  { id: "current", label: "Active cycle" },
  { id: "upcoming", label: "Upcoming cycles" },
  { id: "completed", label: "Completed cycles" },
];

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function dateRange(cycle: ScheduleTaskWithHierarchy) {
  if (!cycle.start_date || !cycle.finish_date) return "Dates not set";
  return `${formatDate(cycle.start_date)} – ${formatDate(cycle.finish_date)}`;
}

function statusLabel(status: TaskStatus) {
  if (status === "complete") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

function CycleProgressRing({ value }: { value: number }) {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  return (
    <span
      className="relative grid size-[30px] shrink-0 place-items-center"
      aria-label={`${value}% complete`}
    >
      <svg
        className="size-[30px] -rotate-90"
        viewBox="0 0 30 30"
        aria-hidden="true"
      >
        <circle
          cx="15"
          cy="15"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="3"
        />
        <circle
          cx="15"
          cy="15"
          r={radius}
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (value / 100) * circumference}
        />
      </svg>
      <span className="absolute text-[9px] font-medium text-[#202124]">
        {value === 100 ? <Check className="size-3" /> : `${value}%`}
      </span>
    </span>
  );
}

function CycleRow({
  cycle,
  canWrite,
  onEdit,
  onDelete,
  onComplete,
}: {
  cycle: ScheduleTaskWithHierarchy;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
}) {
  const progress = cycleProgress(cycle);
  return (
    <div className="group flex min-h-[52px] w-full flex-col items-start justify-between gap-3 border-b border-[#e5e7eb] bg-white px-4 py-3 text-[13px] hover:bg-[#fafafa] lg:flex-row lg:items-center lg:gap-5 lg:py-0">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <CycleProgressRing value={progress} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[#202124]">
            {cycle.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#858b93] lg:hidden">
            <CalendarDays className="size-3" />
            {dateRange(cycle)}
          </p>
        </div>
      </div>
      <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:justify-end">
        <span className="hidden min-w-36 items-center gap-1.5 text-xs text-[#69707a] lg:flex">
          <CalendarDays className="size-3.5" />
          {dateRange(cycle)}
        </span>
        <span className="text-xs text-[#69707a]">
          {countCycleWork(cycle)} work items
        </span>
        <span className="hidden min-w-20 text-xs text-[#69707a] sm:block">
          {statusLabel(cycle.status)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="grid size-11 place-items-center rounded text-[#69707a] hover:bg-[#f1f2f3] lg:size-8"
              aria-label={`Actions for ${cycle.name}`}
            >
              <Ellipsis className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <PlaneDropdownMenuContent align="end" className="w-44">
            {canWrite ? (
              <>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                {cycle.status !== "complete" ? (
                  <DropdownMenuItem onClick={onComplete}>
                    <Check className="size-4" />
                    Mark complete
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem disabled>Read-only access</DropdownMenuItem>
            )}
          </PlaneDropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function GroupHeader({
  group,
  count,
  open,
  onToggle,
}: {
  group: CycleGroup;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="sticky top-0 z-[2] flex min-h-11 w-full shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-[#fafbfc] px-4 py-2.5 text-left"
    >
      <span className="flex min-w-0 items-center gap-5">
        <span
          className={cn(
            "grid size-5 place-items-center rounded",
            group === "current" && "bg-blue-50 text-blue-600",
            group === "upcoming" && "bg-amber-50 text-amber-600",
            group === "completed" && "bg-emerald-50 text-emerald-600",
          )}
        >
          {group === "completed" ? (
            <Check className="size-3.5" />
          ) : (
            <Circle className="size-3.5" />
          )}
        </span>
        <span className="truncate text-[13px] font-medium text-[#202124]">
          {GROUPS.find((item) => item.id === group)?.label}
          <span className="pl-2 text-xs font-medium text-[#858b93]">
            {count}
          </span>
        </span>
      </span>
      <ChevronDown
        className={cn(
          "size-4 text-[#858b93] transition-transform",
          open && "rotate-180",
        )}
      />
    </button>
  );
}

function ActiveCycleAnalytics({ cycle }: { cycle: ScheduleTaskWithHierarchy }) {
  const items = cycleDescendants(cycle);
  const completed = items.filter(
    (item) => item.status === "complete" || (item.percent_complete ?? 0) >= 100,
  ).length;
  const started = items.filter(
    (item) =>
      item.status !== "complete" &&
      (item.status === "in_progress" || (item.percent_complete ?? 0) > 0),
  ).length;
  const unstarted = Math.max(0, items.length - completed - started);
  const progress = cycleProgress(cycle);

  return (
    <div className="border-b border-[#e5e7eb] bg-white px-4 pb-6 pt-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <section className="min-h-64 rounded-lg border border-[#e5e7eb] bg-white px-3.5 py-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-[#59616b]">Progress</h3>
            <span className="text-xs text-[#858b93]">
              {completed}/{items.length} work items closed
            </span>
          </div>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-[#f1f2f3]">
            <span
              className="bg-[#22c55e]"
              style={{
                width: `${items.length ? (completed / items.length) * 100 : 0}%`,
              }}
            />
            <span
              className="bg-[#f59e0b]"
              style={{
                width: `${items.length ? (started / items.length) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="mt-6 space-y-4 text-[13px]">
            {[
              ["Completed", completed, "#22c55e"],
              ["Started", started, "#f59e0b"],
              ["Unstarted", unstarted, "#94a3b8"],
            ].map(([label, count, color]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-[#59616b]">
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: String(color) }}
                  />
                  {label}
                </span>
                <span className="text-[#59616b]">
                  {String(count)} work items
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="min-h-64 rounded-lg border border-[#e5e7eb] bg-white px-3.5 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#59616b]">
              Work item burndown
            </h3>
            <span className="text-xs text-[#858b93]">{progress}% complete</span>
          </div>
          <div className="mt-6 h-40 rounded bg-[#fafbfc] p-4">
            <svg
              viewBox="0 0 300 120"
              className="h-full w-full"
              role="img"
              aria-label={`${progress}% cycle burndown`}
            >
              <line
                x1="10"
                y1="15"
                x2="290"
                y2="105"
                stroke="#cbd5e1"
                strokeDasharray="4 4"
              />
              <polyline
                points={`10,15 92,${35 + progress * 0.15} 190,${48 + progress * 0.35} 290,${105 - progress * 0.2}`}
                fill="none"
                stroke="#2563eb"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <circle cx="290" cy={105 - progress * 0.2} r="4" fill="#2563eb" />
            </svg>
          </div>
          <p className="mt-3 text-xs text-[#858b93]">
            Pending work items: {Math.max(0, items.length - completed)}
          </p>
        </section>

        <section className="min-h-64 rounded-lg border border-[#e5e7eb] bg-white p-4 lg:col-span-2 xl:col-span-1">
          <div className="grid grid-cols-3 rounded border border-[#e5e7eb] bg-[#fafbfc] p-0.5 text-center text-[11px] font-semibold text-[#858b93]">
            <span className="rounded bg-white py-1.5 text-[#59616b]">
              Priority work
            </span>
            <span className="py-1.5">Assignees</span>
            <span className="py-1.5">Labels</span>
          </div>
          <div className="mt-3 space-y-1">
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex min-h-8 items-center justify-between gap-3 rounded px-1.5 text-[13px] hover:bg-[#f5f6f7]"
              >
                <span className="truncate text-[#202124]">{item.name}</span>
                <span className="shrink-0 text-xs text-[#858b93]">
                  {statusLabel(item.status)}
                </span>
              </div>
            ))}
            {items.length === 0 ? (
              <div className="grid h-36 place-items-center text-center text-xs text-[#858b93]">
                No work items in this cycle yet
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function CycleSection({
  group,
  cycles,
  canWrite,
  onEdit,
  onDelete,
  onComplete,
}: {
  group: CycleGroup;
  cycles: ScheduleTaskWithHierarchy[];
  canWrite: boolean;
  onEdit: (cycle: ScheduleTaskWithHierarchy) => void;
  onDelete: (cycle: ScheduleTaskWithHierarchy) => void;
  onComplete: (cycle: ScheduleTaskWithHierarchy) => void;
}) {
  const [open, setOpen] = useState(group !== "completed");
  return (
    <section className="flex shrink-0 flex-col">
      <GroupHeader
        group={group}
        count={cycles.length}
        open={open}
        onToggle={() => setOpen((value) => !value)}
      />
      {open ? (
        <>
          {cycles.map((cycle) => (
            <div key={cycle.id}>
              <CycleRow
                cycle={cycle}
                canWrite={canWrite}
                onEdit={() => onEdit(cycle)}
                onDelete={() => onDelete(cycle)}
                onComplete={() => onComplete(cycle)}
              />
              {group === "current" ? (
                <ActiveCycleAnalytics cycle={cycle} />
              ) : null}
            </div>
          ))}
          {cycles.length === 0 ? (
            <div className="grid min-h-28 place-items-center border-b border-[#e5e7eb] px-4 text-center text-[13px] text-[#858b93]">
              No {group === "current" ? "active" : group} cycles
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function DeleteCycleDialog({
  cycle,
  submitting,
  error,
  onOpenChange,
  onConfirm,
}: {
  cycle: ScheduleTaskWithHierarchy | null;
  submitting: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog open={Boolean(cycle)} onOpenChange={onOpenChange}>
      <PlaneDialogContent>
        <DialogHeader>
          <DialogTitle>Delete cycle</DialogTitle>
          <DialogDescription>
            Delete {cycle?.name ?? "this cycle"}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={submitting}
          >
            {submitting ? "Deleting" : "Delete cycle"}
          </Button>
        </DialogFooter>
      </PlaneDialogContent>
    </Dialog>
  );
}

export function PlaneCyclesPage({
  projectId,
  allowMutations = false,
}: {
  projectId: string;
  allowMutations?: boolean;
}) {
  const numericProjectId = Number.parseInt(projectId, 10);
  const shell = useProjectShell(
    Number.isNaN(numericProjectId) ? null : numericProjectId,
  );
  const permissionState = useProjectPermissions(
    Number.isNaN(numericProjectId) ? null : numericProjectId,
  );
  const { data, error, isLoading, refetch } = useScheduleTasks({ projectId });
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<Set<CycleGroup>>(() => new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingCycle, setEditingCycle] =
    useState<ScheduleTaskWithHierarchy | null>(null);
  const [deletingCycle, setDeletingCycle] =
    useState<ScheduleTaskWithHierarchy | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const canWrite = canMutateCycles({
    allowMutations,
    permissionsLoading: permissionState.isLoading,
    hasWritePermission: hasModulePermission(
      permissionState.permissions,
      "schedule",
      "write",
    ),
  });

  const groupedCycles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const grouped: Record<CycleGroup, ScheduleTaskWithHierarchy[]> = {
      current: [],
      upcoming: [],
      completed: [],
    };
    for (const cycle of data?.tasks ?? []) {
      const group = cycleGroup(cycle, today);
      if (filters.size > 0 && !filters.has(group)) continue;
      if (
        normalizedQuery &&
        !cycle.name.toLowerCase().includes(normalizedQuery)
      )
        continue;
      grouped[group].push(cycle);
    }
    return grouped;
  }, [data?.tasks, filters, query, today]);

  const totalCycles = data?.tasks.length ?? 0;
  const visibleCount = Object.values(groupedCycles).reduce(
    (sum, cycles) => sum + cycles.length,
    0,
  );

  function openCreate() {
    if (!canWrite) return;
    setEditingCycle(null);
    setMutationError(null);
    setFormOpen(true);
  }

  function openEdit(cycle: ScheduleTaskWithHierarchy) {
    if (!canWrite) return;
    setEditingCycle(cycle);
    setMutationError(null);
    setFormOpen(true);
  }

  function toggleFilter(group: CycleGroup) {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  async function saveCycle(value: CycleFormValue) {
    if (!canWrite) return;
    setSubmitting(true);
    setMutationError(null);
    const overlap =
      value.startDate && value.finishDate
        ? (data?.tasks ?? []).find(
            (cycle) =>
              cycle.id !== editingCycle?.id &&
              cycle.start_date &&
              cycle.finish_date &&
              dateRangesOverlap(
                value.startDate!,
                value.finishDate!,
                cycle.start_date,
                cycle.finish_date,
              ),
          )
        : undefined;
    if (overlap) {
      setMutationError(`These dates overlap ${overlap.name}.`);
      setSubmitting(false);
      return;
    }
    const payload = {
      name: value.name,
      parent_task_id: null,
      start_date: value.startDate,
      finish_date: value.finishDate,
      duration_days:
        value.startDate && value.finishDate
          ? durationDays(value.startDate, value.finishDate)
          : null,
      status: editingCycle?.status ?? "not_started",
      percent_complete: editingCycle?.percent_complete ?? 0,
      is_milestone: false,
    };
    try {
      await apiFetch(
        editingCycle
          ? `/api/projects/${projectId}/scheduling/tasks/${editingCycle.id}`
          : `/api/projects/${projectId}/scheduling/tasks`,
        {
          method: editingCycle ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      await refetch();
      setFormOpen(false);
      setEditingCycle(null);
      toast.success(editingCycle ? "Cycle updated" : "Cycle created");
    } catch (cause) {
      setMutationError(
        cause instanceof Error
          ? cause.message
          : "The cycle could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function markComplete(cycle: ScheduleTaskWithHierarchy) {
    if (!canWrite) return;
    setSubmitting(true);
    try {
      await apiFetch(
        `/api/projects/${projectId}/scheduling/tasks/${cycle.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ status: "complete", percent_complete: 100 }),
        },
      );
      await refetch();
      toast.success("Cycle completed");
    } catch (cause) {
      console.error("Cycle completion failed", cause);
      toast.error("Cycle could not be completed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCycle() {
    if (!canWrite || !deletingCycle) return;
    setSubmitting(true);
    setMutationError(null);
    try {
      await apiFetch(
        `/api/projects/${projectId}/scheduling/tasks/${deletingCycle.id}`,
        { method: "DELETE" },
      );
      await refetch();
      setDeletingCycle(null);
      toast.success("Cycle deleted");
    } catch (cause) {
      setMutationError(
        cause instanceof Error
          ? cause.message
          : "The cycle could not be deleted.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-white text-[#202124]">
        <header className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-[#e5e7eb] px-3">
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            <span className="hidden truncate text-[#69707a] sm:inline">
              {shell.data?.project.name ?? `Project ${projectId}`}
            </span>
            <ChevronDown className="hidden size-3 rotate-[-90deg] text-[#9aa0a6] sm:block" />
            <span className="flex min-w-0 items-center gap-2 font-medium text-[#202124]">
              <Circle className="size-4 text-[#69707a]" />
              Cycles
              <span className="text-xs font-normal text-[#858b93]">
                {totalCycles}
              </span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {searchOpen ? (
              <div className="flex h-8 w-40 items-center gap-2 rounded-md border border-[#d9dce1] bg-white px-2.5 text-[#858b93] sm:w-64">
                <Search className="size-3.5" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    if (query) setQuery("");
                    else setSearchOpen(false);
                  }}
                  placeholder="Search"
                  aria-label="Search cycles"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-[#202124] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSearchOpen(false);
                  }}
                  aria-label="Close search"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="grid size-9 place-items-center rounded hover:bg-[#f1f2f3]"
                aria-label="Search cycles"
              >
                <Search className="size-4" />
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative grid size-9 place-items-center rounded hover:bg-[#f1f2f3]",
                    filters.size > 0 && "bg-[#eef2ff] text-[#2563eb]",
                  )}
                  aria-label={`Filter cycles${filters.size ? `, ${filters.size} applied` : ""}`}
                >
                  <ListFilter className="size-4" />
                  {filters.size > 0 ? (
                    <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-[#2563eb]" />
                  ) : null}
                </button>
              </DropdownMenuTrigger>
              <PlaneDropdownMenuContent align="end" className="w-48">
                {GROUPS.map((group) => (
                  <DropdownMenuCheckboxItem
                    key={group.id}
                    checked={filters.has(group.id)}
                    onCheckedChange={() => toggleFilter(group.id)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {group.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {filters.size > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFilters(new Set())}>
                      Clear filters
                    </DropdownMenuItem>
                  </>
                ) : null}
              </PlaneDropdownMenuContent>
            </DropdownMenu>

            {canWrite ? (
              <Button
                size="sm"
                onClick={openCreate}
                className="h-8 bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Add cycle</span>
                <span className="sm:hidden">Add</span>
              </Button>
            ) : null}
          </div>
        </header>

        <div className="flex min-h-10 shrink-0 items-center justify-center border-b border-[#e5e7eb] bg-white py-2 text-[13px] text-[#69707a] sm:hidden">
          <LayoutList className="mr-2 size-4" />
          Layout
          <ChevronDown className="ml-1 size-3.5" />
        </div>

        {filters.size > 0 ? (
          <div className="flex min-h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-[#e5e7eb] px-4 text-xs">
            <span className="shrink-0 text-[#858b93]">Filters</span>
            {[...filters].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => toggleFilter(filter)}
                className="flex shrink-0 items-center gap-1 rounded bg-[#f1f2f3] px-2 py-1 text-[#59616b]"
              >
                {GROUPS.find((group) => group.id === filter)?.label}
                <X className="size-3" />
              </button>
            ))}
          </div>
        ) : null}

        <main className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {(shell.error || error) && (
            <ErrorState
              title="Cycles could not be loaded"
              error={
                error ??
                (shell.error instanceof Error
                  ? shell.error
                  : "Project access could not be verified.")
              }
              onRetry={() => void refetch()}
            />
          )}

          {isLoading && !error ? (
            <div className="divide-y divide-[#e5e7eb]" role="status">
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="h-14 animate-pulse bg-[#fafbfc]" />
              ))}
            </div>
          ) : null}

          {!isLoading && !error && totalCycles === 0 ? (
            <div className="grid h-full min-h-80 place-items-center px-6 py-12 text-center">
              <div>
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#f1f5f9]">
                  <Circle className="size-7 text-[#64748b]" />
                </span>
                <h2 className="mt-5 text-base font-medium text-[#202124]">
                  Plan work in cycles
                </h2>
                <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-[#858b93]">
                  Create time-boxed cycles to focus the project team on the work
                  that matters now.
                </p>
                {canWrite ? (
                  <Button className="mt-5" size="sm" onClick={openCreate}>
                    <Plus className="size-4" />
                    Add cycle
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {!isLoading && !error && totalCycles > 0 && visibleCount === 0 ? (
            <div className="grid min-h-80 place-items-center px-6 text-center">
              <div>
                <Grid2X2 className="mx-auto size-8 text-[#9aa0a6]" />
                <p className="mt-4 text-sm font-medium">No matching cycles</p>
                <button
                  type="button"
                  className="mt-2 text-[13px] text-[#2563eb] hover:underline"
                  onClick={() => {
                    setQuery("");
                    setFilters(new Set());
                  }}
                >
                  Clear search and filters
                </button>
              </div>
            </div>
          ) : null}

          {!isLoading && !error && visibleCount > 0
            ? GROUPS.map((group) => (
                <CycleSection
                  key={group.id}
                  group={group.id}
                  cycles={groupedCycles[group.id]}
                  canWrite={canWrite}
                  onEdit={openEdit}
                  onDelete={(cycle) => {
                    setMutationError(null);
                    setDeletingCycle(cycle);
                  }}
                  onComplete={(cycle) => void markComplete(cycle)}
                />
              ))
            : null}
        </main>
      </div>

      {canWrite ? (
        <>
          <CycleFormModal
            cycle={editingCycle}
            open={formOpen}
            submitting={submitting}
            error={mutationError}
            onOpenChange={(open) => {
              if (submitting) return;
              setFormOpen(open);
              if (!open) {
                setEditingCycle(null);
                setMutationError(null);
              }
            }}
            onSubmit={saveCycle}
          />

          <DeleteCycleDialog
            cycle={deletingCycle}
            submitting={submitting}
            error={mutationError}
            onOpenChange={(open) => {
              if (submitting) return;
              if (!open) {
                setDeletingCycle(null);
                setMutationError(null);
              }
            }}
            onConfirm={deleteCycle}
          />
        </>
      ) : null}
    </>
  );
}
