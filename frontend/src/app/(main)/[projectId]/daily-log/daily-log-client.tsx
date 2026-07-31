"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Mic, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  UnifiedTablePage,
  useUnifiedTableState,
} from "@/components/tables/unified";
import { formatDailyLogDate } from "@/lib/daily-log/creator-labels";

interface DailyLogRow {
  id: string;
  log_date: string | null;
  weather_conditions: unknown;
  created_by: string | null;
  creator_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface DailyLogClientProps {
  projectId: string;
  dailyLogs: DailyLogRow[];
}

const tableColumns = [
  {
    id: "log_date",
    label: "Date",
    defaultVisible: true,
    render: (row: DailyLogRow) =>
      row.log_date ? formatDailyLogDate(row.log_date) : "—",
    sortValue: (row: DailyLogRow) => row.log_date ?? "",
  },
  {
    id: "weather_conditions",
    label: "Weather",
    defaultVisible: true,
    render: (row: DailyLogRow) => {
      if (!row.weather_conditions) return "—";
      if (typeof row.weather_conditions === "string") {
        return row.weather_conditions.length > 100
          ? row.weather_conditions.slice(0, 100) + "…"
          : row.weather_conditions;
      }
      const str = JSON.stringify(row.weather_conditions);
      return str.length > 100 ? str.slice(0, 100) + "…" : str;
    },
  },
  {
    id: "created_by",
    label: "Created By",
    defaultVisible: true,
    render: (row: DailyLogRow) => row.creator_name ?? "—",
    sortValue: (row: DailyLogRow) => row.creator_name ?? "",
  },
  {
    id: "created_at",
    label: "Created",
    defaultVisible: false,
    render: (row: DailyLogRow) =>
      row.created_at
        ? new Date(row.created_at).toLocaleDateString()
        : "—",
    sortValue: (row: DailyLogRow) => row.created_at ?? "",
  },
  {
    id: "updated_at",
    label: "Updated",
    defaultVisible: false,
    render: (row: DailyLogRow) =>
      row.updated_at
        ? new Date(row.updated_at).toLocaleDateString()
        : "—",
    sortValue: (row: DailyLogRow) => row.updated_at ?? "",
  },
];

const defaultVisibleColumns = ["log_date", "weather_conditions", "created_by"];

export function DailyLogClient({ projectId, dailyLogs }: DailyLogClientProps) {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const [logs, setLogs] = React.useState(dailyLogs);

  // Keep local state in sync with prop changes
  React.useEffect(() => {
    setLogs(dailyLogs);
  }, [dailyLogs]);

  const handleEditLog = React.useCallback(
    (log: DailyLogRow) => {
      router.push(`/${projectId}/daily-log/${log.id}/edit`);
    },
    [projectId, router],
  );

  const handleDeleteLog = React.useCallback(
    async (log: DailyLogRow) => {
      try {
        const supabase = createClient();
        const { error } = await supabase.from("daily_logs").delete().eq("id", log.id);
        if (error) throw error;
        setLogs((prev) => prev.filter((l) => l.id !== log.id));
        toast.success("Daily log deleted");
      } catch {
        toast.error("Failed to delete daily log");
      }
    },
    [],
  );

  const tableState = useUnifiedTableState({
    entityKey: "daily-log",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "log_date",
      sortDirection: "desc",
      visibleColumns: defaultVisibleColumns,
      filters: {},
    },
  });

  const filteredLogs = React.useMemo(() => {
    const search = tableState.debouncedSearch.trim().toLowerCase();
    if (!search) return logs;
    return logs.filter(
      (log) =>
        (log.log_date ?? "").toLowerCase().includes(search) ||
        (log.creator_name ?? "").toLowerCase().includes(search),
    );
  }, [logs, tableState.debouncedSearch]);

  const sortedLogs = React.useMemo(() => {
    if (!tableState.sortBy) return filteredLogs;
    const col = tableColumns.find((c) => c.id === tableState.sortBy);
    const getSortValue = col?.sortValue;
    if (!getSortValue) return filteredLogs;
    return [...filteredLogs].sort((a, b) => {
      const va = getSortValue(a);
      const vb = getSortValue(b);
      if (va == null && vb == null) return 0;
      if (va == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (vb == null) return tableState.sortDirection === "asc" ? 1 : -1;
      const cmp = String(va).localeCompare(String(vb));
      return tableState.sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredLogs, tableState.sortBy, tableState.sortDirection]);

  const isFiltered = Boolean(tableState.searchInput);

  return (
    <UnifiedTablePage
      header={{
        title: "Daily Log",
        description: "Daily construction logs and site reports",
        actions: (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/${projectId}/daily-log/site-lead-checklist`)}
            >
              <ClipboardList />
              Site Lead Checklist
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/${projectId}/daily-log/site-scribe`)}
            >
              <Mic />
              Site Scribe
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/${projectId}/daily-log/new`)}
            >
              <Plus />
              New Log Entry
            </Button>
          </div>
        ),
      }}
      toolbar={{
        totalItems: logs.length,
        filteredItems: sortedLogs.length,
        selectedCount: 0,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search by date or author...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        enabledViews: ["table", "card", "list"],
        activeFilters: {},
        onFilterChange: () => undefined,
        onClearFilters: () => undefined,
        columns: tableColumns.map((c) => ({ id: c.id, label: c.label, defaultVisible: c.defaultVisible })),
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items: sortedLogs,
        isLoading: false,
        isFetching: false,
      }}
      table={{
        columns: tableColumns,
        getRowId: (item) => item.id,
        onEdit: handleEditLog,
        onDelete: handleDeleteLog,
      }}
      views={{
        card: (item) => (
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase text-muted-foreground">Daily Log</p>
            {/* eslint-disable-next-line design-system/no-raw-heading */}
            <h3 className="mt-1 font-medium">
              {formatDailyLogDate(item.log_date)}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {item.weather_conditions
                ? typeof item.weather_conditions === "string"
                  ? item.weather_conditions
                  : JSON.stringify(item.weather_conditions)
                : "No weather details"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Created by {item.creator_name ?? "Unknown"}
            </p>
          </div>
        ),
        list: (item) => (
          <div className="flex items-center justify-between rounded-md px-4 py-2">
            <div>
              <p className="text-sm font-medium">
                {formatDailyLogDate(item.log_date)}
              </p>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {item.creator_name ? `By ${item.creator_name}` : "No author"}
              </p>
            </div>
          </div>
        ),
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
        title: "No daily logs found",
        description: "No daily log entries have been created yet.",
        filteredDescription: "Try adjusting your search.",
        isFiltered,
      }}
      features={{
        enableFilters: false,
        enableBulkDelete: false,
        enableRowSelection: false,
        enableExport: false,
      }}
    />
  );
}
