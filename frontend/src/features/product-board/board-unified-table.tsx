"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Minus, MessageSquare, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  UnifiedTablePage,
  editableSelectColumn,
  editableTextColumn,
  useUnifiedTableState,
  type InlineSelectOption,
  type TableColumn,
} from "@/components/tables/unified";
import { BOARD_STATUSES, BOARD_STATUS_LABELS, type BoardStatus } from "@/lib/admin-feedback/constants";
import { cn } from "@/lib/utils";
import type { BoardItem } from "./use-product-board";
import type { BoardItemMeta } from "./use-board-item";
import { getLinearIssueLink } from "./linear-issue-link";
import { BOARD_CAPTURE_TOPICS, getBoardCaptureTopics } from "./topics";
import {
  getBoardCategory,
  getBoardItemType,
  getBoardTool,
  formatBoardItemTypeLabel,
} from "./metadata";
import { useBoardUsers, usePatchBoardItem } from "./use-board-item";

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<BoardStatus, string> = {
  submitted: "bg-muted text-muted-foreground",
  planned: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  leadership_review: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  shipped: "bg-status-success/10 text-status-success",
};

const STATUS_ORDER: Record<BoardStatus, number> = {
  submitted: 0,
  planned: 1,
  in_progress: 2,
  leadership_review: 3,
  shipped: 4,
};

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const CLEAR_SELECT_VALUE = "__clear__";

const PRIORITY_EDIT_OPTIONS: InlineSelectOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const BOARD_STATUS_EDIT_OPTIONS: InlineSelectOption[] = BOARD_STATUSES.map(
  (status) => ({
    value: status,
    label: BOARD_STATUS_LABELS[status],
  }),
);

const SEVERITY_ICONS: Record<string, ReactElement> = {
  high: <AlertTriangle className="h-3.5 w-3.5 text-destructive" />,
  medium: <Zap className="h-3.5 w-3.5 text-yellow-500" />,
  low: <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
};

function AssigneeAvatar({ name, email }: { name: string | null; email: string }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : email[0].toUpperCase();
  return (
    <div
      className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground"
      title={name ?? email}
    >
      {initials}
    </div>
  );
}

// ─── Column config ────────────────────────────────────────────────────────────

const columnConfigs = [
  { id: "title",         label: "Title",    alwaysVisible: true },
  { id: "board_status",  label: "Status",   defaultVisible: true },
  { id: "tool",          label: "Tool",     defaultVisible: true },
  { id: "category",      label: "Category", defaultVisible: true },
  { id: "type",          label: "Type",     defaultVisible: true },
  { id: "severity",      label: "Priority", defaultVisible: true },
  { id: "topics",        label: "Topics",   defaultVisible: true },
  { id: "linear_issue",  label: "Linear",   defaultVisible: true },
  { id: "assignee",      label: "Assignee", defaultVisible: true },
  { id: "due_date",      label: "Due Date", defaultVisible: true },
  { id: "comment_count", label: "Comments", defaultVisible: true },
  { id: "created_at",    label: "Created",  defaultVisible: true },
];

const defaultVisibleColumns = columnConfigs
  .filter((c) => c.defaultVisible !== false || c.alwaysVisible)
  .map((c) => c.id);

// ─── Component ────────────────────────────────────────────────────────────────

interface BoardUnifiedTableProps {
  items: BoardItem[];
  isLoading: boolean;
  error: Error | null;
  isFiltered?: boolean;
}

export function BoardUnifiedTable({ items, isLoading, error, isFiltered = false }: BoardUnifiedTableProps) {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = (useSearchParams() ?? new URLSearchParams()) as NonNullable<ReturnType<typeof useSearchParams>>;

  const tableState = useUnifiedTableState({
    entityKey: "product-board-table",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "board_status",
      sortDirection: "asc",
      visibleColumns: defaultVisibleColumns,
      filters: {},
    },
  });

  const { data: usersData } = useBoardUsers();
  const patchBoardItem = usePatchBoardItem();

  // ─── Client-side search + filter ──────────────────────────────────────────

  const filtered = React.useMemo(() => {
    const q = tableState.debouncedSearch.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.comment?.toLowerCase().includes(q),
    );
  }, [items, tableState.debouncedSearch]);

  // ─── Columns ──────────────────────────────────────────────────────────────

  const assigneeOptions = React.useMemo<InlineSelectOption[]>(
    () => [
      { value: CLEAR_SELECT_VALUE, label: "Unassigned" },
      ...(usersData?.users ?? []).map((user) => ({
        value: user.id,
        label: user.full_name ?? user.email,
      })),
    ],
    [usersData?.users],
  );

  const tableColumns: TableColumn<BoardItem>[] = React.useMemo(
    () => [
      editableTextColumn(
        {
          id: "title",
          label: "Title",
          alwaysVisible: true,
          render: (item) => (
            <span className="font-medium line-clamp-2 leading-snug">{item.title}</span>
          ),
          sortable: true,
          sortValue: (item) => item.title,
        },
        {
          getValue: (item) => item.title,
          onEdit: async (item, value) => {
            const nextTitle = value.trim();
            if (!nextTitle) {
              throw new Error("Title cannot be empty.");
            }
            await patchBoardItem.mutateAsync({
              itemId: item.id,
              updates: { title: nextTitle },
            });
          },
          emptyLabel: "Edit title",
        },
      ),
      editableSelectColumn(
        {
          id: "board_status",
          label: "Status",
          defaultVisible: true,
          render: (item) => (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                STATUS_COLORS[item.board_status],
              )}
            >
              {BOARD_STATUS_LABELS[item.board_status]}
            </span>
          ),
          sortable: true,
          sortValue: (item) => STATUS_ORDER[item.board_status],
        },
        {
          getValue: (item) => item.board_status,
          onEdit: async (item, value) => {
            await patchBoardItem.mutateAsync({
              itemId: item.id,
              updates: { board_status: value as BoardStatus },
            });
          },
          options: BOARD_STATUS_EDIT_OPTIONS,
          emptyLabel: "Status",
        },
      ),
      editableSelectColumn(
        {
          id: "severity",
          label: "Priority",
          defaultVisible: true,
          render: (item) =>
            item.severity ? (SEVERITY_ICONS[item.severity] ?? null) : null,
          sortable: true,
          sortValue: (item) => SEVERITY_ORDER[item.severity ?? "low"] ?? 2,
        },
        {
          getValue: (item) => item.severity ?? "",
          onEdit: async (item, value) => {
            await patchBoardItem.mutateAsync({
              itemId: item.id,
              updates: { severity: value as "low" | "medium" | "high" },
            });
          },
          options: PRIORITY_EDIT_OPTIONS,
          emptyLabel: "Priority",
        },
      ),
      editableTextColumn(
        {
          id: "tool",
          label: "Tool",
          defaultVisible: true,
          render: (item) => {
            const tool = getBoardTool(item);
            if (!tool) return null;

            return (
              <span className="text-xs text-foreground/80">
                {tool}
              </span>
            );
          },
          sortable: true,
          sortValue: (item) => getBoardTool(item) ?? "",
        },
        {
          getValue: (item) => getBoardTool(item) ?? "",
          onEdit: async (item, value) => {
            await patchBoardItem.mutateAsync({
              itemId: item.id,
              updates: {
                metadata: {
                  tool: value.trim() || null,
                },
              },
            });
          },
          inputType: "text",
          emptyLabel: "Tool",
        },
      ),
      editableTextColumn(
        {
          id: "category",
          label: "Category",
          defaultVisible: true,
          render: (item) => {
            const category = getBoardCategory(item);
            if (!category) return null;

            return (
              <span className="text-xs text-muted-foreground">
                {category}
              </span>
            );
          },
          sortable: true,
          sortValue: (item) => getBoardCategory(item) ?? "",
        },
        {
          getValue: (item) => getBoardCategory(item) ?? "",
          onEdit: async (item, value) => {
            await patchBoardItem.mutateAsync({
              itemId: item.id,
              updates: {
                metadata: {
                  category: value.trim() || null,
                },
              },
            });
          },
          inputType: "text",
          emptyLabel: "Category",
        },
      ),
      editableTextColumn(
        {
          id: "type",
          label: "Type",
          defaultVisible: true,
          render: (item) => {
            const type = getBoardItemType(item);
            if (!type) return null;

            return (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {formatBoardItemTypeLabel(type)}
              </span>
            );
          },
          sortable: true,
          sortValue: (item) => {
            const type = getBoardItemType(item);
            return formatBoardItemTypeLabel(type);
          },
        },
        {
          getValue: (item) => getBoardItemType(item) ?? "",
          onEdit: async (item, value) => {
            await patchBoardItem.mutateAsync({
              itemId: item.id,
              updates: {
                metadata: {
                  type: value.trim() || null,
                },
              },
            });
          },
          inputType: "text",
          emptyLabel: "Type",
        },
      ),
      {
        id: "topics",
        label: "Topics",
        defaultVisible: true,
        render: (item) => {
          const topics = getBoardCaptureTopics(item);
          if (!topics.length) return null;

          return (
            <div className="flex flex-wrap gap-1.5">
              {topics.map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", BOARD_CAPTURE_TOPICS[topic].color)} />
                  {BOARD_CAPTURE_TOPICS[topic].label}
                </span>
              ))}
            </div>
          );
        },
        sortable: false,
      },
      {
        id: "linear_issue",
        label: "Linear",
        defaultVisible: true,
        render: (item) => {
          const issue = getLinearIssueLink((item.metadata as BoardItemMeta | null) ?? {});
          if (!issue) return null;

          return (
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="h-3 w-3" />
              {issue.label}
            </a>
          );
        },
        sortable: true,
        sortValue: (item) =>
          getLinearIssueLink((item.metadata as BoardItemMeta | null) ?? {})?.label ?? "",
      },
      editableSelectColumn(
        {
          id: "assignee",
          label: "Assignee",
          defaultVisible: true,
          render: (item) =>
            item.assignee ? (
              <AssigneeAvatar
                name={item.assignee.full_name}
                email={item.assignee.email}
              />
            ) : null,
          sortable: true,
          sortValue: (item) => item.assignee?.full_name ?? item.assignee?.email ?? "",
        },
        {
          getValue: (item) => item.assignee_id ?? CLEAR_SELECT_VALUE,
          onEdit: async (item, value) => {
            await patchBoardItem.mutateAsync({
              itemId: item.id,
              updates: {
                assignee_id: value === CLEAR_SELECT_VALUE ? null : value,
              },
            });
          },
          options: assigneeOptions,
          emptyLabel: "Assignee",
        },
      ),
      {
        id: "due_date",
        label: "Due Date",
        defaultVisible: true,
        render: (item) => {
          const meta = (item.metadata as BoardItemMeta | null) ?? {};
          return meta.due_date ? (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(meta.due_date), { addSuffix: true })}
            </span>
          ) : null;
        },
        sortable: true,
        sortValue: (item) => {
          const meta = (item.metadata as BoardItemMeta | null) ?? {};
          return meta.due_date ?? "";
        },
      },
      {
        id: "comment_count",
        label: "Comments",
        defaultVisible: true,
        render: (item) =>
          item.comment_count > 0 ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              {item.comment_count}
            </span>
          ) : null,
        sortable: true,
        sortValue: (item) => item.comment_count,
      },
      {
        id: "created_at",
        label: "Created",
        defaultVisible: true,
        render: (item) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </span>
        ),
        sortable: true,
        sortValue: (item) => item.created_at,
      },
    ],
    [assigneeOptions, items, patchBoardItem],
  );

  // ─── Sort ─────────────────────────────────────────────────────────────────

  const sortedItems = React.useMemo(() => {
    if (!tableState.sortBy) return filtered;
    const col = tableColumns.find((c) => c.id === tableState.sortBy);
    const getSortValue = col?.sortValue;
    if (!getSortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const va = getSortValue(a);
      const vb = getSortValue(b);
      if (va == null && vb == null) return 0;
      if (va == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (vb == null) return tableState.sortDirection === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number")
        return tableState.sortDirection === "asc" ? va - vb : vb - va;
      return tableState.sortDirection === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [filtered, tableColumns, tableState.sortBy, tableState.sortDirection]);

  const hasSearchFilter = Boolean(tableState.searchInput);
  const totalItems = sortedItems.length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <UnifiedTablePage
      header={{ title: "" }}
      toolbar={{
        totalItems,
        filteredItems: totalItems,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search items...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        filters: [],
        activeFilters: tableState.activeFilters,
        onFilterChange: tableState.setActiveFilters,
        onClearFilters: () => tableState.setActiveFilters({}),
        columns: columnConfigs,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items: sortedItems,
        isLoading,
        isFetching: false,
        error: error ?? undefined,
      }}
      table={{
        columns: tableColumns,
        getRowId: (item) => item.id,
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
          tableState.setSearchParams({ sort: sortBy, sort_dir: direction, page: "1" });
          tableState.setPage(1);
        },
      }}
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: (checked) => {
          tableState.setSelectedIds(checked ? sortedItems.map((i) => i.id) : []);
        },
        onSelectRow: (id, checked) => {
          tableState.setSelectedIds((prev) =>
            checked ? [...prev, String(id)] : prev.filter((x) => x !== String(id)),
          );
        },
      }}
      emptyState={{
        title: "No feature requests yet",
        description: "Submit ideas via the feedback button — they'll appear here automatically.",
        filteredDescription: "Try adjusting your search.",
        isFiltered: isFiltered || hasSearchFilter,
      }}
      pagination={{
        page: tableState.page,
        totalPages: Math.max(1, Math.ceil(totalItems / tableState.perPage)),
        perPage: tableState.perPage,
        onPageChange: (nextPage) => {
          tableState.setPage(nextPage);
          tableState.setSearchParams({ page: String(nextPage) });
        },
        onPerPageChange: (nextPerPage) => {
          const parsed = Number(nextPerPage);
          if (!Number.isFinite(parsed) || parsed <= 0) return;
          tableState.setPerPage(parsed);
          tableState.setSearchParams({ per_page: String(parsed), page: "1" });
          tableState.setPage(1);
        },
      }}
    />
  );
}
