"use client";

import { useMemo, type ReactElement, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type TableColumn,
} from "@/components/tables/unified";
import {
  StatusBadge,
  formatMeetingDate,
  meetingStatusLabel,
  meetingStatusVariant,
} from "@/features/meetings/meeting-series-table-config";
import { useDeleteMeeting, useMeetingSeriesList } from "@/hooks/use-meetings";
import type { MeetingListItem } from "@/hooks/use-meetings";

/**
 * A structured meeting flattened out of its series, carrying the series name so
 * a single flat table can show every planned/created meeting for the project.
 */
interface StructuredMeetingRow extends MeetingListItem {
  series_id: string;
  series_name: string;
}

interface StructuredMeetingsTablePageProps {
  projectId: string;
  headerActions?: ReactNode;
  tabs?: { label: string; href: string; isActive?: boolean }[];
}

export function StructuredMeetingsTablePage({
  projectId,
  headerActions,
  tabs,
}: StructuredMeetingsTablePageProps): ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data, isLoading, error } = useMeetingSeriesList(projectId);
  const deleteMeeting = useDeleteMeeting(projectId);

  const tableState = useUnifiedTableState({
    entityKey: "structured-meetings",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "meeting_date",
      sortDirection: "desc",
      visibleColumns: ["number", "name", "series", "meeting_date", "status", "agenda_item_count"],
      filters: {},
    },
  });

  const rows = useMemo<StructuredMeetingRow[]>(() => {
    const flattened: StructuredMeetingRow[] = [];
    for (const series of data?.series ?? []) {
      for (const meeting of series.meetings) {
        flattened.push({ ...meeting, series_id: series.series_id, series_name: series.name });
      }
    }
    return flattened;
  }, [data]);

  const search = tableState.debouncedSearch.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!search) return rows;
    return rows.filter((row) => {
      const haystack = [row.name, row.series_name, row.location ?? ""].join(" ").toLowerCase();
      return haystack.includes(search);
    });
  }, [rows, search]);

  const columns: TableColumn<StructuredMeetingRow>[] = useMemo(
    () => [
      {
        id: "number",
        label: "#",
        alwaysVisible: true,
        sortable: true,
        sortValue: (item) => item.number,
        csvValue: (item) => String(item.number),
        render: (item) => <span className="text-muted-foreground">{item.number}</span>,
      },
      {
        id: "name",
        label: "Meeting",
        alwaysVisible: true,
        sortable: true,
        sortValue: (item) => item.name,
        csvValue: (item) => item.name,
        render: (item) => <span className="font-medium text-foreground">{item.name}</span>,
      },
      {
        id: "series",
        label: "Series",
        defaultVisible: true,
        sortable: true,
        sortValue: (item) => item.series_name,
        csvValue: (item) => item.series_name,
        render: (item) => <span className="text-muted-foreground">{item.series_name}</span>,
      },
      {
        id: "meeting_date",
        label: "Date",
        defaultVisible: true,
        sortable: true,
        sortValue: (item) => item.meeting_date ?? "",
        csvValue: (item) => item.meeting_date ?? "",
        render: (item) => (
          <span className="text-muted-foreground">{formatMeetingDate(item.meeting_date)}</span>
        ),
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        sortable: true,
        sortValue: (item) => meetingStatusLabel[item.status],
        csvValue: (item) => meetingStatusLabel[item.status],
        render: (item) => (
          <StatusBadge
            status={meetingStatusLabel[item.status]}
            variant={meetingStatusVariant[item.status]}
          />
        ),
      },
      {
        id: "agenda_item_count",
        label: "Agenda items",
        defaultVisible: true,
        sortable: true,
        sortValue: (item) => item.agenda_item_count,
        csvValue: (item) => String(item.agenda_item_count),
        render: (item) => <span className="text-muted-foreground">{item.agenda_item_count}</span>,
      },
    ],
    [],
  );

  return (
    <UnifiedTablePage
      header={{
        title: "Meetings",
        description: "Agendas and minutes for meetings you plan and run",
        actions: headerActions,
      }}
      tabs={tabs}
      toolbar={{
        totalItems: rows.length,
        filteredItems: filteredRows.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search meetings...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
      }}
      data={{
        items: filteredRows,
        isLoading,
        error: error ?? undefined,
      }}
      table={{
        columns,
        getRowId: (item) => item.id,
        onRowClick: (item) => router.push(`/${projectId}/meetings/${item.id}/agenda`),
        onDelete: (item) => deleteMeeting.mutate(item.id),
      }}
      emptyState={{
        title: "No meetings yet",
        description:
          "Create a meeting to build an agenda, track decisions, and publish minutes. Synced call recordings live under the Transcripts tab.",
        filteredDescription: "No meetings match your search.",
        isFiltered: Boolean(search),
        action: headerActions,
      }}
    />
  );
}
