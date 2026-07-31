import type { TableColumn, FilterConfig } from "@/components/tables/unified";
import type { DbInventoryTable } from "@/components/dev-tools/db-inventory.generated";

export type DbInventoryColumnId =
  | "name"
  | "db"
  | "domain"
  | "status"
  | "approxRows"
  | "totalSize"
  | "writes"
  | "reads"
  | "owner"
  | "gotchas";

export const dbInventoryDefaultVisibleColumns: string[] = [
  "name",
  "db",
  "domain",
  "status",
  "approxRows",
  "writes",
  "reads",
  "owner",
  "gotchas",
];

export const dbInventoryFilters: FilterConfig[] = [
  {
    id: "db",
    label: "Database",
    type: "select",
    options: [
      { value: "MAIN", label: "MAIN" },
      { value: "RAG", label: "RAG" },
    ],
  },
  {
    id: "domain",
    label: "Domain",
    type: "select",
    options: [
      { value: "projects", label: "Projects" },
      { value: "people", label: "People" },
      { value: "permissions", label: "Permissions" },
      { value: "financial", label: "Financial" },
      { value: "acumatica-erp", label: "Acumatica ERP" },
      { value: "change-management", label: "Change Management" },
      { value: "commitments", label: "Commitments" },
      { value: "documents", label: "Documents" },
      { value: "communications", label: "Communications" },
      { value: "chat-bot", label: "Chat Bot" },
      { value: "intelligence", label: "Intelligence" },
      { value: "ai-feedback-memory", label: "AI Feedback & Memory" },
      { value: "sync-infrastructure", label: "Sync Infrastructure" },
      { value: "workflow", label: "Workflow" },
      { value: "marketing", label: "Marketing" },
      { value: "admin-feedback", label: "Admin Feedback" },
      { value: "media", label: "Media" },
      { value: "fm-asrs", label: "FM / ASRS" },
      { value: "procore-parity", label: "Procore Parity" },
      { value: "support-knowledge", label: "Support Knowledge" },
      { value: "infra-meta", label: "Infra / Meta" },
    ],
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "live", label: "Live" },
      { value: "live-empty", label: "Live (Empty)" },
      { value: "dormant", label: "Dormant" },
      { value: "dead", label: "Dead" },
      { value: "deleted", label: "Deleted" },
      { value: "legacy", label: "Legacy" },
      { value: "orphan-mirror", label: "Orphan Mirror" },
    ],
  },
  {
    id: "owner",
    label: "Owner",
    type: "select",
    options: [
      { value: "core-app", label: "Core App" },
      { value: "financial-erp", label: "Financial / ERP" },
      { value: "ai-intelligence", label: "AI Intelligence" },
      { value: "ai-assistant", label: "AI Assistant" },
      { value: "comms-pipeline", label: "Comms Pipeline" },
      { value: "executive-briefing", label: "Executive Briefing" },
      { value: "admin-tools", label: "Admin Tools" },
      { value: "fm-vertical", label: "FM Vertical" },
      { value: "legacy", label: "Legacy" },
      { value: "unknown", label: "Unknown" },
    ],
  },
  {
    id: "hasGotchas",
    label: "Has Gotchas",
    type: "boolean",
  },
];

export const STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "secondary" | "outline"
> = {
  live: "success",
  "live-empty": "secondary",
  dormant: "warning",
  dead: "destructive",
  deleted: "outline",
  legacy: "warning",
  "orphan-mirror": "warning",
};

export function buildDbInventoryTableColumns(
  onRowClick: (item: DbInventoryTable) => void,
): TableColumn<DbInventoryTable>[] {
  return [
    {
      id: "name",
      label: "Table Name",
      alwaysVisible: true,
      sortable: true,
      sortValue: (item) => item.name,
      csvValue: (item) => item.name,
      render: (item) => item.name,
    },
    {
      id: "db",
      label: "DB",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.db,
      csvValue: (item) => item.db,
      render: (item) => item.db,
    },
    {
      id: "domain",
      label: "Domain",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.domain,
      csvValue: (item) => item.domain,
      render: (item) => item.domain,
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.status,
      csvValue: (item) => item.status,
      render: (item) => item.status,
    },
    {
      id: "approxRows",
      label: "Rows",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.liveStats.approxRows,
      csvValue: (item) => String(item.liveStats.approxRows),
      render: (item) => item.liveStats.approxRows.toLocaleString(),
    },
    {
      id: "totalSize",
      label: "Size",
      defaultVisible: false,
      sortable: true,
      sortValue: (item) => item.liveStats.approxRows,
      csvValue: (item) => item.liveStats.totalSize,
      render: (item) => item.liveStats.totalSize,
    },
    {
      id: "writes",
      label: "Writers",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.references.writes.length,
      csvValue: (item) => String(item.references.writes.length),
      render: (item) => item.references.writes.length,
    },
    {
      id: "reads",
      label: "Readers",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.references.reads.length,
      csvValue: (item) => String(item.references.reads.length),
      render: (item) => item.references.reads.length,
    },
    {
      id: "owner",
      label: "Owner",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.owner,
      csvValue: (item) => item.owner,
      render: (item) => item.owner,
    },
    {
      id: "gotchas",
      label: "⚠",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => (item.gotchas ? 1 : 0),
      csvValue: (item) => (item.gotchas ? "yes" : ""),
      render: (item) => (item.gotchas ? "⚠" : ""),
    },
  ];
}
