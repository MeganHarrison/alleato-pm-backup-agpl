/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted directly from Plane's project Work Items display filters and
 * analytics modal at revision 39856932cd6b9bd17eab0920506d628190b47af2.
 */

"use client";

import { cloneElement, type ReactElement, useEffect, useState } from "react";
import { X } from "lucide-react";

import type { TasksRow } from "@/features/tasks/task-utils";
import { cn } from "@/lib/utils";

import {
  normalizePlaneWorkItemStatus,
  planeWorkItemStatusLabel,
} from "./plane-work-items-model";

export type PlaneWorkItemStatusFilter =
  | "all"
  | "open"
  | "in_progress"
  | "done";

export type PlaneWorkItemDisplayProperties = {
  assignee: boolean;
  dueDate: boolean;
  priority: boolean;
};

export function summarizePlaneWorkItems(items: TasksRow[]) {
  const status = {
    open: 0,
    in_progress: 0,
    done: 0,
  };
  let unassigned = 0;
  let overdue = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  items.forEach((item) => {
    status[normalizePlaneWorkItemStatus(item.status)] += 1;
    if (!item.assignee_name && !item.assignee_email) unassigned += 1;
    if (item.due_date) {
      const dueDate = new Date(`${item.due_date}T00:00:00`);
      if (!Number.isNaN(dueDate.getTime()) && dueDate < today) overdue += 1;
    }
  });

  return { status, total: items.length, unassigned, overdue };
}

export function PlaneWorkItemsDisplayMenu({
  trigger,
  statusFilter,
  onStatusFilterChange,
  properties,
  onPropertyChange,
}: {
  trigger: ReactElement;
  statusFilter: PlaneWorkItemStatusFilter;
  onStatusFilterChange: (value: PlaneWorkItemStatusFilter) => void;
  properties: PlaneWorkItemDisplayProperties;
  onPropertyChange: (
    property: keyof PlaneWorkItemDisplayProperties,
    checked: boolean,
  ) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className="relative">
      {cloneElement(trigger, {
        onClick: () => setOpen((current) => !current),
        "aria-expanded": open,
        "aria-haspopup": "menu",
      } as never)}
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[5] cursor-default"
            aria-label="Close display options"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            aria-label="Display work items"
            className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-[#d9dce1] bg-white p-1 text-[13px] shadow-lg"
          >
            <div className="px-2 py-1.5 text-xs font-medium">Display</div>
            <div className="my-1 border-t border-[#eceef0]" />
            <div className="px-2 py-1 text-[11px] text-[#7b8189]">
              Work item state
            </div>
            {(["all", "open", "in_progress", "done"] as const).map(
              (status) => (
                <label
                  key={status}
                  className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 hover:bg-[#f1f2f3]"
                >
                  <input
                    type="radio"
                    name="plane-work-item-state"
                    checked={statusFilter === status}
                    onChange={() => onStatusFilterChange(status)}
                  />
                  {status === "all"
                    ? "All work items"
                    : planeWorkItemStatusLabel(status)}
                </label>
              ),
            )}
            <div className="my-1 border-t border-[#eceef0]" />
            <div className="px-2 py-1 text-[11px] text-[#7b8189]">
              Properties
            </div>
            {(
              [
                ["assignee", "Assignee"],
                ["dueDate", "Due date"],
                ["priority", "Priority"],
              ] as const
            ).map(([property, label]) => (
              <label
                key={property}
                className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 hover:bg-[#f1f2f3]"
              >
                <input
                  type="checkbox"
                  checked={properties[property]}
                  onChange={(event) =>
                    onPropertyChange(property, event.target.checked)
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function PlaneWorkItemsAnalyticsDialog({
  items,
  open,
  onOpenChange,
}: {
  items: TasksRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const summary = summarizePlaneWorkItems(items);
  const maxStatusCount = Math.max(
    1,
    summary.status.open,
    summary.status.in_progress,
    summary.status.done,
  );

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onOpenChange, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close work item analytics"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plane-work-item-analytics-title"
        className="absolute left-1/2 top-1/2 grid w-[min(640px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border bg-white shadow-lg"
      >
        <div className="relative border-b px-6 py-5">
          <h2
            id="plane-work-item-analytics-title"
            className="text-lg font-semibold"
          >
            Work item analytics
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Current distribution for this project.
          </p>
          <button
            type="button"
            className="absolute right-4 top-4 grid size-8 place-items-center rounded hover:bg-muted"
            onClick={() => onOpenChange(false)}
            aria-label="Close work item analytics"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-6 px-6 py-5">
          <section>
            <h3 className="text-sm font-medium">Work items by state</h3>
            <div className="mt-4 space-y-3">
              {(["open", "in_progress", "done"] as const).map((status) => (
                <div
                  key={status}
                  className="grid grid-cols-[96px_1fr_32px] items-center gap-3 text-xs"
                >
                  <span className="text-muted-foreground">
                    {planeWorkItemStatusLabel(status)}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn(
                        "block h-full rounded-full bg-[#075985]",
                        summary.status[status] === 0 && "min-w-0",
                      )}
                      style={{
                        width: `${(summary.status[status] / maxStatusCount) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="text-right font-medium">
                    {summary.status[status]}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <dl className="divide-y border-y text-sm">
            <div className="flex items-center justify-between py-3">
              <dt className="text-muted-foreground">Total work items</dt>
              <dd className="font-medium">{summary.total}</dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-muted-foreground">Unassigned</dt>
              <dd className="font-medium">{summary.unassigned}</dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-muted-foreground">Overdue</dt>
              <dd className="font-medium">{summary.overdue}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
