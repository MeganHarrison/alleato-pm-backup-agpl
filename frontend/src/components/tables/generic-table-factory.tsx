"use client";

/**
 * ============================================================================
 * GENERIC DATA TABLE FACTORY
 * ============================================================================
 *
 * DEPRECATION NOTICE:
 * GenericDataTable is legacy and should not be used for new table pages.
 * Prefer UnifiedTablePage from "@/components/tables/unified" for all new work.
 * Existing GenericDataTable pages should be migrated to UnifiedTablePage over time.
 *
 * PURPOSE:
 * This is a powerful, reusable table component that eliminates the need to
 * write custom table components for each data type. Instead, you configure
 * it with a simple object that defines columns, filters, and behavior.
 *
 * CORE PHILOSOPHY:
 * - Configuration over implementation
 * - Serializable config (no functions passed as props)
 * - Feature-rich out of the box
 * - Type-safe with TypeScript
 *
 * KEY FEATURES:
 * 1. Search - Text search across multiple fields
 * 2. Filtering - Dropdown filters with custom options
 * 3. Column Visibility - Show/hide columns dynamically
 * 4. Export - CSV export of filtered data
 * 5. Inline Editing - Edit rows with dialog interface
 * 6. Row Navigation - Click rows to navigate to detail pages
 * 7. Flexible Rendering - Badges, currency, dates, arrays, nested objects
 * 8. View Modes - Table, Card, and List views
 * 9. Column Sorting - Click headers to sort ascending/descending
 * 10. Row Selection - Checkboxes for bulk operations
 * 11. Three-dot Menu - Dropdown actions for each row
 *
 * USAGE EXAMPLE:
 * ```tsx
 * <GenericDataTable
 *   data={risks}
 *   config={{
 *     title: "Risks",
 *     columns: [
 *       { id: 'title', label: 'Title', defaultVisible: true, type: 'text', isPrimary: true },
 *       { id: 'status', label: 'Status', defaultVisible: true, type: 'badge' },
 *       { id: 'cost', label: 'Cost Impact', defaultVisible: true,
 *         renderConfig: { type: 'currency', prefix: '$' } }
 *     ],
 *     searchFields: ['title', 'description'],
 *     rowClickPath: "/risks/{id}",
 *     editConfig: { tableName: 'risks' },
 *     enableViewSwitcher: true,
 *     enableRowSelection: true,
 *     enableSorting: true,
 *   }}
 * />
 * ```
 *
 * ARCHITECTURE:
 * - Client component (uses hooks and browser APIs)
 * - Local state management for UI (search, filters, column visibility)
 * - Memoized filtering for performance
 * - API calls for persistence (edit functionality)
 *
 * LOCATED AT: [frontend/src/components/tables/generic-table-factory.tsx](frontend/src/components/tables/generic-table-factory.tsx)
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useVirtualizer } from "@tanstack/react-virtual";
import Fuse from "fuse.js";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ds/text";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Search,
  Download,
  Columns3,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  MoreVertical,
  ArrowUpDown,
  Table2,
  LayoutGrid,
  List,
  Loader2,
  Pin,
  PinOff,
  GripVertical,
  Save,
  Plus,
  BarChart3,
  Calendar,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// ============================================================================
// TYPE DEFINITIONS - View Mode
// ============================================================================

export type ViewMode = "table" | "card" | "list";

// ============================================================================
// TYPE DEFINITIONS - Advanced Features
// ============================================================================

/**
 * Advanced Filter Types
 */
export type AdvancedFilterType =
  | "date-range"
  | "number-range"
  | "multi-select"
  | "single-select";

export interface AdvancedFilterConfig {
  id: string;
  label: string;
  field: string;
  type: AdvancedFilterType;
  options?: { value: string; label: string }[];
}

/**
 * Sort Configuration for Multi-Column Sorting
 */
export interface SortConfig {
  columnId: string;
  direction: "asc" | "desc";
}

/**
 * Saved View Configuration
 */
export interface SavedView {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  config: {
    visibleColumns: string[];
    sortConfigs: SortConfig[];
    filters: Record<string, unknown>;
    columnWidths?: Record<string, number>;
    pinnedColumns?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Bulk Action Configuration
 */
export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive";
  onClick: (selectedIds: (string | number)[]) => Promise<void>;
  disabled?: (selectedIds: (string | number)[]) => boolean;
}

/**
 * Column Statistics Configuration
 */
export type ColumnStatType = "sum" | "avg" | "count" | "min" | "max";

export interface ColumnStatConfig {
  type: ColumnStatType;
  format?: "currency" | "number" | "percentage";
}

/**
 * Keyboard Shortcut Configuration
 */
export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  handler: () => void;
}

// ============================================================================
// TYPE DEFINITIONS - Render Configuration
// ============================================================================
// These types define how table cells should be rendered. They are all
// serializable (no functions) so they can be passed as props and potentially
// stored in configuration files or databases.

/**
 * Badge Render Configuration
 *
 * Renders cell value as a Badge component with color-coded variants.
 * Useful for status fields, priority levels, categories, etc.
 *
 * Example:
 * ```tsx
 * {
 *   type: 'badge',
 *   variantMap: {
 *     'critical': 'destructive',  // Red badge
 *     'high': 'default',           // Primary color
 *     'medium': 'secondary',       // Gray badge
 *     'low': 'outline'             // Outlined badge
 *   },
 *   defaultVariant: 'outline'      // Fallback if value not in map
 * }
 * ```
 */
export interface BadgeRenderConfig {
  type: "badge";
  variantMap?: Record<
    string,
    "default" | "secondary" | "destructive" | "outline" | "success"
  >;
  defaultVariant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success";
}

/**
 * Currency Render Configuration
 *
 * Formats numbers as currency with locale-aware thousand separators.
 *
 * Example:
 * ```tsx
 * { type: 'currency', prefix: '$', showDecimals: true }
 * // Renders: 1234.56 → "$1,234.56"
 * ```
 */
export interface CurrencyRenderConfig {
  type: "currency";
  prefix?: string; // Default: '$'
  showDecimals?: boolean; // Default: true (2 decimal places)
}

/**
 * Truncate Render Configuration
 *
 * Truncates long text with ellipsis. Useful for descriptions, notes, etc.
 *
 * Example:
 * ```tsx
 * { type: 'truncate', maxLength: 50 }
 * // Renders: "This is a very long text..." (50 chars max)
 * ```
 */
export interface TruncateRenderConfig {
  type: "truncate";
  maxLength: number;
}

/**
 * Array Render Configuration
 *
 * Renders array values as badges or comma-separated text.
 * Useful for tags, categories, assignees, etc.
 *
 * Example:
 * ```tsx
 * { type: 'array', itemType: 'badge' }
 * // Renders: ['tag1', 'tag2'] → <Badge>tag1</Badge> <Badge>tag2</Badge>
 *
 * { type: 'array', itemType: 'text', separator: ' | ' }
 * // Renders: ['tag1', 'tag2'] → "tag1 | tag2"
 * ```
 */
export interface ArrayRenderConfig {
  type: "array";
  itemType?: "badge" | "text"; // How to render each item
  separator?: string; // For text type (default: ', ')
}

export interface BooleanRenderConfig {
  type: "boolean";
  trueLabel?: string;
  falseLabel?: string;
}

/**
 * JSON Render Configuration
 *
 * Stringifies JSON objects and truncates if needed.
 * Useful for metadata, settings, or debug fields.
 *
 * Example:
 * ```tsx
 * { type: 'json', maxLength: 100 }
 * // Renders: { foo: 'bar' } → '{"foo":"bar"}'
 * ```
 */
export interface JsonRenderConfig {
  type: "json";
  maxLength: number;
}

/**
 * Nested Object Render Configuration
 *
 * Accesses nested properties using dot notation.
 * Useful for related data or metadata fields.
 *
 * Example:
 * ```tsx
 * { type: 'nested', path: 'document_metadata.title', fallback: 'Untitled' }
 * // Accesses: row.document_metadata.title
 * // If not found, displays: 'Untitled'
 * ```
 */
export interface NestedRenderConfig {
  type: "nested";
  path: string; // Dot notation path: "user.profile.name"
  fallback?: string; // Default value if path not found
}

export interface PdfPageRenderConfig {
  type: "pdf-page";
  /** Row field containing a signed PDF URL. */
  urlField: string;
}

/**
 * Union type of all render configurations.
 * Used in ColumnConfig to specify custom rendering.
 */
export type RenderConfig =
  | BadgeRenderConfig
  | CurrencyRenderConfig
  | TruncateRenderConfig
  | ArrayRenderConfig
  | BooleanRenderConfig
  | JsonRenderConfig
  | NestedRenderConfig
  | PdfPageRenderConfig;

// ============================================================================
// TYPE DEFINITIONS - Table Configuration
// ============================================================================

/**
 * Column Configuration
 *
 * Defines a single table column's behavior and rendering.
 *
 * Fields:
 * - id: The key in the data object (e.g., 'status', 'created_at')
 * - label: Display name in table header
 * - defaultVisible: Whether column shows by default (user can toggle)
 * - type: Basic type-based rendering (text, date, badge, number, email)
 * - renderConfig: Advanced rendering (overrides type if provided)
 * - sortable: Whether column can be sorted (default: true)
 * - isPrimary: Used for card/list view to determine primary display
 * - isSecondary: Used for card/list view to determine secondary display
 * - resizable: Whether column width can be resized (default: false)
 * - pinnable: Whether column can be pinned to left/right (default: false)
 * - defaultWidth: Default column width in pixels
 * - minWidth: Minimum column width in pixels
 * - maxWidth: Maximum column width in pixels
 * - tooltip: Tooltip text for column header
 * - stat: Column statistics configuration (sum, avg, count, min, max)
 */
export interface ColumnConfig {
  id: string;
  label: string;
  defaultVisible: boolean;
  type?: "text" | "date" | "badge" | "number" | "email" | "boolean";
  renderConfig?: RenderConfig;
  sortable?: boolean;
  isPrimary?: boolean;
  isSecondary?: boolean;
  resizable?: boolean;
  pinnable?: boolean;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  tooltip?: string;
  stat?: ColumnStatConfig;
}

/**
 * Filter Configuration
 *
 * Defines a dropdown filter for the table.
 *
 * Example:
 * ```tsx
 * {
 *   id: 'status-filter',
 *   label: 'Status',
 *   field: 'status', // Which field to filter on
 *   options: [
 *     { value: 'open', label: 'Open' },
 *     { value: 'closed', label: 'Closed' }
 *   ]
 * }
 * ```
 */
export interface FilterConfig {
  id: string;
  label: string;
  field: string; // Field in data to filter
  options: { value: string; label: string }[];
}

/**
 * Edit Configuration
 *
 * Enables inline editing functionality for the table.
 * When provided, an "Actions" column with edit button appears.
 *
 * Fields:
 * - tableName: Supabase table name for API updates
 * - editableFields: Optional whitelist of editable fields
 *   (if omitted, all columns except id, created_at, updated_at are editable)
 * - requiresDialog: Whether to always use dialog (default: true)
 */
export interface EditConfig {
  tableName: string;
  editableFields?: string[];
  requiresDialog?: boolean;
}

/**
 * Row Action Configuration
 *
 * Defines custom actions in the three-dot dropdown menu.
 */
export interface RowActionConfig {
  id: string;
  label: string;
  icon?: "pencil" | "trash" | "external";
  variant?: "default" | "destructive";
  onClick?: (row: Record<string, unknown>) => void | Promise<void>;
}

/**
 * Main Table Configuration
 *
 * The complete configuration object passed to GenericDataTable.
 *
 * Required Fields:
 * - columns: Array of column definitions
 * - searchFields: Which fields to include in text search
 *
 * Optional Fields (Basic):
 * - title: Table title (h1)
 * - description: Subtitle text
 * - filters: Dropdown filters
 * - rowClickPath: Navigation path template (e.g., "/risks/{id}")
 * - exportFilename: CSV export filename (default: "export.csv")
 * - editConfig: Enable editing functionality
 * - enableViewSwitcher: Enable table/card/list view toggle
 * - defaultViewMode: Initial view mode
 * - enableRowSelection: Enable row checkboxes
 * - enableSorting: Enable column sorting
 * - defaultSortColumn: Initial sort column
 * - defaultSortDirection: Initial sort direction
 * - rowActions: Custom row actions
 * - onDelete: Enable delete functionality
 *
 * Optional Fields (Advanced Features):
 * - enableVirtualScroll: Enable virtual scrolling for large datasets (10,000+ rows)
 * - virtualScrollHeight: Height of virtual scroll container in pixels (default: 600)
 * - enableMultiColumnSort: Enable Shift+Click for multi-column sorting
 * - advancedFilters: Advanced filter configurations (date range, number range, multi-select)
 * - enableFuzzySearch: Enable fuzzy search with Fuse.js for better search results
 * - fuzzySearchThreshold: Fuse.js threshold (0.0 = exact, 1.0 = match anything, default: 0.3)
 * - enableSavedViews: Enable saved view presets
 * - savedViews: Array of saved view configurations
 * - bulkActions: Array of bulk action configurations
 * - enableColumnResize: Enable column resizing
 * - enableColumnPin: Enable column pinning (left/right)
 * - enableRowExpansion: Enable expandable rows
 * - rowExpansionContent: Function to render expanded row content
 * - enableRowDragDrop: Enable drag & drop row reordering
 * - onRowReorder: Callback when rows are reordered
 * - enableInlineCellEdit: Enable double-click to edit cells
 * - enableKeyboardNav: Enable keyboard shortcuts (/, Ctrl+A, arrow keys)
 * - keyboardShortcuts: Custom keyboard shortcuts
 * - enableColumnStats: Show column statistics summary row
 * - exportFormats: Export formats ['csv', 'json', 'xlsx']
 * - stateStorageKey: LocalStorage key for persistent state (filters, sort, column visibility)
 */
export interface GenericTableConfig {
  title?: string;
  description?: string;
  /** When true, suppresses the internal h1 header so a TablePageWrapper can own the header */
  hideHeader?: boolean;
  columns: ColumnConfig[];
  filters?: FilterConfig[];
  searchFields: string[];
  rowClickPath?: string;
  exportFilename?: string;
  editConfig?: EditConfig;
  requireDeleteConfirmation?: boolean;
  enableViewSwitcher?: boolean;
  defaultViewMode?: ViewMode;
  enableRowSelection?: boolean;
  enableSorting?: boolean;
  defaultSortColumn?: string;
  defaultSortDirection?: "asc" | "desc";
  rowActions?: RowActionConfig[];
  onDelete?: boolean;

  // Advanced Features (All Optional - Backward Compatible)
  enableVirtualScroll?: boolean;
  virtualScrollHeight?: number;
  enableMultiColumnSort?: boolean;
  advancedFilters?: AdvancedFilterConfig[];
  enableFuzzySearch?: boolean;
  fuzzySearchThreshold?: number;
  enableSavedViews?: boolean;
  savedViews?: SavedView[];
  bulkActions?: BulkAction[];
  enableColumnResize?: boolean;
  enableColumnPin?: boolean;
  enableRowExpansion?: boolean;
  rowExpansionContent?: (row: Record<string, unknown>) => React.ReactNode;
  enableRowDragDrop?: boolean;
  onRowReorder?: (reorderedData: Record<string, unknown>[]) => void;
  enableInlineCellEdit?: boolean;
  enableKeyboardNav?: boolean;
  keyboardShortcuts?: KeyboardShortcut[];
  enableColumnStats?: boolean;
  exportFormats?: ("csv" | "json" | "xlsx")[];
  stateStorageKey?: string;
}

/**
 * Component Props
 *
 * - data: Array of row objects (must have 'id' field)
 * - config: Table configuration object
 * - onSelectionChange: Callback when selection changes
 * - onDeleteRow: Callback when delete action is triggered
 */
export interface GenericDataTableProps {
  data: Record<string, unknown>[];
  config: GenericTableConfig;
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
  onDeleteRow?: (id: string | number) => Promise<{ error?: string }>;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * @deprecated Use UnifiedTablePage from "@/components/tables/unified" for new pages.
 */
export function GenericDataTable({
  data: initialData,
  config,
  onSelectionChange,
  onDeleteRow,
}: GenericDataTableProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // Local copy of data (updated when edits are saved)
  const [data, setData] = useState(initialData);

  // Update data when initialData changes
  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Search term from input field
  const [searchTerm, setSearchTerm] = useState("");

  // Active filter values (key: filter.id, value: selected option)
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Advanced filter values
  const [advancedFilters, setAdvancedFilters] = useState<
    Record<string, unknown>
  >({});

  // Which columns are currently visible (Set for O(1) lookup)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(
      config.columns.filter((col) => col.defaultVisible).map((col) => col.id),
    ),
  );

  // Current row being edited (null when dialog is closed)
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(
    null,
  );

  // Edit dialog open state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Loading state for save operation
  const [isSaving, setIsSaving] = useState(false);

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>(
    config.defaultViewMode || "table",
  );
  const resolvedViewMode: ViewMode =
    isMobile && viewMode === "table" ? "card" : viewMode;

  // Sorting state - now supports multi-column sorting
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>(
    config.defaultSortColumn
      ? [
          {
            columnId: config.defaultSortColumn,
            direction: config.defaultSortDirection || "asc",
          },
        ]
      : [],
  );
  // Legacy single-column sort state (for backward compatibility)
  const [sortColumn, setSortColumn] = useState<string | null>(
    config.defaultSortColumn || null,
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    config.defaultSortDirection || "asc",
  );

  // Row selection state
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(
    new Set(),
  );

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState<
    Record<string, unknown> | null
  >(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Column widths state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Pinned columns state
  const [pinnedColumns, setPinnedColumns] = useState<string[]>([]);

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(
    new Set(),
  );

  // Saved views state
  const [currentView, setCurrentView] = useState<SavedView | null>(null);
  const [showSavedViewsDialog, setShowSavedViewsDialog] = useState(false);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{
    rowId: string | number;
    columnId: string;
  } | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [isSavingCell, setIsSavingCell] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Virtual scroll container ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Fuse.js instance for fuzzy search
  const fuseInstance = useMemo(() => {
    if (!config.enableFuzzySearch) return null;
    return new Fuse(data, {
      keys: config.searchFields,
      threshold: config.fuzzySearchThreshold || 0.3,
      includeScore: true,
    });
  }, [
    data,
    config.enableFuzzySearch,
    config.searchFields,
    config.fuzzySearchThreshold,
  ]);

  // ============================================================================
  // FILTERING, SEARCH & SORTING LOGIC
  // ============================================================================

  /**
   * Memoized filtered and sorted data
   */
  const processedData = useMemo(() => {
    let result = data;

    // Step 1: Search filter (with optional fuzzy search)
    if (searchTerm) {
      if (config.enableFuzzySearch && fuseInstance) {
        // Fuzzy search with Fuse.js
        const fuzzyResults = fuseInstance.search(searchTerm);
        const matchedIds = new Set(fuzzyResults.map((r) => r.item.id));
        result = result.filter((row) => matchedIds.has(row.id));
      } else {
        // Standard substring search
        result = result.filter((row) => {
          const matchesSearch = config.searchFields.some((field) => {
            const value = row[field];
            if (value === null || value === undefined) return false;
            return String(value)
              .toLowerCase()
              .includes(searchTerm.toLowerCase());
          });
          return matchesSearch;
        });
      }
    }

    // Step 2: Basic filters
    if (config.filters && config.filters.length > 0) {
      result = result.filter((row) => {
        for (const filter of config.filters!) {
          const filterValue = filters[filter.id];
          if (filterValue && filterValue !== "all") {
            const rowValue = row[filter.field];
            if (rowValue !== filterValue) return false;
          }
        }
        return true;
      });
    }

    // Step 3: Advanced filters
    if (config.advancedFilters && config.advancedFilters.length > 0) {
      result = result.filter((row) => {
        for (const filter of config.advancedFilters!) {
          const filterValue = advancedFilters[filter.id];
          if (!filterValue) continue;

          const rowValue = row[filter.field];

          switch (filter.type) {
            case "date-range": {
              const range = filterValue as { start?: string; end?: string };
              if (
                range.start &&
                rowValue &&
                new Date(rowValue as string) < new Date(range.start)
              )
                return false;
              if (
                range.end &&
                rowValue &&
                new Date(rowValue as string) > new Date(range.end)
              )
                return false;
              break;
            }
            case "number-range": {
              const range = filterValue as { min?: number; max?: number };
              const numValue = Number(rowValue);
              if (range.min !== undefined && numValue < range.min) return false;
              if (range.max !== undefined && numValue > range.max) return false;
              break;
            }
            case "multi-select": {
              const selected = filterValue as string[];
              if (selected.length > 0 && !selected.includes(String(rowValue)))
                return false;
              break;
            }
            case "single-select": {
              if (filterValue !== "all" && rowValue !== filterValue)
                return false;
              break;
            }
          }
        }
        return true;
      });
    }

    // Step 4: Sort data
    if (config.enableSorting !== false) {
      // Multi-column sorting (if enabled and configured)
      if (config.enableMultiColumnSort && sortConfigs.length > 0) {
        result = [...result].sort((a, b) => {
          for (const sortConfig of sortConfigs) {
            const valueA = a[sortConfig.columnId];
            const valueB = b[sortConfig.columnId];

            // Handle null/undefined
            if (valueA == null && valueB == null) continue;
            if (valueA == null) return sortConfig.direction === "asc" ? 1 : -1;
            if (valueB == null) return sortConfig.direction === "asc" ? -1 : 1;

            // Handle different types
            let comparison = 0;
            if (typeof valueA === "number" && typeof valueB === "number") {
              comparison = valueA - valueB;
            } else {
              // String comparison
              const strA = String(valueA).toLowerCase();
              const strB = String(valueB).toLowerCase();
              comparison = strA.localeCompare(strB);
            }

            if (comparison !== 0) {
              return sortConfig.direction === "asc" ? comparison : -comparison;
            }
          }
          return 0;
        });
      }
      // Single-column sorting (legacy/default)
      else if (sortColumn) {
        result = [...result].sort((a, b) => {
          const valueA = a[sortColumn];
          const valueB = b[sortColumn];

          // Handle null/undefined
          if (valueA == null && valueB == null) return 0;
          if (valueA == null) return sortDirection === "asc" ? 1 : -1;
          if (valueB == null) return sortDirection === "asc" ? -1 : 1;

          // Handle different types
          if (typeof valueA === "number" && typeof valueB === "number") {
            return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
          }

          // String comparison
          const strA = String(valueA).toLowerCase();
          const strB = String(valueB).toLowerCase();
          return sortDirection === "asc"
            ? strA.localeCompare(strB)
            : strB.localeCompare(strA);
        });
      }
    }

    return result;
  }, [
    data,
    searchTerm,
    filters,
    advancedFilters,
    config.searchFields,
    config.filters,
    config.advancedFilters,
    config.enableFuzzySearch,
    config.enableMultiColumnSort,
    config.enableSorting,
    sortColumn,
    sortDirection,
    sortConfigs,
    fuseInstance,
  ]);

  // ============================================================================
  // SORTING HANDLERS
  // ============================================================================

  const handleSort = useCallback(
    (columnId: string, shiftKey = false) => {
      if (config.enableSorting === false) return;

      const column = config.columns.find((c) => c.id === columnId);
      if (column?.sortable === false) return;

      // Multi-column sorting with Shift key
      if (config.enableMultiColumnSort && shiftKey) {
        setSortConfigs((prev) => {
          const existingIndex = prev.findIndex(
            (sc) => sc.columnId === columnId,
          );

          if (existingIndex >= 0) {
            // Toggle direction for existing sort
            const newConfigs = [...prev];
            newConfigs[existingIndex] = {
              ...newConfigs[existingIndex],
              direction:
                newConfigs[existingIndex].direction === "asc" ? "desc" : "asc",
            };
            return newConfigs;
          } else {
            // Add new sort column
            return [...prev, { columnId, direction: "asc" }];
          }
        });
      }
      // Single-column sorting (default)
      else {
        if (sortColumn === columnId) {
          setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
          setSortColumn(columnId);
          setSortDirection("asc");
        }
        // Also update sortConfigs for consistency
        if (config.enableMultiColumnSort) {
          const newDirection =
            sortColumn === columnId && sortDirection === "asc" ? "desc" : "asc";
          setSortConfigs([{ columnId, direction: newDirection }]);
        }
      }
    },
    [
      config.enableSorting,
      config.enableMultiColumnSort,
      config.columns,
      sortColumn,
      sortDirection,
    ],
  );

  const renderSortIcon = (columnId: string) => {
    if (config.enableSorting === false) return null;

    const column = config.columns.find((c) => c.id === columnId);
    if (column?.sortable === false) return null;

    // Multi-column sort indicators
    if (config.enableMultiColumnSort && sortConfigs.length > 0) {
      const sortConfig = sortConfigs.find((sc) => sc.columnId === columnId);
      if (sortConfig) {
        const sortIndex = sortConfigs.findIndex(
          (sc) => sc.columnId === columnId,
        );
        return (
          <div className="ml-1 flex items-center gap-0.5">
            {sortConfig.direction === "asc" ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {sortConfigs.length > 1 && (
              <span className="text-2xs font-medium">{sortIndex + 1}</span>
            )}
          </div>
        );
      }
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />;
    }

    // Single-column sort indicator (legacy)
    if (sortColumn !== columnId) {
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />;
    }

    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="ml-1 h-3.5 w-3.5" />
    );
  };

  // ============================================================================
  // ROW SELECTION HANDLERS
  // ============================================================================

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(
        processedData.map((row) => row.id as string | number),
      );
      setSelectedIds(allIds);
      onSelectionChange?.(Array.from(allIds));
    } else {
      setSelectedIds(new Set());
      onSelectionChange?.([]);
    }
  };

  const handleSelectRow = (id: string | number, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedIds(newSelection);
    onSelectionChange?.(Array.from(newSelection));
  };

  const isAllSelected =
    processedData.length > 0 && selectedIds.size === processedData.length;
  const isSomeSelected =
    selectedIds.size > 0 && selectedIds.size < processedData.length;

  // ============================================================================
  // RENDERING HELPERS
  // ============================================================================

  /**
   * Format Date Helper
   */
  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    try {
      return format(new Date(date), "MMM dd, yyyy");
    } catch {
      return "Invalid date";
    }
  };

  /**
   * Render With Config
   */
  const renderWithConfig = (value: unknown, renderConfig: RenderConfig) => {
    switch (renderConfig.type) {
      case "badge": {
        const strValue = String(value || "");
        const variant =
          renderConfig.variantMap?.[strValue] ||
          renderConfig.defaultVariant ||
          "outline";
        return <Badge variant={variant}>{strValue || "N/A"}</Badge>;
      }

      case "currency": {
        const numValue = Number(value);
        if (!value || Number.isNaN(numValue)) return "N/A";
        const formatted =
          renderConfig.showDecimals !== false
            ? numValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : numValue.toLocaleString();
        return `${renderConfig.prefix || "$"}${formatted}`;
      }

      case "truncate": {
        const text = String(value || "");
        if (!text) return "N/A";
        return text.length > renderConfig.maxLength
          ? `${text.substring(0, renderConfig.maxLength)}...`
          : text;
      }

      case "array": {
        if (!value || !Array.isArray(value)) return "N/A";
        if (renderConfig.itemType === "badge") {
          return (
            <div className="flex gap-1 flex-wrap">
              {value.map((item, idx) => (
                <Badge
                  key={`${String(item)}-${idx}`}
                  variant="outline"
                  className="text-xs"
                >
                  {String(item)}
                </Badge>
              ))}
            </div>
          );
        }
        return value.join(renderConfig.separator || ", ");
      }

      case "json": {
        if (!value) return "N/A";
        try {
          const text = JSON.stringify(value);
          return text.length > renderConfig.maxLength
            ? `${text.substring(0, renderConfig.maxLength)}...`
            : text;
        } catch {
          return "Invalid JSON";
        }
      }

      case "nested": {
        const parts = renderConfig.path.split(".");
        let result: unknown = value;

        for (const part of parts) {
          if (result && typeof result === "object" && part in result) {
            result = (result as Record<string, unknown>)[part];
          } else {
            return renderConfig.fallback || "N/A";
          }
        }

        return result ? String(result) : renderConfig.fallback || "N/A";
      }

      default:
        return String(value || "N/A");
    }
  };

  /**
   * Render Cell Content
   */
  const renderCellContent = (
    column: ColumnConfig,
    row: Record<string, unknown>,
  ) => {
    const value = row[column.id];

    if (column.renderConfig) {
      return renderWithConfig(value, column.renderConfig);
    }

    switch (column.type) {
      case "date":
        return formatDate(value as string);

      case "badge":
        return <Badge variant="outline">{value ? String(value) : "N/A"}</Badge>;

      case "email":
        return value ? (
          <a href={`mailto:${value}`} className="text-primary hover:underline">
            <Text as="span" size="sm">
              {String(value)}
            </Text>
          </a>
        ) : (
          <Text as="span" tone="muted" size="sm">
            N/A
          </Text>
        );

      case "number":
        return value !== null && value !== undefined
          ? Number(value).toLocaleString()
          : "N/A";

      default:
        return value ? String(value) : "N/A";
    }
  };

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  const exportToCSV = () => {
    const headers = config.columns
      .filter((col) => visibleColumns.has(col.id))
      .map((col) => col.label);

    const rows = processedData.map((row) =>
      config.columns
        .filter((col) => visibleColumns.has(col.id))
        .map((col) => {
          const value = row[col.id];
          if (col.type === "date") {
            return formatDate(value as string);
          }
          return value ? String(value) : "";
        }),
    );

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = config.exportFilename || "export.csv";
    a.click();
  };

  const handleRowClick = (row: Record<string, unknown>) => {
    if (config.rowClickPath) {
      const path = config.rowClickPath.replace("{id}", String(row.id));
      router.push(path);
    }
  };

  const handleEditClick = (
    row: Record<string, unknown>,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setEditingRow({ ...row });
    setIsEditDialogOpen(true);
  };

  const executeDelete = async (row: Record<string, unknown>) => {
    if (!onDeleteRow) return;

    const id = row.id as string | number;
    setDeletingId(id);
    try {
      const { error } = await onDeleteRow(id);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Deleted successfully");
        setData((prev) => prev.filter((r) => r.id !== id));
        const newSelection = new Set(selectedIds);
        newSelection.delete(id);
        setSelectedIds(newSelection);
        onSelectionChange?.(Array.from(newSelection));
      }
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteClick = (
    row: Record<string, unknown>,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!onDeleteRow) return;

    if (config.requireDeleteConfirmation) {
      setPendingDeleteRow(row);
      setIsDeleteDialogOpen(true);
      return;
    }

    void executeDelete(row);
  };

  const handleSaveEdit = async () => {
    if (!editingRow || !config.editConfig) return;

    setIsSaving(true);
    try {
      await apiFetch("/api/table-update", {
        method: "POST",
        body: JSON.stringify({
          table: config.editConfig.tableName,
          id: editingRow.id,
          data: editingRow,
        }),
      });

      setData((prevData) =>
        prevData.map((row) => (row.id === editingRow.id ? editingRow : row)),
      );

      toast.success("Changes saved successfully");

      setIsEditDialogOpen(false);
      setEditingRow(null);
    } catch (error) {
      toast.error("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: unknown) => {
    if (!editingRow) return;
    setEditingRow({ ...editingRow, [fieldId]: value });
  };

  // ============================================================================
  // INLINE CELL EDITING HANDLERS
  // ============================================================================

  const handleCellDoubleClick = useCallback(
    (rowId: string | number, columnId: string, currentValue: unknown) => {
      if (!config.enableInlineCellEdit) return;

      const column = config.columns.find((c) => c.id === columnId);
      const isEditable =
        !config.editConfig?.editableFields ||
        config.editConfig.editableFields.includes(columnId);

      // Prevent editing of system fields
      if (
        columnId === "id" ||
        columnId === "created_at" ||
        columnId === "updated_at"
      )
        return;

      if (isEditable && column) {
        setEditingCell({ rowId, columnId });
        setEditingValue(String(currentValue || ""));
        // Focus input after state update
        setTimeout(() => editInputRef.current?.focus(), 0);
      }
    },
    [
      config.enableInlineCellEdit,
      config.columns,
      config.editConfig?.editableFields,
    ],
  );

  const handleCellSave = useCallback(
    async (rowId: string | number, columnId: string, newValue: string) => {
      if (!config.editConfig) return;

      setIsSavingCell(true);
      try {
        await apiFetch("/api/table-update", {
          method: "POST",
          body: JSON.stringify({
            table: config.editConfig.tableName,
            id: rowId,
            data: { [columnId]: newValue },
          }),
        });

        // Update local data
        setData((prevData) =>
          prevData.map((row) =>
            row.id === rowId ? { ...row, [columnId]: newValue } : row,
          ),
        );

        toast.success("Cell updated successfully");
        setEditingCell(null);
        setEditingValue("");
      } catch (error) {
        toast.error("Failed to save changes. Please try again.");
      } finally {
        setIsSavingCell(false);
      }
    },
    [config.editConfig],
  );

  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
    setEditingValue("");
  }, []);

  const handleTabNavigation = useCallback(
    (
      currentRowId: string | number,
      currentColumnId: string,
      direction: "next" | "prev",
    ) => {
      const visibleCols = config.columns.filter((col) =>
        visibleColumns.has(col.id),
      );
      const editableCols = visibleCols.filter((col) => {
        const isEditable =
          !config.editConfig?.editableFields ||
          config.editConfig.editableFields.includes(col.id);
        return (
          isEditable &&
          col.id !== "id" &&
          col.id !== "created_at" &&
          col.id !== "updated_at"
        );
      });

      const currentColIndex = editableCols.findIndex(
        (col) => col.id === currentColumnId,
      );
      const currentRowIndex = processedData.findIndex(
        (row) => row.id === currentRowId,
      );

      if (direction === "next") {
        // Move to next cell
        if (currentColIndex < editableCols.length - 1) {
          const nextCol = editableCols[currentColIndex + 1];
          const currentRow = processedData[currentRowIndex];
          setEditingCell({ rowId: currentRowId, columnId: nextCol.id });
          setEditingValue(String(currentRow[nextCol.id] || ""));
        } else if (currentRowIndex < processedData.length - 1) {
          // Move to first cell of next row
          const nextRow = processedData[currentRowIndex + 1];
          const firstCol = editableCols[0];
          setEditingCell({
            rowId: nextRow.id as string | number,
            columnId: firstCol.id,
          });
          setEditingValue(String(nextRow[firstCol.id] || ""));
        }
      } else {
        // Move to previous cell
        if (currentColIndex > 0) {
          const prevCol = editableCols[currentColIndex - 1];
          const currentRow = processedData[currentRowIndex];
          setEditingCell({ rowId: currentRowId, columnId: prevCol.id });
          setEditingValue(String(currentRow[prevCol.id] || ""));
        } else if (currentRowIndex > 0) {
          // Move to last cell of previous row
          const prevRow = processedData[currentRowIndex - 1];
          const lastCol = editableCols[editableCols.length - 1];
          setEditingCell({
            rowId: prevRow.id as string | number,
            columnId: lastCol.id,
          });
          setEditingValue(String(prevRow[lastCol.id] || ""));
        }
      }

      // Focus input after state update
      setTimeout(() => editInputRef.current?.focus(), 0);
    },
    [
      config.columns,
      config.editConfig?.editableFields,
      visibleColumns,
      processedData,
    ],
  );

  // Focus input when editing cell changes
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // ============================================================================
  // ROW ACTIONS RENDERER
  // ============================================================================

  const renderRowActions = (row: Record<string, unknown>) => {
    const hasEditConfig = !!config.editConfig;
    const hasDelete = !!onDeleteRow || config.onDelete;
    const hasCustomActions = config.rowActions && config.rowActions.length > 0;
    const isCurrentlyDeleting = deletingId === row.id;

    if (!hasEditConfig && !hasDelete && !hasCustomActions) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            data-testid={`row-actions-${row.id}`}
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {hasEditConfig && (
            <DropdownMenuItem onClick={(e) => handleEditClick(row, e)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {config.rowActions?.map((action) => (
            <DropdownMenuItem
              key={action.id}
              className={
                action.variant === "destructive" ? "text-destructive" : ""
              }
              onClick={(event) => {
                event.stopPropagation();
                void action.onClick?.(row);
              }}
            >
              {action.icon === "pencil" && <Pencil className="h-4 w-4 mr-2" />}
              {action.icon === "trash" && <Trash2 className="h-4 w-4 mr-2" />}
              {action.label}
            </DropdownMenuItem>
          ))}
          {hasDelete && (
            <DropdownMenuItem
              onClick={(e) => handleDeleteClick(row, e)}
              className="text-destructive"
              disabled={isCurrentlyDeleting}
              data-testid={`row-action-delete-${row.id}`}
            >
              {isCurrentlyDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // ============================================================================
  // VIEW RENDERERS
  // ============================================================================

  const renderCardView = () => {
    const primaryColumn =
      config.columns.find((c) => c.isPrimary) || config.columns[0];
    const secondaryColumn =
      config.columns.find((c) => c.isSecondary) || config.columns[1];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-4">
        {processedData.map((row, idx) => (
          <Card
            key={(row.id as string) || idx}
            className={cn(
              "group hover-lift transition-smooth cursor-pointer",
              "border border-border bg-card",
              selectedIds.has(row.id as string | number) &&
                "ring-2 ring-primary border-primary/50",
            )}
            onClick={() => handleRowClick(row)}
          >
            <CardContent className="p-4 sm:p-4">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {config.enableRowSelection && (
                    <Checkbox
                      checked={selectedIds.has(row.id as string | number)}
                      onCheckedChange={(checked) => {
                        handleSelectRow(row.id as string | number, !!checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Select row"
                      className="mt-1 focus-ring-brand"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-semibold text-foreground leading-tight">
                      {renderCellContent(primaryColumn, row)}
                    </p>
                    {secondaryColumn && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-tight">
                        {renderCellContent(secondaryColumn, row)}
                      </p>
                    )}
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  {renderRowActions(row)}
                </div>
              </div>

              <div className="space-y-2">
                {config.columns
                  .filter(
                    (c) =>
                      !c.isPrimary &&
                      !c.isSecondary &&
                      visibleColumns.has(c.id),
                  )
                  .slice(0, 3)
                  .map((column) => (
                    <div key={column.id} className="flex justify-between items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {column.label}
                      </span>
                      <div className="text-xs sm:text-sm text-foreground text-right flex-1 min-w-0">
                        {renderCellContent(column, row)}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {processedData.length === 0 && (
          <div className="col-span-full empty-state-premium">
            <div className="empty-state-premium-title">
              No {config.title?.toLowerCase() || "items"} found
            </div>
            <div className="empty-state-premium-description">
              Try adjusting your search or filter criteria
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderListView = () => {
    const primaryColumn =
      config.columns.find((c) => c.isPrimary) || config.columns[0];
    const secondaryColumn =
      config.columns.find((c) => c.isSecondary) || config.columns[1];

    return (
      <div className="space-y-2 sm:space-y-4">
        {processedData.map((row, idx) => (
          <div
            key={(row.id as string) || idx}
            className={cn(
              "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 sm:p-4 rounded-lg border bg-card hover:bg-muted/50 hover-lift transition-smooth cursor-pointer",
              "border border-border",
              selectedIds.has(row.id as string | number) &&
                "ring-2 ring-primary border-primary/50",
            )}
            onClick={() => handleRowClick(row)}
          >
            <div className="flex items-start gap-4 flex-1 min-w-0">
              {config.enableRowSelection && (
                <Checkbox
                  checked={selectedIds.has(row.id as string | number)}
                  onCheckedChange={(checked) => {
                    handleSelectRow(row.id as string | number, !!checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Select row"
                  className="mt-1 focus-ring-brand"
                />
              )}
              <div className="flex-1 min-w-0">
                {/* Main content row for mobile */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                  <p className="text-sm sm:text-base font-medium text-foreground truncate flex-1">
                    {renderCellContent(primaryColumn, row)}
                  </p>
                  {secondaryColumn && (
                    <span className="text-xs sm:text-sm text-muted-foreground truncate sm:text-right">
                      {renderCellContent(secondaryColumn, row)}
                    </span>
                  )}
                </div>

                {/* Additional fields - mobile friendly layout */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  {config.columns
                    .filter(
                      (c) =>
                        !c.isPrimary &&
                        !c.isSecondary &&
                        visibleColumns.has(c.id),
                    )
                    .slice(0, 4)
                    .map((column) => (
                      <span key={column.id} className="flex-shrink-0">
                        <span className="font-medium text-muted-foreground">{column.label}:</span>{" "}
                        <span className="text-foreground">{renderCellContent(column, row)}</span>
                      </span>
                    ))}
                </div>
              </div>
            </div>

            {/* Actions - always on the right */}
            <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0 self-start sm:self-center">
              {renderRowActions(row)}
            </div>
          </div>
        ))}
        {processedData.length === 0 && (
          <div className="empty-state-premium">
            <div className="empty-state-premium-title">
              No {config.title?.toLowerCase() || "items"} found
            </div>
            <div className="empty-state-premium-description">
              Try adjusting your search or filter criteria
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // INLINE CELL EDITOR COMPONENT
  // ============================================================================

  const InlineCellEditor = ({
    rowId,
    columnId,
    value,
  }: {
    rowId: string | number;
    columnId: string;
    value: unknown;
  }) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCellSave(rowId, columnId, editingValue);
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCellCancel();
      } else if (e.key === "Tab") {
        e.preventDefault();
        // Save current value before navigating
        handleCellSave(rowId, columnId, editingValue).then(() => {
          handleTabNavigation(rowId, columnId, e.shiftKey ? "prev" : "next");
        });
      }
    };

    return (
      <div className="relative">
        <input
          ref={editInputRef}
          type="text"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Save on blur
            if (editingValue !== String(value || "")) {
              handleCellSave(rowId, columnId, editingValue);
            } else {
              handleCellCancel();
            }
          }}
          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={isSavingCell}
          aria-label="Edit cell value"
          placeholder="Enter value"
        />
        {isSavingCell && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    );
  };

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: processedData.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 53, // Approximate row height in pixels
    enabled: config.enableVirtualScroll,
    overscan: 5,
  });

  const renderTableView = () => {
    const hasActions =
      config.editConfig ||
      onDeleteRow ||
      config.onDelete ||
      config.rowActions?.length;

    // Virtual scrolling enabled
    if (config.enableVirtualScroll) {
      return (
        <div className="rounded-sm border">
          <Table>
            <TableHeader>
              <TableRow>
                {config.enableRowSelection && (
                  <TableHead className="w-[50px]">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) {
                            (
                              el as HTMLButtonElement & {
                                indeterminate?: boolean;
                              }
                            ).indeterminate = isSomeSelected;
                          }
                        }}
                        onCheckedChange={(checked) =>
                          handleSelectAll(!!checked)
                        }
                        aria-label="Select all"
                      />
                    </div>
                  </TableHead>
                )}
                {config.columns
                  .filter((col) => visibleColumns.has(col.id))
                  .map((col) => {
                    const isSortable =
                      config.enableSorting !== false && col.sortable !== false;
                    return (
                      <TableHead
                        key={col.id}
                        className={cn(
                          isSortable &&
                            "cursor-pointer select-none hover:bg-muted/50",
                        )}
                        onClick={(e) =>
                          isSortable && handleSort(col.id, e.shiftKey)
                        }
                      >
                        <div className="flex items-center">
                          {col.label}
                          {renderSortIcon(col.id)}
                        </div>
                      </TableHead>
                    );
                  })}
                {hasActions && (
                  <TableHead className="w-[70px] text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
          </Table>
          <div
            ref={tableContainerRef}
            style={{
              height: `${config.virtualScrollHeight || 600}px`,
              overflow: "auto",
            }}
          >
            <Table>
              <TableBody
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: "relative",
                }}
              >
                {processedData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={
                        config.columns.filter((col) =>
                          visibleColumns.has(col.id),
                        ).length +
                        (config.enableRowSelection ? 1 : 0) +
                        (hasActions ? 1 : 0)
                      }
                      className="h-24 text-center"
                    >
                      No {config.title?.toLowerCase() || "items"} found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = processedData[virtualRow.index];
                    return (
                      <TableRow
                        key={(row.id as string) || virtualRow.index}
                        className={cn(
                          config.rowClickPath
                            ? "cursor-pointer hover:bg-muted/50 transition-colors"
                            : "",
                          selectedIds.has(row.id as string | number) &&
                            "bg-muted/30",
                        )}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        onClick={() => handleRowClick(row)}
                        data-state={
                          selectedIds.has(row.id as string | number)
                            ? "selected"
                            : undefined
                        }
                      >
                        {config.enableRowSelection && (
                          <TableCell>
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={selectedIds.has(
                                  row.id as string | number,
                                )}
                                onCheckedChange={(checked) => {
                                  handleSelectRow(
                                    row.id as string | number,
                                    !!checked,
                                  );
                                }}
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Select row"
                              />
                            </div>
                          </TableCell>
                        )}
                        {config.columns
                          .filter((col) => visibleColumns.has(col.id))
                          .map((col) => (
                            <TableCell
                              key={col.id}
                              onDoubleClick={() =>
                                handleCellDoubleClick(
                                  row.id as string | number,
                                  col.id,
                                  row[col.id],
                                )
                              }
                              className={
                                config.enableInlineCellEdit ? "cursor-text" : ""
                              }
                            >
                              {editingCell?.rowId === row.id &&
                              editingCell?.columnId === col.id ? (
                                <InlineCellEditor
                                  rowId={row.id as string | number}
                                  columnId={col.id}
                                  value={row[col.id]}
                                />
                              ) : (
                                renderCellContent(col, row)
                              )}
                            </TableCell>
                          ))}
                        {hasActions && (
                          <TableCell className="text-right">
                            {renderRowActions(row)}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      );
    }

    // Standard rendering (no virtual scroll)
    return (
      <div className="rounded-sm border">
        <Table>
          <TableHeader>
            <TableRow>
              {config.enableRowSelection && (
                <TableHead className="w-[50px]">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) {
                          (
                            el as HTMLButtonElement & {
                              indeterminate?: boolean;
                            }
                          ).indeterminate = isSomeSelected;
                        }
                      }}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      aria-label="Select all"
                    />
                  </div>
                </TableHead>
              )}
              {config.columns
                .filter((col) => visibleColumns.has(col.id))
                .map((col) => {
                  const isSortable =
                    config.enableSorting !== false && col.sortable !== false;
                  return (
                    <TableHead
                      key={col.id}
                      className={cn(
                        isSortable &&
                          "cursor-pointer select-none hover:bg-muted/50",
                      )}
                      onClick={(e) =>
                        isSortable && handleSort(col.id, e.shiftKey)
                      }
                    >
                      <div className="flex items-center">
                        {col.label}
                        {renderSortIcon(col.id)}
                      </div>
                    </TableHead>
                  );
                })}
              {hasActions && (
                <TableHead className="w-[70px] text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={
                    config.columns.filter((col) => visibleColumns.has(col.id))
                      .length +
                    (config.enableRowSelection ? 1 : 0) +
                    (hasActions ? 1 : 0)
                  }
                  className="h-24 text-center"
                >
                  No {config.title?.toLowerCase() || "items"} found.
                </TableCell>
              </TableRow>
            ) : (
              processedData.map((row, idx) => (
                <TableRow
                  key={(row.id as string) || idx}
                  className={cn(
                    config.rowClickPath
                      ? "cursor-pointer hover:bg-muted/50 transition-colors"
                      : "",
                    selectedIds.has(row.id as string | number) && "bg-muted/30",
                  )}
                  onClick={() => handleRowClick(row)}
                  data-state={
                    selectedIds.has(row.id as string | number)
                      ? "selected"
                      : undefined
                  }
                >
                  {config.enableRowSelection && (
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedIds.has(row.id as string | number)}
                          onCheckedChange={(checked) => {
                            handleSelectRow(
                              row.id as string | number,
                              !!checked,
                            );
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Select row"
                        />
                      </div>
                    </TableCell>
                  )}
                  {config.columns
                    .filter((col) => visibleColumns.has(col.id))
                    .map((col) => (
                      <TableCell
                        key={col.id}
                        onDoubleClick={() =>
                          handleCellDoubleClick(
                            row.id as string | number,
                            col.id,
                            row[col.id],
                          )
                        }
                        className={
                          config.enableInlineCellEdit ? "cursor-text" : ""
                        }
                      >
                        {editingCell?.rowId === row.id &&
                        editingCell?.columnId === col.id ? (
                          <InlineCellEditor
                            rowId={row.id as string | number}
                            columnId={col.id}
                            value={row[col.id]}
                          />
                        ) : (
                          renderCellContent(col, row)
                        )}
                      </TableCell>
                    ))}
                  {hasActions && (
                    <TableCell className="text-right">
                      {renderRowActions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* ========================================
          HEADER SECTION
          ======================================== */}
      {config.title && !config.hideHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl">{config.title}</h1>
            {config.description && (
              <p className="text-sm text-muted-foreground">
                {config.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {config.enableRowSelection && selectedIds.size > 0 && (
              <span>{selectedIds.size} selected</span>
            )}
            <span>
              {processedData.length} of {data.length}{" "}
              {config.title?.toLowerCase() || "items"}
            </span>
          </div>
        </div>
      )}

      {/* ========================================
          BULK ACTIONS (Shown when rows selected)
          ======================================== */}
      {config.bulkActions && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-4 bg-primary/10 border rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} row{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2 ml-4">
            {config.bulkActions.map((action) => {
              const isDisabled =
                action.disabled?.(Array.from(selectedIds)) ?? false;
              return (
                <Button
                  key={action.id}
                  variant={action.variant || "default"}
                  size="sm"
                  disabled={isDisabled}
                  onClick={async () => {
                    await action.onClick(Array.from(selectedIds));
                    // Optionally clear selection after action
                    setSelectedIds(new Set());
                    onSelectionChange?.([]);
                  }}
                >
                  {action.icon}
                  {action.label}
                </Button>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedIds(new Set());
              onSelectionChange?.([]);
            }}
            className="ml-auto"
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* ========================================
          FILTERS & CONTROLS
          ======================================== */}
      <div className="flex flex-col gap-4 sm:gap-4">
        {/* Top row - Search and filters (mobile-first) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-4">
          {/* Search Input - Full width on mobile */}
          <div className="relative flex-1 sm:flex-initial sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${config.title?.toLowerCase() || "items"}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>

          {/* Dynamic Filters - Stack on mobile */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            {config.filters?.map((filter) => (
              <Select
                key={filter.id}
                value={filters[filter.id] || "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, [filter.id]: value }))
                }
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {filter.label}</SelectItem>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        </div>

        {/* Bottom row - View controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Result count - Show on mobile */}
          <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
            {config.enableRowSelection && selectedIds.size > 0 && (
              <span className="font-medium">{selectedIds.size} selected</span>
            )}
            <span>
              {processedData.length} of {data.length}{" "}
              {config.title?.toLowerCase() || "items"}
            </span>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            {/* View Switcher */}
            {config.enableViewSwitcher && (
              <Tabs
                value={viewMode}
                onValueChange={(v) => setViewMode(v as ViewMode)}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid grid-cols-3 w-full sm:w-auto">
                  <TabsTrigger value="table" className="gap-2 px-2 sm:px-4">
                    <Table2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Table</span>
                  </TabsTrigger>
                  <TabsTrigger value="card" className="gap-2 px-2 sm:px-4">
                    <LayoutGrid className="h-4 w-4" />
                    <span className="hidden sm:inline">Card</span>
                  </TabsTrigger>
                  <TabsTrigger value="list" className="gap-2 px-2 sm:px-4">
                    <List className="h-4 w-4" />
                    <span className="hidden sm:inline">List</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {/* Action buttons - Stack on mobile */}
            <div className="flex gap-2">
              {/* Export Button */}
              <Button variant="outline" size="sm" onClick={exportToCSV} className="flex-1 sm:flex-initial">
                <Download />
                <span className="hidden xs:inline">Export</span>
              </Button>

              {/* Column Visibility Toggle - Hide on mobile when view is not table */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1 sm:flex-initial",
                      resolvedViewMode !== "table" && "hidden sm:flex"
                    )}
                  >
                    <Columns3 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Columns</span>
                    <ChevronDown className="sm:" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {config.columns.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={visibleColumns.has(column.id)}
                      onCheckedChange={(checked) => {
                        const newVisibleColumns = new Set(visibleColumns);
                        if (checked) {
                          newVisibleColumns.add(column.id);
                        } else {
                          newVisibleColumns.delete(column.id);
                        }
                        setVisibleColumns(newVisibleColumns);
                      }}
                    >
                      {column.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================
          CONTENT (View-based rendering)
          ======================================== */}
      {resolvedViewMode === "table" && renderTableView()}
      {resolvedViewMode === "card" && renderCardView()}
      {resolvedViewMode === "list" && renderListView()}

      {/* ========================================
          DELETE CONFIRMATION
          ======================================== */}
      {config.requireDeleteConfirmation && (
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            setIsDeleteDialogOpen(open);
            if (!open) {
              setPendingDeleteRow(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this record?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                selected record.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                data-testid="confirm-delete-button"
                onClick={() => {
                  if (pendingDeleteRow) {
                    void executeDelete(pendingDeleteRow);
                  }
                  setIsDeleteDialogOpen(false);
                  setPendingDeleteRow(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* ========================================
          EDIT DIALOG
          ======================================== */}
      {config.editConfig && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Edit {config.title?.slice(0, -1) || "Item"}
              </DialogTitle>
              <DialogDescription>
                Make changes to this record. Click save when you&apos;re done.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {editingRow &&
                config.columns
                  .filter(
                    (col) =>
                      col.id !== "id" &&
                      col.id !== "created_at" &&
                      col.id !== "updated_at",
                  )
                  .map((col) => {
                    const value = editingRow[col.id];
                    const isEditable =
                      !config.editConfig?.editableFields ||
                      config.editConfig.editableFields.includes(col.id);

                    if (!isEditable) return null;

                    return (
                      <div
                        key={col.id}
                        className="grid grid-cols-4 items-start gap-4"
                      >
                        <Label htmlFor={col.id} className="text-right pt-2">
                          {col.label}
                        </Label>
                        <div className="col-span-3">
                          {col.type === "date" ? (
                            <Input
                              id={col.id}
                              type="date"
                              value={value ? String(value).split("T")[0] : ""}
                              onChange={(e) =>
                                handleFieldChange(col.id, e.target.value)
                              }
                            />
                          ) : col.renderConfig?.type === "badge" ||
                            col.type === "badge" ? (
                            <Select
                              value={String(value || "")}
                              onValueChange={(v) =>
                                handleFieldChange(col.id, v)
                              }
                            >
                              <SelectTrigger id={col.id}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {config.filters
                                  ?.find((f) => f.field === col.id)
                                  ?.options.map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                    >
                                      {opt.label}
                                    </SelectItem>
                                  )) || []}
                              </SelectContent>
                            </Select>
                          ) : col.renderConfig?.type === "currency" ||
                            col.type === "number" ? (
                            <Input
                              id={col.id}
                              type="number"
                              step="0.01"
                              value={value ? Number(value) : ""}
                              onChange={(e) =>
                                handleFieldChange(
                                  col.id,
                                  parseFloat(e.target.value),
                                )
                              }
                            />
                          ) : col.type === "email" ? (
                            <Input
                              id={col.id}
                              type="email"
                              value={String(value || "")}
                              onChange={(e) =>
                                handleFieldChange(col.id, e.target.value)
                              }
                            />
                          ) : (
                            <Textarea
                              id={col.id}
                              value={String(value || "")}
                              onChange={(e) =>
                                handleFieldChange(col.id, e.target.value)
                              }
                              rows={3}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingRow(null);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
