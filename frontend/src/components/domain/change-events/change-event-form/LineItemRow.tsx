"use client";

import { Controller, useWatch, type Control } from "react-hook-form";
import { GripVertical, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/table-config/formatters";
import { Button } from "@/components/ui/button";
import { MoneyField } from "@/components/forms/MoneyField";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { BudgetCodeSelector } from "@/components/budget/budget-code-selector";

import { VendorCombobox } from "./VendorCombobox";
import { ContractCombobox } from "./ContractCombobox";
import type {
  ChangeEventFormData,
  ChangeEventLineItem,
  VendorOption,
  ContractOption,
  BudgetCodeOption,
  CommitmentSovLineItem,
} from "./types";
import { UOM_OPTIONS, isMatchCostRevenueSource } from "./types";

interface LineItemRowProps {
  control: Control<ChangeEventFormData>;
  index: number;
  updateLineItem: (index: number, key: keyof ChangeEventLineItem, value: string | number) => void;
  removeLineItem: (index: number) => void;
  canRemove: boolean;
  vendors: VendorOption[];
  contracts: ContractOption[];
  budgetCodes: BudgetCodeOption[];
  commitmentLineItemsMap: Record<string, CommitmentSovLineItem[]>;
  onCreateBudgetCode: (rowIndex: number) => void;
  handleCommitmentChange: (rowIndex: number, commitmentId: string) => void;
  handleCommitmentLineItemChange: (rowIndex: number, commitmentId: string, sovLineItemId: string) => void;
  showRevenue: boolean;
  lineItemRevenueSource?: string;
}

export function LineItemRow({
  control,
  index,
  updateLineItem,
  removeLineItem,
  canRemove,
  vendors,
  contracts,
  budgetCodes,
  commitmentLineItemsMap,
  onCreateBudgetCode,
  handleCommitmentChange,
  handleCommitmentLineItemChange,
  showRevenue,
  lineItemRevenueSource = "",
}: LineItemRowProps) {
  // Live values for combobox value props, conditional rendering, and the
  // computed (persisted) display cells.
  const item = useWatch({
    control,
    name: `lineItems.${index}`,
  }) as ChangeEventLineItem | undefined;

  const contract = item?.contract ?? "";
  const budgetCode = item?.budgetCode ?? "";
  const vendor = item?.vendor ?? "";
  const commitmentLineItemId = item?.commitmentLineItemId ?? "";
  const costRom = item?.costRom ?? 0;
  const revenueRom = item?.revenueRom ?? 0;
  const nonCommittedCost = item?.nonCommittedCost ?? 0;

  const overUnder = (revenueRom || 0) - (costRom || 0);
  const isLinkedToCommitment = Boolean(item?.commitmentId);

  // Revenue Qty / Unit Cost are read-only ONLY when revenue mirrors cost
  // ("Match Revenue to Latest Cost"). "Enter manually" and "Quantity x Unit Cost"
  // are both user-entered. (Revenue ROM stays computed regardless — see below.)
  const isRevenueReadOnly = isMatchCostRevenueSource(lineItemRevenueSource);

  return (
    <TableRow className="group border-b-0 bg-background transition-colors hover:bg-transparent">
      {/* Drag handle */}
      <TableCell className="w-9 px-1 py-1.5 align-top">
        <div className="mt-1 cursor-grab rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </div>
      </TableCell>

      {/* Commitment */}
      <TableCell className="min-w-40 px-0.5 py-1.5 align-top">
        <ContractCombobox
          value={contract}
          onChange={(value) => handleCommitmentChange(index, value)}
          contracts={contracts}
          disabled={isLinkedToCommitment}
        />
        {contract &&
          (commitmentLineItemsMap[contract]?.length ?? 0) > 1 && (
            <Select
              value={commitmentLineItemId || ""}
              onValueChange={(value) =>
                handleCommitmentLineItemChange(index, contract, value)
              }
            >
              <SelectTrigger className="mt-1 h-8 w-full text-xs">
                <SelectValue placeholder="Select line item..." />
              </SelectTrigger>
              <SelectContent>
                {(commitmentLineItemsMap[contract] || []).map((li) => (
                  <SelectItem key={li.id} value={li.id} className="text-xs">
                    {li.line_number != null ? `#${li.line_number} ` : ""}
                    {li.budget_code ? `${li.budget_code} - ` : ""}
                    {li.description || "No description"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
      </TableCell>

      {/* Budget Code */}
      <TableCell className="min-w-40 px-0.5 py-1.5 align-top">
        <BudgetCodeSelector
          value={budgetCode || ""}
          onValueChange={(value) => updateLineItem(index, "budgetCode", value)}
          budgetCodes={budgetCodes}
          onCreateNew={() => onCreateBudgetCode(index)}
          placeholder="Select budget code..."
          disabled={isLinkedToCommitment}
        />
      </TableCell>

      {/* Description */}
      <TableCell className="min-w-64 px-1 py-1.5 align-top">
        <Controller
          control={control}
          name={`lineItems.${index}.description`}
          render={({ field }) => (
            <div className="[&_label]:sr-only">
              <TextField
                label="Description"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                placeholder="Enter description"
                className="text-[13px]"
                aria-label="Description"
              />
            </div>
          )}
        />
      </TableCell>

      {/* Vendor */}
      <TableCell className="line-item-group-end min-w-36 px-0.5 py-1.5 align-top">
        <VendorCombobox
          value={vendor}
          onChange={(value) => updateLineItem(index, "vendor", value)}
          vendors={vendors}
        />
      </TableCell>

      {/* Cost: Quantity */}
      <TableCell className="line-item-group-start w-28 border-l border-border/60 px-2 py-1.5 align-top">
        <Controller
          control={control}
          name={`lineItems.${index}.costQuantity`}
          render={({ field }) => (
            <div className="[&_label]:sr-only">
              <TextField
                label="Cost quantity"
                inputMode="numeric"
                className="min-w-20 text-right text-[13px]"
                value={Number.isFinite(field.value) ? Math.trunc(field.value) : 1}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === ""
                      ? 1
                      : Math.max(0, parseInt(e.target.value, 10) || 1),
                  )
                }
                onBlur={field.onBlur}
                onFocus={(e) => e.target.select()}
                placeholder="1"
                aria-label="Cost quantity"
              />
            </div>
          )}
        />
      </TableCell>

      {/* Cost: Unit Cost */}
      <TableCell className="w-44 px-1 py-1.5 align-top">
        <Controller
          control={control}
          name={`lineItems.${index}.costUnitCost`}
          render={({ field }) => (
            <MoneyField
              inline
              label="Cost Unit Cost"
              value={typeof field.value === "number" ? field.value : undefined}
              onChange={(val) => field.onChange(val ?? 0)}
              showCurrency={false}
              className="h-9 min-w-28 text-[13px]"
            />
          )}
        />
      </TableCell>

      {/* Cost ROM (computed) */}
      <TableCell className="line-item-group-end w-32 px-1 py-1.5 align-top">
        <div
          className={cn(
            "pt-2 text-right text-[13px] font-semibold",
            costRom > 0 ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {formatCurrency(costRom)}
        </div>
      </TableCell>

      {showRevenue && (
        <>
          {/* Revenue: UOM */}
          <TableCell className="line-item-group-start w-24 border-l border-border/60 px-2 py-1.5 align-top">
            <Controller
              control={control}
              name={`lineItems.${index}.revenueUnitOfMeasure`}
              render={({ field }) => (
                <SelectField
                  label="Unit of measure"
                  hideLabel
                  value={field.value || ""}
                  onValueChange={(value) => field.onChange(value)}
                  placeholder="Select"
                  options={UOM_OPTIONS.map((unit) => ({ value: unit, label: unit }))}
                  className="h-9 w-full text-[13px]"
                />
              )}
            />
          </TableCell>

          {/* Revenue: Quantity */}
          <TableCell className="w-28 px-1 py-1.5 align-top">
            {isRevenueReadOnly ? (
              <div className="min-w-20 pt-2 text-right text-[13px] text-muted-foreground">
                {Number.isFinite(item?.revenueQuantity) ? Math.trunc(item?.revenueQuantity ?? 1) : 1}
              </div>
            ) : (
              <Controller
                control={control}
                name={`lineItems.${index}.revenueQuantity`}
                render={({ field }) => (
                  <div className="[&_label]:sr-only">
                    <TextField
                      label="Revenue quantity"
                      inputMode="numeric"
                      className="min-w-20 text-right text-[13px]"
                      value={Number.isFinite(field.value) ? Math.trunc(field.value) : 1}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? 1
                            : Math.max(0, parseInt(e.target.value, 10) || 1),
                        )
                      }
                      onBlur={field.onBlur}
                      onFocus={(e) => e.target.select()}
                      placeholder="1"
                      aria-label="Revenue quantity"
                    />
                  </div>
                )}
              />
            )}
          </TableCell>

          {/* Revenue: Unit Cost */}
          <TableCell className="w-44 px-1 py-1.5 align-top">
            {isRevenueReadOnly ? (
              <div className="pt-2 text-right text-[13px] text-muted-foreground">
                {item?.revenueUnitCost != null ? formatCurrency(item.revenueUnitCost) : "--"}
              </div>
            ) : (
              <Controller
                control={control}
                name={`lineItems.${index}.revenueUnitCost`}
                render={({ field }) => (
                  <MoneyField
                    inline
                    label="Revenue Unit Cost"
                    value={typeof field.value === "number" ? field.value : undefined}
                    onChange={(val) => field.onChange(val ?? 0)}
                    showCurrency={false}
                    className="h-9 min-w-28 text-[13px]"
                  />
                )}
              />
            )}
          </TableCell>

          {/* Revenue ROM (computed) */}
          <TableCell className="line-item-group-end w-32 px-1 py-1.5 align-top">
            <div
              className={cn(
                "pt-2 text-right text-[13px] font-semibold",
                isRevenueReadOnly && "text-muted-foreground italic",
                !isRevenueReadOnly && (revenueRom > 0 ? "text-foreground" : "text-muted-foreground"),
              )}
            >
              {formatCurrency(revenueRom)}
            </div>
          </TableCell>
        </>
      )}

      {/* Non-committed cost */}
      <TableCell className="line-item-group-start w-36 border-l border-border/60 px-2 py-1.5 align-top">
        {contract ? (
          <Controller
            control={control}
            name={`lineItems.${index}.nonCommittedCost`}
            render={({ field }) => (
              <MoneyField
                inline
                label="Non-committed Cost"
                value={typeof field.value === "number" ? field.value : undefined}
                onChange={(val) => field.onChange(val ?? 0)}
                showCurrency={false}
                className="h-9 min-w-28 text-[13px]"
              />
            )}
          />
        ) : (
          <div
            className={cn(
              "pt-2 text-right text-[13px] font-semibold",
              (nonCommittedCost ?? 0) !== 0
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            {formatCurrency(nonCommittedCost ?? 0)}
          </div>
        )}
      </TableCell>

      {/* Over / Under (revenue − cost) */}
      <TableCell className="w-32 px-1 py-1.5 align-top">
        <div
          className={cn(
            "pt-2 text-right text-[13px] font-semibold",
            overUnder < 0
              ? "text-destructive"
              : overUnder > 0
                ? "text-foreground"
                : "text-muted-foreground",
          )}
        >
          {formatCurrency(overUnder)}
        </div>
      </TableCell>

      {/* Actions */}
      <TableCell className="w-12 px-1 py-1.5 align-top">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => removeLineItem(index)}
          disabled={!canRemove}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
