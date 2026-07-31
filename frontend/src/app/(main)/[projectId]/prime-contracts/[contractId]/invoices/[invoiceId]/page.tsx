"use client";

import { use, useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Download, Plus, Trash2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { PageShell, PageTabs } from "@/components/layout";
import { StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ds";
import {
  usePaymentApplication,
  usePaymentApplicationLineItems,
  useUpdatePaymentApplication,
  useUpdateLineItems,
  usePopulateSOV,
  useDeletePaymentApplication,
} from "@/hooks/use-payment-applications";
import { InvoiceGeneralSettings } from "@/components/domain/invoices/InvoiceGeneralSettings";
import { InvoiceG702Summary } from "@/components/domain/invoices/InvoiceG702Summary";
import { InvoiceG703Detail } from "@/components/domain/invoices/InvoiceG703Detail";
import { apiFetch } from "@/lib/api-client";
import { usePdfExport } from "@/hooks/use-pdf-export";
import { useConfirm } from "@/hooks/use-confirm";
import type {
  PaymentApplication,
  PaymentApplicationLineItem,
  Contract,
} from "@/app/(main)/[projectId]/prime-contracts/[contractId]/types";

interface BillingPeriod {
  id: string;
  start_date: string;
  end_date: string;
  name: string | null;
  period_number: number;
}

interface BillingPeriodResponse {
  items?: BillingPeriod[];
}

function formatStatusDisplay(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; contractId: string; invoiceId: string }>;
}) {
  const { projectId, contractId, invoiceId } = use(params);
  const router = useRouter();
  const numericProjectId = parseInt(projectId, 10);
  const { confirm, ConfirmDialog } = useConfirm();

  const [activeTab, setActiveTab] = useState("summary");
  const [contract, setContract] = useState<Contract | null>(null);
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriod[]>([]);
  const [previousPaymentDue, setPreviousPaymentDue] = useState(0);

  // React Query hooks
  const { data: invoice, isLoading: invoiceLoading } = usePaymentApplication(
    numericProjectId,
    contractId,
    invoiceId,
  );
  const { data: lineItems = [], isLoading: lineItemsLoading } =
    usePaymentApplicationLineItems(numericProjectId, contractId, invoiceId);

  const updateMutation = useUpdatePaymentApplication(
    numericProjectId,
    contractId,
    invoiceId,
  );
  const updateLineItemsMutation = useUpdateLineItems(
    numericProjectId,
    contractId,
    invoiceId,
  );
  const populateSOV = usePopulateSOV(numericProjectId, contractId, invoiceId);
  const deleteMutation = useDeletePaymentApplication(
    numericProjectId,
    contractId,
  );

  // Fetch contract data
  useEffect(() => {
    async function fetchContract() {
      try {
        const data = await apiFetch<Contract>(
          `/api/projects/${projectId}/contracts/${contractId}`,
        );
        setContract(data);
      } catch (error) {
        toast.error("Failed to load contract details");
      }
    }
    fetchContract();
  }, [projectId, contractId]);

  // Fetch billing periods
  useEffect(() => {
    async function fetchBillingPeriods() {
      try {
        const data = await apiFetch<BillingPeriod[] | BillingPeriodResponse>(
          `/api/projects/${projectId}/billing-periods`,
        );
        setBillingPeriods(Array.isArray(data) ? data : data.items ?? []);
      } catch (error) {
        toast.error("Failed to load billing periods");
      }
    }
    fetchBillingPeriods();
  }, [projectId]);

  // Calculate previous payment due from earlier payment applications
  useEffect(() => {
    async function fetchPreviousApplications() {
      try {
        const applications = await apiFetch<PaymentApplication[]>(
          `/api/projects/${projectId}/contracts/${contractId}/payment-applications`,
        );

        // Sum net_amount of all approved applications with a lower number
        const currentNumber = invoice?.application_number ?? "";
        const previousTotal = applications
          .filter(
            (app) =>
              app.id !== invoiceId &&
              app.application_number < currentNumber &&
              app.status === "approved",
          )
          .reduce((sum, app) => sum + app.net_amount, 0);

        setPreviousPaymentDue(previousTotal);
      } catch (error) {
        toast.error("Failed to load previous payment applications");
      }
    }
    if (invoice) {
      fetchPreviousApplications();
    }
  }, [projectId, contractId, invoiceId, invoice]);

  const handleUpdate = useCallback(
    async (data: Partial<PaymentApplication>) => {
      await updateMutation.mutateAsync(data);
    },
    [updateMutation],
  );

  const handleSaveLineItems = useCallback(
    async (items: Partial<PaymentApplicationLineItem>[]) => {
      await updateLineItemsMutation.mutateAsync(items);
    },
    [updateLineItemsMutation],
  );

  const handlePopulateSOV = useCallback(async () => {
    await populateSOV.mutateAsync();
  }, [populateSOV]);

  const handleDelete = useCallback(async () => {
    const ok = await confirm({
      description: "Are you sure you want to delete this invoice? This cannot be undone.",
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(invoiceId);
      router.push(
        `/${projectId}/prime-contracts/${contractId}`,
      );
    } catch {
      toast.error("Failed to delete invoice");
    }
  }, [confirm, deleteMutation, invoiceId, projectId, contractId, router]);

  const { exportPdf: handleExportPdf } = usePdfExport({
    endpoint: `/api/projects/${projectId}/contracts/${contractId}/payment-applications/${invoiceId}/pdf`,
    filename: `invoice-${invoice?.application_number || invoiceId}`,
  });

  // Page title and subtitle
  const pageTitle = invoice
    ? `Invoice #${invoice.application_number}`
    : "Invoice";
  const pageSubtitle = useMemo(() => {
    if (!invoice?.period_from || !invoice?.period_to) return undefined;
    try {
      const from = format(new Date(invoice.period_from), "MM/dd/yy");
      const to = format(new Date(invoice.period_to), "MM/dd/yy");
      return `${from} - ${to}`;
    } catch {
      return undefined;
    }
  }, [invoice]);

  if (invoiceLoading) {
    return (
      <PageShell variant="detail" title="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-muted-foreground">
            Loading invoice...
          </div>
        </div>
      </PageShell>
    );
  }

  if (!invoice) {
    return (
      <PageShell
        variant="detail"
        title="Invoice Not Found"
        onBack={() =>
          router.push(`/${projectId}/prime-contracts/${contractId}`)
        }
      >
        <EmptyState
          icon={<FileSpreadsheet className="h-10 w-10" />}
          title="Invoice not found"
          description="The requested invoice could not be found."
        />
      </PageShell>
    );
  }

  const contractSummary = contract
    ? {
        original_contract_value: contract.original_contract_value,
        revised_contract_value: contract.revised_contract_value,
        title: contract.title,
        contract_number: contract.contract_number,
        start_date: contract.start_date,
      }
    : {
        original_contract_value: 0,
        revised_contract_value: 0,
        title: "",
        contract_number: null,
        start_date: null,
      };

  return (
    <>
    {ConfirmDialog}
    <PageShell
      variant="detail"
      title={pageTitle}
      description={pageSubtitle}
      onBack={() =>
        router.push(`/${projectId}/prime-contracts/${contractId}`)
      }
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge status={formatStatusDisplay(invoice.status)} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <PageTabs
        variant="inline"
        tabs={[
          { label: "Summary", href: "summary", isActive: activeTab === "summary" },
          { label: "Detail", href: "detail", isActive: activeTab === "detail" },
          {
            label: "Change History",
            href: "change-history",
            isActive: activeTab === "change-history",
          },
        ]}
        onTabClick={(href) => setActiveTab(href)}
      />

      {activeTab === "summary" && (
        <div className="mt-6 space-y-8">
          <InvoiceGeneralSettings
            invoice={invoice}
            onUpdate={handleUpdate}
            billingPeriods={billingPeriods}
          />
          <InvoiceG702Summary
            invoice={invoice}
            lineItems={lineItems}
            contract={contractSummary}
            previousPaymentDue={previousPaymentDue}
          />
        </div>
      )}

      {activeTab === "detail" && (
        <div className="mt-6">
          {lineItemsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-muted-foreground">
                Loading line items...
              </div>
            </div>
          ) : lineItems.length === 0 ? (
            <EmptyState
              icon={<FileSpreadsheet className="h-10 w-10" />}
              title="No schedule of values"
              description="Populate the schedule of values from the contract line items to start billing."
              action={
                <Button size="sm" variant="outline" onClick={handlePopulateSOV} disabled={populateSOV.isPending}>
                  <Plus />
                  {populateSOV.isPending ? "Populating..." : "Populate SOV from Contract"}
                </Button>
              }
            />
          ) : (
            <InvoiceG703Detail
              lineItems={lineItems}
              onSave={handleSaveLineItems}
              isReadOnly={invoice.status === "approved"}
              canEditRetainage={invoice.can_edit_retainage ?? false}
              retainageEditBlockReason={invoice.retainage_edit_block_reason}
            />
          )}
        </div>
      )}

      {activeTab === "change-history" && (
        <div className="mt-6">
          <EmptyState
            icon={<FileSpreadsheet className="h-10 w-10" />}
            title="Change history coming soon"
            description="Invoice change history will appear here once tracking is available."
          />
        </div>
      )}
    </PageShell>
    </>
  );
}
