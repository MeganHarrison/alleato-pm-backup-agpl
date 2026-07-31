"use client";

import Link from "next/link";
import { memo, useEffect, useMemo, useState } from "react";
import { FileText, Paperclip } from "lucide-react";

import {
  UnifiedTablePage,
  type FilterValue,
  type TableColumn,
  type ViewMode,
} from "@/components/tables/unified";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ds/text";
import { InvoiceStatusBadge } from "@/components/invoicing/InvoiceStatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";

interface CommitmentInvoiceRow {
  id: number;
  invoice_number: string | null;
  period_start: string | null;
  period_end: string | null;
  billing_date: string | null;
  status: string;
  is_retainage_release: boolean;
  total_completed: number;
  total_retainage: number;
  net_amount: number;
  total_contract_amount: number;
  original_contract_sum: number;
  net_change_by_cos: number;
  percent_complete: number;
  attachment_count?: number;
}

interface InvoicesTabProps {
  commitmentId: string;
  projectId: string | number;
  commitmentType: "subcontract" | "purchase_order";
}

interface EnrichedInvoice extends CommitmentInvoiceRow {
  revised_contract_sum: number;
  total_earned_less_retainage: number;
  balance_to_finish: number;
}

function formatInvoiceDates(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start ?? end);
}

function humanizeStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const DEFAULT_VISIBLE_COLUMNS = [
  "invoice_number",
  "invoice_dates",
  "billing_date",
  "status",
  "original_contract_sum",
  "net_change_by_cos",
  "revised_contract_sum",
  "total_completed",
  "total_retainage",
  "total_earned_less_retainage",
  "net_amount",
  "balance_to_finish",
  "percent_complete",
  "attachments",
];

export const InvoicesTab = memo(function InvoicesTab({
  commitmentId,
  projectId,
  commitmentType,
}: InvoicesTabProps) {
  const [invoices, setInvoices] = useState<EnrichedInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [currentView, setCurrentView] = useState<ViewMode>("table");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const filterKey =
          commitmentType === "subcontract" ? "subcontract_id" : "purchase_order_id";
        const url = `/api/projects/${projectId}/invoicing/subcontractor/invoices?${filterKey}=${encodeURIComponent(commitmentId)}`;
        const payload = await apiFetch<{ data?: CommitmentInvoiceRow[] }>(url, { signal: controller.signal });
        const rows = payload.data ?? [];

        const enriched: EnrichedInvoice[] = rows.map((row) => {
          const revised = row.total_contract_amount;
          const totalEarnedLessRetainage = row.total_completed - row.total_retainage;
          return {
            ...row,
            revised_contract_sum: revised,
            total_earned_less_retainage: totalEarnedLessRetainage,
            balance_to_finish: Math.max(revised - totalEarnedLessRetainage, 0),
          };
        });

        setInvoices(enriched);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load invoices");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [commitmentId, commitmentType, projectId]);

  const statusOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const invoice of invoices) {
      if (invoice.status && !seen.has(invoice.status)) {
        seen.set(invoice.status, humanizeStatus(invoice.status));
      }
    }
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesStatus = !statusFilter || invoice.status === statusFilter;
      const matchesSearch =
        query.length === 0 ||
        [
          invoice.invoice_number,
          `inv-${invoice.id}`,
          invoice.status,
          humanizeStatus(invoice.status),
          formatInvoiceDates(invoice.period_start, invoice.period_end),
          invoice.billing_date,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [invoices, searchQuery, statusFilter]);

  const totals = useMemo(() => {
    const sum = (key: keyof EnrichedInvoice) =>
      filteredInvoices.reduce((acc, inv) => acc + (Number(inv[key]) || 0), 0);
    const totalCompleted = sum("total_completed");
    const totalRetainage = sum("total_retainage");
    const totalEarnedLessRetainage = totalCompleted - totalRetainage;
    const revisedContractSum = sum("revised_contract_sum");
    return {
      original_contract_sum: sum("original_contract_sum"),
      net_change_by_cos: sum("net_change_by_cos"),
      revised_contract_sum: revisedContractSum,
      total_completed: totalCompleted,
      total_retainage: totalRetainage,
      total_earned_less_retainage: totalEarnedLessRetainage,
      net_amount: sum("net_amount"),
      balance_to_finish: sum("balance_to_finish"),
      percent_complete:
        revisedContractSum > 0
          ? Math.round((totalEarnedLessRetainage / revisedContractSum) * 100)
          : 0,
    };
  }, [filteredInvoices]);

  const columns = useMemo<TableColumn<EnrichedInvoice>[]>(
    () => [
      {
        id: "invoice_number",
        label: "#",
        alwaysVisible: true,
        sortable: true,
        sortValue: (invoice) => invoice.invoice_number ?? `INV-${invoice.id}`,
        render: (invoice) => (
          <div className="flex items-center gap-2">
            <Link
              href={`/${projectId}/commitments/${commitmentId}/invoices/${invoice.id}`}
              className="font-medium text-primary hover:underline"
            >
              {invoice.invoice_number || `INV-${invoice.id}`}
            </Link>
            {invoice.is_retainage_release && (
              <Badge variant="outline" className="text-xs">
                Retainage Release
              </Badge>
            )}
          </div>
        ),
        csvValue: (invoice) => invoice.invoice_number || `INV-${invoice.id}`,
        width: 180,
      },
      {
        id: "invoice_dates",
        label: "Invoice Dates",
        defaultVisible: true,
        sortable: true,
        sortValue: (invoice) =>
          invoice.period_start ? new Date(invoice.period_start).getTime() : 0,
        render: (invoice) => (
          <Text size="sm" className="whitespace-nowrap">
            {formatInvoiceDates(invoice.period_start, invoice.period_end)}
          </Text>
        ),
        csvValue: (invoice) =>
          formatInvoiceDates(invoice.period_start, invoice.period_end),
        width: 200,
      },
      {
        id: "billing_date",
        label: "Billing Date",
        defaultVisible: true,
        sortable: true,
        sortValue: (invoice) =>
          invoice.billing_date ? new Date(invoice.billing_date).getTime() : 0,
        render: (invoice) => (
          <Text size="sm" className="whitespace-nowrap">
            {formatDate(invoice.billing_date)}
          </Text>
        ),
        csvValue: (invoice) => invoice.billing_date ?? "",
        width: 150,
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        sortable: true,
        sortValue: (invoice) => invoice.status,
        render: (invoice) => <InvoiceStatusBadge status={invoice.status} />,
        csvValue: (invoice) => humanizeStatus(invoice.status),
        width: 160,
      },
      {
        id: "original_contract_sum",
        label: "Original Contract Sum",
        defaultVisible: true,
        sortable: true,
        align: "right",
        sortValue: (invoice) => invoice.original_contract_sum,
        render: (invoice) => (
          <span className="block text-right tabular-nums">
            {formatCurrency(invoice.original_contract_sum)}
          </span>
        ),
        csvValue: (invoice) => String(invoice.original_contract_sum ?? 0),
        width: 170,
      },
      {
        id: "net_change_by_cos",
        label: "Net Change by COs",
        defaultVisible: true,
        sortable: true,
        align: "right",
        sortValue: (invoice) => invoice.net_change_by_cos,
        render: (invoice) => (
          <span className="block text-right tabular-nums">
            {formatCurrency(invoice.net_change_by_cos)}
          </span>
        ),
        csvValue: (invoice) => String(invoice.net_change_by_cos ?? 0),
        width: 160,
      },
      {
        id: "revised_contract_sum",
        label: "Revised Contract Sum",
        defaultVisible: true,
        sortable: true,
        align: "right",
        sortValue: (invoice) => invoice.revised_contract_sum,
        render: (invoice) => (
          <span className="block text-right font-medium tabular-nums">
            {formatCurrency(invoice.revised_contract_sum)}
          </span>
        ),
        csvValue: (invoice) => String(invoice.revised_contract_sum ?? 0),
        width: 170,
      },
      {
        id: "total_completed",
        label: "Total Completed & Stored",
        defaultVisible: true,
        sortable: true,
        align: "right",
        sortValue: (invoice) => invoice.total_completed,
        render: (invoice) => (
          <span className="block text-right tabular-nums">
            {formatCurrency(invoice.total_completed)}
          </span>
        ),
        csvValue: (invoice) => String(invoice.total_completed ?? 0),
        width: 190,
      },
      {
        id: "total_retainage",
        label: "Total Retainage",
        defaultVisible: true,
        sortable: true,
        align: "right",
        sortValue: (invoice) => invoice.total_retainage,
        render: (invoice) => (
          <span className="block text-right tabular-nums">
            {formatCurrency(invoice.total_retainage)}
          </span>
        ),
        csvValue: (invoice) => String(invoice.total_retainage ?? 0),
        width: 150,
      },
      {
        id: "total_earned_less_retainage",
        label: "Total Earned Less Retainage",
        defaultVisible: true,
        sortable: true,
        align: "right",
        sortValue: (invoice) => invoice.total_earned_less_retainage,
        render: (invoice) => (
          <span className="block text-right font-medium tabular-nums">
            {formatCurrency(invoice.total_earned_less_retainage)}
          </span>
        ),
        csvValue: (invoice) => String(invoice.total_earned_less_retainage ?? 0),
        width: 200,
      },
      {
        id: "net_amount",
        label: "Payment Due",
        defaultVisible: true,
        sortable: true,
        align: "right",
        sortValue: (invoice) => invoice.net_amount,
        render: (invoice) => (
          <span className="block text-right font-medium tabular-nums">
            {formatCurrency(invoice.net_amount)}
          </span>
        ),
        csvValue: (invoice) => String(invoice.net_amount ?? 0),
        width: 140,
      },
      {
        id: "balance_to_finish",
        label: "Balance to Finish",
        defaultVisible: true,
        sortable: true,
        align: "right",
        sortValue: (invoice) => invoice.balance_to_finish,
        render: (invoice) => (
          <span className="block text-right tabular-nums">
            {formatCurrency(invoice.balance_to_finish)}
          </span>
        ),
        csvValue: (invoice) => String(invoice.balance_to_finish ?? 0),
        width: 160,
      },
      {
        id: "percent_complete",
        label: "% Complete",
        defaultVisible: true,
        sortable: true,
        align: "right",
        sortValue: (invoice) => invoice.percent_complete,
        render: (invoice) => (
          <span className="block text-right tabular-nums">
            {`${Math.round(invoice.percent_complete || 0)}%`}
          </span>
        ),
        csvValue: (invoice) => `${Math.round(invoice.percent_complete || 0)}%`,
        width: 120,
      },
      {
        id: "attachments",
        label: "Attachments",
        defaultVisible: true,
        sortable: false,
        align: "center",
        render: (invoice) => (
          <div className="flex items-center justify-center text-muted-foreground">
            <Paperclip className="h-4 w-4" />
            {invoice.attachment_count ? (
              <span className="ml-1 text-xs">{invoice.attachment_count}</span>
            ) : null}
          </div>
        ),
        csvValue: (invoice) => String(invoice.attachment_count ?? 0),
        width: 120,
      },
    ],
    [projectId, commitmentId],
  );

  const filters = useMemo(
    () => [
      {
        id: "status",
        label: "Status",
        type: "select" as const,
        options: statusOptions,
      },
    ],
    [statusOptions],
  );

  const isFiltered = Boolean(searchQuery) || Boolean(statusFilter);

  if (error) {
    return <Text tone="destructive">{error}</Text>;
  }

  return (
    <UnifiedTablePage<EnrichedInvoice>
      header={{
        title: "Invoices",
        description: "Pay applications submitted against this contract.",
        variant: "compact",
      }}
      toolbar={{
        totalItems: invoices.length,
        filteredItems: filteredInvoices.length,
        searchValue: searchQuery,
        onSearchChange: setSearchQuery,
        searchPlaceholder: "Search invoices…",
        currentView,
        onViewChange: (view) => {
          if (view === "table") setCurrentView(view);
        },
        enabledViews: ["table"],
        filters,
        activeFilters: { status: statusFilter } as Record<string, FilterValue>,
        onFilterChange: (next) =>
          setStatusFilter(
            typeof next.status === "string" ? next.status : undefined,
          ),
        onClearFilters: () => {
          setStatusFilter(undefined);
          setSearchQuery("");
        },
        columns: columns.map((column) => ({
          id: column.id,
          label: column.label,
          defaultVisible: column.defaultVisible ?? true,
          alwaysVisible: column.id === "invoice_number",
        })),
      }}
      data={{ items: filteredInvoices, isLoading, error: null }}
      table={{
        columns,
        getRowId: (invoice) => String(invoice.id),
        density: "compact",
        stickyHeader: true,
      }}
      footerTotals={{
        label: "Totals",
        values: {
          original_contract_sum: formatCurrency(totals.original_contract_sum),
          net_change_by_cos: formatCurrency(totals.net_change_by_cos),
          revised_contract_sum: formatCurrency(totals.revised_contract_sum),
          total_completed: formatCurrency(totals.total_completed),
          total_retainage: formatCurrency(totals.total_retainage),
          total_earned_less_retainage: formatCurrency(
            totals.total_earned_less_retainage,
          ),
          net_amount: formatCurrency(totals.net_amount),
          balance_to_finish: formatCurrency(totals.balance_to_finish),
          percent_complete: `${totals.percent_complete}%`,
        },
      }}
      emptyState={{
        icon: <FileText className="h-8 w-8" />,
        title: "No invoices yet",
        description:
          "Invoices submitted against this contract will appear here. Use the Create menu above to add one.",
        filteredDescription: "No invoices match the current search or filters.",
        isFiltered,
      }}
      features={{
        enableViews: false,
        enableSearch: true,
        enableFilters: true,
        enableSorting: true,
        enableColumnToggle: true,
        enableExport: true,
        enablePagination: true,
        enableRowSelection: false,
        enableBulkDelete: false,
        enableRowActions: false,
      }}
      layout={{
        containerPadding: false,
        minWidth: 1360,
      }}
    />
  );
});

InvoicesTab.displayName = "InvoicesTab";
