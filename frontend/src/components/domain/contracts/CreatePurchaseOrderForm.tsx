"use client";

import * as React from "react";
import {
  useForm,
  useWatch,
  FormProvider,
  Controller,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  X,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import {
  InlineTable,
  InlineTableHeader,
  InlineTableHeaderRow,
  InlineTableHeaderCell,
  InlineTableBody,
  InlineTableRow,
  InlineTableCell,
  InlineTableFooter,
  InlineTableFooterRow,
  InlineTableFooterCell,
} from "@/components/ds/inline-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoneyField } from "@/components/forms/MoneyField";
import {
  CreatePurchaseOrderSchema,
  type CreatePurchaseOrderInput,
  type PurchaseOrderSovLineItem,
} from "@/lib/schemas/create-purchase-order-schema";
import type { CompanyOption } from "@/hooks/use-companies";
import { useContacts } from "@/hooks/use-contacts";
import { useCompanyContacts } from "@/hooks/use-company-contacts";
import { useEmployees } from "@/hooks/use-employees";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RichTextField } from "@/components/forms/RichTextField";
import { PurchaseOrderAddressFields } from "@/components/domain/contracts/purchase-order-address-fields";
import { BudgetCodeSelector } from "@/components/budget/budget-code-selector";
import {
  budgetCodeTextValue,
  normalizeBudgetCodesForSelector,
  resolvePrimeCoBudgetCode,
} from "@/lib/budget/budget-code-selection";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Form system
import {
  Form,
  FormSection,
  FormGrid,
  FormActions,
  RHFSelectField,
  RHFNumberField,
  RHFCheckboxField,
  RHFDateField,
  RHFComboboxField,
} from "@/components/forms";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { FormServerError } from "@/components/forms/FormServerError";
import { cn } from "@/lib/utils";

interface CreatePurchaseOrderFormProps {
  projectId: number;
  onSubmit: (data: CreatePurchaseOrderInput) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<CreatePurchaseOrderInput> & {
    sovLines?: PurchaseOrderSovLineItem[];
    contractCompanyName?: string;
    assignedToName?: string;
    billToCompanyName?: string;
    billToContactName?: string;
    shipToCompanyName?: string;
    shipToContactName?: string;
  };
  mode?: "create" | "edit";
}

interface BudgetCode {
  id: string;
  code: string;
  costCodeId?: string | null;
  costType: string | null;
  costTypeId?: string | null;
  description: string;
  fullLabel: string;
}

interface BudgetCodesResponse {
  budgetCodes: BudgetCode[];
}

interface CostCodeOption {
  id: string;
  title: string | null;
  status: string | null;
  division_title: string | null;
}

type PurchaseOrderCompanyOption = CompanyOption & {
  licenseNumber?: string | null;
};

const STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Approved", label: "Approved" },
  { value: "Sent", label: "Sent to Vendor" },
  { value: "Acknowledged", label: "Acknowledged" },
  { value: "Completed", label: "Completed" },
];

const UNIT_OF_MEASURES = [
  { value: "EA", label: "Each" },
  { value: "LF", label: "Linear Foot" },
  { value: "SF", label: "Square Foot" },
  { value: "CY", label: "Cubic Yard" },
  { value: "TON", label: "Ton" },
  { value: "HR", label: "Hour" },
  { value: "LS", label: "Lump Sum" },
];

export function getInitialPurchaseOrderAccountingMethod(
  initialAccountingMethod?: "unit-quantity" | "amount",
): "unit-quantity" | "amount" {
  return initialAccountingMethod || "amount";
}

export function CreatePurchaseOrderForm({
  projectId,
  onSubmit,
  onCancel,
  initialData,
  mode = "create",
}: CreatePurchaseOrderFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // Auto-generated PO number for new purchase orders. Computed once and used as
  // the field default; the user can still edit it freely.
  const generatedContractNumberRef = React.useRef(
    `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Date.now()).slice(-4)}`,
  );
  const [sovLines, setSovLines] = React.useState<PurchaseOrderSovLineItem[]>(
    initialData?.sovLines || [],
  );
  const [accountingMethod, setAccountingMethod] = React.useState<
    "unit-quantity" | "amount"
  >(getInitialPurchaseOrderAccountingMethod(initialData?.accountingMethod as "unit-quantity" | "amount" | undefined));
  const [attachments, setAttachments] = React.useState<File[]>([]);
  // Project directory contacts — no form dependency, fetch immediately
  const { options: projectContactOptions, isLoading: loadingProjectContacts } = useContacts({
    projectId: String(projectId),
    enabled: true,
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [budgetCodes, setBudgetCodes] = React.useState<BudgetCode[]>([]);
  const [budgetCodesLoaded, setBudgetCodesLoaded] = React.useState(false);
  const [budgetCodesError, setBudgetCodesError] = React.useState<string | null>(null);
  const [showCreateBudgetCodeModal, setShowCreateBudgetCodeModal] = React.useState(false);
  const [newBudgetCodeData, setNewBudgetCodeData] = React.useState({
    costCodeId: "",
    costType: "X",
  });
  const [availableCostCodes, setAvailableCostCodes] = React.useState<CostCodeOption[]>([]);
  const [loadingCostCodes, setLoadingCostCodes] = React.useState(false);
  const [groupedCostCodes, setGroupedCostCodes] = React.useState<
    Record<string, CostCodeOption[]>
  >({});
  const [expandedDivisions, setExpandedDivisions] = React.useState<Set<string>>(new Set());
  const [isCreatingBudgetCode, setIsCreatingBudgetCode] = React.useState(false);

  const [vendorOptions, setVendorOptions] = React.useState<PurchaseOrderCompanyOption[]>([]);
  const [isLoadingVendors, setIsLoadingVendors] = React.useState(true);

  React.useEffect(() => {
    const fetchVendors = async () => {
      try {
        setIsLoadingVendors(true);
        const data = await apiFetch<Array<{
          id: string;
          vendor_name: string;
          license_number?: string | null;
        }>>(`/api/projects/${projectId}/vendors`);
        const options = (data || []).map((v) => ({
          value: v.id,
          label: v.vendor_name,
          licenseNumber: v.license_number ?? null,
        }));

        // Ensure the saved company appears in options even if not in project vendors
        if (
          initialData?.contractCompanyId &&
          initialData?.contractCompanyName &&
          !options.some((o) => o.value === initialData.contractCompanyId)
        ) {
          options.unshift({
            value: initialData.contractCompanyId,
            label: initialData.contractCompanyName,
            licenseNumber: initialData.companyLicenseNumber ?? null,
          });
        }

        setVendorOptions(options);
      } catch {
        setVendorOptions([]);
      } finally {
        setIsLoadingVendors(false);
      }
    };
    fetchVendors();
  }, [projectId, initialData?.contractCompanyId, initialData?.contractCompanyName]);

  const form = useForm<CreatePurchaseOrderInput>({
    resolver: zodResolver(CreatePurchaseOrderSchema) as Resolver<CreatePurchaseOrderInput>,
    reValidateMode: "onBlur",
    defaultValues: {
      contractNumber:
        initialData?.contractNumber ||
        (mode === "create" ? generatedContractNumberRef.current : ""),
      status: initialData?.status || "Draft",
      executed: initialData?.executed || false,
      accountingMethod: getInitialPurchaseOrderAccountingMethod(initialData?.accountingMethod),
      sov: initialData?.sov || [],
      privacy: initialData?.privacy || {
        isPrivate: true,
        allowNonAdminViewSovItems: false,
      },
      title: initialData?.title || "",
      contractCompanyId: initialData?.contractCompanyId || "",
      companyLicenseNumber: initialData?.companyLicenseNumber || "",
      description: initialData?.description || "",
      assignedTo: initialData?.assignedTo || "",
      billTo: initialData?.billTo || "",
      shipTo: initialData?.shipTo || "",
      billToCompanyId: initialData?.billToCompanyId || "",
      billToContactId: initialData?.billToContactId || "",
      billToAddress: initialData?.billToAddress || "",
      billToCity: initialData?.billToCity || "",
      billToState: initialData?.billToState || "",
      billToZip: initialData?.billToZip || "",
      shipToCompanyId: initialData?.shipToCompanyId || "",
      shipToContactId: initialData?.shipToContactId || "",
      shipToAddress: initialData?.shipToAddress || "",
      shipToCity: initialData?.shipToCity || "",
      shipToState: initialData?.shipToState || "",
      shipToZip: initialData?.shipToZip || "",
      shipVia: initialData?.shipVia || "",
      paymentTerms: initialData?.paymentTerms || "",
      dates: initialData?.dates || {},
      defaultRetainagePercent: initialData?.defaultRetainagePercent,
    },
  });

  const { handleSubmit, formState: { errors }, setValue, setError, control } = form;

  const contractCompanyId = useWatch({ control, name: "contractCompanyId" });
  const privacyIsPrivate = useWatch({ control, name: "privacy.isPrivate" }) ?? true;
  const descriptionValue = useWatch({ control, name: "description" });

  // Company contacts for the selected contract company
  const { options: companyContactOptions, isLoading: loadingCompanyContacts } = useCompanyContacts({
    vendorId: contractCompanyId || undefined,
    enabled: !!contractCompanyId,
  });

  // Merged contact options: project directory + company contacts, deduped by id
  const contactOptions = React.useMemo(() => {
    const seen = new Set<string>();
    return [...projectContactOptions, ...companyContactOptions].filter((o) => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  }, [projectContactOptions, companyContactOptions]);
  const loadingContacts = loadingProjectContacts || loadingCompanyContacts;

  // "Assigned To" is the internal Alleato owner of the PO — list employees,
  // not the project directory or vendor contacts.
  const { options: employeeOptions, isLoading: loadingEmployees } = useEmployees();

  React.useEffect(() => {
    let isMounted = true;
    const fetchBudgetCodes = async () => {
      try {
        setBudgetCodesError(null);
        const data = await apiFetch<BudgetCodesResponse>(
          `/api/projects/${projectId}/budget-codes`,
        );
        if (!isMounted) return;
        setBudgetCodes(normalizeBudgetCodesForSelector(data.budgetCodes || []));
      } catch (error) {
        if (!isMounted) return;
        setBudgetCodesError(
          error instanceof Error ? error.message : "Failed to load budget codes",
        );
        setBudgetCodes([]);
      } finally {
        if (isMounted) setBudgetCodesLoaded(true);
      }
    };
    fetchBudgetCodes();
    return () => { isMounted = false; };
  }, [projectId]);

  React.useEffect(() => {
    const fetchCostCodes = async () => {
      if (!showCreateBudgetCodeModal) return;
      try {
        setLoadingCostCodes(true);
        const supabaseClient = createClient();
        const { data, error } = await supabaseClient
          .from("cost_codes")
          .select("id, title, status, division_title")
          .eq("status", "Active")
          .order("id", { ascending: true });
        if (error) return;
        const costCodes = (data || []) as CostCodeOption[];
        setAvailableCostCodes(costCodes);
        const grouped = costCodes.reduce(
          (acc: Record<string, CostCodeOption[]>, code: CostCodeOption) => {
            const division = code.division_title || "Other";
            if (!acc[division]) acc[division] = [];
            acc[division].push(code);
            return acc;
          },
          {},
        );
        setGroupedCostCodes(grouped);
      } finally {
        setLoadingCostCodes(false);
      }
    };
    fetchCostCodes();
  }, [showCreateBudgetCodeModal]);

  const budgetCodeSet = React.useMemo(
    () =>
      new Set(
        budgetCodes.flatMap((code) =>
          [code.id, code.code, code.costCodeId, code.fullLabel].filter(
            Boolean,
          ),
        ),
      ),
    [budgetCodes],
  );

  const unbudgetedLines = React.useMemo(() => {
    return sovLines
      .map((line, index) => ({ lineNumber: index + 1, code: line.budgetCode?.trim() ?? "" }))
      .filter(
        ({ code }) =>
          code.length > 0 &&
          !budgetCodeSet.has(code) &&
          !resolvePrimeCoBudgetCode(code, budgetCodes).isMapped,
      );
  }, [sovLines, budgetCodeSet, budgetCodes]);

  const getCostTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      R: "Contract Revenue",
      E: "Equipment",
      X: "Expense",
      L: "Labor",
      M: "Material",
      S: "Subcontract",
    };
    return types[type] || type;
  };

  const toggleDivision = (division: string) => {
    setExpandedDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(division)) next.delete(division);
      else next.add(division);
      return next;
    });
  };

  const handleCreateBudgetCode = async () => {
    try {
      setIsCreatingBudgetCode(true);
      const selectedCostCode = availableCostCodes.find(
        (code) => code.id === newBudgetCodeData.costCodeId,
      );
      if (!selectedCostCode) {
        toast.error("Please select a cost code");
        return;
      }
      const { budgetCode } = await apiFetch<{ budgetCode: BudgetCode }>(
        `/api/projects/${projectId}/budget-codes`,
        {
        method: "POST",
        body: JSON.stringify({
          cost_code_id: newBudgetCodeData.costCodeId,
          cost_type_id: newBudgetCodeData.costType,
          description: selectedCostCode.title || null,
        }),
        },
      );
      const normalizedBudgetCode = normalizeBudgetCodesForSelector([budgetCode])[0];
      setBudgetCodes((prev) => [...prev, normalizedBudgetCode]);
      const firstEmptyLineIndex = sovLines.findIndex((line) => !line.budgetCode?.trim());
      if (firstEmptyLineIndex >= 0) {
        updateSOVLine(firstEmptyLineIndex, "budgetCode", budgetCodeTextValue(normalizedBudgetCode));
      } else {
        setSovLines((prev) => [
          ...prev,
          {
            lineNumber: prev.length + 1,
            budgetCode: budgetCodeTextValue(normalizedBudgetCode),
            description: "",
            quantity: 1,
            uom: "",
            unitCost: 0,
            amount: 0,
            billedToDate: 0,
          },
        ]);
      }
      setShowCreateBudgetCodeModal(false);
      setNewBudgetCodeData({ costCodeId: "", costType: "X" });
      toast.success("Budget code created and added to form");
    } catch (error) {
      toast.error(
        `Failed to create budget code: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsCreatingBudgetCode(false);
    }
  };

  const handleFormSubmit = async (data: CreatePurchaseOrderInput) => {
    setIsSubmitting(true);
    try {
      // contract_company_id FK references companies(id) — send vendor ID directly
      const submitData = {
        ...data,
        sov: sovLines.map((line) => ({
          ...line,
          budgetCode:
            resolvePrimeCoBudgetCode(line.budgetCode, budgetCodes).storedCode ??
            line.budgetCode,
        })),
        accountingMethod,
      };
      await onSubmit(submitData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create purchase order";
      setError("root", { message });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSOVLine = () => {
    const newLine: PurchaseOrderSovLineItem & { _id: string } = {
      _id: `line-${Date.now()}-${Math.random()}`,
      lineNumber: sovLines.length + 1,
      quantity: 1,
      uom: "",
      unitCost: 0,
      amount: 0,
      billedToDate: 0,
    };
    setSovLines([...sovLines, newLine as PurchaseOrderSovLineItem]);
  };

  const updateSOVLine = (
    index: number,
    field: keyof PurchaseOrderSovLineItem,
    value: unknown,
  ) => {
    const updated = [...sovLines];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "unitCost") {
      const qty = field === "quantity" ? (value as number) : updated[index].quantity || 0;
      const cost = field === "unitCost" ? (value as number) : updated[index].unitCost || 0;
      updated[index].amount = qty * cost;
    }
    setSovLines(updated);
  };

  const removeSOVLine = (index: number) => {
    setSovLines(sovLines.filter((_, i) => i !== index));
  };

  const calculateSOVTotals = () => {
    const totals = sovLines.reduce(
      (acc, line) => ({
        amount: acc.amount + (line.amount || 0),
        billedToDate: acc.billedToDate + (line.billedToDate || 0),
      }),
      { amount: 0, billedToDate: 0 },
    );
    return { ...totals, amountRemaining: totals.amount - totals.billedToDate };
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) setAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files) setAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const totals = calculateSOVTotals();

  return (
    <FormProvider {...form}>
    <Form onSubmit={handleSubmit(handleFormSubmit)}>

      {/* General Information */}
      <FormSection title="General Information">
        <FormGrid columns={2}>
          <RHFTextField
            control={control}
            name="contractNumber"
            label="Contract #"
            placeholder="e.g., PO-001"
            disabled={isSubmitting}
          />

          <RHFComboboxField
            control={control}
            name="contractCompanyId"
            label="Contract Company"
            options={vendorOptions}
            placeholder={isLoadingVendors ? "Loading vendors..." : "Search vendors..."}
            selectedLabel={initialData?.contractCompanyName}
            searchPlaceholder="Type vendor name..."
            emptyMessage="No vendors found."
            disabled={isSubmitting || isLoadingVendors}
          />

          <RHFTextField
            control={control}
            name="title"
            label="Title"
            placeholder="Enter title"
            disabled={isSubmitting}
          />

          <RHFSelectField
            control={control}
            name="status"
            label="Status"
            options={STATUS_OPTIONS}
            disabled={isSubmitting}
          />
        </FormGrid>

        <FormGrid columns={2}>
          <RHFNumberField
            control={control}
            name="defaultRetainagePercent"
            label="Default Retainage (%)"
            step={0.01}
            min={0}
            max={100}
            disabled={isSubmitting}
          />

          <RHFComboboxField
            control={control}
            name="assignedTo"
            label="Assigned To"
            placeholder={loadingEmployees ? "Loading employees..." : "Select Alleato employee..."}
            options={employeeOptions}
            selectedLabel={initialData?.assignedToName}
            disabled={isSubmitting || loadingEmployees}
          />
        </FormGrid>

        <RichTextField
          label="Description"
          value={descriptionValue}
          onChange={(val) => setValue("description", val, { shouldDirty: true })}
          disabled={isSubmitting}
          placeholder="Purchase order description..."
        />

        <RHFCheckboxField
          control={control}
          name="executed"
          label="Executed"
          disabled={isSubmitting}
        />
      </FormSection>

      {/* Bill To / Ship To */}
      <FormSection title="Bill To / Ship To">
        <FormGrid columns={2}>
          <PurchaseOrderAddressFields
            control={control}
            prefix="billTo"
            heading="Bill To"
            contactLabel="Billing Contact"
            initialCompanyName={initialData?.billToCompanyName}
            initialContactName={initialData?.billToContactName}
            disabled={isSubmitting}
          />

          <PurchaseOrderAddressFields
            control={control}
            prefix="shipTo"
            heading="Ship To"
            contactLabel="Receiving Contact"
            initialCompanyName={initialData?.shipToCompanyName}
            initialContactName={initialData?.shipToContactName}
            disabled={isSubmitting}
          />
        </FormGrid>
      </FormSection>

      {/* Payment & Shipping */}
      <FormSection title="Payment & Shipping">
        <FormGrid columns={2}>
          <RHFTextField
            control={control}
            name="paymentTerms"
            label="Payment Terms"
            placeholder="e.g., Net 30"
            disabled={isSubmitting}
          />
          <RHFTextField
            control={control}
            name="shipVia"
            label="Ship Via"
            placeholder="Shipping method"
            disabled={isSubmitting}
          />
        </FormGrid>
      </FormSection>

      {/* Attachments */}
      <FormSection title="Attachments">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          aria-label="File upload"
        />

        <div
          className="border-2 border-dashed rounded-lg p-8 text-center"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="flex flex-col items-center gap-4">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
              >
                Attach Files
              </Button>
              <span className="text-sm text-foreground">or Drag & Drop</span>
            </div>
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-4 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-foreground" />
                  <span className="text-sm">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({formatNumber(file.size / 1024, 1)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveAttachment(index)}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      {/* Contract Dates */}
      <FormSection title="Contract Dates">
        <FormGrid columns={2}>
          <RHFDateField
            control={control}
            name="dates.contractDate"
            label="Contract Date"
            nullable
          />
          <RHFDateField
            control={control}
            name="dates.deliveryDate"
            label="Delivery Date"
            nullable
          />
          <RHFDateField
            control={control}
            name="dates.signedPoReceivedDate"
            label="Signed PO Received Date"
            nullable
          />
          <RHFDateField
            control={control}
            name="dates.issuedOnDate"
            label="Issued On Date"
            nullable
          />
        </FormGrid>
      </FormSection>

      {/* Privacy & Access */}
      <FormSection title="Privacy & Access">
        <FormGrid columns={2}>
          <Controller
            name="invoiceContactIds"
            control={control}
            render={({ field }) => {
              const value: string[] = field.value ?? [];
              const handleSelect = (optionValue: string) => {
                field.onChange(
                  value.includes(optionValue)
                    ? value.filter((v) => v !== optionValue)
                    : [...value, optionValue],
                );
              };
              const selectedLabels = value
                .map((id) => contactOptions.find((o) => o.value === id)?.label)
                .filter(Boolean) as string[];
              return (
                <div className="space-y-2">
                  <Label>Invoice Contacts</Label>
                  {!contractCompanyId && (
                    <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                      Select a contract company to load company contacts.
                    </p>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="h-auto min-h-10 w-full justify-between"
                        disabled={isSubmitting || loadingContacts}
                      >
                        <div className="flex flex-wrap gap-1">
                          {value.length > 0
                            ? selectedLabels.map((label) => (
                                <Badge key={label} variant="secondary">{label}</Badge>
                              ))
                            : <span className="text-muted-foreground text-sm">
                                {loadingContacts ? "Loading contacts..." : "Select invoice contacts..."}
                              </span>
                          }
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                      <Command>
                        <CommandInput placeholder="Search contacts..." />
                        <CommandList className="max-h-64">
                          <CommandEmpty>No contacts found.</CommandEmpty>
                          <CommandGroup>
                            {contactOptions.map((option) => (
                              <CommandItem
                                key={option.value}
                                value={[option.label, option.value].join(" ")}
                                onSelect={() => handleSelect(option.value)}
                              >
                                <Check className={cn("mr-2 h-4 w-4", value.includes(option.value) ? "opacity-100" : "opacity-0")} />
                                {option.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              );
            }}
          />

          <div className="flex w-full flex-col gap-2">
            <Label>Access for Non-Admin Users</Label>
            <Controller
              name="privacy.nonAdminUserIds"
              control={control}
              render={({ field }) => {
                const value: string[] = field.value ?? [];
                const handleSelect = (optionValue: string) => {
                  field.onChange(
                    value.includes(optionValue)
                      ? value.filter((v) => v !== optionValue)
                      : [...value, optionValue],
                  );
                };
                const selectedLabels = value
                  .map((id) => contactOptions.find((o) => o.value === id)?.label)
                  .filter(Boolean) as string[];
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="h-auto min-h-10 w-full justify-between"
                        disabled={isSubmitting || !privacyIsPrivate || loadingContacts}
                      >
                        <div className="flex flex-wrap gap-1">
                          {value.length > 0
                            ? selectedLabels.map((label) => (
                                <Badge key={label} variant="secondary">{label}</Badge>
                              ))
                            : <span className="text-muted-foreground text-sm">
                                {privacyIsPrivate
                                  ? loadingContacts ? "Loading contacts..." : "Select contacts..."
                                  : "Enable Private to use this field"}
                              </span>
                          }
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                      <Command>
                        <CommandInput placeholder="Search contacts..." />
                        <CommandList className="max-h-64">
                          <CommandEmpty>No contacts found.</CommandEmpty>
                          <CommandGroup>
                            {contactOptions.map((option) => (
                              <CommandItem
                                key={option.value}
                                value={[option.label, option.value].join(" ")}
                                onSelect={() => handleSelect(option.value)}
                              >
                                <Check className={cn("mr-2 h-4 w-4", value.includes(option.value) ? "opacity-100" : "opacity-0")} />
                                {option.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                );
              }}
            />
          </div>
        </FormGrid>

        <RHFCheckboxField
          control={control}
          name="privacy.isPrivate"
          label="Private"
          disabled={isSubmitting}
        />

        <RHFCheckboxField
          control={control}
          name="privacy.allowNonAdminViewSovItems"
          label="Allow these non-admin users to view the SOV items."
          disabled={isSubmitting || !privacyIsPrivate}
        />
      </FormSection>

      {/* Schedule of Values */}
      <FormSection title="Schedule of Values">
        {/* Accounting Method */}
        <p className="text-sm text-muted-foreground">
          This purchase order&apos;s accounting method is{" "}
          <strong>{accountingMethod === "unit-quantity" ? "unit/quantity" : "amount-based"}</strong>.{" "}
          <Button
            type="button"
            variant="link"
            className="underline p-0 h-auto"
            disabled={isSubmitting}
            onClick={() =>
              setAccountingMethod(accountingMethod === "unit-quantity" ? "amount" : "unit-quantity")
            }
          >
            Change to {accountingMethod === "unit-quantity" ? "Amount-based" : "Unit/Quantity"}
          </Button>
        </p>

        {budgetCodesError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Budget codes unavailable</AlertTitle>
            <AlertDescription>{budgetCodesError}</AlertDescription>
          </Alert>
        )}

        {budgetCodesLoaded && unbudgetedLines.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Unbudgeted line items</AlertTitle>
            <AlertDescription>
              Line items{" "}
              {unbudgetedLines.map((line) => `${line.lineNumber} (${line.code})`).join(", ")}{" "}
              are not on the project budget. Add them to the budget or update these line items
              before approval.
            </AlertDescription>
          </Alert>
        )}

        {/* SOV Table — always shown */}
        <div className="flex items-center justify-between">
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h3 className="text-sm font-semibold text-foreground">Line Items</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5">
                Options
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {/* CSV import placeholder */}}>
                Import from CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <InlineTable
          tableClassName={
            accountingMethod === "unit-quantity"
              ? "min-w-[84rem]"
              : "min-w-[68rem]"
          }
        >
          <InlineTableHeader>
            <InlineTableHeaderRow>
              <InlineTableHeaderCell className="w-12">#</InlineTableHeaderCell>
              <InlineTableHeaderCell className="min-w-72">Budget Code</InlineTableHeaderCell>
              <InlineTableHeaderCell className="min-w-64">Description</InlineTableHeaderCell>
              {accountingMethod === "unit-quantity" && (
                <>
                  <InlineTableHeaderCell className="w-32" align="right">Qty</InlineTableHeaderCell>
                  <InlineTableHeaderCell className="w-32">UOM</InlineTableHeaderCell>
                  <InlineTableHeaderCell className="w-48" align="right">Unit Cost</InlineTableHeaderCell>
                </>
              )}
              <InlineTableHeaderCell className="w-48" align="right">Amount</InlineTableHeaderCell>
              <InlineTableHeaderCell className="w-40" align="right">Billed to Date</InlineTableHeaderCell>
              <InlineTableHeaderCell className="w-40" align="right">Amount Remaining</InlineTableHeaderCell>
              <InlineTableHeaderCell className="w-12" />
            </InlineTableHeaderRow>
          </InlineTableHeader>
          <InlineTableBody>
            {sovLines.map((line, index) => {
              const budgetCodeResolution = resolvePrimeCoBudgetCode(
                line.budgetCode,
                budgetCodes,
              );
              return (
              <InlineTableRow
                key={
                  (line as PurchaseOrderSovLineItem & { _id?: string })._id ||
                  `line-${index}`
                }
              >
                <InlineTableCell className="text-muted-foreground">{index + 1}</InlineTableCell>
                <InlineTableCell>
                  <BudgetCodeSelector
                    value={budgetCodeResolution.selectorValue}
                    onValueChange={(_, code) =>
                      updateSOVLine(index, "budgetCode", budgetCodeTextValue(code))
                    }
                    budgetCodes={budgetCodes}
                    loading={!budgetCodesLoaded}
                    onCreateNew={() => setShowCreateBudgetCodeModal(true)}
                    placeholder={
                      budgetCodeResolution.isMapped
                        ? "Select budget code..."
                        : budgetCodeResolution.displayCode
                    }
                    error={!budgetCodeResolution.isMapped}
                    className="h-10"
                  />
                </InlineTableCell>
                <InlineTableCell>
                  <Input
                    placeholder="Description"
                    value={line.description || ""}
                    onChange={(e) =>
                      updateSOVLine(index, "description", e.target.value)
                    }
                    className="h-10"
                  />
                </InlineTableCell>
                {accountingMethod === "unit-quantity" && (
                  <>
                    <InlineTableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="1"
                        value={line.quantity || ""}
                        onChange={(e) =>
                          updateSOVLine(
                            index,
                            "quantity",
                            e.target.value === "" ? 0 : parseFloat(e.target.value) || 0,
                          )
                        }
                        className="h-10 min-w-20"
                        aria-label={`Quantity for line item ${index + 1}`}
                      />
                    </InlineTableCell>
                    <InlineTableCell>
                      <Select
                        value={line.uom || undefined}
                        onValueChange={(value) => updateSOVLine(index, "uom", value)}
                      >
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_OF_MEASURES.map((uom) => (
                            <SelectItem key={uom.value} value={uom.value}>
                              {uom.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </InlineTableCell>
                    <InlineTableCell className="w-48">
                      <MoneyField
                        inline
                        label={`Unit cost for line item ${index + 1}`}
                        value={line.unitCost || undefined}
                        onChange={(value) =>
                          updateSOVLine(index, "unitCost", value ?? 0)
                        }
                        showCurrency={false}
                        className="h-10 min-w-36"
                      />
                    </InlineTableCell>
                  </>
                )}
                <InlineTableCell className="w-48">
                  <MoneyField
                    inline
                    label={`Amount for line item ${index + 1}`}
                    value={line.amount || undefined}
                    onChange={(val) => updateSOVLine(index, "amount", val ?? 0)}
                    showCurrency={false}
                    className="h-10 min-w-36"
                    disabled={accountingMethod === "unit-quantity"}
                    readOnly={accountingMethod === "unit-quantity"}
                  />
                  {(line.amount || 0) >= 1_000_000_000 && (
                    <span className="text-xs font-normal text-destructive">Unusually large</span>
                  )}
                </InlineTableCell>
                <InlineTableCell align="right" numeric>
                  {formatCurrency(line.billedToDate || 0)}
                </InlineTableCell>
                <InlineTableCell align="right" numeric>
                  {formatCurrency((line.amount || 0) - (line.billedToDate || 0))}
                </InlineTableCell>
                <InlineTableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSOVLine(index)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    &times;
                  </Button>
                </InlineTableCell>
              </InlineTableRow>
              );
            })}
          </InlineTableBody>
          <InlineTableFooter>
            <InlineTableFooterRow type="action">
              <InlineTableFooterCell />
              <InlineTableFooterCell
                colSpan={accountingMethod === "unit-quantity" ? 8 : 5}
              >
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm font-medium"
                  onClick={addSOVLine}
                  disabled={isSubmitting}
                >
                  Add Line Item
                </Button>
              </InlineTableFooterCell>
              <InlineTableFooterCell />
            </InlineTableFooterRow>
            <InlineTableFooterRow type="totals">
              <InlineTableFooterCell />
              <InlineTableFooterCell
                colSpan={accountingMethod === "unit-quantity" ? 5 : 2}
              >
                Totals
              </InlineTableFooterCell>
              <InlineTableFooterCell align="right" numeric>
                {formatCurrency(totals.amount)}
              </InlineTableFooterCell>
              <InlineTableFooterCell align="right" numeric>
                {formatCurrency(totals.billedToDate)}
              </InlineTableFooterCell>
              <InlineTableFooterCell align="right" numeric>
                {formatCurrency(totals.amountRemaining)}
              </InlineTableFooterCell>
              <InlineTableFooterCell />
            </InlineTableFooterRow>
          </InlineTableFooter>
        </InlineTable>
      </FormSection>

      <FormServerError message={errors.root?.message} />

      <FormActions
        submitLabel={mode === "edit" ? "Save Changes" : "Create Purchase Order"}
        onCancel={onCancel}
        isSubmitting={isSubmitting}
      >
        <p className="text-sm text-muted-foreground">
          <span className="text-destructive">*</span> Required fields
        </p>
      </FormActions>

      {/* Create Budget Code Modal */}
      <Dialog open={showCreateBudgetCodeModal} onOpenChange={setShowCreateBudgetCodeModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Budget Code</DialogTitle>
            <DialogDescription>
              Add a budget code and assign it directly to this commitment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="costCode">Cost Code*</Label>
              {loadingCostCodes ? (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  Loading cost codes...
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-md border">
                  {Object.entries(groupedCostCodes)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([division]) => (
                      <div key={division} className="border-b last:border-b-0">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => toggleDivision(division)}
                          className="flex w-full items-center justify-between px-4 py-2 text-left h-auto font-normal"
                        >
                          <span className="text-sm font-semibold text-foreground">{division}</span>
                          {expandedDivisions.has(division) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        {expandedDivisions.has(division) && (
                          <div className="bg-muted/50">
                            {groupedCostCodes[division].map((costCode) => (
                              <Button
                                key={costCode.id}
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  setNewBudgetCodeData((prev) => ({
                                    ...prev,
                                    costCodeId: costCode.id,
                                  }))
                                }
                                className={`w-full px-6 py-2 text-left justify-start text-sm h-auto font-normal ${
                                  newBudgetCodeData.costCodeId === costCode.id
                                    ? "bg-primary/10 font-medium text-primary"
                                    : "text-foreground"
                                }`}
                              >
                                {costCode.id}
                                {costCode.title ? ` - ${costCode.title}` : ""}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Select a division and choose a cost code.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="costType">Cost Type*</Label>
              <Select
                value={newBudgetCodeData.costType}
                onValueChange={(value) =>
                  setNewBudgetCodeData((prev) => ({ ...prev, costType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="R">R - Contract Revenue</SelectItem>
                  <SelectItem value="E">E - Equipment</SelectItem>
                  <SelectItem value="X">X - Expense</SelectItem>
                  <SelectItem value="L">L - Labor</SelectItem>
                  <SelectItem value="M">M - Material</SelectItem>
                  <SelectItem value="S">S - Subcontract</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm font-medium text-foreground">Preview:</p>
              <p className="mt-1 text-sm text-foreground">
                {newBudgetCodeData.costCodeId ? (
                  <>
                    {availableCostCodes.find((code) => code.id === newBudgetCodeData.costCodeId)
                      ?.id}
                    .{newBudgetCodeData.costType} -{" "}
                    {
                      availableCostCodes.find((code) => code.id === newBudgetCodeData.costCodeId)
                        ?.title
                    }{" "}
                    - {getCostTypeLabel(newBudgetCodeData.costType)}
                  </>
                ) : (
                  "Select cost code and cost type to preview the budget code."
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateBudgetCodeModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateBudgetCode}
              disabled={
                isCreatingBudgetCode || !newBudgetCodeData.costCodeId || !newBudgetCodeData.costType
              }
            >
              {isCreatingBudgetCode ? "Creating..." : "Create Budget Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
    </FormProvider>
  );
}
