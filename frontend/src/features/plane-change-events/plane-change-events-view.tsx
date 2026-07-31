/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from Plane project work-item header, filter row, list block, and
 * project empty-state templates at revision
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 */

"use client";

import { ChevronRight, CircleDollarSign } from "lucide-react";

import { StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/features/change-events/change-events-table-config";
import { cn } from "@/lib/utils";
import type { ChangeEvent } from "@/types/change-events";
import {
  formatPlaneChangeEventIdentifier,
  type PlaneChangeEventDataTab,
} from "./plane-change-events-model";

const TAB_LABELS: Record<PlaneChangeEventDataTab, string> = {
  all: "All",
  line_items: "Line Items",
  no_line_items: "No Line Items",
  rfqs: "RFQs",
};

export function PlaneChangeEventsTabs({
  activeTab,
  counts,
  onTabChange,
}: {
  activeTab: PlaneChangeEventDataTab;
  counts: Record<PlaneChangeEventDataTab, number>;
  onTabChange: (tab: PlaneChangeEventDataTab) => void;
}) {
  return (
    <div
      className="flex min-w-max items-center"
      role="tablist"
      aria-label="Filter change events"
    >
      {(Object.keys(TAB_LABELS) as PlaneChangeEventDataTab[]).map((tab) => (
        <Button
          key={tab}
          type="button"
          variant="ghost"
          className={cn(
            "relative h-11 rounded-none px-3 text-sm font-medium md:h-9",
            activeTab === tab ? "text-foreground" : "text-muted-foreground",
          )}
          role="tab"
          aria-selected={activeTab === tab}
          onClick={() => onTabChange(tab)}
        >
          <span>{TAB_LABELS[tab]}</span>
          <span className="ml-1 text-xs text-muted-foreground">
            {counts[tab]}
          </span>
          <span
            className={cn(
              "absolute inset-x-2 bottom-0 h-0.5",
              activeTab === tab ? "bg-primary" : "bg-transparent",
            )}
            aria-hidden="true"
          />
        </Button>
      ))}
    </div>
  );
}

export function PlaneChangeEventsList({
  events,
  onSelect,
}: {
  events: ChangeEvent[];
  onSelect: (eventId: string) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="flex min-h-72 flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="text-base font-medium text-foreground">
          No change events found
        </div>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Clear the current search or choose another data tab.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" role="list">
      {events.map((event) => (
        <div
          key={event.id}
          className="group flex min-h-16 items-center gap-3 border-b border-border/70 px-4 py-3 transition-colors hover:bg-muted/40"
          role="listitem"
        >
          <Button
            type="button"
            variant="ghost"
            className="flex h-auto min-h-11 min-w-0 flex-1 justify-start gap-3 rounded-none p-0 text-left hover:bg-transparent"
            onClick={() => onSelect(String(event.id))}
          >
            <span className="w-24 shrink-0 truncate text-xs font-medium tabular-nums text-muted-foreground">
              {formatPlaneChangeEventIdentifier(event)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium text-foreground md:text-sm">
                {event.title || "Untitled Change Event"}
              </span>
              <span className="mt-1 flex min-w-0 items-center gap-3 text-sm text-muted-foreground md:hidden">
                <StatusBadge status={event.status || "Open"} />
                <span className="truncate">{event.scope || "TBD"}</span>
              </span>
            </span>
          </Button>

          <div className="hidden w-32 shrink-0 md:block">
            <StatusBadge status={event.status || "Open"} />
          </div>
          <div className="hidden w-28 shrink-0 text-sm text-muted-foreground lg:block">
            <span className="block truncate">{event.scope || "TBD"}</span>
          </div>
          <div className="hidden w-28 shrink-0 items-center justify-end gap-2 text-sm tabular-nums text-foreground xl:flex">
            <CircleDollarSign
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <span>{formatMoney(event.cost_rom)}</span>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 shrink-0 md:size-9"
            aria-label={`Open ${formatPlaneChangeEventIdentifier(event)}`}
            onClick={() => onSelect(String(event.id))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
