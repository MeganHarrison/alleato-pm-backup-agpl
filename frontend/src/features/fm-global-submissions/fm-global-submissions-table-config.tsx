import type { TableColumn } from "@/components/tables/unified";
import type { FmGlobalSubmissionListItem } from "@/hooks/use-fm-global-submissions";

export interface ColumnConfig {
  id: string;
  label: string;
  defaultVisible?: boolean;
  alwaysVisible?: boolean;
}

export const fmGlobalSubmissionColumns: ColumnConfig[] = [
  { id: "created_at", label: "Submitted", alwaysVisible: true },
  { id: "contact_name", label: "Name", defaultVisible: true },
  { id: "contact_email", label: "Email", defaultVisible: true },
  { id: "project_name", label: "Project", defaultVisible: true },
  { id: "project_location", label: "Location", defaultVisible: true },
  { id: "asrs_type", label: "ASRS Type", defaultVisible: true },
  { id: "system_type", label: "System", defaultVisible: true },
  { id: "ceiling_height_ft", label: "Ceiling (ft)", defaultVisible: true },
  { id: "commodity_class", label: "Commodity", defaultVisible: false },
  { id: "matched_tables", label: "Matches", defaultVisible: true },
];

export const fmGlobalSubmissionDefaultVisibleColumns = fmGlobalSubmissionColumns
  .filter((c) => c.defaultVisible || c.alwaysVisible)
  .map((c) => c.id);

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function buildFmGlobalSubmissionColumns(): TableColumn<FmGlobalSubmissionListItem>[] {
  return [
    {
      id: "created_at",
      label: "Submitted",
      alwaysVisible: true,
      sortable: true,
      sortValue: (item) => item.created_at ?? "",
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(item.created_at)}
        </span>
      ),
    },
    {
      id: "contact_name",
      label: "Name",
      sortable: true,
      sortValue: (item) => item.contact_info?.name ?? "",
      render: (item) => (
        <span className="text-sm font-medium text-foreground">
          {item.contact_info?.name ?? "—"}
        </span>
      ),
      csvValue: (item) => item.contact_info?.name ?? "",
    },
    {
      id: "contact_email",
      label: "Email",
      sortable: true,
      sortValue: (item) => item.contact_info?.email ?? "",
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.contact_info?.email ?? "—"}
        </span>
      ),
      csvValue: (item) => item.contact_info?.email ?? "",
    },
    {
      id: "project_name",
      label: "Project",
      sortable: true,
      sortValue: (item) => item.project_details?.project_name ?? "",
      render: (item) => (
        <span className="text-sm text-foreground">
          {item.project_details?.project_name ?? "—"}
        </span>
      ),
      csvValue: (item) => item.project_details?.project_name ?? "",
    },
    {
      id: "project_location",
      label: "Location",
      sortable: true,
      sortValue: (item) => item.project_details?.project_location ?? "",
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.project_details?.project_location ?? "—"}
        </span>
      ),
      csvValue: (item) => item.project_details?.project_location ?? "",
    },
    {
      id: "asrs_type",
      label: "ASRS Type",
      sortable: true,
      sortValue: (item) => item.user_input?.asrs_type ?? "",
      render: (item) => (
        <span className="text-sm text-foreground">
          {item.user_input?.asrs_type ?? "—"}
        </span>
      ),
      csvValue: (item) => item.user_input?.asrs_type ?? "",
    },
    {
      id: "system_type",
      label: "System",
      sortable: true,
      sortValue: (item) => item.user_input?.system_type ?? "",
      render: (item) => (
        <span className="text-sm capitalize text-foreground">
          {item.user_input?.system_type ?? "—"}
        </span>
      ),
      csvValue: (item) => item.user_input?.system_type ?? "",
    },
    {
      id: "ceiling_height_ft",
      label: "Ceiling (ft)",
      sortable: true,
      sortValue: (item) => item.user_input?.ceiling_height_ft ?? 0,
      render: (item) => (
        <span className="tabular-nums text-sm text-foreground">
          {item.user_input?.ceiling_height_ft ?? "—"}
        </span>
      ),
      csvValue: (item) =>
        item.user_input?.ceiling_height_ft != null
          ? String(item.user_input.ceiling_height_ft)
          : "",
    },
    {
      id: "commodity_class",
      label: "Commodity",
      sortable: true,
      sortValue: (item) => item.user_input?.commodity_class ?? "",
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.user_input?.commodity_class ?? "—"}
        </span>
      ),
      csvValue: (item) => item.user_input?.commodity_class ?? "",
    },
    {
      id: "matched_tables",
      label: "Matches",
      sortable: true,
      sortValue: (item) => item.matched_table_ids?.length ?? 0,
      render: (item) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {item.matched_table_ids?.length ?? 0}
        </span>
      ),
      csvValue: (item) => String(item.matched_table_ids?.length ?? 0),
    },
  ];
}
