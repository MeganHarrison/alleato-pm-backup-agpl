"use client";

import * as React from "react";
import {
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ApiError } from "@/lib/api-client";
import {
  type ProjectBudgetCode,
  useProjectBudgetCodes,
} from "@/hooks/use-project-budget-codes";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { MoneyField } from "@/components/forms/MoneyField";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BaseModal,
  ModalBody,
  ModalFooter,
} from "@/components/budget/modals/BaseModal";
import {
  ProjectCostCodeSelector,
  ProjectCostTypeSelector,
} from "@/components/budget/budget-code-field-selectors";
import { Label } from "@/components/ui/label";
import { appToast as toast } from "@/lib/toast/app-toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { InfoAlert } from "@/components/ds/InfoAlert";

type BudgetCode = ProjectBudgetCode;

interface CostCodeOption {
  id: string;
  title: string | null;
  status: string | null;
  division_id: string;
  division_code: string;
  division_title: string;
}

export interface InlineLineItemData {
  budgetCodeId: string;
  budgetCodeLabel: string;
  costCodeId: string;
  costTypeId: string | null;
  qty: string;
  uom: string;
  unitCost: string;
  amount: string;
}

interface BudgetLineItemCreatorModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: InlineLineItemData[]) => Promise<void>;
  isLocked?: boolean;
  /**
   * When true, new lines are forced to $0.00. Quantity and unit cost inputs
   * are disabled. Used after a prime contract is executed — budget amounts
   * can only change through change orders.
   */
  requireZeroAmount?: boolean;
}

export function BudgetLineItemCreatorModal({
  projectId,
  isOpen,
  onClose,
  onCreate,
  isLocked = false,
  requireZeroAmount = false,
}: BudgetLineItemCreatorModalProps) {
  const [rows, setRows] = React.useState<InlineLineItemData[]>([
    {
      budgetCodeId: "",
      budgetCodeLabel: "",
      costCodeId: "",
      costTypeId: null,
      qty: "1",
      uom: "",
      unitCost: "",
      amount: "0.00",
    },
  ]);

  const { budgetCodes, loadingCodes, createBudgetCode } =
    useProjectBudgetCodes(projectId, { enabled: isOpen });
  const [isCreating, setIsCreating] = React.useState(false);
  const [smartCopyUOM, setSmartCopyUOM] = React.useState(true);
  const [pendingRowIndex, setPendingRowIndex] = React.useState<number | null>(
    null,
  );
  const [negativeAmountRows, setNegativeAmountRows] = React.useState<
    Set<number>
  >(new Set());

  // Budget Code creation modal state
  const [showCreateCodeModal, setShowCreateCodeModal] = React.useState(false);
  const [newCodeData, setNewCodeData] = React.useState({
    costCodeId: "",
    costType: "",
  });
  const [availableCostCodes, setAvailableCostCodes] = React.useState<
    CostCodeOption[]
  >([]);
  const [loadingCostCodes, setLoadingCostCodes] = React.useState(false);
  const [expandedDivisions, setExpandedDivisions] = React.useState<Set<string>>(
    new Set(),
  );
  const [groupedCostCodes, setGroupedCostCodes] = React.useState<
    Record<string, CostCodeOption[]>
  >({});

  // Reset form when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setRows([
        {
          budgetCodeId: "",
          budgetCodeLabel: "",
          costCodeId: "",
          costTypeId: null,
          qty: "1",
          uom: "",
          unitCost: "",
          amount: "0.00",
        },
      ]);
      setPendingRowIndex(null);
      setNegativeAmountRows(new Set());
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!showCreateCodeModal) {
      setPendingRowIndex(null);
    }
  }, [showCreateCodeModal]);

  // Fetch cost codes when create code modal opens
  React.useEffect(() => {
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
          .order("id", { ascending: true });

        if (error) {
          console.error("Error fetching cost codes:", error);
          return;
        }

        const codesWithDivisions: CostCodeOption[] =
          data
            ?.filter((code) => code.title !== null && code.title !== "")
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

        // Group cost codes by division
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
      } finally {
        setLoadingCostCodes(false);
      }
    };

    fetchCostCodes();
  }, [showCreateCodeModal]);

  const calculateAmount = (qty: string, unitCost: string): string => {
    const qtyNum = parseFloat(qty) || 0;
    const costNum = parseFloat(unitCost) || 0;
    return (qtyNum * costNum).toFixed(2);
  };

  const handleRowChange = (
    index: number,
    field: keyof InlineLineItemData,
    value: string,
  ) => {
    const updatedRows = rows.map((row, i) => {
      if (i !== index) return row;

      const updatedRow = { ...row, [field]: value };

      // Auto-calculate amount when qty or unitCost changes
      if (field === "qty" || field === "unitCost") {
        updatedRow.amount = calculateAmount(
          updatedRow.qty,
          updatedRow.unitCost,
        );
      }

      return updatedRow;
    });

    setRows(updatedRows);

    // Check for negative amounts
    const updatedRow = updatedRows[index];
    if (updatedRow) {
      const amountValue = parseFloat(updatedRow.amount);
      setNegativeAmountRows((prev) => {
        const next = new Set(prev);
        if (amountValue < 0) {
          next.add(index);
        } else {
          next.delete(index);
        }
        return next;
      });
    }
  };

  const handleBudgetCodeSelect = (index: number, code: BudgetCode) => {
    setRows(
      rows.map((row, i) =>
        i === index
          ? {
              ...row,
              budgetCodeId: code.id,
              budgetCodeLabel: code.fullLabel,
              costCodeId: code.code,
              costTypeId: code.costTypeId ?? null,
            }
          : row,
      ),
    );
  };

  // Helper function for currency formatting
  const formatCurrency = (value: string): string => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Calculate total amount across all rows
  const calculateTotal = (): number => {
    return rows.reduce((sum, row) => {
      return sum + (parseFloat(row.amount) || 0);
    }, 0);
  };

  const addRow = () => {
    const previousRow = rows[rows.length - 1];
    const newRowIndex = rows.length;

    const newRow = {
      budgetCodeId: "",
      budgetCodeLabel: "",
      costCodeId: "",
      costTypeId: null,
      qty: "1",
      uom: smartCopyUOM && previousRow.uom ? previousRow.uom : "",
      unitCost: "",
      amount: "0.00",
    };

    setRows([...rows, newRow]);

    // Auto-focus first input of new row
    setTimeout(() => {
      const firstInput = document.querySelector(
        `input[tabindex="${newRowIndex * 5 + 1}"]`,
      ) as HTMLInputElement;
      if (firstInput) {
        firstInput.focus();
      }
    }, 50);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
    // Update negative amount tracking for shifted indices
    setNegativeAmountRows((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < index) next.add(idx);
        else if (idx > index) next.add(idx - 1);
      }
      return next;
    });
  };

  const handleCreateBudgetCode = async () => {
    try {
      const selectedCostCode = availableCostCodes.find(
        (cc) => cc.id === newCodeData.costCodeId,
      );
      if (!selectedCostCode) {
        toast.error("Please select a cost code");
        return;
      }

      let createdCode: ProjectBudgetCode;
      try {
        createdCode = await createBudgetCode({
          costCodeId: newCodeData.costCodeId,
          costTypeId: newCodeData.costType,
          description: selectedCostCode.title,
        });
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 409) {
          // The code already exists in this project's chart (it just wasn't
          // visible in the dropdown). Tell the user and STOP — do not fall
          // through to the row/toast logic below, which would dereference the
          // now-null created code and crash the page.
          const costTypeLabel = getCostTypeLabel(newCodeData.costType);
          toast.error(
            `Budget code "${selectedCostCode.title} – ${costTypeLabel}" already exists for this project. Select it from the dropdown instead.`,
          );
          setShowCreateCodeModal(false);
          setNewCodeData({ costCodeId: "", costType: "" });
          return;
        }
        throw err;
      }

      setRows((prev) => {
        if (pendingRowIndex !== null && prev[pendingRowIndex]) {
          return prev.map((row, i) =>
            i === pendingRowIndex
              ? {
                  ...row,
                  budgetCodeId: createdCode.id,
                  budgetCodeLabel: createdCode.fullLabel,
                  costCodeId: createdCode.code,
                  costTypeId: createdCode.costTypeId ?? null,
                }
              : row,
          );
        }

        const firstEmptyIndex = prev.findIndex((row) => !row.budgetCodeId);
        if (firstEmptyIndex >= 0) {
          return prev.map((row, i) =>
            i === firstEmptyIndex
              ? {
                  ...row,
                  budgetCodeId: createdCode.id,
                  budgetCodeLabel: createdCode.fullLabel,
                  costCodeId: createdCode.code,
                  costTypeId: createdCode.costTypeId ?? null,
                }
              : row,
          );
        }

        return [
          ...prev,
          {
            budgetCodeId: createdCode.id,
            budgetCodeLabel: createdCode.fullLabel,
            costCodeId: createdCode.code,
            costTypeId: createdCode.costTypeId ?? null,
            qty: "1",
            uom: "",
            unitCost: "",
            amount: "0.00",
          },
        ];
      });
      setShowCreateCodeModal(false);
      setNewCodeData({ costCodeId: "", costType: "" });
      toast.success("Budget code created successfully");
    } catch (error) {
      toast.error(
        `Failed to create budget code: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  };

  const handleCreate = async () => {
    // Validate each row with specific, actionable error messages
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowSuffix = rows.length > 1 ? ` (row ${i + 1})` : "";

      if (!row.budgetCodeId) {
        toast.error(`Please select a budget code${rowSuffix}`);
        return;
      }

      if (!row.costTypeId) {
        toast.error(`Budget code is missing a cost type${rowSuffix}`);
        return;
      }

      // When amounts are locked, quantity/unit cost are forced to zero
      // and the validations below don't apply — every line ships at $0.00.
      if (requireZeroAmount) continue;

      if ((parseFloat(row.qty) || 0) < 1) {
        toast.error(`Quantity must be at least 1${rowSuffix}`);
        return;
      }

      if (!row.unitCost || parseFloat(row.unitCost) === 0) {
        toast.error(`Must enter a unit cost${rowSuffix}`);
        return;
      }
    }

    // Belt-and-suspenders: force every row to $0.00 when the lock is on,
    // even if state somehow drifted. The server also enforces this.
    const rowsToSubmit = requireZeroAmount
      ? rows.map((row) => ({
          ...row,
          qty: row.qty || "1",
          unitCost: "0",
          amount: "0.00",
        }))
      : rows;

    setIsCreating(true);
    try {
      await onCreate(rowsToSubmit);
      // Reset after successful creation
      setRows([
        {
          budgetCodeId: "",
          budgetCodeLabel: "",
          costCodeId: "",
          costTypeId: null,
          qty: "1",
          uom: "",
          unitCost: "",
          amount: "0.00",
        },
      ]);
      onClose();
      toast.success(
        `Successfully created ${rows.length} budget line item${rows.length > 1 ? "s" : ""}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create budget line items";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  // Deduplicate budget codes (same code + costType) and filter out codes already selected in other rows
  const deduplicatedCodes = React.useMemo(() => {
    const seen = new Set<string>();
    return budgetCodes.filter((code) => {
      const key = `${code.code}|${code.costTypeId ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [budgetCodes]);

  const getAvailableCodesForRow = React.useCallback(
    (rowIndex: number) => {
      // Collect budget code IDs already selected in OTHER rows
      const selectedIds = new Set(
        rows
          .filter((r, i) => i !== rowIndex && r.budgetCodeId)
          .map((r) => r.budgetCodeId),
      );
      return deduplicatedCodes.filter((code) => !selectedIds.has(code.id));
    },
    [deduplicatedCodes, rows],
  );

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

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title="Add Budget Line Items"
        size="xl"
      >
        <ModalBody className="min-h-0 px-6 pb-4">
          {requireZeroAmount && (
            <div className="mb-4">
              <InfoAlert variant="warning">
                <p className="font-medium">Budget amounts are locked</p>
                <p className="mt-0.5">
                  The prime contract has been executed. New line items can be
                  added, but they must be created at $0.00. Budget changes
                  must flow through change orders.
                </p>
              </InfoAlert>
            </div>
          )}
          {/* Smart Copy UOM Toggle */}
          <div className="mb-4 flex gap-4 text-xs">
            <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
              <Checkbox
                checked={smartCopyUOM}
                onCheckedChange={(checked) => setSmartCopyUOM(Boolean(checked))}
              />
              <span>Copy UOM to new rows</span>
            </label>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="w-8 bg-primary/5 py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    #
                  </th>
                  <th className="w-64 bg-primary/5 py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    Cost Code <span className="text-destructive">*</span>
                  </th>
                  <th className="w-28 bg-primary/5 py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    Cost Type <span className="text-destructive">*</span>
                  </th>
                  <th className="w-24 bg-primary/5 py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    Qty
                  </th>
                  <th className="w-24 bg-primary/5 py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    UOM
                  </th>
                  <th className="w-36 bg-primary/5 py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    Unit Cost
                  </th>
                  <th className="w-36 bg-primary/5 py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    Amount <span className="text-destructive">*</span>
                  </th>
                  <th className="w-8 bg-primary/5 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {rows.map((row, index) => (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="group border-b border-border last:border-b-0"
                    >
                      <td className="py-2 pr-4 align-middle text-sm text-muted-foreground">
                        {index + 1}
                      </td>

                      <td className="w-64 py-2 pr-3 align-middle">
                        <ProjectCostCodeSelector
                          value={row.budgetCodeId}
                          onValueChange={(selected) =>
                            handleBudgetCodeSelect(index, selected)
                          }
                          budgetCodes={getAvailableCodesForRow(index)}
                          loading={loadingCodes}
                          onCreateNew={() => {
                            setPendingRowIndex(index);
                            setShowCreateCodeModal(true);
                          }}
                          placeholder="Select cost code..."
                          ariaLabel={`Cost Code for line item ${index + 1}`}
                          className="h-8 border-border/60 bg-muted/30"
                        />
                      </td>

                      <td className="w-28 py-2 pr-3 align-middle">
                        <ProjectCostTypeSelector
                          value={row.budgetCodeId}
                          onValueChange={(selected) =>
                            handleBudgetCodeSelect(index, selected)
                          }
                          budgetCodes={getAvailableCodesForRow(index)}
                          loading={loadingCodes}
                          ariaLabel={`Cost Type for line item ${index + 1}`}
                          className="h-8 border-border/60 bg-muted/30"
                        />
                      </td>

                      <td className="py-2 pr-3 align-middle">
                        <NumberInput
                          step="1"
                          decimals={0}
                          aria-label={`Quantity for line item ${index + 1}`}
                          data-testid={`budget-qty-input-${index}`}
                          value={requireZeroAmount ? "" : row.qty}
                          onChange={(e) =>
                            handleRowChange(index, "qty", e.target.value)
                          }
                          placeholder={requireZeroAmount ? "—" : "1"}
                          className="h-8 bg-muted/30 border-border/60 text-center"
                          disabled={isCreating || requireZeroAmount}
                          clearZeroOnFocus={true}
                        />
                      </td>

                      <td className="py-2 pr-3 align-middle">
                        <Select
                          value={row.uom}
                          onValueChange={(value) =>
                            handleRowChange(index, "uom", value)
                          }
                        >
                          <SelectTrigger
                            aria-label={`Unit of measure for line item ${index + 1}`}
                            data-testid={`budget-uom-trigger-${index}`}
                            className="h-8 bg-muted/30 border-border/60"
                          >
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EA">EA</SelectItem>
                            <SelectItem value="HR">HR</SelectItem>
                            <SelectItem value="SF">SF</SelectItem>
                            <SelectItem value="LF">LF</SelectItem>
                            <SelectItem value="LS">LS</SelectItem>
                            <SelectItem value="CY">CY</SelectItem>
                            <SelectItem value="TON">TON</SelectItem>
                            <SelectItem value="DAY">DAY</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="py-2 pr-3 align-middle w-36">
                        <MoneyField
                          label="Unit cost"
                          data-testid={`budget-unit-cost-input-${index}`}
                          value={
                            requireZeroAmount
                              ? 0
                              : row.unitCost
                                ? parseFloat(String(row.unitCost))
                                : undefined
                          }
                          onChange={(val) =>
                            handleRowChange(
                              index,
                              "unitCost",
                              String(val ?? ""),
                            )
                          }
                          inline
                          showCurrency={false}
                          className="h-8 bg-muted/30 border-border/60"
                          disabled={isCreating || requireZeroAmount}
                        />
                      </td>

                      <td className="py-2 pr-2 align-top pt-3 w-36">
                        <div className="h-8 flex items-center justify-end px-3 tabular-nums font-medium text-foreground pointer-events-none select-none">
                          $
                          {parseFloat(
                            requireZeroAmount ? "0" : row.amount || "0",
                          ).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        {negativeAmountRows.has(index) && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Negative — verify intentional
                          </p>
                        )}
                      </td>

                      <td className="py-2 align-middle">
                        {rows.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(index)}
                            disabled={isCreating}
                            className="opacity-0 group-hover:opacity-100 h-7 w-7 text-muted-foreground hover:text-destructive transition-all"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
              <tfoot>
                <tr className="border-t border-border !bg-transparent">
                  <td
                    colSpan={6}
                    className="py-2 pr-3 text-right text-sm font-semibold text-foreground"
                  >
                    Total
                  </td>
                  <td className="py-2 pr-2 text-right text-sm font-semibold text-foreground">
                    ${formatCurrency(calculateTotal().toString())}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Add Row Button */}
          <div className="mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={addRow}
              disabled={isCreating}
              aria-label="Add line item"
              title="Add line item"
              className="h-8 px-0 text-sm font-medium text-primary hover:text-primary/90 hover:bg-transparent border-0 shadow-none"
            >
              <Plus />
              Add Line Item
            </Button>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || rows.every((r) => !r.budgetCodeId)}
            className="min-w-36"
          >
            {isCreating ? (
              <span className="flex items-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                />
                Creating...
              </span>
            ) : (
              `Create ${rows.length} Line Item${rows.length > 1 ? "s" : ""}`
            )}
          </Button>
        </ModalFooter>
      </BaseModal>

      {/* Create Budget Code Modal */}
      <BaseModal
        isOpen={showCreateCodeModal}
        onClose={() => setShowCreateCodeModal(false)}
        title="Create New Budget Code"
        size="sm"
      >
        <ModalBody>
          <div className="grid gap-4">
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
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => toggleDivision(division)}
                          className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-muted transition-colors rounded-none h-auto"
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
                                className={cn(
                                  "w-full text-left px-6 py-2 text-sm hover:bg-muted transition-colors rounded-none h-auto justify-start",
                                  newCodeData.costCodeId === costCode.id &&
                                    "bg-muted text-foreground font-medium",
                                )}
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
                  <SelectValue placeholder="Select cost type..." />
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
                {newCodeData.costCodeId && newCodeData.costType ? (
                  <>
                    {newCodeData.costCodeId}.{newCodeData.costType} –{" "}
                    {
                      availableCostCodes.find(
                        (cc) => cc.id === newCodeData.costCodeId,
                      )?.title
                    }{" "}
                    – {getCostTypeLabel(newCodeData.costType)}
                  </>
                ) : (
                  "Select cost code and cost type to see preview"
                )}
              </p>
            </div>
          </div>
        </ModalBody>
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
            disabled={!newCodeData.costCodeId || !newCodeData.costType}
          >
            Create Budget Code
          </Button>
        </ModalFooter>
      </BaseModal>
    </>
  );
}
