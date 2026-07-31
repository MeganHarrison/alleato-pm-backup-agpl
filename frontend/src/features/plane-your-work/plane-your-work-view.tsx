/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from Plane profile work-item list roots, list groups, list blocks,
 * and profile empty-state templates at revision
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 */

"use client";

import { CalendarDays, ChevronRight, UserRound } from "lucide-react";

import { StatusDot } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { TasksRow } from "@/features/tasks/task-utils";
import { cn } from "@/lib/utils";
import {
  formatPlaneTaskDate,
  isPlaneTaskDone,
  normalizePlaneTaskStatus,
  type PlaneTaskGroup,
  type PlaneYourWorkScope,
  type PlaneYourWorkStatusFilter,
} from "./plane-your-work-model";

function UnderlineTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      role="tab"
      aria-selected={active}
      className={cn(
        "relative h-11 rounded-none px-3 text-sm font-medium md:h-9",
        active ? "text-foreground" : "text-muted-foreground",
      )}
      onClick={onClick}
    >
      {children}
      <span
        className={cn(
          "absolute inset-x-2 bottom-0 h-0.5",
          active ? "bg-primary" : "bg-transparent",
        )}
        aria-hidden="true"
      />
    </Button>
  );
}

export function PlaneYourWorkScopeTabs({
  scope,
  showCompany,
  onScopeChange,
}: {
  scope: PlaneYourWorkScope;
  showCompany: boolean;
  onScopeChange: (scope: PlaneYourWorkScope) => void;
}) {
  return (
    <div className="flex items-center" role="tablist" aria-label="Task scope">
      <UnderlineTab active={scope === "mine"} onClick={() => onScopeChange("mine")}>
        My work
      </UnderlineTab>
      {showCompany ? (
        <UnderlineTab active={scope === "all"} onClick={() => onScopeChange("all")}>
          Company
        </UnderlineTab>
      ) : null}
    </div>
  );
}

export function PlaneYourWorkStatusTabs({
  filter,
  counts,
  onFilterChange,
}: {
  filter: PlaneYourWorkStatusFilter;
  counts: Record<PlaneYourWorkStatusFilter, number>;
  onFilterChange: (filter: PlaneYourWorkStatusFilter) => void;
}) {
  return (
    <div className="flex items-center" role="tablist" aria-label="Task status">
      {(["open", "done"] as const).map((value) => (
        <UnderlineTab
          key={value}
          active={filter === value}
          onClick={() => onFilterChange(value)}
        >
          <span className="capitalize">{value}</span>
          <span className="ml-1 text-xs text-muted-foreground">
            {counts[value]}
          </span>
        </UnderlineTab>
      ))}
    </div>
  );
}

export function PlaneYourWorkGroups({
  groups,
  updatingId,
  onSelect,
  onToggleDone,
}: {
  groups: PlaneTaskGroup[];
  updatingId: string | null;
  onSelect: (taskId: string) => void;
  onToggleDone: (task: TasksRow, done: boolean) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="flex min-h-72 flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="text-base font-medium text-foreground">
          No tasks found
        </div>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Clear the current search or filters to see more work.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <SectionRuleHeading
            as="h2"
            label={group.label}
            actions={
              <span className="text-xs tabular-nums text-muted-foreground">
                {group.tasks.length}
              </span>
            }
            className="sticky top-0 z-10 mb-0 min-h-9 border-b border-border/70 bg-background px-4 py-2 pb-2"
          />
          <div role="list">
            {group.tasks.map((task) => {
              const taskId = task.id;
              if (!taskId) return null;
              const done = isPlaneTaskDone(task);
              const title = task.title || task.description || "Untitled task";
              return (
                <div
                  key={taskId}
                  className="group flex min-h-16 items-center gap-3 border-b border-border/70 px-4 py-3 transition-colors hover:bg-muted/40"
                  role="listitem"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center md:size-9">
                    <Checkbox
                      checked={done}
                      disabled={updatingId === taskId}
                      aria-label={done ? `Reopen ${title}` : `Complete ${title}`}
                      onCheckedChange={(checked) =>
                        onToggleDone(task, checked === true)
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex h-auto min-h-11 min-w-0 flex-1 justify-start rounded-none p-0 text-left hover:bg-transparent"
                    onClick={() => onSelect(taskId)}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-base font-medium text-foreground md:text-sm",
                          done && "text-muted-foreground line-through",
                        )}
                      >
                        {title}
                      </span>
                      <span className="mt-1 flex min-w-0 items-center gap-3 text-sm text-muted-foreground md:hidden">
                        <StatusDot
                          status={normalizePlaneTaskStatus(task.status)}
                          className="shrink-0 capitalize"
                        />
                        <span className="truncate">
                          {task.project_name || "No project"}
                        </span>
                      </span>
                    </span>
                  </Button>
                  <div className="hidden w-28 shrink-0 md:block">
                    <StatusDot
                      status={normalizePlaneTaskStatus(task.status)}
                      className="capitalize"
                    />
                  </div>
                  <div className="hidden w-36 min-w-0 shrink-0 items-center gap-2 text-sm text-muted-foreground lg:flex">
                    <UserRound className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {task.assignee_name || task.assignee_email || "Unassigned"}
                    </span>
                  </div>
                  <div className="hidden w-32 shrink-0 items-center gap-2 text-sm text-muted-foreground xl:flex">
                    <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                    <span>{formatPlaneTaskDate(task.due_date)}</span>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-11 shrink-0 md:size-9"
                    aria-label={`Open ${title}`}
                    onClick={() => onSelect(taskId)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
