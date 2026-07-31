"use client";

import { useMemo } from "react";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type ColumnConfig,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { StatusBadge } from "@/components/ds/status-badge";
import { apiFetch } from "@/lib/api-client";
import {
  filterRoutesByTag,
  MEGANS_DASHBOARD_TAG_SLUG,
  type PageTagsResponse,
} from "@/lib/page-tags";
import type { InventoryRoute } from "@/app/(admin)/site-map/site-map-client";

/**
 * Project id injected into `[projectId]` routes so links resolve to a real
 * project instead of the literal `/[projectId]/...` path. 876 = Exol Morrisville
 * (matches the site map's preview project).
 */
const PREVIEW_PROJECT_ID = "876";

function isDynamicRoute(route: string): boolean {
  return route.includes("[");
}

function routeHref(route: string): string | null {
  const resolved = route.replace(/\[projectId\]/g, PREVIEW_PROJECT_ID);
  return isDynamicRoute(resolved) ? null : resolved;
}

const columns: ColumnConfig[] = [
  { id: "page", label: "Page", alwaysVisible: true },
  { id: "route", label: "Route", defaultVisible: true },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "type", label: "Type", defaultVisible: true },
  { id: "layout", label: "Layout", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "open", label: "", alwaysVisible: true },
];

const defaultVisibleColumns = columns
  .filter((column) => column.defaultVisible !== false)
  .map((column) => column.id);

const CATEGORY_OPTIONS = [
  "Project Management",
  "Financials",
  "Accounting",
  "Documents",
  "Team / Directory",
  "Admin",
  "AI Intelligence",
  "RAG",
  "Emails",
  "Design",
  "Testing / QA",
  "Development",
  "Procore",
  "System",
];

async function fetchPageTags(): Promise<PageTagsResponse> {
  return apiFetch<PageTagsResponse>("/api/admin/page-tags");
}

function buildColumns(): TableColumn<InventoryRoute>[] {
  return [
    {
      id: "page",
      label: "Page",
      alwaysVisible: true,
      sortable: true,
      sortValue: (item) => item.page,
      csvValue: (item) => item.page,
      render: (item) => (
        <span className="block min-w-0 truncate text-sm font-medium text-foreground">
          {item.page}
        </span>
      ),
    },
    {
      id: "route",
      label: "Route",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.route,
      csvValue: (item) => item.route,
      width: 320,
      render: (item) => {
        const href = routeHref(item.route);
        if (!href) {
          return (
            <code className="block max-w-80 truncate text-xs text-muted-foreground">
              {item.route}
            </code>
          );
        }
        return (
          <Link
            href={href}
            target="_blank"
            rel="noreferrer"
            className="block max-w-80 truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <code>{item.route}</code>
          </Link>
        );
      },
    },
    {
      id: "category",
      label: "Category",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.category,
      csvValue: (item) => item.category,
      render: (item) => (
        <span className="text-xs text-muted-foreground">{item.category}</span>
      ),
    },
    {
      id: "type",
      label: "Type",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.type,
      csvValue: (item) => item.type,
      render: (item) => (
        <span className="text-xs text-muted-foreground">{item.type}</span>
      ),
    },
    {
      id: "layout",
      label: "Layout",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.layout,
      csvValue: (item) => item.layout,
      render: (item) => (
        <span className="text-xs text-muted-foreground">{item.layout}</span>
      ),
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.status,
      csvValue: (item) => item.status,
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      id: "open",
      label: "",
      alwaysVisible: true,
      render: (item) => {
        const href = routeHref(item.route);
        if (!href) return null;
        return (
          <Link
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-muted-foreground hover:text-foreground"
            aria-label={`Open ${item.page}`}
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        );
      },
    },
  ];
}

export default function TaggedDashboardClient({
  routes,
  tagSlug,
  dashboardTitle,
}: {
  routes: InventoryRoute[];
  tagSlug: string;
  dashboardTitle: string;
}) {
  const searchParams = useSearchParams()!;
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const pageTagsQuery = useQuery({
    queryKey: ["page-tags"],
    queryFn: fetchPageTags,
  });

  const tableState = useUnifiedTableState({
    entityKey: tagSlug,
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "page",
      sortDirection: "asc",
      visibleColumns: defaultVisibleColumns,
      filters: {},
    },
  });

  // Routes that carry the dashboard's configured tag.
  const taggedRoutes = useMemo(() => {
    return filterRoutesByTag(
      routes,
      pageTagsQuery.data?.assignments ?? [],
      tagSlug,
    );
  }, [pageTagsQuery.data?.assignments, routes, tagSlug]);

  const activeFilters = useMemo<Record<string, FilterValue>>(() => {
    const next: Record<string, FilterValue> = {};
    if (tableState.activeFilters?.category)
      next.category = tableState.activeFilters.category;
    return next;
  }, [tableState.activeFilters]);

  const filteredRoutes = useMemo(() => {
    const query = (tableState.debouncedSearch ?? "").toLowerCase();
    return taggedRoutes.filter((route) => {
      if (activeFilters.category && route.category !== activeFilters.category)
        return false;
      if (!query) return true;
      return (
        route.page.toLowerCase().includes(query) ||
        route.route.toLowerCase().includes(query) ||
        route.category.toLowerCase().includes(query) ||
        route.type.toLowerCase().includes(query) ||
        route.layout.toLowerCase().includes(query)
      );
    });
  }, [activeFilters.category, taggedRoutes, tableState.debouncedSearch]);

  const sortedRoutes = useMemo(() => {
    const sortBy = tableState.sortBy ?? "page";
    const direction = tableState.sortDirection;
    const sorted = [...filteredRoutes].sort((left, right) => {
      const leftValue = String(left[sortBy as keyof InventoryRoute] ?? "");
      const rightValue = String(right[sortBy as keyof InventoryRoute] ?? "");
      return leftValue.localeCompare(rightValue);
    });
    return direction === "desc" ? sorted.reverse() : sorted;
  }, [filteredRoutes, tableState.sortBy, tableState.sortDirection]);

  const itemsForTable = useMemo(() => {
    const start = (tableState.page - 1) * tableState.perPage;
    return sortedRoutes.slice(start, start + tableState.perPage);
  }, [sortedRoutes, tableState.page, tableState.perPage]);

  const tableColumns = useMemo(() => buildColumns(), []);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedRoutes.length / tableState.perPage),
  );
  const isFiltered =
    Boolean(tableState.debouncedSearch) ||
    Object.keys(activeFilters).length > 0;

  return (
    <UnifiedTablePage<InventoryRoute>
      header={{
        title: dashboardTitle,
        description: `${filteredRoutes.length} page${
          filteredRoutes.length === 1 ? "" : "s"
        } tagged for this dashboard`,
        actions: (
          <Link
            href="/site-map"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Manage tags on the site map
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ),
      }}
      toolbar={{
        totalItems: taggedRoutes.length,
        filteredItems: filteredRoutes.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search page, route, category...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        filters: [
          {
            id: "category",
            label: "Category",
            type: "select",
            options: CATEGORY_OPTIONS.map((category) => ({
              value: category,
              label: category,
            })),
          },
        ],
        activeFilters,
        onFilterChange: (nextFilters) => {
          tableState.setActiveFilters(nextFilters);
          tableState.setPage(1);
        },
        onClearFilters: () => tableState.setActiveFilters({}),
        columns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items: itemsForTable,
        isLoading: pageTagsQuery.isLoading,
        isFetching: pageTagsQuery.isFetching,
        error:
          pageTagsQuery.error instanceof Error ? pageTagsQuery.error : null,
      }}
      features={{ enableRowSelection: false }}
      table={{
        columns: tableColumns,
        getRowId: (item) => item.route,
        density: "compact",
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
      emptyState={{
        title: "No pages tagged yet",
        description: `Open the site map, add the “${dashboardTitle}” tag to any page, and it will appear here.`,
        filteredDescription: "No tagged pages match your search or filters.",
        isFiltered,
        action: (
          <Link
            href="/site-map"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Go to the site map
            <ArrowRight className="h-4 w-4" />
          </Link>
        ),
      }}
      pagination={{
        page: tableState.page,
        totalPages,
        perPage: tableState.perPage,
        onPageChange: (page) => {
          tableState.setPage(page);
          tableState.setSearchParams({ page: String(page) });
        },
        onPerPageChange: (perPage) => {
          tableState.setPerPage(Number(perPage));
          tableState.setPage(1);
        },
      }}
    />
  );
}
