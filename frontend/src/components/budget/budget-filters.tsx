"use client";

import { Maximize2, Minimize2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BudgetSnapshot, BudgetGroup } from "@/types/budget";
import type { BudgetViewDefinition } from "@/types/budget-views";

export type QuickFilterType =
  | "over-budget"
  | "under-budget"
  | "no-activity"
  | "with-direct-costs"
  | "all";

interface BudgetFiltersProps {
  snapshots: BudgetSnapshot[];
  groups: BudgetGroup[];
  selectedSnapshot: string;
  selectedGroup: string;
  columnControlsSlotId?: string;
  onSnapshotChange: (snapshotId: string) => void;
  onGroupChange: (groupId: string) => void;
  onToggleFullscreen?: () => void;
  onQuickFilterChange?: (filter: QuickFilterType) => void;
  activeQuickFilter?: QuickFilterType;
  isFullscreen?: boolean;
  /** Named budget views available for this project */
  budgetViews?: BudgetViewDefinition[];
  /** Currently active view ID (undefined = default) */
  activeViewId?: string;
  onViewChange?: (viewId: string) => void;
}

export function BudgetFilters({
  snapshots,
  groups,
  selectedSnapshot,
  selectedGroup,
  columnControlsSlotId,
  onSnapshotChange,
  onGroupChange,
  onToggleFullscreen,
  onQuickFilterChange,
  activeQuickFilter = "all",
  isFullscreen = false,
  budgetViews,
  activeViewId,
  onViewChange,
}: BudgetFiltersProps) {
  const selectedSnapshotName =
    snapshots.find((s) => s.id === selectedSnapshot)?.name || "Select Snapshot";
  const selectedGroupName =
    groups.find((g) => g.id === selectedGroup)?.name || "Select Group";

  const quickFilterLabels = {
    all: "All Items",
    "over-budget": "Over Budget",
    "under-budget": "Under Budget",
    "no-activity": "No Activity",
    "with-direct-costs": "With Direct Costs",
  };

  const filterSummary = `${selectedSnapshotName} · ${selectedGroupName} · ${quickFilterLabels[activeQuickFilter]}`;

  const activeViewName = budgetViews?.find((v) => v.id === activeViewId)?.name;

  return (
    <div className="flex items-center gap-1">
      {budgetViews && budgetViews.length > 0 && onViewChange && (
        <Select value={activeViewId ?? "__default__"} onValueChange={(val) => onViewChange(val === "__default__" ? "" : val)}>
          <SelectTrigger
            className="h-8 w-auto min-w-32 max-w-48 border-0 bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted focus:ring-0"
            aria-label="Switch budget view"
          >
            <SelectValue placeholder="Default View">
              {activeViewName ?? "Default View"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="__default__">Default View</SelectItem>
            {budgetViews.map((view) => (
              <SelectItem key={view.id} value={view.id}>
                {view.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="View options"
                className="relative h-8 w-8 rounded-md p-0 text-muted-foreground hover:text-foreground"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <DropdownMenuContent align="end" className="w-96 p-0">
            <div className="px-4 pt-4 pb-3">
              <p className="text-base font-semibold text-foreground">View options</p>
              <p className="mt-1 text-xs text-muted-foreground">{filterSummary}</p>
            </div>
            <DropdownMenuSeparator />
            <div className="space-y-5 px-4 py-4">
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  {/* eslint-disable-next-line design-system/no-raw-heading */}
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Snapshot
                  </h3>
                  <span className="truncate text-xs text-muted-foreground">{selectedSnapshotName}</span>
                </div>
                <Select value={selectedSnapshot} onValueChange={onSnapshotChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Snapshot" />
                  </SelectTrigger>
                  <SelectContent>
                    {snapshots.map((snapshot) => (
                      <SelectItem key={snapshot.id} value={snapshot.id}>
                        {snapshot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  {/* eslint-disable-next-line design-system/no-raw-heading */}
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Grouping
                  </h3>
                  <span className="truncate text-xs text-muted-foreground">{selectedGroupName}</span>
                </div>
                <Select value={selectedGroup} onValueChange={onGroupChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  {/* eslint-disable-next-line design-system/no-raw-heading */}
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Filters
                  </h3>
                  <span className="truncate text-xs text-muted-foreground">
                    {quickFilterLabels[activeQuickFilter]}
                  </span>
                </div>
                <Select
                  value={activeQuickFilter}
                  onValueChange={(value) => onQuickFilterChange?.(value as QuickFilterType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        { id: "all", label: "All Items", dotClassName: "bg-muted-foreground" },
                        { id: "over-budget", label: "Over Budget", dotClassName: "bg-destructive" },
                        { id: "under-budget", label: "Under Budget", dotClassName: "bg-success" },
                        { id: "no-activity", label: "No Activity", dotClassName: "bg-muted-foreground/60" },
                        { id: "with-direct-costs", label: "With Direct Costs", dotClassName: "bg-primary" },
                      ] as const
                    ).map((filter) => (
                      <SelectItem key={filter.id} value={filter.id}>
                        <span className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", filter.dotClassName)} />
                          <span>{filter.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent>View options</TooltipContent>
      </Tooltip>

      {columnControlsSlotId ? (
        <span
          id={columnControlsSlotId}
          className="flex items-center"
          aria-label="Budget column controls"
        />
      ) : null}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "Exit full page view" : "Enter full page view"}
            title={isFullscreen ? "Exit full page view" : "Enter full page view"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isFullscreen ? "Exit full page view" : "Enter full page view"}</TooltipContent>
      </Tooltip>
    </div>
  );
}
