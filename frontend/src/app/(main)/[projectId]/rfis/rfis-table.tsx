"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterConfig,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import {
  CellDate,
  CellStatus,
  CellText,
} from "@/components/tables/unified/table-primitives";
import { useRfiPeopleOptions } from "@/components/rfis/rfi-form-fields";
import type { RFI } from "@/types/database-extensions";

/** URL params that drive server-side column filters (Procore parity). */
const RFI_FILTER_KEYS = [
  "rfi_manager",
  "assignee",
  "received_from",
  "ball_in_court",
  "overdue",
] as const;
type RfiFilterKey = (typeof RFI_FILTER_KEYS)[number];

interface RfisTableProps {
  projectId: number;
}

function formatAssignees(assignees: string[] | null | undefined): string {
  if (!assignees || assignees.length === 0) return "—";
  return assignees.join(", ");
}

type ActiveTab = "all" | "open" | "closed";

interface RfiListResponse {
  data: RFI[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    tab_counts: {
      all: number;
      open: number;
      closed: number;
    };
  };
}

const TAB_STATUS_MAP: Record<ActiveTab, string | null> = {
  all: null,
  open: "draft,open,answered",
  closed: "closed,closed-draft",
};

const rfiColumnConfig = [
  { id: "number", label: "#", alwaysVisible: true },
  { id: "subject", label: "Subject", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "assignees", label: "Assignees", defaultVisible: true },
  { id: "due_date", label: "Due Date", defaultVisible: true },
  { id: "ball_in_court", label: "Ball In Court", defaultVisible: true },
  { id: "rfi_manager", label: "RFI Manager", defaultVisible: true },
  {
    id: "responsible_contractor",
    label: "Resp. Contractor",
    defaultVisible: false,
  },
  { id: "received_from", label: "Received From", defaultVisible: false },
  { id: "location", label: "Location", defaultVisible: false },
  { id: "rfi_stage", label: "RFI Stage", defaultVisible: false },
  { id: "schedule_impact", label: "Schedule Impact", defaultVisible: false },
  { id: "cost_impact", label: "Cost Impact", defaultVisible: false },
  { id: "created_at", label: "Created", defaultVisible: false },
];

const rfiDefaultVisibleColumns = rfiColumnConfig
  .filter((column) => column.defaultVisible !== false || column.alwaysVisible)
  .map((column) => column.id);

export function removeRfiFromListResponse(
  current: RfiListResponse,
  rfi: Pick<RFI, "id" | "status">,
  perPage: number,
): RfiListResponse {
  const nextData = current.data.filter((item) => item.id !== rfi.id);
  const nextTotal = Math.max(0, current.meta.total - 1);
  return {
    ...current,
    data: nextData,
    meta: {
      ...current.meta,
      total: nextTotal,
      totalPages: Math.max(1, Math.ceil(nextTotal / perPage)),
      tab_counts: {
        ...current.meta.tab_counts,
        all: Math.max(0, current.meta.tab_counts.all - 1),
        ...(rfi.status && ["draft", "open", "answered"].includes(rfi.status)
          ? { open: Math.max(0, current.meta.tab_counts.open - 1) }
          : {}),
        ...(rfi.status && ["closed", "closed-draft"].includes(rfi.status)
          ? { closed: Math.max(0, current.meta.tab_counts.closed - 1) }
          : {}),
      },
    },
  };
}

async function fetchRfis(
  projectId: number,
  params: {
    page: number;
    perPage: number;
    sort: string | null;
    status: string | null;
    search: string | null;
    filters: Partial<Record<RfiFilterKey, string>>;
  },
): Promise<RfiListResponse> {
  const apiParams = new URLSearchParams();
  apiParams.set("page", String(params.page));
  apiParams.set("limit", String(params.perPage));
  if (params.status) apiParams.set("status", params.status);
  if (params.search) apiParams.set("search", params.search);
  for (const key of RFI_FILTER_KEYS) {
    const value = params.filters[key];
    if (value) apiParams.set(key, value);
  }

  return apiFetch<RfiListResponse>(
    `/api/projects/${projectId}/rfis?${apiParams.toString()}`,
  );
}

export function RfisTable({ projectId }: RfisTableProps) {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParamsRaw = useSearchParams()!;
  const searchParams = searchParamsRaw ?? new URLSearchParams();
  const queryClient = useQueryClient();
  const activeTabParam = searchParams.get("tab");
  const activeTab: ActiveTab =
    activeTabParam === "open" || activeTabParam === "closed"
      ? activeTabParam
      : "all";

  const sort = searchParams.get("sort");
  const status = TAB_STATUS_MAP[activeTab];

  // Person/role filter options come from the project directory (RFI rows store
  // display names, so the filter value matches the stored name).
  const { userOptions, directoryOptions } = useRfiPeopleOptions(projectId);

  const filters = React.useMemo<FilterConfig[]>(() => {
    const toOpts = (opts: { value: string; label: string }[]) =>
      opts.map((o) => ({ value: o.value, label: o.label }));
    return [
      { id: "rfi_manager", label: "RFI Manager", type: "select", options: toOpts(userOptions) },
      { id: "assignee", label: "Assignee", type: "select", options: toOpts(userOptions) },
      { id: "received_from", label: "Received From", type: "select", options: toOpts(directoryOptions) },
      { id: "ball_in_court", label: "Ball In Court", type: "select", options: toOpts(directoryOptions) },
      { id: "overdue", label: "Overdue only", type: "boolean" },
    ];
  }, [userOptions, directoryOptions]);

  const activeFilters = React.useMemo<Record<string, FilterValue>>(() => {
    const result: Record<string, FilterValue> = {};
    for (const key of RFI_FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) result[key] = key === "overdue" ? value === "true" : value;
    }
    return result;
  }, [searchParams]);

  const filterValues = React.useMemo(() => {
    const result: Partial<Record<RfiFilterKey, string>> = {};
    for (const key of RFI_FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) result[key] = value;
    }
    return result;
  }, [searchParams]);

  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  const tableState = useUnifiedTableState({
    entityKey: `rfis-${projectId}`,
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "list"],
      page: Number(searchParams.get("page") ?? "1"),
      perPage: Number(searchParams.get("perPage") ?? "25"),
      search: searchParams.get("search") ?? "",
      sortBy: "number",
      sortDirection: "desc",
      visibleColumns: rfiDefaultVisibleColumns,
      filters: {},
    },
  });

  const page = tableState.page;
  const perPage = tableState.perPage;
  const search = tableState.debouncedSearch.trim() || null;

  const handleFilterChange = React.useCallback(
    (next: Record<string, FilterValue>) => {
      const updates: Record<string, string | null> = { page: "1" };
      for (const key of RFI_FILTER_KEYS) {
        const value = next[key];
        updates[key] =
          value === undefined || value === false || value === ""
            ? null
            : String(value);
      }
      tableState.setPage(1);
      tableState.setSearchParams(updates);
    },
    [tableState],
  );

  const queryParams = React.useMemo(
    () => ({ page, perPage, sort, status, search, filters: filterValues }),
    [page, perPage, sort, status, search, filterValues],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["rfis", projectId, queryParams],
    queryFn: () => fetchRfis(projectId, queryParams),
    placeholderData: (prev) => prev,
  });

  const rfis = data?.data ?? [];
  const pageCount = data?.meta.totalPages ?? 1;
  const columns = React.useMemo<TableColumn<RFI>[]>(
    () => [
      {
        id: "number",
        label: "#",
        alwaysVisible: true,
        sortable: true,
        sortValue: (rfi) => rfi.number ?? 0,
        render: (rfi) => (
          <span className="font-medium tabular-nums">{rfi.number ?? "-"}</span>
        ),
        csvValue: (rfi) => String(rfi.number ?? ""),
        width: 80,
      },
      {
        id: "subject",
        label: "Subject",
        defaultVisible: true,
        sortable: true,
        sortValue: (rfi) => rfi.subject ?? "",
        render: (rfi) => (
          <Button
            type="button"
            variant="link"
            className="h-auto justify-start p-0 text-left font-normal"
            onClick={(event) => {
              event.stopPropagation();
              router.push(`/${projectId}/rfis/${rfi.id}`);
            }}
          >
            <CellText value={rfi.subject ?? "Untitled RFI"} />
          </Button>
        ),
        csvValue: (rfi) => rfi.subject ?? "",
        width: 320,
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        sortable: true,
        sortValue: (rfi) => rfi.status ?? "",
        render: (rfi) => <CellStatus value={rfi.status ?? ""} />,
        csvValue: (rfi) => rfi.status ?? "",
        width: 130,
      },
      {
        id: "assignees",
        label: "Assignees",
        defaultVisible: true,
        sortable: true,
        sortValue: (rfi) => formatAssignees(rfi.assignees as string[] | null),
        render: (rfi) => (
          <CellText value={formatAssignees(rfi.assignees as string[] | null)} />
        ),
        csvValue: (rfi) => formatAssignees(rfi.assignees as string[] | null),
        width: 180,
      },
      {
        id: "due_date",
        label: "Due Date",
        defaultVisible: true,
        sortable: true,
        sortValue: (rfi) =>
          rfi.due_date ? new Date(rfi.due_date).getTime() : 0,
        render: (rfi) => <CellDate value={rfi.due_date} />,
        csvValue: (rfi) => rfi.due_date ?? "",
        width: 140,
      },
      {
        id: "ball_in_court",
        label: "Ball In Court",
        defaultVisible: true,
        sortable: true,
        sortValue: (rfi) => rfi.ball_in_court ?? "",
        render: (rfi) => <CellText value={rfi.ball_in_court} />,
        csvValue: (rfi) => rfi.ball_in_court ?? "",
        width: 160,
      },
      {
        id: "rfi_manager",
        label: "RFI Manager",
        defaultVisible: true,
        sortable: true,
        sortValue: (rfi) => rfi.rfi_manager ?? "",
        render: (rfi) => <CellText value={rfi.rfi_manager} />,
        csvValue: (rfi) => rfi.rfi_manager ?? "",
        width: 160,
      },
      {
        id: "responsible_contractor",
        label: "Resp. Contractor",
        defaultVisible: false,
        sortable: true,
        sortValue: (rfi) => rfi.responsible_contractor ?? "",
        render: (rfi) => <CellText value={rfi.responsible_contractor} />,
        csvValue: (rfi) => rfi.responsible_contractor ?? "",
        width: 180,
      },
      {
        id: "received_from",
        label: "Received From",
        defaultVisible: false,
        sortable: true,
        sortValue: (rfi) => rfi.received_from ?? "",
        render: (rfi) => <CellText value={rfi.received_from} />,
        csvValue: (rfi) => rfi.received_from ?? "",
        width: 160,
      },
      {
        id: "location",
        label: "Location",
        defaultVisible: false,
        sortable: true,
        sortValue: (rfi) => rfi.location ?? "",
        render: (rfi) => <CellText value={rfi.location} />,
        csvValue: (rfi) => rfi.location ?? "",
        width: 150,
      },
      {
        id: "rfi_stage",
        label: "RFI Stage",
        defaultVisible: false,
        sortable: true,
        sortValue: (rfi) => rfi.rfi_stage ?? "",
        render: (rfi) => <CellText value={rfi.rfi_stage} />,
        csvValue: (rfi) => rfi.rfi_stage ?? "",
        width: 150,
      },
      {
        id: "schedule_impact",
        label: "Schedule Impact",
        defaultVisible: false,
        sortable: true,
        sortValue: (rfi) => rfi.schedule_impact ?? "",
        render: (rfi) => <CellText value={rfi.schedule_impact} />,
        csvValue: (rfi) => rfi.schedule_impact ?? "",
        width: 170,
      },
      {
        id: "cost_impact",
        label: "Cost Impact",
        defaultVisible: false,
        sortable: true,
        sortValue: (rfi) => rfi.cost_impact ?? "",
        render: (rfi) => <CellText value={rfi.cost_impact} />,
        csvValue: (rfi) => rfi.cost_impact ?? "",
        width: 150,
      },
      {
        id: "created_at",
        label: "Created",
        defaultVisible: false,
        sortable: true,
        sortValue: (rfi) =>
          rfi.created_at ? new Date(rfi.created_at).getTime() : 0,
        render: (rfi) => <CellDate value={rfi.created_at} />,
        csvValue: (rfi) => rfi.created_at ?? "",
        width: 140,
      },
    ],
    [projectId, router],
  );

  const handleDelete = React.useCallback(
    async (rfi: RFI) => {
      await apiFetch(`/api/projects/${projectId}/rfis/${rfi.id}`, {
        method: "DELETE",
      });

      // Remove the confirmed-deleted row from the active page immediately. The
      // list query uses placeholderData while it refetches, so invalidation
      // alone can leave the deleted RFI visible until the network round trip
      // completes.
      queryClient.setQueryData<RfiListResponse>(
        ["rfis", projectId, queryParams],
        (current) => {
          if (!current) return current;
          return removeRfiFromListResponse(current, rfi, perPage);
        },
      );
      const nextTotalPages = Math.max(
        1,
        Math.ceil(Math.max(0, (data?.meta.total ?? 0) - 1) / perPage),
      );
      if (page > nextTotalPages) {
        tableState.setPage(nextTotalPages);
        tableState.setSearchParams({ page: String(nextTotalPages) });
      }
      toast.success("RFI deleted");
      await queryClient.invalidateQueries({
        queryKey: ["rfis", projectId],
        refetchType: "all",
      });
    },
    [data?.meta.total, page, perPage, projectId, queryClient, queryParams, tableState],
  );

  React.useEffect(() => {
    if (data && page < pageCount) {
      void queryClient.prefetchQuery({
        queryKey: ["rfis", projectId, { ...queryParams, page: page + 1 }],
        queryFn: () => fetchRfis(projectId, { ...queryParams, page: page + 1 }),
      });
    }
  }, [data, page, pageCount, projectId, queryParams, queryClient]);

  const buildTabHref = React.useCallback(
    (tab: ActiveTab) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", tab);
      next.delete("status");
      next.set("page", "1");
      const query = next.toString();
      return `/${projectId}/rfis${query ? `?${query}` : ""}`;
    },
    [projectId, searchParams],
  );

  const tabs = [
    {
      label: "All",
      href: buildTabHref("all"),
      isActive: activeTab === "all",
      testId: "rfis-tab-all",
    },
    {
      label: "Open",
      href: buildTabHref("open"),
      isActive: activeTab === "open",
      testId: "rfis-tab-open",
    },
    {
      label: "Closed",
      href: buildTabHref("closed"),
      isActive: activeTab === "closed",
      testId: "rfis-tab-closed",
    },
  ];

  return (
    <UnifiedTablePage
      header={{
        title: "RFIs",
        description: "Requests for Information",
        actions: (
          <Button
            size="sm"
            onClick={() => router.push(`/${projectId}/rfis/new`)}
            data-testid="rfis-create-button"
          >
            <Plus className="h-4 w-4" />
            Create RFI
          </Button>
        ),
      }}
      tabs={tabs}
      toolbar={{
        totalItems: data?.meta.total ?? 0,
        filteredItems: data?.meta.total ?? rfis.length,
        searchValue: tableState.searchInput,
        onSearchChange: (value) => {
          tableState.setSearchInput(value);
          tableState.setPage(1);
          tableState.setSearchParams({ search: value || null, page: "1" });
        },
        searchPlaceholder:
          activeTab === "all"
            ? "Search RFIs..."
            : `Search ${activeTab} RFIs...`,
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        enabledViews: ["table", "list"],
        columns: rfiColumnConfig,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        onExport: () => {
          window.open(
            `/api/projects/${projectId}/rfis/pdf`,
            "_blank",
            "noopener,noreferrer",
          );
        },
        filters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange({}),
      }}
      data={{ items: rfis, isLoading, isFetching: false, error: null }}
      table={{
        columns,
        getRowId: (rfi) => String(rfi.id),
        onRowClick: (rfi) => router.push(`/${projectId}/rfis/${rfi.id}`),
        onEdit: (rfi) => router.push(`/${projectId}/rfis/${rfi.id}?mode=edit`),
        onDelete: handleDelete,
        density: "compact",
        stickyHeader: true,
      }}
      pagination={{
        page,
        totalPages: pageCount,
        perPage,
        onPageChange: (nextPage) => {
          tableState.setPage(nextPage);
          tableState.setSearchParams({ page: String(nextPage) });
        },
        onPerPageChange: (nextPerPage) => {
          const parsed = Number(nextPerPage);
          if (!Number.isFinite(parsed) || parsed <= 0) return;
          tableState.setPerPage(parsed);
          tableState.setPage(1);
          tableState.setSearchParams({
            perPage: String(parsed),
            page: "1",
          });
        },
      }}
      emptyState={{
        title: "No RFIs found",
        description:
          "Create your first RFI to start tracking project questions.",
        filteredDescription: "No RFIs match your current search or filters.",
        isFiltered:
          Boolean(tableState.searchInput) ||
          activeTab !== "all" ||
          hasActiveFilters,
        action: (
          <Button
            size="sm"
            onClick={() => router.push(`/${projectId}/rfis/new`)}
          >
            <Plus className="h-4 w-4" />
            Create RFI
          </Button>
        ),
      }}
      features={{
        enableViews: true,
        enableColumnToggle: true,
        enableExport: true,
        enablePagination: true,
        enableBulkDelete: true,
      }}
      layout={{ fullBleedTable: true }}
    />
  );
}
