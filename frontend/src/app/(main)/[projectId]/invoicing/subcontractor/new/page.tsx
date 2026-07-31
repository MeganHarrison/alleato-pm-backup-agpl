"use client";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { FormContainer, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Form } from "@/components/ui/form";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { FormGrid, FormSection } from "@/components/forms";
import { RHFComboboxField } from "@/components/forms/fields/RHFComboboxField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { MoneyField } from "@/components/forms/MoneyField";
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
import {
  calculateCompletionPercentFromCurrentAmount,
  calculateCurrentAmountFromCompletionPercent,
  validateCurrentAmount,
} from "@/lib/invoicing/subcontractor-percent-autofill";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SovItem {
  id: string;
  budget_code: string | null;
  description: string;
  scheduled_value: number;
  from_previous: number; // gross_billed_to_date from commitment
  retainage_pct: number;
  line_number: number | null;
}

interface ApprovedCO {
  id: string;
  change_order_number: string;
  title: string | null;
  amount: number;
  description: string | null;
}

interface SovEdit {
  completion_percent: string;
  work_completed_period: string;
  materials_stored: string;
}

type BillingEdit = SovEdit;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function formatCurrency(v: number) {
  return fmt.format(v);
}

function pct(value: number, total: number) {
  if (total === 0) return "0.00%";
  return `${((value / total) * 100).toFixed(2)}%`;
}

function parseNum(s: string) {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function formatPercentInput(value: number) {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, "") : "0";
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const subInvoiceFormSchema = z.object({
  pickerType: z.enum(["subcontract", "purchase_order"]),
  pickerCommitmentId: z.string(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  billingDate: z.string().nullable(),
  invoiceNumber: z.string(),
});

type SubInvoiceFormValues = z.infer<typeof subInvoiceFormSchema>;

const COMMITMENT_TYPE_OPTIONS = [
  { value: "subcontract", label: "Subcontract" },
  { value: "purchase_order", label: "Purchase Order" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface CommitmentOption {
  id: string;
  contract_number: string | null;
  title: string | null;
  company_name: string | null;
}

export default function NewSubcontractorInvoicePage() {
  const router = useRouter();
  const params = useParams()!;
  const searchParams = useSearchParams()!;
  const projectId = params.projectId as string;

  // URL-provided commitment context (from commitment detail page)
  const urlCommitmentId = searchParams.get("commitmentId");
  const urlCommitmentType = searchParams.get("commitmentType");

  const form = useForm<SubInvoiceFormValues>({
    resolver: zodResolver(subInvoiceFormSchema),
    defaultValues: {
      pickerType: "subcontract",
      pickerCommitmentId: "",
      periodStart: "",
      periodEnd: "",
      billingDate: "",
      invoiceNumber: "",
    },
  });

  // Picklist options (used when no URL commitment)
  const [subcontracts, setSubcontracts] = useState<CommitmentOption[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<CommitmentOption[]>([]);
  const [picklistLoading, setPicklistLoading] = useState(false);

  const pickerType = form.watch("pickerType");
  const pickerCommitmentId = form.watch("pickerCommitmentId");

  // Resolved effective values (URL params take priority)
  const commitmentId = urlCommitmentId ?? (pickerCommitmentId || null);
  const commitmentType = urlCommitmentType ?? pickerType;

  // SOV line item edits: { [itemId]: { work_completed_period, materials_stored } }
  const [sovEdits, setSovEdits] = useState<Record<string, SovEdit>>({});
  const [coEdits, setCoEdits] = useState<Record<string, BillingEdit>>({});

  // Loaded data
  const [contractInfo, setContractInfo] = useState<{
    number: string;
    title: string;
    company: string;
  } | null>(null);
  const [sovItems, setSovItems] = useState<SovItem[]>([]);
  const [approvedCOs, setApprovedCOs] = useState<ApprovedCO[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Switching commitment type clears the previously selected contract.
  const previousPickerType = useRef(pickerType);
  useEffect(() => {
    if (previousPickerType.current === pickerType) return;
    previousPickerType.current = pickerType;
    form.setValue("pickerCommitmentId", "");
  }, [pickerType, form]);

  // ---------------------------------------------------------------------------
  // Load picklist options when no URL commitment provided
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (urlCommitmentId || !projectId) return;
    setPicklistLoading(true);
    type PicklistItem = {
      id: string;
      contract_number?: string | null;
      title?: string | null;
      company_name?: string | null;
      companies?: { name?: string | null } | null;
    };
    type PicklistResponse = { data?: PicklistItem[] } | PicklistItem[];
    Promise.all([
      apiFetch<PicklistResponse>(`/api/projects/${projectId}/subcontracts`),
      apiFetch<PicklistResponse>(`/api/projects/${projectId}/purchase-orders`),
    ])
      .then(([scJson, poJson]) => {
        const mapOption = (item: PicklistItem): CommitmentOption => ({
          id: item.id,
          contract_number: item.contract_number ?? null,
          title: item.title ?? null,
          company_name: item.company_name ?? item.companies?.name ?? null,
        });
        const toList = (json: PicklistResponse): PicklistItem[] =>
          Array.isArray(json) ? json : (json as { data?: PicklistItem[] }).data ?? [];
        setSubcontracts(toList(scJson).map(mapOption));
        setPurchaseOrders(toList(poJson).map(mapOption));
      })
      .catch((err: unknown) => toast.error(err instanceof Error && err.message ? err.message : "Failed to load commitments"))
      .finally(() => setPicklistLoading(false));
  }, [projectId, urlCommitmentId]);

  // ---------------------------------------------------------------------------
  // Load commitment data (SOV + COs) when a commitment is selected
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!commitmentId || !projectId) {
      return;
    }

    setLoading(true);
    setSovItems([]);
    setSovEdits({});
    setCoEdits({});
    setApprovedCOs([]);
    setContractInfo(null);

    async function load() {
      try {
        const [detailJson, invoicesJson, cosJson] = await Promise.all([
          apiFetch<Record<string, unknown>>(`/api/commitments/${commitmentId}`),
          apiFetch<Record<string, unknown>>(`/api/commitments/${commitmentId}/invoices`),
          apiFetch<Record<string, unknown>>(`/api/commitments/${commitmentId}/change-orders`),
        ]);

        // Commitment details
        const d = (detailJson as { data?: Record<string, unknown> }).data ?? detailJson;
        setContractInfo({
          number: (d?.contract_number as string) ?? "",
          title: (d?.title as string) ?? "",
          company:
            (d?.contract_company_name as string) ??
            (d?.company_name as string) ??
            ((d?.companies as { name?: string } | null)?.name) ??
            "",
        });

        // SOV items (with previous billing amounts)
        const invoiceData = invoicesJson as { line_items?: Array<{
          id: string;
          budget_code?: string | null;
          description?: string;
          scheduled_value?: number;
          gross_billed_to_date?: number;
          retainage_percentage?: number;
          line_number?: number | null;
        }> };
        const items: SovItem[] = (invoiceData.line_items ?? []).map((li) => ({
          id: li.id,
          budget_code: li.budget_code ?? null,
          description: li.description ?? "",
          scheduled_value: Number(li.scheduled_value ?? 0),
          from_previous: Number(li.gross_billed_to_date ?? 0),
          retainage_pct: Number(li.retainage_percentage ?? 0),
          line_number: li.line_number ?? null,
        }));
        setSovItems(items);

        // Seed edits at zero
        const edits: Record<string, SovEdit> = {};
        for (const item of items) {
          edits[item.id] = {
            completion_percent: formatPercentInput(
              calculateCompletionPercentFromCurrentAmount({
                scheduledValue: item.scheduled_value,
                previouslyBilled: item.from_previous,
                currentAmount: 0,
              }),
            ),
            work_completed_period: "",
            materials_stored: "",
          };
        }
        setSovEdits(edits);

        // Approved change orders only
        const cosData = cosJson as { data?: Array<{
          id: string;
          status?: string;
          change_order_number?: string;
          title?: string | null;
          amount?: number;
          description?: string | null;
        }> };
        const approved: ApprovedCO[] = (cosData.data ?? [])
          .filter((co) => co.status?.toLowerCase() === "approved")
          .map((co) => ({
            id: co.id,
            change_order_number: co.change_order_number ?? "",
            title: co.title ?? null,
            amount: Number(co.amount ?? 0),
            description: co.description ?? null,
          }));
        setApprovedCOs(approved);
        setCoEdits(
          Object.fromEntries(
            approved.map((co) => [
              co.id,
              {
                completion_percent: "0",
                work_completed_period: "",
                materials_stored: "",
              },
            ]),
          ),
        );
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : "Failed to load commitment data";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [commitmentId, projectId]);

  // ---------------------------------------------------------------------------
  // Computed totals (live)
  // ---------------------------------------------------------------------------

  const totals = useMemo(() => {
    return sovItems.reduce(
      (acc, item) => {
        const e = sovEdits[item.id] ?? {
          completion_percent: "0",
          work_completed_period: "",
          materials_stored: "",
        };
        acc.scheduled += item.scheduled_value;
        acc.fromPrevious += item.from_previous;
        acc.thisPeriod += parseNum(e.work_completed_period);
        acc.materialsStored += parseNum(e.materials_stored);
        return acc;
      },
      { scheduled: 0, fromPrevious: 0, thisPeriod: 0, materialsStored: 0 },
    );
  }, [sovItems, sovEdits]);

  const coTotals = useMemo(() => {
    return approvedCOs.reduce(
      (acc, co) => {
        const e = coEdits[co.id] ?? {
          completion_percent: "0",
          work_completed_period: "",
          materials_stored: "",
        };
        acc.scheduled += co.amount;
        acc.thisPeriod += parseNum(e.work_completed_period);
        acc.materialsStored += parseNum(e.materials_stored);
        return acc;
      },
      { scheduled: 0, fromPrevious: 0, thisPeriod: 0, materialsStored: 0 },
    );
  }, [approvedCOs, coEdits]);

  const sovRowErrors = useMemo(
    () =>
      Object.fromEntries(
        sovItems.map((item) => {
          const edit = sovEdits[item.id] ?? {
            completion_percent: "0",
            work_completed_period: "",
            materials_stored: "",
          };

          const validation = validateCurrentAmount({
            scheduledValue: item.scheduled_value,
            previouslyBilled: item.from_previous,
            currentAmount: parseNum(edit.work_completed_period),
          });

          return [item.id, validation.error];
        }),
      ) as Record<string, string | null>,
    [sovEdits, sovItems],
  );

  const coRowErrors = useMemo(
    () =>
      Object.fromEntries(
        approvedCOs.map((co) => {
          const edit = coEdits[co.id] ?? {
            completion_percent: "0",
            work_completed_period: "",
            materials_stored: "",
          };

          const validation = validateCurrentAmount({
            scheduledValue: co.amount,
            previouslyBilled: 0,
            currentAmount: parseNum(edit.work_completed_period),
          });

          return [co.id, validation.error];
        }),
      ) as Record<string, string | null>,
    [approvedCOs, coEdits],
  );

  const formErrors = [
    ...Object.values(sovRowErrors).filter((error): error is string => Boolean(error)),
    ...Object.values(coRowErrors).filter((error): error is string => Boolean(error)),
  ];

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleAction(status: "draft" | "under_review") {
    if (!commitmentId) {
      toast.error("No commitment selected");
      return;
    }
    if (formErrors.length > 0) {
      toast.error(formErrors[0]);
      return;
    }
    const values = form.getValues();
    setSubmitting(true);
    try {
      const lineItems = sovItems.map((item) => {
        const e = sovEdits[item.id] ?? {
          completion_percent: "0",
          work_completed_period: "",
          materials_stored: "",
        };
        return {
          description: item.description,
          budget_code: item.budget_code,
          scheduled_value: item.scheduled_value,
          work_completed_previous: item.from_previous,
          work_completed_period: parseNum(e.work_completed_period),
          materials_stored: parseNum(e.materials_stored),
          retainage_pct: item.retainage_pct,
          materials_retainage_pct: 0,
          sort_order: item.line_number ?? 0,
        };
      });

      const coLineItems = approvedCOs
        .map((co, index) => {
          const e = coEdits[co.id] ?? {
            completion_percent: "0",
            work_completed_period: "",
            materials_stored: "",
          };
          const label = [co.change_order_number, co.title ?? co.description]
            .filter(Boolean)
            .join(" - ");
          return {
            description: label || "Approved Commitment Change Order",
            budget_code: co.change_order_number || null,
            scheduled_value: co.amount,
            work_completed_previous: 0,
            work_completed_period: parseNum(e.work_completed_period),
            materials_stored: parseNum(e.materials_stored),
            retainage_pct: 0,
            materials_retainage_pct: 0,
            sort_order: sovItems.length + index + 1,
            line_item_type: "Change Order",
            commitment_value: 0,
            change_value: co.amount,
          };
        })
        .filter(
          (item) =>
            item.work_completed_period > 0 ||
            item.materials_stored > 0,
        );

      const contractKey =
        commitmentType === "subcontract" ? "subcontract_id" : "purchase_order_id";

      const body = {
        [contractKey]: commitmentId,
        period_start: values.periodStart || null,
        period_end: values.periodEnd || null,
        billing_date: values.billingDate || null,
        invoice_number: values.invoiceNumber || null,
        status,
        line_items: [...lineItems, ...coLineItems],
      };

      const result = await apiFetch<{ data: { id: string | number } }>(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      toast.success(
        status === "under_review"
          ? "Invoice submitted for approval"
          : "Draft saved",
      );
      router.push(`/${projectId}/invoicing/subcontractor/${result.data.id}`);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Failed to save invoice";
      form.setError("root", { type: "server", message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived render data
  // ---------------------------------------------------------------------------

  const pickerOptions = pickerType === "subcontract" ? subcontracts : purchaseOrders;

  const pickerComboOptions = useMemo(
    () =>
      pickerOptions.map((opt) => ({
        value: opt.id,
        label: `${[opt.contract_number, opt.title].filter(Boolean).join(" — ")}${
          opt.company_name ? ` (${opt.company_name})` : ""
        }`,
      })),
    [pickerOptions],
  );

  const subtitle = contractInfo
    ? [contractInfo.number, contractInfo.company].filter(Boolean).join(" — ")
    : undefined;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PageShell
      variant="form"
      title="Create New Invoice"
      description={subtitle}
      onBack={() => router.push(`/${projectId}/invoices?tab=subcontractor`)}
      backLabel="Back to Invoices"
    >
      <FormContainer maxWidth="lg" withCard={false}>
        <Form {...form}>
          <form
            noValidate
            onSubmit={form.handleSubmit(() => handleAction("under_review"))}
            className="space-y-8"
          >
            {!urlCommitmentId ? (
              <FormSection title="Commitment">
                <FormGrid columns={2}>
                  <RHFSelectField
                    control={form.control}
                    name="pickerType"
                    label="Commitment Type"
                    placeholder="Select commitment type"
                    options={COMMITMENT_TYPE_OPTIONS}
                  />

                  <RHFComboboxField
                    control={form.control}
                    name="pickerCommitmentId"
                    label="Contract"
                    placeholder={picklistLoading ? "Loading…" : "Select a contract"}
                    searchPlaceholder="Search contracts..."
                    emptyMessage={
                      pickerType === "subcontract"
                        ? "No subcontracts found."
                        : "No purchase orders found."
                    }
                    options={pickerComboOptions}
                    disabled={picklistLoading || pickerComboOptions.length === 0}
                  />
                </FormGrid>
              </FormSection>
            ) : null}

            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading commitment data…
              </div>
            ) : !commitmentId ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Select a contract above to load the Schedule of Values.
              </div>
            ) : (
              <>
                <FormSection title="Invoice Details">
                  <FormGrid columns={2}>
                    <RHFDateField
                      control={form.control}
                      name="periodStart"
                      label="Period Start"
                      nullable
                    />
                    <RHFDateField
                      control={form.control}
                      name="periodEnd"
                      label="Period End"
                      nullable
                    />
                    <RHFDateField
                      control={form.control}
                      name="billingDate"
                      label="Billing Date"
                      nullable
                    />
                    <RHFTextField
                      control={form.control}
                      name="invoiceNumber"
                      label="Invoice #"
                      placeholder="Auto-assigned if blank"
                      maxLength={255}
                    />
                  </FormGrid>
                </FormSection>

                <FormSection title="Complete Schedule of Values">
                  <InlineTable
                    variant="edit"
                    className="rounded-lg border border-border/70 bg-muted/20 px-2"
                    tableClassName="min-w-[880px]"
                  >
                    <InlineTableHeader>
                      <InlineTableHeaderRow className="border-b border-border/60">
                        <InlineTableHeaderCell className="w-28">Subjob</InlineTableHeaderCell>
                        <InlineTableHeaderCell>Description of Work</InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-32">
                          Value
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-40">
                          From Previous Application
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-16">
                          %
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-40">
                          From This Period
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-40">
                          Materials Presently Stored
                        </InlineTableHeaderCell>
                      </InlineTableHeaderRow>
                    </InlineTableHeader>
                    <InlineTableBody>
                      {sovItems.length === 0 ? (
                        <InlineTableRow>
                          <InlineTableCell
                            colSpan={7}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No schedule of values found for this commitment.
                          </InlineTableCell>
                        </InlineTableRow>
                      ) : (
                        sovItems.map((item) => {
                          const e = sovEdits[item.id] ?? {
                            completion_percent: "0",
                            work_completed_period: "",
                            materials_stored: "",
                          };
                          return (
                            <InlineTableRow key={item.id}>
                              <InlineTableCell className="text-sm text-muted-foreground">
                                {item.budget_code ?? "N/A"}
                              </InlineTableCell>
                              <InlineTableCell className="text-sm">
                                {item.description}
                              </InlineTableCell>
                              <InlineTableCell align="right" numeric className="text-sm">
                                {formatCurrency(item.scheduled_value)}
                              </InlineTableCell>
                              <InlineTableCell align="right" numeric className="text-sm">
                                {formatCurrency(item.from_previous)}
                              </InlineTableCell>
                              <InlineTableCell align="right" className="text-muted-foreground">
                                <NumberInput
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  decimals={2}
                                  formatOnBlur={false}
                                  autoSelectOnFocus
                                  clearZeroOnFocus
                                  aria-label={`Percent complete for ${item.description}`}
                                  className="ml-auto h-8 w-20 text-right tabular-nums text-sm"
                                  value={e.completion_percent}
                                  onChange={(ev) => {
                                    const nextPercent = ev.target.value;
                                    setSovEdits((prev) => {
                                      const next = {
                                        ...prev,
                                        [item.id]: {
                                          ...prev[item.id],
                                          completion_percent: nextPercent,
                                        },
                                      };

                                      if (nextPercent.trim() === "") {
                                        return next;
                                      }

                                      const calculated = calculateCurrentAmountFromCompletionPercent({
                                        scheduledValue: item.scheduled_value,
                                        previouslyBilled: item.from_previous,
                                        completionPercent: parseNum(nextPercent),
                                      });

                                      if (calculated.error) {
                                        return next;
                                      }

                                      next[item.id] = {
                                        ...next[item.id],
                                        work_completed_period:
                                          calculated.amount == null ? "" : String(calculated.amount),
                                      };
                                      return next;
                                    });
                                  }}
                                />
                              </InlineTableCell>
                              <InlineTableCell align="right">
                                <MoneyField
                                  label={`${item.description} work completed this period`}
                                  inline
                                  showCurrency={false}
                                  clearZeroOnFocus
                                  className="h-8 w-28 text-sm"
                                  value={
                                    e.work_completed_period
                                      ? parseNum(e.work_completed_period)
                                      : undefined
                                  }
                                  placeholder=""
                                  onChange={(value) =>
                                    setSovEdits((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        completion_percent: formatPercentInput(
                                          calculateCompletionPercentFromCurrentAmount({
                                            scheduledValue: item.scheduled_value,
                                            previouslyBilled: item.from_previous,
                                            currentAmount: value ?? 0,
                                          }),
                                        ),
                                        work_completed_period:
                                          value == null ? "" : String(value),
                                      },
                                    }))
                                  }
                                />
                                {sovRowErrors[item.id] ? (
                                  <p className="mt-1 text-xs text-destructive">
                                    {sovRowErrors[item.id]}
                                  </p>
                                ) : null}
                              </InlineTableCell>
                              <InlineTableCell align="right">
                                <MoneyField
                                  label={`${item.description} materials stored`}
                                  inline
                                  showCurrency={false}
                                  clearZeroOnFocus
                                  className="h-8 w-28 text-sm"
                                  value={
                                    e.materials_stored
                                      ? parseNum(e.materials_stored)
                                      : undefined
                                  }
                                  placeholder=""
                                  onChange={(value) =>
                                    setSovEdits((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        materials_stored:
                                          value == null ? "" : String(value),
                                      },
                                    }))
                                  }
                                />
                              </InlineTableCell>
                            </InlineTableRow>
                          );
                        })
                      )}
                    </InlineTableBody>
                    {sovItems.length > 0 ? (
                      <InlineTableFooter>
                        <InlineTableFooterRow type="totals">
                          <InlineTableFooterCell colSpan={2}>Total</InlineTableFooterCell>
                          <InlineTableFooterCell align="right" numeric>
                            {formatCurrency(totals.scheduled)}
                          </InlineTableFooterCell>
                          <InlineTableFooterCell align="right" numeric>
                            {formatCurrency(totals.fromPrevious)}
                          </InlineTableFooterCell>
                          <InlineTableFooterCell align="right" numeric>
                            {pct(totals.fromPrevious + totals.thisPeriod, totals.scheduled)}
                          </InlineTableFooterCell>
                          <InlineTableFooterCell align="right" numeric>
                            {formatCurrency(totals.thisPeriod)}
                          </InlineTableFooterCell>
                          <InlineTableFooterCell align="right" numeric>
                            {formatCurrency(totals.materialsStored)}
                          </InlineTableFooterCell>
                        </InlineTableFooterRow>
                      </InlineTableFooter>
                    ) : null}
                  </InlineTable>
                </FormSection>

                <FormSection title="Approved Commitment Change Orders">
                  <InlineTable
                    variant="edit"
                    className="rounded-lg border border-border/70 bg-muted/20 px-2"
                    tableClassName="min-w-[880px]"
                  >
                    <InlineTableHeader>
                      <InlineTableHeaderRow className="border-b border-border/60">
                        <InlineTableHeaderCell>Change Order</InlineTableHeaderCell>
                        <InlineTableHeaderCell>Description of Work</InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-32">
                          Value
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-40">
                          From Previous Application
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-16">
                          %
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-40">
                          From This Period
                        </InlineTableHeaderCell>
                        <InlineTableHeaderCell align="right" className="w-40">
                          Materials Presently Stored
                        </InlineTableHeaderCell>
                      </InlineTableHeaderRow>
                    </InlineTableHeader>
                    <InlineTableBody>
                      {approvedCOs.length === 0 ? (
                        <InlineTableRow>
                          <InlineTableCell
                            colSpan={7}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            There are no approved Commitment Change Orders added to this Invoice
                          </InlineTableCell>
                        </InlineTableRow>
                      ) : (
                        approvedCOs.map((co) => {
                          const e = coEdits[co.id] ?? {
                            completion_percent: "0",
                            work_completed_period: "",
                            materials_stored: "",
                          };
                          return (
                            <InlineTableRow key={co.id}>
                              <InlineTableCell className="text-sm font-medium">
                                {co.change_order_number}
                              </InlineTableCell>
                              <InlineTableCell className="text-sm">
                                {co.title ?? co.description ?? "—"}
                              </InlineTableCell>
                              <InlineTableCell align="right" numeric className="text-sm">
                                {formatCurrency(co.amount)}
                              </InlineTableCell>
                              <InlineTableCell align="right" numeric className="text-sm">
                                {formatCurrency(0)}
                              </InlineTableCell>
                              <InlineTableCell align="right" className="text-muted-foreground">
                                <NumberInput
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  decimals={2}
                                  formatOnBlur={false}
                                  autoSelectOnFocus
                                  clearZeroOnFocus
                                  aria-label={`Percent complete for change order ${co.change_order_number}`}
                                  className="ml-auto h-8 w-20 text-right tabular-nums text-sm"
                                  value={e.completion_percent}
                                  onChange={(ev) => {
                                    const nextPercent = ev.target.value;
                                    setCoEdits((prev) => {
                                      const next = {
                                        ...prev,
                                        [co.id]: {
                                          ...prev[co.id],
                                          completion_percent: nextPercent,
                                        },
                                      };

                                      if (nextPercent.trim() === "") {
                                        return next;
                                      }

                                      const calculated = calculateCurrentAmountFromCompletionPercent({
                                        scheduledValue: co.amount,
                                        previouslyBilled: 0,
                                        completionPercent: parseNum(nextPercent),
                                      });

                                      if (calculated.error) {
                                        return next;
                                      }

                                      next[co.id] = {
                                        ...next[co.id],
                                        work_completed_period:
                                          calculated.amount == null ? "" : String(calculated.amount),
                                      };
                                      return next;
                                    });
                                  }}
                                />
                              </InlineTableCell>
                              <InlineTableCell align="right">
                                <MoneyField
                                  label={`Change order ${co.change_order_number} work completed this period`}
                                  inline
                                  showCurrency={false}
                                  clearZeroOnFocus
                                  className="h-8 w-28 text-sm"
                                  value={
                                    e.work_completed_period
                                      ? parseNum(e.work_completed_period)
                                      : undefined
                                  }
                                  placeholder=""
                                  onChange={(value) =>
                                    setCoEdits((prev) => ({
                                      ...prev,
                                      [co.id]: {
                                        ...prev[co.id],
                                        completion_percent: formatPercentInput(
                                          calculateCompletionPercentFromCurrentAmount({
                                            scheduledValue: co.amount,
                                            previouslyBilled: 0,
                                            currentAmount: value ?? 0,
                                          }),
                                        ),
                                        work_completed_period:
                                          value == null ? "" : String(value),
                                      },
                                    }))
                                  }
                                />
                                {coRowErrors[co.id] ? (
                                  <p className="mt-1 text-xs text-destructive">
                                    {coRowErrors[co.id]}
                                  </p>
                                ) : null}
                              </InlineTableCell>
                              <InlineTableCell align="right">
                                <MoneyField
                                  label={`Change order ${co.change_order_number} materials stored`}
                                  inline
                                  showCurrency={false}
                                  clearZeroOnFocus
                                  className="h-8 w-28 text-sm"
                                  value={
                                    e.materials_stored
                                      ? parseNum(e.materials_stored)
                                      : undefined
                                  }
                                  placeholder=""
                                  onChange={(value) =>
                                    setCoEdits((prev) => ({
                                      ...prev,
                                      [co.id]: {
                                        ...prev[co.id],
                                        materials_stored:
                                          value == null ? "" : String(value),
                                      },
                                    }))
                                  }
                                />
                              </InlineTableCell>
                            </InlineTableRow>
                          );
                        })
                      )}
                    </InlineTableBody>
                    {approvedCOs.length > 0 ? (
                      <InlineTableFooter>
                        <InlineTableFooterRow type="totals">
                          <InlineTableFooterCell colSpan={2}>Total</InlineTableFooterCell>
                          <InlineTableFooterCell align="right" numeric>
                            {formatCurrency(coTotals.scheduled)}
                          </InlineTableFooterCell>
                          <InlineTableFooterCell align="right" numeric>
                            {formatCurrency(coTotals.fromPrevious)}
                          </InlineTableFooterCell>
                          <InlineTableFooterCell align="right" numeric>
                            {pct(coTotals.fromPrevious + coTotals.thisPeriod, coTotals.scheduled)}
                          </InlineTableFooterCell>
                          <InlineTableFooterCell align="right" numeric>
                            {formatCurrency(coTotals.thisPeriod)}
                          </InlineTableFooterCell>
                          <InlineTableFooterCell align="right" numeric>
                            {formatCurrency(coTotals.materialsStored)}
                          </InlineTableFooterCell>
                        </InlineTableFooterRow>
                      </InlineTableFooter>
                    ) : null}
                  </InlineTable>
                </FormSection>

                <FormSection title="Attachments">
                  <p className="text-xs text-muted-foreground">
                    Files can be attached after saving the invoice.
                  </p>
                </FormSection>
              </>
            )}

            <FormServerError message={form.formState.errors.root?.message} />

            <FormActions
              submitLabel="Submit"
              isSubmitting={submitting}
              submitDisabled={formErrors.length > 0}
              onCancel={() => router.push(`/${projectId}/invoices?tab=subcontractor`)}
              stickyOnMobile
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAction("draft")}
                disabled={submitting || formErrors.length > 0}
              >
                {submitting ? "Saving…" : "Save as Draft"}
              </Button>
            </FormActions>
          </form>
        </Form>
      </FormContainer>
    </PageShell>
  );
}
