"use client";

import * as React from "react";
import { useWatch, type Control, type FieldArrayWithId } from "react-hook-form";
import { ChevronDown, Download, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/table-config/formatters";
import { InlineAddButton } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/forms";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { LineItemRow } from "./LineItemRow";
import type {
  ChangeEventFormData,
  ChangeEventLineItem,
  VendorOption,
  ContractOption,
  BudgetCodeOption,
  CommitmentSovLineItem,
} from "./types";

interface LineItemsSectionProps {
  control: Control<ChangeEventFormData>;
  fields: FieldArrayWithId<ChangeEventFormData, "lineItems", "id">[];
  updateLineItem: (index: number, key: keyof ChangeEventLineItem, value: string | number) => void;
  addLineItem: () => void;
  removeLineItem: (index: number) => void;
  vendors: VendorOption[];
  contracts: ContractOption[];
  budgetCodes: BudgetCodeOption[];
  commitmentLineItemsMap: Record<string, CommitmentSovLineItem[]>;
  onCreateBudgetCode: (rowIndex: number) => void;
  handleCommitmentChange: (rowIndex: number, commitmentId: string) => void;
  handleCommitmentLineItemChange: (rowIndex: number, commitmentId: string, sovLineItemId: string) => void;
  expectingRevenue: boolean;
  csvInputRef: React.RefObject<HTMLInputElement | null>;
  handleCsvImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAddAllCommitmentLineItems: (commitmentId: string) => void;
  lineItemRevenueSource?: string;
}

export function LineItemsSection({
  control,
  fields,
  updateLineItem,
  addLineItem,
  removeLineItem,
  vendors,
  contracts,
  budgetCodes,
  commitmentLineItemsMap,
  onCreateBudgetCode,
  handleCommitmentChange,
  handleCommitmentLineItemChange,
  expectingRevenue,
  csvInputRef,
  handleCsvImport,
  handleAddAllCommitmentLineItems,
  lineItemRevenueSource = "",
}: LineItemsSectionProps) {
  const scrollShellRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  React.useEffect(() => {
    const shell = scrollShellRef.current;
    const scrollContainer = shell?.querySelector<HTMLElement>('[data-slot="table-container"]');
    if (!scrollContainer) return;

    const updateScrollAffordance = () => {
      const maxScroll = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
      setCanScrollLeft(scrollContainer.scrollLeft > 1);
      setCanScrollRight(scrollContainer.scrollLeft < maxScroll - 1);
    };

    updateScrollAffordance();
    scrollContainer.addEventListener("scroll", updateScrollAffordance, { passive: true });
    window.addEventListener("resize", updateScrollAffordance);

    return () => {
      scrollContainer.removeEventListener("scroll", updateScrollAffordance);
      window.removeEventListener("resize", updateScrollAffordance);
    };
  }, [fields.length, expectingRevenue]);

  return (
    <FormSection
      title="Line Items"
      actions={
        <LineItemsToolbar
          addLineItem={addLineItem}
          csvInputRef={csvInputRef}
          contracts={contracts}
          handleAddAllCommitmentLineItems={handleAddAllCommitmentLineItems}
        />
      }
    >
      {/* Hidden CSV file input */}
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleCsvImport}
      />

      <TooltipProvider>
        <div ref={scrollShellRef} className="line-items-scroll-shell relative rounded-lg">
          {canScrollLeft ? (
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
          ) : null}
          {canScrollRight ? (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
          ) : null}
          <Table className="w-max min-w-full table-fixed">
            <LineItemsColumnGroup showRevenue={expectingRevenue} />
            <LineItemsTableHeader showRevenue={expectingRevenue} />
            <TableBody>
              {fields.map((field, index) => (
                <LineItemRow
                  key={field.id}
                  control={control}
                  index={index}
                  updateLineItem={updateLineItem}
                  removeLineItem={removeLineItem}
                  canRemove={fields.length > 1}
                  vendors={vendors}
                  contracts={contracts}
                  budgetCodes={budgetCodes}
                  commitmentLineItemsMap={commitmentLineItemsMap}
                  onCreateBudgetCode={onCreateBudgetCode}
                  handleCommitmentChange={handleCommitmentChange}
                  handleCommitmentLineItemChange={handleCommitmentLineItemChange}
                  showRevenue={expectingRevenue}
                  lineItemRevenueSource={lineItemRevenueSource}
                />
              ))}
              <LineItemsTotalsRow control={control} showRevenue={expectingRevenue} />
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>
    </FormSection>
  );
}

function LineItemsColumnGroup({ showRevenue }: { showRevenue: boolean }) {
  return (
    <colgroup>
      <col className="w-9" />
      <col className="w-40" />
      <col className="w-40" />
      <col className="w-72" />
      <col className="w-36" />
      <col className="w-28" />
      <col className="w-44" />
      <col className="w-32" />
      {showRevenue && (
        <>
          <col className="w-24" />
          <col className="w-28" />
          <col className="w-44" />
          <col className="w-32" />
        </>
      )}
      <col className="w-36" />
      <col className="w-32" />
      <col className="w-12" />
    </colgroup>
  );
}

// ── Table Header ──

function LineItemsTableHeader({ showRevenue }: { showRevenue: boolean }) {
  const groupHeaderCellClass = "border-b border-border/60";

  return (
    <TableHeader className="border-y-0 [&_tr]:border-b-0">
      {/* Group headers */}
      <TableRow className="border-b border-border/60 hover:bg-transparent">
        <TableHead className={cn(groupHeaderCellClass, "w-9 px-1 py-1.5")} />
        <TableHead colSpan={4} className={cn(groupHeaderCellClass, "line-item-group-end px-2 py-1 text-xs font-semibold normal-case tracking-normal text-muted-foreground")}>
          Detail
        </TableHead>
        <TableHead colSpan={3} className={cn(groupHeaderCellClass, "line-item-group-end line-item-group-start border-l border-border/60 px-2 py-1 text-xs font-semibold normal-case tracking-normal text-muted-foreground")}>
          Cost
        </TableHead>
        {showRevenue && (
          <TableHead colSpan={4} className={cn(groupHeaderCellClass, "line-item-group-end line-item-group-start border-l border-border/60 px-2 py-1 text-xs font-semibold normal-case tracking-normal text-muted-foreground")}>
            Revenue
          </TableHead>
        )}
        <TableHead colSpan={2} className={cn(groupHeaderCellClass, "line-item-group-start border-l border-border/60 px-2 py-1 text-right text-xs font-semibold normal-case tracking-normal text-muted-foreground")}>
          Summary
        </TableHead>
        <TableHead className={cn(groupHeaderCellClass, "w-12 px-1 py-1")} />
      </TableRow>
      {/* Column headers */}
      <TableRow className="border-b-0 hover:bg-transparent">
        <TableHead className="w-9 px-1 py-1.5" />
        <TableHead className="min-w-40 px-0.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Commitment</TableHead>
        <TableHead className="min-w-40 px-0.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Budget Code</TableHead>
        <TableHead className="min-w-64 px-1 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Description</TableHead>
        <TableHead className="line-item-group-end min-w-36 px-0.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Vendor</TableHead>
        <TableHead className="line-item-group-start w-28 border-l border-border/60 px-2 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dotted border-muted-foreground">Qty</span>
            </TooltipTrigger>
            <TooltipContent>Cost quantity for this line item</TooltipContent>
          </Tooltip>
        </TableHead>
        <TableHead className="w-44 px-1 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Unit Cost</TableHead>
        <TableHead className="line-item-group-end w-32 px-1 py-1.5 text-right text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Cost ROM</TableHead>
        {showRevenue && (
          <>
            <TableHead className="line-item-group-start w-24 border-l border-border/60 px-2 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help border-b border-dotted border-muted-foreground">UOM</span>
                </TooltipTrigger>
                <TooltipContent>Unit of Measure</TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="w-28 px-1 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help border-b border-dotted border-muted-foreground">Qty</span>
                </TooltipTrigger>
                <TooltipContent>Revenue quantity for this line item</TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="w-44 px-1 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Unit Cost</TableHead>
            <TableHead className="line-item-group-end w-32 px-1 py-1.5 text-right text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Revenue ROM</TableHead>
          </>
        )}
        <TableHead className="line-item-group-start w-36 border-l border-border/60 px-2 py-1.5 text-right text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Non-committed</TableHead>
        <TableHead className="w-32 px-1 py-1.5 text-right text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Over / Under</TableHead>
        <TableHead className="w-12 px-1 py-1.5" />
      </TableRow>
    </TableHeader>
  );
}

// ── Totals Row ──

function LineItemsTotalsRow({
  control,
  showRevenue,
}: {
  control: Control<ChangeEventFormData>;
  showRevenue: boolean;
}) {
  const lineItems = (useWatch({ control, name: "lineItems" }) ?? []) as ChangeEventLineItem[];
  const totalCostRom = lineItems.reduce((sum, i) => sum + (i.costRom || 0), 0);
  const totalRevenueRom = lineItems.reduce((sum, i) => sum + (i.revenueRom || 0), 0);
  const totalNonCommitted = lineItems.reduce((sum, i) => sum + (i.nonCommittedCost || 0), 0);
  const totalOverUnder = totalRevenueRom - totalCostRom;
  const totalCellClass = "border-t border-border";

  return (
    <TableRow className="bg-muted/35 hover:bg-muted/35">
      <TableCell className={cn(totalCellClass, "px-1.5 pb-2.5 pt-4")} />
      <TableCell colSpan={4} className={cn(totalCellClass, "px-1.5 pb-3 pt-4 text-sm font-semibold text-foreground")}>
        Totals
      </TableCell>
      <TableCell colSpan={2} className={cn(totalCellClass, "px-1.5 pb-2.5 pt-4")} />
      <TableCell className={cn(totalCellClass, "px-1.5 pb-2.5 pt-4 text-right text-sm font-semibold text-foreground")}>
        {formatCurrency(totalCostRom)}
      </TableCell>
      {showRevenue && (
        <>
          <TableCell colSpan={3} className={cn(totalCellClass, "px-1.5 pb-2.5 pt-4")} />
          <TableCell className={cn(totalCellClass, "px-1.5 pb-2.5 pt-4 text-right text-sm font-semibold text-foreground")}>
            {formatCurrency(totalRevenueRom)}
          </TableCell>
        </>
      )}
      <TableCell className={cn(totalCellClass, "px-1.5 pb-2.5 pt-4 text-right text-sm font-semibold text-foreground")}>
        {formatCurrency(totalNonCommitted)}
      </TableCell>
      <TableCell
        className={cn(
          totalCellClass,
          "px-1.5 pb-2.5 pt-4 text-right text-sm font-semibold",
          totalOverUnder < 0 ? "text-destructive" : "text-foreground",
        )}
      >
        {formatCurrency(totalOverUnder)}
      </TableCell>
      <TableCell className={cn(totalCellClass, "px-1.5 pb-2.5 pt-4")} />
    </TableRow>
  );
}

// ── Toolbar ──

interface LineItemsToolbarProps {
  addLineItem: () => void;
  csvInputRef: React.RefObject<HTMLInputElement | null>;
  contracts: ContractOption[];
  handleAddAllCommitmentLineItems: (commitmentId: string) => void;
}

function downloadCsvTemplate() {
  const headers = "Budget Code,Description,Cost Qty,Cost Unit Cost,Revenue Qty,Revenue Unit Cost,UOM";
  const blob = new Blob([headers + "\n"], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "change-event-line-items-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function LineItemsToolbar({
  addLineItem,
  csvInputRef,
  contracts,
  handleAddAllCommitmentLineItems,
}: LineItemsToolbarProps) {
  const purchaseOrders = contracts.filter((c) => c.type === "purchase_order");
  const subcontracts = contracts.filter((c) => c.type === "subcontract");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <InlineAddButton onClick={addLineItem}>
        Add Line Item
      </InlineAddButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-8 gap-1 px-0 font-medium text-muted-foreground underline-offset-4 hover:bg-transparent hover:text-foreground"
          >
            Import
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onSelect={() => csvInputRef.current?.click()}>
            <Upload />
            Import from CSV
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={downloadCsvTemplate}>
            <Download />
            Download template
          </DropdownMenuItem>

          {contracts.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {purchaseOrders.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Add from purchase order
                  </DropdownMenuLabel>
                  {purchaseOrders.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onSelect={() => handleAddAllCommitmentLineItems(c.id)}
                    >
                      {c.label}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {subcontracts.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Add from subcontract
                  </DropdownMenuLabel>
                  {subcontracts.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onSelect={() => handleAddAllCommitmentLineItems(c.id)}
                    >
                      {c.label}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
