"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FormContainer, PageShell } from "@/components/layout";
import { Form } from "@/components/ui/form";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { FormGrid, FormSection } from "@/components/forms";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFComboboxField } from "@/components/forms/fields/RHFComboboxField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableFooter,
  InlineTableFooterCell,
  InlineTableFooterRow,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { useCommitments } from "@/hooks/use-commitments-query";
import { useContracts } from "@/hooks/use-contracts";
import { useBillingPeriodsList } from "@/hooks/use-billing-periods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  formatOwnerInvoiceBillingPeriodOption,
  selectDefaultOwnerInvoiceBillingPeriod,
  shouldApplyOwnerInvoiceDueDate,
} from "@/lib/invoicing/owner-invoice-billing-period";
import type { AppliedOwnerInvoiceDueDate } from "@/lib/invoicing/owner-invoice-billing-period";

type ContractType = "prime" | "commitment";

interface LineItem {
  id: string;
  costCode: string;
  description: string;
  contractAmount: string;
  previouslyBilled: string;
  thisMonthAmount: string;
  thisMonthPercent: string;
  totalCompleted: string;
  percentComplete: string;
  retention: string;
  netDue: string;
}

const parseAmount = (value: string): number => {
  const parsed = Number.parseFloat(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
};

const createLineItem = (): LineItem => ({
  id: crypto.randomUUID(),
  costCode: "",
  description: "",
  contractAmount: "0.00",
  previouslyBilled: "0.00",
  thisMonthAmount: "0.00",
  thisMonthPercent: "0.00",
  totalCompleted: "0.00",
  percentComplete: "0.00",
  retention: "0.00",
  netDue: "0.00",
});

const withCalculatedFields = (
  item: LineItem,
  includeRetention: boolean,
  retentionPercentage: number,
): LineItem => {
  const contractAmount = parseAmount(item.contractAmount);
  const previouslyBilled = parseAmount(item.previouslyBilled);
  const thisMonthAmount = parseAmount(item.thisMonthAmount);

  const totalCompleted = previouslyBilled + thisMonthAmount;
  const thisMonthPercent =
    contractAmount > 0 ? (thisMonthAmount / contractAmount) * 100 : 0;
  const percentComplete = contractAmount > 0 ? (totalCompleted / contractAmount) * 100 : 0;
  const retention = includeRetention ? (thisMonthAmount * retentionPercentage) / 100 : 0;
  const netDue = thisMonthAmount - retention;

  return {
    ...item,
    totalCompleted: totalCompleted.toFixed(2),
    thisMonthPercent: thisMonthPercent.toFixed(2),
    percentComplete: percentComplete.toFixed(2),
    retention: retention.toFixed(2),
    netDue: netDue.toFixed(2),
  };
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Invoice creation failed because the request did not return a usable error message.";
};

interface OwnerInvoiceSovResponse {
  contract: {
    id: string;
    contract_number: string | null;
    title: string | null;
    contract_amount: number;
    retention_percentage: number | null;
  };
  line_items: Array<{
    id: string;
    line_number: number;
    cost_code: string | null;
    cost_code_name: string | null;
    description: string;
    scheduled_value: number;
    previously_billed: number;
  }>;
}

interface AtomicOwnerInvoiceResponse {
  data: {
    invoice_id: number;
    payment_application_id: string;
    invoice_number: string;
  };
}

const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const toOwnerInvoiceStatus = (status: string): string => {
  if (status === "submitted") return "under_review";
  return status;
};

const toPaymentApplicationStatus = (
  status: string,
): "draft" | "under_review" | "approved" => {
  if (status === "submitted") return "under_review";
  if (status === "approved" || status === "paid") return "approved";
  return "draft";
};

// ─── Schema ─────────────────────────────────────────────────────────────────

const invoiceFormSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required."),
  contractType: z.enum(["prime", "commitment"]),
  contractId: z.string().min(1, "Select a contract before creating the invoice."),
  billingPeriodId: z.string().min(1, "Select a billing period."),
  invoiceDate: z.date(),
  dueDate: z.date().nullable(),
  status: z.string(),
  description: z.string(),
  includeRetention: z.boolean(),
  retentionPercentage: z.number().min(0).max(100),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

const CONTRACT_TYPE_OPTIONS = [
  { value: "prime", label: "Prime Contract" },
  { value: "commitment", label: "Commitment/Subcontract" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

export default function NewInvoicePage() {
  const router = useRouter();
  const params = useParams()! ?? {};
  const searchParams = useSearchParams()! ?? new URLSearchParams();
  const projectId = params.projectId as string;
  const parsedProjectId = Number.parseInt(projectId, 10);

  const initialContractType: ContractType =
    searchParams.get("contractType") === "commitment" ? "commitment" : "prime";
  const initialContractId =
    searchParams.get("commitmentId") ?? searchParams.get("contractId") ?? "";

  const { options: contractOptions, isLoading: contractsLoading } = useContracts({
    projectId: Number.isFinite(parsedProjectId) ? parsedProjectId : undefined,
  });
  const { options: commitmentOptions, isLoading: commitmentsLoading } = useCommitments(projectId);
  const {
    data: billingPeriods = [],
    isLoading: billingPeriodsLoading,
    error: billingPeriodsError,
  } = useBillingPeriodsList(projectId);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceNumber: "",
      contractType: initialContractType,
      contractId: initialContractId,
      billingPeriodId: "",
      invoiceDate: new Date(),
      dueDate: null,
      status: "draft",
      description: "",
      includeRetention: true,
      retentionPercentage: 10,
    },
  });

  const watchedContractType = form.watch("contractType");
  const watchedContractId = form.watch("contractId");
  const watchedBillingPeriodId = form.watch("billingPeriodId");
  const includeRetention = form.watch("includeRetention");
  const retentionPercentValue = form.watch("retentionPercentage") ?? 0;

  const [lineItems, setLineItems] = useState<LineItem[]>([
    withCalculatedFields(createLineItem(), true, 10),
  ]);
  const [sovLoading, setSovLoading] = useState(false);

  const billingPeriodOptions = useMemo(
    () =>
      [...billingPeriods]
        .sort((left, right) => right.start_date.localeCompare(left.start_date))
        .map((period) => ({
          value: period.id,
          label: formatOwnerInvoiceBillingPeriodOption(period),
        })),
    [billingPeriods],
  );
  const selectedBillingPeriod = useMemo(
    () =>
      billingPeriods.find((period) => period.id === watchedBillingPeriodId) ??
      null,
    [billingPeriods, watchedBillingPeriodId],
  );
  const appliedDueDateRef = useRef<AppliedOwnerInvoiceDueDate | null>(null);

  useEffect(() => {
    const currentId = form.getValues("billingPeriodId");
    if (currentId && billingPeriods.some((period) => period.id === currentId)) {
      return;
    }

    const defaultPeriod = selectDefaultOwnerInvoiceBillingPeriod(billingPeriods);
    if (defaultPeriod) {
      form.setValue("billingPeriodId", defaultPeriod.id, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [billingPeriods, form]);

  useEffect(() => {
    if (!selectedBillingPeriod) return;

    const nextAppliedDueDate = {
      billingPeriodId: selectedBillingPeriod.id,
      dueDate: selectedBillingPeriod.due_date,
    };
    const shouldApply = shouldApplyOwnerInvoiceDueDate(
      appliedDueDateRef.current,
      nextAppliedDueDate,
      form.getFieldState("dueDate").isDirty,
    );
    appliedDueDateRef.current = nextAppliedDueDate;

    if (shouldApply) {
      form.resetField("dueDate", {
        defaultValue: selectedBillingPeriod.due_date
          ? new Date(`${selectedBillingPeriod.due_date}T00:00:00`)
          : null,
      });
    }
  }, [form, selectedBillingPeriod]);

  const totals = useMemo(() => {
    return lineItems.reduce(
      (acc, item) => {
        acc.contractAmount += parseAmount(item.contractAmount);
        acc.previouslyBilled += parseAmount(item.previouslyBilled);
        acc.thisMonthBilling += parseAmount(item.thisMonthAmount);
        acc.totalCompleted += parseAmount(item.totalCompleted);
        acc.retentionAmount += parseAmount(item.retention);
        acc.netDue += parseAmount(item.netDue);
        return acc;
      },
      {
        contractAmount: 0,
        previouslyBilled: 0,
        thisMonthBilling: 0,
        totalCompleted: 0,
        retentionAmount: 0,
        netDue: 0,
      },
    );
  }, [lineItems]);

  const recalculateAllLineItems = useCallback(
    (items: LineItem[]): LineItem[] =>
      items.map((item) =>
        withCalculatedFields(item, includeRetention, retentionPercentValue),
      ),
    [includeRetention, retentionPercentValue],
  );

  const addLineItem = useCallback(() => {
    setLineItems((previous) => [
      ...previous,
      withCalculatedFields(createLineItem(), includeRetention, retentionPercentValue),
    ]);
  }, [includeRetention, retentionPercentValue]);

  const removeLineItem = useCallback((id: string) => {
    setLineItems((previous) => {
      if (previous.length === 1) {
        toast.error("An invoice must have at least one line item.");
        return previous;
      }
      return previous.filter((item) => item.id !== id);
    });
  }, []);

  const updateLineItem = useCallback(
    (id: string, field: keyof LineItem, value: string) => {
      setLineItems((previous) =>
        previous.map((item) => {
          if (item.id !== id) return item;

          const updated = { ...item, [field]: value };
          if (
            field === "contractAmount" ||
            field === "previouslyBilled" ||
            field === "thisMonthAmount"
          ) {
            return withCalculatedFields(updated, includeRetention, retentionPercentValue);
          }

          return updated;
        }),
      );
    },
    [includeRetention, retentionPercentValue],
  );

  useEffect(() => {
    setLineItems((previous) => recalculateAllLineItems(previous));
  }, [recalculateAllLineItems]);

  // Tracks which contract's Schedule of Values is currently loaded into the grid.
  const loadedContractRef = useRef<string | null>(null);

  // Switching contract type clears the previously selected contract/commitment.
  // Guarded so the URL-provided initial contract id survives the first render.
  const previousContractType = useRef(initialContractType);
  useEffect(() => {
    if (previousContractType.current === watchedContractType) return;
    previousContractType.current = watchedContractType;
    form.setValue("contractId", "");
    // Drop any auto-loaded Schedule of Values back to a single manual row, and
    // forget which contract was loaded so re-selecting it re-fetches the SOV.
    loadedContractRef.current = null;
    setLineItems([withCalculatedFields(createLineItem(), includeRetention, retentionPercentValue)]);
  }, [watchedContractType, form, includeRetention, retentionPercentValue]);

  // When a prime contract is selected, auto-load its Schedule of Values so the
  // billable lines (cost code, description, contract value, previously billed)
  // are pre-filled — matching the subcontractor invoice flow. Without this the
  // user had to hand-type every line and Contract Amount showed $0.
  useEffect(() => {
    if (watchedContractType !== "prime" || !watchedContractId || !projectId) {
      return;
    }
    if (loadedContractRef.current === watchedContractId) {
      return;
    }

    let cancelled = false;
    setSovLoading(true);
    apiFetch<OwnerInvoiceSovResponse>(
      `/api/projects/${projectId}/invoicing/owner/sov?contractId=${encodeURIComponent(watchedContractId)}`,
    )
      .then((response) => {
        if (cancelled) return;
        loadedContractRef.current = watchedContractId;

        const retentionPct = response.contract.retention_percentage;
        if (typeof retentionPct === "number" && Number.isFinite(retentionPct)) {
          form.setValue("retentionPercentage", retentionPct);
        }
        const applyRetention = typeof retentionPct === "number" ? retentionPct : retentionPercentValue;

        const loaded = response.line_items.map((line) =>
          withCalculatedFields(
            {
              ...createLineItem(),
              costCode: line.cost_code ?? "",
              description: line.description ?? "",
              contractAmount: line.scheduled_value.toFixed(2),
              previouslyBilled: line.previously_billed.toFixed(2),
            },
            includeRetention,
            applyRetention,
          ),
        );

        // A contract with no SOV lines still needs one editable row to bill against.
        setLineItems(
          loaded.length > 0
            ? loaded
            : [withCalculatedFields(createLineItem(), includeRetention, applyRetention)],
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Failed to load the contract's Schedule of Values.";
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setSovLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // includeRetention / retentionPercentValue are read only on first load of a
    // given contract — the loadedContractRef guard early-returns on later runs,
    // so a retention tweak re-runs this effect but never re-fetches or discards
    // the user's in-progress this-month entries (recalculateAllLineItems owns
    // recomputation from there).
  }, [
    watchedContractType,
    watchedContractId,
    projectId,
    form,
    includeRetention,
    retentionPercentValue,
  ]);

  const onSubmit = async (values: InvoiceFormValues) => {
    if (!Number.isFinite(parsedProjectId)) {
      toast.error(
        `Cannot create an invoice because project id '${projectId}' is invalid for this route.`,
      );
      return;
    }

    const billingPeriod = billingPeriods.find(
      (period) => period.id === values.billingPeriodId,
    );
    if (!billingPeriod) {
      const message =
        "The selected billing period is no longer available. Refresh the page and select another period.";
      form.setError("billingPeriodId", { type: "validate", message });
      toast.error(message);
      return;
    }

    try {
      if (values.contractType === "prime") {
        const percentComplete =
          totals.contractAmount > 0
            ? (totals.totalCompleted / totals.contractAmount) * 100
            : null;

        // Single transactional write: payment application + invoice header +
        // all line items are committed together by the create_owner_invoice_atomic
        // RPC. If any step fails the entire transaction rolls back, so a failure
        // can no longer leave an orphaned payment application or a header invoice
        // with missing line items.
        await apiFetch<AtomicOwnerInvoiceResponse>(
          `/api/projects/${projectId}/invoicing/owner/atomic`,
          {
            method: "POST",
            body: JSON.stringify({
              prime_contract_id: values.contractId,
              payment_application: {
                application_number: values.invoiceNumber.trim(),
                billing_period_id: billingPeriod.id,
                amount: totals.thisMonthBilling,
                retention_amount: totals.retentionAmount,
                percent_complete: percentComplete ?? 0,
                status: toPaymentApplicationStatus(values.status),
                period_from: billingPeriod.start_date,
                period_to: billingPeriod.end_date,
                billing_date: toDateOnly(values.invoiceDate),
                notes: values.description.trim() || null,
              },
              invoice: {
                invoice_number: values.invoiceNumber.trim(),
                billing_period_id: billingPeriod.id,
                period_start: billingPeriod.start_date,
                period_end: billingPeriod.end_date,
                billing_date: toDateOnly(values.invoiceDate),
                due_date: values.dueDate ? toDateOnly(values.dueDate) : null,
                status: toOwnerInvoiceStatus(values.status),
                gross_amount: totals.thisMonthBilling,
                net_amount: totals.netDue,
                percent_complete: percentComplete,
                notes: values.description.trim() || null,
              },
              line_items: lineItems.map((item, index) => ({
                category: item.costCode.trim() || null,
                description: item.description.trim() || null,
                scheduled_value: parseAmount(item.contractAmount),
                work_completed_previous: parseAmount(item.previouslyBilled),
                work_completed_period: parseAmount(item.thisMonthAmount),
                retainage_pct: values.includeRetention ? retentionPercentValue : 0,
                retainage_amount: parseAmount(item.retention),
                approved_amount: parseAmount(item.netDue),
                sort_order: index,
              })),
            }),
          },
        );
      } else {
        await apiFetch("/api/invoices", {
          method: "POST",
          body: JSON.stringify({
            invoice_number: values.invoiceNumber.trim(),
            project_id: parsedProjectId,
            commitment_id: values.contractId,
            billing_period_start: billingPeriod.start_date,
            billing_period_end: billingPeriod.end_date,
            invoice_date: values.invoiceDate.toISOString(),
            due_date: values.dueDate?.toISOString() ?? null,
            status: values.status,
            amount: totals.thisMonthBilling,
            retention_amount: totals.retentionAmount,
            net_amount: totals.netDue,
            notes: values.description.trim() || null,
          }),
        });
      }

      router.push(`/${projectId}/invoices`);
    } catch (error) {
      const message = toErrorMessage(error);
      console.error("Invoice create request failed", {
        projectId,
        contractType: values.contractType,
        contractId: values.contractId,
        message,
      });
      form.setError("root", { type: "server", message });
      toast.error(message);
    }
  };

  const contractOptionsToRender =
    watchedContractType === "prime" ? contractOptions : commitmentOptions;
  const isContractSelectLoading =
    watchedContractType === "prime" ? contractsLoading : commitmentsLoading;

  return (
    <PageShell
      variant="form"
      title="New Invoice"
      onBack={() => router.push(`/${projectId}/invoices`)}
      backLabel="Back to Invoices"
    >
      <FormContainer maxWidth="lg" withCard={false}>
        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormSection title="Invoice Information">
              <FormGrid columns={2}>
                <RHFTextField
                  control={form.control}
                  name="invoiceNumber"
                  label="Invoice Number *"
                  placeholder="INV-001"
                />

                <RHFSelectField
                  control={form.control}
                  name="billingPeriodId"
                  label="Billing Period *"
                  placeholder={
                    billingPeriodsLoading
                      ? "Loading billing periods..."
                      : billingPeriodsError
                        ? "Billing periods unavailable"
                        : "Select billing period"
                  }
                  description={
                    billingPeriodsError
                      ? "Billing periods could not be loaded. Refresh the page before creating this invoice."
                      : !billingPeriodsLoading && billingPeriodOptions.length === 0
                        ? "No billing periods are available. Create or open one on the Billing Periods tab, then return here."
                        : undefined
                  }
                  options={billingPeriodOptions}
                  disabled={
                    billingPeriodsLoading ||
                    Boolean(billingPeriodsError) ||
                    billingPeriodOptions.length === 0
                  }
                />
              </FormGrid>

              <FormGrid columns={2}>
                <RHFSelectField
                  control={form.control}
                  name="contractType"
                  label="Contract Type *"
                  placeholder="Select contract type"
                  options={CONTRACT_TYPE_OPTIONS}
                />

                <RHFComboboxField
                  control={form.control}
                  name="contractId"
                  label={watchedContractType === "prime" ? "Contract *" : "Commitment *"}
                  placeholder={
                    isContractSelectLoading
                      ? "Loading options..."
                      : watchedContractType === "prime"
                        ? "Select contract"
                        : "Select commitment"
                  }
                  searchPlaceholder="Search..."
                  emptyMessage="No options found."
                  options={contractOptionsToRender}
                  disabled={isContractSelectLoading}
                />
              </FormGrid>

              <FormGrid columns={3}>
                <RHFDateField
                  control={form.control}
                  name="invoiceDate"
                  label="Invoice Date *"
                  valueType="date"
                  placeholder="Select date"
                />

                <RHFDateField
                  control={form.control}
                  name="dueDate"
                  label="Due Date"
                  valueType="date"
                  nullable
                  placeholder="Select date"
                />

                <RHFSelectField
                  control={form.control}
                  name="status"
                  label="Status"
                  placeholder="Select status"
                  options={STATUS_OPTIONS}
                />
              </FormGrid>

              <RHFTextareaField
                control={form.control}
                name="description"
                label="Description"
                placeholder="Invoice notes"
                rows={3}
              />

              <FormGrid columns={2}>
                <RHFCheckboxField
                  control={form.control}
                  name="includeRetention"
                  label="Apply retention"
                />

                {includeRetention ? (
                  <RHFNumberField
                    control={form.control}
                    name="retentionPercentage"
                    label="Retention %"
                    min={0}
                    max={100}
                    step={0.01}
                  />
                ) : null}
              </FormGrid>
            </FormSection>

            <FormSection title="Invoice Line Items">
              <div className="space-y-4">
                {sovLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading the contract&rsquo;s Schedule of Values&hellip;
                  </p>
                ) : null}
                <div className="overflow-x-auto overflow-hidden rounded-lg border border-border/70 bg-muted/20 px-2">
                  <InlineTable variant="edit" tableClassName="min-w-[1040px]">
                    <InlineTableHeader>
                      <InlineTableHeaderRow className="border-b border-border/60">
                        <InlineTableHeaderCell className="min-w-24">
                          Cost Code
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell className="min-w-56">
                          Description
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="min-w-32">
                          Contract
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="min-w-32">
                          Previously
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="min-w-32">
                          This Month
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="min-w-20">
                          This %
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="min-w-32">
                          Total
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="min-w-24">
                          Complete %
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="min-w-24">
                          Retention
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="min-w-32">
                          Net Due
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell className="w-12" />
                      </InlineTableHeaderRow>
                    </InlineTableHeader>
                    <InlineTableBody>
                      {lineItems.map((item) => (
                        <InlineTableRow key={item.id}>
                          <InlineTableCell className="align-top">
                            <Input
                              value={item.costCode}
                              onChange={(event) => updateLineItem(item.id, "costCode", event.target.value)}
                              placeholder="01-000"
                              className="h-9 min-w-20"
                            />
                          </InlineTableCell>
                          <InlineTableCell className="align-top">
                            <Input
                              value={item.description}
                              onChange={(event) => updateLineItem(item.id, "description", event.target.value)}
                              placeholder="Line item description"
                              className="h-9 min-w-48"
                            />
                          </InlineTableCell>
                          <InlineTableCell align="right" className="align-top">
                            <NumberInput
                              step="0.01"
                              value={item.contractAmount}
                              onChange={(event) =>
                                updateLineItem(item.id, "contractAmount", event.target.value)
                              }
                              className="h-9 min-w-24 text-right"
                            />
                          </InlineTableCell>
                          <InlineTableCell align="right" className="align-top">
                            <NumberInput
                              step="0.01"
                              value={item.previouslyBilled}
                              onChange={(event) =>
                                updateLineItem(item.id, "previouslyBilled", event.target.value)
                              }
                              className="h-9 min-w-24 text-right"
                            />
                          </InlineTableCell>
                          <InlineTableCell align="right" className="align-top">
                            <NumberInput
                              step="0.01"
                              value={item.thisMonthAmount}
                              onChange={(event) =>
                                updateLineItem(item.id, "thisMonthAmount", event.target.value)
                              }
                              className="h-9 min-w-24 text-right"
                            />
                          </InlineTableCell>
                          <InlineTableCell align="right" numeric className="text-sm">
                            {item.thisMonthPercent}%
                          </InlineTableCell>
                          <InlineTableCell align="right" numeric className="text-sm">
                            {formatCurrency(item.totalCompleted)}
                          </InlineTableCell>
                          <InlineTableCell align="right" numeric className="text-sm">
                            {item.percentComplete}%
                          </InlineTableCell>
                          <InlineTableCell align="right" numeric className="text-sm">
                            {formatCurrency(item.retention)}
                          </InlineTableCell>
                          <InlineTableCell
                            align="right"
                            numeric
                            className="text-sm font-medium text-foreground"
                          >
                            {formatCurrency(item.netDue)}
                          </InlineTableCell>
                          <InlineTableCell align="right">
                            {lineItems.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeLineItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            ) : null}
                          </InlineTableCell>
                        </InlineTableRow>
                      ))}
                    </InlineTableBody>
                    <InlineTableFooter>
                      <InlineTableFooterRow type="totals">
                        <InlineTableFooterCell />
                        <InlineTableFooterCell colSpan={5} className="text-xs">
                          Totals
                        </InlineTableFooterCell>
                        <InlineTableFooterCell align="right" numeric>
                          {formatCurrency(totals.totalCompleted)}
                        </InlineTableFooterCell>
                        <InlineTableFooterCell />
                        <InlineTableFooterCell align="right" numeric>
                          {formatCurrency(totals.retentionAmount)}
                        </InlineTableFooterCell>
                        <InlineTableFooterCell align="right" numeric className="text-foreground">
                          {formatCurrency(totals.netDue)}
                        </InlineTableFooterCell>
                        <InlineTableFooterCell />
                      </InlineTableFooterRow>
                    </InlineTableFooter>
                  </InlineTable>
                </div>

                <Button type="button" variant="outline" onClick={addLineItem}>
                  <Plus className="h-4 w-4" />
                  Add Line Item
                </Button>
              </div>
            </FormSection>

            <FormSection title="Invoice Summary">
              <FormGrid columns={2} className="gap-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Contract Amount</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(totals.contractAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Previously Billed</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(totals.previouslyBilled)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">This Month Billing</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(totals.thisMonthBilling)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/70 pt-3 text-sm">
                    <span className="font-medium text-foreground">Total Completed to Date</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(totals.totalCompleted)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Current Billing</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(totals.thisMonthBilling)}
                    </span>
                  </div>
                  {includeRetention ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Retention ({Math.round(retentionPercentValue * 100) / 100}%)
                      </span>
                      <span className="font-medium tabular-nums text-destructive">
                        -{formatCurrency(totals.retentionAmount)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-t border-border/70 pt-3">
                    <span className="text-base font-semibold">Net Due</span>
                    <span className="text-lg font-semibold tabular-nums">
                      {formatCurrency(totals.netDue)}
                    </span>
                  </div>
                </div>
              </FormGrid>
            </FormSection>

            <FormServerError message={form.formState.errors.root?.message} />

            <FormActions
              submitLabel="Create Invoice"
              isSubmitting={form.formState.isSubmitting}
              submitDisabled={
                billingPeriodsLoading ||
                Boolean(billingPeriodsError) ||
                billingPeriodOptions.length === 0
              }
              onCancel={() => router.push(`/${projectId}/invoices`)}
              stickyOnMobile
            />
          </form>
        </Form>
      </FormContainer>
    </PageShell>
  );
}
