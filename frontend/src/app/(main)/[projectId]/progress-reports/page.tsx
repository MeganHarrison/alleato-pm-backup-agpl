"use client";

import React from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Loader2, Mail, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type TableColumn,
} from "@/components/tables/unified";
import { useCreateProgressReport, useProgressReports } from "@/hooks/use-progress-reports";
import { formatProgressReportDate } from "@/lib/progress-reports/date-format";
import type { ProgressReportListItem } from "@/lib/progress-reports/types";

function statusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "sent": return "default";
    case "ready": return "secondary";
    default: return "outline";
  }
}

const reportColumns: TableColumn<ProgressReportListItem>[] = [
  {
    id: "title",
    label: "Title",
    render: (item) => item.title,
    sortValue: (item) => item.title,
  },
  {
    id: "status",
    label: "Status",
    render: (item) => (
      <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
    ),
    sortValue: (item) => item.status,
  },
  {
    id: "week",
    label: "Week",
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {formatProgressReportDate(item.week_start)} – {formatProgressReportDate(item.week_end)}
      </span>
    ),
    sortValue: (item) => item.week_start,
  },
  {
    id: "photos",
    label: "Photos",
    render: (item) => item.selected_photo_count,
    sortValue: (item) => item.selected_photo_count,
  },
  {
    id: "recipients",
    label: "Recipients",
    render: (item) => item.client_recipients.length,
    sortValue: (item) => item.client_recipients.length,
  },
  {
    id: "created_at",
    label: "Created",
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {new Date(item.created_at).toLocaleDateString()}
      </span>
    ),
    sortValue: (item) => item.created_at,
  },
];

const defaultVisibleColumns = ["title", "status", "week", "photos", "recipients", "created_at"];

function ProgressReportCard({
  item,
  onClick,
}: {
  item: ProgressReportListItem;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="h-auto w-full flex-col items-start gap-3 rounded-xl bg-card p-5 text-left transition-shadow hover:shadow-xs"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.title}</p>
        <Badge variant={statusVariant(item.status)} className="shrink-0 capitalize">
          {item.status}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Week of {formatProgressReportDate(item.week_start)} – {formatProgressReportDate(item.week_end)}
      </p>

      <div className="mt-auto flex items-center gap-4 pt-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" />
          {item.selected_photo_count} photo{item.selected_photo_count === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Mail className="h-3.5 w-3.5" />
          {item.client_recipients.length} recipient{item.client_recipients.length === 1 ? "" : "s"}
        </span>
      </div>
    </Button>
  );
}

export default function ProgressReportsPage() {
  const params = useParams<{ projectId: string }>()! ?? { projectId: "" };
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = (useSearchParams() ?? new URLSearchParams()) as NonNullable<
    ReturnType<typeof useSearchParams>
  >;

  const projectId = params.projectId ?? "";
  const numericProjectId = Number.parseInt(projectId, 10);

  const createMutation = useCreateProgressReport(numericProjectId);
  const reportsQuery = useProgressReports(numericProjectId);

  const tableState = useUnifiedTableState({
    entityKey: "progress-reports",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["card", "table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "week",
      sortDirection: "desc",
      visibleColumns: defaultVisibleColumns,
      filters: {},
    },
  });

  const reports = reportsQuery.data?.reports ?? [];

  const filteredReports = React.useMemo(() => {
    const search = tableState.debouncedSearch.trim().toLowerCase();
    if (!search) return reports;
    return reports.filter(
      (r) =>
        r.title.toLowerCase().includes(search) ||
        (r.past_week_highlights ?? "").toLowerCase().includes(search),
    );
  }, [reports, tableState.debouncedSearch]);

  async function handleCreate() {
    const result = await createMutation.mutateAsync({});
    router.push(`/${projectId}/progress-reports/${result.reportId}`);
  }

  return (
    <UnifiedTablePage
      header={{
        title: "Progress Reports",
        description: "Weekly client-ready reports from meetings, emails, and project photos.",
        actions: (
          <Button
            size="sm"
            className="gap-2"
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create This Week&apos;s Draft
          </Button>
        ),
      }}
      toolbar={{
        totalItems: reports.length,
        filteredItems: filteredReports.length,
        selectedCount: 0,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search reports...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        enabledViews: ["card", "table"],
        columns: reportColumns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items: filteredReports,
        isLoading: reportsQuery.isLoading,
        isFetching: reportsQuery.isFetching,
      }}
      table={{
        columns: reportColumns,
        getRowId: (item) => item.id,
        onRowClick: (item) => router.push(`/${projectId}/progress-reports/${item.id}`),
      }}
      views={{
        card: (item) => (
          <ProgressReportCard
            item={item}
            onClick={() => router.push(`/${projectId}/progress-reports/${item.id}`)}
          />
        ),
        cardGroupBy: (item) => String(new Date(item.week_start).getFullYear()),
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
        title: "No progress reports yet",
        description: "Create this week's draft to get started.",
        filteredDescription: "Try adjusting your search.",
        isFiltered: Boolean(tableState.searchInput),
        action: (
          <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
            <Plus className="h-4 w-4" />
            Create This Week&apos;s Draft
          </Button>
        ),
      }}
      features={{
        enableSearch: true,
        enableFilters: false,
        enableViews: true,
        enableColumnToggle: true,
        enableExport: false,
        enableBulkDelete: false,
        enableRowSelection: false,
        enableRowActions: false,
      }}
    />
  );
}
