/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 * Directly adapted from Plane v1.3.1 ModuleCardItem.
 */

"use client";

import {
  CalendarRange,
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
import { Progress } from "@/components/ui/progress";
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

interface ModuleCardItemProps {
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

export function ModuleCardItem({
  module,
  canEdit,
  isUpdating,
  onInspect,
  onEdit,
  onDelete,
  onStatusChange,
}: ModuleCardItemProps) {
  const progress = normalizeModuleProgress(module);
  const workItemCount = moduleChildCount(module);
  const dateRange = formatModuleDateRange(
    module.start_date,
    module.finish_date,
  );

  return (
    <article className="relative flex min-h-44 flex-col justify-between gap-5 rounded-md border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="truncate text-left text-sm font-medium"
          onClick={() => onInspect(module)}
        >
          {module.name}
        </button>
        <div className="flex items-center gap-1">
          <Select
            value={module.status}
            disabled={!canEdit || isUpdating}
            onValueChange={(value) =>
              onStatusChange(module, value as TaskStatus)
            }
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-28 rounded border-border px-2 text-[11px]"
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={() => onInspect(module)}
            aria-label={`Open ${module.name} overview`}
          >
            <Info className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {workItemCount} work item{workItemCount === 1 ? "" : "s"}
          </span>
          <SquareUser className="size-4" aria-label="No lead" />
        </div>
        <div className="flex items-center gap-3">
          <Progress value={progress} className="h-1.5" />
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {progress}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => onEdit(module)}
            className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded border border-border px-2 text-[11px] text-muted-foreground disabled:cursor-default"
          >
            <CalendarRange className="size-3.5 shrink-0" />
            <span className="truncate">{dateRange}</span>
          </button>
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Actions for ${module.name}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <PlaneDropdownMenuContent align="end">
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
          ) : null}
        </div>
      </div>
    </article>
  );
}
