import { ArrowRight, Eye, MoreVertical, Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import { formatDate } from "@/lib/format";

import { StatusBadge } from "@/components/ds";
import type {
  ColumnConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ── Types ──────────────────────────────────────────────────────── */

export interface CommitmentPco {
  id: string;
  project_id: number;
  commitment_id: string;
  commitment_type: "subcontract" | "purchase_order";
  pco_number: string;
  title: string;
  status: "draft" | "pending" | "approved" | "void";
  description: string | null;
  total_amount: number;
  schedule_impact: number | null;
  created_at: string;
  promoted_to_co_id: string | null;
  linked_change_events_count?: number;
  commitment?: {
    contract_number: string | null;
    title: string | null;
    vendor_name: string | null;
  } | null;
}

export interface CommitmentPcoDetail extends CommitmentPco {
  linked_change_events: Array<{
    id: string;
    number: string | null;
    title: string | null;
    status: string | null;
    type: string | null;
    total_revenue_rom: number | null;
    total_cost_rom: number | null;
    linked_at: string | null;
    linked_by: string | null;
  }>;
  promoted_co: {
    id: string;
    change_order_number: string;
    title: string;
    status: string;
    amount: number;
  } | null;
}

/* ── Filter options ──────────────────────────────────────────────── */

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "void", label: "Void" },
];

const TYPE_OPTIONS = [
  { value: "subcontract", label: "Subcontract" },
  { value: "purchase_order", label: "Purchase Order" },
];

/* ── Column definitions ──────────────────────────────────────────── */

export const pcoColumns: ColumnConfig[] = [
  { id: "pco_number", label: "PCO #", alwaysVisible: true },
  { id: "title", label: "Title", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "commitment_name", label: "Commitment", defaultVisible: true },
  { id: "commitment_type", label: "Type", defaultVisible: true },
  { id: "total_amount", label: "Amount", defaultVisible: true },
  { id: "source_ces", label: "Source CEs", defaultVisible: true },
  { id: "created_at", label: "Created", defaultVisible: true },
];

export const pcoDefaultVisibleColumns = pcoColumns
  .filter((col) => col.defaultVisible !== false)
  .map((col) => col.id);

/* ── Filter definitions ──────────────────────────────────────────── */

export const pcoFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: STATUS_OPTIONS,
  },
  {
    id: "commitment_type",
    label: "Type",
    type: "select",
    options: TYPE_OPTIONS,
  },
];

/* ── Helpers ──────────────────────────────────────────────────────── */

function statusLabel(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "draft":
      return "Draft";
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "void":
      return "Void";
    default:
      return status || "-";
  }
}

function commitmentTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "subcontract":
      return "Subcontract";
    case "purchase_order":
      return "Purchase Order";
    default:
      return type || "-";
  }
}

export function formatMoney(value: number | string | null | undefined): string {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(numeric)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(numeric);
}

/* ── Table columns builder ────────────────────────────────────────── */

export function buildPcoTableColumns(): TableColumn<CommitmentPco>[] {
  return [
    {
      ...pcoColumns[0],
      render: (item) => (
        <span className="font-mono text-muted-foreground">{item.pco_number}</span>
      ),
      sortValue: (item) => item.pco_number ?? "",
    },
    {
      ...pcoColumns[1],
      render: (item) => (
        <span className="font-medium line-clamp-1">{item.title || "Untitled"}</span>
      ),
      sortValue: (item) => item.title ?? "",
    },
    {
      ...pcoColumns[2],
      render: (item) => <StatusBadge status={statusLabel(item.status)} />,
      sortValue: (item) => item.status ?? "",
    },
    {
      ...pcoColumns[3],
      render: (item) => (
        <span className="line-clamp-1">
          {item.commitment?.title || item.commitment?.contract_number || "--"}
        </span>
      ),
      sortValue: (item) => item.commitment?.title ?? "",
    },
    {
      ...pcoColumns[4],
      render: (item) => (
        <span>{commitmentTypeLabel(item.commitment_type)}</span>
      ),
      sortValue: (item) => commitmentTypeLabel(item.commitment_type),
    },
    {
      ...pcoColumns[5],
      align: "right" as const,
      render: (item) => (
        <span className="tabular-nums">{formatMoney(item.total_amount)}</span>
      ),
      sortValue: (item) => Number(item.total_amount ?? 0),
    },
    {
      ...pcoColumns[6],
      render: (item) => (
        <span className="tabular-nums">{item.linked_change_events_count ?? 0}</span>
      ),
      sortValue: (item) => item.linked_change_events_count ?? 0,
    },
    {
      ...pcoColumns[7],
      render: (item) => <span>{formatDate(item.created_at)}</span>,
      sortValue: (item) => (item.created_at ? new Date(item.created_at).getTime() : 0),
    },
  ];
}

/* ── Row actions ──────────────────────────────────────────────────── */

export function renderPcoRowActions(
  item: CommitmentPco,
  onView: (item: CommitmentPco) => void,
  onEdit: (item: CommitmentPco) => void, // reserved — edit form not yet implemented
  onDelete: (item: CommitmentPco) => void,
  onPromote: (item: CommitmentPco) => void,
): ReactElement {
  const canDelete = item.status === "draft";
  const canPromote =
    (item.status === "pending" || item.status === "approved") &&
    !item.promoted_to_co_id;

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onView(item)}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </DropdownMenuItem>
          {/* Edit action intentionally omitted — commitment PCO edit form is not yet
              implemented. The detail page shows a disabled "Edit" button with a
              "coming soon" tooltip. When the edit form ships, re-enable this action
              and wire handleEdit back to `/${projectId}/commitment-pcos/${id}?edit=1`. */}
          {canPromote && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onPromote(item);
                }}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Promote to CCO
              </DropdownMenuItem>
            </>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(item)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ── Card/list views ──────────────────────────────────────────────── */

export function renderPcoCard(
  item: CommitmentPco,
  onClick: (item: CommitmentPco) => void,
): ReactElement {
  return (
    <Button
      variant="ghost"
      className="w-full h-auto cursor-pointer rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 flex flex-col items-stretch"
      onClick={() => onClick(item)}
    >
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground">{item.pco_number}</p>
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h3 className="font-medium">{item.title || "Untitled PCO"}</h3>
        </div>
        <StatusBadge status={statusLabel(item.status)} />
      </div>
      <p className="text-sm text-muted-foreground">
        {commitmentTypeLabel(item.commitment_type)} · {formatMoney(item.total_amount)}
      </p>
    </Button>
  );
}

export function renderPcoList(
  item: CommitmentPco,
  onClick: (item: CommitmentPco) => void,
): ReactElement {
  return (
    <Button
      variant="ghost"
      className="flex w-full h-auto cursor-pointer items-center justify-between rounded-md px-4 py-2 text-left transition-colors hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div>
        <p className="text-sm font-medium">{item.pco_number}</p>
        <p className="text-xs text-muted-foreground">{item.title || "Untitled PCO"}</p>
      </div>
      <StatusBadge status={statusLabel(item.status)} />
    </Button>
  );
}

export { statusLabel, commitmentTypeLabel };
