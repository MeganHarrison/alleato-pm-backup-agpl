/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Derived from Plane's work-item filter and ordering popovers at
 * makeplane/plane v1.3.1. Adapted to Alleato task fields and URL state.
 * See LICENSES/NOTICE-PLANE.md and /source for corresponding source information.
 */

"use client";

import { ArrowDownAZ, Filter, X } from "lucide-react";

import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

import {
  type PlaneWorkItemDueFilter,
  type PlaneWorkItemPriority,
  type PlaneWorkItemsQuery,
  type PlaneWorkItemSort,
  type PlaneWorkItemStatus,
} from "./work-items-query";

export interface PlaneWorkItemAssigneeOption {
  value: string;
  label: string;
}

const STATUS_OPTIONS: ReadonlyArray<{
  value: PlaneWorkItemStatus;
  label: string;
}> = [
  { value: "open", label: "Backlog" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: ReadonlyArray<{
  value: PlaneWorkItemPriority;
  label: string;
}> = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "No priority" },
];

const DUE_OPTIONS: ReadonlyArray<{
  value: PlaneWorkItemDueFilter;
  label: string;
}> = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "none", label: "No due date" },
];

const SORT_OPTIONS: ReadonlyArray<{
  value: PlaneWorkItemSort;
  label: string;
}> = [
  { value: "manual", label: "Manual" },
  { value: "created", label: "Created date" },
  { value: "updated", label: "Updated date" },
  { value: "due_date", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "title", label: "Title" },
];

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function FilterSection<T extends string>({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  values: T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-1.5 text-xs text-foreground hover:bg-muted"
        >
          <Checkbox
            checked={values.includes(option.value)}
            onCheckedChange={() => onChange(toggleValue(values, option.value))}
            aria-label={`${label}: ${option.label}`}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function countPlaneWorkItemFilters(query: PlaneWorkItemsQuery): number {
  return (
    (query.search ? 1 : 0) +
    query.statuses.length +
    query.assignees.length +
    query.priorities.length +
    query.due.length +
    (query.dueFrom ? 1 : 0) +
    (query.dueTo ? 1 : 0) +
    (query.sort !== "manual" ? 1 : 0)
  );
}

export function PlaneWorkItemsQueryControls({
  query,
  assignees,
  onChange,
  className,
}: {
  query: PlaneWorkItemsQuery;
  assignees: PlaneWorkItemAssigneeOption[];
  onChange: (patch: Partial<PlaneWorkItemsQuery>) => void;
  className?: string;
}) {
  const activeCount = countPlaneWorkItemFilters(query);
  const assigneeOptions = [
    { value: "unassigned", label: "Unassigned" },
    ...assignees,
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className={cn(
            "h-7 rounded border-[#d9dce1] px-2.5 font-normal",
            activeCount > 0 && "border-[#93c5d8] bg-[#eaf5fa]",
            className,
          )}
          aria-label={`Filter and sort work items${activeCount ? `, ${activeCount} active` : ""}`}
        >
          <Filter className="size-3.5" />
          {activeCount > 0 ? (
            <span className="text-[10px] font-medium">{activeCount}</span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-160 w-88 max-w-[calc(100vw-1rem)] overflow-y-auto p-3"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">
            Filter work items
          </p>
          {activeCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-7 px-2 text-[11px]"
              onClick={() =>
                onChange({
                  search: "",
                  statuses: [],
                  assignees: [],
                  priorities: [],
                  due: [],
                  dueFrom: null,
                  dueTo: null,
                  sort: "manual",
                  direction: "asc",
                })
              }
            >
              <X className="size-3" />
              Clear
            </Button>
          ) : null}
        </div>

        <ExpandableSearch
          value={query.search}
          onChange={(search) => onChange({ search })}
          placeholder="Search work items..."
          ariaLabel="Search work items"
          collapsible={false}
          className="mt-2 w-full"
          inputClassName="text-xs"
        />

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3">
          <FilterSection
            label="State"
            options={STATUS_OPTIONS}
            values={query.statuses}
            onChange={(statuses) => onChange({ statuses })}
          />
          <FilterSection
            label="Priority"
            options={PRIORITY_OPTIONS}
            values={query.priorities}
            onChange={(priorities) => onChange({ priorities })}
          />
          <FilterSection
            label="Due date"
            options={DUE_OPTIONS}
            values={query.due}
            onChange={(due) => onChange({ due })}
          />
          <FilterSection
            label="Assignee"
            options={assigneeOptions}
            values={query.assignees}
            onChange={(selectedAssignees) =>
              onChange({ assignees: selectedAssignees })
            }
          />
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 border-t border-border pt-3">
          <Select
            value={query.sort}
            onValueChange={(sort: PlaneWorkItemSort) => onChange({ sort })}
          >
            <SelectTrigger size="sm" className="h-8 text-xs">
              <span className="flex items-center gap-2">
                <ArrowDownAZ className="size-3.5" />
                <SelectValue placeholder="Sort work items" />
              </span>
            </SelectTrigger>
            <SelectContent align="end">
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 min-w-20 text-xs font-normal"
            onClick={() =>
              onChange({
                direction: query.direction === "asc" ? "desc" : "asc",
              })
            }
            aria-label={`Sort ${query.direction === "asc" ? "descending" : "ascending"}`}
          >
            {query.direction === "asc" ? "Ascending" : "Descending"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
