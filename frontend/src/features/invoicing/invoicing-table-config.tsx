import * as React from "react";
import type { ReactElement } from "react";
import { Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { buildAcumaticaArInvoiceHref } from "@/lib/acumatica/ar-invoice-url";

import type {
  ColumnConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InvoiceStatusBadge,
  type InvoiceStatus,
} from "@/components/invoicing/InvoiceStatusBadge";

// =============================================================================
// Types
// =============================================================================

export interface OwnerInvoiceLineItem {
  id: number;
  invoice_id: number;
  description: string | null;
  category: string | null;
  approved_amount: number | null;
  // SOV fields
  scheduled_value: number;
  work_completed_previous: number;
  work_completed_period: number;
  materials_stored: number;
  retainage_pct: number;
  retainage_released: number;
  retainage_amount: number;
  total_completed_stored: number | null;
  net_amount_this_period: number | null;
  balance_to_finish: number | null;
  work_completed_pct: number;
  sort_order: number;
  created_at: string | null;
  updated_at: string;
}

export interface OwnerInvoice {
  id: number;
  prime_contract_id: string;
  invoice_number: string | null;
  period_start: string | null;
  period_end: string | null;
  billing_date: string | null;
  due_date: string | null;
  status: InvoiceStatus;
  billing_period_id: string | null;
  billing_period_name?: string | null;
  // Financial summary (computed from line items or stored)
  gross_amount: number | null;
  net_amount: number | null;
  paid_amount: number | null;
  percent_complete: number | null;
  total_amount?: number;
  // Contract join fields
  contract_number?: string | null;
  contract_title?: string | null;
  total_contract_amount?: number | null;
  // Vendor/company
  vendor_name?: string | null;
  // ERP sync
  acumatica_ref_nbr?: string | null;
  acumatica_doc_type?: string | null;
  // Retention (stored as percentage, e.g. 5.0 = 5%)
  contract_retention_percentage?: number | null;
  // Change orders (computed from prime_contract_change_orders vs invoice period)
  previous_changes?: number | null;
  current_changes?: number | null;
  // Payment status (computed from invoice_payments)
  total_paid?: number | null;
  payment_status?: "unpaid" | "partially_paid" | "paid" | null;
  // Notes
  notes?: string | null;
  // Line items (joined)
  owner_invoice_line_items?: OwnerInvoiceLineItem[];
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Helpers
// =============================================================================

// re-exported from @/lib/format for callers that import them from here
export { formatCurrency, formatDate };

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0%";
  return `${Math.round(value)}%`;
}

// =============================================================================
// Column Config (for column toggle visibility)
// =============================================================================

export const invoiceColumns: ColumnConfig[] = [
  { id: "invoice_number", label: "Invoice #", alwaysVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "vendor_name", label: "Company", defaultVisible: true },
  { id: "billing_period", label: "Billing Period", defaultVisible: true },
  { id: "gross_amount", label: "Gross Amount", defaultVisible: true },
  { id: "net_amount", label: "Net Amount", defaultVisible: true },
  { id: "previous_changes", label: "Previous Changes", defaultVisible: false },
  { id: "current_changes", label: "Current Changes", defaultVisible: false },
  { id: "payment_status", label: "Payment Status", defaultVisible: true },
  { id: "paid_amount", label: "Paid Amount", defaultVisible: true },
  { id: "invoice_dates", label: "Invoice Dates", defaultVisible: true },
  { id: "contract", label: "Contract", defaultVisible: true },
  { id: "total_contract_amount", label: "Total Contract Amount", defaultVisible: false },
  { id: "percent_complete", label: "% Complete", defaultVisible: true },
  { id: "erp_status", label: "ERP Status", defaultVisible: false },
];

export const invoiceDefaultVisibleColumns = invoiceColumns
  .filter((c) => c.defaultVisible !== false || c.alwaysVisible)
  .map((c) => c.id);

// =============================================================================
// Filter Config
// =============================================================================

export const invoiceFilters: FilterConfig[] = [
  {
    id: "billing_period_id",
    label: "Billing Period",
    type: "select",
    options: [], // populated dynamically from billing periods API
  },
  {
    id: "prime_contract_id",
    label: "Prime Contract",
    type: "select",
    options: [], // populated dynamically from prime contracts API
  },
];

// =============================================================================
// Table Columns (UnifiedTablePage format) — 11 Procore-spec columns
// =============================================================================

export function buildInvoiceTableColumns(
  onView: (invoice: OwnerInvoice) => void,
  onEdit: (invoice: OwnerInvoice) => void,
): TableColumn<OwnerInvoice>[] {
  return [
    {
      id: "invoice_number",
      label: "Invoice #",
      alwaysVisible: true,
      render: (invoice) => (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 font-medium text-foreground hover:text-foreground hover:underline"
          onClick={() => onView(invoice)}
        >
          {invoice.invoice_number || `INV-${invoice.id}`}
        </Button>
      ),
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: true,
      render: (invoice) => <InvoiceStatusBadge status={invoice.status} />,
    },
    {
      id: "vendor_name",
      label: "Company",
      defaultVisible: true,
      render: (invoice) => (
        <span className="text-sm">
          {invoice.vendor_name ?? <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      id: "billing_period",
      label: "Billing Period",
      defaultVisible: true,
      render: (invoice) => {
        if (invoice.billing_period_name) {
          return <span className="text-sm">{invoice.billing_period_name}</span>;
        }
        const start = invoice.period_start;
        const end = invoice.period_end;
        if (!start && !end) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-sm">
            {formatDate(start)} – {formatDate(end)}
          </span>
        );
      },
    },
    {
      id: "gross_amount",
      label: "Gross Amount",
      defaultVisible: true,
      align: "right" as const,
      render: (invoice) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(invoice.gross_amount ?? invoice.total_amount)}
        </span>
      ),
      sortable: true,
      sortValue: (invoice) => invoice.gross_amount ?? invoice.total_amount ?? 0,
    },
    {
      id: "net_amount",
      label: "Net Amount",
      defaultVisible: true,
      align: "right" as const,
      render: (invoice) => (
        <span className="tabular-nums">
          {formatCurrency(invoice.net_amount)}
        </span>
      ),
      sortable: true,
      sortValue: (invoice) => invoice.net_amount ?? 0,
    },
    {
      id: "previous_changes",
      label: "Previous Changes",
      defaultVisible: false,
      align: "right" as const,
      render: (invoice) => (
        <span className="tabular-nums">
          {formatCurrency(invoice.previous_changes ?? 0)}
        </span>
      ),
      sortable: true,
      sortValue: (invoice) => invoice.previous_changes ?? 0,
    },
    {
      id: "current_changes",
      label: "Current Changes",
      defaultVisible: false,
      align: "right" as const,
      render: (invoice) => (
        <span className="tabular-nums">
          {formatCurrency(invoice.current_changes ?? 0)}
        </span>
      ),
      sortable: true,
      sortValue: (invoice) => invoice.current_changes ?? 0,
    },
    {
      id: "payment_status",
      label: "Payment Status",
      defaultVisible: true,
      render: (invoice) => {
        const status = invoice.payment_status ?? "unpaid";
        if (status === "paid") {
          return <Badge variant="success">Paid</Badge>;
        }
        if (status === "partially_paid") {
          return <Badge variant="default">Partial</Badge>;
        }
        return <Badge variant="secondary">Unpaid</Badge>;
      },
      sortable: true,
      sortValue: (invoice) => {
        const s = invoice.payment_status ?? "unpaid";
        return s === "paid" ? 2 : s === "partially_paid" ? 1 : 0;
      },
    },
    {
      id: "paid_amount",
      label: "Paid Amount",
      defaultVisible: true,
      align: "right" as const,
      render: (invoice) => (
        <span className="tabular-nums">
          {formatCurrency(invoice.paid_amount)}
        </span>
      ),
      sortable: true,
      sortValue: (invoice) => invoice.paid_amount ?? 0,
    },
    {
      id: "invoice_dates",
      label: "Invoice Dates",
      defaultVisible: true,
      render: (invoice) => {
        const billing = invoice.billing_date;
        const due = invoice.due_date;
        if (!billing && !due) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="text-sm space-y-0.5">
            {billing && <div className="text-muted-foreground text-xs">Billing: {formatDate(billing)}</div>}
            {due && <div className="text-muted-foreground text-xs">Due: {formatDate(due)}</div>}
          </div>
        );
      },
    },
    {
      id: "contract",
      label: "Contract",
      defaultVisible: true,
      render: (invoice) => {
        const number = invoice.contract_number ?? invoice.prime_contract_id ?? null;
        const title = invoice.contract_title ?? null;
        // Single line: prefer the contract number; only append the title when it
        // adds information (i.e. it isn't just a repeat of the number).
        const label = number ?? title;
        const suffix = title && title !== number ? title : null;
        if (!label) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-sm">
            {label}
            {suffix ? <span className="text-muted-foreground"> — {suffix}</span> : null}
          </span>
        );
      },
    },
    {
      id: "total_contract_amount",
      label: "Total Contract Amount",
      defaultVisible: false,
      align: "right" as const,
      render: (invoice) => (
        <span className="tabular-nums">
          {formatCurrency(invoice.total_contract_amount)}
        </span>
      ),
      sortable: true,
      sortValue: (invoice) => invoice.total_contract_amount ?? 0,
    },
    {
      id: "percent_complete",
      label: "% Complete",
      defaultVisible: true,
      render: (invoice) => (
        <span className="tabular-nums text-sm">
          {formatPercent(invoice.percent_complete)}
        </span>
      ),
      sortable: true,
      sortValue: (invoice) => invoice.percent_complete ?? 0,
    },
    {
      id: "erp_status",
      label: "ERP Status",
      defaultVisible: false,
      render: (invoice) => {
        const ref = invoice.acumatica_ref_nbr;
        if (!ref) return null;
        return (
          <a
            href={buildAcumaticaArInvoiceHref(ref, invoice.acumatica_doc_type)}
            target="_blank"
            rel="noopener noreferrer"
            className="tabular-nums text-sm text-primary underline-offset-4 hover:underline"
          >
            {ref}
          </a>
        );
      },
    },
  ];
}

// =============================================================================
// Row Actions
// =============================================================================

export function renderInvoiceRowActions(
  invoice: OwnerInvoice,
  onView: (invoice: OwnerInvoice) => void,
  onEdit: (invoice: OwnerInvoice) => void,
  onDelete: (invoice: OwnerInvoice) => void,
): ReactElement {
  const isDeletable =
    invoice.status !== "approved" &&
    invoice.status !== "approved_as_noted" &&
    invoice.status !== "paid" &&
    invoice.status !== "void";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Row actions">
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(invoice)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(invoice)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(invoice)}
          disabled={!isDeletable}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================================================
// Card View Renderer
// =============================================================================

export function renderInvoiceCard(invoice: OwnerInvoice): ReactElement {
  return (
    <div className="p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-sm">
            {invoice.invoice_number || `INV-${invoice.id}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {invoice.contract_number ?? invoice.prime_contract_id}
          </p>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground">Gross Amount</span>
        <span className="text-sm font-medium tabular-nums">
          {formatCurrency(invoice.gross_amount ?? invoice.total_amount)}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// List View Renderer
// =============================================================================

export function renderInvoiceList(invoice: OwnerInvoice): ReactElement {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div>
          <p className="font-medium text-sm">
            {invoice.invoice_number || `INV-${invoice.id}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {invoice.contract_number ?? invoice.prime_contract_id}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <InvoiceStatusBadge status={invoice.status} />
        <span className="text-sm font-medium tabular-nums w-24 text-right">
          {formatCurrency(invoice.gross_amount ?? invoice.total_amount)}
        </span>
      </div>
    </div>
  );
}
