import * as React from "react";
import type { ReactElement } from "react";
import { ChevronDown, Lock, MoreVertical, Paperclip, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  ColumnConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";
import type { PrimeContract } from "@/lib/validation/prime-contracts";

export const STATUS_LABELS: Record<
  NonNullable<PrimeContract["status"]>,
  string
> = {
  draft: "Draft",
  out_for_signature: "Out for Signature",
  approved: "Approved",
  complete: "Complete",
  terminated: "Terminated",
};

export const ERP_STATUS_LABELS: Record<string, string> = {
  unsynced: "Unsynced",
  synced: "Synced",
  error: "Error",
};

export const primeContractColumns: ColumnConfig[] = [
  { id: "contract_number", label: "Number", alwaysVisible: true },
  { id: "client_name", label: "Owner/Client", defaultVisible: true },
  { id: "title", label: "Title", defaultVisible: true },
  { id: "erp_status", label: "ERP Status", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "executed", label: "Executed", defaultVisible: true },
  { id: "original_contract_value", label: "Original Contract Amount", defaultVisible: true },
  { id: "approved_change_orders", label: "Approved Change Orders", defaultVisible: true },
  { id: "revised_contract_value", label: "Revised Contract Amount", defaultVisible: true },
  { id: "pending_change_orders", label: "Pending Change Orders", defaultVisible: true },
  { id: "draft_change_orders", label: "Draft Change Orders", defaultVisible: true },
  { id: "invoiced_amount", label: "Invoiced", defaultVisible: true },
  { id: "payments_received", label: "Payments Received", defaultVisible: true },
  { id: "remaining_balance", label: "Remaining Balance Outstanding", defaultVisible: true },
  { id: "percent_paid", label: "% Paid", defaultVisible: true },
  { id: "is_private", label: "Private", defaultVisible: false },
  { id: "attachment_count", label: "Attachments", defaultVisible: false },
  { id: "start_date", label: "Start Date", defaultVisible: false },
  { id: "end_date", label: "End Date", defaultVisible: false },
];

export const primeContractFilters: FilterConfig[] = [
  {
    id: "erp_status",
    label: "ERP Status",
    type: "select",
    options: Object.entries(ERP_STATUS_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: Object.entries(STATUS_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  },
  {
    id: "executed",
    label: "Executed",
    type: "select",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
];

export const primeContractDefaultVisibleColumns = primeContractColumns
  .filter((column) => column.defaultVisible !== false)
  .map((column) => column.id);

// formatCurrency re-exported from @/lib/format for callers that import it from here
export { formatCurrency };

function sortValueForDate(value: string | null | undefined): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

// Map column id → index for safe lookup (avoids hardcoded positional indices)
const COL = Object.fromEntries(
  primeContractColumns.map((col, i) => [col.id, i])
) as Record<string, number>;

export interface PrimeContractInlineEditHandlers {
  /** Persists a single-field change for one prime contract. Throws on failure so the cell can revert. */
  onUpdate: (
    contractId: string,
    data: Record<string, unknown>,
  ) => Promise<void>;
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function buildPrimeContractTableColumns(
  inlineEdit?: PrimeContractInlineEditHandlers,
): TableColumn<PrimeContract>[] {
  const editable = Boolean(inlineEdit);
  return [
    {
      ...primeContractColumns[COL.contract_number],
      width: 220,
      render: (item) => (
        <span className="font-medium text-foreground">
          {item.contract_number ?? "-"}
        </span>
      ),
      csvValue: (item) => item.contract_number ?? "",
      sortValue: (item) => item.contract_number ?? "",
    },
    {
      ...primeContractColumns[COL.client_name],
      render: (item) => (
        <span className="text-muted-foreground">{item.client?.name ?? "-"}</span>
      ),
      csvValue: (item) => item.client?.name ?? "",
      sortValue: (item) => item.client?.name ?? "",
    },
    {
      ...primeContractColumns[COL.title],
      render: (item) => (
        <span className="font-medium text-foreground">
          {item.title ?? "-"}
        </span>
      ),
      csvValue: (item) => item.title ?? "",
      sortValue: (item) => item.title ?? "",
      // Title is the link to the detail page — never inline-editable.
    },
    {
      ...primeContractColumns[COL.erp_status],
      render: (item) => {
        const val = (item as { erp_status?: string }).erp_status ?? "unsynced";
        return <StatusBadge status={ERP_STATUS_LABELS[val] ?? val} />;
      },
      csvValue: (item) => {
        const val = (item as { erp_status?: string }).erp_status ?? "unsynced";
        return ERP_STATUS_LABELS[val] ?? val;
      },
      sortValue: (item) => (item as { erp_status?: string }).erp_status ?? "",
      // Read-only: erp_status reflects ERP sync state, not a user choice.
      editable: false,
    },
    {
      ...primeContractColumns[COL.status],
      render: (item) =>
        item.status ? (
          <StatusBadge status={STATUS_LABELS[item.status]} />
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      csvValue: (item) => (item.status ? STATUS_LABELS[item.status] : ""),
      sortValue: (item) => item.status ?? "",
      // Read-only inline: status is approve-gated (setting "approved" requires a
      // non-zero contract value; the route 400s otherwise). Kept in the full edit flow.
      editable: false,
    },
    {
      ...primeContractColumns[COL.executed],
      render: (item) => <span>{item.executed ? "Yes" : "No"}</span>,
      csvValue: (item) => (item.executed ? "Yes" : "No"),
      sortValue: (item) => (item.executed ? 1 : 0),
      editable,
      editType: "boolean",
      editValue: (item) => (item.executed ? "true" : "false"),
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(item.id, { executed: value === "true" });
      },
    },
    {
      ...primeContractColumns[COL.original_contract_value],
      align: "right" as const,
      render: (item) => <span className="tabular-nums">{formatCurrency(item.original_contract_value)}</span>,
      csvValue: (item) => String(item.original_contract_value ?? ""),
      sortValue: (item) => item.original_contract_value ?? 0,
    },
    {
      ...primeContractColumns[COL.approved_change_orders],
      align: "right" as const,
      render: (item) => <span className="tabular-nums">{formatCurrency(item.approved_change_orders)}</span>,
      csvValue: (item) => String(item.approved_change_orders ?? ""),
      sortValue: (item) => item.approved_change_orders ?? 0,
    },
    {
      ...primeContractColumns[COL.revised_contract_value],
      align: "right" as const,
      render: (item) => <span className="tabular-nums">{formatCurrency(item.revised_contract_value)}</span>,
      csvValue: (item) => String(item.revised_contract_value ?? ""),
      sortValue: (item) => item.revised_contract_value ?? 0,
    },
    {
      ...primeContractColumns[COL.pending_change_orders],
      align: "right" as const,
      render: (item) => <span className="tabular-nums">{formatCurrency(item.pending_change_orders)}</span>,
      csvValue: (item) => String(item.pending_change_orders ?? ""),
      sortValue: (item) => item.pending_change_orders ?? 0,
    },
    {
      ...primeContractColumns[COL.draft_change_orders],
      align: "right" as const,
      render: (item) => <span className="tabular-nums">{formatCurrency(item.draft_change_orders)}</span>,
      csvValue: (item) => String(item.draft_change_orders ?? ""),
      sortValue: (item) => item.draft_change_orders ?? 0,
    },
    {
      ...primeContractColumns[COL.invoiced_amount],
      align: "right" as const,
      render: (item) => <span className="tabular-nums">{formatCurrency(item.invoiced_amount)}</span>,
      csvValue: (item) => String(item.invoiced_amount ?? ""),
      sortValue: (item) => item.invoiced_amount ?? 0,
    },
    {
      ...primeContractColumns[COL.payments_received],
      align: "right" as const,
      render: (item) => <span className="tabular-nums">{formatCurrency(item.payments_received)}</span>,
      csvValue: (item) => String(item.payments_received ?? ""),
      sortValue: (item) => item.payments_received ?? 0,
    },
    {
      ...primeContractColumns[COL.remaining_balance],
      align: "right" as const,
      render: (item) => <span className="tabular-nums">{formatCurrency(item.remaining_balance)}</span>,
      csvValue: (item) => String(item.remaining_balance ?? ""),
      sortValue: (item) => item.remaining_balance ?? 0,
    },
    {
      ...primeContractColumns[COL.percent_paid],
      render: (item) => (
        <span>{item.percent_paid != null ? `${item.percent_paid.toFixed(1)}%` : "—"}</span>
      ),
      csvValue: (item) => (item.percent_paid != null ? `${item.percent_paid.toFixed(1)}%` : ""),
      sortValue: (item) => item.percent_paid ?? 0,
    },
    {
      ...primeContractColumns[COL.is_private],
      render: (item) =>
        item.is_private ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      csvValue: (item) => (item.is_private ? "Yes" : "No"),
      sortValue: (item) => (item.is_private ? 1 : 0),
      editable,
      editType: "boolean",
      editValue: (item) => (item.is_private ? "true" : "false"),
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(item.id, { is_private: value === "true" });
      },
    },
    {
      ...primeContractColumns[COL.attachment_count],
      render: (item) => {
        const count = (item as { attachment_count?: number }).attachment_count ?? 0;
        return count > 0 ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            {count}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      csvValue: (item) => String((item as { attachment_count?: number }).attachment_count ?? 0),
      sortValue: (item) => (item as { attachment_count?: number }).attachment_count ?? 0,
    },
    {
      ...primeContractColumns[COL.start_date],
      render: (item) => <span>{formatDate(item.start_date)}</span>,
      csvValue: (item) => item.start_date ?? "",
      sortValue: (item) => sortValueForDate(item.start_date),
      editable,
      editType: "date",
      editValue: (item) => toDateInputValue(item.start_date),
      editEmptyLabel: "Set start date",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(item.id, { start_date: value || null });
      },
    },
    {
      ...primeContractColumns[COL.end_date],
      render: (item) => <span>{formatDate(item.end_date)}</span>,
      csvValue: (item) => item.end_date ?? "",
      sortValue: (item) => sortValueForDate(item.end_date),
      editable,
      editType: "date",
      editValue: (item) => toDateInputValue(item.end_date),
      editEmptyLabel: "Set end date",
      onEdit: async (item, value) => {
        await inlineEdit!.onUpdate(item.id, { end_date: value || null });
      },
    },
  ];
}

export function renderPrimeContractRowActions(
  item: PrimeContract,
  onEdit: (contract: PrimeContract) => void,
  onDelete: (contract: PrimeContract) => void,
): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Row actions">
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(item)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => onDelete(item)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function renderPrimeContractCard(
  item: PrimeContract,
  onClick: (contract: PrimeContract) => void,
): ReactElement {
  return (
    <div
      className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onClick(item)}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs uppercase text-muted-foreground">{item.contract_number ?? "-"}</p>
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h3 className="font-medium">{item.title ?? "Untitled Contract"}</h3>
        </div>
        {item.status ? (
          <StatusBadge status={STATUS_LABELS[item.status]} />
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{item.client?.name ?? "Owner"}</p>
      <p className="text-sm text-muted-foreground mt-2">
        Revised: {formatCurrency(item.revised_contract_value)}
      </p>
    </div>
  );
}

export interface PccoSummary {
  id: number;
  pcco_number: string | null;
  title: string | null;
  status: string | null;
  total_amount: number | null;
}

export interface PcoSummary {
  id: string;
  pco_number: string | null;
  title: string | null;
  status: string | null;
  total_amount: number | null;
  prime_contract_id: string | null;
}

export interface ListChangeOrderData {
  isExpanded: boolean;
  onToggle: (id: string) => void;
  loading: boolean;
  data: PccoSummary[];
  pcos: PcoSummary[];
}

export function renderPrimeContractList(
  item: PrimeContract,
  onClick: (contract: PrimeContract) => void,
  changeOrderData?: ListChangeOrderData,
): ReactElement {
  const formatCur = (v: number | null) => formatCurrency(v);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-3.5 transition-colors hover:bg-muted/40 active:bg-muted/60"
        onClick={() => onClick(item)}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{item.contract_number ?? "-"}</p>
          <p className="truncate text-xs text-muted-foreground mt-0.5">{item.title ?? "Untitled Contract"}</p>
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-2">
          {item.status ? (
            <StatusBadge status={STATUS_LABELS[item.status]} />
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
          {changeOrderData && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                changeOrderData.onToggle(item.id);
              }}
              aria-label={changeOrderData.isExpanded ? "Collapse change orders" : "Expand change orders"}
            >
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform duration-150", changeOrderData.isExpanded && "rotate-180")}
              />
            </Button>
          )}
        </div>
      </div>
      {changeOrderData?.isExpanded && (
        <div className="px-4 pb-3 pt-1">
          {changeOrderData.loading ? (
            <p className="text-xs text-muted-foreground">Loading change orders...</p>
          ) : changeOrderData.data.length === 0 && changeOrderData.pcos.length === 0 ? (
            <p className="text-xs text-muted-foreground">No change orders or potential change orders</p>
          ) : (
            <div className="space-y-1">
              {changeOrderData.data.length > 0 && (
                <div className="space-y-1">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Change Orders ({changeOrderData.data.length})
                  </p>
                  {changeOrderData.data.map((co) => (
                    <div
                      key={co.id}
                      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium">{co.pcco_number || "—"}</span>
                        <span className="ml-2 text-xs text-muted-foreground line-clamp-1">{co.title || "—"}</span>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-2">
                        <StatusBadge status={co.status || "Unknown"} />
                        <span className="text-xs tabular-nums text-muted-foreground">{formatCur(co.total_amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {changeOrderData.pcos.length > 0 && (
                <div className="space-y-1">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Potential Change Orders ({changeOrderData.pcos.length})
                  </p>
                  {changeOrderData.pcos.map((pco) => (
                    <div
                      key={pco.id}
                      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium">{pco.pco_number || "—"}</span>
                        <span className="ml-2 text-xs text-muted-foreground line-clamp-1">{pco.title || "—"}</span>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-2">
                        <StatusBadge status={pco.status || "Unknown"} />
                        <span className="text-xs tabular-nums text-muted-foreground">{formatCur(pco.total_amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
