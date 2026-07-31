"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import {
  type ProjectBudgetCode,
  useProjectBudgetCodes,
} from "@/hooks/use-project-budget-codes";
import { createClient } from "@/lib/supabase/client";
import { NumberInput } from "@/components/ui/number-input";
import { MoneyField } from "@/components/forms/MoneyField";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SidebarFooter,
} from "@/components/budget/modals/BaseSidebar";
import {
  BaseModal,
  ModalBody,
  ModalFooter,
} from "@/components/budget/modals/BaseModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BudgetCodeSelector } from "@/components/budget/budget-code-selector";
import {
  InlineTable,
  InlineTableHeader,
  InlineTableHeaderRow,
  InlineTableHeaderCell,
  InlineTableBody,
  InlineTableRow,
  InlineTableCell,
} from "@/components/ds/inline-table";

type BudgetCode = ProjectBudgetCode;

interface BudgetLineItemRow {
  id: string;
  budgetCodeId: string;
  budgetCodeLabel: string;
  qty: string;
  uom: string;
  unitCost: string;
  amount: string;
}

interface BudgetLineItemFormProps {
  projectId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function BudgetLineItemForm({
  projectId,
  onSuccess,
  onCancel,
}: BudgetLineItemFormProps) {
  const [loading, setLoading] = useState(false);
  const { budgetCodes, loadingCodes, createBudgetCode } =
    useProjectBudgetCodes(projectId);
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);

  // Cost codes from Supabase
  const [availableCostCodes, setAvailableCostCodes] = useState<
    Array<{
      id: string;
      title: string | null;
      status: string | null;
      division_title: string | null;
    }>
  >([]);
  const [loadingCostCodes, setLoadingCostCodes] = useState(false);
  const [groupedCostCodes, setGroupedCostCodes] = useState<
    Record<
      string,
      Array<{
        id: string;
        title: string | null;
        status: string | null;
        division_title: string | null;
      }>
    >
  >({});

  // Multiple rows state
  const [rows, setRows] = useState<BudgetLineItemRow[]>([
    {
      id: "1",
      budgetCodeId: "",
      budgetCodeLabel: "",
      qty: "",
      uom: "",
      unitCost: "",
      amount: "0.00",
    },
  ]);

  // Budget Code creation modal state
  const [showCreateCodeModal, setShowCreateCodeModal] = useState(false);
  const [newCodeData, setNewCodeData] = useState({
    costCodeId: "",
    costType: "",
  });
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(
    new Set(),
  );

  // Track negative amounts for warnings
  const [negativeAmountRows, setNegativeAmountRows] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!showCreateCodeModal) {
      setPendingRowId(null);
    }
  }, [showCreateCodeModal]);

  // Fetch cost codes from Supabase when create code modal opens
  useEffect(() => {
    const fetchCostCodes = async () => {
      if (!showCreateCodeModal) return;

      try {
        setLoadingCostCodes(true);
        const supabase = createClient();

        // Fetch cost codes from Supabase
        const { data, error } = await supabase
          .from("cost_codes")
          .select("id, title, status, division_title")
          .ilike("status", "active")
          .order("id", { ascending: true });

        if (error) {
          return;
        }

        const codes = data || [];
        setAvailableCostCodes(codes);

        // Group cost codes by division_title
        const grouped = codes.reduce(
          (acc, code) => {
            const divisionKey = code.division_title || "Other";
            if (!acc[divisionKey]) {
              acc[divisionKey] = [];
            }
            acc[divisionKey].push(code);
            return acc;
          },
          {} as Record<string, typeof codes>,
        );

        setGroupedCostCodes(grouped);
      } catch (error) {
        console.error("Failed to fetch cost codes:", error);
        // Intentionally swallowed: form shows with empty cost codes dropdown
      } finally {
        setLoadingCostCodes(false);
      }
    };

    fetchCostCodes();
  }, [showCreateCodeModal]);

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

      const selectedCostCode = availableCostCodes.find(
        (cc) => cc.id === newCodeData.costCodeId,
      );
      if (!selectedCostCode) {
        toast.error("Please select a cost code");
        return;
      }

      const budgetCode = await createBudgetCode({
        costCodeId: newCodeData.costCodeId,
        costTypeId: newCodeData.costType,
        description: selectedCostCode.title || null,
      });

      setRows((prev) => {
        const targetRow =
          (pendingRowId && prev.find((row) => row.id === pendingRowId)) ||
          prev.find((row) => !row.budgetCodeId);

        if (targetRow) {
          return prev.map((row) =>
            row.id === targetRow.id
              ? {
                  ...row,
                  budgetCodeId: budgetCode.id,
                  budgetCodeLabel: budgetCode.fullLabel,
                }
              : row,
          );
        }

        const newRow: BudgetLineItemRow = {
          id: Date.now().toString(),
          budgetCodeId: budgetCode.id,
          budgetCodeLabel: budgetCode.fullLabel,
          qty: "",
          uom: "",
          unitCost: "",
          amount: "0.00",
        };
        return [...prev, newRow];
      });

      setShowCreateCodeModal(false);
      setNewCodeData({ costCodeId: "", costType: "" });
      toast.success("Budget code created and added to form");
    } catch (error) {
      toast.error(
        `Failed to create budget code: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBudgetCodeSelect = (rowId: string, code: BudgetCode) => {
    setRows(
      rows.map((row) =>
        row.id === rowId
          ? { ...row, budgetCodeId: code.id, budgetCodeLabel: code.fullLabel }
          : row,
      ),
    );
  };

  const calculateAmount = (qty: string, unitCost: string): string => {
    const qtyNum = parseFloat(qty) || 0;
    const costNum = parseFloat(unitCost) || 0;
    return (qtyNum * costNum).toFixed(2);
  };

  const handleRowChange = (
    rowId: string,
    field: keyof BudgetLineItemRow,
    value: string,
  ) => {
    const updatedRows = rows.map((row) => {
      if (row.id !== rowId) return row;

      const updatedRow = { ...row, [field]: value };

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
    const updatedRow = updatedRows.find((r) => r.id === rowId);
    if (updatedRow) {
      const amountValue = parseFloat(updatedRow.amount);
      setNegativeAmountRows((prev) => {
        const next = new Set(prev);
        if (amountValue < 0) {
          next.add(rowId);
        } else {
          next.delete(rowId);
        }
        return next;
      });
    }
  };

  const addRow = () => {
    const newRow: BudgetLineItemRow = {
      id: Date.now().toString(),
      budgetCodeId: "",
      budgetCodeLabel: "",
      qty: "",
      uom: "",
      unitCost: "",
      amount: "0.00",
    };
    setRows([...rows, newRow]);
  };

  const removeRow = (rowId: string) => {
    if (rows.length === 1) return;
    setRows(rows.filter((row) => row.id !== rowId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const invalidRows = rows.filter(
        (row) => !row.budgetCodeId || parseFloat(row.amount) === 0,
      );

      if (invalidRows.length > 0) {
        toast.error("All rows must have a budget code and a non-zero amount.");
        setLoading(false);
        return;
      }

      // Get the budget code details for each row
      const lineItemsToSubmit = rows.map((row) => {
        const budgetCode = budgetCodes.find(
          (code) => code.id === row.budgetCodeId,
        );

        return {
          costCodeId: budgetCode?.code || row.budgetCodeId,
          costType: budgetCode?.costTypeId || null,
          qty: row.qty,
          uom: row.uom,
          unitCost: row.unitCost,
          amount: row.amount,
        };
      });

      // Call API to create budget line items
      await apiFetch(`/api/projects/${projectId}/budget`, {
        method: "POST",
        body: JSON.stringify({
          lineItems: lineItemsToSubmit,
        }),
      });
      toast.success("Budget line items created");
      onSuccess?.();
    } catch (error) {
      toast.error(
        `Failed to create budget line items: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div>
            <InlineTable variant="edit">
              <InlineTableHeader>
                <InlineTableHeaderRow>
                  <InlineTableHeaderCell className="w-12">
                    #
                  </InlineTableHeaderCell>
                  <InlineTableHeaderCell className="min-w-72">
                    Budget Code*
                  </InlineTableHeaderCell>
                  <InlineTableHeaderCell className="w-24">
                    Qty
                  </InlineTableHeaderCell>
                  <InlineTableHeaderCell className="w-28">
                    UOM
                  </InlineTableHeaderCell>
                  <InlineTableHeaderCell className="w-32">
                    Unit Cost
                  </InlineTableHeaderCell>
                  <InlineTableHeaderCell className="w-32">
                    Amount*
                  </InlineTableHeaderCell>
                  <InlineTableHeaderCell className="w-12">
                    <span className="sr-only">Actions</span>
                  </InlineTableHeaderCell>
                </InlineTableHeaderRow>
              </InlineTableHeader>
              <InlineTableBody>
                {rows.map((row, index) => (
                  <InlineTableRow key={row.id}>
                    <InlineTableCell className="text-sm text-muted-foreground">
                      {index + 1}
                    </InlineTableCell>

                    <InlineTableCell>
                      <BudgetCodeSelector
                        value={row.budgetCodeId}
                        onValueChange={(value) => {
                          const selected = budgetCodes.find(
                            (code) => code.id === value,
                          );
                          if (selected) handleBudgetCodeSelect(row.id, selected);
                        }}
                        budgetCodes={budgetCodes}
                        loading={loadingCodes}
                        onCreateNew={() => {
                          setPendingRowId(row.id);
                          setShowCreateCodeModal(true);
                        }}
                        placeholder="Select budget code..."
                        className="h-9"
                      />
                    </InlineTableCell>

                    <InlineTableCell>
                      <NumberInput
                        step="0.001"
                        value={row.qty}
                        onChange={(e) =>
                          handleRowChange(row.id, "qty", e.target.value)
                        }
                        placeholder="Quantity"
                        className="h-9 text-center"
                        clearZeroOnFocus={true}
                        aria-label={`Quantity ${index + 1}`}
                      />
                    </InlineTableCell>

                    <InlineTableCell>
                      <Select
                        value={row.uom}
                        onValueChange={(value) =>
                          handleRowChange(row.id, "uom", value)
                        }
                      >
                        <SelectTrigger
                          className="h-9"
                          aria-label={`Unit of measure ${index + 1}`}
                        >
                          <SelectValue placeholder="Select UOM" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EA">EA - Each</SelectItem>
                          <SelectItem value="HR">HR - Hour</SelectItem>
                          <SelectItem value="DAY">DAY - Day</SelectItem>
                          <SelectItem value="WK">WK - Week</SelectItem>
                          <SelectItem value="MO">MO - Month</SelectItem>
                          <SelectItem value="LS">LS - Lump Sum</SelectItem>
                          <SelectItem value="LF">LF - Linear Foot</SelectItem>
                          <SelectItem value="SF">SF - Square Foot</SelectItem>
                          <SelectItem value="SY">SY - Square Yard</SelectItem>
                          <SelectItem value="CF">CF - Cubic Foot</SelectItem>
                          <SelectItem value="CY">CY - Cubic Yard</SelectItem>
                          <SelectItem value="LB">LB - Pound</SelectItem>
                          <SelectItem value="TON">TON - Ton</SelectItem>
                          <SelectItem value="GAL">GAL - Gallon</SelectItem>
                          <SelectItem value="KG">KG - Kilogram</SelectItem>
                          <SelectItem value="M">M - Meter</SelectItem>
                          <SelectItem value="M2">M² - Square Meter</SelectItem>
                          <SelectItem value="M3">M³ - Cubic Meter</SelectItem>
                        </SelectContent>
                      </Select>
                    </InlineTableCell>

                    <InlineTableCell>
                      <MoneyField
                        label="Unit cost"
                        value={
                          row.unitCost
                            ? parseFloat(String(row.unitCost))
                            : undefined
                        }
                        onChange={(val) =>
                          handleRowChange(row.id, "unitCost", String(val ?? ""))
                        }
                        inline
                        showCurrency={false}
                        className="h-9"
                        id={`budget-line-item-unit-cost-${row.id}`}
                      />
                    </InlineTableCell>

                    <InlineTableCell>
                      <div className="space-y-2">
                        <MoneyField
                          label="Amount"
                          value={
                            row.amount
                              ? parseFloat(String(row.amount))
                              : undefined
                          }
                          onChange={(val) =>
                            handleRowChange(row.id, "amount", String(val ?? ""))
                          }
                          inline
                          showCurrency={false}
                          allowNegative
                          className="h-9 font-medium"
                          id={`budget-line-item-amount-${row.id}`}
                        />
                        {negativeAmountRows.has(row.id) && (
                          <Alert className="border-status-warning/20 bg-status-warning/10 text-status-warning">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              Negative amounts are unusual. Please verify this
                              is intentional before saving.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </InlineTableCell>

                    <InlineTableCell>
                      {rows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRow(row.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          &times;
                        </Button>
                      )}
                    </InlineTableCell>
                  </InlineTableRow>
                ))}
              </InlineTableBody>
            </InlineTable>

            <div className="px-2 py-3">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm font-medium"
                onClick={addRow}
              >
                Add Row
              </Button>
            </div>
          </div>
        </div>

        <SidebarFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading
              ? "Creating..."
              : `Create ${rows.length} Line Item${rows.length > 1 ? "s" : ""}`}
          </Button>
        </SidebarFooter>
      </form>

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
                                className={`w-full text-left px-6 py-2 text-sm hover:bg-muted transition-colors rounded-none h-auto justify-start font-normal ${
                                  newCodeData.costCodeId === costCode.id
                                    ? "bg-muted text-foreground font-medium"
                                    : "text-foreground"
                                }`}
                              >
                                {costCode.division_title || costCode.id} -{" "}
                                {costCode.title}
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
                  <SelectValue placeholder="Select cost type..." />
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
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm font-medium text-foreground">Preview:</p>
              <p className="text-sm text-foreground mt-1">
                {newCodeData.costCodeId ? (
                  <>
                    {availableCostCodes.find(
                      (cc) => cc.id === newCodeData.costCodeId,
                    )?.division_title ||
                      availableCostCodes.find(
                        (cc) => cc.id === newCodeData.costCodeId,
                      )?.id}
                    .{newCodeData.costType} –{" "}
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
            disabled={
              loading || !newCodeData.costCodeId || !newCodeData.costType
            }
          >
            {loading ? "Creating..." : "Create Budget Code"}
          </Button>
        </ModalFooter>
      </BaseModal>
    </>
  );
}
