"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";

import { StatusBadge } from "@/components/ds";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { apiFetch } from "@/lib/api-client";

import {
  PacketDetailPanel,
  formatDate,
  formatDateTime,
  summarizeConfidence,
  summarizeSourceCoverage,
  truncate,
  type IntelligencePacket,
} from "./packet-detail-panel";

const COLUMNS: TableColumn<IntelligencePacket>[] = [
  {
    id: "target_name",
    label: "Target",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.target_name ?? "",
    render: (item) => (
      <span className="text-sm font-medium text-foreground">
        {item.target_name ?? "—"}
      </span>
    ),
    csvValue: (item) => item.target_name ?? "",
  },
  {
    id: "target_type",
    label: "Target Type",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.target_type ?? "",
    render: (item) => (
      <span className="text-sm text-muted-foreground capitalize">
        {item.target_type ?? "—"}
      </span>
    ),
    csvValue: (item) => item.target_type ?? "",
  },
  {
    id: "packet_type",
    label: "Packet Type",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.packet_type,
    render: (item) => (
      <span className="text-sm text-foreground capitalize">
        {item.packet_type.replace(/_/g, " ")}
      </span>
    ),
    csvValue: (item) => item.packet_type,
  },
  {
    id: "freshness_status",
    label: "Freshness",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.freshness_status,
    render: (item) => <StatusBadge status={item.freshness_status} />,
    csvValue: (item) => item.freshness_status,
  },
  {
    id: "current_status",
    label: "Status",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.current_status ?? "",
    render: (item) =>
      item.current_status ? (
        <StatusBadge status={item.current_status} />
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
    csvValue: (item) => item.current_status ?? "",
  },
  {
    id: "executive_summary",
    label: "Executive Summary",
    defaultVisible: true,
    render: (item) => (
      <span
        className="text-sm text-foreground"
        title={item.executive_summary}
      >
        {truncate(item.executive_summary, 120)}
      </span>
    ),
    csvValue: (item) => item.executive_summary ?? "",
  },
  {
    id: "why_it_matters",
    label: "Why It Matters",
    defaultVisible: true,
    render: (item) => (
      <span
        className="text-sm text-muted-foreground"
        title={item.why_it_matters ?? undefined}
      >
        {truncate(item.why_it_matters, 100)}
      </span>
    ),
    csvValue: (item) => item.why_it_matters ?? "",
  },
  {
    id: "strategic_read",
    label: "Strategic Read",
    defaultVisible: true,
    render: (item) => (
      <span
        className="text-sm text-muted-foreground"
        title={item.strategic_read ?? undefined}
      >
        {truncate(item.strategic_read, 100)}
      </span>
    ),
    csvValue: (item) => item.strategic_read ?? "",
  },
  {
    id: "recommended_next_moves",
    label: "Recommended Next Moves",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.recommended_next_moves.length,
    render: (item) => {
      const moves = item.recommended_next_moves ?? [];
      if (moves.length === 0) {
        return <span className="text-sm text-muted-foreground">—</span>;
      }
      return (
        <ul
          className="space-y-0.5 text-sm text-muted-foreground"
          title={moves.join("\n")}
        >
          {moves.slice(0, 3).map((move, idx) => (
            <li key={idx} className="flex gap-1.5">
              <span className="text-muted-foreground/60">•</span>
              <span className="line-clamp-1">{truncate(move, 80)}</span>
            </li>
          ))}
          {moves.length > 3 ? (
            <li className="text-xs text-muted-foreground/70">
              +{moves.length - 3} more
            </li>
          ) : null}
        </ul>
      );
    },
    csvValue: (item) => (item.recommended_next_moves ?? []).join(" | "),
  },
  {
    id: "confidence_summary",
    label: "Confidence",
    defaultVisible: true,
    render: (item) => {
      const text = summarizeConfidence(item.confidence_summary);
      return (
        <span className="text-sm text-muted-foreground" title={text}>
          {truncate(text, 80)}
        </span>
      );
    },
    csvValue: (item) => summarizeConfidence(item.confidence_summary),
  },
  {
    id: "source_coverage",
    label: "Source Coverage",
    defaultVisible: false,
    render: (item) => {
      const text = summarizeSourceCoverage(item.source_coverage);
      return (
        <span className="text-sm text-muted-foreground" title={text}>
          {truncate(text, 80)}
        </span>
      );
    },
    csvValue: (item) => summarizeSourceCoverage(item.source_coverage),
  },
  {
    id: "review_queue_count",
    label: "Review Queue",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.review_queue_count,
    render: (item) => (
      <span className="block text-right tabular-nums text-sm text-foreground">
        {item.review_queue_count}
      </span>
    ),
    csvValue: (item) => String(item.review_queue_count),
  },
  {
    id: "stale_item_count",
    label: "Stale Items",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.stale_item_count,
    render: (item) => (
      <span className="block text-right tabular-nums text-sm text-foreground">
        {item.stale_item_count}
      </span>
    ),
    csvValue: (item) => String(item.stale_item_count),
  },
  {
    id: "generated_at",
    label: "Generated",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.generated_at,
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {formatDateTime(item.generated_at)}
      </span>
    ),
    csvValue: (item) => item.generated_at ?? "",
  },
  {
    id: "packet_version",
    label: "Version",
    defaultVisible: false,
    sortable: true,
    sortValue: (item) => item.packet_version,
    render: (item) => (
      <span className="font-mono text-xs text-muted-foreground">
        {item.packet_version}
      </span>
    ),
    csvValue: (item) => item.packet_version,
  },
  {
    id: "compiler_version",
    label: "Compiler",
    defaultVisible: false,
    sortable: true,
    sortValue: (item) => item.compiler_version ?? "",
    render: (item) => (
      <span className="font-mono text-xs text-muted-foreground">
        {item.compiler_version ?? "—"}
      </span>
    ),
    csvValue: (item) => item.compiler_version ?? "",
  },
  {
    id: "covered_start_at",
    label: "Coverage Start",
    defaultVisible: false,
    sortable: true,
    sortValue: (item) => item.covered_start_at ?? "",
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(item.covered_start_at)}
      </span>
    ),
    csvValue: (item) => item.covered_start_at ?? "",
  },
  {
    id: "covered_end_at",
    label: "Coverage End",
    defaultVisible: false,
    sortable: true,
    sortValue: (item) => item.covered_end_at ?? "",
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(item.covered_end_at)}
      </span>
    ),
    csvValue: (item) => item.covered_end_at ?? "",
  },
];

const DEFAULT_VISIBLE = COLUMNS.filter((c) => c.defaultVisible !== false).map(
  (c) => c.id,
);

const FILTERS = [
  {
    id: "packet_type",
    label: "Packet Type",
    type: "select" as const,
    options: [
      { label: "Project Briefing", value: "project_briefing" },
      { label: "Executive Summary", value: "executive_summary" },
      { label: "Daily Recap", value: "daily_recap" },
      { label: "Weekly Recap", value: "weekly_recap" },
    ],
  },
  {
    id: "freshness_status",
    label: "Freshness",
    type: "select" as const,
    options: [
      { label: "Fresh", value: "fresh" },
      { label: "Stale", value: "stale" },
      { label: "Expired", value: "expired" },
    ],
  },
  {
    id: "target_type",
    label: "Target Type",
    type: "select" as const,
    options: [
      { label: "Project", value: "project" },
      { label: "Person", value: "person" },
      { label: "Company", value: "company" },
      { label: "Topic", value: "topic" },
    ],
  },
];

const EMPTY_FILTERS: Record<string, FilterValue> = {
  packet_type: undefined,
  freshness_status: undefined,
  target_type: undefined,
};

export default function IntelligencePacketsPage() {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const [packets, setPackets] = React.useState<IntelligencePacket[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<Error | null>(null);
  const [selectedPacket, setSelectedPacket] =
    React.useState<IntelligencePacket | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setFetchError(null);

    apiFetch<IntelligencePacket[]>("/api/admin/intelligence-packets")
      .then((data) => {
        if (!cancelled) {
          setPackets(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(
            err instanceof Error
              ? err
              : new Error("Failed to load intelligence packets"),
          );
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tableState = useUnifiedTableState({
    entityKey: "intelligence-packets-v1",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "generated_at",
      sortDirection: "desc",
      visibleColumns: DEFAULT_VISIBLE,
      filters: EMPTY_FILTERS,
    },
  });

  const filteredPackets = React.useMemo(() => {
    let result = packets;
    const af = tableState.activeFilters;
    const search = tableState.debouncedSearch.toLowerCase();

    if (search) {
      result = result.filter(
        (p) =>
          (p.target_name ?? "").toLowerCase().includes(search) ||
          (p.executive_summary ?? "").toLowerCase().includes(search) ||
          (p.packet_type ?? "").toLowerCase().includes(search) ||
          (p.strategic_read ?? "").toLowerCase().includes(search) ||
          (p.why_it_matters ?? "").toLowerCase().includes(search) ||
          (p.recommended_next_moves ?? []).some((m) =>
            m.toLowerCase().includes(search),
          ),
      );
    }

    if (typeof af.packet_type === "string" && af.packet_type) {
      result = result.filter((p) => p.packet_type === af.packet_type);
    }
    if (typeof af.freshness_status === "string" && af.freshness_status) {
      result = result.filter(
        (p) => p.freshness_status === af.freshness_status,
      );
    }
    if (typeof af.target_type === "string" && af.target_type) {
      result = result.filter((p) => p.target_type === af.target_type);
    }

    return result;
  }, [packets, tableState.debouncedSearch, tableState.activeFilters]);

  const sortedPackets = React.useMemo(() => {
    if (!tableState.sortBy) return filteredPackets;
    const col = COLUMNS.find((c) => c.id === tableState.sortBy);
    const getSortValue = col?.sortValue;
    if (!getSortValue) return filteredPackets;

    return [...filteredPackets].sort((a, b) => {
      const va = getSortValue(a);
      const vb = getSortValue(b);
      if (va == null && vb == null) return 0;
      if (va == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (vb == null) return tableState.sortDirection === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number") {
        return tableState.sortDirection === "asc" ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb));
      return tableState.sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredPackets, tableState.sortBy, tableState.sortDirection]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedPackets.length / tableState.perPage),
  );

  const isFiltered =
    Boolean(tableState.debouncedSearch) ||
    Boolean(tableState.activeFilters.packet_type) ||
    Boolean(tableState.activeFilters.freshness_status) ||
    Boolean(tableState.activeFilters.target_type);

  const handleSelectAll = (checked: boolean) => {
    tableState.setSelectedIds(
      checked ? sortedPackets.map((p) => p.id) : [],
    );
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    tableState.setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  const handleFilterChange = (next: Record<string, FilterValue>) => {
    tableState.setActiveFilters(next);
    tableState.setPage(1);
  };

  const handleExport = () => {
    const headers = COLUMNS.filter((c) =>
      tableState.visibleColumns.includes(c.id),
    ).map((c) => c.label);

    const rows = sortedPackets.map((p) =>
      COLUMNS.filter((c) => tableState.visibleColumns.includes(c.id)).map(
        (c) => c.csvValue?.(p) ?? "",
      ),
    );

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "intelligence-packets.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <UnifiedTablePage<IntelligencePacket>
      header={{
        title: "Intelligence Packets",
        description:
          "AI-generated briefing packets for projects, people, and topics — with freshness and review queue tracking.",
      }}
      toolbar={{
        totalItems: sortedPackets.length,
        filteredItems: sortedPackets.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search packets…",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        filters: FILTERS,
        activeFilters: tableState.activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: COLUMNS,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        onExport: handleExport,
      }}
      data={{
        items: sortedPackets,
        isLoading,
        error: fetchError,
      }}
      table={{
        columns: COLUMNS,
        getRowId: (item) => item.id,
        stickyHeader: true,
        density: "compact",
        activeRowId: selectedPacket?.id ?? null,
        onRowClick: (item) => setSelectedPacket(item),
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
          tableState.setSearchParams({
            sort: sortBy,
            sort_dir: direction,
            page: "1",
          });
          tableState.setPage(1);
        },
      }}
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: handleSelectAll,
        onSelectRow: handleSelectRow,
      }}
      emptyState={{
        title: "No intelligence packets",
        description:
          "AI-generated briefing packets will appear after the canonical Project Intelligence run completes.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
        icon: <Sparkles className="h-8 w-8 text-muted-foreground" />,
      }}
      pagination={{
        page: tableState.page,
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
      sidePanel={
        selectedPacket
          ? {
              content: (
                <PacketDetailPanel
                  packet={selectedPacket}
                  onClose={() => setSelectedPacket(null)}
                />
              ),
              variant: "wide",
              defaultWidth: 560,
              minWidth: 440,
              storageKey: "intelligence-packet-detail",
              contentClassName: "pl-0 pr-0",
              showCloseButton: false,
              onClose: () => setSelectedPacket(null),
            }
          : undefined
      }
      features={{
        enableViews: false,
      }}
    />
  );
}
