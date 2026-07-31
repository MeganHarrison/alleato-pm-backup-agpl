/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from Plane project work-item header, filter row, list block, and
 * project empty-state templates at revision
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 */

"use client";

import { CalendarDays, ChevronRight, UserRound } from "lucide-react";

import { StatusDot } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RFI } from "@/types/database-extensions";
import {
  formatPlaneRfiDate,
  formatPlaneRfiIdentifier,
  type PlaneRfiStatusFilter,
} from "./plane-rfis-model";

export function PlaneRfisStatusTabs({
  activeFilter,
  counts,
  onFilterChange,
}: {
  activeFilter: PlaneRfiStatusFilter;
  counts: Record<PlaneRfiStatusFilter, number>;
  onFilterChange: (filter: PlaneRfiStatusFilter) => void;
}) {
  const filterLabels: Record<PlaneRfiStatusFilter, string> = {
    all: "All",
    open: "Open",
    closed: "Closed",
  };

  return (
    <div
      className="flex min-w-0 items-center"
      role="tablist"
      aria-label="Filter RFIs by status"
    >
      {(["all", "open", "closed"] as const).map((filter) => (
        <Button
          key={filter}
          type="button"
          variant="ghost"
          className={cn(
            "relative h-11 min-w-16 rounded-none px-3 text-sm font-medium capitalize md:h-9",
            activeFilter === filter
              ? "text-foreground"
              : "text-muted-foreground",
          )}
          role="tab"
          aria-selected={activeFilter === filter}
          onClick={() => onFilterChange(filter)}
        >
          <span>{filterLabels[filter]}</span>
          <span className="ml-1 text-xs text-muted-foreground">
            {counts[filter]}
          </span>
          <span
            className={cn(
              "absolute inset-x-2 bottom-0 h-0.5",
              activeFilter === filter ? "bg-primary" : "bg-transparent",
            )}
            aria-hidden="true"
          />
        </Button>
      ))}
    </div>
  );
}

export function PlaneRfisList({
  rfis,
  onSelect,
}: {
  rfis: RFI[];
  onSelect: (rfiId: string) => void;
}) {
  if (rfis.length === 0) {
    return (
      <div className="flex min-h-72 flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="text-base font-medium text-foreground">No RFIs found</div>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Clear the current search or status filter to see more records.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" role="list">
      {rfis.map((rfi) => (
        <div
          key={rfi.id}
          className="group flex min-h-16 items-center gap-3 border-b border-border/70 px-4 py-3 transition-colors hover:bg-muted/40"
          role="listitem"
        >
          <Button
            type="button"
            variant="ghost"
            className="flex h-auto min-h-11 min-w-0 flex-1 justify-start gap-3 rounded-none p-0 text-left hover:bg-transparent"
            onClick={() => onSelect(rfi.id)}
          >
            <span className="w-20 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {formatPlaneRfiIdentifier(rfi.number)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium text-foreground md:text-sm">
                {rfi.subject || "Untitled RFI"}
              </span>
              <span className="mt-1 flex min-w-0 items-center gap-3 text-sm text-muted-foreground md:hidden">
                <StatusDot
                  status={rfi.status}
                  className="shrink-0 capitalize"
                />
                <span className="truncate">
                  {rfi.ball_in_court || "No ball in court"}
                </span>
              </span>
            </span>
          </Button>

          <div className="hidden w-28 shrink-0 md:block">
            <StatusDot status={rfi.status} className="capitalize" />
          </div>
          <div className="hidden w-40 min-w-0 shrink-0 items-center gap-2 text-sm text-muted-foreground lg:flex">
            <UserRound className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {rfi.ball_in_court ||
                rfi.assignees?.join(", ") ||
                "Unassigned"}
            </span>
          </div>
          <div className="hidden w-32 shrink-0 items-center gap-2 text-sm text-muted-foreground xl:flex">
            <CalendarDays className="size-4" aria-hidden="true" />
            <span>{formatPlaneRfiDate(rfi.due_date)}</span>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 shrink-0 md:size-9"
            aria-label={`Open ${formatPlaneRfiIdentifier(rfi.number)}`}
            onClick={() => onSelect(rfi.id)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
