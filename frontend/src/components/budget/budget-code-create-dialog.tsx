"use client";

import * as React from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal as Dialog,
  ModalContent as DialogContent,
  ModalDescription as DialogDescription,
  ModalFooter as DialogFooter,
  ModalHeader as DialogHeader,
  ModalTitle as DialogTitle,
} from "@/components/ui/unified-modal";
import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { createClient } from "@/lib/supabase/client";

/**
 * Shape returned by `POST /api/projects/[projectId]/budget-codes`.
 * Kept structurally compatible with the `BudgetCode` consumed by
 * `BudgetCodeSelector` and `normalizeBudgetCodesForSelector`.
 */
export interface CreatedBudgetCode {
  id: string;
  code: string;
  costType: string | null;
  costTypeId?: string | null;
  description: string;
  fullLabel: string;
}

const COST_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "R", label: "R - Contract Revenue" },
  { value: "E", label: "E - Equipment" },
  { value: "X", label: "X - Expense" },
  { value: "L", label: "L - Labor" },
  { value: "M", label: "M - Material" },
  { value: "S", label: "S - Subcontract" },
];

interface CostCode {
  id: string;
  title: string | null;
  status: string | null;
  division_title: string | null;
}

interface BudgetCodeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  /** Called with the newly created budget code after a successful POST. */
  onCreated: (budgetCode: CreatedBudgetCode) => void;
}

/**
 * Single shared "Create New Budget Code" dialog used by every Schedule of
 * Values surface (PO create/edit form, PO/subcontract detail SOV, prime
 * contract SOV). Owns cost-code loading, cost-type selection, and the POST.
 * It deliberately does NOT know about SOV line items — the caller decides what
 * to do with the created code via `onCreated`.
 */
export function BudgetCodeCreateDialog({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: BudgetCodeCreateDialogProps) {
  const [availableCostCodes, setAvailableCostCodes] = React.useState<CostCode[]>([]);
  const [loadingCostCodes, setLoadingCostCodes] = React.useState(false);
  const [expandedDivisions, setExpandedDivisions] = React.useState<Set<string>>(new Set());
  const [groupedCostCodes, setGroupedCostCodes] = React.useState<Record<string, CostCode[]>>({});
  const [isCreating, setIsCreating] = React.useState(false);
  const [costCodeId, setCostCodeId] = React.useState("");
  const [costType, setCostType] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchCostCodes = async () => {
      try {
        setLoadingCostCodes(true);
        const supabase = createClient();
        const { data, error } = await supabase
          .from("cost_codes")
          .select("id, title, status, division_title")
          .eq("status", "Active")
          .order("id", { ascending: true });
        if (error || cancelled) return;
        const codes = (data || []) as CostCode[];
        setAvailableCostCodes(codes);
        setGroupedCostCodes(
          codes.reduce((acc: Record<string, CostCode[]>, code) => {
            const key = code.division_title || "Other";
            (acc[key] ||= []).push(code);
            return acc;
          }, {}),
        );
      } catch (error) {
        reportNonCriticalFailure({
          area: "budget-code-create-dialog",
          operation: "load-cost-codes",
          error,
          userVisibleFallback: "Cost code options could not be loaded.",
        });
      } finally {
        if (!cancelled) setLoadingCostCodes(false);
      }
    };
    void fetchCostCodes();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggleDivision = (division: string) => {
    setExpandedDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(division)) next.delete(division);
      else next.add(division);
      return next;
    });
  };

  const reset = () => {
    setCostCodeId("");
    setCostType("");
  };

  const handleCreate = async () => {
    const selected = availableCostCodes.find((cc) => cc.id === costCodeId);
    if (!selected) {
      toast.error("Please select a cost code");
      return;
    }
    setIsCreating(true);
    try {
      const { budgetCode } = await apiFetch<{ budgetCode: CreatedBudgetCode }>(
        `/api/projects/${projectId}/budget-codes`,
        {
          method: "POST",
          body: JSON.stringify({
            cost_code_id: costCodeId,
            cost_type_id: costType,
            description: selected.title || null,
          }),
        },
      );
      onCreated(budgetCode);
      onOpenChange(false);
      reset();
      toast.success("Budget code created");
    } catch (error) {
      toast.error(
        `Failed to create budget code: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsCreating(false);
    }
  };

  const previewCostCode = availableCostCodes.find((cc) => cc.id === costCodeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Budget Code</DialogTitle>
          <DialogDescription>
            Add a new budget code that can be used for line items in this project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Cost Code*</Label>
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
                        className="flex h-auto w-full items-center justify-between px-4 py-2 text-left font-normal"
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
                              onClick={() => setCostCodeId(costCode.id)}
                              className={`h-auto w-full justify-start px-6 py-2 text-left text-sm font-normal ${
                                costCodeId === costCode.id
                                  ? "bg-primary/10 font-medium text-primary"
                                  : "text-foreground"
                              }`}
                            >
                              {costCode.division_title || costCode.id} - {costCode.title}
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
            <Label>Cost Type*</Label>
            <Select value={costType} onValueChange={setCostType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select cost type" />
              </SelectTrigger>
              <SelectContent>
                {COST_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm font-medium text-foreground">Preview:</p>
            <p className="mt-1 text-sm text-foreground">
              {previewCostCode
                ? `${previewCostCode.division_title || previewCostCode.id}.${costType} – ${previewCostCode.title}`
                : "Select cost code and cost type to see preview"}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !costCodeId || !costType}
          >
            {isCreating ? "Creating..." : "Create Budget Code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
