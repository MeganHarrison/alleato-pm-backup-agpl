import type { ReactElement } from "react";
import { Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { formatDate } from "@/lib/format";

import type {
  ColumnConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";
import { TruncatedCell } from "@/components/tables/unified";
import { StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrimeContractCO {
  id: number;
  pcco_number: string | null;
  title: string | null;
  status: string | null;
  total_amount: number | null;
  contract_id: string | null;
  prime_contract_id: string | null;
  executed: boolean;
  revision: number | null;
  contract_company: string | null;
  change_reason: string | null;
  due_date: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string | null;
  project_id: number | null;
  designated_reviewer: string | null;
  review_date: string | null;
}

export interface CommitmentCO {
  id: string;
  change_order_number: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  amount: number | null;
  contract_id: string | null;
  contract_type: string | null;
  change_reason: string | null;
  requested_by: string | null;
  requested_date: string | null;
  approved_by: string | null;
  approved_date: string | null;
  rejection_reason: string | null;
  due_date: string | null;
  designated_reviewer: string | null;
  created_at: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return "-";
  if (status === "submitted") return "Pending";
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

// ---------------------------------------------------------------------------
// Prime Contract CO — columns & config
// ---------------------------------------------------------------------------

export const primeColumns: ColumnConfig[] = [
  { id: "pcco_number", label: "#", alwaysVisible: true },
  { id: "title", label: "Title", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "amount", label: "Amount", defaultVisible: true },
  { id: "revision", label: "Revision", defaultVisible: false },
  { id: "contract_company", label: "Contract Company", defaultVisible: true },
  { id: "change_reason", label: "Change Reason", defaultVisible: true },
  { id: "due_date", label: "Due Date", defaultVisible: false },
  { id: "executed", label: "Executed" },
  { id: "designated_reviewer", label: "Designated Reviewer", defaultVisible: false },
  { id: "review_date", label: "Review Date", defaultVisible: false },
  { id: "submitted_at", label: "Submitted", defaultVisible: false },
  { id: "created_at", label: "Created", defaultVisible: true },
];

export const primeDefaultVisibleColumns = primeColumns
  .filter((c) => c.defaultVisible !== false)
  .map((c) => c.id);

export function buildPrimeTableColumns(): TableColumn<PrimeContractCO>[] {
  const col = (id: string): ColumnConfig => {
    const found = primeColumns.find((c) => c.id === id);
    if (!found) throw new Error(`Column config not found: ${id}`);
    return found;
  };
  return [
    {
      ...col("pcco_number"),
      width: 80,
      render: (item) => <span className="font-medium">{item.pcco_number || "-"}</span>,
      sortValue: (item) => item.pcco_number ?? "",
    },
    {
      ...col("title"),
      width: 320,
      render: (item) => <TruncatedCell value={item.title} maxWidth={320} />,
      sortValue: (item) => item.title ?? "",
    },
    {
      ...col("status"),
      width: 120,
      render: (item) => <StatusBadge status={statusLabel(item.status)} />,
      sortValue: (item) => item.status ?? "",
    },
    {
      ...col("amount"),
      align: "right" as const,
      width: 130,
      render: (item) => (
        <span className="tabular-nums">{formatCurrency(item.total_amount)}</span>
      ),
      sortValue: (item) => item.total_amount ?? 0,
    },
    {
      ...col("revision"),
      width: 90,
      render: (item) => (
        <span className="text-muted-foreground">{item.revision ?? "-"}</span>
      ),
      sortValue: (item) => item.revision ?? 0,
    },
    {
      ...col("contract_company"),
      width: 180,
      render: (item) => (
        <TruncatedCell value={item.contract_company} maxWidth={180} />
      ),
      sortValue: (item) => item.contract_company ?? "",
    },
    {
      ...col("change_reason"),
      width: 160,
      render: (item) => (
        <TruncatedCell value={item.change_reason} maxWidth={160} />
      ),
      sortValue: (item) => item.change_reason ?? "",
    },
    {
      ...col("due_date"),
      width: 120,
      render: (item) => (
        <span className="text-muted-foreground">{formatDate(item.due_date)}</span>
      ),
      sortValue: (item) => (item.due_date ? new Date(item.due_date).getTime() : 0),
    },
    {
      ...col("executed"),
      width: 100,
      render: (item) =>
        item.executed ? (
          <span className="text-success">Yes</span>
        ) : (
          <span className="text-muted-foreground">No</span>
        ),
      sortValue: (item) => (item.executed ? 1 : 0),
    },
    {
      ...col("designated_reviewer"),
      width: 160,
      render: (item) => (
        <span className="text-muted-foreground">{item.designated_reviewer || "-"}</span>
      ),
      sortValue: (item) => item.designated_reviewer ?? "",
    },
    {
      ...col("review_date"),
      width: 120,
      render: (item) => (
        <span className="text-muted-foreground">{formatDate(item.review_date)}</span>
      ),
      sortValue: (item) => (item.review_date ? new Date(item.review_date).getTime() : 0),
    },
    {
      ...col("submitted_at"),
      width: 120,
      render: (item) => (
        <span className="text-muted-foreground">{formatDate(item.submitted_at)}</span>
      ),
      sortValue: (item) =>
        item.submitted_at ? new Date(item.submitted_at).getTime() : 0,
    },
    {
      ...col("created_at"),
      width: 120,
      render: (item) => (
        <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
      ),
      sortValue: (item) => (item.created_at ? new Date(item.created_at).getTime() : 0),
    },
  ];
}

export function buildPrimeFilters(): FilterConfig[] {
  return [
    {
      id: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "draft", label: "Draft" },
        { value: "proposed", label: "Proposed" },
        { value: "out_for_signature", label: "Out for Signature" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
        { value: "executed", label: "Executed" },
        { value: "void", label: "Void" },
      ],
    },
    {
      id: "executed",
      label: "Executed",
      type: "select",
      options: [
        { value: "yes", label: "Executed" },
        { value: "no", label: "Not Executed" },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Commitment CO — columns & config
// ---------------------------------------------------------------------------

export const commitmentColumns: ColumnConfig[] = [
  { id: "change_order_number", label: "#", alwaysVisible: true },
  { id: "title", label: "Title", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "amount", label: "Amount", defaultVisible: true },
  { id: "contract_type", label: "Contract Type", defaultVisible: true },
  { id: "change_reason", label: "Change Reason", defaultVisible: true },
  { id: "due_date", label: "Due Date", defaultVisible: false },
  { id: "designated_reviewer", label: "Designated Reviewer", defaultVisible: false },
  { id: "requested_date", label: "Requested Date", defaultVisible: true },
  { id: "approved_date", label: "Approved Date", defaultVisible: false },
  { id: "created_at", label: "Created", defaultVisible: true },
];

export const commitmentDefaultVisibleColumns = commitmentColumns
  .filter((c) => c.defaultVisible !== false)
  .map((c) => c.id);

export function buildCommitmentTableColumns(): TableColumn<CommitmentCO>[] {
  const col = (id: string): ColumnConfig => {
    const found = commitmentColumns.find((c) => c.id === id);
    if (!found) throw new Error(`Column config not found: ${id}`);
    return found;
  };
  return [
    {
      ...col("change_order_number"),
      width: 80,
      render: (item) => (
        <span className="font-medium">{item.change_order_number || "-"}</span>
      ),
      sortValue: (item) => item.change_order_number ?? "",
    },
    {
      ...col("title"),
      width: 320,
      render: (item) => <TruncatedCell value={item.title || item.description} maxWidth={320} />,
      sortValue: (item) => item.title ?? item.description ?? "",
    },
    {
      ...col("status"),
      width: 120,
      render: (item) => <StatusBadge status={statusLabel(item.status)} />,
      sortValue: (item) => item.status ?? "",
    },
    {
      ...col("amount"),
      align: "right" as const,
      width: 130,
      render: (item) => (
        <span className="tabular-nums">{formatCurrency(item.amount)}</span>
      ),
      sortValue: (item) => item.amount ?? 0,
    },
    {
      ...col("contract_type"),
      width: 140,
      render: (item) => (
        <span className="text-muted-foreground">
          {item.contract_type
            ? item.contract_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : "-"}
        </span>
      ),
      sortValue: (item) => item.contract_type ?? "",
    },
    {
      ...col("change_reason"),
      width: 160,
      render: (item) => (
        <TruncatedCell value={item.change_reason} maxWidth={160} />
      ),
      sortValue: (item) => item.change_reason ?? "",
    },
    {
      ...col("due_date"),
      width: 120,
      render: (item) => (
        <span className="text-muted-foreground">{formatDate(item.due_date)}</span>
      ),
      sortValue: (item) => (item.due_date ? new Date(item.due_date).getTime() : 0),
    },
    {
      ...col("designated_reviewer"),
      width: 160,
      render: (item) => (
        <span className="text-muted-foreground">{item.designated_reviewer || "-"}</span>
      ),
      sortValue: (item) => item.designated_reviewer ?? "",
    },
    {
      ...col("requested_date"),
      width: 130,
      render: (item) => (
        <span className="text-muted-foreground">{formatDate(item.requested_date)}</span>
      ),
      sortValue: (item) =>
        item.requested_date ? new Date(item.requested_date).getTime() : 0,
    },
    {
      ...col("approved_date"),
      width: 130,
      render: (item) => (
        <span className="text-muted-foreground">{formatDate(item.approved_date)}</span>
      ),
      sortValue: (item) =>
        item.approved_date ? new Date(item.approved_date).getTime() : 0,
    },
    {
      ...col("created_at"),
      width: 120,
      render: (item) => (
        <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
      ),
      sortValue: (item) => (item.created_at ? new Date(item.created_at).getTime() : 0),
    },
  ];
}

export function buildCommitmentFilters(): FilterConfig[] {
  return [
    {
      id: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "draft", label: "Draft" },
        { value: "pending", label: "Pending" },
        { value: "out_for_signature", label: "Out for Signature" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
        { value: "executed", label: "Executed" },
        { value: "void", label: "Void" },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Shared row actions
// ---------------------------------------------------------------------------

export function renderRowActions<T>(
  item: T,
  onView: (item: T) => void,
  onEdit: (item: T) => void,
  onDelete: (item: T) => void,
): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Row actions">
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(item)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(item)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(item)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Card & list renderers
// ---------------------------------------------------------------------------

export function renderPrimeCard(
  item: PrimeContractCO,
  onClick: (item: PrimeContractCO) => void,
): ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full max-w-sm justify-self-center flex-col items-stretch gap-0 whitespace-normal rounded-lg border p-4 text-left hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.pcco_number || "-"}
          </p>
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h3 className="mt-0.5 line-clamp-2 font-medium text-foreground">
            {item.title || "Untitled"}
          </h3>
        </div>
        <StatusBadge status={statusLabel(item.status)} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <dt className="text-xs text-muted-foreground">Amount</dt>
          <dd className="tabular-nums font-medium text-foreground">
            {formatCurrency(item.total_amount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Executed</dt>
          <dd className="text-sm text-foreground">{item.executed ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Due</dt>
          <dd className="text-sm text-foreground">{formatDate(item.due_date)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Approved</dt>
          <dd className="text-sm text-foreground">{formatDate(item.approved_at)}</dd>
        </div>
      </dl>
    </Button>
  );
}

export function renderPrimeList(
  item: PrimeContractCO,
  onClick: (item: PrimeContractCO) => void,
): ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto flex w-full items-center justify-between rounded-md px-4 py-2 text-left hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.pcco_number || "-"}</p>
        <p className="truncate text-xs text-muted-foreground">{item.title || "Untitled"}</p>
      </div>
      <div className="ml-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{formatCurrency(item.total_amount)}</span>
        <StatusBadge status={statusLabel(item.status)} />
      </div>
    </Button>
  );
}

export function renderCommitmentCard(
  item: CommitmentCO,
  onClick: (item: CommitmentCO) => void,
): ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full max-w-sm justify-self-center flex-col items-stretch gap-0 whitespace-normal rounded-lg border p-4 text-left hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.change_order_number || "-"}
          </p>
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h3 className="mt-0.5 line-clamp-2 font-medium text-foreground">
            {item.title || item.description || "Untitled"}
          </h3>
        </div>
        <StatusBadge status={statusLabel(item.status)} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <dt className="text-xs text-muted-foreground">Amount</dt>
          <dd className="tabular-nums font-medium text-foreground">
            {formatCurrency(item.amount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Type</dt>
          <dd className="text-sm text-foreground">
            {item.contract_type
              ? item.contract_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Due</dt>
          <dd className="text-sm text-foreground">{formatDate(item.due_date)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Approved</dt>
          <dd className="text-sm text-foreground">{formatDate(item.approved_date)}</dd>
        </div>
      </dl>
    </Button>
  );
}

export function renderCommitmentList(
  item: CommitmentCO,
  onClick: (item: CommitmentCO) => void,
): ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto flex w-full items-center justify-between rounded-md px-4 py-2 text-left hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.change_order_number || "-"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.title || item.description || "Untitled"}
        </p>
      </div>
      <div className="ml-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{formatCurrency(item.amount)}</span>
        <StatusBadge status={statusLabel(item.status)} />
      </div>
    </Button>
  );
}
