"use client";

import * as React from "react";
import { Plus, X, ArrowRight, FileText } from "lucide-react";
import {
  useFieldArray,
  useWatch,
  type UseFormReturn,
} from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ds";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { FormSection, FormGrid, FormTotalRow } from "@/components/forms";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFFieldArrayTable } from "@/components/forms/fields/RHFFieldArrayTable";
import { RHFMoneyField } from "@/components/forms/fields/RHFMoneyField";
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import { formatCurrency } from "@/lib/utils";
import type { ChangeEvent } from "@/types/change-events";
import type { PCO } from "@/hooks/use-pcos";

// =============================================================================
// Schema — canonical PCO form contract. RHF value shape. Preserved field names.
// =============================================================================

const groupedCESchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  type: z.string(),
  estimatedAmount: z.number(),
});

const lineItemSchema = z.object({
  tempId: z.string(),
  description: z.string(),
  // nullish: RHFNumberField emits null on empty, RHFMoneyField emits undefined.
  // Both are coerced to 0 in the payload builders, matching the legacy `|| 0`.
  quantity: z.number().nullish(),
  uom: z.string(),
  unitCost: z.number().nullish(),
  category: z.string(),
});

export const pcoFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["CLIENT_REQUESTED", "INTERNAL", "MIXED"]),
  description: z.string(),
  rfqRequired: z.boolean(),
  changeReason: z.string(),
  location: z.string(),
  reference: z.string(),
  requestReceivedFrom: z.string(),
  dueDate: z.string(),
  isPrivate: z.boolean(),
  fieldChange: z.boolean(),
  paidInFull: z.boolean(),
  markupPercentage: z.number().nullish(),
  changeEvents: z.array(groupedCESchema),
  lineItems: z.array(lineItemSchema),
});

export type PCOFormValues = z.infer<typeof pcoFormSchema>;
export type GroupedCE = z.infer<typeof groupedCESchema>;
export type LocalLineItem = z.infer<typeof lineItemSchema>;

const TYPE_OPTIONS = [
  { value: "CLIENT_REQUESTED", label: "Client Requested" },
  { value: "INTERNAL", label: "Internal" },
  { value: "MIXED", label: "Mixed" },
];

// =============================================================================
// Defaults / hydration / payload builders — one source of truth so the create
// and edit surfaces stay byte-for-byte identical in what they send.
// =============================================================================

export function getPcoFormDefaults(): PCOFormValues {
  return {
    title: "",
    type: "CLIENT_REQUESTED",
    description: "",
    rfqRequired: false,
    changeReason: "",
    location: "",
    reference: "",
    requestReceivedFrom: "",
    dueDate: "",
    isPrivate: false,
    fieldChange: false,
    paidInFull: false,
    markupPercentage: 0,
    changeEvents: [],
    lineItems: [],
  };
}

/** Edit-mode hydration: map a fetched PCO onto the RHF value shape. */
export function mapPcoToFormValues(pco: PCO): PCOFormValues {
  return {
    title: pco.title ?? "",
    type: pco.type ?? "CLIENT_REQUESTED",
    description: pco.description ?? "",
    rfqRequired: pco.rfq_required ?? false,
    changeReason: pco.change_reason ?? "",
    location: pco.location ?? "",
    reference: pco.reference ?? "",
    requestReceivedFrom: pco.request_received_from ?? "",
    dueDate: pco.due_date ?? "",
    isPrivate: pco.is_private ?? false,
    fieldChange: pco.field_change ?? false,
    paidInFull: pco.paid_in_full ?? false,
    markupPercentage: pco.markup_percentage ?? 0,
    changeEvents: (pco.change_events ?? []).map((ce) => ({
      id: String(ce.id),
      number: ce.number,
      title: ce.title,
      type: ce.type,
      estimatedAmount: ce.estimated_amount ?? 0,
    })),
    lineItems: (pco.line_items ?? []).map((li) => ({
      tempId: String(li.id),
      description: li.description ?? "",
      quantity: li.quantity ?? 1,
      uom: li.uom ?? "EA",
      unitCost: li.unit_cost ?? 0,
      category: li.category ?? "",
    })),
  };
}

function computeTotals(values: PCOFormValues) {
  const subtotal = values.lineItems.reduce(
    (sum, li) => sum + (li.quantity ?? 0) * (li.unitCost ?? 0),
    0,
  );
  const markupAmount = subtotal * ((values.markupPercentage ?? 0) / 100);
  const total = subtotal + markupAmount;
  return { subtotal, markupAmount, total };
}

/**
 * POST body for `useCreatePCO`. Shape preserved exactly from the original
 * create page (line items carry `line_amount`, no `id`). The API groups the
 * change events and line items after creation.
 */
export function buildPcoCreatePayload(
  values: PCOFormValues,
  opts?: { submit?: boolean },
) {
  const { total } = computeTotals(values);
  const payload = {
    title: values.title.trim(),
    type: values.type,
    description: values.description.trim() || null,
    rfq_required: values.rfqRequired,
    markup_percentage: values.markupPercentage || null,
    estimated_value: total,
    change_reason: values.changeReason.trim() || null,
    location: values.location.trim() || null,
    reference: values.reference.trim() || null,
    request_received_from: values.requestReceivedFrom.trim() || null,
    due_date: values.dueDate || null,
    is_private: values.isPrivate,
    field_change: values.fieldChange,
    paid_in_full: values.paidInFull,
    change_event_ids: values.changeEvents.map((ce) => ce.id),
    line_items: values.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity ?? 0,
      uom: li.uom,
      unit_cost: li.unitCost ?? 0,
      line_amount: (li.quantity ?? 0) * (li.unitCost ?? 0),
      category: li.category || null,
    })),
  };
  return opts?.submit ? { ...payload, status: "SUBMITTED" as const } : payload;
}

/**
 * PUT body for the `/pcos/[pcoId]/atomic` transactional update. Shape preserved
 * exactly from the original edit page: existing line items carry a numeric `id`,
 * new rows omit it (anything not listed is deleted server-side); no `line_amount`.
 */
export function buildPcoUpdatePayload(
  values: PCOFormValues,
  opts?: { submit?: boolean },
) {
  const { total } = computeTotals(values);
  return {
    title: values.title.trim(),
    type: values.type,
    description: values.description.trim() || null,
    rfq_required: values.rfqRequired,
    markup_percentage: values.markupPercentage || null,
    estimated_value: total,
    change_reason: values.changeReason.trim() || null,
    location: values.location.trim() || null,
    reference: values.reference.trim() || null,
    request_received_from: values.requestReceivedFrom.trim() || null,
    due_date: values.dueDate || null,
    is_private: values.isPrivate,
    field_change: values.fieldChange,
    paid_in_full: values.paidInFull,
    ...(opts?.submit ? { status: "SUBMITTED" as const } : {}),
    // Full desired set of grouped change events (CE uuid ids).
    change_event_ids: values.changeEvents.map((ce) => ce.id),
    // Full desired set of line items. Existing rows carry a numeric id; new
    // rows (UUID tempId) omit it. Anything not listed is deleted.
    line_items: values.lineItems.map((li) => ({
      ...(isNaN(Number(li.tempId)) ? {} : { id: Number(li.tempId) }),
      description: li.description,
      quantity: li.quantity ?? 0,
      uom: li.uom,
      unit_cost: li.unitCost ?? 0,
      category: li.category || null,
    })),
  };
}

function createLineItem(): LocalLineItem {
  return {
    tempId: crypto.randomUUID(),
    description: "",
    quantity: 1,
    uom: "EA",
    unitCost: 0,
    category: "",
  };
}

// =============================================================================
// Form body — rendered inside the page's <Form {...form}> wrapper.
// =============================================================================

interface PCOWorkspaceProps {
  form: UseFormReturn<PCOFormValues>;
  availableChangeEvents: ChangeEvent[];
  isLoadingCEs: boolean;
}

export function PCOWorkspace({
  form,
  availableChangeEvents,
  isLoadingCEs,
}: PCOWorkspaceProps) {
  const [ceSearch, setCeSearch] = React.useState("");

  // Field array drives append/remove; values are read via watch so our own
  // `id` on each row survives (useFieldArray injects its own `id` for keys).
  const ceArray = useFieldArray({ control: form.control, name: "changeEvents" });
  const groupedCEs = (useWatch({ control: form.control, name: "changeEvents" }) ??
    []) as GroupedCE[];
  const watchedLineItems = (useWatch({
    control: form.control,
    name: "lineItems",
  }) ?? []) as LocalLineItem[];
  const watchedMarkup =
    (useWatch({ control: form.control, name: "markupPercentage" }) as
      | number
      | null) ?? 0;

  const groupedIds = new Set(groupedCEs.map((ce) => String(ce.id)));
  const filteredCEs = React.useMemo(() => {
    const search = ceSearch.toLowerCase().trim();
    return availableChangeEvents.filter((ce) => {
      if (groupedIds.has(String(ce.id))) return false;
      if (!search) return true;
      const num = ce.number ?? "";
      return (
        num.toLowerCase().includes(search) ||
        (ce.title ?? "").toLowerCase().includes(search)
      );
    });
  }, [availableChangeEvents, groupedIds, ceSearch]);

  const subtotal = watchedLineItems.reduce(
    (sum, li) => sum + (li.quantity ?? 0) * (li.unitCost ?? 0),
    0,
  );
  const markupAmount = subtotal * ((watchedMarkup ?? 0) / 100);
  const total = subtotal + markupAmount;

  function handleAddCE(ce: ChangeEvent) {
    ceArray.append({
      id: String(ce.id),
      number: ce.number ?? `CE-${ce.id}`,
      title: ce.title,
      type: ce.type,
      estimatedAmount: Number(ce.rom ?? ce.cost_rom ?? 0),
    });
  }

  return (
    <>
      <FormSection title="PCO Details">
        <FormGrid columns={2}>
          <RHFTextField
            control={form.control}
            name="title"
            label="Title *"
            placeholder="Enter PCO title"
          />
          <RHFSelectField
            control={form.control}
            name="type"
            label="Type"
            placeholder="Select type"
            options={TYPE_OPTIONS}
          />
        </FormGrid>

        <RHFTextareaField
          control={form.control}
          name="description"
          label="Description"
          placeholder="Describe this potential change order..."
          rows={3}
        />

        <RHFCheckboxField
          control={form.control}
          name="rfqRequired"
          label="RFQ Required"
        />
      </FormSection>

      <FormSection
        title="Change Events"
        description="Group the change events this PCO covers."
        actions={
          <ExpandableSearch
            value={ceSearch}
            onChange={setCeSearch}
            placeholder="Search change events..."
          />
        }
      >
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Available ({filteredCEs.length})
          </p>
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {isLoadingCEs ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Loading change events...
              </p>
            ) : filteredCEs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No ungrouped change events available.
              </p>
            ) : (
              filteredCEs.map((ce) => (
                <div
                  key={String(ce.id)}
                  className="flex items-center gap-3 rounded-md bg-muted/40 px-3 py-2.5"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {ce.number ?? `CE-${ce.id}`}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ce.title}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddCE(ce)}
                    className="shrink-0"
                  >
                    Add
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {groupedCEs.length === 0 ? (
          <EmptyState
            icon={<Plus />}
            title="No change events grouped yet"
            description="Add change events from the list above."
          />
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Grouped ({groupedCEs.length})
            </p>
            {groupedCEs.map((ce, index) => (
              <div
                key={ce.id}
                className="flex items-center space-x-3 rounded-md bg-muted/40 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {ce.number} &mdash; {ce.title}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => ceArray.remove(index)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      <FormSection title="Line Items">
        <RHFFieldArrayTable
          control={form.control}
          name="lineItems"
          addLabel="Add Line Item"
          minRows={0}
          createRow={createLineItem}
          columns={[
            {
              key: "description",
              header: "Description",
              mobileLabel: "Description",
              className: "min-w-[240px]",
              cell: ({ rowName }) => (
                <RHFTextField
                  control={form.control}
                  name={`${rowName}.description`}
                  label="Description"
                  placeholder="Line item description"
                />
              ),
            },
            {
              key: "quantity",
              header: "Qty",
              mobileLabel: "Qty",
              className: "w-24",
              cell: ({ rowName }) => (
                <RHFNumberField
                  control={form.control}
                  name={`${rowName}.quantity`}
                  label="Qty"
                  min={0}
                />
              ),
            },
            {
              key: "uom",
              header: "UOM",
              mobileLabel: "UOM",
              className: "w-24",
              cell: ({ rowName }) => (
                <RHFTextField
                  control={form.control}
                  name={`${rowName}.uom`}
                  label="UOM"
                  placeholder="EA"
                />
              ),
            },
            {
              key: "unitCost",
              header: "Unit Cost",
              mobileLabel: "Unit Cost",
              className: "w-36",
              cell: ({ rowName }) => (
                <RHFMoneyField
                  control={form.control}
                  name={`${rowName}.unitCost`}
                  label="Unit Cost"
                  min={0}
                />
              ),
            },
            {
              key: "amount",
              header: "Amount",
              mobileLabel: "Amount",
              className: "w-32",
              cell: ({ index }) => {
                const li = watchedLineItems[index];
                const amount = (li?.quantity ?? 0) * (li?.unitCost ?? 0);
                return (
                  <span className="block text-sm font-medium tabular-nums text-foreground">
                    {formatCurrency(amount)}
                  </span>
                );
              },
            },
            {
              key: "category",
              header: "Category",
              mobileLabel: "Category",
              className: "w-40",
              cell: ({ rowName }) => (
                <RHFTextField
                  control={form.control}
                  name={`${rowName}.category`}
                  label="Category"
                  placeholder="Category"
                />
              ),
            },
          ]}
        />
      </FormSection>

      <FormSection title="Financial Summary">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatCurrency(subtotal)}
          </span>
        </div>

        <div className="max-w-48">
          <RHFNumberField
            control={form.control}
            name="markupPercentage"
            label="Markup %"
            min={0}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Markup Amount</span>
          <span className="tabular-nums text-foreground">
            {formatCurrency(markupAmount)}
          </span>
        </div>

        <FormTotalRow label="Total" value={formatCurrency(total)} />
      </FormSection>

      <FormSection title="Additional Details">
        <FormGrid columns={2}>
          <RHFTextField
            control={form.control}
            name="changeReason"
            label="Change Reason"
            placeholder="Reason for change"
          />
          <RHFTextField
            control={form.control}
            name="location"
            label="Location"
            placeholder="Location"
          />
          <RHFTextField
            control={form.control}
            name="reference"
            label="Reference"
            placeholder="Reference number or note"
          />
          <RHFTextField
            control={form.control}
            name="requestReceivedFrom"
            label="Request Received From"
            placeholder="Name or company"
          />
          <RHFDateField
            control={form.control}
            name="dueDate"
            label="Due Date"
          />
        </FormGrid>

        <FormGrid columns={3}>
          <RHFCheckboxField
            control={form.control}
            name="isPrivate"
            label="Private"
          />
          <RHFCheckboxField
            control={form.control}
            name="fieldChange"
            label="Field Change"
          />
          <RHFCheckboxField
            control={form.control}
            name="paidInFull"
            label="Paid in Full"
          />
        </FormGrid>
      </FormSection>
    </>
  );
}
