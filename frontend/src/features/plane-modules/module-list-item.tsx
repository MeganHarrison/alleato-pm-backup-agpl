/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 * Directly adapted from Plane v1.3.1 ModuleListItem, ListItem, and
 * ModuleListItemAction templates.
 */

"use client";

import {
  CalendarRange,
  Check,
  Info,
  MoreHorizontal,
  Pencil,
  SquareUser,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlaneDropdownMenuContent,
  PlaneSelectContent,
} from "@/features/plane-work-items/plane-overlay";
import type { ScheduleTaskWithHierarchy, TaskStatus } from "@/types/scheduling";

import {
  formatModuleDateRange,
  MODULE_STATUS_LABELS,
  moduleChildCount,
  normalizeModuleProgress,
} from "./module-model";

interface ModuleListItemProps {
  module: ScheduleTaskWithHierarchy;
  canEdit: boolean;
  isUpdating: boolean;
  onInspect: (module: ScheduleTaskWithHierarchy) => void;
  onEdit: (module: ScheduleTaskWithHierarchy) => void;
  onDelete: (module: ScheduleTaskWithHierarchy) => void;
  onStatusChange: (
    module: ScheduleTaskWithHierarchy,
    status: TaskStatus,
  ) => void;
}

export function ModuleProgressRing({
  progress,
  size = 30,
}: {
  progress: number;
  size?: number;
}) {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      aria-label={`${progress}% complete`}
    >
      <svg
        viewBox="0 0 30 30"
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="15"
          cy="15"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-muted"
        />
        <circle
          cx="15"
          cy="15"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-[stroke-dashoffset]"
        />
      </svg>
      {progress === 100 ? (
        <Check className="size-3 text-primary" />
      ) : (
        <span className="text-[9px] leading-none text-muted-foreground">
          {progress}%
        </span>
      )}
    </span>
  );
}

function ModuleActions({
  module,
  onEdit,
  onDelete,
}: Pick<ModuleListItemProps, "module" | "onEdit" | "onDelete">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={`Actions for ${module.name}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <PlaneDropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => onEdit(module)}>
          <Pencil />
          Edit module
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => onDelete(module)}
        >
          <Trash2 />
          Delete module
        </DropdownMenuItem>
      </PlaneDropdownMenuContent>
    </DropdownMenu>
  );
}

export function ModuleListItem({
  module,
  canEdit,
  isUpdating,
  onInspect,
  onEdit,
  onDelete,
  onStatusChange,
}: ModuleListItemProps) {
  const progress = normalizeModuleProgress(module);
  const workItemCount = moduleChildCount(module);
  const dateRange = formatModuleDateRange(
    module.start_date,
    module.finish_date,
  );

  return (
    <div className="group relative flex min-h-[52px] w-full flex-col items-center justify-between gap-3 border-b border-border bg-background px-4 py-4 text-[13px] hover:bg-muted/40 lg:flex-row lg:gap-5 lg:py-0">
      <div className="relative flex w-full min-w-0 items-center justify-between gap-3">
        <button
          type="button"
          className="relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-left"
          onClick={() => onInspect(module)}
        >
          <ModuleProgressRing progress={progress} />
          <span className="truncate">{module.name}</span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
          onClick={() => onInspect(module)}
          aria-label={`Open ${module.name} overview`}
        >
          <Info className="size-4" />
        </Button>
      </div>

      <div className="relative flex w-full shrink-0 flex-wrap items-center justify-start gap-4 lg:w-auto lg:flex-nowrap">
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => onEdit(module)}
          className="flex h-7 min-w-40 items-center gap-1.5 rounded border border-border px-2 text-[11px] text-muted-foreground disabled:cursor-default"
        >
          <CalendarRange className="size-3.5" />
          <span className="max-w-40 truncate">{dateRange}</span>
        </button>

        <Select
          value={module.status}
          disabled={!canEdit || isUpdating}
          onValueChange={(value) => onStatusChange(module, value as TaskStatus)}
        >
          <SelectTrigger
            size="sm"
            className="h-7 w-32 rounded border-border px-2 text-[11px]"
            aria-label={`Status for ${module.name}`}
          >
            <SelectValue />
          </SelectTrigger>
          <PlaneSelectContent align="end">
            {Object.entries(MODULE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </PlaneSelectContent>
        </Select>

        <span
          className="grid size-7 place-items-center text-muted-foreground"
          title="No lead"
        >
          <SquareUser className="size-4" />
        </span>
        <span className="min-w-16 text-[11px] text-muted-foreground lg:hidden">
          {workItemCount} work item{workItemCount === 1 ? "" : "s"}
        </span>
        {canEdit ? (
          <ModuleActions module={module} onEdit={onEdit} onDelete={onDelete} />
        ) : null}
      </div>
    </div>
  );
}
