"use client";

import * as React from "react";
import { useMemo } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ArrowRight, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type ColumnConfig,
  type FilterConfig,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { createClient } from "@/lib/supabase/client";

// ── Types ───────────────────────────────────────────────────────────────────

export interface EnrichedArticle {
  id: number;
  url: string;
  slug: string | null;
  title: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  breadcrumb: string[] | null;
  tags: string[] | null;
  word_count: number | null;
  last_crawled_at: string | null;
  source_updated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  chunk_count: number;
  embedded_count: number;
}

interface SupportArticlesClientProps {
  articles: EnrichedArticle[];
  errorMessage: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// ── Column metadata ─────────────────────────────────────────────────────────

const articleColumns: ColumnConfig[] = [
  { id: "title", label: "Title", alwaysVisible: true },
  { id: "description", label: "Description", defaultVisible: true },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "subcategory", label: "Subcategory", defaultVisible: false },
  { id: "word_count", label: "Words", defaultVisible: true },
  { id: "chunk_count", label: "Chunks", defaultVisible: true },
  { id: "embedded", label: "Embedded", defaultVisible: true },
  { id: "last_crawled_at", label: "Last Crawled", defaultVisible: true },
  { id: "url", label: "Link", defaultVisible: true },
];

const defaultVisibleColumns = articleColumns
  .filter((c) => c.defaultVisible !== false)
  .map((c) => c.id);

// ── Table columns ───────────────────────────────────────────────────────────

function buildTableColumns(): TableColumn<EnrichedArticle>[] {
  return [
    {
      ...articleColumns[0],
      render: (item) => (
        <span className="font-medium text-sm">{item.title}</span>
      ),
      csvValue: (item) => item.title,
      sortValue: (item) => item.title,
      sortable: true,
    },
    {
      ...articleColumns[1],
      render: (item) => (
        <span className="truncate text-sm text-muted-foreground">
          {item.description ?? "—"}
        </span>
      ),
      csvValue: (item) => item.description ?? "",
      sortValue: (item) => item.description ?? "",
      sortable: true,
      width: 300,
    },
    {
      ...articleColumns[2],
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.category ?? "—"}
        </span>
      ),
      csvValue: (item) => item.category ?? "",
      sortValue: (item) => item.category ?? "",
      sortable: true,
    },
    {
      ...articleColumns[3],
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.subcategory ?? "—"}
        </span>
      ),
      csvValue: (item) => item.subcategory ?? "",
      sortValue: (item) => item.subcategory ?? "",
      sortable: true,
    },
    {
      ...articleColumns[4],
      render: (item) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {item.word_count?.toLocaleString() ?? "—"}
        </span>
      ),
      csvValue: (item) => String(item.word_count ?? 0),
      sortValue: (item) => item.word_count ?? 0,
      sortable: true,
    },
    {
      ...articleColumns[5],
      render: (item) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {item.chunk_count}
        </span>
      ),
      csvValue: (item) => String(item.chunk_count),
      sortValue: (item) => item.chunk_count,
      sortable: true,
    },
    {
      ...articleColumns[6],
      render: (item) => {
        const pct =
          item.chunk_count > 0
            ? Math.round((item.embedded_count / item.chunk_count) * 100)
            : 0;
        return (
          <StatusBadge
            status={`${pct}%`}
            variant={pct === 100 ? "success" : pct > 0 ? "warning" : "neutral"}
          />
        );
      },
      csvValue: (item) => {
        const pct =
          item.chunk_count > 0
            ? Math.round((item.embedded_count / item.chunk_count) * 100)
            : 0;
        return `${pct}%`;
      },
      sortValue: (item) =>
        item.chunk_count > 0 ? item.embedded_count / item.chunk_count : 0,
      sortable: true,
    },
    {
      ...articleColumns[7],
      render: (item) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(item.last_crawled_at)}
        </span>
      ),
      csvValue: (item) => item.last_crawled_at ?? "",
      sortValue: (item) =>
        item.last_crawled_at ? new Date(item.last_crawled_at).getTime() : 0,
      sortable: true,
    },
    {
      ...articleColumns[8],
      render: (item) => (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          title={`Open ${item.title} on Procore`}
          className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      ),
      csvValue: (item) => item.url,
      sortable: false,
    },
  ];
}

// ── Row actions ─────────────────────────────────────────────────────────────

function renderRowActions(
  item: EnrichedArticle,
  onDelete: (item: EnrichedArticle) => void,
) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={item.url} target="_blank" rel="noreferrer">
            <ArrowRight className="mr-2 h-4 w-4" />
            View on Procore
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => onDelete(item)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Filter / sort helpers ───────────────────────────────────────────────────

const EMPTY_FILTERS: Record<string, FilterValue> = {};

function applyFilters(
  articles: EnrichedArticle[],
  search: string,
  filters: Record<string, FilterValue>,
): EnrichedArticle[] {
  let filtered = articles;

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q) ||
        a.url.toLowerCase().includes(q) ||
        (a.category ?? "").toLowerCase().includes(q) ||
        (a.subcategory ?? "").toLowerCase().includes(q) ||
        (a.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }

  if (filters.category) {
    const val = String(filters.category);
    filtered = filtered.filter((a) => a.category === val);
  }

  if (filters.subcategory) {
    const val = String(filters.subcategory);
    filtered = filtered.filter((a) => a.subcategory === val);
  }

  if (filters.embedded) {
    const val = String(filters.embedded);
    filtered = filtered.filter((a) => {
      const pct =
        a.chunk_count > 0
          ? Math.round((a.embedded_count / a.chunk_count) * 100)
          : 0;
      if (val === "full") return pct === 100;
      if (val === "partial") return pct > 0 && pct < 100;
      if (val === "none") return pct === 0;
      return true;
    });
  }

  return filtered;
}

function sortArticles(
  articles: EnrichedArticle[],
  sortBy: string,
  direction: "asc" | "desc",
): EnrichedArticle[] {
  const sorted = [...articles].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";

    switch (sortBy) {
      case "title":
        aVal = a.title;
        bVal = b.title;
        break;
      case "category":
        aVal = a.category ?? "";
        bVal = b.category ?? "";
        break;
      case "subcategory":
        aVal = a.subcategory ?? "";
        bVal = b.subcategory ?? "";
        break;
      case "word_count":
        aVal = a.word_count ?? 0;
        bVal = b.word_count ?? 0;
        break;
      case "chunk_count":
        aVal = a.chunk_count;
        bVal = b.chunk_count;
        break;
      case "embedded":
        aVal = a.chunk_count > 0 ? a.embedded_count / a.chunk_count : 0;
        bVal = b.chunk_count > 0 ? b.embedded_count / b.chunk_count : 0;
        break;
      case "last_crawled_at":
        aVal = a.last_crawled_at ? new Date(a.last_crawled_at).getTime() : 0;
        bVal = b.last_crawled_at ? new Date(b.last_crawled_at).getTime() : 0;
        break;
      default:
        return 0;
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal);
    }
    return (aVal as number) - (bVal as number);
  });

  return direction === "desc" ? sorted.reverse() : sorted;
}

// ── Page component ──────────────────────────────────────────────────────────

export function SupportArticlesClient({
  articles: initialArticles,
  errorMessage,
}: SupportArticlesClientProps) {
  const searchParams = useSearchParams()!;
  const pathname = usePathname()!;
  const router = useRouter();

  // Local state so deletes reflect immediately without server round-trip
  const [articles, setArticles] = React.useState(initialArticles);

  // Derive filter options from data
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const a of articles) {
      if (a.category) cats.add(a.category);
    }
    return [...cats].sort();
  }, [articles]);

  const subcategories = useMemo(() => {
    const subs = new Set<string>();
    for (const a of articles) {
      if (a.subcategory) subs.add(a.subcategory);
    }
    return [...subs].sort();
  }, [articles]);

  const articleFilters: FilterConfig[] = useMemo(
    () => [
      {
        id: "category",
        label: "Category",
        type: "select",
        options: categories.map((c) => ({ value: c, label: c })),
      },
      {
        id: "subcategory",
        label: "Subcategory",
        type: "select",
        options: subcategories.map((s) => ({ value: s, label: s })),
      },
      {
        id: "embedded",
        label: "Embedding Status",
        type: "select",
        options: [
          { value: "full", label: "Fully embedded (100%)" },
          { value: "partial", label: "Partially embedded" },
          { value: "none", label: "Not embedded" },
        ],
      },
    ],
    [categories, subcategories],
  );

  const tableState = useUnifiedTableState({
    entityKey: "support-articles",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "title",
      sortDirection: "asc",
      visibleColumns: defaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  const tableColumns = useMemo(() => buildTableColumns(), []);

  const activeFilters = useMemo(() => {
    const f: Record<string, FilterValue> = {};
    if (tableState.activeFilters?.category)
      f.category = tableState.activeFilters.category;
    if (tableState.activeFilters?.subcategory)
      f.subcategory = tableState.activeFilters.subcategory;
    if (tableState.activeFilters?.embedded)
      f.embedded = tableState.activeFilters.embedded;
    return f;
  }, [tableState.activeFilters]);

  const isFiltered =
    !!tableState.debouncedSearch || Object.keys(activeFilters).length > 0;

  const filteredArticles = useMemo(
    () => applyFilters(articles, tableState.debouncedSearch, activeFilters),
    [articles, tableState.debouncedSearch, activeFilters],
  );

  const sortedArticles = useMemo(
    () =>
      sortArticles(
        filteredArticles,
        tableState.sortBy ?? "title",
        tableState.sortDirection,
      ),
    [filteredArticles, tableState.sortBy, tableState.sortDirection],
  );

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(sortedArticles.length / tableState.perPage),
  );
  const paginatedArticles = useMemo(() => {
    const start = (tableState.page - 1) * tableState.perPage;
    return sortedArticles.slice(start, start + tableState.perPage);
  }, [sortedArticles, tableState.page, tableState.perPage]);

  const handleFilterChange = (filters: Record<string, FilterValue>) => {
    tableState.setActiveFilters(filters);
    tableState.setPage(1);
  };

  // ── Selection handlers ──────────────────────────────────────────────────

  const handleSelectAll = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        const allIds = paginatedArticles.map((a) => String(a.id));
        tableState.setSelectedIds(allIds);
      } else {
        tableState.setSelectedIds([]);
      }
    },
    [paginatedArticles, tableState],
  );

  const handleSelectRow = React.useCallback(
    (id: string, checked: boolean) => {
      if (checked) {
        tableState.setSelectedIds([...tableState.selectedIds, id]);
      } else {
        tableState.setSelectedIds(
          tableState.selectedIds.filter((sid) => sid !== id),
        );
      }
    },
    [tableState],
  );

  // ── Delete handler ────────────────────────────────────────────────────

  const handleDelete = React.useCallback(
    async (item: EnrichedArticle) => {
      const supabase = createClient();

      // Delete chunks first (cascade should handle it, but be explicit)
      await supabase
        .from("support_article_chunks")
        .delete()
        .eq("article_id", item.id);

      const { error } = await supabase
        .from("support_articles")
        .delete()
        .eq("id", item.id);

      if (error) {
        toast.error("Failed to delete article", {
          description: error.message,
        });
        return;
      }

      // Remove from local state
      setArticles((prev) => prev.filter((a) => a.id !== item.id));
      tableState.setSelectedIds(
        tableState.selectedIds.filter((sid) => sid !== String(item.id)),
      );
      toast.success(`Deleted "${item.title}"`);
    },
    [tableState],
  );

  // ── Bulk delete ───────────────────────────────────────────────────────

  const handleBulkDelete = React.useCallback(async () => {
    const ids = tableState.selectedIds.map(Number);
    const supabase = createClient();

    // Delete chunks first
    await supabase
      .from("support_article_chunks")
      .delete()
      .in("article_id", ids);

    const { error } = await supabase
      .from("support_articles")
      .delete()
      .in("id", ids);

    if (error) {
      toast.error("Failed to delete articles", {
        description: error.message,
      });
      return;
    }

    const idSet = new Set(ids);
    setArticles((prev) => prev.filter((a) => !idSet.has(a.id)));
    tableState.setSelectedIds([]);
    toast.success(`Deleted ${ids.length} article${ids.length === 1 ? "" : "s"}`);
  }, [tableState]);

  return (
    <UnifiedTablePage<EnrichedArticle>
      header={{
        title: "Support Articles",
        description: `${articles.length.toLocaleString()} Procore documentation pages indexed for RAG`,
      }}
      layout={{ fullBleedTable: false }}
      toolbar={{
        totalItems: articles.length,
        filteredItems: filteredArticles.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search articles, categories, tags...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        filters: articleFilters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: articleColumns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        onBulkDelete: handleBulkDelete,
      }}
      data={{
        items: paginatedArticles,
        isLoading: false,
        isFetching: false,
        error: errorMessage ? new Error(errorMessage) : null,
      }}
      table={{
        columns: tableColumns,
        getRowId: (item) => String(item.id),
        onRowClick: (item) => router.push(`/support-articles/${item.id}`),
        rowActions: (item) => renderRowActions(item, handleDelete),
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
          tableState.setPage(1);
        },
      }}
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: handleSelectAll,
        onSelectRow: handleSelectRow,
      }}
      emptyState={{
        title: "No support articles",
        description:
          "No Procore documentation has been crawled yet. Run the crawler script to populate this table.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
      }}
      pagination={{
        page: tableState.page,
        totalPages,
        perPage: tableState.perPage,
        onPageChange: (p) => {
          tableState.setPage(p);
          tableState.setSearchParams({ page: String(p) });
        },
        onPerPageChange: (pp) => {
          tableState.setPerPage(Number(pp));
          tableState.setPage(1);
        },
      }}
    />
  );
}
