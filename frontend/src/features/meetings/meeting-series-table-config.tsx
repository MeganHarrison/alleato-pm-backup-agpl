import type { ReactElement } from "react";
import { ChevronRight, MoreVertical, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnConfig, FilterConfig, TableColumn } from "@/components/tables/unified";
import type { MeetingSeries, MeetingStatus } from "@/hooks/use-meetings";

// ---------------------------------------------------------------------------
// Series row type — one row per series, carrying its meetings for the
// expanded sub-table.
// ---------------------------------------------------------------------------

export interface MeetingSeriesRow extends MeetingSeries {
  latestMeetingDate: string | null;
}

export function toSeriesRows(series: MeetingSeries[]): MeetingSeriesRow[] {
  return series.map((group) => ({
    ...group,
    latestMeetingDate:
      group.meetings.reduce<string | null>((latest, meeting) => {
        if (!meeting.meeting_date) return latest;
        if (!latest || meeting.meeting_date > latest) return meeting.meeting_date;
        return latest;
      }, null) ?? null,
  }));
}

export const meetingStatusVariant: Record<MeetingStatus, "neutral" | "warning" | "success"> = {
  draft: "neutral",
  awaiting_minutes: "warning",
  minutes: "success",
};

export const meetingStatusLabel: Record<MeetingStatus, string> = {
  draft: "Draft",
  awaiting_minutes: "Awaiting Minutes",
  minutes: "Minutes",
};

export function formatMeetingDate(value: string | null): string {
  if (!value) return "Date TBD";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Toolbar config
// ---------------------------------------------------------------------------

export const meetingSeriesColumns: ColumnConfig[] = [
  { id: "name", label: "Series", alwaysVisible: true },
  { id: "meetingCount", label: "Meetings", defaultVisible: true },
  { id: "latestMeetingDate", label: "Last Meeting", defaultVisible: true },
];

export const meetingStatusFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "draft", label: "Draft" },
      { value: "awaiting_minutes", label: "Awaiting Minutes" },
      { value: "minutes", label: "Minutes" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Series-row columns (rows = series; expanded sub-row lists meetings)
// ---------------------------------------------------------------------------

export function buildMeetingSeriesColumns(
  expandedIds: Set<string>,
  onToggleExpand: (id: string) => void,
): TableColumn<MeetingSeriesRow>[] {
  return [
    {
      id: "name",
      label: "Series",
      alwaysVisible: true,
      sortable: true,
      sortValue: (item) => item.name,
      csvValue: (item) => item.name,
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand(item.series_id);
            }}
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={expandedIds.has(item.series_id) ? "Collapse series" : "Expand series"}
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${
                expandedIds.has(item.series_id) ? "rotate-90" : ""
              }`}
            />
          </Button>
          <span className="font-medium text-foreground">{item.name}</span>
        </div>
      ),
    },
    {
      id: "meetingCount",
      label: "Meetings",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.meetings.length,
      csvValue: (item) => String(item.meetings.length),
      render: (item) => (
        <span className="text-muted-foreground">
          {item.meetings.length} meeting{item.meetings.length === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      id: "latestMeetingDate",
      label: "Last Meeting",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.latestMeetingDate ?? "",
      csvValue: (item) => item.latestMeetingDate ?? "",
      render: (item) => (
        <span className="text-muted-foreground">
          {formatMeetingDate(item.latestMeetingDate)}
        </span>
      ),
    },
  ];
}

export const meetingSeriesDefaultVisibleColumns = meetingSeriesColumns
  .filter((column) => column.defaultVisible || column.alwaysVisible)
  .map((column) => column.id);

// ---------------------------------------------------------------------------
// Row actions for individual meetings inside the expanded sub-table
// ---------------------------------------------------------------------------

export function renderMeetingRowActions(
  meetingId: string,
  onDelete: (meetingId: string) => void,
): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(event) => event.stopPropagation()}
          aria-label="Meeting actions"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(meetingId);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function renderRestoreMeetingAction(
  meetingId: string,
  onRestore: (meetingId: string) => void,
): ReactElement {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7"
      onClick={(event) => {
        event.stopPropagation();
        onRestore(meetingId);
      }}
    >
      Restore
    </Button>
  );
}

export { StatusBadge };
