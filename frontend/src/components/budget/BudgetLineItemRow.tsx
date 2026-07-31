import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Inline } from "@/components/layout/inline";
import { UomSelect } from "./UomSelect";
import { BudgetItemDeleteDialog } from "./BudgetItemDeleteDialog";
import { BudgetCodeSelector } from "@/components/budget/budget-code-selector";
import { projectCostCodesToBudgetCodeOptions } from "@/lib/budget/project-cost-code-selector-options";
import type {
  BudgetLineItem,
  ProjectCostCode,
} from "@/app/(main)/[projectId]/budget/setup/types";

interface BudgetLineItemRowProps {
  item: BudgetLineItem;
  projectCostCodes: ProjectCostCode[];
  onBudgetCodeSelect: (costCode: ProjectCostCode) => void;
  onFieldChange: (field: keyof BudgetLineItem, value: string) => void;
  onRemove: () => void;
  onCreateNew: () => void;
  canRemove: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * BudgetLineItemRow - Desktop table row for budget line item
 * Part of the budget setup table component
 */
export function BudgetLineItemRow({
  item,
  projectCostCodes,
  onBudgetCodeSelect,
  onFieldChange,
  onRemove,
  onCreateNew,
  canRemove,
  onKeyDown,
}: BudgetLineItemRowProps) {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const budgetCodeOptions = React.useMemo(
    () => projectCostCodesToBudgetCodeOptions(projectCostCodes),
    [projectCostCodes],
  );

  const handleDeleteClick = () => {
    if (!canRemove) return;
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    onRemove();
    setShowDeleteDialog(false);
  };

  // Create description for the item being deleted
  const itemDescription = item.costCodeLabel
    ? `the line item "${item.costCodeLabel}"`
    : "this line item";
  return (
    <div className="px-4 py-4 hover:bg-muted">
      <Inline gap="md" align="center">
        {/* Budget Code Selector */}
        <div className="flex-1">
          <BudgetCodeSelector
            value={item.projectCostCodeId}
            budgetCodes={budgetCodeOptions}
            onValueChange={(value) => {
              const selected = projectCostCodes.find((code) => code.id === value);
              if (selected) onBudgetCodeSelect(selected);
            }}
            onCreateNew={onCreateNew}
          />
        </div>

        {/* Quantity */}
        <div className="w-16">
          <Input
            type="number"
            placeholder=""
            value={item.qty}
            onChange={(e) => onFieldChange("qty", e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full text-right"
          />
        </div>

        {/* Unit of Measure */}
        <div className="w-20">
          <UomSelect
            value={item.uom}
            onValueChange={(value) => onFieldChange("uom", value)}
            className="w-full"
          />
        </div>

        {/* Unit Cost */}
        <div className="w-28">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              $
            </span>
            <Input
              type="number"
              placeholder=""
              value={item.unitCost}
              onChange={(e) => onFieldChange("unitCost", e.target.value)}
              onKeyDown={onKeyDown}
              className="w-full pl-7 text-right"
            />
          </div>
        </div>

        {/* Amount (calculated, disabled) */}
        <div className="w-28">
          <Input
            type="number"
            value={item.amount}
            className="w-full bg-muted text-right"
            disabled
          />
        </div>

        {/* Delete Button */}
        <div className="w-10 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteClick}
            disabled={!canRemove}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </Inline>

      {/* Delete Confirmation Dialog */}
      <BudgetItemDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteConfirm}
        itemDescription={itemDescription}
      />
    </div>
  );
}
