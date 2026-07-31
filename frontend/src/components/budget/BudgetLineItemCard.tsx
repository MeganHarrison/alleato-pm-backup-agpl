import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UomSelect } from "./UomSelect";
import { BudgetItemDeleteDialog } from "./BudgetItemDeleteDialog";
import { BudgetCodeSelector } from "@/components/budget/budget-code-selector";
import { formatCurrency } from "@/lib/format";
import { projectCostCodesToBudgetCodeOptions } from "@/lib/budget/project-cost-code-selector-options";
import type {
  BudgetLineItem,
  ProjectCostCode,
} from "@/app/(main)/[projectId]/budget/setup/types";

interface BudgetLineItemCardProps {
  readonly item: BudgetLineItem;
  readonly index: number;
  readonly projectCostCodes: ProjectCostCode[];
  readonly onBudgetCodeSelect: (costCode: ProjectCostCode) => void;
  readonly onFieldChange: (field: keyof BudgetLineItem, value: string) => void;
  readonly onRemove: () => void;
  readonly onCreateNew: () => void;
  readonly canRemove: boolean;
  readonly onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * BudgetLineItemCard - Mobile card view for a single budget line item.
 * Uses semantic tokens and design system spacing.
 */
export function BudgetLineItemCard({
  item,
  index,
  projectCostCodes,
  onBudgetCodeSelect,
  onFieldChange,
  onRemove,
  onCreateNew,
  canRemove,
  onKeyDown,
}: BudgetLineItemCardProps) {
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

  const itemDescription = item.costCodeLabel
    ? `"${item.costCodeLabel}" (Line ${index + 1})`
    : `Line ${index + 1}`;

  const formattedAmount = formatCurrency(parseFloat(item.amount || "0"));

  return (
    <div className="rounded-md bg-muted p-4 space-y-4">
      {/* Card Header — line number + amount + delete */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Line {index + 1}
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formattedAmount}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDeleteClick}
          disabled={!canRemove}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Budget Code Selector — full width */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Budget Code <span className="text-destructive">*</span>
        </Label>
        <BudgetCodeSelector
          value={item.projectCostCodeId}
          budgetCodes={budgetCodeOptions}
          onValueChange={(value) => {
            const selected = projectCostCodes.find((code) => code.id === value);
            if (selected) onBudgetCodeSelect(selected);
          }}
          onCreateNew={onCreateNew}
          className="w-full"
        />
      </div>

      {/* 2-Column Grid: Qty + UOM */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Qty</Label>
          <Input
            type="number"
            value={item.qty}
            onChange={(e) => onFieldChange("qty", e.target.value)}
            onKeyDown={onKeyDown}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">UOM</Label>
          <UomSelect
            value={item.uom}
            onValueChange={(value) => onFieldChange("uom", value)}
            className="h-10"
          />
        </div>
      </div>

      {/* 2-Column Grid: Unit Cost + Amount */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Unit Cost</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              $
            </span>
            <Input
              type="number"
              value={item.unitCost}
              onChange={(e) => onFieldChange("unitCost", e.target.value)}
              onKeyDown={onKeyDown}
              className="h-10 pl-7"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Amount</Label>
          <Input
            type="number"
            value={item.amount}
            className="h-10 bg-muted text-muted-foreground"
            disabled
          />
        </div>
      </div>

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
