"use client";

import { useMemo, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  UnifiedTablePage,
  type TableColumn,
  type ViewMode,
} from "@/components/tables/unified";
import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";
import { formatDate } from "@/lib/format";
import type {
  Payment,
  Contract,
} from "@/app/(main)/[projectId]/prime-contracts/[contractId]/types";

interface PrimeContractPaymentsTabProps {
  projectId: string;
  contractId: string;
  payments: Payment[];
  paymentsReceivedLoading: boolean;
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  setContract: React.Dispatch<React.SetStateAction<Contract | null>>;
  formatCurrency: (value: number | null | undefined) => string;
}

function buildAcumaticaPaymentHref(
  docType: string | null | undefined,
  refNbr: string,
): string {
  return `https://alleatogroup.acumatica.com/Main?ScreenId=AR302000&DocType=${encodeURIComponent(docType ?? "Payment")}&RefNbr=${encodeURIComponent(refNbr)}`;
}

export function PrimeContractPaymentsTab({
  projectId,
  contractId,
  payments,
  paymentsReceivedLoading,
  setPayments,
  setContract,
  formatCurrency,
}: PrimeContractPaymentsTabProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentView, setCurrentView] = useState<ViewMode>("table");

  const totalPaymentsReceived = useMemo(
    () => payments.reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  );

  const filteredPayments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return payments;

    return payments.filter((payment) =>
      [
        payment.payment_number,
        payment.payment_date,
        payment.method,
        payment.reference_number,
        payment.payment_application?.application_number,
        payment.acumatica_ref_nbr,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [payments, searchQuery]);

  const handleSyncERP = async () => {
    try {
      setIsSyncing(true);
      const result = await apiFetch<{
        payments: Payment[];
        contract: Contract;
      }>(`/api/projects/${projectId}/contracts/${contractId}/sync-payments`, {
        method: "POST",
      });
      setPayments(result.payments);
      setContract(result.contract);
      toast.success("Payments synced from Acumatica");
    } catch (error) {
      handleFormError(error, { entity: "payments", action: "save" });
    } finally {
      setIsSyncing(false);
    }
  };

  const syncButton = (
    <Button size="sm" onClick={handleSyncERP} disabled={isSyncing}>
      <RefreshCw className={isSyncing ? "animate-spin" : undefined} />
      {isSyncing ? "Syncing..." : "Sync with ERP"}
    </Button>
  );

  const columns: TableColumn<Payment>[] = useMemo(
    () => [
      {
        id: "payment_number",
        label: "Payment #",
        alwaysVisible: true,
        sortable: true,
        sortValue: (payment) => payment.payment_number ?? "",
        render: (payment) => (
          <span className="font-medium">{payment.payment_number || "--"}</span>
        ),
        csvValue: (payment) => payment.payment_number ?? "",
        width: 140,
      },
      {
        id: "payment_date",
        label: "Date",
        defaultVisible: true,
        sortable: true,
        sortValue: (payment) =>
          payment.payment_date ? new Date(payment.payment_date).getTime() : 0,
        render: (payment) => formatDate(payment.payment_date),
        csvValue: (payment) => payment.payment_date ?? "",
        width: 130,
      },
      {
        id: "amount",
        label: "Amount",
        defaultVisible: true,
        sortable: true,
        sortValue: (payment) => payment.amount,
        render: (payment) => (
          <span className="block text-right tabular-nums">
            {formatCurrency(payment.amount)}
          </span>
        ),
        csvValue: (payment) => String(payment.amount ?? ""),
        width: 130,
      },
      {
        id: "method",
        label: "Method",
        defaultVisible: true,
        sortable: true,
        sortValue: (payment) => payment.method ?? "",
        render: (payment) => (
          <span className="capitalize text-muted-foreground">
            {payment.method || "--"}
          </span>
        ),
        csvValue: (payment) => payment.method ?? "",
        width: 140,
      },
      {
        id: "reference_number",
        label: "Reference",
        defaultVisible: true,
        sortable: true,
        sortValue: (payment) => payment.reference_number ?? "",
        render: (payment) => (
          <span className="text-muted-foreground">
            {payment.reference_number || "--"}
          </span>
        ),
        csvValue: (payment) => payment.reference_number ?? "",
        width: 160,
      },
      {
        id: "linked_invoice",
        label: "Linked Invoice",
        defaultVisible: true,
        sortable: true,
        sortValue: (payment) =>
          payment.payment_application?.application_number ?? "",
        render: (payment) => (
          <div className="text-sm text-muted-foreground">
            {payment.payment_application
              ? `App #${payment.payment_application.application_number}`
              : "--"}
          </div>
        ),
        csvValue: (payment) =>
          payment.payment_application?.application_number ?? "",
        width: 160,
      },
      {
        id: "acumatica_ref",
        label: "Acumatica",
        defaultVisible: true,
        sortable: true,
        sortValue: (payment) => payment.acumatica_ref_nbr ?? "",
        render: (payment) => {
          const refNbr = payment.acumatica_ref_nbr;
          if (!refNbr)
            return <span className="text-sm text-muted-foreground">--</span>;
          return (
            <a
              href={buildAcumaticaPaymentHref(
                payment.acumatica_doc_type,
                refNbr,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
            >
              {refNbr}
              <ArrowRight className="h-3 w-3" />
            </a>
          );
        },
        csvValue: (payment) => payment.acumatica_ref_nbr ?? "",
        width: 150,
      },
    ],
    [formatCurrency],
  );

  return (
    <UnifiedTablePage
      header={{
        title: "Payments Received",
        description: "Payments synced from Acumatica for this prime contract.",
        actions: syncButton,
        variant: "compact",
      }}
      toolbar={{
        totalItems: payments.length,
        filteredItems: filteredPayments.length,
        leftContent:
          payments.length > 0 ? (
            <span className="text-sm font-medium tabular-nums">
              Total received: {formatCurrency(totalPaymentsReceived)}
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
      data={{
        items: filteredPayments,
        isLoading: paymentsReceivedLoading,
        error: null,
      }}
      table={{
        columns,
        getRowId: (payment) => String(payment.id),
        density: "compact",
        stickyHeader: true,
      }}
      footerTotals={{
        label: "Total Received",
        values: {
          amount: (
            <span className="font-semibold tabular-nums">
              {formatCurrency(totalPaymentsReceived)}
            </span>
          ),
        },
      }}
      emptyState={{
        title: "No payments synced yet",
        description:
          "Payments are synced automatically from Acumatica. Use the sync action to pull the latest data.",
        filteredDescription: "No payments match your search.",
        isFiltered: Boolean(searchQuery),
        action: syncButton,
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
        minWidth: 960,
      }}
    />
  );
}
