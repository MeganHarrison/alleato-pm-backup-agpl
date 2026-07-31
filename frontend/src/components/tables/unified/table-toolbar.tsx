"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  AlignJustify,
  ArrowUpDown,
  CalendarIcon,
  Columns3,
  Download,
  Filter,
  GripVertical,
  LayoutGrid,
  List,
  MoreVertical,
  PanelRight,
  Search,
  SlidersHorizontal,
  SquarePen,
  Table2,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Modal as Dialog,
  ModalContent as DialogContent,
  ModalHeader as DialogHeader,
  ModalTitle as DialogTitle,
} from "@/components/ui/unified-modal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { TableSettingsPopover } from "./table-settings-popover";

import { ExpandableSearch } from "./expandable-search";
import { TableCountIndicator } from "./table-primitives";
import {
  TableViewsMenu,
  type TableViewsMenuCurrentState,
} from "./table-views-menu";
import type { SavedTableView } from "@/hooks/use-saved-table-views";

export { ExpandableSearch };

export type ViewMode = "table" | "board" | "card" | "list" | "split";
export type TableDensity = "compact" | "default" | "comfortable";

export interface FilterConfig {
  id: string;
  label: string;
  type:
    | "select"
    | "multiSelect"
    | "dateRange"
    | "text"
    | "boolean"
    | "date"
    | "number";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface ColumnConfig {
  id: string;
  label: string;
  defaultVisible?: boolean;
  alwaysVisible?: boolean;
}

type FilterValue = string | string[] | number | boolean | null | undefined;
type SortDirection = "asc" | "desc";

/**
 * Feature flags for TableToolbar. Pass a partial object to opt out of specific
 * capabilities — omitted flags default to `true`.
 *
 * Prefer this over the old flat `enableSearch`, `enableViews`, … boolean props.
 */
export interface TableToolbarFeatures {
  search?: boolean;
  views?: boolean;
  filters?: boolean;
  columnToggle?: boolean;
  export?: boolean;
  bulkDelete?: boolean;
  bulkEdit?: boolean;
}

export interface TableToolbarProps {
  totalItems: number;
  filteredItems: number;
  selectedCount: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  enabledViews?: ViewMode[];
  /** Use icon-only view controls while preserving labels through tooltips and aria. */
  viewSwitcherDisplay?: "default" | "icons";
  filters?: FilterConfig[];
  activeFilters: Record<string, FilterValue>;
  onFilterChange: (filters: Record<string, FilterValue>) => void;
  onClearFilters: () => void;
  columns?: ColumnConfig[];
  visibleColumns: string[];
  onColumnVisibilityChange: (columns: string[]) => void;
  columnOrder?: string[];
  onColumnOrderChange?: (columns: string[]) => void;
  columnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  sortOptions?: ColumnConfig[];
  sortBy?: string | null;
  sortDirection?: SortDirection;
  onSortChange?: (sortBy: string, direction: SortDirection) => void;
  /**
   * Row-grouping options. When provided alongside `onGroupByChange`, the toolbar
   * renders the options as a compact view switcher in the icon row. The first
   * option should be the "no grouping" choice.
   */
  groupByOptions?: { value: string; label: string }[];
  groupBy?: string | null;
  onGroupByChange?: (value: string) => void;
  onExport?: () => void;
  onBulkDelete?: () => void;
  /** Opens the shared bulk-edit dialog. Rendered as a pencil icon next to bulk delete. */
  onBulkEdit?: () => void;
  mobilePanelActions?: ReactNode;
  /** Extra action buttons rendered in the toolbar icon row (e.g. ERP sync) */
  customActions?: ReactNode;
  /** Content rendered on the left of the toolbar row, with icons pushed to the right */
  leftContent?: ReactNode;
  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
  /** Feature flags. Omitted flags default to enabled. */
  features?: TableToolbarFeatures;
  /**
   * Stable identifier for this table when saving views (e.g. "meetings"). When
   * set, the toolbar renders a "Saved views" picker before the view switcher.
   * Views are user-scoped via Supabase RLS, so they sync across browsers.
   * Project-agnostic — a view created on project A applies on project B.
   */
  savedViewsScope?: string;
  /** Defaults the toolbar will fall back to when "Reset to defaults" is picked. */
  savedViewsDefaults?: {
    visibleColumns: string[];
    columnOrder?: string[];
    columnWidths?: Record<string, number>;
    sortBy: string | null;
    sortDirection: SortDirection;
    filters: Record<string, FilterValue>;
  };
  /** @deprecated Use `features.search` instead */
  enableSearch?: boolean;
  /** @deprecated Use `features.views` instead */
  enableViews?: boolean;
  /** @deprecated Use `features.filters` instead */
  enableFilters?: boolean;
  /** @deprecated Use `features.columnToggle` instead */
  enableColumnToggle?: boolean;
  /** @deprecated Use `features.export` instead */
  enableExport?: boolean;
  /** @deprecated Use `features.bulkDelete` instead */
  enableBulkDelete?: boolean;
  className?: string;
}

export function ViewSwitcher({
  currentView,
  onViewChange,
  enabledViews = ["table", "card", "list"],
  display = "default",
}: {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  enabledViews?: ViewMode[];
  display?: "default" | "icons";
}): ReactElement {
  const views: { mode: ViewMode; icon: ReactNode; label: string }[] = [
    { mode: "table", icon: <Table2 className="h-3.5 w-3.5" />, label: "Table" },
    {
      mode: "board",
      icon: <Columns3 className="h-3.5 w-3.5" />,
      label: "Board",
    },
    {
      mode: "card",
      icon: <LayoutGrid className="h-3.5 w-3.5" />,
      label: "Grid",
    },
    { mode: "list", icon: <List className="h-3.5 w-3.5" />, label: "List" },
    {
      mode: "split",
      icon: <PanelRight className="h-3.5 w-3.5" />,
      label: "Split",
    },
  ];

  const filteredViews = views.filter((view) =>
    enabledViews.includes(view.mode),
  );
  if (filteredViews.length <= 1) return <></>;

  const iconOnly = display === "icons";

  return (
    <TooltipProvider>
      <Tabs
        value={currentView}
        onValueChange={(value) => onViewChange(value as ViewMode)}
      >
        <TabsList className={cn("h-10 sm:h-8", iconOnly && "h-8")}>
          {filteredViews.map((view) => {
            const trigger = (
              <TabsTrigger
                key={view.mode}
                value={view.mode}
                aria-label={`${view.label} view`}
                className={cn(
                  "h-8 min-w-10 gap-1.5 px-2.5 sm:h-6 sm:min-w-0",
                  iconOnly && "h-6 min-w-8 px-2 sm:min-w-8",
                )}
              >
                {view.icon}
                {!iconOnly ? (
                  <span className="hidden text-[12px] sm:inline">
                    {view.label}
                  </span>
                ) : null}
              </TabsTrigger>
            );

            return iconOnly ? (
              <Tooltip key={view.mode}>
                <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                <TooltipContent>{view.label} view</TooltipContent>
              </Tooltip>
            ) : (
              trigger
            );
          })}
        </TabsList>
      </Tabs>
    </TooltipProvider>
  );
}

function FilterFields({
  filters,
  activeFilters,
  onFilterChange,
  presentation = "compact",
}: {
  filters: FilterConfig[];
  activeFilters: Record<string, FilterValue>;
  onFilterChange: (filters: Record<string, FilterValue>) => void;
  presentation?: "compact" | "sheet";
}): ReactElement {
  const isSheet = presentation === "sheet";
  const rowClassName = cn(
    "flex gap-3",
    isSheet
      ? "flex-col py-3 sm:flex-row sm:items-center sm:justify-between"
      : "items-center justify-between py-1",
  );
  const labelClassName = isSheet
    ? "text-sm font-medium text-foreground"
    : "text-xs text-muted-foreground";
  const controlClassName = isSheet
    ? "h-11 w-full text-sm sm:w-56"
    : "h-7 w-40 text-xs";
  const formatDateValue = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const renderDateButtonLabel = (value: string, fallback: string) => {
    if (!value) return fallback;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderFilter = (filter: FilterConfig) => {
    if (filter.type === "select" && filter.options) {
      const currentValue =
        typeof activeFilters[filter.id] === "string"
          ? (activeFilters[filter.id] as string)
          : "";

      return (
        <div
          key={filter.id}
          className={rowClassName}
        >
          <span className={labelClassName}>{filter.label}</span>
          <Select
            value={currentValue || "all"}
            onValueChange={(nextValue) =>
              onFilterChange({
                ...activeFilters,
                [filter.id]: nextValue === "all" ? undefined : nextValue,
              })
            }
          >
            <SelectTrigger
              aria-label={`${filter.label} filter`}
              className={cn(controlClassName, "bg-background")}
            >
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (filter.type === "multiSelect" && filter.options) {
      const currentValues = Array.isArray(activeFilters[filter.id])
        ? (activeFilters[filter.id] as string[])
        : [];
      const selectedLabels = filter.options
        .filter((option) => currentValues.includes(option.value))
        .map((option) => option.label);
      const summary =
        selectedLabels.length === 0
          ? "All"
          : selectedLabels.length === 1
            ? selectedLabels[0]
            : `${selectedLabels.length} selected`;

      return (
        <div
          key={filter.id}
          className={rowClassName}
        >
          <span className={labelClassName}>{filter.label}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  controlClassName,
                  "justify-between px-2.5 text-left font-normal",
                )}
              >
                <span className="truncate">{summary}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {filter.options.map((option) => {
                const checked = currentValues.includes(option.value);
                return (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={checked}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(nextChecked) => {
                      const nextValues = nextChecked
                        ? [...currentValues, option.value]
                        : currentValues.filter(
                            (value) => value !== option.value,
                          );
                      onFilterChange({
                        ...activeFilters,
                        [filter.id]:
                          nextValues.length > 0 ? nextValues : undefined,
                      });
                    }}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    if (filter.type === "date") {
      const currentValue =
        typeof activeFilters[filter.id] === "string"
          ? (activeFilters[filter.id] as string)
          : "";
      const selectedDate = currentValue
        ? new Date(currentValue + "T00:00:00")
        : undefined;

      return (
        <div
          key={filter.id}
          className={rowClassName}
        >
          <span className={labelClassName}>{filter.label}</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  controlClassName,
                  "justify-start text-left font-normal",
                  !currentValue && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) =>
                  onFilterChange({
                    ...activeFilters,
                    [filter.id]: date ? formatDateValue(date) : undefined,
                  })
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    if (filter.type === "dateRange") {
      const fromKey = `${filter.id}_from`;
      const toKey = `${filter.id}_to`;
      const fromValue =
        typeof activeFilters[fromKey] === "string"
          ? (activeFilters[fromKey] as string)
          : "";
      const toValue =
        typeof activeFilters[toKey] === "string"
          ? (activeFilters[toKey] as string)
          : "";
      const fromDate = fromValue
        ? new Date(`${fromValue}T00:00:00`)
        : undefined;
      const toDate = toValue ? new Date(`${toValue}T00:00:00`) : undefined;

      return (
        <div key={filter.id} className={rowClassName}>
          <span className={labelClassName}>{filter.label}</span>
          <div className={cn("grid grid-cols-2 gap-1.5", isSheet ? "w-full sm:w-56" : "w-40")}>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    isSheet ? "h-11 justify-start px-3 text-left text-sm font-normal" : "h-7 justify-start px-2 text-left text-xs font-normal",
                  !fromValue && "text-muted-foreground",
                )}
              >
                  <CalendarIcon className="mr-1.5 h-3 w-3" />
                  {renderDateButtonLabel(fromValue, "From")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={(date) =>
                    onFilterChange({
                      ...activeFilters,
                      [fromKey]: date ? formatDateValue(date) : undefined,
                    })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    isSheet ? "h-11 justify-start px-3 text-left text-sm font-normal" : "h-7 justify-start px-2 text-left text-xs font-normal",
                  !toValue && "text-muted-foreground",
                )}
              >
                  <CalendarIcon className="mr-1.5 h-3 w-3" />
                  {renderDateButtonLabel(toValue, "To")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={(date) =>
                    onFilterChange({
                      ...activeFilters,
                      [toKey]: date ? formatDateValue(date) : undefined,
                    })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      );
    }

    if (filter.type === "number" || filter.type === "text") {
      return (
        <div
          key={filter.id}
          className={rowClassName}
        >
          <label
            htmlFor={`filter-${filter.id}`}
            className={labelClassName}
          >
            {filter.label}
          </label>
          <Input
            id={`filter-${filter.id}`}
            type={filter.type === "number" ? "number" : "text"}
            className={cn(controlClassName, "shrink-0")}
            min={filter.type === "number" ? "0" : undefined}
            step={filter.type === "number" ? "1" : undefined}
            placeholder={filter.placeholder}
            value={
              typeof activeFilters[filter.id] === "string"
                ? (activeFilters[filter.id] as string)
                : ""
            }
            onChange={(event) =>
              onFilterChange({
                ...activeFilters,
                [filter.id]: event.target.value || undefined,
              })
            }
          />
        </div>
      );
    }

    if (filter.type === "boolean") {
      const checked = activeFilters[filter.id] === true;
      return (
        <label
          key={filter.id}
          className={cn(rowClassName, labelClassName)}
        >
          {filter.label}
          <Checkbox
            checked={checked}
            onCheckedChange={(nextChecked) =>
              onFilterChange({
                ...activeFilters,
                [filter.id]: nextChecked ? true : undefined,
              })
            }
          />
        </label>
      );
    }

    return null;
  };

  return <div className="space-y-2">{filters.map(renderFilter)}</div>;
}

export function FilterMenu({
  filters,
  activeFilters,
  onFilterChange,
  onClearFilters,
  viewSettings,
}: {
  filters: FilterConfig[];
  activeFilters: Record<string, FilterValue>;
  onFilterChange: (filters: Record<string, FilterValue>) => void;
  onClearFilters: () => void;
  viewSettings?: {
    currentView: ViewMode;
    onViewChange: (view: ViewMode) => void;
    enabledViews: ViewMode[];
  };
}): ReactElement {
  const activeCount = Object.values(activeFilters).filter(
    (value) => value !== undefined && value !== "" && value !== null,
  ).length;

  return (
    <TableSettingsPopover
      tooltip="Filters and view settings"
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 w-8 rounded-md p-0 text-muted-foreground hover:text-foreground"
          aria-label="Filters and view settings"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeCount > 0 ? (
            <TableCountIndicator
              count={activeCount}
              className="absolute -right-1 -top-1 bg-secondary text-secondary-foreground"
            />
          ) : null}
        </Button>
      }
      className="sm:w-96"
    >
      <div className="space-y-3">
          {viewSettings ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">Layout</p>
                <span className="text-[11px] text-muted-foreground">
                  {getViewLabel(viewSettings.currentView)}
                </span>
              </div>
              <ViewSwitcher
                currentView={viewSettings.currentView}
                onViewChange={viewSettings.onViewChange}
                enabledViews={viewSettings.enabledViews}
                display="default"
              />
            </section>
          ) : null}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs font-medium text-foreground">Filters</p>
            {activeCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={onClearFilters}
              >
                Clear
              </Button>
            ) : null}
          </div>
          <div
            className="overflow-y-auto"
            style={{ maxHeight: "min(70vh, 40rem)" }}
          >
            <FilterFields
              filters={filters}
              activeFilters={activeFilters}
              onFilterChange={onFilterChange}
            />
          </div>
      </div>
    </TableSettingsPopover>
  );
}

function GroupBySwitcher({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="h-8">
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="h-6 px-2.5 text-[12px]"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function MobileSettingsRow({
  icon,
  label,
  value,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  value?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}): ReactElement {
  return (
    <Button
      variant="ghost"
      className={cn(
        "h-auto min-h-12 w-full justify-start gap-3 rounded-none border-b border-border/70 px-4 py-3 text-left font-normal last:border-b-0",
        "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-base text-foreground">{label}</span>
      {value ? (
        <span className="shrink-0 text-base text-muted-foreground">
          {value}
        </span>
      ) : null}
      {onClick ? (
        <span className="text-xl leading-none text-muted-foreground/70">›</span>
      ) : null}
    </Button>
  );
}

function getViewLabel(view: ViewMode): string {
  if (view === "board") return "Board";
  if (view === "card") return "Grid";
  if (view === "list") return "List";
  if (view === "split") return "Split";
  return "Table";
}

function getFirstActiveFilterLabel(
  filters: FilterConfig[],
  activeFilters: Record<string, FilterValue>,
): string | undefined {
  const active = filters.find((filter) => {
    const value = activeFilters[filter.id];
    return value !== undefined && value !== "" && value !== null;
  });

  if (!active) return undefined;

  const value = activeFilters[active.id];
  if (typeof value === "string" && active.options) {
    return (
      active.options.find((option) => option.value === value)?.label ??
      active.label
    );
  }

  return active.label;
}

const DENSITY_OPTIONS: { value: TableDensity; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "comfortable", label: "Comfortable" },
];

export function DensityToggle({
  density = "default",
  onDensityChange,
}: {
  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
}): ReactElement {
  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Row density"
              >
                <AlignJustify className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Row density</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Row density</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DENSITY_OPTIONS.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={density === option.value}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => onDensityChange?.(option.value)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DensityOptions({
  density = "default",
  onDensityChange,
}: {
  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
}): ReactElement {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/70 bg-background p-1">
      {DENSITY_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 rounded-md px-2 text-xs font-medium shadow-none",
            density === option.value
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
          onClick={() => onDensityChange?.(option.value)}
          aria-pressed={density === option.value}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function orderColumnsForToggle(
  columns: ColumnConfig[],
  columnOrder: string[] | undefined,
  visibleColumns: string[],
): ColumnConfig[] {
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const preferredOrder =
    columnOrder && columnOrder.length > 0 ? columnOrder : visibleColumns;
  const orderedIds = [
    ...preferredOrder.filter((id) => columnById.has(id)),
    ...columns
      .map((column) => column.id)
      .filter((id) => !preferredOrder.includes(id)),
  ];

  return orderedIds
    .map((id) => columnById.get(id))
    .filter((column): column is ColumnConfig => Boolean(column));
}

export function reorderColumnIds(
  orderedIds: string[],
  activeId: string,
  overId: string,
): string[] {
  const oldIndex = orderedIds.indexOf(activeId);
  const newIndex = orderedIds.indexOf(overId);

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return orderedIds;
  }

  return arrayMove(orderedIds, oldIndex, newIndex);
}

export function visibleColumnsInOrder(
  orderedIds: string[],
  visibleColumns: string[],
): string[] {
  const visibleSet = new Set(visibleColumns);
  const orderedVisible = orderedIds.filter((id) => visibleSet.has(id));
  const missingVisible = visibleColumns.filter(
    (id) => !orderedIds.includes(id),
  );

  return [...orderedVisible, ...missingVisible];
}

function SortableColumnToggleItem({
  column,
  checked,
  onCheckedChange,
  idPrefix,
}: {
  column: ColumnConfig;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  idPrefix: string;
}): ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex min-h-8 items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-muted/45",
        isDragging &&
          "relative z-10 bg-background shadow-sm ring-1 ring-border",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-transparent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label={`Drag ${column.label} column`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </Button>
      <Checkbox
        id={`${idPrefix}-${column.id}`}
        checked={checked}
        disabled={column.alwaysVisible}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="size-4 rounded-[5px] border-muted-foreground/35 bg-transparent text-foreground shadow-none data-[state=checked]:border-muted-foreground/50 data-[state=checked]:bg-transparent data-[state=checked]:text-foreground dark:data-[state=checked]:bg-transparent"
      />
      <label
        htmlFor={`${idPrefix}-${column.id}`}
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium text-foreground",
          column.alwaysVisible && "text-muted-foreground",
        )}
      >
        {column.label}
      </label>
    </div>
  );
}

function ColumnReorderList({
  columns,
  visibleColumns,
  onColumnVisibilityChange,
  columnOrder,
  onColumnOrderChange,
  idPrefix,
  className,
}: {
  columns: ColumnConfig[];
  visibleColumns: string[];
  onColumnVisibilityChange: (columns: string[]) => void;
  columnOrder?: string[];
  onColumnOrderChange?: (columns: string[]) => void;
  idPrefix: string;
  className?: string;
}): ReactElement {
  const orderedColumns = orderColumnsForToggle(
    columns,
    columnOrder,
    visibleColumns,
  );
  const orderedIds = orderedColumns.map((column) => column.id);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const setVisibleColumnsInOrder = (nextVisibleColumns: string[]) => {
    onColumnVisibilityChange(
      visibleColumnsInOrder(orderedIds, nextVisibleColumns),
    );
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const nextOrder = reorderColumnIds(
      orderedIds,
      String(active.id),
      String(over.id),
    );

    onColumnOrderChange?.(nextOrder);
    onColumnVisibilityChange(visibleColumnsInOrder(nextOrder, visibleColumns));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={orderedIds}
        strategy={verticalListSortingStrategy}
      >
        <div className={cn("overflow-y-auto py-1", className)}>
          {orderedColumns.map((column) => (
            <SortableColumnToggleItem
              key={column.id}
              column={column}
              checked={
                column.alwaysVisible || visibleColumns.includes(column.id)
              }
              idPrefix={idPrefix}
              onCheckedChange={(checked) => {
                if (column.alwaysVisible) return;
                if (checked) {
                  setVisibleColumnsInOrder([...visibleColumns, column.id]);
                } else {
                  setVisibleColumnsInOrder(
                    visibleColumns.filter((existing) => existing !== column.id),
                  );
                }
              }}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function ColumnToggle({
  columns,
  visibleColumns,
  onColumnVisibilityChange,
  columnOrder,
  onColumnOrderChange,
}: {
  columns: ColumnConfig[];
  visibleColumns: string[];
  onColumnVisibilityChange: (columns: string[]) => void;
  columnOrder?: string[];
  onColumnOrderChange?: (columns: string[]) => void;
}): ReactElement {
  const defaultColumns = columns
    .filter((column) => column.defaultVisible !== false || column.alwaysVisible)
    .map((column) => column.id);
  const orderedColumns = orderColumnsForToggle(
    columns,
    columnOrder,
    visibleColumns,
  );
  const orderedIds = orderedColumns.map((column) => column.id);

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Toggle columns"
              >
                <Columns3 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Select which columns to display</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ColumnReorderList
          columns={columns}
          visibleColumns={visibleColumns}
          onColumnVisibilityChange={onColumnVisibilityChange}
          columnOrder={columnOrder}
          onColumnOrderChange={onColumnOrderChange}
          idPrefix="column-toggle"
          className="max-h-80"
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            onColumnOrderChange?.(orderedIds);
            onColumnVisibilityChange(orderedIds);
          }}
        >
          Show all
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            const resetOrder = columns.map((column) => column.id);
            onColumnOrderChange?.(resetOrder);
            onColumnVisibilityChange(
              visibleColumnsInOrder(resetOrder, defaultColumns),
            );
          }}
        >
          Reset to defaults
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TableDisplaySettings({
  columns,
  visibleColumns,
  onColumnVisibilityChange,
  columnOrder,
  onColumnOrderChange,
  density,
  onDensityChange,
}: {
  columns: ColumnConfig[];
  visibleColumns: string[];
  onColumnVisibilityChange: (columns: string[]) => void;
  columnOrder?: string[];
  onColumnOrderChange?: (columns: string[]) => void;
  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
}): ReactElement {
  const defaultColumns = columns
    .filter((column) => column.defaultVisible !== false || column.alwaysVisible)
    .map((column) => column.id);
  const orderedColumns = orderColumnsForToggle(
    columns,
    columnOrder,
    visibleColumns,
  );
  const orderedIds = orderedColumns.map((column) => column.id);

  return (
    <TableSettingsPopover
      tooltip="Table settings"
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Table settings"
        >
          <Columns3 className="h-4 w-4" />
        </Button>
      }
    >
          <div className="space-y-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Row density
            </p>
            <DensityOptions
              density={density}
              onDensityChange={onDensityChange}
            />
          </div>
          {columns.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Columns
                </p>
                <span className="text-xs text-muted-foreground/80">
                  Drag to reorder
                </span>
              </div>
              <ColumnReorderList
                columns={columns}
                visibleColumns={visibleColumns}
                onColumnVisibilityChange={onColumnVisibilityChange}
                columnOrder={columnOrder}
                onColumnOrderChange={onColumnOrderChange}
                idPrefix="table-settings-column"
                className="max-h-80 pr-1"
              />
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  onClick={() => {
                    onColumnOrderChange?.(orderedIds);
                    onColumnVisibilityChange(orderedIds);
                  }}
                >
                  Show all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  onClick={() => {
                    const resetOrder = columns.map((column) => column.id);
                    onColumnOrderChange?.(resetOrder);
                    onColumnVisibilityChange(
                      visibleColumnsInOrder(resetOrder, defaultColumns),
                    );
                  }}
                >
                  Reset defaults
                </Button>
              </div>
            </div>
          ) : null}
    </TableSettingsPopover>
  );
}

export function TableToolbar({
  totalItems,
  filteredItems,
  selectedCount,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  currentView,
  onViewChange,
  enabledViews = ["table", "card", "list"],
  filters = [],
  activeFilters,
  onFilterChange,
  onClearFilters,
  columns = [],
  visibleColumns,
  onColumnVisibilityChange,
  columnOrder,
  onColumnOrderChange,
  columnWidths,
  onColumnWidthsChange,
  sortOptions = [],
  sortBy,
  sortDirection = "asc",
  onSortChange,
  groupByOptions,
  groupBy,
  onGroupByChange,
  onExport,
  onBulkDelete,
  onBulkEdit,
  mobilePanelActions,
  customActions,
  leftContent,
  density = "default",
  onDensityChange,
  features,
  savedViewsScope,
  savedViewsDefaults,
  enableSearch,
  enableViews,
  enableFilters,
  enableColumnToggle,
  enableExport,
  enableBulkDelete,
  className,
}: TableToolbarProps): ReactElement {
  // Track which saved view is currently applied. Local to TableToolbar — the
  // backing presentation state (visibleColumns/sort/filters) is owned by the
  // page hook, so the menu just fires the existing setters to apply a view.
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const savedViewsCurrentState: TableViewsMenuCurrentState = {
    visible_columns: visibleColumns,
    column_order: columnOrder ?? visibleColumns,
    column_widths: columnWidths ?? null,
    sort_by: sortBy ?? null,
    sort_direction: sortDirection,
    filters: activeFilters as Record<
      string,
      string | number | boolean | string[] | null
    >,
  };

  const applySavedView = (view: SavedTableView) => {
    if (view.visible_columns && view.visible_columns.length > 0) {
      onColumnVisibilityChange(view.visible_columns);
    }
    if (view.column_order && onColumnOrderChange) {
      onColumnOrderChange(view.column_order);
    }
    if (onColumnWidthsChange) {
      onColumnWidthsChange(view.column_widths ?? {});
    }
    if (view.sort_by && onSortChange) {
      onSortChange(view.sort_by, view.sort_direction ?? "asc");
    }
    if (view.filters) {
      onFilterChange(view.filters as Record<string, FilterValue>);
    } else {
      onClearFilters();
    }
    setActiveViewId(view.id);
  };

  const resetSavedViewToDefaults = () => {
    if (savedViewsDefaults) {
      onColumnVisibilityChange(savedViewsDefaults.visibleColumns);
      if (onColumnOrderChange) {
        onColumnOrderChange(
          savedViewsDefaults.columnOrder ?? savedViewsDefaults.visibleColumns,
        );
      }
      if (onColumnWidthsChange) {
        onColumnWidthsChange(savedViewsDefaults.columnWidths ?? {});
      }
      if (savedViewsDefaults.sortBy && onSortChange) {
        onSortChange(
          savedViewsDefaults.sortBy,
          savedViewsDefaults.sortDirection,
        );
      }
      onFilterChange(savedViewsDefaults.filters);
    } else {
      onClearFilters();
    }
    setActiveViewId(null);
  };
  // Resolve feature flags: new `features` object takes precedence,
  // legacy flat props are honoured for backwards-compatibility, default is enabled.
  const feat = {
    search: features?.search ?? enableSearch ?? true,
    views: features?.views ?? enableViews ?? true,
    filters: features?.filters ?? enableFilters ?? true,
    columnToggle: features?.columnToggle ?? enableColumnToggle ?? true,
    export: features?.export ?? enableExport ?? true,
    bulkDelete: features?.bulkDelete ?? enableBulkDelete ?? true,
    bulkEdit: features?.bulkEdit ?? true,
  };

  const [isMobile, setIsMobile] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileDisplayOpen, setMobileDisplayOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const apply = (): void => setIsMobile(mediaQuery.matches);

    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    mobileSearchInputRef.current?.focus();
  }, [mobileSearchOpen]);

  const activeFilterCount = Object.values(activeFilters).filter(
    (value) => value !== undefined && value !== "" && value !== null,
  ).length;
  const visibleColumnCount = columns.filter((column) =>
    visibleColumns.includes(column.id),
  ).length;
  const firstActiveFilterLabel = getFirstActiveFilterLabel(
    filters,
    activeFilters,
  );
  const activeSortLabel = sortOptions.find(
    (option) => option.id === sortBy,
  )?.label;

  if (isMobile) {
    return (
      <div className={cn("py-2", className)}>
        <div className="flex w-full items-center justify-end gap-3">
          <div className="flex shrink-0 items-center gap-1.5">
            <Sheet open={mobilePanelOpen} onOpenChange={setMobilePanelOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative h-11 w-11 shrink-0 p-0"
                  aria-label="Open table settings"
                >
                  <MoreVertical className="h-6 w-6" />
                  <TableCountIndicator
                    count={activeFilterCount}
                    className="absolute -right-1 -top-1"
                  />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                aria-describedby={undefined}
                className="w-full max-w-none gap-0 bg-muted p-0"
              >
                <SheetHeader className="px-4 pb-5 pt-2 text-center">
                  <SheetTitle className="text-lg">Settings</SheetTitle>
                </SheetHeader>
                <div className="max-h-[calc(90dvh-72px)] space-y-4 overflow-y-auto px-4 pb-6">
                  <div className="overflow-hidden rounded-2xl bg-background">
                    <MobileSettingsRow
                      icon={<Table2 className="h-5 w-5" />}
                      label="Active"
                      value={
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground text-[11px] font-semibold text-background">
                          i
                        </span>
                      }
                    />
                  </div>

                  <div className="overflow-hidden rounded-2xl bg-background">
                    {feat.views && (
                      <MobileSettingsRow
                        icon={<Table2 className="h-5 w-5" />}
                        label="Layout"
                        value={getViewLabel(currentView)}
                        onClick={() => {
                          const currentIndex =
                            enabledViews.indexOf(currentView);
                          const nextView =
                            enabledViews[
                              (currentIndex + 1) % enabledViews.length
                            ] ?? "table";
                          onViewChange(nextView);
                        }}
                      />
                    )}
                    {(feat.columnToggle || onDensityChange) && (
                      <MobileSettingsRow
                        icon={<Columns3 className="h-5 w-5" />}
                        label="Columns and density"
                        value={
                          feat.columnToggle && columns.length > 0
                            ? visibleColumnCount
                            : undefined
                        }
                        onClick={() => {
                          setMobilePanelOpen(false);
                          window.setTimeout(
                            () => setMobileDisplayOpen(true),
                            160,
                          );
                        }}
                      />
                    )}
                    {feat.filters && filters.length > 0 && (
                      <MobileSettingsRow
                        icon={<Filter className="h-5 w-5" />}
                        label="Filter"
                        value={
                          firstActiveFilterLabel ??
                          (activeFilterCount > 0
                            ? `${activeFilterCount}`
                            : "None")
                        }
                        onClick={() => {
                          setMobilePanelOpen(false);
                          window.setTimeout(
                            () => setMobileFilterOpen(true),
                            160,
                          );
                        }}
                      />
                    )}
                    <MobileSettingsRow
                      icon={<ArrowUpDown className="h-5 w-5" />}
                      label="Sort"
                      value={activeSortLabel ?? "Default"}
                      onClick={
                        onSortChange && sortOptions.length > 0
                          ? () => {
                              setMobilePanelOpen(false);
                              window.setTimeout(
                                () => setMobileSortOpen(true),
                                160,
                              );
                            }
                          : undefined
                      }
                      disabled={!onSortChange || sortOptions.length === 0}
                    />
                    {onGroupByChange &&
                    groupByOptions &&
                    groupByOptions.length > 0 ? (
                      <MobileSettingsRow
                        icon={<Table2 className="h-5 w-5" />}
                        label="View"
                        value={
                          groupByOptions.find(
                            (option) => option.value === groupBy,
                          )?.label ?? groupByOptions[0]?.label
                        }
                        onClick={() => {
                          const current = groupBy ?? groupByOptions[0]?.value;
                          const currentIndex = groupByOptions.findIndex(
                            (option) => option.value === current,
                          );
                          const next =
                            groupByOptions[
                              (currentIndex + 1) % groupByOptions.length
                            ];
                          if (next) onGroupByChange(next.value);
                        }}
                      />
                    ) : (
                      <MobileSettingsRow
                        icon={<Table2 className="h-5 w-5" />}
                        label="View"
                        disabled
                      />
                    )}
                  </div>

                  {feat.search && (
                    <div className="overflow-hidden rounded-2xl bg-background">
                      <MobileSettingsRow
                        icon={<Search className="h-5 w-5" />}
                        label="Search"
                        value={searchValue ? "Active" : undefined}
                        onClick={() => {
                          setMobilePanelOpen(false);
                          window.setTimeout(
                            () => setMobileSearchOpen(true),
                            160,
                          );
                        }}
                      />
                    </div>
                  )}

                  {(feat.export && onExport) ||
                  mobilePanelActions ||
                  (feat.bulkEdit && onBulkEdit) ||
                  (feat.bulkDelete && onBulkDelete) ? (
                    <div className="overflow-hidden rounded-2xl bg-background">
                      {mobilePanelActions}
                      {feat.export && onExport ? (
                        <MobileSettingsRow
                          icon={<Download className="h-5 w-5" />}
                          label="Export"
                          onClick={onExport}
                        />
                      ) : null}
                      {feat.bulkEdit && onBulkEdit ? (
                        <MobileSettingsRow
                          icon={<SquarePen className="h-5 w-5" />}
                          label="Edit selected"
                          value={selectedCount > 0 ? selectedCount : undefined}
                          onClick={
                            selectedCount > 0
                              ? () => {
                                  setMobilePanelOpen(false);
                                  onBulkEdit();
                                }
                              : undefined
                          }
                          disabled={selectedCount === 0}
                        />
                      ) : null}
                      {feat.bulkDelete && onBulkDelete ? (
                        <MobileSettingsRow
                          icon={<Trash2 className="h-5 w-5" />}
                          label="Delete selected"
                          value={selectedCount > 0 ? selectedCount : undefined}
                          onClick={selectedCount > 0 ? onBulkDelete : undefined}
                          disabled={selectedCount === 0}
                        />
                      ) : null}
                    </div>
                  ) : null}

                  <p className="px-1 text-xs text-muted-foreground">
                    {filteredItems === totalItems
                      ? `${totalItems} items`
                      : `${filteredItems} of ${totalItems} items`}
                  </p>
                </div>
              </SheetContent>
            </Sheet>

            <Dialog open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
              <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Search</DialogTitle>
                </DialogHeader>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={mobileSearchInputRef}
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-9 pl-8 pr-8 text-sm"
                    aria-label="Search table"
                  />
                  {searchValue ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-9 w-9"
                      onClick={() => onSearchChange("")}
                      aria-label="Clear search"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>

            <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
              <SheetContent
                side="right"
                aria-describedby={undefined}
                className="w-full max-w-none gap-0 p-0 sm:!max-w-md md:!w-full"
            >
                <SheetHeader className="px-4 py-4 pr-14">
                  <div className="flex items-center justify-between gap-3">
                    <SheetTitle>Filter</SheetTitle>
                    {activeFilterCount > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={onClearFilters}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </SheetHeader>
                <div className="max-h-[calc(90dvh-76px)] overflow-y-auto px-4 py-4">
                  <FilterFields
                    filters={filters}
                    activeFilters={activeFilters}
                    onFilterChange={onFilterChange}
                    presentation="sheet"
                  />
                </div>
              </SheetContent>
            </Sheet>

            <Sheet open={mobileDisplayOpen} onOpenChange={setMobileDisplayOpen}>
              <SheetContent
                side="right"
                aria-describedby={undefined}
                className="w-full max-w-none gap-0 p-0"
              >
                <SheetHeader className="px-4 py-4">
                  <SheetTitle>Columns and density</SheetTitle>
                </SheetHeader>
                <div className="max-h-[calc(90dvh-76px)] space-y-4 overflow-y-auto px-4 py-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Row density
                    </p>
                    <DensityOptions
                      density={density}
                      onDensityChange={onDensityChange}
                    />
                  </div>
                  {feat.columnToggle && columns.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">
                          Columns
                        </p>
                        <span className="text-xs text-muted-foreground">
                          Drag to reorder
                        </span>
                      </div>
                      <div className="overflow-hidden rounded-2xl border bg-background">
                        <ColumnReorderList
                          columns={columns}
                          visibleColumns={visibleColumns}
                          onColumnVisibilityChange={onColumnVisibilityChange}
                          columnOrder={columnOrder}
                          onColumnOrderChange={onColumnOrderChange}
                          idPrefix="mobile-col-toggle"
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </SheetContent>
            </Sheet>

            <Sheet open={mobileSortOpen} onOpenChange={setMobileSortOpen}>
              <SheetContent
                side="right"
                aria-describedby={undefined}
                className="w-full max-w-none gap-0 p-0"
              >
                <SheetHeader className="px-4 py-4">
                  <SheetTitle>Sort</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 px-4 py-4">
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium text-foreground"
                      htmlFor="mobile-table-sort-column"
                    >
                      Field
                    </label>
                    <Select
                      value={sortBy ?? undefined}
                      onValueChange={(nextSortBy) => {
                        if (!onSortChange) return;
                        onSortChange(nextSortBy, sortDirection);
                      }}
                    >
                      <SelectTrigger
                        id="mobile-table-sort-column"
                        className="h-10 w-full"
                      >
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Direction
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={
                          sortDirection === "asc" ? "default" : "outline"
                        }
                        onClick={() => {
                          if (!onSortChange || !sortBy) return;
                          onSortChange(sortBy, "asc");
                        }}
                      >
                        Ascending
                      </Button>
                      <Button
                        variant={
                          sortDirection === "desc" ? "default" : "outline"
                        }
                        onClick={() => {
                          if (!onSortChange || !sortBy) return;
                          onSortChange(sortBy, "desc");
                        }}
                      >
                        Descending
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("py-0", className)}>
      <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {leftContent ? (
          <div className="shrink-0 pr-2">{leftContent}</div>
        ) : null}

        {savedViewsScope ? (
          <div className="shrink-0">
            <TableViewsMenu
              scopeKey={savedViewsScope}
              currentState={savedViewsCurrentState}
              activeViewId={activeViewId}
              onApplyView={applySavedView}
              onResetToDefaults={resetSavedViewToDefaults}
              onAutoApplyDefault={applySavedView}
            />
          </div>
        ) : null}

        {savedViewsScope ? (
          <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" />
        ) : null}

        <div className="flex items-center gap-1 shrink-0">
          {feat.search && (
            <ExpandableSearch
              value={searchValue}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
            />
          )}

          {feat.filters && filters.length > 0 && (
            <FilterMenu
              filters={filters}
              activeFilters={activeFilters}
              onFilterChange={onFilterChange}
              onClearFilters={onClearFilters}
              viewSettings={
                feat.views
                  ? {
                      currentView,
                      onViewChange,
                      enabledViews,
                    }
                  : undefined
              }
            />
          )}

          {onGroupByChange && groupByOptions && groupByOptions.length > 0 && (
            <GroupBySwitcher
              options={groupByOptions}
              value={groupBy ?? groupByOptions[0]?.value ?? "none"}
              onChange={onGroupByChange}
            />
          )}

          {(feat.columnToggle || onDensityChange) && (
            <TableDisplaySettings
              columns={feat.columnToggle ? columns : []}
              visibleColumns={visibleColumns}
              onColumnVisibilityChange={onColumnVisibilityChange}
              columnOrder={columnOrder}
              onColumnOrderChange={onColumnOrderChange}
              density={density}
              onDensityChange={onDensityChange}
            />
          )}

          {customActions}

          {feat.export && onExport && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={onExport}
                    aria-label="Export"
                  >
                    <Download />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {feat.bulkEdit && onBulkEdit && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={selectedCount === 0}
                    onClick={onBulkEdit}
                    aria-label="Edit selected"
                  >
                    <SquarePen
                      className={cn(
                        "h-4 w-4",
                        selectedCount > 0 && "text-primary",
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {selectedCount > 0
                    ? `Edit ${selectedCount} selected`
                    : "Edit selected"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {feat.bulkDelete && onBulkDelete && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={selectedCount === 0}
                    onClick={onBulkDelete}
                  >
                    <Trash2
                      className={cn(
                        "h-4 w-4",
                        selectedCount > 0 && "text-destructive",
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {selectedCount > 0
                    ? `Delete ${selectedCount} selected`
                    : "Delete selected"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <span className="ml-auto shrink-0 pl-3 text-xs tabular-nums text-muted-foreground">
          {filteredItems === totalItems
            ? `${totalItems} ${totalItems === 1 ? "row" : "rows"}`
            : `${filteredItems} of ${totalItems} ${totalItems === 1 ? "row" : "rows"}`}
        </span>
      </div>
    </div>
  );
}
