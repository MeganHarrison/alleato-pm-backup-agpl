"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";

import {
  UnifiedTablePage,
  type TableColumn,
  type ViewMode,
} from "@/components/tables/unified";
import { EmptyState } from "@/components/ds/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ds/text";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/format";

interface CommitmentPaymentRow {
  id: number;
  subcontractor_invoice_id: number | null;
  payment_number: string | null;
  payment_ref: string | null;
  payment_method: string | null;
  payment_date: string | null;
  vendor_name: string | null;
  amount: number;
  status: string | null;
  acumatica_sync_at: string | null;
  subcontractor_invoice?: { id: number; invoice_number: string | null } | null;
}

interface PaymentsIssuedTabProps {
  commitmentId: string;
  projectId: string | number;
  commitmentType: "subcontract" | "purchase_order";
}

function formatMethod(method: string | null): string {
  if (!method) return "--";
  return method.replace(/_/g, " ");
}

export const PaymentsIssuedTab = memo(function PaymentsIssuedTab({
  commitmentId,
  projectId,
}: PaymentsIssuedTabProps) {
  const [payments, setPayments] = useState<CommitmentPaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentView, setCurrentView] = useState<ViewMode>("table");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const payload = await apiFetch<{
          data?: CommitmentPaymentRow[];
        }>(`/api/projects/${projectId}/commitments/${commitmentId}/payments`, {
          signal: controller.signal,
        });
        setPayments(payload.data ?? []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to load payment data",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [commitmentId, projectId]);

  const totalPaid = useMemo(
    () =>
      payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
    [payments],
  );

  const filteredPayments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return payments;

    return payments.filter((payment) =>
      [
        payment.payment_number,
        payment.subcontractor_invoice?.invoice_number,
        payment.subcontractor_invoice_id,
        payment.payment_date,
        payment.payment_method,
        payment.payment_ref,
        payment.vendor_name,
        payment.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [payments, searchQuery]);

  const columns: TableColumn<CommitmentPaymentRow>[] = useMemo(
    () => [
      {
        id: "payment_number",
        label: "Payment #",
        alwaysVisible: true,
        sortable: true,
        sortValue: (payment) => payment.payment_number ?? "",
        render: (payment) => (
          <span className="font-medium tabular-nums">
            {payment.payment_number ?? "--"}
          </span>
        ),
        csvValue: (payment) => payment.payment_number ?? "",
        width: 140,
      },
      {
        id: "invoice",
        label: "Invoice",
        defaultVisible: true,
        sortable: true,
        sortValue: (payment) =>
          payment.subcontractor_invoice?.invoice_number ??
          String(payment.subcontractor_invoice_id ?? ""),
        render: (payment) =>
          payment.subcontractor_invoice?.invoice_number ??
          (payment.subcontractor_invoice_id
            ? `INV-${payment.subcontractor_invoice_id}`
            : "--"),
        csvValue: (payment) =>
          payment.subcontractor_invoice?.invoice_number ??
          String(payment.subcontractor_invoice_id ?? ""),
        width: 140,
      },
      {
        id: "payment_date",
        label: "Payment Date",
        defaultVisible: true,
        sortable: true,
        sortValue: (payment) =>
          payment.payment_date ? new Date(payment.payment_date).getTime() : 0,
        render: (payment) => (
          <Text size="sm" className="whitespace-nowrap">
            {formatDate(payment.payment_date)}
          </Text>
        ),
        csvValue: (payment) => payment.payment_date ?? "",
        width: 150,
      },
      {
        id: "payment_method",
        label: "Method",
        defaultVisible: true,
        sortable: true,
        sortValue: (payment) => payment.payment_method ?? "",
        render: (payment) => (
          <span className="capitalize text-muted-foreground">
            {formatMethod(payment.payment_method)}
          </span>
        ),
        csvValue: (payment) => formatMethod(payment.payment_method),
        width: 140,
      },
      {
        id: "payment_ref",
        label: "Reference",
        defaultVisible: true,
        sortable: true,
        sortValue: (payment) => payment.payment_ref ?? "",
        render: (payment) => payment.payment_ref ?? "--",
        csvValue: (payment) => payment.payment_ref ?? "",
        width: 160,
      },
      {
        id: "amount",
        label: "Amount",
        defaultVisible: true,
        sortable: true,
        sortValue: (payment) => payment.amount,
        render: (payment) => (
          <span className="block text-right tabular-nums font-medium">
            {formatCurrency(payment.amount)}
          </span>
        ),
        csvValue: (payment) => String(payment.amount ?? ""),
        width: 130,
      },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return <Text tone="destructive">{error}</Text>;
  }

  if (payments.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="h-8 w-8" />}
        title="No Acumatica payments linked"
        description="Payments issued in Acumatica will appear here after AP check reconciliation is available."
      />
    );
  }

  return (
    <UnifiedTablePage
      header={{
        title: "Payments Issued",
        description: "Payments issued in Acumatica for this commitment.",
        variant: "compact",
      }}
      toolbar={{
        totalItems: payments.length,
        filteredItems: filteredPayments.length,
        leftContent:
          payments.length > 0 ? (
            <span className="text-sm font-medium tabular-nums">
              Total issued: {formatCurrency(totalPaid)}
            </span>
          ) : undefined,
        searchValue: searchQuery,
        onSearchChange: setSearchQuery,
        searchPlaceholder: "Search payments...",
        currentView,
        onViewChange: (view) => {
          if (view === "table") setCurrentView(view);
        },
        enabledViews: ["table"],
      }}
      data={{ items: filteredPayments, isLoading: false, error: null }}
      table={{
        columns,
        getRowId: (payment) => String(payment.id),
        density: "compact",
        stickyHeader: true,
      }}
      footerTotals={{
        label: "Total Issued",
        values: {
          amount: (
            <span className="font-semibold tabular-nums">
              {formatCurrency(totalPaid)}
            </span>
          ),
        },
      }}
      emptyState={{
        title: "No Acumatica payments linked",
        description:
          "Payments issued in Acumatica will appear here after AP check reconciliation is available.",
        filteredDescription: "No payments match your search.",
        isFiltered: Boolean(searchQuery),
      }}
      features={{
        enableViews: false,
        enableColumnToggle: true,
        enableExport: true,
        enablePagination: true,
        enableBulkDelete: false,
        enableRowSelection: false,
      }}
      layout={{
        containerPadding: false,
        toolbarInlineWithHeader: true,
        minWidth: 860,
      }}
    />
  );
});

PaymentsIssuedTab.displayName = "PaymentsIssuedTab";
