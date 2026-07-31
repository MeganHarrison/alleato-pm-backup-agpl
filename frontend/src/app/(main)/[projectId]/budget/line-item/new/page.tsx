"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { DevAutoFillButton } from "@/hooks/use-dev-autofill";
import { apiFetch } from "@/lib/api-client";
import { useProjectBudgetCodes } from "@/hooks/use-project-budget-codes";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { PageShell, FormContainer } from "@/components/layout";
import { Form } from "@/components/ui/form";
import { FormSection } from "@/components/forms/FormSection";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFFieldArrayTable } from "@/components/forms/fields/RHFFieldArrayTable";
import { BudgetCodeSelector } from "@/components/budget/budget-code-selector";

type CostCodeOption = {
  id: string;
  title: string | null;
  status: string | null;
  division_id: string;
  division_code: string;
  division_title: string;
};

type BudgetLineRow = {
  budgetCodeId: string;
  budgetCodeLabel: string;
  qty: string;
  uom: string;
  unitCost: string;
  amount: string;
};

type BudgetLineFormValues = {
  rows: BudgetLineRow[];
};

const UOM_OPTIONS = [
  { value: "EA", label: "EA" },
  { value: "HR", label: "HR" },
  { value: "SF", label: "SF" },
  { value: "LF", label: "LF" },
  { value: "LS", label: "LS" },
  { value: "CY", label: "CY" },
  { value: "TON", label: "TON" },
  { value: "DAY", label: "DAY" },
];

// Permissive shape schema — the real "budget code + non-zero amount" checks stay
// imperative in onSubmit so the exact toast UX and POST payload are preserved.
const rowSchema = z.object({
  budgetCodeId: z.string(),
  budgetCodeLabel: z.string(),
  qty: z.string(),
  uom: z.string(),
  unitCost: z.string(),
  amount: z.string(),
});

const formSchema = z.object({
  rows: z.array(rowSchema).min(1, "At least one line item is required"),
});

function createBudgetLineRow(): BudgetLineRow {
  return {
    budgetCodeId: "",
    budgetCodeLabel: "",
    qty: "1",
    uom: "",
    unitCost: "",
    amount: "0.00",
  };
}

function calculateAmount(qty: string, unitCost: string): string {
  const qtyNum = parseFloat(qty) || 0;
  const costNum = parseFloat(unitCost) || 0;
  return (qtyNum * costNum).toFixed(2);
}

export default function NewBudgetLineItemPage() {
  const router = useRouter();
  const params = useParams()! ?? {};
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(false);
  const { budgetCodes, loadingCodes, createBudgetCode } =
    useProjectBudgetCodes(projectId);

  const form = useForm<BudgetLineFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rows: [createBudgetLineRow()],
    },
  });

  const {
    control,
    handleSubmit,
    setError,
    reset,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const watchedRows = watch("rows");
  const rowCount = watchedRows?.length ?? 0;

  // Auto-calculate amount when qty or unitCost changes (matches the original
  // handleRowChange behavior). Manual edits to amount are left untouched, and
  // add/remove of rows never triggers a recompute (so an existing manual amount
  // is not clobbered when indices shift).
  const prevRowsRef = useRef<Record<number, { qty: string; unitCost: string }>>(
    {},
  );
  const prevRowCountRef = useRef<number>(watchedRows?.length ?? 0);
  useEffect(() => {
    const rows = watchedRows ?? [];

    if (rows.length !== prevRowCountRef.current) {
      prevRowCountRef.current = rows.length;
      const rebuilt: Record<number, { qty: string; unitCost: string }> = {};
      rows.forEach((row, index) => {
        rebuilt[index] = { qty: row.qty, unitCost: row.unitCost };
      });
      prevRowsRef.current = rebuilt;
      return;
    }

    rows.forEach((row, index) => {
      const prev = prevRowsRef.current[index];
      if (prev && (prev.qty !== row.qty || prev.unitCost !== row.unitCost)) {
        const nextAmount = calculateAmount(row.qty, row.unitCost);
        if (row.amount !== nextAmount) {
          setValue(`rows.${index}.amount`, nextAmount, { shouldDirty: true });
        }
      }
      prevRowsRef.current[index] = { qty: row.qty, unitCost: row.unitCost };
    });
  }, [watchedRows, setValue]);

  // Cost codes from Supabase
  const [availableCostCodes, setAvailableCostCodes] = useState<
    CostCodeOption[]
  >([]);
  const [loadingCostCodes, setLoadingCostCodes] = useState(false);
  const [groupedCostCodes, setGroupedCostCodes] = useState<
    Record<string, CostCodeOption[]>
  >({});

  // Budget Code creation modal state
  const [showCreateCodeModal, setShowCreateCodeModal] = useState(false);
  const [pendingRowIndex, setPendingRowIndex] = useState<number | null>(null);
  const [newCodeData, setNewCodeData] = useState({
    costCodeId: "", // ID from cost_codes table
    costType: "L",
  });
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(
    new Set(),
  );

  // Fetch cost codes from Supabase when modal opens
  useEffect(() => {
    const fetchCostCodes = async () => {
      if (!showCreateCodeModal) return;

      try {
        setLoadingCostCodes(true);
        const supabase = createClient();

        const { data, error } = await supabase
          .from("cost_codes")
          .select(
            `
            id,
            title,
            status,
            division_id,
            cost_code_divisions!inner (
              code,
              title
            )
          `,
          )
          // Get all cost codes, we'll filter them client-side if needed
          .order("id", { ascending: true });

        if (error) {
          console.error("Error fetching cost codes:", error);
          return;
        }

        // Filter and map the cost codes
        const codesWithDivisions: CostCodeOption[] =
          data
            ?.filter((code) => {
              // Only include codes that have a title
              return code.title !== null && code.title !== "";
            })
            .map((code) => {
              const division = Array.isArray(code.cost_code_divisions)
                ? code.cost_code_divisions[0]
                : code.cost_code_divisions;

              return {
                id: code.id,
                title: code.title || "",
                status: code.status,
                division_id: code.division_id,
                division_code: division?.code || "",
                division_title: division?.title || "",
              };
            }) ?? [];

        setAvailableCostCodes(codesWithDivisions);

        // Group cost codes by division_title
        const grouped = codesWithDivisions.reduce(
          (acc, code) => {
            const divisionKey = code.division_title || "Other";
            if (!acc[divisionKey]) {
              acc[divisionKey] = [];
            }
            acc[divisionKey].push(code);
            return acc;
          },
          {} as Record<string, CostCodeOption[]>,
        );

        setGroupedCostCodes(grouped);
      } catch (error) {
        console.error("Failed to load budget data:", error);

        toast.error("Failed to load budget data", {
          description: "Please try again.",
        });
      } finally {
        setLoadingCostCodes(false);
      }
    };

    fetchCostCodes();
  }, [showCreateCodeModal]);

  const getCostTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      L: "Labor",
      M: "Material",
      E: "Equipment",
      S: "Subcontract",
      O: "Other",
    };
    return types[type] || type;
  };

  const toggleDivision = (division: string) => {
    setExpandedDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(division)) {
        next.delete(division);
      } else {
        next.add(division);
      }
      return next;
    });
  };

  const handleCreateBudgetCode = async () => {
    try {
      setLoading(true);

      // Find the selected cost code
      const selectedCostCode = availableCostCodes.find(
        (cc) => cc.id === newCodeData.costCodeId,
      );
      if (!selectedCostCode) {
        toast.error("Please select a cost code");
        return;
      }

      const createdCode = await createBudgetCode({
        costCodeId: newCodeData.costCodeId,
        costTypeId: newCodeData.costType,
        description: selectedCostCode.title,
      });

      const currentRows = getValues("rows");
      let targetIndex =
        pendingRowIndex != null && currentRows[pendingRowIndex]
          ? pendingRowIndex
          : -1;
      if (targetIndex === -1) {
        targetIndex = currentRows.findIndex((row) => !row.budgetCodeId);
      }

      if (targetIndex !== -1) {
        setValue(`rows.${targetIndex}.budgetCodeId`, createdCode.id, {
          shouldDirty: true,
        });
        setValue(`rows.${targetIndex}.budgetCodeLabel`, createdCode.fullLabel, {
          shouldDirty: true,
        });
      }

      // Reset modal
      setShowCreateCodeModal(false);
      setPendingRowIndex(null);
      setNewCodeData({ costCodeId: "", costType: "L" });
    } catch (error) {
      // apiFetch throws ApiError with the real server message — surface it
      // to the user instead of a generic fallback (Rule 2).
      toast.error(
        `Failed to create budget code: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: BudgetLineFormValues) => {
    setLoading(true);

    try {
      // Validate: all rows must have a budget code and amount
      const invalidRows = data.rows.filter(
        (row) => !row.budgetCodeId || parseFloat(row.amount) === 0,
      );

      if (invalidRows.length > 0) {
        toast.error("All rows must have a budget code and a non-zero amount.");
        setLoading(false);
        return;
      }

      const lineItemsToSubmit = data.rows.map((row) => {
        const budgetCode = budgetCodes.find(
          (code) => code.id === row.budgetCodeId,
        );

        return {
          costCodeId: budgetCode?.code || row.budgetCodeId,
          costType: budgetCode?.costType || null,
          qty: row.qty,
          uom: row.uom,
          unitCost: row.unitCost,
          amount: row.amount,
        };
      });

      await apiFetch(`/api/projects/${projectId}/budget`, {
        method: "POST",
        body: JSON.stringify({
          lineItems: lineItemsToSubmit,
        }),
      });

      // Navigate back to project budget page
      router.push(`/${projectId}/budget`);
    } catch (error) {
      // apiFetch throws ApiError with the real server message — surface it
      // to the user instead of a generic fallback (Rule 2).
      const message = `Failed to create budget line items: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      setError("root", { type: "server", message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push(`/${projectId}/budget`);
  };

  const previewCostCode = availableCostCodes.find(
    (cc) => cc.id === newCodeData.costCodeId,
  );

  return (
    <PageShell
      variant="form"
      title="Create Budget Line Items"
      description="Add one or more line items to the project budget."
      onBack={() => router.push(`/${projectId}/budget`)}
      backLabel="Back to Budget"
    >
      <FormContainer maxWidth="lg" withCard={false}>
        <Form {...form}>
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <FormSection
              title="Line Items"
              description="Add budget code, quantity, UOM, unit cost, and amount for each row."
            >
              <RHFFieldArrayTable
                control={control}
                name="rows"
                addLabel="Add Row"
                createRow={createBudgetLineRow}
                columns={[
                  {
                    key: "budgetCode",
                    header: "Budget Code*",
                    mobileLabel: "Budget Code*",
                    className: "min-w-[320px]",
                    cell: ({ index, rowName }) => (
                      <Controller
                        control={control}
                        name={`${rowName}.budgetCodeId`}
                        render={({ field }) => (
                          <BudgetCodeSelector
                            value={field.value}
                            onValueChange={(id, code) => {
                              field.onChange(id);
                              setValue(
                                `${rowName}.budgetCodeLabel`,
                                code.fullLabel,
                                { shouldDirty: true },
                              );
                            }}
                            budgetCodes={budgetCodes}
                            loading={loadingCodes}
                            onCreateNew={() => {
                              setPendingRowIndex(index);
                              setShowCreateCodeModal(true);
                            }}
                            placeholder="Select budget code..."
                            className="h-9"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    key: "qty",
                    header: "Qty",
                    mobileLabel: "Qty",
                    className: "w-24",
                    cell: ({ rowName }) => (
                      <RHFTextField
                        control={control}
                        name={`${rowName}.qty`}
                        label="Qty"
                        type="number"
                      />
                    ),
                  },
                  {
                    key: "uom",
                    header: "UOM",
                    mobileLabel: "UOM",
                    className: "w-28",
                    cell: ({ rowName }) => (
                      <RHFSelectField
                        control={control}
                        name={`${rowName}.uom`}
                        label="UOM"
                        placeholder="Select"
                        options={UOM_OPTIONS}
                      />
                    ),
                  },
                  {
                    key: "unitCost",
                    header: "Unit Cost",
                    mobileLabel: "Unit Cost",
                    className: "w-32",
                    cell: ({ rowName }) => (
                      <RHFTextField
                        control={control}
                        name={`${rowName}.unitCost`}
                        label="Unit Cost"
                        type="number"
                      />
                    ),
                  },
                  {
                    key: "amount",
                    header: "Amount*",
                    mobileLabel: "Amount*",
                    className: "w-32",
                    cell: ({ rowName }) => (
                      <RHFTextField
                        control={control}
                        name={`${rowName}.amount`}
                        label="Amount*"
                        type="number"
                      />
                    ),
                  },
                ]}
              />
            </FormSection>

            <FormServerError message={errors.root?.message} />

            <FormActions
              submitLabel={`Create ${rowCount} Line Item${rowCount > 1 ? "s" : ""}`}
              onCancel={handleCancel}
              isSubmitting={loading}
              align="between"
            >
              <DevAutoFillButton
                formType="budgetLineItem"
                onAutoFill={(data) => {
                  const autoFillData = data as {
                    amount?: number;
                    quantity?: number;
                    unit?: string;
                    unit_cost?: number;
                  };
                  const firstBudgetCode = budgetCodes[0];
                  reset({
                    rows: [
                      {
                        budgetCodeId: firstBudgetCode?.id || "",
                        budgetCodeLabel: firstBudgetCode?.fullLabel || "",
                        qty: autoFillData.quantity?.toString() || "1",
                        uom: autoFillData.unit || "EA",
                        unitCost: autoFillData.unit_cost?.toString() || "",
                        amount:
                          autoFillData.amount?.toString() ||
                          calculateAmount(
                            autoFillData.quantity?.toString() || "1",
                            autoFillData.unit_cost?.toString() || "0",
                          ),
                      },
                    ],
                  });
                }}
              />
            </FormActions>
          </form>
        </Form>
      </FormContainer>

      {/* Create Budget Code Modal */}
      <Modal
        open={showCreateCodeModal}
        onOpenChange={(open) => {
          setShowCreateCodeModal(open);
          if (!open) setPendingRowIndex(null);
        }}
      >
        <ModalContent className="sm:max-w-lg">
          <ModalHeader>
            <ModalTitle>Create New Budget Code</ModalTitle>
            <ModalDescription>
              Add a new budget code that can be used for line items in this
              project.
            </ModalDescription>
          </ModalHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="costCode">Cost Code*</Label>
              {loadingCostCodes ? (
                <div className="border rounded-md p-4 text-sm text-muted-foreground">
                  Loading cost codes...
                </div>
              ) : (
                <div className="border rounded-md max-h-96 overflow-y-auto">
                  {Object.entries(groupedCostCodes)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([division]) => (
                      <div key={division} className="border-b last:border-b-0">
                        {/* Division Header - Clickable */}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => toggleDivision(division)}
                          className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-muted transition-colors h-auto rounded-none"
                        >
                          <span className="text-sm font-semibold text-foreground">
                            {division}
                          </span>
                          {expandedDivisions.has(division) ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>

                        {/* Cost Codes - Only show when expanded */}
                        {expandedDivisions.has(division) && (
                          <div className="bg-muted/50">
                            {groupedCostCodes[division].map((costCode) => (
                              <Button
                                key={costCode.id}
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  setNewCodeData({
                                    ...newCodeData,
                                    costCodeId: costCode.id,
                                  })
                                }
                                className={`w-full text-left px-6 py-2 text-sm hover:bg-muted transition-colors h-auto rounded-none justify-start ${
                                  newCodeData.costCodeId === costCode.id
                                    ? "bg-info/10 text-info font-medium"
                                    : "text-foreground"
                                }`}
                              >
                                {costCode.id} – {costCode.title}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Click on a division to expand and select a cost code
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="costType">Cost Type*</Label>
              <Select
                value={newCodeData.costType}
                onValueChange={(value) =>
                  setNewCodeData({ ...newCodeData, costType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">L - Labor</SelectItem>
                  <SelectItem value="M">M - Material</SelectItem>
                  <SelectItem value="S">S - Subcontract</SelectItem>
                  <SelectItem value="X">X - Expense</SelectItem>
                  <SelectItem value="E">E - Equipment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm font-medium text-foreground">Preview:</p>
              <p className="text-sm text-foreground mt-1">
                {newCodeData.costCodeId && previewCostCode ? (
                  <>
                    {previewCostCode.id}.{newCodeData.costType} –{" "}
                    {previewCostCode.title} –{" "}
                    {getCostTypeLabel(newCodeData.costType)}
                  </>
                ) : (
                  "Select cost code and cost type to see preview"
                )}
              </p>
            </div>
          </div>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateCodeModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateBudgetCode}
              disabled={
                loading || !newCodeData.costCodeId || !newCodeData.costType
              }
            >
              {loading ? "Creating..." : "Create Budget Code"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </PageShell>
  );
}
