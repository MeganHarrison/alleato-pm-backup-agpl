import type { ColumnConfig, FilterConfig, TableColumn } from "@/components/tables/unified";
import type { ProcurementItem } from "@/hooks/use-procurement";

export const procurementColumns: ColumnConfig[] = [
  { id: "title", label: "Procurement item", alwaysVisible: true },
  { id: "lifecycle_status", label: "Status", defaultVisible: true },
  { id: "submittals", label: "Submittal", defaultVisible: true },
  { id: "schedule_tasks", label: "Schedule activity", defaultVisible: true },
  { id: "updated_at", label: "Updated", defaultVisible: false },
];

export const procurementDefaultVisibleColumns = procurementColumns
  .filter((column) => column.alwaysVisible || column.defaultVisible !== false)
  .map((column) => column.id);

export const procurementFilters: FilterConfig[] = [
  {
    id: "lifecycle_status",
    label: "Status",
    type: "select",
    options: [
      "awaiting_submittal",
      "in_review",
      "approved_to_release",
      "released",
      "vendor_confirmed",
      "fabricating",
      "shipped",
      "partially_received",
      "received",
      "cancelled",
    ].map((value) => ({ value, label: formatProcurementStatus(value) })),
  },
];

export function formatProcurementStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function linkNames<T extends { title?: string | null; name?: string | null }>(
  links: Array<{ submittals?: T | null; schedule_tasks?: T | null }>,
  key: "submittals" | "schedule_tasks",
): string {
  return links
    .map((link) => link[key]?.title ?? link[key]?.name ?? null)
    .filter((name): name is string => Boolean(name))
    .join(", ");
}

export const procurementTableColumns: TableColumn<ProcurementItem>[] = [
  {
    ...procurementColumns[0],
    render: (item) => <span className="font-medium">{item.title}</span>,
    sortValue: (item) => item.title,
  },
  {
    ...procurementColumns[1],
    render: (item) => <span>{formatProcurementStatus(item.lifecycle_status)}</span>,
    sortValue: (item) => item.lifecycle_status,
  },
  {
    ...procurementColumns[2],
    render: (item) => {
      const names = linkNames(item.procurement_item_submittal_links, "submittals");
      return <span className="text-muted-foreground">{names || "Not linked"}</span>;
    },
    sortValue: (item) => linkNames(item.procurement_item_submittal_links, "submittals"),
  },
  {
    ...procurementColumns[3],
    render: (item) => {
      const names = linkNames(item.procurement_item_schedule_task_links, "schedule_tasks");
      return <span className="text-muted-foreground">{names || "Not linked"}</span>;
    },
    sortValue: (item) => linkNames(item.procurement_item_schedule_task_links, "schedule_tasks"),
  },
  {
    ...procurementColumns[4],
    render: (item) => (
      <span className="text-muted-foreground">
        {new Date(item.updated_at).toLocaleDateString()}
      </span>
    ),
    sortValue: (item) => item.updated_at,
  },
];
