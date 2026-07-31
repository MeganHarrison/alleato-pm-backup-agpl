import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type {
  ColumnConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";
import { formatProgressReportDate } from "@/lib/progress-reports/date-format";
import type {
  ProgressReportAllListItem,
  ProgressReportStatus,
} from "@/lib/progress-reports/types";

export const progressReportColumns: ColumnConfig[] = [
  { id: "title", label: "Report", alwaysVisible: true },
  { id: "project", label: "Project", defaultVisible: true },
  { id: "week", label: "Week", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "recipients", label: "Recipients", defaultVisible: true },
  { id: "photos", label: "Photos", defaultVisible: true },
  { id: "sent", label: "Sent", defaultVisible: true },
  { id: "updated", label: "Updated", defaultVisible: true },
];

export const progressReportDefaultVisibleColumns = progressReportColumns
  .filter((column) => column.defaultVisible || column.alwaysVisible)
  .map((column) => column.id);

export const progressReportFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "draft", label: "Draft" },
      { value: "ready", label: "Ready" },
      { value: "sent", label: "Sent" },
    ],
  },
];

export function statusVariant(
  status: ProgressReportStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "sent":
      return "default";
    case "ready":
      return "secondary";
    default:
      return "outline";
  }
}

function projectLabel(report: ProgressReportAllListItem) {
  return [
    report.project.project_number ?? report.project.job_number,
    report.project.name ?? `Project #${report.project.id}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function buildProgressReportTableColumns(): TableColumn<ProgressReportAllListItem>[] {
  return [
    {
      id: "title",
      label: "Report",
      alwaysVisible: true,
      sortable: true,
      sortValue: (report) => report.title,
      render: (report) => (
        <div className="truncate text-sm font-medium text-foreground">{report.title}</div>
      ),
      csvValue: (report) => report.title,
    },
    {
      id: "project",
      label: "Project",
      sortable: true,
      sortValue: projectLabel,
      render: (report) => (
        <Link
          href={`/${report.project.id}/progress-reports`}
          className="text-sm font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary transition-colors"
          onClick={(event) => event.stopPropagation()}
        >
          {projectLabel(report)}
        </Link>
      ),
      csvValue: projectLabel,
    },
    {
      id: "week",
      label: "Week",
      sortable: true,
      sortValue: (report) => report.week_end,
      render: (report) => (
        <span className="text-sm text-muted-foreground">
          {formatProgressReportDate(report.week_start)} - {formatProgressReportDate(report.week_end)}
        </span>
      ),
      csvValue: (report) => `${report.week_start} - ${report.week_end}`,
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      sortValue: (report) => report.status,
      render: (report) => <Badge variant={statusVariant(report.status)}>{report.status}</Badge>,
      csvValue: (report) => report.status,
    },
    {
      id: "recipients",
      label: "Recipients",
      sortable: true,
      sortValue: (report) => report.client_recipients.length,
      render: (report) => (
        <span className="text-sm text-muted-foreground">
          {report.client_recipients.length}
        </span>
      ),
      csvValue: (report) => String(report.client_recipients.length),
    },
    {
      id: "photos",
      label: "Photos",
      sortable: true,
      sortValue: (report) => report.selected_photo_count,
      render: (report) => (
        <span className="text-sm text-muted-foreground">{report.selected_photo_count}</span>
      ),
      csvValue: (report) => String(report.selected_photo_count),
    },
    {
      id: "sent",
      label: "Sent",
      sortable: true,
      sortValue: (report) => report.sent_at ?? "",
      render: (report) => (
        <span className="text-sm text-muted-foreground">
          {formatProgressReportDate(report.sent_at)}
        </span>
      ),
      csvValue: (report) => report.sent_at ?? "",
    },
    {
      id: "updated",
      label: "Updated",
      sortable: true,
      sortValue: (report) => report.updated_at,
      render: (report) => (
        <span className="text-sm text-muted-foreground">
          {formatProgressReportDate(report.updated_at, "MMM d, h:mm a")}
        </span>
      ),
      csvValue: (report) => report.updated_at,
    },
  ];
}
