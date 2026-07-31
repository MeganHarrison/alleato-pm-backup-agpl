"use client";

import * as React from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { EmailSource } from "@/hooks/use-emails";
import type { FilterValue } from "@/components/tables/unified";

type FilterState = Record<string, FilterValue>;
type EmailImportanceVisibilityFilter =
  | "default"
  | "all"
  | "important"
  | "not_important";

interface EmailFilterPopoverProps {
  activeFilters: FilterState;
  onFilterChange: (next: FilterState) => void;
  statusOptions: { value: string; label: string }[];
  showSourceFilter?: boolean;
  sourceFilter?: EmailSource;
  onSourceFilterChange?: (source: EmailSource) => void;
  className?: string;
}

const ALL_VALUE = "__all__";
const DEFAULT_IMPORTANCE_VALUE = "__default__";

/**
 * Compact filter control for the mail (reading-pane) view. Writes through the
 * same `activeFilters` state the table/list views use, so a filter set in one
 * view carries into the others.
 */
export function EmailFilterPopover({
  activeFilters,
  onFilterChange,
  statusOptions,
  showSourceFilter = false,
  sourceFilter = "all",
  onSourceFilterChange,
  className,
}: EmailFilterPopoverProps) {
  const [open, setOpen] = React.useState(false);

  const update = React.useCallback(
    (patch: FilterState) => {
      onFilterChange({ ...activeFilters, ...patch });
    },
    [activeFilters, onFilterChange],
  );

  const status = (activeFilters.status as string | undefined) ?? "";
  const from = (activeFilters.from as string | undefined) ?? "";
  const to = (activeFilters.to as string | undefined) ?? "";
  const hasAttachments = activeFilters.has_attachments === true;
  const isStarred = activeFilters.is_starred === true;
  const sentFrom = (activeFilters.sent_at_from as string | undefined) ?? "";
  const sentTo = (activeFilters.sent_at_to as string | undefined) ?? "";
  const importance =
    (activeFilters.importance as EmailImportanceVisibilityFilter | undefined) ??
    "default";
  const sourceActive = showSourceFilter && sourceFilter !== "all";

  const activeCount =
    (status ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0) +
    (hasAttachments ? 1 : 0) +
    (isStarred ? 1 : 0) +
    (sentFrom || sentTo ? 1 : 0) +
    (importance !== "default" ? 1 : 0) +
    (sourceActive ? 1 : 0);

  const clearAll = () => {
    onFilterChange({
      status: undefined,
      project_id: activeFilters.project_id,
      from: undefined,
      to: undefined,
      has_attachments: undefined,
      is_starred: undefined,
      importance: undefined,
      sent_at_from: undefined,
      sent_at_to: undefined,
    });
    onSourceFilterChange?.("all");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Filter emails"
          className={cn(
            "relative h-8 w-8 rounded-full text-muted-foreground shadow-none",
            activeCount > 0 && "text-foreground",
            className,
          )}
        >
          <Filter className="h-4 w-4" />
          {activeCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Filters</span>
            {activeCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            ) : null}
          </div>

          {showSourceFilter ? (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Source</span>
              <div className="inline-flex w-full items-center rounded-md border border-border/60 bg-muted/40 p-0.5">
                {(["all", "app", "outlook"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSourceFilterChange?.(value)}
                    className={cn(
                      "h-7 flex-1 rounded-sm px-2 text-xs capitalize shadow-none",
                      sourceFilter === value
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-transparent hover:text-foreground",
                    )}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <Select
              value={status || ALL_VALUE}
              onValueChange={(value) =>
                update({ status: value === ALL_VALUE ? undefined : value })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Any status</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={hasAttachments ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                update({ has_attachments: hasAttachments ? undefined : true })
              }
              className="h-8 text-xs shadow-none"
            >
              Attachments
            </Button>
            <Button
              type="button"
              variant={isStarred ? "secondary" : "outline"}
              size="sm"
              onClick={() => update({ is_starred: isStarred ? undefined : true })}
              className="h-8 text-xs shadow-none"
            >
              Starred
            </Button>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Relevance
            </span>
            <Select
              value={
                importance === "default" ? DEFAULT_IMPORTANCE_VALUE : importance
              }
              onValueChange={(value) =>
                update({
                  importance:
                    value === DEFAULT_IMPORTANCE_VALUE
                      ? undefined
                      : (value as EmailImportanceVisibilityFilter),
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_IMPORTANCE_VALUE}>
                  Default inbox
                </SelectItem>
                <SelectItem value="important">Important</SelectItem>
                <SelectItem value="not_important">Not important</SelectItem>
                <SelectItem value="all">All relevance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <Input
              value={from}
              onChange={(event) =>
                update({ from: event.target.value || undefined })
              }
              placeholder="Sender name or email"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <Input
              value={to}
              onChange={(event) => update({ to: event.target.value || undefined })}
              placeholder="Recipient email"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Date range</span>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={sentFrom}
                onChange={(event) =>
                  update({ sent_at_from: event.target.value || undefined })
                }
                className="h-8 text-xs"
                aria-label="From date"
              />
              <Input
                type="date"
                value={sentTo}
                onChange={(event) =>
                  update({ sent_at_to: event.target.value || undefined })
                }
                className="h-8 text-xs"
                aria-label="To date"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
