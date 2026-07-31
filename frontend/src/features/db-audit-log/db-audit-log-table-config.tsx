import type { ReactNode } from "react";
import type { ColumnConfig, FilterConfig, TableColumn } from "@/components/tables/unified";

export interface AuditLogItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
  changed_columns: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export const auditLogColumnConfig: ColumnConfig[] = [
  { id: "changed_at", label: "When", alwaysVisible: true },
  { id: "table_name", label: "Table", defaultVisible: true },
  { id: "operation", label: "Op", defaultVisible: true },
  { id: "record_id", label: "Record ID", defaultVisible: true },
  { id: "changed_by_name", label: "Actor", defaultVisible: true },
  { id: "changed_columns", label: "Changed Fields", defaultVisible: true },
];

export const auditLogDefaultVisibleColumns = auditLogColumnConfig
  .filter((c) => c.defaultVisible || c.alwaysVisible)
  .map((c) => c.id);

const AUDITED_TABLES = [
  "budget_lines",
  "budget_mod_lines",
  "budget_modifications",
  "change_event_line_items",
  "change_events",
  "companies",
  "contract_change_orders",
  "contract_line_items",
  "direct_cost_line_items",
  "direct_costs",
  "drawing_revisions",
  "drawings",
  "owner_invoice_line_items",
  "owner_invoices",
  "people",
  "prime_contract_change_orders",
  "prime_contracts",
  "project_budget_codes",
  "project_companies",
  "project_directory_memberships",
  "project_role_members",
  "project_roles",
  "project_vendors",
  "projects",
  "purchase_order_sov_items",
  "purchase_orders",
  "rfis",
  "schedule_tasks",
  "subcontract_sov_items",
  "subcontractor_invoice_line_items",
  "subcontractor_invoices",
  "subcontracts",
  "submittals",
  "tasks",
  "user_directory_permissions",
  "user_granular_permission_overrides",
  "user_module_permissions",
].sort();

export const auditLogFilters: FilterConfig[] = [
  {
    id: "operation",
    label: "Operation",
    type: "select",
    options: [
      { value: "INSERT", label: "Insert" },
      { value: "UPDATE", label: "Update" },
      { value: "DELETE", label: "Delete" },
    ],
  },
  {
    id: "table_name",
    label: "Table",
    type: "select",
    options: AUDITED_TABLES.map((t) => ({ value: t, label: t })),
  },
];

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const OP_STYLES: Record<string, string> = {
  INSERT: "bg-success/10 text-success border border-success/20",
  UPDATE: "bg-primary/10 text-primary border border-primary/20",
  DELETE: "bg-destructive/10 text-destructive border border-destructive/20",
};

export function buildAuditLogTableColumns(
  renderOperation?: (item: AuditLogItem) => ReactNode,
): TableColumn<AuditLogItem>[] {
  return [
    {
      id: "changed_at",
      label: "When",
      alwaysVisible: true,
      sortable: true,
      sortValue: (item) => item.changed_at,
      render: (item) => (
        <span
          className="text-sm text-foreground"
          title={formatAbsolute(item.changed_at)}
        >
          {formatRelative(item.changed_at)}
        </span>
      ),
      csvValue: (item) => formatAbsolute(item.changed_at),
      width: 100,
    },
    {
      id: "table_name",
      label: "Table",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.table_name,
      render: (item) => (
        <span className="font-mono text-xs text-foreground">{item.table_name}</span>
      ),
      csvValue: (item) => item.table_name,
      width: 200,
    },
    {
      id: "operation",
      label: "Op",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.operation,
      render: (item) => (
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-xs font-medium ${OP_STYLES[item.operation] ?? ""}`}
        >
          {item.operation}
        </span>
      ),
      csvValue: (item) => item.operation,
      width: 80,
    },
    {
      id: "record_id",
      label: "Record ID",
      defaultVisible: true,
      sortable: false,
      render: (item) => (
        <span className="font-mono text-xs text-muted-foreground">{item.record_id}</span>
      ),
      csvValue: (item) => item.record_id,
      width: 240,
    },
    {
      id: "changed_by_name",
      label: "Actor",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.changed_by_name ?? "",
      render: (item) => (
        <span className="text-sm text-foreground">
          {item.changed_by_name ?? (
            <span className="text-muted-foreground">system</span>
          )}
        </span>
      ),
      csvValue: (item) => item.changed_by_name ?? "system",
      width: 160,
    },
    {
      id: "changed_columns",
      label: "Changed Fields",
      defaultVisible: true,
      sortable: false,
      render: (item) => {
        if (!item.changed_columns?.length) return null;
        const visible = item.changed_columns.slice(0, 3);
        const extra = item.changed_columns.length - visible.length;
        return (
          <span className="flex flex-wrap gap-1">
            {visible.map((col) => (
              <span
                key={col}
                className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-muted-foreground"
              >
                {col}
              </span>
            ))}
            {extra > 0 && (
              <span className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-muted-foreground">
                +{extra}
              </span>
            )}
          </span>
        );
      },
      csvValue: (item) => (item.changed_columns ?? []).join(", "),
    },
  ];
}
