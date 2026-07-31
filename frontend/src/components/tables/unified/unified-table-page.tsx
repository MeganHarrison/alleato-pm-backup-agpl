"use client";

import * as React from "react";
import type { ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
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
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@/lib/utils";
import { appToast as toast } from "@/lib/toast/app-toast";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { PageHeader } from "@/components/layout/page-header-unified";
import {
  PageContainer,
  type PageContainerProps,
} from "@/components/layout/PageContainer";
import { PageTabs } from "@/components/layout/PageTabs";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { EmptyState } from "@/components/ds";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { SimplePagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  TableToolbar,
  type ColumnConfig,
  type FilterConfig,
  type ViewMode,
  type TableDensity,
} from "./table-toolbar";
import { Button } from "@/components/ui/button";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Inbox,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  X,
} from "lucide-react";
import { MobileCardList } from "./mobile-card-list";
import { InlineSelectEditor } from "./inline-select-editor";

const BOOLEAN_EDIT_OPTIONS = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const INTERACTIVE_ROW_TARGET_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[role='menuitem']",
  "[contenteditable='true']",
  "[data-row-interactive='true']",
].join(", ");

const DATE_LIKE_COLUMN_PATTERN =
  /(^|[_\s-])(date|created|updated|reviewed|submitted|received|sent|issued|due|completed|closed|opened|start|end)([_\s-]|$)/i;

export const TABLE_HEADER_LABEL_CLASSNAME =
  "inline-block min-w-max shrink-0 whitespace-nowrap [word-break:keep-all]";
export const TABLE_HEADER_MOBILE_TOOLBAR_CLASSNAME = "w-auto lg:hidden";
export const TABLE_ABOVE_TABLE_TOOLBAR_CLASSNAME =
  "hidden min-w-0 justify-end lg:flex";
export const TABLE_INLINE_PAGE_TABS_CLASSNAME =
  "-mr-1 mb-0 w-full min-w-0 sm:mr-0 md:mb-0 md:w-auto md:flex-none";
export const TABLE_SPLIT_VIEW_CONTAINER_CLASSNAME =
  "flex h-full min-h-0 flex-1 min-w-0 overflow-hidden";
export const TABLE_SPLIT_VIEW_PAGE_CONTAINER_CLASSNAME =
  "flex h-full min-h-0 flex-col overflow-hidden pb-0";
export const TABLE_FULL_BLEED_PAGE_CONTAINER_CLASSNAME = "overflow-x-visible";
export const TABLE_FULL_BLEED_SCROLL_SHELL_CLASSNAME =
  "-mx-4 w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)]";
export const TABLE_SIDE_PANEL_PAGE_CONTAINER_CLASSNAME =
  "pr-0 sm:pr-0 lg:pr-0 overflow-x-visible";

export function shouldRenderRowSelection(
  features?: UnifiedTableFeatures,
): boolean {
  return features?.enableRowSelection ?? true;
}

/** Minimum width (px) a column can be dragged down to during a resize. */
export const MIN_COLUMN_RESIZE_WIDTH = 120;

/**
 * Pure width computation for a column-resize drag, clamped to the minimum.
 * Extracted so the resize floor is regression-tested without rendering the table.
 */
export function computeResizedColumnWidth(
  startWidth: number,
  deltaX: number,
): number {
  return Math.max(MIN_COLUMN_RESIZE_WIDTH, startWidth + deltaX);
}

function isInteractiveRowTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest(INTERACTIVE_ROW_TARGET_SELECTOR));
}

function isDateLikeColumn(column: ColumnConfig): boolean {
  if (column.id.endsWith("_by") || /\bby$/i.test(column.label)) {
    return false;
  }
  return (
    DATE_LIKE_COLUMN_PATTERN.test(column.id) ||
    DATE_LIKE_COLUMN_PATTERN.test(column.label)
  );
}

function parseFilterDate(
  value: unknown,
  boundary: "start" | "end",
): number | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(
    boundary === "start" ? `${value}T00:00:00` : `${value}T23:59:59.999`,
  );
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function parseColumnDateValue(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

// Compare string arrays by value to prevent redundant state updates that can trigger render loops.
function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

type SortableHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  isDragging: boolean;
};

function SortableColumnHead({
  id,
  disabled,
  className,
  style,
  ariaSort,
  onClick,
  onContextMenu,
  children,
}: {
  id: string;
  disabled: boolean;
  className?: string;
  style?: React.CSSProperties;
  ariaSort?: React.AriaAttributes["aria-sort"];
  onClick?: () => void;
  onContextMenu?: React.MouseEventHandler<HTMLTableCellElement>;
  children: (handleProps: SortableHandleProps) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });

  const resolvedStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 3 : style?.zIndex,
    opacity: isDragging ? 0.92 : style?.opacity,
  };

  return (
    <TableHead
      ref={setNodeRef}
      className={className}
      style={resolvedStyle}
      aria-sort={ariaSort}
      onClick={onClick}
      onContextMenu={onContextMenu}
      data-dragging={isDragging ? "true" : "false"}
    >
      {children({ attributes, listeners, isDragging })}
    </TableHead>
  );
}

interface TabItem {
  label: string;
  href: string;
  count?: number;
  isActive?: boolean;
  testId?: string;
  countTestId?: string;
}

export interface TableColumn<T> extends ColumnConfig {
  render: (item: T) => ReactNode;
  csvValue?: (item: T) => string;
  sortable?: boolean;
  showSortIcon?: boolean;
  sortValue?: (item: T) => string | number | null | undefined;
  align?: "left" | "center" | "right";
  /**
   * Inline editing is opt-in per column. Keep identifier/name columns as links
   * and mark operational fields editable so table views can update records in place.
   */
  editable?: boolean;
  editValue?: (item: T) => string;
  onEdit?: (item: T, value: string) => void | Promise<void>;
  editEmptyLabel?: string;
  editInputType?: React.HTMLInputTypeAttribute;
  /**
   * "cell" lets the whole cell enter edit mode. "icon" keeps rendered content
   * available for row/detail navigation and only opens editing from the pencil.
   * Name columns default to "icon".
   */
  editTrigger?: "cell" | "icon";
  /**
   * Declarative inline editor type. The component renders the matching editor
   * centrally — no per-column `renderEditor` needed:
   *  - "text" (default) / "number" / "date" → `<Input>` (also honours `editInputType`)
   *  - "select" → `InlineSelectEditor` driven by `editOptions`
   *  - "boolean" → `InlineSelectEditor` with Yes/No (or custom `editOptions`)
   * Use `renderEditor` only for genuinely custom widgets.
   */
  editType?: "text" | "number" | "date" | "boolean" | "select";
  /** Options for `editType: "select"`. For "boolean" these override the Yes/No default. */
  editOptions?: { value: string; label: string }[];
  /** Preferred column width in pixels. Applied as default when the user has not manually resized. */
  width?: number;
  /** Custom editor widget (e.g. dropdown select). Receives current value, onChange, onCommit, and onCancel. */
  renderEditor?: (props: {
    item: T;
    value: string;
    onChange: (value: string) => void;
    onCommit: (value?: string) => void;
    onCancel: () => void;
  }) => ReactNode;
}

export function shouldUseIconOnlyInlineEdit<T>(
  column: Pick<TableColumn<T>, "id" | "editTrigger">,
) {
  return column.editTrigger
    ? column.editTrigger === "icon"
    : column.id === "name";
}

type TableColumnAlignment = "left" | "center" | "right";

const TEXT_LIKE_ALIGNMENT_PATTERN =
  /(^|[_\s-])(title|name|description|reason|origin|status|scope|type|date|period|created|updated|sent|due|closed|opened)([_\s-]|$)/i;

const NUMERIC_LIKE_ALIGNMENT_PATTERN =
  /(^|[_\s-])(#|amounts?|totals?|subtotals?|balances?|costs?|values?|prices?|rates?|revenues?|budgets?|commitments?|paid|payments?|retainages?|over_under|rom|qty|quantities?|percents?|percentages?|counts?|hours?|days?|scores?|variances?|forecasts?|estimates?|estimated|actuals?|projected|remaining|income|expenses?|billed|earned|gross|net|profits?|margins?|wip|billing|changes?|orders?)([_\s-]|$)|[$%#]/i;

function resolveColumnAlignment<T>(
  column: TableColumn<T>,
  fallback: TableColumnAlignment,
): TableColumnAlignment {
  if (column.align) return column.align;

  // Normalize camelCase to space-separated so "contractValue" → "contract Value"
  const searchable = `${column.id} ${column.label}`.replace(
    /([a-z])([A-Z])/g,
    "$1 $2",
  );
  if (TEXT_LIKE_ALIGNMENT_PATTERN.test(searchable)) return fallback;
  if (NUMERIC_LIKE_ALIGNMENT_PATTERN.test(searchable)) return "right";

  return fallback;
}

export type SortDirection = "asc" | "desc";

export interface UnifiedTableFeatures {
  enableSorting?: boolean;
  enablePagination?: boolean;
  enableSearch?: boolean;
  enableViews?: boolean;
  enableFilters?: boolean;
  enableColumnToggle?: boolean;
  enableExport?: boolean;
  enableBulkDelete?: boolean;
  enableRowSelection?: boolean;
  enableRowActions?: boolean;
  enableColumnReorder?: boolean;
  enableRowReorder?: boolean;
  enableColumnPinning?: boolean;
  enableVirtualization?: boolean;
  enableInlineEditing?: boolean;
}

export interface UnifiedTablePageProps<T> {
  header: {
    title: string;
    eyebrow?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    variant?: "default" | "compact";
    mobileActionsInline?: boolean;
    titleClassName?: string;
    /** Keep title available for storage/export/reporting, but hide the visual page header. */
    hidden?: boolean;
  };
  tabs?: TabItem[];
  toolbar: {
    totalItems: number;
    filteredItems: number;
    selectedCount?: number;
    searchValue: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    currentView: ViewMode;
    onViewChange: (view: ViewMode) => void;
    enabledViews?: ViewMode[];
    /** Use the shared icon-only view switcher variant for dense toolbars. */
    viewSwitcherDisplay?: "default" | "icons";
    filters?: FilterConfig[];
    activeFilters?: Record<
      string,
      string | number | boolean | string[] | null | undefined
    >;
    onFilterChange?: (
      filters: Record<
        string,
        string | number | boolean | string[] | null | undefined
      >,
    ) => void;
    onClearFilters?: () => void;
    columns?: ColumnConfig[];
    visibleColumns?: string[];
    onColumnVisibilityChange?: (columns: string[]) => void;
    savedViewsDefaults?: {
      visibleColumns: string[];
      columnOrder?: string[];
      columnWidths?: Record<string, number>;
      sortBy: string | null;
      sortDirection: SortDirection;
      filters: Record<
        string,
        string | number | boolean | string[] | null | undefined
      >;
    };
    onExport?: () => void;
    onBulkDelete?: () => void;
    /**
     * Row-grouping options. When provided with `onGroupByChange`, the toolbar
     * renders a global icon-only "Group by" control in the icon row. The first
     * option should be the "no grouping" choice.
     */
    groupByOptions?: { value: string; label: string }[];
    groupBy?: string | null;
    onGroupByChange?: (value: string) => void;
    mobilePanelActions?: ReactNode;
    /** Extra action buttons rendered in the toolbar icon row (e.g. ERP sync) */
    customActions?: ReactNode;
    /** Content rendered on the left of the toolbar row, with icons pushed to the right */
    leftContent?: ReactNode;
    /** Render the toolbar into an external DOM node instead of the default toolbar row. */
    portalContainerId?: string;
    /**
     * Stable identifier for this table when saving views (e.g. "meetings").
     * Set this to enable the per-user "Saved views" picker. Project-agnostic —
     * a view created on project A's page applies on project B's page too.
     */
    savedViewsScope?: string;
  };
  data: {
    items: T[];
    isLoading: boolean;
    isFetching?: boolean;
    error?: Error | null;
  };
  table: {
    columns: TableColumn<T>[];
    defaultPinnedLeftColumns?: string[];
    defaultPinnedRightColumns?: string[];
    rowActions?: (item: T) => ReactNode;
    /** Called when user clicks View in the default row-actions menu. */
    onView?: (item: T) => void;
    /** Called when user clicks Edit in the default row-actions menu. */
    onEdit?: (item: T) => void;
    /** Called when user clicks Delete in the default row-actions menu. When provided without custom rowActions, renders a default "⋯" dropdown with View/Edit/Delete as available. */
    onDelete?: (item: T) => void;
    getRowId: (item: T) => string;
    onRowClick?: (item: T) => void;
    activeRowId?: string | null;
    onTableKeyDown?: (
      event: React.KeyboardEvent<HTMLDivElement>,
      visibleItems: T[],
    ) => void;
    autoFocusOnLoad?: boolean;
    stickyHeader?: boolean;
    onRowOrderChange?: (orderedRowIds: string[]) => void;
    /** Density preset. "compact" applies tighter padding and smaller text. */
    density?: "default" | "compact";
    /** Render an expandable sub-row below a table row. Return null to skip. */
    renderExpandedRow?: (
      item: T,
      colSpan: number,
      context?: {
        columns: Array<{
          id: string;
          width?: number;
          align?: TableColumnAlignment;
        }>;
        hasSelection: boolean;
        hasActions: boolean;
      },
    ) => ReactNode | null;
  };
  sorting?: {
    sortBy: string | null;
    sortDirection: SortDirection;
    onSortChange: (sortBy: string, direction: SortDirection) => void;
  };
  selection?: {
    selectedIds: string[];
    onSelectAll: (checked: boolean) => void;
    onSelectRow: (id: string, checked: boolean) => void;
  };
  views?: {
    board?: (context: {
      items: T[];
      getRowId: (item: T) => string;
      activeRowId?: string | null;
      onRowClick?: (item: T) => void;
    }) => ReactElement;
    card?: (item: T) => ReactElement;
    list?: (item: T) => ReactElement;
    split?: (context: {
      items: T[];
      getRowId: (item: T) => string;
      activeRowId?: string | null;
      selectedIds: string[];
      onSelectRow?: (id: string, checked: boolean) => void;
      onSelectAll?: (checked: boolean) => void;
      onRowClick?: (item: T) => void;
    }) => ReactElement;
    /** Group card items by a key. Returns the group label string (or "Ungrouped"). */
    cardGroupBy?: (item: T) => string;
  };
  emptyState: {
    title: string;
    description: string;
    filteredDescription: string;
    isFiltered: boolean;
    icon?: ReactNode;
    action?: ReactNode;
  };
  pagination?: {
    page: number;
    totalPages: number;
    perPage: number;
    onPageChange: (page: number) => void;
    onPerPageChange: (perPage: string) => void;
    clientSide?: boolean;
  };
  footerTotals?: {
    /** Label shown in the first visible column (default: "Totals") */
    label?: string;
    /** Map of column ID → rendered value for the footer row */
    values: Record<string, ReactNode>;
  };
  topContent?: ReactNode;
  sidePanel?: {
    content: ReactNode;
    /** Width preset. "wide" opens at 50% of the viewport on desktop. */
    variant?: "default" | "wide";
    widthClassName?: string;
    columnClassName?: string;
    /** Initial width in px (default: 560 = 35rem) */
    defaultWidth?: number;
    /** Minimum drag width in px (default: 480) */
    minWidth?: number;
    /** Maximum drag width in px (default: 960) */
    maxWidth?: number;
    /** Show collapse toggle (default: true) */
    collapsible?: boolean;
    /** Show drag handle for resizing (default: true) */
    resizable?: boolean;
    /** Keep panel sticky to viewport on desktop so it scrolls independently and stays in view (default: true). Pass false to let the panel scroll with the page. */
    sticky?: boolean;
    /** Override the inner content wrapper classes. */
    contentClassName?: string;
    /** Show the built-in desktop close button row (default: true when onClose is supplied). */
    showCloseButton?: boolean;
    /** localStorage key suffix for persisting width/collapsed state */
    storageKey?: string;
    /** Called when the details panel closes. */
    onClose?: () => void;
  };
  layout?: {
    fullBleedTable?: boolean;
    alignHeaderWithFullBleedTable?: boolean;
    removeTableFrame?: boolean;
    plainFooterTotals?: boolean;
    headerAlignment?: "left" | "center";
    toolbarInlineWithHeader?: boolean;
    /**
     * Keep the toolbar (search/filter/column/export icons) on the SAME row as
     * the tabs at every width, instead of the default (icons drop into the
     * header row below `lg`). Only meaningful when `tabs` are provided.
     */
    toolbarWithTabs?: boolean;
    maxWidth?: PageContainerProps["maxWidth"];
    containerClassName?: string;
    /** Override the card-view grid className (default: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4) */
    cardGridClassName?: string;
    /** Remove PageContainer horizontal/vertical padding (default: true) */
    containerPadding?: boolean;
    /** Minimum desktop table width in pixels. Use when columns should scroll horizontally instead of compressing. */
    minWidth?: number;
    /** Hide the built-in table/empty/pagination body when topContent owns a custom table body. */
    hideTableBody?: boolean;
  };
  features?: UnifiedTableFeatures;
  columnGroups?: Array<{ label: string; columnIds: string[] }>;
  /**
   * Optional context embedded as a metadata header in CSV exports. Provides
   * report title, project identification, and any extra fields (filters,
   * exported-by user, etc.). Applies only to the auto-built CSV exporter —
   * a custom `toolbar.onExport` overrides everything.
   */
  reportContext?: {
    projectId?: number | string;
    projectName?: string;
    projectNumber?: string | number;
    projectDescription?: string;
    /** Person triggering the export (defaults to omitted) */
    exportedBy?: string;
    /** Any extra key/value rows appended after the standard metadata block */
    extra?: Record<string, string | number | null | undefined>;
  };
}

/**
 * A toolbar cannot be rendered inline with a header that is intentionally hidden.
 * Embedded/tabbed tables therefore fall back to the standard above-table toolbar.
 */
export function shouldPlaceToolbarInlineWithHeader(
  headerHidden: boolean | undefined,
  requestedInlinePlacement: boolean | undefined,
): boolean {
  if (headerHidden) return false;
  return requestedInlinePlacement ?? true;
}

export function TableExpandedRow({
  colSpan,
  className,
  children,
}: {
  colSpan: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className={cn("p-0", className)}>
        {children}
      </TableCell>
    </TableRow>
  );
}

export function UnifiedTablePage<T>({
  header,
  tabs,
  toolbar,
  data,
  table,
  sorting,
  selection,
  views,
  emptyState,
  pagination,
  footerTotals,
  topContent,
  sidePanel,
  layout,
  features,
  columnGroups,
  reportContext,
}: UnifiedTablePageProps<T>): ReactElement {
  const resolvedFeatures: Required<UnifiedTableFeatures> = {
    enableSorting: features?.enableSorting ?? true,
    enablePagination: features?.enablePagination ?? true,
    enableSearch: features?.enableSearch ?? true,
    enableViews: features?.enableViews ?? true,
    enableFilters: features?.enableFilters ?? true,
    enableColumnToggle: features?.enableColumnToggle ?? true,
    enableExport: features?.enableExport ?? true,
    enableBulkDelete: features?.enableBulkDelete ?? true,
    enableRowSelection: features?.enableRowSelection ?? true,
    enableRowActions: features?.enableRowActions ?? true,
    enableColumnReorder: features?.enableColumnReorder ?? true,
    enableRowReorder: features?.enableRowReorder ?? true,
    enableColumnPinning: features?.enableColumnPinning ?? true,
    enableVirtualization: features?.enableVirtualization ?? false,
    // Inline editing is ON by default across all tables. It only ever activates
    // on columns explicitly marked `editable`, so this default is a no-op for
    // tables that have not opted a column in — it removes the "forgot the flag"
    // footgun, NOT a free-for-all. Pass `enableInlineEditing: false` to opt out.
    enableInlineEditing: features?.enableInlineEditing ?? true,
  };
  // Internal sort state — used when the parent does not supply a sorting prop
  const [internalSortBy, setInternalSortBy] = React.useState<string | null>(
    null,
  );
  const [internalSortDirection, setInternalSortDirection] =
    React.useState<SortDirection>("asc");
  // Internal pagination state — used when the parent does not supply a pagination prop
  const [internalPage, setInternalPage] = React.useState(1);
  const [internalPerPage, setInternalPerPage] = React.useState(25);

  // Internal selection state — used when the parent does not supply a selection prop
  const [internalSelectedIds, setInternalSelectedIds] = React.useState<
    string[]
  >([]);
  const selectedIds = selection?.selectedIds ?? internalSelectedIds;
  const handleSelectAll =
    selection?.onSelectAll ??
    ((checked: boolean) => {
      setInternalSelectedIds(
        checked ? data.items.map((item) => table.getRowId(item)) : [],
      );
    });
  const handleSelectRow =
    selection?.onSelectRow ??
    ((id: string, checked: boolean) => {
      setInternalSelectedIds((prev) =>
        checked
          ? prev.includes(id)
            ? prev
            : [...prev, id]
          : prev.filter((i) => i !== id),
      );
    });
  const effectiveSorting = React.useMemo(() => {
    if (sorting) return sorting;
    if (!resolvedFeatures.enableSorting) return undefined;
    return {
      sortBy: internalSortBy,
      sortDirection: internalSortDirection,
      onSortChange: (col: string, dir: SortDirection) => {
        setInternalSortBy(col);
        setInternalSortDirection(dir);
      },
    };
  }, [
    sorting,
    resolvedFeatures.enableSorting,
    internalSortBy,
    internalSortDirection,
  ]);

  const effectiveSelectedCount = toolbar.selectedCount ?? selectedIds.length;
  // Row selection is default-on across unified tables now. Pages that should
  // not expose selection must explicitly opt out with
  // `features.enableRowSelection: false`.
  const hasRowSelection = shouldRenderRowSelection(features);
  const hasRowActions =
    resolvedFeatures.enableRowActions &&
    Boolean(table.rowActions || table.onView || table.onDelete || table.onEdit);

  // Built-in delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState<T | null>(null);
  // Built-in bulk delete confirmation dialog state (auto-built effectiveBulkDelete only)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);

  const handleDeleteIntent = React.useCallback((item: T) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = React.useCallback(() => {
    if (itemToDelete && table.onDelete) {
      table.onDelete(itemToDelete);
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  }, [itemToDelete, table]);

  // Auto-built bulk delete: opens built-in confirmation dialog, then deletes after confirm.
  // Callers don't need to wire toolbar.onBulkDelete — providing table.onDelete is enough.
  const effectiveBulkDelete = React.useMemo(() => {
    if (toolbar.onBulkDelete) return toolbar.onBulkDelete;
    if (!table.onDelete) return undefined;
    return () => setBulkDeleteDialogOpen(true);
  }, [toolbar.onBulkDelete, table.onDelete]);

  const handleBulkDeleteConfirm = React.useCallback(() => {
    if (!table.onDelete) return;
    const itemsById = new Map(
      data.items.map((item) => [table.getRowId(item), item]),
    );
    selectedIds.forEach((id) => {
      const item = itemsById.get(id);
      if (item) table.onDelete!(item);
    });
    handleSelectAll(false);
    setBulkDeleteDialogOpen(false);
  }, [data.items, selectedIds, table, handleSelectAll]);

  // ── Internal view state ──────────────────────────────────────────────────────
  // UnifiedTablePage owns view state internally so individual pages never need
  // to wire currentView / onViewChange — the view switcher always works.
  // If the parent does manage view state (e.g. persisting to URL), calling
  // onViewChange still propagates the value upward, and the parent's
  // toolbar.currentView is honoured as the initial value and on external changes.
  const [internalView, setInternalView] = React.useState<ViewMode>(
    toolbar.currentView,
  );
  // Sync when the parent drives a view change from outside (e.g. URL navigation)
  React.useEffect(() => {
    setInternalView(toolbar.currentView);
  }, [toolbar.currentView]);

  // ── Density state — global preference persisted in localStorage ─────────
  const [density, setDensityState] = React.useState<TableDensity>(() => {
    if (typeof window === "undefined")
      return table.density === "compact" ? "compact" : "default";
    try {
      const stored = localStorage.getItem(
        "alleato:tableDensity",
      ) as TableDensity | null;
      if (
        stored === "compact" ||
        stored === "default" ||
        stored === "comfortable"
      )
        return stored;
    } catch (error) {
      reportNonCriticalFailure({
        area: "unified-table-page",
        operation: "load-density-preference",
        error,
        userVisibleFallback: "Saved table density could not be restored.",
        metadata: { tableTitle: header.title },
      });
    }
    return table.density === "compact" ? "compact" : "default";
  });

  const handleDensityChange = React.useCallback(
    (next: TableDensity) => {
      setDensityState(next);
      try {
        localStorage.setItem("alleato:tableDensity", next);
      } catch (error) {
        reportNonCriticalFailure({
          area: "unified-table-page",
          operation: "save-density-preference",
          error,
          userVisibleFallback: "Table density preference was not saved.",
          metadata: { tableTitle: header.title, density: next },
        });
      }
    },
    [header.title],
  );

  const activeView = internalView;

  const handleViewChange = React.useCallback(
    (view: ViewMode) => {
      setInternalView(view);
      toolbar.onViewChange(view);
    },
    [toolbar],
  );

  // Derive available views from what renderers are actually provided.
  // Honour an explicit override from the caller; otherwise auto-include
  // "board" / "card" / "list" / "split" only when the views prop supplies renderers.
  const effectiveEnabledViews: ViewMode[] = React.useMemo(() => {
    if (toolbar.enabledViews && toolbar.enabledViews.length > 0)
      return toolbar.enabledViews;
    const derived: ViewMode[] = ["table"];
    if (views?.board) derived.push("board");
    if (views?.card) derived.push("card");
    if (views?.list) derived.push("list");
    if (views?.split) derived.push("split");
    return derived;
  }, [
    toolbar.enabledViews,
    views?.board,
    views?.card,
    views?.list,
    views?.split,
  ]);

  const canRenderBoardView =
    resolvedFeatures.enableViews &&
    activeView === "board" &&
    Boolean(views?.board);
  const canRenderCardView =
    resolvedFeatures.enableViews &&
    activeView === "card" &&
    Boolean(views?.card);
  const canRenderListView =
    resolvedFeatures.enableViews &&
    activeView === "list" &&
    Boolean(views?.list);
  const canRenderSplitView =
    resolvedFeatures.enableViews &&
    activeView === "split" &&
    Boolean(views?.split);
  const shouldRenderTableView =
    activeView === "table" ||
    (!canRenderBoardView &&
      !canRenderCardView &&
      !canRenderListView &&
      !canRenderSplitView);
  const isFullBleedTable = layout?.fullBleedTable ?? false;
  const hideTableBody = layout?.hideTableBody ?? false;
  const alignHeaderWithFullBleedTable =
    layout?.alignHeaderWithFullBleedTable ?? false;
  const removeTableFrame = layout?.removeTableFrame ?? false;
  const plainFooterTotals = layout?.plainFooterTotals ?? false;
  const headerAlignment = layout?.headerAlignment ?? "left";
  const toolbarInlineWithHeader = shouldPlaceToolbarInlineWithHeader(
    header.hidden,
    layout?.toolbarInlineWithHeader,
  );
  const toolbarWithTabs = (layout?.toolbarWithTabs ?? false) && Boolean(tabs);
  const containerMaxWidth = layout?.maxWidth ?? "full";
  const containerClassName = layout?.containerClassName;
  const containerPadding = layout?.containerPadding !== false;
  const shouldUseFullBleedDesktopScrollShell =
    isFullBleedTable && containerPadding && !sidePanel;
  const toolbarColumns: ColumnConfig[] = React.useMemo(
    () =>
      toolbar.columns ??
      table.columns.map((column) => ({
        id: column.id,
        label: column.label,
        defaultVisible: column.defaultVisible,
        alwaysVisible: column.alwaysVisible,
      })),
    [table.columns, toolbar.columns],
  );
  const effectiveToolbarFilters = React.useMemo<FilterConfig[]>(() => {
    const providedFilters = toolbar.filters ?? [];
    const providedFilterIds = new Set(
      providedFilters.map((filter) => filter.id),
    );
    const autoDateRangeFilters = table.columns
      .filter(
        (column) =>
          (column.defaultVisible !== false || column.alwaysVisible) &&
          isDateLikeColumn(column) &&
          !providedFilterIds.has(column.id),
      )
      .map((column) => ({
        id: column.id,
        label: column.label,
        type: "dateRange" as const,
      }));

    return [...providedFilters, ...autoDateRangeFilters];
  }, [table.columns, toolbar.filters]);
  // Internal column visibility — persisted to localStorage when the caller
  // does not supply toolbar.visibleColumns / toolbar.onColumnVisibilityChange.
  const colStorageKey = `alleato:cols:${header.title}`;
  const [internalVisibleColumns, setInternalVisibleColumns] = React.useState<
    string[]
  >(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`alleato:cols:${header.title}`);
        if (stored) {
          const parsed = JSON.parse(stored) as unknown;
          if (Array.isArray(parsed) && parsed.length > 0)
            return parsed as string[];
        }
      } catch (error) {
        reportNonCriticalFailure({
          area: "unified-table-page",
          operation: "load-column-preferences",
          error,
          userVisibleFallback:
            "Saved table column preferences could not be restored.",
          metadata: { tableTitle: header.title },
        });
      }
    }
    const baseCols = (toolbar.columns ?? table.columns) as Array<{
      id: string;
      defaultVisible?: boolean;
      alwaysVisible?: boolean;
    }>;
    return baseCols
      .filter((c) => c.defaultVisible !== false || c.alwaysVisible)
      .map((c) => c.id);
  });
  // Always include alwaysVisible columns even if stale localStorage omits them
  const rawVisibleColumns = toolbar.visibleColumns ?? internalVisibleColumns;
  const visibleColumns = React.useMemo(() => {
    const alwaysVisibleIds = toolbarColumns
      .filter((c) => c.alwaysVisible)
      .map((c) => c.id);
    const missing = alwaysVisibleIds.filter(
      (id) => !rawVisibleColumns.includes(id),
    );
    if (missing.length === 0) return rawVisibleColumns;
    const visibleSet = new Set([...rawVisibleColumns, ...missing]);
    return toolbarColumns
      .map((column) => column.id)
      .filter((id) => visibleSet.has(id));
  }, [rawVisibleColumns, toolbarColumns]);
  const activeFilters = toolbar.activeFilters ?? {};
  const handleFilterChange =
    toolbar.onFilterChange ??
    (() => {
      // no-op by default so pages without filters don't need wiring
    });
  const handleClearFilters =
    toolbar.onClearFilters ??
    (() => {
      // no-op by default so pages without filters don't need wiring
    });
  const handleColumnVisibilityChange = React.useCallback(
    (columns: string[]) => {
      if (toolbar.onColumnVisibilityChange) {
        toolbar.onColumnVisibilityChange(columns);
      } else {
        setInternalVisibleColumns(columns);
        try {
          localStorage.setItem(colStorageKey, JSON.stringify(columns));
        } catch (error) {
          reportNonCriticalFailure({
            area: "unified-table-page",
            operation: "save-column-preferences",
            error,
            userVisibleFallback: "Table column preferences were not saved.",
            metadata: { tableTitle: header.title },
          });
        }
      }
    },
    [toolbar.onColumnVisibilityChange, colStorageKey],
  );
  const [columnWidths, setColumnWidths] = React.useState<
    Record<string, number>
  >({});
  const [columnOrder, setColumnOrder] =
    React.useState<string[]>(visibleColumns);
  const [columnPinning, setColumnPinning] = React.useState<{
    left: string[];
    right: string[];
  }>(() => ({
    left: table.defaultPinnedLeftColumns ?? [],
    right: table.defaultPinnedRightColumns ?? [],
  }));
  const [rowOrderIds, setRowOrderIds] = React.useState<string[]>([]);
  const [draggedRowId, setDraggedRowId] = React.useState<string | null>(null);
  const [editingCell, setEditingCell] = React.useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [editingValue, setEditingValue] = React.useState("");
  const [savingCell, setSavingCell] = React.useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [inlineEdits, setInlineEdits] = React.useState<Record<string, string>>(
    {},
  );
  const tableScrollRef = React.useRef<HTMLDivElement>(null);
  // Horizontal-scroll affordance: when a table is wider than the viewport, a
  // partially-visible trailing column must read as "scroll for more" — not as a
  // random/broken clip. We fade the leading/trailing edges whenever there is more
  // content to scroll to in that direction. Fixed here once so every table page
  // inherits it (design-audit DA-001).
  const [tableScrollEdges, setTableScrollEdges] = React.useState<{
    left: boolean;
    right: boolean;
  }>({ left: false, right: false });
  const rowRefs = React.useRef<Record<string, HTMLTableRowElement | null>>({});
  const resizeStateRef = React.useRef<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  // True from the first drag movement until the synthetic click that follows
  // mouseup is consumed — lets the header's onClick skip sorting after a resize.
  const didResizeRef = React.useRef(false);
  // Coalesces mousemove width updates into one state write per animation frame.
  const resizeRafRef = React.useRef<number | null>(null);
  const hasUserManagedColumnOrderRef = React.useRef(false);
  const selectionColumnWidth = 40;

  // ── Side panel collapse & resize state ───────────────────────────────
  const panelVariant = sidePanel?.variant ?? "default";
  const getPanelDefaultWidth = React.useCallback(() => {
    if (sidePanel?.defaultWidth != null) return sidePanel.defaultWidth;
    if (panelVariant === "wide" && typeof window !== "undefined") {
      return Math.round(window.innerWidth * 0.5);
    }
    return 560;
  }, [panelVariant, sidePanel?.defaultWidth]);
  const getPanelMaxWidth = React.useCallback(() => {
    if (sidePanel?.maxWidth != null) return sidePanel.maxWidth;
    if (panelVariant === "wide" && typeof window !== "undefined") {
      return Math.round(window.innerWidth * 0.75);
    }
    return 960;
  }, [panelVariant, sidePanel?.maxWidth]);
  const panelStorageKey = sidePanel?.storageKey ?? "unified-table-side-panel";
  const panelDefaultWidth = getPanelDefaultWidth();
  const panelMinWidth =
    sidePanel?.minWidth ?? (panelVariant === "wide" ? 520 : 480);
  const panelMaxWidth = getPanelMaxWidth();
  const panelCollapsible = sidePanel?.collapsible !== false;
  const panelResizable = sidePanel?.resizable !== false;
  const panelSticky = sidePanel?.sticky !== false;

  const [panelCollapsed, setPanelCollapsed] = React.useState(false);
  const [panelWidth, setPanelWidth] = React.useState(panelDefaultWidth);
  const [panelMounted, setPanelMounted] = React.useState(false);
  const [isResizingPanel, setIsResizingPanel] = React.useState(false);
  const [panelToggleLeft, setPanelToggleLeft] = React.useState<number | null>(
    null,
  );
  const panelResizeRef = React.useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const isSidePanelOpen = Boolean(sidePanel && table.activeRowId);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  React.useEffect(() => {
    if (!sidePanel) return;
    try {
      const stored = localStorage.getItem(`alleato-panel-${panelStorageKey}`);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          collapsed?: boolean;
          width?: number;
        };
        if (typeof parsed.collapsed === "boolean")
          setPanelCollapsed(parsed.collapsed);
        if (typeof parsed.width === "number") {
          const clampedWidth = Math.max(
            panelMinWidth,
            Math.min(panelMaxWidth, parsed.width),
          );
          setPanelWidth(clampedWidth);
        }
      } else {
        setPanelWidth(
          Math.max(
            panelMinWidth,
            Math.min(panelMaxWidth, getPanelDefaultWidth()),
          ),
        );
      }
    } catch (error) {
      reportNonCriticalFailure({
        area: "unified-table-page",
        operation: "load-side-panel-preferences",
        error,
        userVisibleFallback:
          "Saved table panel preferences could not be restored.",
        metadata: { panelStorageKey },
      });
    }
    setPanelMounted(true);
  }, [
    getPanelDefaultWidth,
    panelMaxWidth,
    panelMinWidth,
    panelStorageKey,
    sidePanel,
  ]);

  const persistPanel = React.useCallback(
    (collapsed: boolean, width: number) => {
      try {
        localStorage.setItem(
          `alleato-panel-${panelStorageKey}`,
          JSON.stringify({ collapsed, width }),
        );
      } catch (error) {
        reportNonCriticalFailure({
          area: "unified-table-page",
          operation: "save-side-panel-preferences",
          error,
          userVisibleFallback: "Table panel preferences were not saved.",
          metadata: { panelStorageKey },
        });
      }
    },
    [panelStorageKey],
  );

  React.useEffect(() => {
    if (!isSidePanelOpen) return;
    setPanelCollapsed(false);
    persistPanel(false, panelWidth);
  }, [isSidePanelOpen, panelWidth, persistPanel]);

  const togglePanelCollapsed = React.useCallback(() => {
    setPanelCollapsed((prev) => {
      const next = !prev;
      persistPanel(next, panelWidth);
      return next;
    });
  }, [panelWidth, persistPanel]);

  const updatePanelTogglePosition = React.useCallback(() => {
    if (!isSidePanelOpen || !panelMounted) {
      setPanelToggleLeft(null);
      return;
    }
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect) return;

    const dividerX = panelCollapsed
      ? gridRect.right
      : gridRect.right - panelWidth;
    // Button width is 20px (w-5); offset by half width so its center sits on the divider.
    setPanelToggleLeft(dividerX - 10);
  }, [isSidePanelOpen, panelCollapsed, panelMounted, panelWidth]);

  // Panel resize drag handlers (mirrors column resize pattern)
  const handlePanelResizeStart = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      panelResizeRef.current = {
        startX: event.clientX,
        startWidth: panelWidth,
      };
      setIsResizingPanel(true);
      document.body.style.cursor = "col-resize";
    },
    [panelWidth],
  );

  React.useEffect(() => {
    if (!isResizingPanel) return;

    const handleMouseMove = (event: MouseEvent) => {
      const state = panelResizeRef.current;
      if (!state) return;
      // Dragging left = wider panel (handle is on left edge)
      const delta = state.startX - event.clientX;
      const maxAllowed = Math.min(panelMaxWidth, window.innerWidth * 0.75);
      const next = Math.max(
        panelMinWidth,
        Math.min(maxAllowed, state.startWidth + delta),
      );
      setPanelWidth(next);
    };

    const handleMouseUp = () => {
      panelResizeRef.current = null;
      setIsResizingPanel(false);
      document.body.style.cursor = "";
      // Persist final width
      setPanelWidth((w) => {
        persistPanel(panelCollapsed, w);
        return w;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [
    isResizingPanel,
    panelCollapsed,
    panelMaxWidth,
    panelMinWidth,
    persistPanel,
  ]);

  React.useEffect(() => {
    updatePanelTogglePosition();
  }, [updatePanelTogglePosition]);

  React.useEffect(() => {
    if (!isSidePanelOpen || !panelMounted) return;

    const syncTogglePosition = () => {
      updatePanelTogglePosition();
    };

    window.addEventListener("resize", syncTogglePosition);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && gridRef.current) {
      observer = new ResizeObserver(syncTogglePosition);
      observer.observe(gridRef.current);
    }

    return () => {
      window.removeEventListener("resize", syncTogglePosition);
      observer?.disconnect();
    };
  }, [isSidePanelOpen, panelMounted, updatePanelTogglePosition]);

  const dateRangeFilteredItems = React.useMemo(() => {
    const dateRangeFilters = effectiveToolbarFilters.filter(
      (filter) => filter.type === "dateRange",
    );
    const activeDateRangeFilters = dateRangeFilters
      .map((filter) => {
        const from = parseFilterDate(
          activeFilters[`${filter.id}_from`],
          "start",
        );
        const to = parseFilterDate(activeFilters[`${filter.id}_to`], "end");
        if (from === null && to === null) return null;

        const column = table.columns.find(
          (candidate) => candidate.id === filter.id,
        );
        if (!column?.sortValue) return null;

        return { column, from, to };
      })
      .filter(
        (
          filter,
        ): filter is {
          column: TableColumn<T>;
          from: number | null;
          to: number | null;
        } => Boolean(filter),
      );

    if (activeDateRangeFilters.length === 0) return data.items;

    return data.items.filter((item) =>
      activeDateRangeFilters.every(({ column, from, to }) => {
        const value = parseColumnDateValue(column.sortValue?.(item));
        if (value === null) return false;
        if (from !== null && value < from) return false;
        if (to !== null && value > to) return false;
        return true;
      }),
    );
  }, [activeFilters, data.items, effectiveToolbarFilters, table.columns]);

  const sortedItems = React.useMemo(() => {
    if (!effectiveSorting?.sortBy) return dateRangeFilteredItems;
    const column = table.columns.find(
      (col) => col.id === effectiveSorting.sortBy,
    );
    const getSortValue = column?.sortValue;
    if (!getSortValue) return dateRangeFilteredItems;

    const sorted = [...dateRangeFilteredItems].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      if (valueA == null && valueB == null) return 0;
      if (valueA == null)
        return effectiveSorting!.sortDirection === "asc" ? -1 : 1;
      if (valueB == null)
        return effectiveSorting!.sortDirection === "asc" ? 1 : -1;

      if (typeof valueA === "number" && typeof valueB === "number") {
        return effectiveSorting!.sortDirection === "asc"
          ? valueA - valueB
          : valueB - valueA;
      }

      const comparison = String(valueA).localeCompare(String(valueB));
      return effectiveSorting!.sortDirection === "asc"
        ? comparison
        : -comparison;
    });

    return sorted;
  }, [
    dateRangeFilteredItems,
    effectiveSorting?.sortBy,
    effectiveSorting?.sortDirection,
    table.columns,
  ]);

  React.useEffect(() => {
    if (!hasUserManagedColumnOrderRef.current) {
      setColumnOrder((prev) =>
        areStringArraysEqual(prev, visibleColumns) ? prev : visibleColumns,
      );
      return;
    }

    setColumnOrder((prev) => {
      const nextVisible = new Set(visibleColumns);
      const preserved = prev.filter((id) => nextVisible.has(id));
      const additions = visibleColumns.filter((id) => !preserved.includes(id));
      const nextOrder = [...preserved, ...additions];
      return areStringArraysEqual(prev, nextOrder) ? prev : nextOrder;
    });
  }, [visibleColumns]);

  const defaultPinnedLeftSignature = React.useMemo(
    () => (table.defaultPinnedLeftColumns ?? []).join("|"),
    [table.defaultPinnedLeftColumns],
  );
  const defaultPinnedRightSignature = React.useMemo(
    () => (table.defaultPinnedRightColumns ?? []).join("|"),
    [table.defaultPinnedRightColumns],
  );

  React.useEffect(() => {
    const nextLeft = table.defaultPinnedLeftColumns ?? [];
    const nextRight = table.defaultPinnedRightColumns ?? [];
    setColumnPinning((prev) => {
      const prevLeft = prev.left.join("|");
      const prevRight = prev.right.join("|");
      if (
        prevLeft === defaultPinnedLeftSignature &&
        prevRight === defaultPinnedRightSignature
      ) {
        return prev;
      }
      return { left: nextLeft, right: nextRight };
    });
  }, [
    defaultPinnedLeftSignature,
    defaultPinnedRightSignature,
    table.defaultPinnedLeftColumns,
    table.defaultPinnedRightColumns,
  ]);

  const rowOrderedItems = React.useMemo(() => {
    const isManualRowOrderEnabled =
      resolvedFeatures.enableRowReorder && !effectiveSorting?.sortBy;
    if (!isManualRowOrderEnabled) return sortedItems;
    if (rowOrderIds.length === 0) return sortedItems;

    const byId = new Map(
      sortedItems.map((item) => [table.getRowId(item), item]),
    );
    const ordered = rowOrderIds
      .map((id) => byId.get(id))
      .filter((item): item is T => Boolean(item));
    const orderedIds = new Set(ordered.map((item) => table.getRowId(item)));
    const remaining = sortedItems.filter(
      (item) => !orderedIds.has(table.getRowId(item)),
    );
    return [...ordered, ...remaining];
  }, [
    resolvedFeatures.enableRowReorder,
    rowOrderIds,
    sortedItems,
    effectiveSorting?.sortBy,
    table,
  ]);

  // Auto-built CSV exporter: used when toolbar.onExport is not provided.
  // Only exports columns that define csvValue — columns without it are silently skipped.
  const effectiveOnExport = React.useMemo(() => {
    if (toolbar.onExport) return toolbar.onExport;
    if (!resolvedFeatures.enableExport) return undefined;
    const exportableCols = visibleColumns
      .map((id) => table.columns.find((c) => c.id === id))
      .filter((c): c is TableColumn<T> => Boolean(c?.csvValue));
    if (exportableCols.length === 0) return undefined;
    return () => {
      const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
      const metaRow = (label: string, value: string) =>
        `${escape(label)},${escape(value)}`;

      const exportedAt = new Date();
      const exportedIso = exportedAt.toISOString().slice(0, 10);

      // Metadata block — only emitted when reportContext is provided.
      const metaLines: string[] = [];
      if (reportContext) {
        const projectLabel =
          reportContext.projectName && reportContext.projectNumber
            ? `${reportContext.projectNumber} — ${reportContext.projectName}`
            : reportContext.projectName ||
              (reportContext.projectNumber != null
                ? String(reportContext.projectNumber)
                : "");

        metaLines.push(metaRow("Report", header.title));
        if (projectLabel) metaLines.push(metaRow("Project", projectLabel));
        if (reportContext.projectDescription) {
          metaLines.push(
            metaRow("Description", reportContext.projectDescription),
          );
        }
        metaLines.push(metaRow("Exported", exportedAt.toISOString()));
        if (reportContext.exportedBy) {
          metaLines.push(metaRow("Exported by", reportContext.exportedBy));
        }
        if (reportContext.extra) {
          for (const [key, value] of Object.entries(reportContext.extra)) {
            if (value === null || value === undefined || value === "") continue;
            metaLines.push(metaRow(key, String(value)));
          }
        }
        // Blank separator line between metadata and the table.
        metaLines.push("");
      }

      const headers = exportableCols.map((c) => escape(c.label)).join(",");
      const rows = rowOrderedItems.map((item) =>
        exportableCols
          .map((c) => escape(String(c.csvValue!(item) ?? "")))
          .join(","),
      );
      const csv = [...metaLines, headers, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      const slug = header.title.toLowerCase().replace(/\s+/g, "-");
      const projectToken =
        reportContext?.projectNumber != null
          ? `${reportContext.projectNumber}-`
          : "";
      a.href = url;
      a.download = `${projectToken}${slug}-${exportedIso}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }, [
    toolbar.onExport,
    resolvedFeatures.enableExport,
    visibleColumns,
    table.columns,
    rowOrderedItems,
    header.title,
    reportContext,
  ]);

  React.useEffect(() => {
    if (!resolvedFeatures.enableRowReorder || effectiveSorting?.sortBy) {
      setRowOrderIds((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const nextIds = rowOrderedItems.map((item) => table.getRowId(item));
    setRowOrderIds((prev) => {
      if (prev.length === 0) {
        return areStringArraysEqual(prev, nextIds) ? prev : nextIds;
      }
      const seen = new Set(nextIds);
      const preserved = prev.filter((id) => seen.has(id));
      const additions = nextIds.filter((id) => !preserved.includes(id));
      const nextOrder = [...preserved, ...additions];
      return areStringArraysEqual(prev, nextOrder) ? prev : nextOrder;
    });
  }, [
    resolvedFeatures.enableRowReorder,
    rowOrderedItems,
    effectiveSorting?.sortBy,
    table,
  ]);

  // Slice client-side when: caller passes pagination.clientSide, OR no pagination prop + enablePagination.
  const shouldClientPaginate =
    pagination?.clientSide ||
    (!pagination && resolvedFeatures.enablePagination);
  const activePage = pagination?.page ?? internalPage;
  const activePerPage = pagination?.perPage ?? internalPerPage;

  const paginatedItems = React.useMemo(() => {
    if (!shouldClientPaginate) return rowOrderedItems;
    const start = (activePage - 1) * activePerPage;
    return rowOrderedItems.slice(start, start + activePerPage);
  }, [shouldClientPaginate, activePage, activePerPage, rowOrderedItems]);

  const allSelected =
    rowOrderedItems.length > 0 &&
    rowOrderedItems.every((item) => selectedIds.includes(table.getRowId(item)));
  const someSelected = selectedIds.length > 0 && !allSelected;

  const showEmptyState =
    !hideTableBody &&
    !data.isLoading &&
    !data.error &&
    rowOrderedItems.length === 0;
  const showTable =
    !hideTableBody &&
    !data.isLoading &&
    !data.error &&
    rowOrderedItems.length > 0;

  const handleSortClick = (columnId: string) => {
    if (!effectiveSorting) return;
    const nextDirection =
      effectiveSorting.sortBy === columnId &&
      effectiveSorting.sortDirection === "asc"
        ? "desc"
        : "asc";
    effectiveSorting.onSortChange(columnId, nextDirection);
  };

  const renderSortIcon = (columnId: string) => {
    if (!effectiveSorting || effectiveSorting.sortBy !== columnId) {
      return (
        <ChevronDown className="ml-1 h-3 w-3 text-muted-foreground/0 group-hover/th:text-muted-foreground/55 transition-colors" />
      );
    }

    return effectiveSorting.sortDirection === "asc" ? (
      <ChevronUp className="ml-1 h-3 w-3 text-muted-foreground/65" />
    ) : (
      <ChevronDown className="ml-1 h-3 w-3 text-muted-foreground/65" />
    );
  };

  const hideColumn = React.useCallback(
    (columnId: string) => {
      if (visibleColumns.length <= 1) return;
      handleColumnVisibilityChange(
        visibleColumns.filter((existingId) => existingId !== columnId),
      );
    },
    [handleColumnVisibilityChange, visibleColumns],
  );

  const orderedVisibleColumns = React.useMemo(() => {
    const visibleSet = new Set(visibleColumns);
    const fromOrder = columnOrder.filter((id) => visibleSet.has(id));
    const missing = visibleColumns.filter((id) => !fromOrder.includes(id));
    const merged = [...fromOrder, ...missing];
    const leftPinned = columnPinning.left.filter((id) => merged.includes(id));
    const rightPinned = columnPinning.right.filter((id) => merged.includes(id));
    const unpinned = merged.filter(
      (id) => !leftPinned.includes(id) && !rightPinned.includes(id),
    );
    return [...leftPinned, ...unpinned, ...rightPinned]
      .map((id) => table.columns.find((column) => column.id === id))
      .filter((column): column is TableColumn<T> => Boolean(column));
  }, [
    columnOrder,
    columnPinning.left,
    columnPinning.right,
    table.columns,
    visibleColumns,
  ]);

  const leftPinnedOffsets = React.useMemo(() => {
    let offset = 0;
    const result: Record<string, number> = {};
    for (const column of orderedVisibleColumns) {
      if (!columnPinning.left.includes(column.id)) continue;
      result[column.id] = offset;
      offset += columnWidths[column.id] ?? column.width ?? 180;
    }
    return result;
  }, [columnPinning.left, columnWidths, orderedVisibleColumns]);

  const rightPinnedOffsets = React.useMemo(() => {
    let offset = hasRowActions ? 50 : 0;
    const result: Record<string, number> = {};
    for (let index = orderedVisibleColumns.length - 1; index >= 0; index -= 1) {
      const column = orderedVisibleColumns[index];
      if (!columnPinning.right.includes(column.id)) continue;
      result[column.id] = offset;
      offset += columnWidths[column.id] ?? column.width ?? 180;
    }
    return result;
  }, [columnPinning.right, columnWidths, hasRowActions, orderedVisibleColumns]);

  const pinColumn = React.useCallback((columnId: string) => {
    setColumnPinning((prev) => {
      if (prev.left.includes(columnId)) {
        return {
          left: prev.left.filter((id) => id !== columnId),
          right: prev.right.filter((id) => id !== columnId),
        };
      }
      return {
        left: [...prev.left.filter((id) => id !== columnId), columnId],
        right: prev.right.filter((id) => id !== columnId),
      };
    });
  }, []);

  const handleColumnDragEnd = React.useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;

      const currentOrder = orderedVisibleColumns.map((column) => column.id);
      const oldIndex = currentOrder.indexOf(String(active.id));
      const newIndex = currentOrder.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;

      const reordered = arrayMove(currentOrder, oldIndex, newIndex);
      hasUserManagedColumnOrderRef.current = true;
      setColumnOrder(reordered);
      handleColumnVisibilityChange(reordered);
    },
    [handleColumnVisibilityChange, orderedVisibleColumns],
  );

  const handleRowDrop = React.useCallback(
    (targetRowId: string) => {
      if (!draggedRowId || draggedRowId === targetRowId) return;
      const currentOrder = rowOrderedItems.map((item) => table.getRowId(item));
      const oldIndex = currentOrder.indexOf(draggedRowId);
      const newIndex = currentOrder.indexOf(targetRowId);
      if (oldIndex < 0 || newIndex < 0) return;

      const reordered = [...currentOrder];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      setRowOrderIds(reordered);
      table.onRowOrderChange?.(reordered);
    },
    [draggedRowId, rowOrderedItems, table],
  );

  const visibleLeftPinnedColumnIds = React.useMemo(
    () =>
      orderedVisibleColumns
        .map((column) => column.id)
        .filter((columnId) => columnPinning.left.includes(columnId)),
    [columnPinning.left, orderedVisibleColumns],
  );
  const visibleRightPinnedColumnIds = React.useMemo(
    () =>
      orderedVisibleColumns
        .map((column) => column.id)
        .filter((columnId) => columnPinning.right.includes(columnId)),
    [columnPinning.right, orderedVisibleColumns],
  );
  const lastLeftPinnedColumnId = visibleLeftPinnedColumnIds.at(-1);
  const firstRightPinnedColumnId = visibleRightPinnedColumnIds[0];
  const columnDndContextId = React.useId();
  const columnDndSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );
  const columnSortableIds = React.useMemo(
    () => orderedVisibleColumns.map((column) => column.id),
    [orderedVisibleColumns],
  );
  const getPinnedStyle = React.useCallback(
    (columnId: string): React.CSSProperties | undefined => {
      if (!resolvedFeatures.enableColumnPinning) return undefined;
      if (columnPinning.left.includes(columnId)) {
        const isPinnedBoundary = columnId === lastLeftPinnedColumnId;
        return {
          position: "sticky",
          left: leftPinnedOffsets[columnId] ?? 0,
          zIndex: 2,
          background: "hsl(var(--background))",
          boxShadow: isPinnedBoundary
            ? "inset -1px 0 0 hsl(var(--border)), 6px 0 8px -8px rgba(15,23,42,0.35)"
            : undefined,
        };
      }
      if (columnPinning.right.includes(columnId)) {
        const isPinnedBoundary = columnId === firstRightPinnedColumnId;
        return {
          position: "sticky",
          right: rightPinnedOffsets[columnId] ?? 0,
          zIndex: 2,
          background: "hsl(var(--background))",
          boxShadow: isPinnedBoundary
            ? "inset 1px 0 0 hsl(var(--border)), -6px 0 8px -8px rgba(15,23,42,0.35)"
            : undefined,
        };
      }
      return undefined;
    },
    [
      columnPinning.left,
      columnPinning.right,
      firstRightPinnedColumnId,
      lastLeftPinnedColumnId,
      leftPinnedOffsets,
      resolvedFeatures.enableColumnPinning,
      rightPinnedOffsets,
    ],
  );

  const commitInlineEdit = React.useCallback(
    async (item: T, column: TableColumn<T>, rowId: string, value: string) => {
      const cellKey = `${rowId}::${column.id}`;
      const nextValue = value.trim();
      const currentValue =
        inlineEdits[cellKey] ?? column.editValue?.(item) ?? "";

      if (nextValue === currentValue) {
        setEditingCell(null);
        setEditingValue("");
        return;
      }

      try {
        setSavingCell({ rowId, columnId: column.id });
        if (column.onEdit) {
          await column.onEdit(item, nextValue);
        }
        setInlineEdits((prev) => ({ ...prev, [cellKey]: nextValue }));
        toast.success(`${column.label} updated`, {
          id: `unified-table-cell-updated-${column.id}`,
        });
      } catch (error) {
        toast.error("Cell update issue", {
          id: "unified-table-cell-update",
          description:
            error instanceof Error
              ? error.message
              : "The edited cell was restored because the save request did not complete.",
        });
      } finally {
        setEditingCell(null);
        setEditingValue("");
        setSavingCell(null);
      }
    },
    [inlineEdits],
  );

  const startInlineEdit = React.useCallback(
    (item: T, column: TableColumn<T>) => {
      if (!resolvedFeatures.enableInlineEditing) return;
      if (!column.editable || !column.editValue) return;

      const rowId = table.getRowId(item);
      const cellKey = `${rowId}::${column.id}`;
      setEditingCell({ rowId, columnId: column.id });
      setEditingValue(inlineEdits[cellKey] ?? column.editValue(item));
    },
    [inlineEdits, resolvedFeatures.enableInlineEditing, table],
  );

  const rowVirtualizer = useVirtualizer({
    count: paginatedItems.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => 52,
    overscan: 8,
    enabled: resolvedFeatures.enableVirtualization,
  });

  const activateRow = React.useCallback(
    (item: T) => {
      tableScrollRef.current?.focus();
      table.onRowClick?.(item);
      const rowId = table.getRowId(item);
      rowRefs.current[rowId]?.scrollIntoView({ block: "nearest" });
    },
    [table],
  );

  React.useEffect(() => {
    if (!table.autoFocusOnLoad) return;
    if (!showTable || !shouldRenderTableView) return;

    const raf = window.requestAnimationFrame(() => {
      tableScrollRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [showTable, shouldRenderTableView, table.autoFocusOnLoad]);

  // Track horizontal-scroll position so the edge fades signal "more columns →"
  // (design-audit DA-001). Recomputes on scroll, viewport resize, and whenever the
  // rendered table changes width (column show/hide/resize, data load).
  React.useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) {
      setTableScrollEdges({ left: false, right: false });
      return;
    }

    const update = () => {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const overflows = maxScroll > 1;
      setTableScrollEdges({
        left: overflows && el.scrollLeft > 1,
        right: overflows && el.scrollLeft < maxScroll - 1,
      });
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(update);
      observer.observe(el);
      const innerTable = el.querySelector("table");
      if (innerTable) observer.observe(innerTable);
    }

    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [showTable, shouldRenderTableView, paginatedItems, visibleColumns]);

  const handleTableKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    table.onTableKeyDown?.(event, paginatedItems);
    if (event.defaultPrevented || paginatedItems.length === 0) return;
    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Tab"
    )
      return;
    if (
      event.target instanceof HTMLElement &&
      ["INPUT", "TEXTAREA"].includes(event.target.tagName)
    ) {
      return;
    }

    event.preventDefault();
    const currentIndex = table.activeRowId
      ? paginatedItems.findIndex(
          (item) => table.getRowId(item) === table.activeRowId,
        )
      : -1;
    const step =
      event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)
        ? -1
        : 1;
    const fallbackStart = step > 0 ? 0 : paginatedItems.length - 1;
    const nextIndex =
      currentIndex < 0
        ? fallbackStart
        : Math.min(Math.max(currentIndex + step, 0), paginatedItems.length - 1);
    const nextItem = paginatedItems[nextIndex];
    if (!nextItem) return;
    activateRow(nextItem);
  };

  const handleColumnResizeStart = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>, columnId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const headerCell = event.currentTarget.closest("th");
      if (!(headerCell instanceof HTMLElement)) return;

      resizeStateRef.current = {
        columnId,
        startX: event.clientX,
        startWidth: headerCell.getBoundingClientRect().width,
      };
      didResizeRef.current = false;
      // Suppress text selection and lock the resize cursor for the whole drag.
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      // Attach listeners synchronously here — NOT via an effect keyed on state —
      // so the drag is tracked from the very first pixel instead of after a
      // re-render (which is slow on large tables and made resize feel laggy).
      const handleMouseMove = (moveEvent: MouseEvent) => {
        const resizeState = resizeStateRef.current;
        if (!resizeState) return;
        didResizeRef.current = true;
        const deltaX = moveEvent.clientX - resizeState.startX;
        const nextWidth = computeResizedColumnWidth(
          resizeState.startWidth,
          deltaX,
        );
        // Coalesce into one state write per frame so a fast drag doesn't
        // re-render the whole table body on every mousemove event.
        if (resizeRafRef.current !== null) return;
        resizeRafRef.current = window.requestAnimationFrame(() => {
          resizeRafRef.current = null;
          setColumnWidths((prev) => ({
            ...prev,
            [resizeState.columnId]: nextWidth,
          }));
        });
      };

      const handleMouseUp = () => {
        resizeStateRef.current = null;
        if (resizeRafRef.current !== null) {
          window.cancelAnimationFrame(resizeRafRef.current);
          resizeRafRef.current = null;
        }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [],
  );

  const renderTableToolbar = (className?: string) => (
    <TableToolbar
      className={cn(
        toolbarInlineWithHeader ? "w-auto py-0" : "w-full lg:w-auto",
        className,
      )}
      totalItems={toolbar.totalItems}
      filteredItems={
        dateRangeFilteredItems.length === data.items.length
          ? toolbar.filteredItems
          : dateRangeFilteredItems.length
      }
      selectedCount={effectiveSelectedCount}
      searchValue={toolbar.searchValue}
      onSearchChange={toolbar.onSearchChange}
      searchPlaceholder={toolbar.searchPlaceholder}
      currentView={activeView}
      onViewChange={handleViewChange}
      enabledViews={effectiveEnabledViews}
      viewSwitcherDisplay={toolbar.viewSwitcherDisplay}
      filters={effectiveToolbarFilters}
      activeFilters={activeFilters}
      onFilterChange={handleFilterChange}
      onClearFilters={handleClearFilters}
      columns={toolbarColumns}
      visibleColumns={visibleColumns}
      onColumnVisibilityChange={handleColumnVisibilityChange}
      columnOrder={columnOrder}
      onColumnOrderChange={setColumnOrder}
      columnWidths={columnWidths}
      onColumnWidthsChange={setColumnWidths}
      sortOptions={table.columns.filter((column) => column.sortable !== false)}
      sortBy={effectiveSorting?.sortBy}
      sortDirection={effectiveSorting?.sortDirection}
      onSortChange={effectiveSorting?.onSortChange}
      groupByOptions={toolbar.groupByOptions}
      groupBy={toolbar.groupBy}
      onGroupByChange={toolbar.onGroupByChange}
      onExport={effectiveOnExport}
      onBulkDelete={effectiveBulkDelete}
      mobilePanelActions={toolbar.mobilePanelActions}
      customActions={toolbar.customActions}
      leftContent={toolbar.leftContent}
      density={density}
      onDensityChange={handleDensityChange}
      enableSearch={resolvedFeatures.enableSearch}
      enableViews={resolvedFeatures.enableViews}
      enableFilters={resolvedFeatures.enableFilters}
      enableColumnToggle={resolvedFeatures.enableColumnToggle}
      enableExport={resolvedFeatures.enableExport}
      enableBulkDelete={resolvedFeatures.enableBulkDelete && hasRowSelection}
      savedViewsScope={toolbar.savedViewsScope}
      savedViewsDefaults={
        toolbar.savedViewsScope
          ? (toolbar.savedViewsDefaults ?? {
              visibleColumns: toolbarColumns
                .filter(
                  (column) =>
                    column.defaultVisible !== false || column.alwaysVisible,
                )
                .map((column) => column.id),
              columnOrder: toolbarColumns.map((column) => column.id),
              columnWidths: {},
              sortBy: effectiveSorting?.sortBy ?? null,
              sortDirection: effectiveSorting?.sortDirection ?? "asc",
              filters: {},
            })
          : undefined
      }
    />
  );

  const tableToolbar = renderTableToolbar();

  const isCompactDensity = density === "compact";

  // On phone and tablet viewports, force every button rendered through
  // `header.actions` into a 44×44 icon-only shape. We hide text via `text-[0]` (works for raw text nodes that
  // CSS can't otherwise target) and clamp the box to a square. SVG icons keep
  // their absolute `size-4` because the Button base styles size them in rem,
  // not em. Buttons that need to opt out can set `data-keep-text`.
  const mobileIconOnlyActions =
    "max-xl:[&_button:not([data-keep-text])]:!size-11 " +
    "max-xl:[&_button:not([data-keep-text])]:!p-0 " +
    "max-xl:[&_button:not([data-keep-text])]:!gap-0 " +
    "max-xl:[&_button:not([data-keep-text])]:!text-[0px] " +
    "max-xl:[&_button:not([data-keep-text])]:!justify-center";

  const headerActionsSlot = header.actions ? (
    <div className={cn("contents", mobileIconOnlyActions)}>
      {header.actions}
    </div>
  ) : null;

  const shouldRenderHeader = Boolean(header.title) && !header.hidden;

  const headerContent = (
    <PageHeader
      title={header.title}
      // Render the title with `truncate` instead of PageHeader's default
      // `break-words`. Table-page headers place the toolbar inline with the
      // title (mobileActionsInline), and the toolbar is `shrink-0`, so in a
      // narrow container (e.g. the tablet 3-pane center column) the title's
      // flex column can be squeezed below one word's width — `break-words`
      // then shatters it one letter per line. Truncating fails gracefully to
      // an ellipsis and is a no-op on desktop where the title fits.
      // Scoped to the default variant: the `compact` variant renders the title
      // as a small Eyebrow, so passing titleContent there would wrongly replace
      // it with this large <h1>.
      titleContent={
        header.variant === "compact" ? undefined : (
          <h1 className="truncate text-xl font-medium text-foreground/90 sm:text-3xl lg:text-[2rem]">
            {header.title}
          </h1>
        )
      }
      eyebrow={header.eyebrow}
      description={isCompactDensity ? undefined : header.description}
      variant={header.variant}
      mobileActionsInline={header.mobileActionsInline ?? true}
      className={cn(
        "mb-2 px-0 sm:px-0 lg:px-0",
        isCompactDensity && "[&>div]:pt-2 [&>div]:pb-2",
        isFullBleedTable && alignHeaderWithFullBleedTable && "mx-0",
      )}
      titleClassName={header.titleClassName}
      actions={
        toolbarInlineWithHeader ? (
          <div className="flex min-w-0 flex-1 items-start justify-end gap-2">
            <div className="min-w-0 flex-1">{tableToolbar}</div>
            {headerActionsSlot}
          </div>
        ) : toolbarWithTabs ? (
          // Toolbar lives on the tabs row at all widths — no duplicate in the header.
          headerActionsSlot
        ) : headerActionsSlot ? (
          // On phones (< md) the toolbar collapses to a single settings sheet
          // trigger. Normalize it and the primary action to the SAME 44px round
          // button so they read as one proportional set instead of a heavy
          // filled square next to a bare glyph. The secondary gets a soft tonal
          // fill; the primary keeps its accent. Icons are pinned to one size and
          // any button label is collapsed (`text-[0]`) so both are icon-only.
          <div className="flex items-center gap-2 max-md:gap-2">
            {/* `:has(svg)` scopes the round-icon treatment to icon-bearing
                buttons only, so a text-only header action degrades to its normal
                label instead of collapsing to an empty circle. */}
            <div className="contents max-xl:[&_button:has(svg)]:h-11 max-xl:[&_button:has(svg)]:w-11 max-xl:[&_button:has(svg)]:justify-center max-xl:[&_button:has(svg)]:gap-0 max-xl:[&_button:has(svg)]:rounded-full max-xl:[&_button:has(svg)]:p-0 max-xl:[&_button:has(svg)]:text-[0px] max-xl:[&_svg]:h-5 max-xl:[&_svg]:w-5">
              {headerActionsSlot}
            </div>
            <div className="contents max-xl:[&_button:has(svg)]:h-11 max-xl:[&_button:has(svg)]:w-11 max-xl:[&_button:has(svg)]:justify-center max-xl:[&_button:has(svg)]:gap-0 max-xl:[&_button:has(svg)]:rounded-full max-xl:[&_button:has(svg)]:bg-muted max-xl:[&_button:has(svg)]:p-0 max-xl:[&_button:has(svg)]:text-[0px] max-xl:[&_button:has(svg)]:text-muted-foreground max-xl:[&_button:has(svg)]:shadow-none max-xl:[&_button:has(svg):hover]:bg-muted/70 max-xl:[&_svg]:h-5 max-xl:[&_svg]:w-5">
              {renderTableToolbar(TABLE_HEADER_MOBILE_TOOLBAR_CLASSNAME)}
            </div>
          </div>
        ) : (
          renderTableToolbar(TABLE_HEADER_MOBILE_TOOLBAR_CLASSNAME)
        )
      }
    />
  );

  const shouldPortalToolbar = Boolean(toolbar.portalContainerId);
  const toolbarPortalContainer =
    shouldPortalToolbar && typeof document !== "undefined"
      ? document.getElementById(toolbar.portalContainerId!)
      : null;
  const portaledToolbar =
    shouldPortalToolbar && toolbarPortalContainer
      ? createPortal(renderTableToolbar("w-auto py-0"), toolbarPortalContainer)
      : null;

  // Split content into "above table" (header, tabs, toolbar) and "table area" so
  // the side panel grid can align its top with the table, not the page header.
  const aboveTableContent = (
    <>
      {shouldRenderHeader ? headerContent : null}
      {(tabs || !toolbarInlineWithHeader) && (
        <div
          className={cn(
            toolbarWithTabs
              ? // Keep tabs + toolbar on one horizontal row at EVERY width.
                "flex flex-row items-center justify-between gap-2"
              : cn(
                  "flex flex-col gap-2",
                  tabs
                    ? "md:flex-row md:items-center md:justify-between md:gap-4"
                    : "md:flex-row md:items-center md:justify-end md:gap-4",
                ),
            isCompactDensity
              ? "pb-1 pt-0"
              : cn("pb-3", containerPadding ? "pt-1 sm:pt-2" : "pt-0"),
          )}
        >
          {tabs && (
            <PageTabs
              tabs={tabs}
              variant="inline"
              className={TABLE_INLINE_PAGE_TABS_CLASSNAME}
            />
          )}
          {!toolbarInlineWithHeader && !shouldPortalToolbar ? (
            <div
              className={cn(
                toolbarWithTabs
                  ? "flex min-w-0 justify-end"
                  : TABLE_ABOVE_TABLE_TOOLBAR_CLASSNAME,
                tabs ? "self-center md:shrink-0" : "md:shrink-0",
              )}
            >
              {toolbarWithTabs
                ? renderTableToolbar("w-auto py-0")
                : tableToolbar}
            </div>
          ) : null}
        </div>
      )}
    </>
  );

  const tableAreaContent = (
    <>
      {data.isLoading && (
        <div className="mt-4 space-y-2 py-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {data.error && (
        <div className="mt-4 text-center py-12">
          <p className="text-destructive">{data.error.message}</p>
        </div>
      )}

      {topContent && !data.isLoading && !data.error && (
        <div className="mt-4 space-y-4">{topContent}</div>
      )}

      {showEmptyState && (
        <div className="mt-4">
          <EmptyState
            icon={emptyState.icon ?? <Inbox />}
            title={emptyState.title}
            description={
              emptyState.isFiltered
                ? emptyState.filteredDescription
                : emptyState.description
            }
            action={!emptyState.isFiltered ? emptyState.action : undefined}
          />
        </div>
      )}

      {/* Mobile card view */}
      {showTable && shouldRenderTableView && (
        <MobileCardList
          items={paginatedItems}
          columns={orderedVisibleColumns}
          getRowId={table.getRowId}
          activeRowId={table.activeRowId}
          onRowClick={table.onRowClick ? activateRow : undefined}
          isFetching={data.isFetching}
          rowActions={table.rowActions}
          onView={table.onView}
          onEdit={table.onEdit}
          onDelete={table.onDelete ? handleDeleteIntent : undefined}
          hasRowActions={hasRowActions}
        />
      )}

      {/* Desktop table view */}
      {showTable && shouldRenderTableView && (
        <div
          className={cn(
            "relative hidden sm:block",
            data.isFetching && "opacity-70",
          )}
        >
          {/* Edge fades — signal that the table scrolls horizontally so a
              partially-visible trailing column reads as "more →", not a broken
              clip (design-audit DA-001). */}
          {tableScrollEdges.left ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-gradient-to-r from-background to-transparent"
            />
          ) : null}
          {tableScrollEdges.right ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-background to-transparent"
            />
          ) : null}
          <div
            className={cn(
              "overflow-x-auto focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border/70",
              shouldUseFullBleedDesktopScrollShell &&
                TABLE_FULL_BLEED_SCROLL_SHELL_CLASSNAME,
              removeTableFrame ? "border-0 rounded-none" : "",
              sidePanel
                ? removeTableFrame
                  ? "mx-0 pl-0"
                  : "mx-0 pl-0"
                : isFullBleedTable
                  ? "mx-0"
                  : "mx-0",
            )}
            tabIndex={0}
            onKeyDown={handleTableKeyDown}
            onClick={() => tableScrollRef.current?.focus()}
            ref={tableScrollRef}
            style={
              resolvedFeatures.enableVirtualization
                ? { maxHeight: 640, overflowY: "auto" }
                : undefined
            }
          >
            <DndContext
              id={columnDndContextId}
              sensors={columnDndSensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToHorizontalAxis]}
              onDragEnd={handleColumnDragEnd}
            >
              <Table
                className={cn(
                  density === "compact" &&
                    "[&_thead_tr]:h-8 [&_th]:py-1 [&_th]:px-3 [&_td]:py-1 [&_td]:px-3 [&_td]:text-xs [&_th:has([role=checkbox])]:pl-0 [&_td:has([role=checkbox])]:pl-0",
                  density === "comfortable" &&
                    "[&_thead_tr]:h-14 [&_th]:py-4 [&_th]:px-4 [&_td]:py-4 [&_td]:px-4 [&_th:has([role=checkbox])]:pl-0 [&_td:has([role=checkbox])]:pl-0",
                  isFullBleedTable &&
                    !hasRowSelection &&
                    "[&_th:first-child]:pl-0 [&_td:first-child]:pl-0 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0",
                )}
                style={
                  layout?.minWidth ? { minWidth: layout.minWidth } : undefined
                }
              >
                <TableHeader
                  className={cn(
                    table.stickyHeader !== false && "sticky top-0 z-20 bg-card",
                  )}
                >
                  {columnGroups && columnGroups.length > 0 && (
                    <TableRow className="border-b-0">
                      {hasRowSelection && (
                        <TableHead
                          style={{
                            width: selectionColumnWidth,
                            minWidth: selectionColumnWidth,
                            maxWidth: selectionColumnWidth,
                          }}
                          className=""
                        />
                      )}
                      {columnGroups.map((group, index) => {
                        const visibleCount = group.columnIds.filter((id) =>
                          orderedVisibleColumns.some((col) => col.id === id),
                        ).length;
                        if (visibleCount === 0) return null;
                        return (
                          <TableHead
                            key={`group-${group.label}-${group.columnIds.join("-")}`}
                            colSpan={visibleCount}
                            className={cn(
                              "text-left text-[11px] font-medium text-muted-foreground py-0 px-2 leading-tight border-b border-border/70 normal-case",
                              index > 0 && "border-l",
                            )}
                          >
                            {group.label}
                          </TableHead>
                        );
                      })}
                      {hasRowActions && (
                        <TableHead
                          className={cn(
                            "w-[56px] pl-2",
                            sidePanel ? "pr-4" : "pr-2",
                          )}
                        />
                      )}
                    </TableRow>
                  )}
                  <TableRow className="border-border/80">
                    {hasRowSelection && (
                      <TableHead
                        className="pl-0 pr-2"
                        style={{
                          width: selectionColumnWidth,
                          minWidth: selectionColumnWidth,
                          maxWidth: selectionColumnWidth,
                        }}
                      >
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={
                              allSelected
                                ? true
                                : someSelected
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={(checked) =>
                              handleSelectAll(Boolean(checked))
                            }
                            aria-label="Select all rows"
                          />
                        </div>
                      </TableHead>
                    )}
                    <SortableContext
                      items={columnSortableIds}
                      strategy={horizontalListSortingStrategy}
                    >
                      {orderedVisibleColumns.map((column) => {
                        const isSortable =
                          column.sortable !== false &&
                          Boolean(effectiveSorting);
                        const isHideable = !column.alwaysVisible;
                        const columnAlignment = resolveColumnAlignment(
                          column,
                          headerAlignment,
                        );
                        const width = columnWidths[column.id] ?? column.width;
                        const headerPinnedStyle =
                          getPinnedStyle(column.id) ?? undefined;
                        const columnStyle =
                          width || headerPinnedStyle
                            ? ({
                                width,
                                minWidth:
                                  columnWidths[column.id] ?? column.width,
                                maxWidth:
                                  column.width && !columnWidths[column.id]
                                    ? column.width
                                    : undefined,
                                ...headerPinnedStyle,
                              } as React.CSSProperties)
                            : undefined;
                        const hasContextActions =
                          isSortable ||
                          isHideable ||
                          resolvedFeatures.enableColumnPinning;

                        return (
                          <SortableColumnHead
                            key={column.id}
                            id={column.id}
                            disabled={!resolvedFeatures.enableColumnReorder}
                            className={cn(
                              "relative align-middle data-[dragging=true]:shadow-sm",
                              columnAlignment === "right"
                                ? "text-right"
                                : columnAlignment === "center"
                                  ? "text-center"
                                  : "text-left",
                              isSortable && "cursor-pointer",
                              (isSortable ||
                                resolvedFeatures.enableColumnReorder) &&
                                "select-none group/th",
                            )}
                            ariaSort={
                              isSortable
                                ? effectiveSorting?.sortBy === column.id
                                  ? effectiveSorting.sortDirection === "asc"
                                    ? "ascending"
                                    : "descending"
                                  : "none"
                                : undefined
                            }
                            style={columnStyle}
                            onClick={() => {
                              // A resize drag ends with a synthetic click on the
                              // <th> (the handle is a child). Consume it so the
                              // resize doesn't also re-sort the column.
                              if (didResizeRef.current) {
                                didResizeRef.current = false;
                                return;
                              }
                              if (isSortable) {
                                handleSortClick(column.id);
                              }
                            }}
                            onContextMenu={(e) => {
                              if (!isHideable) return;
                              e.preventDefault();
                              const btn =
                                e.currentTarget.querySelector<HTMLButtonElement>(
                                  "button[type='button']",
                                );
                              btn?.click();
                            }}
                          >
                            {({ attributes, listeners }) => {
                              const dragHandle =
                                resolvedFeatures.enableColumnReorder ? (
                                  <span
                                    {...attributes}
                                    {...listeners}
                                    aria-label={`Drag ${column.label} column`}
                                    title="Drag to reorder column"
                                    className="ml-1 inline-flex h-4 w-4 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted-foreground/40 opacity-0 transition-[color,opacity] hover:text-muted-foreground group-hover/th:opacity-100 group-focus-within/th:opacity-100 active:cursor-grabbing"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <GripVertical
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    />
                                  </span>
                                ) : null;

                              return (
                                <>
                                  {hasContextActions ? (
                                    <div className="flex items-center w-full">
                                      {columnAlignment === "right" &&
                                        dragHandle}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            className={cn(
                                              "h-auto gap-1.5 p-0 has-[>svg]:px-0 font-medium uppercase tracking-wide",
                                              "text-xs",
                                              "flex-1 min-w-0",
                                              "overflow-visible",
                                              "text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0 data-[state=open]:bg-transparent data-[state=open]:text-foreground",
                                              columnAlignment === "right"
                                                ? "justify-end"
                                                : columnAlignment === "center"
                                                  ? "justify-center"
                                                  : "justify-start",
                                            )}
                                            onContextMenu={(event) => {
                                              event.preventDefault();
                                              event.currentTarget.click();
                                            }}
                                          >
                                            {/* Right-aligned headers place the sort
                                                indicator BEFORE the label so the label
                                                stays flush with the column's right edge,
                                                matching the right-aligned numeric cells. */}
                                            {columnAlignment === "right" &&
                                              isSortable &&
                                              column.showSortIcon !== false &&
                                              renderSortIcon(column.id)}
                                            <span
                                              className={
                                                TABLE_HEADER_LABEL_CLASSNAME
                                              }
                                            >
                                              {column.label}
                                            </span>
                                            {columnAlignment !== "right" &&
                                              isSortable &&
                                              column.showSortIcon !== false &&
                                              renderSortIcon(column.id)}
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start">
                                          {isSortable && (
                                            <>
                                              <DropdownMenuItem
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  effectiveSorting?.onSortChange(
                                                    column.id,
                                                    "asc",
                                                  );
                                                }}
                                              >
                                                <ArrowUp className="mr-2 h-3.5 w-3.5" />
                                                Sort ascending
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  effectiveSorting?.onSortChange(
                                                    column.id,
                                                    "desc",
                                                  );
                                                }}
                                              >
                                                <ArrowDown className="mr-2 h-3.5 w-3.5" />
                                                Sort descending
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                          {resolvedFeatures.enableColumnPinning && (
                                            <>
                                              {isSortable && (
                                                <DropdownMenuSeparator />
                                              )}
                                              <DropdownMenuItem
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  pinColumn(column.id);
                                                }}
                                              >
                                                {columnPinning.left.includes(
                                                  column.id,
                                                ) ? (
                                                  <>
                                                    <PinOff className="mr-2 h-3.5 w-3.5" />
                                                    Unpin column
                                                  </>
                                                ) : (
                                                  <>
                                                    <Pin className="mr-2 h-3.5 w-3.5" />
                                                    Pin column
                                                  </>
                                                )}
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                          {isHideable && (
                                            <>
                                              {(isSortable ||
                                                resolvedFeatures.enableColumnPinning) && (
                                                <DropdownMenuSeparator />
                                              )}
                                              <DropdownMenuItem
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  hideColumn(column.id);
                                                }}
                                              >
                                                <EyeOff className="mr-2 h-3.5 w-3.5" />
                                                Hide column
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                      {columnAlignment !== "right" &&
                                        dragHandle}
                                    </div>
                                  ) : (
                                    <div
                                      className={cn(
                                        "flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                                        "w-full",
                                        "overflow-visible",
                                        columnAlignment === "right"
                                          ? "justify-end"
                                          : columnAlignment === "center"
                                            ? "justify-center"
                                            : "justify-start",
                                      )}
                                    >
                                      {columnAlignment === "right" &&
                                        dragHandle}
                                      <span
                                        className={TABLE_HEADER_LABEL_CLASSNAME}
                                      >
                                        {column.label}
                                      </span>
                                      {columnAlignment !== "right" &&
                                        dragHandle}
                                    </div>
                                  )}
                                  <div
                                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-border active:bg-primary/40 transition-colors"
                                    onMouseDown={(event) =>
                                      handleColumnResizeStart(event, column.id)
                                    }
                                    // A click on the handle itself (no drag) must
                                    // not bubble to the header's sort onClick.
                                    onClick={(event) => event.stopPropagation()}
                                    aria-hidden="true"
                                  />
                                </>
                              );
                            }}
                          </SortableColumnHead>
                        );
                      })}
                    </SortableContext>
                    {hasRowActions && (
                      <TableHead
                        className={cn(
                          "w-[56px] pl-2",
                          sidePanel ? "pr-4" : "pr-2",
                        )}
                      />
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody
                  style={
                    resolvedFeatures.enableVirtualization
                      ? ({
                          position: "relative",
                          height: `${rowVirtualizer.getTotalSize()}px`,
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  {(resolvedFeatures.enableVirtualization
                    ? rowVirtualizer.getVirtualItems().map((virtualRow) => ({
                        item: paginatedItems[virtualRow.index],
                        key: table.getRowId(paginatedItems[virtualRow.index]!),
                        style: {
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                          height: `${virtualRow.size}px`,
                        } as React.CSSProperties,
                      }))
                    : paginatedItems.map((item) => ({
                        item,
                        key: table.getRowId(item),
                        style: undefined,
                      }))
                  ).map(({ item, key, style }) => (
                    <React.Fragment key={key}>
                      <TableRow
                        ref={(element) => {
                          rowRefs.current[key] = element;
                        }}
                        className={cn(
                          "group/row cursor-pointer transition-colors duration-150",
                          "hover:bg-muted/40",
                          table.activeRowId === table.getRowId(item) &&
                            "bg-muted",
                          selectedIds.includes(table.getRowId(item)) &&
                            "bg-muted/50",
                        )}
                        style={style}
                        draggable={
                          resolvedFeatures.enableRowReorder &&
                          !effectiveSorting?.sortBy &&
                          !resolvedFeatures.enableVirtualization
                        }
                        onDragStart={() =>
                          setDraggedRowId(table.getRowId(item))
                        }
                        onDragOver={(event) => {
                          if (
                            !(
                              resolvedFeatures.enableRowReorder &&
                              !effectiveSorting?.sortBy
                            )
                          )
                            return;
                          event.preventDefault();
                        }}
                        onDrop={() => {
                          if (
                            !(
                              resolvedFeatures.enableRowReorder &&
                              !effectiveSorting?.sortBy
                            )
                          )
                            return;
                          handleRowDrop(table.getRowId(item));
                          setDraggedRowId(null);
                        }}
                        onDragEnd={() => setDraggedRowId(null)}
                        onClick={(event) => {
                          if (isInteractiveRowTarget(event.target)) {
                            return;
                          }
                          activateRow(item);
                        }}
                        tabIndex={table.onRowClick ? 0 : undefined}
                        onKeyDown={
                          table.onRowClick
                            ? (event) => {
                                if (isInteractiveRowTarget(event.target)) {
                                  return;
                                }
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  activateRow(item);
                                }
                              }
                            : undefined
                        }
                      >
                        {hasRowSelection && (
                          <TableCell
                            className="pl-0 pr-2"
                            style={{
                              width: selectionColumnWidth,
                              minWidth: selectionColumnWidth,
                              maxWidth: selectionColumnWidth,
                            }}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={selectedIds.includes(
                                  table.getRowId(item),
                                )}
                                onCheckedChange={(checked) =>
                                  handleSelectRow(
                                    table.getRowId(item),
                                    Boolean(checked),
                                  )
                                }
                                aria-label="Select row"
                              />
                            </div>
                          </TableCell>
                        )}
                        {orderedVisibleColumns.map((column) => {
                          const columnAlignment = resolveColumnAlignment(
                            column,
                            "left",
                          );
                          const isEditableCell =
                            Boolean(resolvedFeatures.enableInlineEditing) &&
                            Boolean(column.editable) &&
                            Boolean(column.editValue);
                          const isIconOnlyEdit =
                            isEditableCell &&
                            shouldUseIconOnlyInlineEdit(column);
                          return (
                            <TableCell
                              key={column.id}
                              data-editable-cell={
                                isEditableCell ? "true" : undefined
                              }
                              style={
                                columnWidths[column.id] ||
                                column.width ||
                                getPinnedStyle(column.id)
                                  ? ({
                                      width:
                                        columnWidths[column.id] ?? column.width,
                                      minWidth:
                                        columnWidths[column.id] ?? column.width,
                                      maxWidth:
                                        column.width && !columnWidths[column.id]
                                          ? column.width
                                          : undefined,
                                      ...getPinnedStyle(column.id),
                                    } as React.CSSProperties)
                                  : undefined
                              }
                              className={cn(
                                "group/cell relative align-middle",
                                columnAlignment === "right"
                                  ? "text-right"
                                  : columnAlignment === "center"
                                    ? "text-center"
                                    : "text-left",
                                isEditableCell &&
                                  !isIconOnlyEdit &&
                                  "cursor-text hover:bg-muted/50 transition-colors focus-within:bg-muted/40",
                                isIconOnlyEdit && "focus-within:bg-muted/40",
                              )}
                              onClick={(event) => {
                                if (!isEditableCell || isIconOnlyEdit) {
                                  return;
                                }
                                if (isInteractiveRowTarget(event.target)) {
                                  return;
                                }
                                event.stopPropagation();
                                startInlineEdit(item, column);
                              }}
                            >
                              {editingCell?.rowId === table.getRowId(item) &&
                              editingCell.columnId === column.id &&
                              isEditableCell ? (
                                column.renderEditor ? (
                                  column.renderEditor({
                                    item,
                                    value: editingValue,
                                    onChange: setEditingValue,
                                    onCommit: (nextValue) =>
                                      void commitInlineEdit(
                                        item,
                                        column,
                                        table.getRowId(item),
                                        nextValue ?? editingValue,
                                      ),
                                    onCancel: () => {
                                      setEditingCell(null);
                                      setEditingValue("");
                                    },
                                  })
                                ) : column.editType === "select" ||
                                  column.editType === "boolean" ? (
                                  <InlineSelectEditor
                                    value={editingValue}
                                    options={
                                      column.editType === "boolean"
                                        ? (column.editOptions ??
                                          BOOLEAN_EDIT_OPTIONS)
                                        : (column.editOptions ?? [])
                                    }
                                    placeholder={
                                      column.editEmptyLabel ??
                                      `Select ${column.label}`
                                    }
                                    onChange={setEditingValue}
                                    onCommit={(nextValue) =>
                                      void commitInlineEdit(
                                        item,
                                        column,
                                        table.getRowId(item),
                                        nextValue ?? editingValue,
                                      )
                                    }
                                  />
                                ) : (
                                  <Input
                                    type={column.editInputType}
                                    variant="inline"
                                    className="h-8 w-full px-0 text-sm"
                                    value={editingValue}
                                    autoFocus
                                    disabled={
                                      savingCell?.rowId ===
                                        table.getRowId(item) &&
                                      savingCell.columnId === column.id
                                    }
                                    onChange={(event) =>
                                      setEditingValue(event.target.value)
                                    }
                                    onClick={(event) => event.stopPropagation()}
                                    onBlur={() =>
                                      commitInlineEdit(
                                        item,
                                        column,
                                        table.getRowId(item),
                                        editingValue,
                                      )
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void commitInlineEdit(
                                          item,
                                          column,
                                          table.getRowId(item),
                                          editingValue,
                                        );
                                      }
                                      if (event.key === "Escape") {
                                        event.preventDefault();
                                        setEditingCell(null);
                                        setEditingValue("");
                                      }
                                      if (event.key === "Tab") {
                                        void commitInlineEdit(
                                          item,
                                          column,
                                          table.getRowId(item),
                                          editingValue,
                                        );
                                      }
                                    }}
                                  />
                                )
                              ) : isEditableCell ? (
                                isIconOnlyEdit ? (
                                  <div className="flex min-w-0 items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      {column.render(item)}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 shrink-0 opacity-0 transition-opacity hover:bg-transparent focus-visible:opacity-100 group-hover/cell:opacity-100 group-focus-within/cell:opacity-100"
                                      data-row-interactive="true"
                                      aria-label={`Edit ${column.label}`}
                                      title={`Edit ${column.label}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        startInlineEdit(item, column);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-muted-foreground/70" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="flex h-auto min-h-8 w-full min-w-0 items-center justify-between gap-2 px-0 py-0 text-left font-normal hover:bg-transparent focus-visible:ring-1 focus-visible:ring-ring"
                                    data-row-interactive="true"
                                    aria-label={`Edit ${column.label}`}
                                    title={`Edit ${column.label}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      startInlineEdit(item, column);
                                    }}
                                  >
                                    <span className="min-w-0 flex-1 truncate">
                                      {column.render(item)}
                                    </span>
                                    <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover/cell:opacity-100 group-focus-within/cell:opacity-100" />
                                  </Button>
                                )
                              ) : (
                                column.render(item)
                              )}
                            </TableCell>
                          );
                        })}
                        {hasRowActions && (
                          <TableCell
                            className={cn("pl-2", sidePanel ? "pr-4" : "pr-2")}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {table.rowActions ? (
                              table.rowActions(item)
                            ) : table.onView ||
                              table.onDelete ||
                              table.onEdit ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label="Row actions"
                                  >
                                    <MoreVertical />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {table.onView && (
                                    <DropdownMenuItem
                                      onClick={() => table.onView!(item)}
                                    >
                                      <Eye className="mr-2 h-4 w-4" />
                                      View
                                    </DropdownMenuItem>
                                  )}
                                  {table.onView &&
                                  (table.onEdit || table.onDelete) ? (
                                    <DropdownMenuSeparator />
                                  ) : null}
                                  {table.onEdit && (
                                    <DropdownMenuItem
                                      onClick={() => table.onEdit!(item)}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  {table.onEdit && table.onDelete && (
                                    <DropdownMenuSeparator />
                                  )}
                                  {table.onDelete && (
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => handleDeleteIntent(item)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </TableCell>
                        )}
                      </TableRow>
                      {!resolvedFeatures.enableVirtualization &&
                        table.renderExpandedRow?.(
                          item,
                          orderedVisibleColumns.length +
                            (hasRowSelection ? 1 : 0) +
                            (hasRowActions ? 1 : 0),
                          {
                            columns: orderedVisibleColumns.map((c) => ({
                              id: c.id,
                              width: columnWidths[c.id] ?? c.width,
                              align: resolveColumnAlignment(c, "left"),
                            })),
                            hasSelection: hasRowSelection,
                            hasActions: hasRowActions,
                          },
                        )}
                    </React.Fragment>
                  ))}
                </TableBody>
                {footerTotals && (
                  <TableFooter>
                    <TableRow className={cn("font-medium", "bg-transparent")}>
                      {hasRowSelection && <TableCell />}
                      {orderedVisibleColumns.map((column, index) => {
                        const width = columnWidths[column.id];
                        const columnStyle = width
                          ? ({
                              width,
                              minWidth: width,
                              ...getPinnedStyle(column.id),
                            } as React.CSSProperties)
                          : undefined;
                        const columnAlignment = resolveColumnAlignment(
                          column,
                          "left",
                        );
                        const alignmentClass =
                          columnAlignment === "right"
                            ? "text-right"
                            : columnAlignment === "center"
                              ? "text-center"
                              : "text-left";
                        const value = footerTotals.values[column.id];
                        if (index === 0 && !value) {
                          return (
                            <TableCell
                              key={column.id}
                              className="font-semibold text-left"
                              style={columnStyle}
                            >
                              {footerTotals.label ?? "Totals"}
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell
                            key={column.id}
                            className={cn("font-semibold", alignmentClass)}
                            style={columnStyle}
                          >
                            {value ?? null}
                          </TableCell>
                        );
                      })}
                      {hasRowActions && <TableCell />}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </DndContext>
          </div>
        </div>
      )}

      {showTable &&
        canRenderBoardView &&
        (() => {
          const BoardRenderer = views?.board;
          if (!BoardRenderer) return null;

          return (
            <div className="mt-4">
              {BoardRenderer({
                items: rowOrderedItems,
                getRowId: table.getRowId,
                activeRowId: table.activeRowId,
                onRowClick: table.onRowClick,
              })}
            </div>
          );
        })()}

      {showTable &&
        canRenderCardView &&
        (() => {
          const CardView = views?.card;
          const groupFn = views?.cardGroupBy;
          const gridCls = cn(
            "grid",
            layout?.cardGridClassName ??
              "grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
          );

          if (groupFn) {
            const groups = new Map<string, T[]>();
            for (const item of rowOrderedItems) {
              const key = groupFn(item);
              const arr = groups.get(key);
              if (arr) arr.push(item);
              else groups.set(key, [item]);
            }
            return (
              <div className="mt-4 space-y-6">
                {Array.from(groups.entries()).map(([label, items]) => (
                  <div key={label}>
                    <SectionRuleHeading
                      className="mb-3 px-0.5 pb-0"
                      label={label}
                    />
                    <div className={gridCls}>
                      {items.map((item) => (
                        <React.Fragment key={table.getRowId(item)}>
                          {CardView ? CardView(item) : null}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          return (
            <div className={cn("mt-4", gridCls)}>
              {rowOrderedItems.map((item) => (
                <React.Fragment key={table.getRowId(item)}>
                  {CardView ? CardView(item) : null}
                </React.Fragment>
              ))}
            </div>
          );
        })()}

      {showTable && canRenderListView && (
        <div className="mt-4 flex flex-col gap-2">
          {rowOrderedItems.map((item) => {
            const ListView = views?.list;
            return (
              <React.Fragment key={table.getRowId(item)}>
                {ListView ? ListView(item) : null}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {showTable &&
        canRenderSplitView &&
        (() => {
          const SplitView = views?.split;
          if (!SplitView) return null;
          return (
            <div className={TABLE_SPLIT_VIEW_CONTAINER_CLASSNAME}>
              {SplitView({
                items: rowOrderedItems,
                getRowId: table.getRowId,
                activeRowId: table.activeRowId,
                selectedIds,
                onSelectRow: selection ? handleSelectRow : undefined,
                onSelectAll: selection ? handleSelectAll : undefined,
                onRowClick: table.onRowClick,
              })}
            </div>
          );
        })()}

      {(() => {
        if (hideTableBody) return null;
        const paginProps =
          pagination ??
          (resolvedFeatures.enablePagination
            ? {
                page: internalPage,
                totalPages: Math.max(
                  1,
                  Math.ceil(rowOrderedItems.length / internalPerPage),
                ),
                perPage: internalPerPage,
                onPageChange: setInternalPage,
                onPerPageChange: (val: string) => {
                  setInternalPerPage(Number(val));
                  setInternalPage(1);
                },
              }
            : null);
        if (!paginProps || paginProps.totalPages <= 1) return null;
        return (
          <div className="flex flex-col gap-4 items-center justify-between pt-6 md:flex-row">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={String(paginProps.perPage)}
                onValueChange={paginProps.onPerPageChange}
              >
                <SelectTrigger
                  variant="inline"
                  size="sm"
                  className="h-8 w-16 px-1"
                >
                  <SelectValue placeholder={String(paginProps.perPage)} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100, 150].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SimplePagination
              currentPage={paginProps.page}
              totalPages={paginProps.totalPages}
              onPageChange={paginProps.onPageChange}
            />
          </div>
        );
      })()}
    </>
  );

  // For non-sidePanel pages, combine header + table into one block
  const leftPaneContent = (
    <>
      {aboveTableContent}
      <div
        className={
          canRenderSplitView ? "flex flex-col flex-1 min-h-0" : undefined
        }
      >
        {tableAreaContent}
      </div>
    </>
  );

  return (
    <>
      {portaledToolbar}
      <PageContainer
        maxWidth={containerMaxWidth}
        // Split view is edge-to-edge like the emails feedback page — no left/right
        // gutter so the list + detail panel own the full content width (design-audit
        // DA-002). Other views keep the standard container padding.
        padding={canRenderSplitView ? false : containerPadding}
        className={cn(
          "pb-12",
          canRenderSplitView && TABLE_SPLIT_VIEW_PAGE_CONTAINER_CLASSNAME,
          isFullBleedTable && TABLE_FULL_BLEED_PAGE_CONTAINER_CLASSNAME,
          sidePanel && TABLE_SIDE_PANEL_PAGE_CONTAINER_CLASSNAME,
          containerClassName,
        )}
      >
        {sidePanel ? (
          <>
            <div className={cn(containerPadding && "pr-1 sm:pr-6 lg:pr-8")}>
              {aboveTableContent}
            </div>
            <div
              ref={gridRef}
              className={cn(
                "relative grid grid-cols-1",
                isFullBleedTable &&
                  (sidePanel ? "mx-0" : "-mx-1 sm:-mx-6 lg:-mx-8"),
                !panelMounted &&
                  isSidePanelOpen &&
                  "lg:grid-cols-[minmax(0,1fr)_35rem]",
                !panelMounted && isSidePanelOpen && sidePanel.columnClassName,
              )}
              style={
                panelMounted
                  ? {
                      gridTemplateColumns:
                        !isSidePanelOpen || panelCollapsed
                          ? "minmax(0, 1fr)"
                          : `minmax(0, 1fr) ${panelWidth}px`,
                      transition: isResizingPanel
                        ? "none"
                        : "grid-template-columns 200ms ease-in-out",
                    }
                  : undefined
              }
            >
              <div className="min-w-0">{tableAreaContent}</div>

              {/* Side panel with resize handle */}
              {isSidePanelOpen && (
                <aside
                  className={cn(
                    "hidden lg:flex lg:flex-col bg-background relative min-h-[calc(100dvh-6rem)] lg:border-l lg:border-border/70",
                    panelSticky
                      ? "lg:sticky lg:top-12 lg:max-h-[calc(100dvh-3rem)]"
                      : "lg:relative lg:max-h-none",
                    panelCollapsed ? "lg:!hidden" : "lg:overflow-y-auto",
                    sidePanel.widthClassName,
                  )}
                >
                  {panelResizable && (
                    <div
                      className="absolute left-0 top-0 h-full w-3 cursor-col-resize select-none z-10 group"
                      onMouseDown={handlePanelResizeStart}
                      aria-hidden="true"
                    >
                      <div className="absolute left-0 top-0 h-full w-px bg-border group-hover:bg-primary/50 group-active:bg-primary transition-colors" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex-1 flex flex-col min-h-0 pl-4 pr-4",
                      sidePanel.contentClassName,
                    )}
                  >
                    {sidePanel.onClose &&
                    sidePanel.showCloseButton !== false ? (
                      <div className="flex h-10 shrink-0 items-center justify-end border-b border-border/60">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={sidePanel.onClose}
                          aria-label="Close details"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                    {sidePanel.content}
                  </div>
                </aside>
              )}

              {/* Collapse/expand toggle button */}
              {panelCollapsible && panelMounted && isSidePanelOpen && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={togglePanelCollapsed}
                  className={cn(
                    "hidden lg:flex",
                    "fixed z-20 top-1/2 -translate-y-1/2",
                    "h-10 w-5",
                    "text-muted-foreground",
                    "transition-colors",
                    "opacity-0 hover:opacity-100 focus-visible:opacity-100",
                  )}
                  style={{
                    left: panelToggleLeft ?? undefined,
                    right:
                      panelToggleLeft == null
                        ? panelCollapsed
                          ? -2
                          : panelWidth - 10
                        : undefined,
                    transition: isResizingPanel
                      ? "none"
                      : panelToggleLeft == null
                        ? "right 200ms ease-in-out"
                        : "left 200ms ease-in-out",
                  }}
                  aria-label={
                    panelCollapsed ? "Expand panel" : "Collapse panel"
                  }
                >
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-background shadow-sm">
                    {panelCollapsed ? (
                      <PanelRightOpen className="h-3 w-3" />
                    ) : (
                      <PanelRightClose className="h-3 w-3" />
                    )}
                  </span>
                </Button>
              )}
            </div>
          </>
        ) : (
          leftPaneContent
        )}
      </PageContainer>

      {/* Mobile side panel overlay */}
      {sidePanel && table.activeRowId && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background sm:hidden">
          <div className="flex items-center justify-between px-4 h-12">
            <span className="text-sm font-medium">Details</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={sidePanel.onClose}
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">{sidePanel.content}</div>
        </div>
      )}

      {table.onDelete && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this item? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {!toolbar.onBulkDelete && table.onDelete && (
        <AlertDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {selectedIds.length}{" "}
                {selectedIds.length === 1 ? "item" : "items"}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {selectedIds.length} selected{" "}
                {selectedIds.length === 1 ? "item" : "items"}. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete {selectedIds.length}{" "}
                {selectedIds.length === 1 ? "item" : "items"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
