import * as React from "react";
import type { ReactElement } from "react";
import { ChevronRight, MoreVertical, Trash2 } from "lucide-react";

import { formatDate } from "@/lib/format";

import { StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CellLink,
} from "@/components/tables/unified";
import type {
  ColumnConfig,
  DetailFieldConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";
import type { CommitmentListItem } from "@/lib/validation/commitments";

export const commitmentColumns: ColumnConfig[] = [
  { id: "number", label: "Number", alwaysVisible: true },
  { id: "contract_company", label: "Company", defaultVisible: true },
  { id: "title", label: "Title", defaultVisible: true },
  { id: "original_amount", label: "Original Amount", defaultVisible: true },
  { id: "approved_change_orders", label: "Approved COs", defaultVisible: true },
  {
    id: "revised_contract_amount",
    label: "Revised Contract Amount",
    defaultVisible: true,
  },
  { id: "pending_change_orders", label: "Pending COs", defaultVisible: true },
  { id: "draft_change_orders", label: "Draft COs", defaultVisible: true },
  { id: "invoiced_amount", label: "Invoiced", defaultVisible: true },
  { id: "payments_issued", label: "Payments Issued", defaultVisible: true },
  { id: "percent_paid", label: "% Paid", defaultVisible: true },
  { id: "remaining_balance", label: "Remaining Balance", defaultVisible: true },
  { id: "is_private", label: "Private", defaultVisible: false },
  { id: "trade_names", label: "Division", defaultVisible: false },
  { id: "cost_codes", label: "Cost Code", defaultVisible: false },
  { id: "scope_summary", label: "Description", defaultVisible: false },
  { id: "type", label: "Type", defaultVisible: false },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "executed", label: "Executed", defaultVisible: true },
  { id: "acumatica_link", label: "Acumatica", defaultVisible: true },
  { id: "erp_status", label: "ERP Status", defaultVisible: false },
  { id: "ssov_status", label: "SOV Status", defaultVisible: true },
  { id: "created_at", label: "Created", defaultVisible: true },
  { id: "created_by_name", label: "Created By", defaultVisible: true },
];

export const commitmentFilters: FilterConfig[] = [
  {
    id: "type",
    label: "Type",
    type: "select",
    options: [
      { value: "subcontract", label: "Subcontract" },
      { value: "purchase_order", label: "Purchase Order" },
    ],
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "Draft", label: "Draft" },
      { value: "Out for Bid", label: "Out for Bid" },
      { value: "Out for Signature", label: "Out for Signature" },
      { value: "Approved", label: "Approved" },
      { value: "Complete", label: "Complete" },
      { value: "Terminated", label: "Terminated" },
    ],
  },
  {
    id: "contract_company_name",
    label: "Company",
    type: "text",
    placeholder: "Filter by company name...",
  },
  {
    id: "erp_status",
    label: "ERP Status",
    type: "select",
    options: [
      { value: "synced", label: "Synced" },
      { value: "not_synced", label: "Not Synced" },
      { value: "sync_error", label: "Sync Error" },
      { value: "pending", label: "Pending" },
    ],
  },
  {
    id: "executed",
    label: "Executed",
    type: "select",
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  {
    id: "ssov_status",
    label: "SSOV Status",
    type: "select",
    options: [
      { value: "draft", label: "Draft" },
      { value: "pending_approval", label: "Pending Approval" },
      { value: "approved", label: "Approved" },
      { value: "revised", label: "Revised" },
    ],
  },
];

export const commitmentDefaultVisibleColumns = commitmentColumns
  .filter((column) => column.defaultVisible !== false)
  .map((column) => column.id);

// Title-case values that satisfy the DB CHECK constraint on subcontracts /
// purchase_orders status (and round-trip through normalizeSubcontractStatus).
export const COMMITMENT_STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Out for Bid", label: "Out for Bid" },
  { value: "Out for Signature", label: "Out for Signature" },
  { value: "Approved", label: "Approved" },
  { value: "Complete", label: "Complete" },
  { value: "Terminated", label: "Terminated" },
];

const YES_NO_OPTIONS = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

/**
 * Fields for the same-page slide-over editor (DetailPanel). Edits the full
 * commitment record without navigating away. Date fields differ by type;
 * financials/SOV stay on the full detail page (not edited here).
 */
export function buildCommitmentDetailFields(
  type: string | undefined,
): DetailFieldConfig[] {
  const dateFields: DetailFieldConfig[] =
    type === "purchase_order"
      ? [
          { id: "contract_date", label: "Contract Date", type: "date" },
          { id: "delivery_date", label: "Delivery Date", type: "date" },
          {
            id: "signed_po_received_date",
            label: "Signed PO Received",
            type: "date",
          },
        ]
      : [
          { id: "start_date", label: "Start Date", type: "date" },
          {
            id: "estimated_completion_date",
            label: "Est. Completion",
            type: "date",
          },
          { id: "contract_date", label: "Contract Date", type: "date" },
          {
            id: "signed_contract_received_date",
            label: "Signed Contract Received",
            type: "date",
          },
        ];

  return [
    { id: "contract_number", label: "Number", type: "readonly" },
    { id: "contract_company.name", label: "Company", type: "readonly" },
    { id: "title", label: "Title", type: "text", fullWidth: true },
    {
      id: "status",
      label: "Status",
      type: "select",
      options: COMMITMENT_STATUS_OPTIONS,
    },
    {
      id: "executed",
      label: "Executed",
      type: "select",
      options: YES_NO_OPTIONS,
    },
    {
      id: "description",
      label: "Description",
      type: "textarea",
      fullWidth: true,
    },
    ...dateFields,
  ];
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

// Converts snake_case DB values to display strings that StatusBadge can look up.
// e.g., "out_for_signature" → "out for signature"
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  "out for bid": "Out for Bid",
  "out for signature": "Out for Signature",
  approved: "Approved",
  complete: "Complete",
  terminated: "Terminated",
};

const ERP_STATUS_LABELS: Record<string, string> = {
  synced: "Synced",
  not_synced: "Not Synced",
  sync_error: "Sync Error",
  pending: "Pending",
  failed: "Failed",
  resyncing: "Resyncing",
};

function statusLabel(status: string | null | undefined): string {
  if (!status) return "-";
  return STATUS_LABELS[status.toLowerCase()] ?? status.replace(/_/g, " ");
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

const ACUMATICA_BASE_URL = "https://alleatogroup.acumatica.com";

/**
 * Build the Acumatica deep link for a commitment. Subcontracts (number prefixed
 * "SC-") open on the Subcontracts screen; purchase orders open on the Purchase
 * Orders screen. The commitment `number` is the Acumatica reference number.
 */
function acumaticaCommitmentUrl(
  number: string | null | undefined,
  type: string | null | undefined,
): string | null {
  if (!number) return null;
  if (type === "purchase_order") {
    return `${ACUMATICA_BASE_URL}/Main?ScreenId=PO301000&OrderType=RO&OrderNbr=${encodeURIComponent(number)}`;
  }
  return `${ACUMATICA_BASE_URL}/Main?ScreenId=SC301000&SubcontractNbr=${encodeURIComponent(number)}`;
}

export type CommitmentInlineField = "title" | "description" | "executed";

function hasCommitmentChangeOrders(item: CommitmentListItem): boolean {
  if (typeof item.change_order_count === "number") {
    return item.change_order_count > 0;
  }

  return (
    item.approved_change_orders !== 0 ||
    item.pending_change_orders !== 0 ||
    item.draft_change_orders !== 0
  );
}

export function buildCommitmentTableColumns(
  projectId: string,
  expandedIds?: Set<string>,
  onToggleExpand?: (id: string) => void,
  onStatusChange?: (id: string, status: string) => void,
  onInlineEdit?: (
    id: string,
    field: CommitmentInlineField,
    value: string | boolean,
  ) => void | Promise<void>,
): TableColumn<CommitmentListItem>[] {
  const col = (id: string) => {
    const found = commitmentColumns.find((c) => c.id === id);
    if (!found) throw new Error(`Missing commitment column: ${id}`);
    return found;
  };

  const renderers: Record<
    string,
    Omit<TableColumn<CommitmentListItem>, keyof ColumnConfig>
  > = {
    number: {
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <span className="block max-w-32 truncate font-medium" title={item.number}>
            {item.number}
          </span>
          {onToggleExpand && hasCommitmentChangeOrders(item) && (
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(item.id);
              }}
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={
                expandedIds?.has(item.id)
                  ? "Collapse commitment"
                  : "Expand commitment"
              }
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform ${
                  expandedIds?.has(item.id) ? "rotate-90" : ""
                }`}
              />
            </Button>
          )}
        </div>
      ),
      csvValue: (item) => item.number,
      sortValue: (item) => item.number,
    },
    contract_company: {
      render: (item) =>
        item.contract_company?.id && item.contract_company?.name ? (
          <CellLink
            value={item.contract_company.name}
            href={`/directory/companies/${item.contract_company.id}`}
          />
        ) : (
          <span>{item.contract_company?.name ?? "-"}</span>
        ),
      csvValue: (item) => item.contract_company?.name ?? "",
      sortValue: (item) => item.contract_company?.name ?? "",
    },
    trade_names: {
      render: (item) => {
        const value =
          item.trade_names.length > 0 ? item.trade_names.join(", ") : "-";
        return (
          <span
            className="block max-w-48 truncate text-sm text-muted-foreground"
            title={value}
          >
            {value}
          </span>
        );
      },
      csvValue: (item) => item.trade_names.join(", "),
      sortValue: (item) => item.trade_names.join(", "),
    },
    cost_codes: {
      align: "left",
      render: (item) => {
        const value =
          item.cost_codes.length > 0 ? item.cost_codes.join(", ") : "-";
        return (
          <span
            className="block max-w-40 truncate text-sm text-muted-foreground"
            title={value}
          >
            {value}
          </span>
        );
      },
      csvValue: (item) => item.cost_codes.join(", "),
      sortValue: (item) => item.cost_codes.join(", "),
    },
    scope_summary: {
      render: (item) => (
        <span
          className="block max-w-72 truncate text-sm text-muted-foreground"
          title={item.scope_summary ?? ""}
        >
          {item.scope_summary ?? "-"}
        </span>
      ),
      csvValue: (item) => item.scope_summary ?? "",
      sortValue: (item) => item.scope_summary ?? "",
      ...(onInlineEdit
        ? {
            editable: true,
            editInputType: "text",
            editValue: (item) => item.scope_summary ?? "",
            onEdit: (item, value) =>
              onInlineEdit(item.id, "description", value),
          }
        : {}),
    },
    title: {
      render: (item) => (
        <CellLink
          value={item.title ?? "-"}
          href={`/${projectId}/commitments/${item.id}`}
          className="block max-w-72 truncate font-medium"
        />
      ),
      csvValue: (item) => [item.number, item.title].filter(Boolean).join(" "),
      sortValue: (item) => item.title ?? "",
      // Title is the link to the detail page — never inline-editable.
    },
    type: {
      render: (item) => (
        <span className="text-sm font-medium text-muted-foreground capitalize">
          {item.type.replace(/_/g, " ")}
        </span>
      ),
      csvValue: (item) => item.type,
      sortValue: (item) => item.type,
    },
    erp_status: {
      render: (item) => {
        const label = item.erp_status
          ? (ERP_STATUS_LABELS[item.erp_status.toLowerCase()] ??
            item.erp_status)
          : null;
        return label ? (
          <StatusBadge status={label} />
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      csvValue: (item) => item.erp_status ?? "",
      sortValue: (item) => item.erp_status ?? "",
    },
    status: {
      render: (item) => {
        if (!onStatusChange)
          return <StatusBadge status={statusLabel(item.status)} />;
        return (
          <Select
            value={item.status ?? "draft"}
            onValueChange={(value) => onStatusChange(item.id, value)}
          >
            <SelectTrigger
              className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 focus:ring-offset-0"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue>
                <StatusBadge status={statusLabel(item.status)} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {[
                "draft",
                "out_for_bid",
                "out_for_signature",
                "approved",
                "complete",
                "terminated",
                "void",
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  <StatusBadge status={statusLabel(s)} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
      csvValue: (item) => item.status,
      sortValue: (item) => item.status,
    },
    executed: {
      render: (item) => <span>{yesNo(item.executed)}</span>,
      csvValue: (item) => yesNo(item.executed),
      sortValue: (item) => (item.executed ? 1 : 0),
      ...(onInlineEdit
        ? {
            editable: true,
            editType: "boolean" as const,
            editValue: (item) => (item.executed ? "true" : "false"),
            onEdit: (item, value) =>
              onInlineEdit(item.id, "executed", value === "true"),
          }
        : {}),
    },
    acumatica_link: {
      render: (item) => {
        const url = acumaticaCommitmentUrl(item.number, item.type);
        return url ? (
          <CellLink
            value="View"
            href={url}
            external
            className="font-medium"
          />
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
      csvValue: (item) => acumaticaCommitmentUrl(item.number, item.type) ?? "",
      sortValue: (item) => item.number,
    },
    ssov_status: {
      render: (item) => <span>{item.ssov_status ?? "-"}</span>,
      csvValue: (item) => item.ssov_status ?? "",
      sortValue: (item) => item.ssov_status ?? "",
    },
    original_amount: {
      align: "right",
      render: (item) => <span className="tabular-nums">{formatCurrency(item.original_amount)}</span>,
      csvValue: (item) => String(item.original_amount),
      sortValue: (item) => item.original_amount,
    },
    approved_change_orders: {
      align: "right",
      render: (item) => (
        <span className="tabular-nums">{formatCurrency(item.approved_change_orders)}</span>
      ),
      csvValue: (item) => String(item.approved_change_orders),
      sortValue: (item) => item.approved_change_orders,
    },
    revised_contract_amount: {
      align: "right",
      render: (item) => (
        <span className="tabular-nums">{formatCurrency(item.revised_contract_amount)}</span>
      ),
      csvValue: (item) => String(item.revised_contract_amount),
      sortValue: (item) => item.revised_contract_amount,
    },
    pending_change_orders: {
      align: "right",
      render: (item) => (
        <span className="tabular-nums">{formatCurrency(item.pending_change_orders)}</span>
      ),
      csvValue: (item) => String(item.pending_change_orders),
      sortValue: (item) => item.pending_change_orders,
    },
    draft_change_orders: {
      align: "right",
      render: (item) => <span className="tabular-nums">{formatCurrency(item.draft_change_orders)}</span>,
      csvValue: (item) => String(item.draft_change_orders),
      sortValue: (item) => item.draft_change_orders,
    },
    invoiced_amount: {
      align: "right",
      render: (item) => <span className="tabular-nums">{formatCurrency(item.invoiced_amount)}</span>,
      csvValue: (item) => String(item.invoiced_amount),
      sortValue: (item) => item.invoiced_amount,
    },
    payments_issued: {
      align: "right",
      render: (item) => <span className="tabular-nums">{formatCurrency(item.payments_issued)}</span>,
      csvValue: (item) => String(item.payments_issued),
      sortValue: (item) => item.payments_issued,
    },
    percent_paid: {
      render: (item) => <span>{item.percent_paid.toFixed(0)}%</span>,
      csvValue: (item) => String(item.percent_paid),
      sortValue: (item) => item.percent_paid,
    },
    remaining_balance: {
      align: "right",
      render: (item) => <span className="tabular-nums">{formatCurrency(item.remaining_balance)}</span>,
      csvValue: (item) => String(item.remaining_balance),
      sortValue: (item) => item.remaining_balance,
    },
    is_private: {
      render: (item) => <span>{yesNo(item.is_private)}</span>,
      csvValue: (item) => yesNo(item.is_private),
      sortValue: (item) => (item.is_private ? 1 : 0),
    },
    created_at: {
      render: (item) => <span>{formatDate(item.created_at)}</span>,
      csvValue: (item) => item.created_at,
      sortValue: (item) =>
        item.created_at ? new Date(item.created_at).getTime() : 0,
    },
    created_by_name: {
      render: (item) => (
        <span className="text-muted-foreground">
          {item.created_by_name ?? "—"}
        </span>
      ),
      csvValue: (item) => item.created_by_name ?? "",
      sortValue: (item) => item.created_by_name ?? "",
    },
  };

  return commitmentColumns.map((c) => ({ ...col(c.id), ...renderers[c.id] }));
}

export function renderCommitmentRowActions(
  item: CommitmentListItem,
  onEdit: (commitment: CommitmentListItem) => void,
  onDelete: (commitment: CommitmentListItem) => void,
): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Row actions"
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(item)}>Edit</DropdownMenuItem>
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

export function renderCommitmentCard(
  item: CommitmentListItem,
  onClick: (commitment: CommitmentListItem) => void,
): ReactElement {
  const billedPct = Math.max(0, Math.min(100, Math.round(item.percent_paid)));

  return (
    <div
      className="group flex cursor-pointer flex-col rounded-lg border border-border bg-background shadow-xs transition-all duration-200 hover:-translate-y-px hover:border-foreground/20 hover:shadow-sm"
      onClick={() => onClick(item)}
    >
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {item.number}
          </span>
          <StatusBadge status={statusLabel(item.status)} />
        </div>

        <p className="mt-2.5 line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
          {item.title ?? "Untitled Commitment"}
        </p>

        <p className="mt-1 truncate text-[13px] italic text-muted-foreground/80">
          {item.contract_company?.name ?? "No company assigned"}
        </p>
      </div>

      <div className="flex items-end justify-between rounded-b-lg bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">
            Contract value
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(item.revised_contract_amount)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-medium text-muted-foreground">
            Billed
          </p>
          <p className="mt-0.5 text-[13px] font-medium tabular-nums text-foreground">
            {billedPct}%
          </p>
        </div>
      </div>
    </div>
  );
}

export function renderCommitmentList(
  item: CommitmentListItem,
  onClick: (commitment: CommitmentListItem) => void,
): ReactElement {
  return (
    <div
      className="flex items-center justify-between py-2 px-4 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onClick(item)}
    >
      <div>
        <p className="text-sm font-medium">{item.number}</p>
        <p className="text-xs text-muted-foreground">
          {item.title ?? "Untitled"}
        </p>
      </div>
      <StatusBadge status={statusLabel(item.status)} />
    </div>
  );
}
