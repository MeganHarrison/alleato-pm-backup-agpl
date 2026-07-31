"use client";

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import {
  InlineTableHeader,
  InlineTableHeaderRow,
  InlineTableHeaderCell,
  InlineTableBody,
  InlineTableFooter,
  InlineTableFooterRow,
  InlineTableFooterCell,
} from "@/components/ds/inline-table";
import { Rows3, Upload } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/utils";
import { budgetCodeTextValue } from "@/lib/budget/budget-code-selection";
import type { SovLineItem } from "@/lib/schemas/create-subcontract-schema";
import { calculateSOVTotals, type BudgetCode } from "./types";
import { SovGroupRow, SovLineItemRow } from "./SovTableRows";
import { SectionRuleHeading } from "@/components/layout/spacing";

interface SovSectionProps {
  sovLines: SovLineItem[];
  onSovLinesChange: (lines: SovLineItem[]) => void;
  accountingMethod: string;
  onToggleAccountingMethod: () => void;
  budgetCodes: BudgetCode[];
  loadingBudgetCodes: boolean;
  onCreateBudgetCode: () => void;
  isSubmitting: boolean;
}

export function SovSection({
  sovLines,
  onSovLinesChange,
  accountingMethod,
  onToggleAccountingMethod,
  budgetCodes,
  loadingBudgetCodes,
  onCreateBudgetCode,
  isSubmitting,
}: SovSectionProps) {
  const csvInputRef = React.useRef<HTMLInputElement>(null);
  const totals = calculateSOVTotals(sovLines);

  const sovSortableIds = React.useMemo(
    () => sovLines.map((_, index) => `sov-line-${index}`),
    [sovLines.length],
  );

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleSovDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = Number(String(active.id).replace("sov-line-", ""));
    const newIndex = Number(String(over.id).replace("sov-line-", ""));
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return;
    onSovLinesChange(
      arrayMove(sovLines, oldIndex, newIndex).map((line, i) => ({ ...line, lineNumber: i + 1 })),
    );
  };

  const handleBudgetCodeSelect = (lineIndex: number, code: BudgetCode) => {
    const updated = [...sovLines];
    updated[lineIndex] = {
      ...updated[lineIndex],
      budgetCodeId: code.id,
      budgetCodeLabel: code.fullLabel,
      budgetCode: budgetCodeTextValue(code),
    };
    onSovLinesChange(updated);
  };

  const updateSOVLine = (index: number, updates: Partial<SovLineItem>) => {
    const updated = [...sovLines];
    const current = updated[index];
    const merged = { ...current, ...updates };
    if (
      accountingMethod === "unit_quantity" &&
      (updates.quantity !== undefined || updates.unitCost !== undefined)
    ) {
      merged.amount =
        (updates.quantity ?? current.quantity ?? 0) *
        (updates.unitCost ?? current.unitCost ?? 0);
    }
    updated[index] = merged;
    onSovLinesChange(updated);
  };

  const removeSOVLine = (index: number) => {
    onSovLinesChange(sovLines.filter((_, i) => i !== index));
  };

  const addSOVLine = () => {
    const isUnitQuantity = accountingMethod === "unit_quantity";
    onSovLinesChange([
      ...sovLines,
      {
        lineNumber: sovLines.length + 1,
        budgetCodeId: "",
        budgetCodeLabel: "",
        description: "",
        amount: 0,
        quantity: 1,
        unitCost: isUnitQuantity ? 0 : undefined,
        unitOfMeasure: isUnitQuantity ? "" : undefined,
        billedToDate: 0,
      },
    ]);
  };

  const addGroup = () => {
    onSovLinesChange([
      ...sovLines,
      { lineNumber: sovLines.length + 1, description: "", amount: 0, billedToDate: 0, isGroup: true },
    ]);
  };

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) return;
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const descIdx = headers.findIndex((h) => h.includes("description"));
      const amountIdx = headers.findIndex(
        (h) => h.includes("amount") && !h.includes("remaining") && !h.includes("billed"),
      );
      const budgetCodeIdx = headers.findIndex(
        (h) => h.includes("budget") || h.includes("cost") || h.includes("code"),
      );
      const imported: SovLineItem[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (cols.every((c) => !c)) continue;
        imported.push({
          lineNumber: sovLines.length + imported.length + 1,
          description: descIdx >= 0 ? cols[descIdx] : cols[0] || "",
          budgetCode: budgetCodeIdx >= 0 ? cols[budgetCodeIdx] : undefined,
          amount: amountIdx >= 0 ? parseFloat(cols[amountIdx]) || 0 : 0,
          quantity: 1,
          billedToDate: 0,
        } as SovLineItem);
      }
      if (imported.length > 0) onSovLinesChange([...sovLines, ...imported]);
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  return (
    <section data-testid="sov-section">
      <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <SectionRuleHeading label="Schedule of Values" />
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={addGroup}
                    disabled={isSubmitting}
                    aria-label="Add Group"
                  >
                    <Rows3 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Group</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => csvInputRef.current?.click()}
                    disabled={isSubmitting}
                    aria-label="Import from CSV"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Import from CSV</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Accounting method is {accountingMethod === "amount_based" ? "amount based" : "unit/quantity"}.{" "}
          <Button
            type="button"
            variant="link"
            className="underline p-0 h-auto text-sm"
            disabled={isSubmitting}
            onClick={onToggleAccountingMethod}
            data-testid="sov-accounting-toggle"
          >
            change to unit/quantity
          </Button>
        </p>
      </div>
      <div className="space-y-6 pt-4">
        <div
          className="overflow-x-auto"
          data-testid="sov-table"
          data-accounting-method={accountingMethod}
        >
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleSovDragEnd}>
            <SortableContext items={sovSortableIds} strategy={verticalListSortingStrategy}>
              <table className="w-full text-sm">
                <InlineTableHeader>
                  <InlineTableHeaderRow>
                    <InlineTableHeaderCell className="w-12" />
                    <InlineTableHeaderCell className="min-w-72">
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted underline-offset-2 decoration-muted-foreground/40">
                                Budget Code
                              </span>
                            </TooltipTrigger>
                            <TooltipContent><p>Link to a budget code</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </InlineTableHeaderCell>
                    <InlineTableHeaderCell className="min-w-64">Description</InlineTableHeaderCell>
                    {accountingMethod === "unit_quantity" && (
                      <>
                        <InlineTableHeaderCell className="w-32" align="right">Qty</InlineTableHeaderCell>
                        <InlineTableHeaderCell className="w-32">UOM</InlineTableHeaderCell>
                        <InlineTableHeaderCell className="w-48" align="right">Unit Cost</InlineTableHeaderCell>
                      </>
                    )}
                    <InlineTableHeaderCell className="w-48" align="right">Amount</InlineTableHeaderCell>
                    <InlineTableHeaderCell className="w-40" align="right">Billed to Date</InlineTableHeaderCell>
                    <InlineTableHeaderCell className="w-40" align="right">Balance</InlineTableHeaderCell>
                    <InlineTableHeaderCell className="w-12" />
                  </InlineTableHeaderRow>
                </InlineTableHeader>
                <InlineTableBody>
                  {sovLines.map((line, index) =>
                    line.isGroup ? (
                      <SovGroupRow
                        key={`group-${index}`}
                        index={index}
                        line={line}
                        accountingMethod={accountingMethod}
                        onUpdate={updateSOVLine}
                        onRemove={removeSOVLine}
                      />
                    ) : (
                      <SovLineItemRow
                        key={`line-${index}`}
                        index={index}
                        line={line}
                        accountingMethod={accountingMethod}
                        budgetCodes={budgetCodes}
                        loadingBudgetCodes={loadingBudgetCodes}
                        onBudgetCodeSelect={handleBudgetCodeSelect}
                        onCreateBudgetCode={onCreateBudgetCode}
                        onUpdate={updateSOVLine}
                        onRemove={removeSOVLine}
                      />
                    ),
                  )}
                </InlineTableBody>
                <InlineTableFooter>
                  <InlineTableFooterRow type="action">
                    <InlineTableFooterCell className="pt-2 pb-1" />
                    <InlineTableFooterCell
                      colSpan={accountingMethod === "unit_quantity" ? 8 : 5}
                      className="pt-2 pb-1"
                    >
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-sm font-medium"
                    onClick={addSOVLine}
                    disabled={isSubmitting}
                    data-testid="sov-add-line-link"
                  >
                    + Line Item
                  </Button>
                </InlineTableFooterCell>
                    <InlineTableFooterCell className="pt-2 pb-1" />
                  </InlineTableFooterRow>
                  <InlineTableFooterRow type="totals" className="!border-t-0">
                    <InlineTableFooterCell
                      colSpan={accountingMethod === "unit_quantity" ? 6 : 3}
                      align="right"
                      className="py-3 text-xs"
                    >
                      Totals
                    </InlineTableFooterCell>
                    <InlineTableFooterCell align="right" numeric data-testid="sov-total-amount">{formatCurrency(totals.amount)}</InlineTableFooterCell>
                    <InlineTableFooterCell align="right" numeric data-testid="sov-total-billed">{formatCurrency(totals.billedToDate)}</InlineTableFooterCell>
                    <InlineTableFooterCell align="right" numeric data-testid="sov-total-remaining">{formatCurrency(totals.amountRemaining)}</InlineTableFooterCell>
                    <InlineTableFooterCell />
                  </InlineTableFooterRow>
                </InlineTableFooter>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </section>
  );
}
