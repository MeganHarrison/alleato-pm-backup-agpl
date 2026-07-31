"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COST_TYPE_LABELS, type BudgetCode } from "./types";
import { createClient } from "@/lib/supabase/client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { toast } from "sonner";
import type { SovLineItem } from "@/lib/schemas/create-subcontract-schema";

interface CostCode {
  id: string;
  title: string | null;
  status: string | null;
  division_title: string | null;
}

interface CreateBudgetCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  budgetCodes: BudgetCode[];
  onBudgetCodeCreated: (budgetCode: BudgetCode) => void;
  sovLines: SovLineItem[];
  accountingMethod: string;
  onSovLinesChange: (lines: SovLineItem[]) => void;
}

export function CreateBudgetCodeModal({
  open,
  onOpenChange,
  projectId,
  budgetCodes,
  onBudgetCodeCreated,
  sovLines,
  accountingMethod,
  onSovLinesChange,
}: CreateBudgetCodeModalProps) {
  const [availableCostCodes, setAvailableCostCodes] = React.useState<CostCode[]>([]);
  const [loadingCostCodes, setLoadingCostCodes] = React.useState(false);
  const [expandedDivisions, setExpandedDivisions] = React.useState<Set<string>>(
    new Set(),
  );
  const [groupedCostCodes, setGroupedCostCodes] = React.useState<
    Record<string, CostCode[]>
  >({});
  const [isCreatingBudgetCode, setIsCreatingBudgetCode] = React.useState(false);
  const [newBudgetCodeData, setNewBudgetCodeData] = React.useState({
    costCodeId: "",
    costType: "",
  });

  React.useEffect(() => {
    const fetchCostCodes = async () => {
      if (!open) return;
      try {
        setLoadingCostCodes(true);
        const supabaseClient = createClient();
        const { data, error } = await supabaseClient
          .from("cost_codes")
          .select("id, title, status, division_title")
          .eq("status", "Active")
          .order("id", { ascending: true });

        if (error) return;

        const codes = data || [];
        setAvailableCostCodes(codes);

        const grouped = codes.reduce(
          (acc: Record<string, CostCode[]>, code: CostCode) => {
            const divisionKey = code.division_title || "Other";
            if (!acc[divisionKey]) acc[divisionKey] = [];
            acc[divisionKey].push(code);
            return acc;
          },
          {} as Record<string, CostCode[]>,
        );
        setGroupedCostCodes(grouped);
      } catch (error) {
        reportNonCriticalFailure({
          area: "subcontract-budget-code-modal",
          operation: "load-cost-codes",
          error,
          userVisibleFallback: "Cost code options could not be loaded.",
        });
      } finally {
        setLoadingCostCodes(false);
      }
    };
    fetchCostCodes();
  }, [open]);

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
      setIsCreatingBudgetCode(true);
      const selectedCostCode = availableCostCodes.find(
        (cc) => cc.id === newBudgetCodeData.costCodeId,
      );
      if (!selectedCostCode) {
        toast.error("Please select a cost code");
        return;
      }

      const response = await fetch(`/api/projects/${projectId}/budget-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cost_code_id: newBudgetCodeData.costCodeId,
          cost_type_id: newBudgetCodeData.costType,
          description: selectedCostCode.title || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || "Failed to create budget code");
      }

      const { budgetCode } = (await response.json()) as {
        budgetCode: BudgetCode;
      };
      onBudgetCodeCreated(budgetCode);

      // Find first empty budget code row and assign
      const emptyIndex = sovLines.findIndex(
        (line) => !line.budgetCodeId && !line.isGroup,
      );
      if (emptyIndex >= 0) {
        const updated = [...sovLines];
        updated[emptyIndex] = {
          ...updated[emptyIndex],
          budgetCodeId: budgetCode.id,
          budgetCodeLabel: budgetCode.fullLabel,
          budgetCode: budgetCode.code,
        };
        onSovLinesChange(updated);
      } else {
        const isUnitQuantity = accountingMethod === "unit_quantity";
        onSovLinesChange([
          ...sovLines,
          {
            lineNumber: sovLines.length + 1,
            budgetCodeId: budgetCode.id,
            budgetCodeLabel: budgetCode.fullLabel,
            budgetCode: budgetCode.code,
            description: "",
            amount: 0,
            quantity: isUnitQuantity ? 1 : undefined,
            unitCost: isUnitQuantity ? 0 : undefined,
            unitOfMeasure: isUnitQuantity ? "" : undefined,
            billedToDate: 0,
          } as SovLineItem,
        ]);
      }

      onOpenChange(false);
      setNewBudgetCodeData({ costCodeId: "", costType: "" });
      toast.success("Budget code created and added to form");
    } catch (error) {
      toast.error(
        `Failed to create budget code: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsCreatingBudgetCode(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Budget Code</DialogTitle>
          <DialogDescription>
            Add a new budget code that can be used for line items in this
            project.
          </DialogDescription>
        </DialogHeader>
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
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => toggleDivision(division)}
                        className="w-full flex items-center justify-between px-4 py-2 text-left h-auto font-normal"
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
                                setNewBudgetCodeData({
                                  ...newBudgetCodeData,
                                  costCodeId: costCode.id,
                                })
                              }
                              className={`w-full text-left justify-start px-6 py-2 text-sm h-auto font-normal ${
                                newBudgetCodeData.costCodeId === costCode.id
                                  ? "bg-primary/10 text-primary font-medium"
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
              value={newBudgetCodeData.costType}
              onValueChange={(value) =>
                setNewBudgetCodeData({
                  ...newBudgetCodeData,
                  costType: value,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select cost type" />
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
              {newBudgetCodeData.costCodeId ? (
                <>
                  {availableCostCodes.find(
                    (cc) => cc.id === newBudgetCodeData.costCodeId,
                  )?.division_title ||
                    availableCostCodes.find(
                      (cc) => cc.id === newBudgetCodeData.costCodeId,
                    )?.id}
                  .{newBudgetCodeData.costType} –{" "}
                  {
                    availableCostCodes.find(
                      (cc) => cc.id === newBudgetCodeData.costCodeId,
                    )?.title
                  }{" "}
                  – {COST_TYPE_LABELS[newBudgetCodeData.costType] || newBudgetCodeData.costType}
                </>
              ) : (
                "Select cost code and cost type to see preview"
              )}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreateBudgetCode}
            disabled={
              isCreatingBudgetCode ||
              !newBudgetCodeData.costCodeId ||
              !newBudgetCodeData.costType
            }
          >
            {isCreatingBudgetCode ? "Creating..." : "Create Budget Code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
