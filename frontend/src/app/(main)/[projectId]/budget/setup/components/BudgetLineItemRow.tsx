"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UNITS_OF_MEASURE } from "@/constants/budget";
import { BudgetCodeSelector } from "@/components/budget/budget-code-selector";
import { projectCostCodesToBudgetCodeOptions } from "@/lib/budget/project-cost-code-selector-options";
import type { BudgetLineItem, ProjectCostCode } from "../types";

interface BudgetLineItemRowProps {
  /** The line item data */
  lineItem: BudgetLineItem;
  /** Available project cost codes */
  projectCostCodes: ProjectCostCode[];
  /** Callback when a field changes */
  onFieldChange: (field: keyof BudgetLineItem, value: string) => void;
  /** Callback when a budget code is selected */
  onBudgetCodeSelect: (costCode: ProjectCostCode) => void;
  /** Callback when "Create New" is clicked */
  onCreateNew: () => void;
  /** Callback to remove this row */
  onRemove: () => void;
  /** Whether this row can be removed (false if it's the only row) */
  canRemove: boolean;
}

export function BudgetLineItemRow({
  lineItem,
  projectCostCodes,
  onFieldChange,
  onBudgetCodeSelect,
  onCreateNew,
  onRemove,
  canRemove,
}: BudgetLineItemRowProps) {
  const budgetCodeOptions = projectCostCodesToBudgetCodeOptions(projectCostCodes);

  return (
    <tr>
      <td className="px-4 py-4">
        <BudgetCodeSelector
          value={lineItem.projectCostCodeId}
          budgetCodes={budgetCodeOptions}
          onValueChange={(value) => {
            const selected = projectCostCodes.find((code) => code.id === value);
            if (selected) onBudgetCodeSelect(selected);
          }}
          onCreateNew={onCreateNew}
        />
      </td>
      <td className="px-4 py-4">
        <Input
          type="number"
          placeholder=""
          value={lineItem.qty}
          onChange={(e) => onFieldChange("qty", e.target.value)}
          className="w-24"
        />
      </td>
      <td className="px-4 py-4">
        <Select
          value={lineItem.uom}
          onValueChange={(value) => onFieldChange("uom", value)}
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="-" />
          </SelectTrigger>
          <SelectContent>
            {UNITS_OF_MEASURE.map((uom) => (
              <SelectItem key={uom.code} value={uom.code}>
                {uom.code} - {uom.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-4">
        <Input
          type="number"
          placeholder=""
          value={lineItem.unitCost}
          onChange={(e) => onFieldChange("unitCost", e.target.value)}
          className="w-32"
        />
      </td>
      <td className="px-4 py-4">
        <Input
          type="number"
          placeholder=""
          value={lineItem.amount}
          onChange={(e) => onFieldChange("amount", e.target.value)}
          className="w-32"
        />
      </td>
      <td className="px-4 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={!canRemove}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      </td>
    </tr>
  );
}
