"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ProjectBudgetCodeFieldOption {
  id: string;
  code: string;
  costType: string | null;
  costTypeId?: string | null;
  description: string;
  fullLabel: string;
}

interface SharedSelectorProps {
  value?: string;
  budgetCodes: ProjectBudgetCodeFieldOption[];
  onValueChange: (code: ProjectBudgetCodeFieldOption) => void;
  loading?: boolean;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

interface ProjectCostCodeSelectorProps extends SharedSelectorProps {
  onCreateNew?: () => void;
  placeholder?: string;
  ariaLabel?: string;
}

interface ProjectCostTypeSelectorProps extends SharedSelectorProps {
  placeholder?: string;
  ariaLabel?: string;
}

function getSelectedBudgetCode(
  value: string | undefined,
  budgetCodes: ProjectBudgetCodeFieldOption[],
) {
  return budgetCodes.find((code) => code.id === value);
}

function getTypedBudgetCodes(budgetCodes: ProjectBudgetCodeFieldOption[]) {
  return budgetCodes.filter(
    (code) =>
      Boolean(code.costType?.trim()) && Boolean(code.costTypeId?.trim()),
  );
}

function ProjectCostCodeSelector({
  value,
  budgetCodes,
  onValueChange,
  onCreateNew,
  placeholder = "Select cost code...",
  ariaLabel = "Cost Code",
  loading = false,
  disabled = false,
  error = false,
  className,
}: ProjectCostCodeSelectorProps) {
  const selectedBudgetCode = getSelectedBudgetCode(value, budgetCodes);
  const typedBudgetCodes = React.useMemo(
    () => getTypedBudgetCodes(budgetCodes),
    [budgetCodes],
  );
  const costCodeOptions = React.useMemo(() => {
    const uniqueCodes = new Map<string, ProjectBudgetCodeFieldOption>();
    typedBudgetCodes.forEach((code) => {
      if (!uniqueCodes.has(code.code)) {
        uniqueCodes.set(code.code, code);
      }
    });
    return Array.from(uniqueCodes.values());
  }, [typedBudgetCodes]);

  const selectCostCode = (costCode: string) => {
    const currentSelection =
      selectedBudgetCode?.code === costCode ? selectedBudgetCode : undefined;
    const nextSelection =
      currentSelection ??
      typedBudgetCodes.find((code) => code.code === costCode);

    if (nextSelection) {
      onValueChange(nextSelection);
    }
  };

  return (
    <Select
      value={selectedBudgetCode?.code}
      onValueChange={(costCode) => {
        if (costCode === "__create_budget_code__") {
          onCreateNew?.();
          return;
        }

        selectCostCode(costCode);
      }}
      disabled={disabled || loading}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        className={cn("h-9 w-full", error && "border-destructive", className)}
      >
        <SelectValue placeholder={loading ? "Loading..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {costCodeOptions.map((code) => (
          <SelectItem key={code.code} value={code.code}>
            {code.code}
            {code.description ? ` - ${code.description}` : ""}
          </SelectItem>
        ))}
        {onCreateNew ? (
          <SelectItem value="__create_budget_code__">
            <span className="flex items-center">
              <Plus className="mr-2 h-4 w-4" />
              Create Budget Code
            </span>
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}

function ProjectCostTypeSelector({
  value,
  budgetCodes,
  onValueChange,
  placeholder = "Select cost type...",
  ariaLabel = "Cost Type",
  loading = false,
  disabled = false,
  error = false,
  className,
}: ProjectCostTypeSelectorProps) {
  const selectedBudgetCode = getSelectedBudgetCode(value, budgetCodes);
  const costTypeOptions = React.useMemo(() => {
    if (!selectedBudgetCode?.code) return [];

    const uniqueTypes = new Map<string, ProjectBudgetCodeFieldOption>();
    getTypedBudgetCodes(budgetCodes)
      .filter((code) => code.code === selectedBudgetCode.code)
      .forEach((code) => {
        const key = code.costTypeId ?? code.costType;
        if (key && !uniqueTypes.has(key)) uniqueTypes.set(key, code);
      });

    return Array.from(uniqueTypes.values());
  }, [budgetCodes, selectedBudgetCode?.code]);

  return (
    <Select
      value={selectedBudgetCode?.costTypeId ? selectedBudgetCode.id : undefined}
      onValueChange={(budgetCodeId) => {
        const nextSelection = costTypeOptions.find(
          (code) => code.id === budgetCodeId,
        );
        if (nextSelection) onValueChange(nextSelection);
      }}
      disabled={
        disabled ||
        loading ||
        !selectedBudgetCode?.code ||
        costTypeOptions.length === 0
      }
    >
      <SelectTrigger
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        className={cn("h-9 w-full", error && "border-destructive", className)}
      >
        <SelectValue
          placeholder={
            loading
              ? "Loading..."
              : selectedBudgetCode?.code
                ? placeholder
                : "Select cost code first"
          }
        />
      </SelectTrigger>
      <SelectContent>
        {costTypeOptions.map((code) => (
          <SelectItem key={code.id} value={code.id}>
            {code.costType}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export {
  ProjectCostCodeSelector,
  ProjectCostTypeSelector,
  type ProjectCostCodeSelectorProps,
  type ProjectCostTypeSelectorProps,
};
