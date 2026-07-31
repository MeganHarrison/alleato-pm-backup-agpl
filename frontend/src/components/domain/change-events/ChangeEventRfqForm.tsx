"use client";

import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormSection } from "@/components/forms/FormSection";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import type { ChangeEvent } from "@/types/change-events";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChangeEventRfqFormValues {
  title: string;
  dueDate: string;
  requestDetails: string;
  distributionPersonId: string;
  includeAttachments: boolean;
  commitmentLines: Array<{
    lineItemId: string;
    lineItemDescription: string;
    scopeDescription: string;
    contractId: string;
    recipients: string;
  }>;
}

interface ChangeEventRfqFormProps {
  changeEvent: ChangeEvent;
  lineItems?: Array<{
    id: string;
    description: string | null;
    contractId?: string | null;
  }>;
  contracts?: Array<{ id: string; label: string; vendorName?: string | null }>;
  projectUsers?: Array<{ id: string; name: string; email?: string }>;
  isSubmitting?: boolean;
  onSubmit: (values: ChangeEventRfqFormValues) => Promise<void>;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDefaultTitle(changeEvent?: ChangeEvent): string {
  if (!changeEvent) return "";
  const number = changeEvent.number ?? `CE-${changeEvent.id}`;
  return `${number} - ${changeEvent.title}`;
}

function getDefaultDueDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function buildDefaultCommitmentLines(
  lineItems: Array<{
    id: string;
    description: string | null;
    contractId?: string | null;
  }>,
  contracts: Array<{ id: string; label: string; vendorName?: string | null }>,
): ChangeEventRfqFormValues["commitmentLines"] {
  return lineItems.map((item) => {
    const contractId = item.contractId ?? "";
    const contract = contracts.find((candidate) => candidate.id === contractId);
    return {
      lineItemId: item.id,
      lineItemDescription: item.description ?? "",
      scopeDescription: item.description ?? "",
      contractId,
      recipients: contract?.vendorName ?? "",
    };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChangeEventRfqForm({
  changeEvent,
  lineItems = [],
  contracts = [],
  projectUsers = [],
  isSubmitting,
  onSubmit,
  onCancel,
}: ChangeEventRfqFormProps) {
  const defaultCommitmentLines = useMemo(
    () => buildDefaultCommitmentLines(lineItems, contracts),
    [lineItems, contracts],
  );

  const form = useForm<ChangeEventRfqFormValues>({
    reValidateMode: "onBlur",
    defaultValues: {
      title: formatDefaultTitle(changeEvent),
      dueDate: getDefaultDueDate(),
      requestDetails: "",
      distributionPersonId: "",
      includeAttachments: true,
      commitmentLines: defaultCommitmentLines,
    },
  });

  const { fields, remove, replace } = useFieldArray({
    control: form.control,
    name: "commitmentLines",
  });

  useEffect(() => {
    const currentLines = form.getValues("commitmentLines");
    const currentHasContract = currentLines.some((line) => line.contractId);
    const nextHasContract = defaultCommitmentLines.some((line) => line.contractId);

    if (
      defaultCommitmentLines.length > 0 &&
      (currentLines.length === 0 || (!currentHasContract && nextHasContract))
    ) {
      replace(defaultCommitmentLines);
    }
  }, [defaultCommitmentLines, form, replace]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  // When a contract is selected, derive recipients from the contract label
  function handleContractChange(index: number, contractId: string) {
    const contract = contracts.find((c) => c.id === contractId);
    form.setValue(
      `commitmentLines.${index}.recipients`,
      contract?.vendorName ?? "",
    );
  }

  return (
    <Form {...form}>
      <form className="space-y-8" onSubmit={handleSubmit}>
        {/* ---------------------------------------------------------------- */}
        {/* Section 1 — General Information                                  */}
        {/* ---------------------------------------------------------------- */}
        <FormSection
          title="General Information"
          description="Provide the basic details for this Request for Quote."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              rules={{ required: "Title is required" }}
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="RFQ title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Due Date */}
            <RHFDateField
              control={form.control}
              name="dueDate"
              label="Due Date"
              nullable
            />

            {/* Distribution */}
            <FormField
              control={form.control}
              name="distributionPersonId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Distribution</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select A Person..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projectUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                          {user.email ? ` — ${user.email}` : ""}
                        </SelectItem>
                      ))}
                      {projectUsers.length === 0 && (
                        <SelectItem value="_none" disabled>
                          No project users available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Request Details */}
            <FormField
              control={form.control}
              name="requestDetails"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Request Details</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the scope and any specific instructions for this RFQ..."
                      className="min-h-[100px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Attachments */}
            <div className="sm:col-span-2">
              <FormLabel className="mb-1.5 block">Attachments</FormLabel>
              <div className="flex min-h-[72px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50">
                <span className="font-medium">Drop files here or click to upload</span>
                <span className="mt-0.5 text-xs">PDF, DOCX, XLSX, JPG, PNG up to 50 MB</span>
              </div>
            </div>
          </div>
        </FormSection>

        {/* ---------------------------------------------------------------- */}
        {/* Section 2 — Commitment Select                                    */}
        {/* ---------------------------------------------------------------- */}
        <FormSection
          title="Commitment Select"
          description="Assign each change event line item to a contract. The selected contract's vendor will receive the RFQ."
        >
          {fields.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No line items found for this change event. Add line items first, then return here to
              send RFQs.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="min-w-[180px]">CE Line Item</TableHead>
                    <TableHead className="min-w-[200px]">RFQ Scope Description</TableHead>
                    <TableHead className="min-w-[200px]">Contract</TableHead>
                    <TableHead className="min-w-[160px]">Recipients</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id} className="align-top">
                      {/* CE Line Item description (read-only) */}
                      <TableCell className="py-3 text-sm text-foreground">
                        {field.lineItemDescription || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Scope Description */}
                      <TableCell className="py-2">
                        <FormField
                          control={form.control}
                          name={`commitmentLines.${index}.scopeDescription`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea
                                  placeholder="Describe scope..."
                                  className="min-h-[64px] resize-y text-sm"
                                  {...f}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>

                      {/* Contract select */}
                      <TableCell className="py-2">
                        <FormField
                          control={form.control}
                          name={`commitmentLines.${index}.contractId`}
                          render={({ field: f }) => (
                            <FormItem>
                              <Select
                                onValueChange={(val) => {
                                  f.onChange(val);
                                  handleContractChange(index, val);
                                }}
                                value={f.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Select contract..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {contracts.map((contract) => (
                                    <SelectItem key={contract.id} value={contract.id}>
                                      {contract.label}
                                    </SelectItem>
                                  ))}
                                  {contracts.length === 0 && (
                                    <SelectItem value="_none" disabled>
                                      No contracts available
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </TableCell>

                      {/* Recipients (auto-derived, read-only display) */}
                      <TableCell className="py-3">
                        <FormField
                          control={form.control}
                          name={`commitmentLines.${index}.recipients`}
                          render={({ field: f }) => (
                            <span className="text-sm text-muted-foreground">
                              {f.value || "—"}
                            </span>
                          )}
                        />
                      </TableCell>

                      {/* Remove button */}
                      <TableCell className="py-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(index)}
                          aria-label="Remove line item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </FormSection>

        {/* ---------------------------------------------------------------- */}
        {/* Actions                                                          */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Create and Send RFQs"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
