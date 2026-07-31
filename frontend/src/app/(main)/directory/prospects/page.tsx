"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { getDirectoryTabs } from "@/config/directory-tabs";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import type { ColumnConfig, FilterConfig, TableColumn } from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ds";
import { AddProspectDialog } from "@/components/domain/crm/add-prospect-dialog";

// Prospects are companies with lifecycle_stage != 'active' (shared-identity
// CRM, 2026-07-23). Row click opens the same company detail page verified
// companies use — converting a prospect never moves it anywhere.

interface ProspectListItem {
  id: string;
  name: string;
  lifecycle_stage: string;
  type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  state: string | null;
  created_at: string | null;
  open_deal_count: number;
  pipeline_value: number;
  owner_name: string | null;
  last_activity_at: string | null;
  last_activity_type: string | null;
  next_follow_up_at: string | null;
}

interface ProspectsResponse {
  data: ProspectListItem[];
}

type ProspectFilterState = Record<string, FilterValue>;

const EMPTY_FILTERS: ProspectFilterState = {
  lifecycle_stage: undefined,
  owner: undefined,
};

const prospectColumns: ColumnConfig[] = [
  { id: "name", label: "Company", alwaysVisible: true },
  { id: "lifecycle_stage", label: "Stage", defaultVisible: true },
  { id: "contact_name", label: "Contact", defaultVisible: true },
  { id: "open_deal_count", label: "Open Deals", defaultVisible: true },
  { id: "pipeline_value", label: "Pipeline", defaultVisible: true },
  { id: "owner_name", label: "Owner", defaultVisible: true },
  { id: "last_activity_at", label: "Last Touch", defaultVisible: true },
  { id: "next_follow_up_at", label: "Next Follow-Up", defaultVisible: true },
  { id: "contact_email", label: "Email", defaultVisible: false },
  { id: "location", label: "Location", defaultVisible: false },
  { id: "created_at", label: "Created", defaultVisible: false },
];

const prospectDefaultVisibleColumns = prospectColumns
  .filter((col) => col.defaultVisible !== false || col.alwaysVisible)
  .map((col) => col.id);

function formatCurrency(value: number): string {
  if (!value) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  follow_up: "Follow-up",
};

function daysAgo(value: string | null): string {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function isOverdue(value: string | null): boolean {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function buildProspectTableColumns(): TableColumn<ProspectListItem>[] {
  return [
    {
      ...prospectColumns[0],
      render: (item) => <span className="font-medium">{item.name}</span>,
      sortable: true,
      sortValue: (item) => item.name,
      csvValue: (item) => item.name,
    },
    {
      ...prospectColumns[1],
      render: (item) => <StatusBadge status={item.lifecycle_stage} />,
      sortable: true,
      sortValue: (item) => item.lifecycle_stage,
      csvValue: (item) => item.lifecycle_stage,
    },
    {
      ...prospectColumns[2],
      render: (item) => <span>{item.contact_name}</span>,
      sortable: true,
      sortValue: (item) => item.contact_name || "",
      csvValue: (item) => item.contact_name ?? "",
    },
    {
      ...prospectColumns[3],
      render: (item) => (
        <span className="tabular-nums">{item.open_deal_count || ""}</span>
      ),
      sortable: true,
      sortValue: (item) => item.open_deal_count,
      csvValue: (item) => String(item.open_deal_count),
    },
    {
      ...prospectColumns[4],
      render: (item) => (
        <span className="tabular-nums">{formatCurrency(item.pipeline_value)}</span>
      ),
      sortable: true,
      sortValue: (item) => item.pipeline_value,
      csvValue: (item) => String(item.pipeline_value),
    },
    {
      ...prospectColumns[5],
      render: (item) => <span>{item.owner_name}</span>,
      sortable: true,
      sortValue: (item) => item.owner_name || "",
      csvValue: (item) => item.owner_name ?? "",
    },
    {
      ...prospectColumns[6],
      render: (item) =>
        item.last_activity_at ? (
          <span className="text-muted-foreground">
            {ACTIVITY_TYPE_LABELS[item.last_activity_type ?? ""] ?? item.last_activity_type}
            {" · "}
            {daysAgo(item.last_activity_at)}
          </span>
        ) : null,
      sortable: true,
      sortValue: (item) => item.last_activity_at || "",
      csvValue: (item) => item.last_activity_at ?? "",
    },
    {
      ...prospectColumns[7],
      render: (item) =>
        item.next_follow_up_at ? (
          <span className={isOverdue(item.next_follow_up_at) ? "text-muted-foreground" : undefined}>
            {isOverdue(item.next_follow_up_at) ? "overdue · " : ""}
            {formatDate(item.next_follow_up_at)}
          </span>
        ) : null,
      sortable: true,
      sortValue: (item) => item.next_follow_up_at || "",
      csvValue: (item) => item.next_follow_up_at ?? "",
    },
    {
      ...prospectColumns[8],
      render: (item) =>
        item.contact_email ? (
          <a
            href={`mailto:${item.contact_email}`}
            className="text-foreground hover:text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {item.contact_email}
          </a>
        ) : null,
      sortValue: (item) => item.contact_email || "",
      csvValue: (item) => item.contact_email ?? "",
    },
    {
      ...prospectColumns[9],
      render: (item) => (
        <span>{[item.city, item.state].filter(Boolean).join(", ")}</span>
      ),
      sortValue: (item) => [item.city, item.state].filter(Boolean).join(", "),
      csvValue: (item) => [item.city, item.state].filter(Boolean).join(", "),
    },
    {
      ...prospectColumns[10],
      render: (item) => <span>{item.created_at ? formatDate(item.created_at) : ""}</span>,
      sortable: true,
      sortValue: (item) => item.created_at || "",
      csvValue: (item) => item.created_at ?? "",
    },
  ];
}

export default function DirectoryProspectsPage(): ReactElement {
  const pathname = usePathname()! ?? "";
  const router = useRouter();
  const searchParams = (useSearchParams() ?? new URLSearchParams()) as NonNullable<
    ReturnType<typeof useSearchParams>
  >;

  const initialFilters: ProspectFilterState = {
    lifecycle_stage: searchParams.get("lifecycle_stage") || undefined,
    owner: searchParams.get("owner") || undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "global-directory-prospects",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "name",
      sortDirection: "asc",
      visibleColumns: prospectDefaultVisibleColumns,
      filters: initialFilters,
    },
  });

  const [prospects, setProspects] = React.useState<ProspectListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [isAddOpen, setIsAddOpen] = React.useState(false);

  const fetchProspects = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const payload = await apiFetch<ProspectsResponse>("/api/directory/prospects");
      setProspects(payload.data);
      setError(null);
    } catch (fetchError) {
      setError(fetchError as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  React.useEffect(() => {
    const nextStage = searchParams.get("lifecycle_stage") || undefined;
    const nextOwner = searchParams.get("owner") || undefined;
    tableState.setActiveFilters((prev) => {
      if (prev.lifecycle_stage === nextStage && prev.owner === nextOwner) {
        return prev;
      }
      return { lifecycle_stage: nextStage, owner: nextOwner };
    });
  }, [searchParams, tableState.setActiveFilters]);

  const activeFilters = tableState.activeFilters as ProspectFilterState;

  const filters: FilterConfig[] = React.useMemo(() => {
    const owners = Array.from(
      new Set(prospects.map((p) => p.owner_name).filter((v): v is string => Boolean(v))),
    ).sort();
    return [
      {
        id: "lifecycle_stage",
        label: "Stage",
        type: "select",
        options: [
          { value: "prospect", label: "Prospect" },
          { value: "qualified", label: "Qualified" },
        ],
      },
      {
        id: "owner",
        label: "Owner",
        type: "select",
        options: owners.map((owner) => ({ value: owner, label: owner })),
      },
    ];
  }, [prospects]);

  const filteredProspects = React.useMemo(() => {
    const search = tableState.debouncedSearch.trim().toLowerCase();
    const stageFilter =
      typeof activeFilters.lifecycle_stage === "string" ? activeFilters.lifecycle_stage : "";
    const ownerFilter = typeof activeFilters.owner === "string" ? activeFilters.owner : "";

    return prospects.filter((prospect) => {
      if (stageFilter && prospect.lifecycle_stage !== stageFilter) return false;
      if (ownerFilter && prospect.owner_name !== ownerFilter) return false;
      if (!search) return true;
      return (
        prospect.name.toLowerCase().includes(search) ||
        (prospect.contact_name || "").toLowerCase().includes(search) ||
        (prospect.contact_email || "").toLowerCase().includes(search) ||
        (prospect.owner_name || "").toLowerCase().includes(search)
      );
    });
  }, [prospects, activeFilters, tableState.debouncedSearch]);

  const tableColumns = React.useMemo(() => buildProspectTableColumns(), []);
  const tabs = getDirectoryTabs(pathname);
  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.lifecycle_stage) ||
    Boolean(activeFilters.owner);
  const totalPages = Math.max(1, Math.ceil(filteredProspects.length / tableState.perPage));
  const currentPage = Math.min(tableState.page, totalPages);

  const handleFilterChange = (nextFilters: ProspectFilterState) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      lifecycle_stage:
        typeof nextFilters.lifecycle_stage === "string" ? nextFilters.lifecycle_stage : null,
      owner: typeof nextFilters.owner === "string" ? nextFilters.owner : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Company Directory: Prospects",
          description:
            "Companies being pursued or vetted — they join the verified directory once qualification is complete",
          actions: (
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus />
              Add prospect
            </Button>
          ),
        }}
        tabs={tabs}
        toolbar={{
          totalItems: prospects.length,
          filteredItems: filteredProspects.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search company, contact, owner...",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          enabledViews: ["table"],
          filters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: prospectColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
        }}
        data={{
          items: filteredProspects,
          isLoading,
          isFetching: false,
          error: error ?? undefined,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
          onRowClick: (item) => router.push(`/directory/companies/${item.id}`),
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
            tableState.setSearchParams({ sort: sortBy, sort_dir: direction });
          },
        }}
        emptyState={{
          title: "No prospects yet",
          description:
            "Add a prospect to start tracking it — it stays separate from verified vendors until qualified.",
          filteredDescription: "Try adjusting your search or filters.",
          isFiltered,
          action: (
            <Button size="sm" onClick={() => setIsAddOpen(true)}>
              Add prospect
            </Button>
          ),
        }}
        pagination={{
          page: currentPage,
          totalPages,
          perPage: tableState.perPage,
          clientSide: true,
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
        features={{
          enableRowSelection: false,
        }}
        layout={{
          fullBleedTable: true,
          removeTableFrame: true,
        }}
      />
      <AddProspectDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onCreated={(companyId) => {
          fetchProspects();
          router.push(`/directory/companies/${companyId}`);
        }}
      />
    </>
  );
}
